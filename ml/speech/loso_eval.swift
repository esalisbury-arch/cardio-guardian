// Leave-one-speaker-out cross-validation for the dysarthria/non-dysarthria
// classifier: trains 13 separate MLSoundClassifiers (once per speaker held
// entirely out of training) and evaluates each on that one held-out
// speaker's own clips.
//
// Point: ml/speech/train_soundclassifier.swift's one fixed speaker-level
// split gave 44% validation accuracy (worse than chance) — this checks
// whether that was a fluke of which single speaker got held out, or
// whether the dataset (2-5 speakers per class) truly has no
// speaker-generalizing signal at all, averaged across every possible
// held-out speaker.
//
// Each held-out speaker is single-class by construction (every speaker in
// this dataset is either entirely dysarthric or entirely a control), so
// MLSoundClassifier's training-time `.dataSource` validation (which
// requires both classes present) can't be used for the held-out speaker —
// it throws "No data found for label X". Instead, training uses CreateML's
// own `.split(strategy: .automatic)` internal validation (carved out of
// the training pool, for a basic sanity check only), and the actual
// leave-one-speaker-out number comes from calling `.evaluation(on:)`
// afterward on the held-out speaker's own directory — this just runs
// inference and compares to their known true label, so it's fine with a
// single-class directory. The resulting classificationError is exactly
// "how often the model got this held-out speaker's own class wrong."
//
// Uses symlinks into per-fold temp directories rather than copying audio
// (8810 files) 13 times over.
//
// Invoke: swift ml/speech/loso_eval.swift

import CreateML
import Foundation

let baseDir = URL(fileURLWithPath: #filePath).deletingLastPathComponent()
let rawDir = baseDir
    .appendingPathComponent("data/raw/dysarthria/Dysarthria and Non Dysarthria/Dataset")
let tmpDir = FileManager.default.temporaryDirectory.appendingPathComponent("speech_loso_\(UUID().uuidString)")

let classDirs: [String: String] = [
    "Female_dysarthria": "dysarthria",
    "Male_Dysarthria": "dysarthria",
    "Female_Non_Dysarthria": "non_dysarthria",
    "Male_Non_Dysarthria": "non_dysarthria",
]

struct Speaker {
    let name: String
    let label: String
    let dir: URL
}

var speakers: [Speaker] = []
for (classDir, label) in classDirs {
    let classURL = rawDir.appendingPathComponent(classDir)
    guard let entries = try? FileManager.default.contentsOfDirectory(at: classURL, includingPropertiesForKeys: nil) else { continue }
    for entry in entries where (try? entry.resourceValues(forKeys: [.isDirectoryKey]))?.isDirectory == true {
        speakers.append(Speaker(name: entry.lastPathComponent, label: label, dir: entry))
    }
}
func wavFiles(in dir: URL) -> [URL] {
    guard let enumerator = FileManager.default.enumerator(at: dir, includingPropertiesForKeys: nil) else { return [] }
    return enumerator.compactMap { $0 as? URL }.filter { $0.pathExtension.lowercased() == "wav" }
}

// A couple of speakers in this Kaggle repackaging have transcript .txt files but zero
// actual .wav audio (a gap in the dataset, not a code bug) — holding those out would
// evaluate against an empty directory and produce a meaningless 0%, so skip them.
let emptySpeakers = speakers.filter { wavFiles(in: $0.dir).isEmpty }
if !emptySpeakers.isEmpty {
    print("Skipping speakers with zero audio files: \(emptySpeakers.map { $0.name }.joined(separator: ", "))")
}
speakers = speakers.filter { !wavFiles(in: $0.dir).isEmpty }
speakers.sort { $0.name < $1.name }
print("Evaluating \(speakers.count) speakers: \(speakers.map { "\($0.name)(\($0.label))" }.joined(separator: ", "))")

var results: [(String, String, Double, Double)] = []  // speaker, label, trainAcc, heldOutAcc

for heldOut in speakers {
    let foldDir = tmpDir.appendingPathComponent(heldOut.name)
    let trainDir = foldDir.appendingPathComponent("train")
    let heldOutDir = foldDir.appendingPathComponent("heldout").appendingPathComponent(heldOut.label)
    for label in ["dysarthria", "non_dysarthria"] {
        try? FileManager.default.createDirectory(at: trainDir.appendingPathComponent(label), withIntermediateDirectories: true)
    }
    try? FileManager.default.createDirectory(at: heldOutDir, withIntermediateDirectories: true)

    for speaker in speakers {
        if speaker.name == heldOut.name {
            for wav in wavFiles(in: speaker.dir) {
                let dest = heldOutDir.appendingPathComponent("\(speaker.name)_\(wav.lastPathComponent)")
                try? FileManager.default.createSymbolicLink(at: dest, withDestinationURL: wav)
            }
        } else {
            let destRoot = trainDir.appendingPathComponent(speaker.label)
            for wav in wavFiles(in: speaker.dir) {
                let dest = destRoot.appendingPathComponent("\(speaker.name)_\(wav.lastPathComponent)")
                try? FileManager.default.createSymbolicLink(at: dest, withDestinationURL: wav)
            }
        }
    }

    print("=== Fold: holding out \(heldOut.name) (\(heldOut.label)) ===")
    do {
        let trainingData = MLSoundClassifier.DataSource.labeledDirectories(at: trainDir)
        var params = MLSoundClassifier.ModelParameters()
        params.validation = .split(strategy: .automatic)

        let classifier = try MLSoundClassifier(trainingData: trainingData, parameters: params)
        let trainAcc = (1.0 - classifier.trainingMetrics.classificationError) * 100

        let heldOutMetrics = classifier.evaluation(on: .labeledDirectories(at: foldDir.appendingPathComponent("heldout")))
        let heldOutAcc = (1.0 - heldOutMetrics.classificationError) * 100
        print("  train=\(trainAcc)% heldOutSpeakerAcc=\(heldOutAcc)%")
        results.append((heldOut.name, heldOut.label, trainAcc, heldOutAcc))
    } catch {
        print("  FAILED: \(error)")
    }

    try? FileManager.default.removeItem(at: foldDir)
}

print("\n=== Summary (leave-one-speaker-out) ===")
for (name, label, trainAcc, heldOutAcc) in results {
    print("\(name) (\(label)): train=\(String(format: "%.1f", trainAcc))% heldOutSpeakerAcc=\(String(format: "%.1f", heldOutAcc))%")
}
let avgHeldOut = results.map { $0.3 }.reduce(0, +) / Double(max(results.count, 1))
print("Average held-out-speaker accuracy: \(String(format: "%.1f", avgHeldOut))% across \(results.count) folds")

let dysResults = results.filter { $0.1 == "dysarthria" }
let nonDysResults = results.filter { $0.1 == "non_dysarthria" }
func avg(_ xs: [(String, String, Double, Double)]) -> Double { xs.map { $0.3 }.reduce(0, +) / Double(max(xs.count, 1)) }
print("  -> avg on held-out DYSARTHRIC speakers (= recall for dysarthria): \(String(format: "%.1f", avg(dysResults)))%")
print("  -> avg on held-out NON-dysarthric speakers (= recall for non_dysarthria): \(String(format: "%.1f", avg(nonDysResults)))%")

try? FileManager.default.removeItem(at: tmpDir)
