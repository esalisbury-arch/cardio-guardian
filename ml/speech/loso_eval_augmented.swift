// Same leave-one-speaker-out design as loso_eval.swift, but training pools
// also include the pitch/tempo-augmented copies from augment_data.py for
// every speaker EXCEPT the held-out one. The held-out speaker's evaluation
// set is always pure, unaugmented original recordings — augmenting that
// side would make the eval leaky/meaningless.
//
// Run: ml/speech/augment_data.py must be run first.
// Invoke: swift ml/speech/loso_eval_augmented.swift

import CreateML
import Foundation

let baseDir = URL(fileURLWithPath: #filePath).deletingLastPathComponent()
let rawDir = baseDir
    .appendingPathComponent("data/raw/dysarthria/Dysarthria and Non Dysarthria/Dataset")
let augDir = baseDir.appendingPathComponent("data/augmented")
let tmpDir = FileManager.default.temporaryDirectory.appendingPathComponent("speech_loso_aug_\(UUID().uuidString)")

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
            // Held-out side: original recordings only, never augmented.
            for wav in wavFiles(in: speaker.dir) {
                let dest = heldOutDir.appendingPathComponent("\(speaker.name)_\(wav.lastPathComponent)")
                try? FileManager.default.createSymbolicLink(at: dest, withDestinationURL: wav)
            }
        } else {
            let destRoot = trainDir.appendingPathComponent(speaker.label)
            for wav in wavFiles(in: speaker.dir) {
                let dest = destRoot.appendingPathComponent("orig_\(speaker.name)_\(wav.lastPathComponent)")
                try? FileManager.default.createSymbolicLink(at: dest, withDestinationURL: wav)
            }
            let speakerAugDir = augDir.appendingPathComponent(speaker.name)
            for wav in wavFiles(in: speakerAugDir) {
                let dest = destRoot.appendingPathComponent("aug_\(speaker.name)_\(wav.lastPathComponent)")
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

print("\n=== Summary (leave-one-speaker-out, with augmentation) ===")
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
