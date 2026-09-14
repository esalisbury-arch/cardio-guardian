// Reference VisionCamera Frame Processor Plugin: reduces one camera frame
// to its mean red-channel intensity (0-255) for PPG capture.
//
// This is a starting point, not a drop-in file — register it per VisionCamera's
// "Creating Frame Processor Plugins" guide (add to your Xcode target, list
// in ios/<App>/Info.plist under VisionCameraProxy plugin registration, or
// register programmatically at app startup as shown at the bottom).
// Assumes BGRA_8888 frames (VisionCamera's default iOS pixel format).

import VisionCamera
import CoreVideo

@objc(MeanRedChannelPlugin)
public class MeanRedChannelPlugin: FrameProcessorPlugin {

  // Sample every Nth pixel on both axes to stay well under the per-frame
  // time budget at 30fps; a single scalar output doesn't need full
  // resolution.
  private let stride = 8

  public override func callback(_ frame: Frame, withArguments arguments: [AnyHashable: Any]?) -> Any {
    guard let pixelBuffer = frame.buffer else { return 0.0 }

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

// Registration (typically in AppDelegate or a dedicated setup file):
//
//   FrameProcessorPluginRegistry.addFrameProcessorPlugin("meanRedChannel") { proxy, options in
//     MeanRedChannelPlugin(proxy: proxy, options: options)
//   }
