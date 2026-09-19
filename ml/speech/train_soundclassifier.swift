// Trains the Speech Check dysarthria/slurred-speech classifier via Create ML's
// MLSoundClassifier (Apple's purpose-built path for "classify a short audio
// clip" — at runtime this pairs with the SoundAnalysis framework's
// SNClassifySoundRequest, avoiding hand-rolled spectrogram math in Swift).
//
// Run: ml/speech/prepare_data.py must be run first (builds data/prepared/{train,val}/{dysarthria,non_dysarthria}/).
// Invoke: swift ml/speech/train_soundclassifier.swift

import CreateML
import Foundation

let baseDir = URL(fileURLWithPath: #filePath).deletingLastPathComponent()
let trainDir = baseDir.appendingPathComponent("data/prepared/train")
let valDir = baseDir.appendingPathComponent("data/prepared/val")
let outputDir = baseDir.appendingPathComponent("output")
try? FileManager.default.createDirectory(at: outputDir, withIntermediateDirectories: true)

let trainingData = MLSoundClassifier.DataSource.labeledDirectories(at: trainDir)
let validationData = MLSoundClassifier.DataSource.labeledDirectories(at: valDir)

var params = MLSoundClassifier.ModelParameters()
params.validation = .dataSource(validationData)

print("Training MLSoundClassifier...")
let classifier = try MLSoundClassifier(trainingData: trainingData, parameters: params)

let trainAccuracy = (1.0 - classifier.trainingMetrics.classificationError) * 100
let validationAccuracy = (1.0 - classifier.validationMetrics.classificationError) * 100
print("Training accuracy: \(trainAccuracy)%")
print("Validation accuracy: \(validationAccuracy)%")

let modelURL = outputDir.appendingPathComponent("SpeechDysarthriaClassifier.mlmodel")
let metadata = MLModelMetadata(
    author: "Verita Health",
    shortDescription: "Dysarthria/slurred-speech classifier trained on a TORGO-derived Kaggle dataset (speaker-level train/val split). Not clinically validated.",
    version: "1.0"
)
try classifier.write(to: modelURL, metadata: metadata)
print("Saved to \(modelURL.path)")
