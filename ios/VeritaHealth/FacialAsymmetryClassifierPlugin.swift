// VisionCamera Frame Processor Plugin: runs the trained Core ML facial-
// asymmetry classifier (ml/face/train.py, model in Models/) on one camera
// frame and returns a single probability.
//
// IMPORTANT MODEL CAVEAT (see ml/README.md and root README.md disclaimer):
// this model is trained on PalsyNet (CC-BY-4.0, curated YouTube videos of
// Bell's palsy vs. unaffected faces). Its own documentation discloses no
// clinical verification of diagnosis, and Bell's palsy is NOT the same
// condition as stroke-related facial droop (Bell's palsy affects the
// forehead; stroke-related droop typically spares it, since the forehead
// gets bilateral cortical innervation). This plugin's output is therefore
// surfaced as an additional "asymmetry model" signal alongside — never in
// place of — the existing landmark-geometry heuristic in
// FaceLandmarksPlugin.swift, and must never be described in UI copy as
// stroke-specific.
//
// Registered for JS as "classifyFacialAsymmetry" via VISION_EXPORT_SWIFT_FRAME_PROCESSOR
// in FacialAsymmetryClassifierPluginRegistration.m — see that file.

import VisionCamera
import Vision
import CoreML
import CoreMedia
import CoreVideo

@objc(FacialAsymmetryClassifierPlugin)
public class FacialAsymmetryClassifierPlugin: FrameProcessorPlugin {
  private let visionModel: VNCoreMLModel?

  public override init(proxy: VisionCameraProxyHolder, options: [AnyHashable: Any]! = [:]) {
    if let mlModel = try? FacialAsymmetryClassifier(configuration: MLModelConfiguration()).model,
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
    request.imageCropAndScaleOption = .centerCrop

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

    return ["scoreAvailable": true, "asymmetryModelScore": multiArray[0].doubleValue]
  }
}
