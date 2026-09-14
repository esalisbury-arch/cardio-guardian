// Reference VisionCamera Frame Processor Plugin: detects a face in one
// camera frame and returns a flat record of key landmark points (eye
// centers/lids, mouth corners) for src/signal/faceSymmetryAnalysis.ts to
// compare left vs right. Uses Apple's Vision framework — no extra
// dependency or CocoaPod needed, it ships with iOS.
//
// This is a starting point, not a drop-in file — register it per VisionCamera's
// "Creating Frame Processor Plugins" guide, same as MeanRedChannelPlugin.swift.
//
// Coordinate note: `pointsInImage(imageSize:)` returns points in the full
// frame's coordinate space, which is all this plugin's consumer needs —
// src/signal/faceSymmetryAnalysis.ts only ever compares distances *within*
// one frame, so it doesn't matter whether that space is nominally top-left
// or bottom-left origin as long as it's consistent, which Vision guarantees.
//
// Mirroring note: the front camera's raw buffer is not necessarily mirrored
// the way the on-screen preview is. "leftMouthCorner" here means "the
// corner at the smaller X coordinate in the raw frame", which may or may
// not match the subject's anatomical left depending on orientation/mirroring
// — verify this on a real device before trusting the left/right labels in
// UI copy that names a side. It does not affect whether asymmetry is
// detected, only which side gets named.

import VisionCamera
import Vision
import CoreVideo

@objc(FaceLandmarksPlugin)
public class FaceLandmarksPlugin: FrameProcessorPlugin {

  public override func callback(_ frame: Frame, withArguments arguments: [AnyHashable: Any]?) -> Any {
    guard let pixelBuffer = frame.buffer else {
      return ["faceDetected": false]
    }

    let imageSize = CGSize(
      width: CVPixelBufferGetWidth(pixelBuffer),
      height: CVPixelBufferGetHeight(pixelBuffer)
    )

    let request = VNDetectFaceLandmarksRequest()
    let handler = VNImageRequestHandler(cvPixelBuffer: pixelBuffer, orientation: .up, options: [:])

    do {
      try handler.perform([request])
    } catch {
      return ["faceDetected": false]
    }

    guard
      let face = request.results?.first as? VNFaceObservation,
      let landmarks = face.landmarks
    else {
      return ["faceDetected": false]
    }

    // Landmark regions are normalized to the face bounding box; convert to
    // full-frame coordinates so left/right comparisons share one frame of
    // reference (needed since the two eyes/mouth corners come from
    // different, independently-normalized regions).
    func imagePoints(_ region: VNFaceLandmarkRegion2D?) -> [CGPoint] {
      guard let region = region else { return [] }
      let boxOrigin = face.boundingBox.origin
      let boxSize = face.boundingBox.size
      return region.normalizedPoints.map { p in
        CGPoint(
          x: (boxOrigin.x + p.x * boxSize.width) * imageSize.width,
          y: (boxOrigin.y + p.y * boxSize.height) * imageSize.height
        )
      }
    }

    func center(_ points: [CGPoint]) -> CGPoint? {
      guard !points.isEmpty else { return nil }
      let sum = points.reduce(CGPoint.zero) { CGPoint(x: $0.x + $1.x, y: $0.y + $1.y) }
      return CGPoint(x: sum.x / CGFloat(points.count), y: sum.y / CGFloat(points.count))
    }

    let leftEyePoints = imagePoints(landmarks.leftEye)
    let rightEyePoints = imagePoints(landmarks.rightEye)
    let mouthPoints = imagePoints(landmarks.outerLips)

    guard
      let leftEyeCenter = center(leftEyePoints),
      let rightEyeCenter = center(rightEyePoints),
      let leftEyeTop = leftEyePoints.max(by: { $0.y < $1.y }),
      let leftEyeBottom = leftEyePoints.min(by: { $0.y < $1.y }),
      let rightEyeTop = rightEyePoints.max(by: { $0.y < $1.y }),
      let rightEyeBottom = rightEyePoints.min(by: { $0.y < $1.y }),
      let leftMouthCorner = mouthPoints.min(by: { $0.x < $1.x }),
      let rightMouthCorner = mouthPoints.max(by: { $0.x < $1.x })
    else {
      return ["faceDetected": false]
    }

    return [
      "faceDetected": true,
      "leftEyeCenterX": leftEyeCenter.x, "leftEyeCenterY": leftEyeCenter.y,
      "rightEyeCenterX": rightEyeCenter.x, "rightEyeCenterY": rightEyeCenter.y,
      "leftEyeTopX": leftEyeTop.x, "leftEyeTopY": leftEyeTop.y,
      "leftEyeBottomX": leftEyeBottom.x, "leftEyeBottomY": leftEyeBottom.y,
      "rightEyeTopX": rightEyeTop.x, "rightEyeTopY": rightEyeTop.y,
      "rightEyeBottomX": rightEyeBottom.x, "rightEyeBottomY": rightEyeBottom.y,
      "leftMouthCornerX": leftMouthCorner.x, "leftMouthCornerY": leftMouthCorner.y,
      "rightMouthCornerX": rightMouthCorner.x, "rightMouthCornerY": rightMouthCorner.y,
    ]
  }
}

// Registration (typically in AppDelegate or a dedicated setup file):
//
//   FrameProcessorPluginRegistry.addFrameProcessorPlugin("detectFaceLandmarks") { proxy, options in
//     FaceLandmarksPlugin(proxy: proxy, options: options)
//   }
