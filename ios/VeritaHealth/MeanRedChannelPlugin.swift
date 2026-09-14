// VisionCamera Frame Processor Plugin: reduces one camera frame to its mean
// red-channel intensity (0-255) for PPG capture in the "Run Active Check" flow.
//
// Registered for JS as "meanRedChannel" via the VISION_EXPORT_SWIFT_FRAME_PROCESSOR
// macro in MeanRedChannelPluginRegistration.m — see that file for the registration
// call. Ported from ios_native_reference/MeanRedChannelPlugin.swift.
//
// Assumes BGRA_8888 frames (VisionCamera's default iOS pixel format).

import VisionCamera
import CoreMedia
import CoreVideo

@objc(MeanRedChannelPlugin)
public class MeanRedChannelPlugin: FrameProcessorPlugin {

  // Sample every Nth pixel on both axes to stay well under the per-frame
  // time budget at 30fps; a single scalar output doesn't need full
  // resolution.
  private let stride = 8

  public override func callback(_ frame: Frame, withArguments arguments: [AnyHashable: Any]?) -> Any {
    // frame.buffer is a CMSampleBuffer; the raw pixels live in its attached
    // CVPixelBuffer (image buffer).
    guard let pixelBuffer = CMSampleBufferGetImageBuffer(frame.buffer) else { return 0.0 }

    CVPixelBufferLockBaseAddress(pixelBuffer, .readOnly)
    defer { CVPixelBufferUnlockBaseAddress(pixelBuffer, .readOnly) }

    guard let baseAddress = CVPixelBufferGetBaseAddress(pixelBuffer) else { return 0.0 }

    let width = CVPixelBufferGetWidth(pixelBuffer)
    let height = CVPixelBufferGetHeight(pixelBuffer)
    let bytesPerRow = CVPixelBufferGetBytesPerRow(pixelBuffer)
    let buffer = baseAddress.assumingMemoryBound(to: UInt8.self)

    // BGRA_8888: byte order is B, G, R, A per pixel.
    var sum: UInt64 = 0
    var count: UInt64 = 0

    var y = 0
    while y < height {
      var x = 0
      while x < width {
        let offset = y * bytesPerRow + x * 4
        if offset + 2 < bytesPerRow * height {
          let r = buffer[offset + 2]
          sum += UInt64(r)
          count += 1
        }
        x += stride
      }
      y += stride
    }

    return count > 0 ? Double(sum) / Double(count) : 0.0
  }
}
