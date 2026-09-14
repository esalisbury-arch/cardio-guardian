// Reference VisionCamera Frame Processor Plugin: reduces one camera frame
// to its mean red-channel intensity (0-255) for PPG capture.
//
// This is a starting point, not a drop-in file — wire it up per VisionCamera's
// "Creating Frame Processor Plugins" guide (register in your app's
// MainApplication/Package, add to android/app/build.gradle). Assumes YUV_420_888
// frames (VisionCamera's default Android format), where the Y plane alone is
// insufficient for red-channel PPG, so this samples the interleaved
// U/V-adjacent luma neighborhood as a red-proxy via the standard YUV->RGB
// transform on a sparse pixel grid (full-frame conversion at 30fps is too
// slow on most devices).
//
// package: com.veritahealth.frameprocessors (adjust to your app id)

package com.veritahealth.frameprocessors

import android.graphics.ImageFormat
import android.media.Image
import com.mrousavy.camera.frameprocessors.Frame
import com.mrousavy.camera.frameprocessors.FrameProcessorPlugin
import com.mrousavy.camera.frameprocessors.VisionCameraProxy
import kotlin.math.max
import kotlin.math.min

class MeanRedChannelPlugin(proxy: VisionCameraProxy, options: Map<String, Any>?) :
    FrameProcessorPlugin() {

    // Sample every Nth pixel on both axes; full-resolution conversion is
    // unnecessary for a single scalar "mean redness" value and would blow
    // the per-frame time budget.
    private val stride = 8

    override fun callback(frame: Frame, arguments: Map<String, Any>?): Any {
        val image: Image = frame.image
        if (image.format != ImageFormat.YUV_420_888) {
            throw IllegalArgumentException("MeanRedChannelPlugin expects YUV_420_888, got ${image.format}")
        }

        val yPlane = image.planes[0]
        val vPlane = image.planes[2] // V (Cr) plane correlates most directly with red intensity
        val width = image.width
        val height = image.height

        val yBuffer = yPlane.buffer
        val vBuffer = vPlane.buffer
        val yRowStride = yPlane.rowStride
        val vRowStride = vPlane.rowStride
        val vPixelStride = vPlane.pixelStride

        var sum = 0L
        var count = 0L

        var row = 0
        while (row < height) {
            var col = 0
            while (col < width) {
                val yIndex = row * yRowStride + col
                val vRow = row / 2
                val vCol = (col / 2) * vPixelStride
                val vIndex = vRow * vRowStride + vCol

                if (yIndex < yBuffer.capacity() && vIndex < vBuffer.capacity()) {
                    val y = yBuffer.get(yIndex).toInt() and 0xFF
                    val v = vBuffer.get(vIndex).toInt() and 0xFF
                    // BT.601 YUV->R approximation, clamped to 0..255
                    val r = (y + 1.402 * (v - 128)).toInt()
                    sum += max(0, min(255, r))
                    count++
                }
                col += stride
            }
            row += stride
        }

        return if (count > 0) (sum.toDouble() / count.toDouble()) else 0.0
    }
}

// Registration (typically in your ReactPackage's createFrameProcessorPlugins,
// or via VisionCameraProxy's plugin registry per the current VisionCamera version):
//
//   VisionCameraProxy.getInstance(reactContext).initFrameProcessorPlugin(
//       "meanRedChannel"
//   ) { proxy, options -> MeanRedChannelPlugin(proxy, options) }
