// Registers FacialAsymmetryClassifierPlugin.swift with VisionCamera's Frame
// Processor runtime under the JS-visible name "classifyFacialAsymmetry"
// (see src/sensors/faceLandmarkCamera.ts). Same pattern as
// FaceLandmarksPluginRegistration.m — see that file's comment for why this
// must be an .m file.

#import "VeritaHealth-Swift.h"
#import <VisionCamera/FrameProcessorPlugin.h>
#import <VisionCamera/FrameProcessorPluginRegistry.h>

VISION_EXPORT_SWIFT_FRAME_PROCESSOR(FacialAsymmetryClassifierPlugin, classifyFacialAsymmetry)
