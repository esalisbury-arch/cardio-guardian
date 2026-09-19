"""Generates pitch- and tempo-perturbed copies of every training clip, so
the classifier sees the same linguistic content across varied pitch/tempo
instead of a fixed voice — the goal is to weaken the shortcut of "learn
this speaker's exact pitch/timbre" that the leave-one-speaker-out eval
showed the model was taking (52.3% held-out accuracy, near chance, with
0-94% swings per fold — the signature of speaker-identity memorization).

This does NOT add new speakers or new vocal tracts, so it cannot fully
solve the underlying too-few-speakers ceiling — only real speaker
diversity does that. It's a partial, honest mitigation: augmented copies
must only ever be used for TRAINING, never for the held-out
speaker being evaluated, or the eval becomes leaky/meaningless again.
"""
from pathlib import Path

import librosa
import soundfile as sf

RAW_DIR = Path(__file__).parent / "data" / "raw" / "dysarthria" / "Dysarthria and Non Dysarthria" / "Dataset"
AUG_DIR = Path(__file__).parent / "data" / "augmented"

CLASS_DIRS = {
    "Female_dysarthria": "dysarthria",
    "Male_Dysarthria": "dysarthria",
    "Female_Non_Dysarthria": "non_dysarthria",
    "Male_Non_Dysarthria": "non_dysarthria",
}

PITCH_SHIFTS_SEMITONES = [-2, 2]
TIME_STRETCH_RATES = [0.9, 1.1]
MIN_DURATION_S = 0.5  # matches CreateML's own floor — shorter clips are useless either way


def augment_file(path: Path, out_dir: Path, stem: str) -> int:
    y, sr = librosa.load(path, sr=None, mono=True)
    if len(y) / sr < MIN_DURATION_S:
        return 0
    written = 0
    for semitones in PITCH_SHIFTS_SEMITONES:
        y_aug = librosa.effects.pitch_shift(y, sr=sr, n_steps=semitones)
        sf.write(out_dir / f"{stem}_pitch{semitones:+d}.wav", y_aug, sr)
        written += 1
    for rate in TIME_STRETCH_RATES:
        y_aug = librosa.effects.time_stretch(y, rate=rate)
        sf.write(out_dir / f"{stem}_rate{rate}.wav", y_aug, sr)
        written += 1
    return written


def main() -> None:
    for class_dir, label in CLASS_DIRS.items():
        speaker_dirs = sorted(p for p in (RAW_DIR / class_dir).iterdir() if p.is_dir())
        for speaker_dir in speaker_dirs:
            speaker = speaker_dir.name
            out_dir = AUG_DIR / speaker
            out_dir.mkdir(parents=True, exist_ok=True)
            wavs = list(speaker_dir.rglob("*.wav"))
            total_written = 0
            for wav in wavs:
                try:
                    total_written += augment_file(wav, out_dir, wav.stem)
                except Exception as e:
                    print(f"  skip {wav.name}: {e}")
            print(f"{speaker} ({label}): {len(wavs)} source clips -> {total_written} augmented clips")


if __name__ == "__main__":
    main()
