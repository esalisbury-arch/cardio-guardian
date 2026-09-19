// VisionCamera Frame Processor Plugin: runs the trained Core ML anemia-risk
// classifier (ml/pallor/train.py, model in Models/) on the same center crop
// MeanFaceColorPlugin.swift already samples for the color-distance heuristic.
//
// MODEL CAVEAT (see ml/README.md): trained on ~215 patients from the
// Eyes-defy-anemia dataset, labeled by real lab hemoglobin values against
// WHO anemia thresholds — solid ground truth, but a very small research
// dataset, not a validated diagnostic model. Score convention: higher =
// more anemia-flagged (index 1 of ["non_anemic", "anemic"] at training
// time), matching facialPallorAnalysis.ts's existing "higher = more
// concerning" convention for rednessDrop. Surfaced as an additional signal
// alongside — never in place of — the existing color-distance heuristic.
//
// Registered for JS as "classifyPallor" via VISION_EXPORT_SWIFT_FRAME_PROCESSOR
// in PallorClassifierPluginRegistration.m — see that file.

import VisionCamera
import Vision
import CoreML
import CoreMedia
import CoreVideo

@objc(PallorClassifierPlugin)
public class PallorClassifierPlugin: FrameProcessorPlugin {
  private let visionModel: VNCoreMLModel?

  // Matches MeanFaceColorPlugin.swift's centered crop so both signals look at the same region.
  private let regionOfInterest = CGRect(x: 0.25, y: 0.25, width: 0.5, height: 0.5)

  public override init(proxy: VisionCameraProxyHolder, options: [AnyHashable: Any]! = [:]) {
    if let mlModel = try? PallorClassifier(configuration: MLModelConfiguration()).model,
       let wrapped = try? VNCoreMLModel(for: mlModel) {
      self.visionModel = wrapped
    } else {
      self.visionModel = nil
    }
    super.init(proxy: proxy, options: options)
  }

  public override func callback(_ frame: Frame, withArguments arguments: [AnyHashable: Any]?) -> Any {
    guard
      let visionModel = visionModel,
      let pixelBuffer = CMSampleBufferGetImageBuffer(frame.buffer)
    else {
      return ["scoreAvailable": false]
    }

    let request = VNCoreMLRequest(model: visionModel)
    request.imageCropAndScaleOption = .scaleFill
    request.regionOfInterest = regionOfInterest

    let handler = VNImageRequestHandler(cvPixelBuffer: pixelBuffer, orientation: .up, options: [:])
    do {
      try handler.perform([request])
    } catch {
      return ["scoreAvailable": false]
    }

    guard
      let result = request.results?.first as? VNCoreMLFeatureValueObservation,
      let multiArray = result.featureValue.multiArrayValue,
      multiArray.count > 0
    else {
      return ["scoreAvailable": false]
    }

    return ["scoreAvailable": true, "pallorModelScore": multiArray[0].doubleValue]
  }
}
