// VisionCamera Frame Processor Plugin for Pallor Check: reduces the CENTER
// CROP of one camera frame (where a face filling the on-screen guide oval
// should be) to a mean RGB color, for src/signal/facialPallorAnalysis.ts to
// compare against a saved baseline.
//
// `faceDetected` here is NOT real face detection — it's a coarse brightness
// sanity check (rejects frames that are essentially black/covered or
// blown-out white). The screen's on-screen guide oval is what actually
// gets a face into the sampled region, same as this project's other camera
// checks.
//
// Registered for JS as "meanFaceColor" via the VISION_EXPORT_SWIFT_FRAME_PROCESSOR
// macro in MeanFaceColorPluginRegistration.m — see that file for the registration
// call. Ported from ios_native_reference/MeanFaceColorPlugin.swift.
//
// Assumes BGRA_8888 frames (VisionCamera's default iOS pixel format).

import VisionCamera
import CoreMedia
import CoreVideo

@objc(MeanFaceColorPlugin)
public class MeanFaceColorPlugin: FrameProcessorPlugin {

  // Sample every Nth pixel on both axes to stay well under the per-frame
  // time budget at 30fps.
  private let stride = 6

  // Center 50% of the frame on both axes — roughly where a face fills
  // FaceCheckScreen-style oval guide overlay.
  private let cropFraction: CGFloat = 0.5

  // A real, camera-lit face is neither near-black (covered lens, dark
  // room) nor blown-out white (pointed at a light/window).
  private let minPlausibleLuma: Double = 25
  private let maxPlausibleLuma: Double = 235

  public override func callback(_ frame: Frame, withArguments arguments: [AnyHashable: Any]?) -> Any {
    // frame.buffer is a CMSampleBuffer; the raw pixels live in its attached
    // CVPixelBuffer (image buffer).
    guard let pixelBuffer = CMSampleBufferGetImageBuffer(frame.buffer) else {
      return ["r": 0.0, "g": 0.0, "b": 0.0, "faceDetected": false]
    }

    CVPixelBufferLockBaseAddress(pixelBuffer, .readOnly)
    defer { CVPixelBufferUnlockBaseAddress(pixelBuffer, .readOnly) }

    guard let baseAddress = CVPixelBufferGetBaseAddress(pixelBuffer) else {
      return ["r": 0.0, "g": 0.0, "b": 0.0, "faceDetected": false]
    }

    let width = CVPixelBufferGetWidth(pixelBuffer)
    let height = CVPixelBufferGetHeight(pixelBuffer)
    let bytesPerRow = CVPixelBufferGetBytesPerRow(pixelBuffer)
    let buffer = baseAddress.assumingMemoryBound(to: UInt8.self)

    let cropW = Int(CGFloat(width) * cropFraction)
    let cropH = Int(CGFloat(height) * cropFraction)
    let startX = (width - cropW) / 2
    let startY = (height - cropH) / 2

    // BGRA_8888: byte order is B, G, R, A per pixel.
    var sumR: UInt64 = 0
    var sumG: UInt64 = 0
    var sumB: UInt64 = 0
    var sumLuma: Double = 0
    var count: UInt64 = 0

    var y = startY
    while y < startY + cropH {
      var x = startX
      while x < startX + cropW {
        let offset = y * bytesPerRow + x * 4
        if offset + 2 < bytesPerRow * height {
          let b = buffer[offset]
          let g = buffer[offset + 1]
          let r = buffer[offset + 2]
          sumR += UInt64(r)
          sumG += UInt64(g)
          sumB += UInt64(b)
          sumLuma += 0.299 * Double(r) + 0.587 * Double(g) + 0.114 * Double(b)
          count += 1
        }
        x += stride
      }
      y += stride
    }

    guard count > 0 else {
      return ["r": 0.0, "g": 0.0, "b": 0.0, "faceDetected": false]
    }

    let meanLuma = sumLuma / Double(count)
    let faceDetected = meanLuma >= minPlausibleLuma && meanLuma <= maxPlausibleLuma

    return [
      "r": Double(sumR) / Double(count),
      "g": Double(sumG) / Double(count),
      "b": Double(sumB) / Double(count),
      "faceDetected": faceDetected,
    ]
  }
}
