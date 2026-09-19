// Registers PallorClassifierPlugin.swift with VisionCamera's Frame Processor
// runtime under the JS-visible name "classifyPallor" (see
// src/sensors/faceColorCamera.ts). Same pattern as
// FacialAsymmetryClassifierPluginRegistration.m.

#import "VeritaHealth-Swift.h"
#import <VisionCamera/FrameProcessorPlugin.h>
#import <VisionCamera/FrameProcessorPluginRegistry.h>

VISION_EXPORT_SWIFT_FRAME_PROCESSOR(PallorClassifierPlugin, classifyPallor)
