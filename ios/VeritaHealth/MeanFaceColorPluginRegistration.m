// Registers MeanFaceColorPlugin.swift with VisionCamera's Frame Processor
// runtime under the JS-visible name "meanFaceColor" (see src/sensors/faceColorCamera.ts).
//
// VISION_EXPORT_SWIFT_FRAME_PROCESSOR runs this registration automatically at
// load time via an Objective-C __attribute__((constructor)) — no app-startup
// code needed. Must be an .m file: the macro expands to an @interface/@implementation
// category, which Swift can't host itself.

#import "VeritaHealth-Swift.h"
#import <VisionCamera/FrameProcessorPlugin.h>
#import <VisionCamera/FrameProcessorPluginRegistry.h>

VISION_EXPORT_SWIFT_FRAME_PROCESSOR(MeanFaceColorPlugin, meanFaceColor)
