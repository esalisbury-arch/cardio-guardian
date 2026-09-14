// Reference VisionCamera Frame Processor Plugin: detects a face in one
// camera frame and returns a flat record of key landmark points (eye
// centers/lids, mouth corners) for src/signal/faceSymmetryAnalysis.ts to
// compare left vs right. Uses Google ML Kit Face Detection (on-device,
// bundled model — no Firebase project or network call required).
//
// This is a starting point, not a drop-in file — wire it up per VisionCamera's
// "Creating Frame Processor Plugins" guide, same as MeanRedChannelPlugin.kt.
// Also add to android/app/build.gradle:
//   implementation("com.google.mlkit:face-detection:16.1.7")
//
// package: com.veritahealth.frameprocessors (adjust to your app id)

package com.veritahealth.frameprocessors

import com.google.android.gms.tasks.Tasks
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.face.Face
import com.google.mlkit.vision.face.FaceContour
import com.google.mlkit.vision.face.FaceDetection
import com.google.mlkit.vision.face.FaceDetectorOptions
import com.google.mlkit.vision.face.FaceLandmark
import com.mrousavy.camera.frameprocessors.Frame
import com.mrousavy.camera.frameprocessors.FrameProcessorPlugin
import com.mrousavy.camera.frameprocessors.VisionCameraProxy
import java.util.concurrent.TimeUnit
import kotlin.math.max
import kotlin.math.min

class FaceLandmarksPlugin(proxy: VisionCameraProxy, options: Map<String, Any>?) :
    FrameProcessorPlugin() {

    private val detectorOptions = FaceDetectorOptions.Builder()
        .setLandmarkMode(FaceDetectorOptions.LANDMARK_MODE_ALL)
        .setContourMode(FaceDetectorOptions.CONTOUR_MODE_ALL)
        .setPerformanceMode(FaceDetectorOptions.PERFORMANCE_MODE_FAST)
        .build()

    private val detector = FaceDetection.getClient(detectorOptions)

    override fun callback(frame: Frame, arguments: Map<String, Any>?): Any {
        val notDetected = mapOf("faceDetected" to false)
        val rotationDegrees = frame.orientation.toDegrees()
        val inputImage = InputImage.fromMediaImage(frame.image, rotationDegrees)

        val faces: List<Face> = try {
            // ML Kit's detector is Task-based (async); frame processors run on
            // their own background thread already, so blocking here briefly
            // is the standard pattern for synchronous ML Kit frame processor
            // plugins. A short timeout avoids stalling the pipeline if the
            // model hiccups on one frame.
            Tasks.await(detector.process(inputImage), 1000, TimeUnit.MILLISECONDS)
        } catch (e: Exception) {
            return notDetected
        }

        val face = faces.firstOrNull() ?: return notDetected

        val leftEyeContour = face.getContour(FaceContour.LEFT_EYE)?.points
        val rightEyeContour = face.getContour(FaceContour.RIGHT_EYE)?.points
        val leftMouth = face.getLandmark(FaceLandmark.MOUTH_LEFT)?.position
        val rightMouth = face.getLandmark(FaceLandmark.MOUTH_RIGHT)?.position
        val leftEyeLandmark = face.getLandmark(FaceLandmark.LEFT_EYE)?.position
        val rightEyeLandmark = face.getLandmark(FaceLandmark.RIGHT_EYE)?.position

        if (leftEyeContour.isNullOrEmpty() || rightEyeContour.isNullOrEmpty() ||
            leftMouth == null || rightMouth == null || leftEyeLandmark == null || rightEyeLandmark == null
        ) {
            return notDetected
        }

        val leftEyeTop = leftEyeContour.maxByOrNull { it.y }!! // smaller y = higher on screen in ML Kit's image space
        val leftEyeBottom = leftEyeContour.minByOrNull { it.y }!!
        val rightEyeTop = rightEyeContour.maxByOrNull { it.y }!!
        val rightEyeBottom = rightEyeContour.minByOrNull { it.y }!!

        return mapOf(
            "faceDetected" to true,
            "leftEyeCenterX" to leftEyeLandmark.x, "leftEyeCenterY" to leftEyeLandmark.y,
            "rightEyeCenterX" to rightEyeLandmark.x, "rightEyeCenterY" to rightEyeLandmark.y,
            "leftEyeTopX" to leftEyeTop.x, "leftEyeTopY" to leftEyeTop.y,
            "leftEyeBottomX" to leftEyeBottom.x, "leftEyeBottomY" to leftEyeBottom.y,
            "rightEyeTopX" to rightEyeTop.x, "rightEyeTopY" to rightEyeTop.y,
            "rightEyeBottomX" to rightEyeBottom.x, "rightEyeBottomY" to rightEyeBottom.y,
            "leftMouthCornerX" to leftMouth.x, "leftMouthCornerY" to leftMouth.y,
            "rightMouthCornerX" to rightMouth.x, "rightMouthCornerY" to rightMouth.y,
        )
    }
}

// Registration (typically in your ReactPackage's createFrameProcessorPlugins,
// or via VisionCameraProxy's plugin registry per the current VisionCamera version):
//
//   VisionCameraProxy.getInstance(reactContext).initFrameProcessorPlugin(
//       "detectFaceLandmarks"
//   ) { proxy, options -> FaceLandmarksPlugin(proxy, options) }
