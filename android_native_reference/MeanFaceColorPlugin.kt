// Reference VisionCamera Frame Processor Plugin for Pallor Check: reduces
// the CENTER CROP of one camera frame (where a face filling the on-screen
// guide oval should be) to a mean RGB color, for
// src/signal/facialPallorAnalysis.ts to compare against a saved baseline.
//
// `faceDetected` here is NOT real face detection — it's a coarse brightness
// sanity check (rejects frames that are essentially black/covered or
// blown-out white, which a real face under normal lighting never is). The
// screen's on-screen guide oval and instructions are what actually get a
// face into the sampled region, same as this project's other camera checks.
// If you want real face detection here too, see FaceLandmarksPlugin.kt and
// adapt it to report faceDetected instead of running a second ML Kit pass
// per frame.
//
// This is a starting point, not a drop-in file — wire it up per VisionCamera's
// "Creating Frame Processor Plugins" guide (register in your app's
// MainApplication/Package, add to android/app/build.gradle). Assumes
// YUV_420_888 frames (VisionCamera's default Android format).
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

class MeanFaceColorPlugin(proxy: VisionCameraProxy, options: Map<String, Any>?) :
    FrameProcessorPlugin() {

    // Sample every Nth pixel on both axes; averaging doesn't need full
    // resolution and full-resolution conversion would blow the per-frame
    // time budget.
    private val stride = 6

    // Center 50% of the frame on both axes — roughly where a face fills
    // FaceCheckScreen-style oval guide overlay.
    private val cropFraction = 0.5

    // A real, camera-lit face is neither near-black (covered lens, dark
    // room) nor blown-out white (pointed at a light/window).
    private val minPlausibleLuma = 25.0
    private val maxPlausibleLuma = 235.0

    override fun callback(frame: Frame, arguments: Map<String, Any>?): Any {
        val image: Image = frame.image
        if (image.format != ImageFormat.YUV_420_888) {
            throw IllegalArgumentException("MeanFaceColorPlugin expects YUV_420_888, got ${image.format}")
        }

        val yPlane = image.planes[0]
        val uPlane = image.planes[1]
        val vPlane = image.planes[2]
        val width = image.width
        val height = image.height

        val yBuffer = yPlane.buffer
        val uBuffer = uPlane.buffer
        val vBuffer = vPlane.buffer
        val yRowStride = yPlane.rowStride
        val uRowStride = uPlane.rowStride
        val vRowStride = vPlane.rowStride
        val uPixelStride = uPlane.pixelStride
        val vPixelStride = vPlane.pixelStride

        val cropW = (width * cropFraction).toInt()
        val cropH = (height * cropFraction).toInt()
        val startX = (width - cropW) / 2
        val startY = (height - cropH) / 2

        var sumR = 0L
        var sumG = 0L
        var sumB = 0L
        var sumY = 0L
        var count = 0L

        var row = startY
        while (row < startY + cropH) {
            var col = startX
            while (col < startX + cropW) {
                val yIndex = row * yRowStride + col
                val uvRow = row / 2
                val uCol = (col / 2) * uPixelStride
                val vCol = (col / 2) * vPixelStride
                val uIndex = uvRow * uRowStride + uCol
                val vIndex = uvRow * vRowStride + vCol

                if (yIndex < yBuffer.capacity() && uIndex < uBuffer.capacity() && vIndex < vBuffer.capacity()) {
                    val y = yBuffer.get(yIndex).toInt() and 0xFF
                    val u = uBuffer.get(uIndex).toInt() and 0xFF
                    val v = vBuffer.get(vIndex).toInt() and 0xFF

                    // BT.601 YUV->RGB approximation, clamped to 0..255
                    val r = (y + 1.402 * (v - 128)).toInt()
                    val g = (y - 0.344136 * (u - 128) - 0.714136 * (v - 128)).toInt()
                    val b = (y + 1.772 * (u - 128)).toInt()

                    sumR += max(0, min(255, r))
                    sumG += max(0, min(255, g))
                    sumB += max(0, min(255, b))
                    sumY += y
                    count++
                }
                col += stride
            }
            row += stride
        }

        if (count == 0L) {
            return mapOf("r" to 0.0, "g" to 0.0, "b" to 0.0, "faceDetected" to false)
        }

        val meanY = sumY.toDouble() / count.toDouble()
        val faceDetected = meanY in minPlausibleLuma..maxPlausibleLuma

        return mapOf(
            "r" to sumR.toDouble() / count.toDouble(),
            "g" to sumG.toDouble() / count.toDouble(),
            "b" to sumB.toDouble() / count.toDouble(),
            "faceDetected" to faceDetected
        )
    }
}

// Registration (typically in your ReactPackage's createFrameProcessorPlugins,
// or via VisionCameraProxy's plugin registry per the current VisionCamera version):
//
//   VisionCameraProxy.getInstance(reactContext).initFrameProcessorPlugin(
//       "meanFaceColor"
//   ) { proxy, options -> MeanFaceColorPlugin(proxy, options) }
