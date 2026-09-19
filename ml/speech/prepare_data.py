"""Builds ml/speech/data/prepared/{train,val}/{dysarthria,non_dysarthria}/
from the Kaggle "Dysarthria and Non-Dysarthria Speech Dataset" (a TORGO
repackaging: speaker folders named F01/M01/... are dysarthric, FC01/MC01/...
are healthy controls).

Split is done at the SPEAKER level, same reasoning as ml/face/train.py's
video-level split: clips from one speaker share a voice/recording session,
so a random per-clip split would leak a speaker into both train and val and
overstate validation accuracy. Each class here only has 2-4 speakers total,
so one speaker per class is held out for validation — small and noisy, but
still the honest measurement.
"""
import shutil
from pathlib import Path

RAW_DIR = Path(__file__).parent / "data" / "raw" / "dysarthria" / "Dysarthria and Non Dysarthria" / "Dataset"
OUT_DIR = Path(__file__).parent / "data" / "prepared"

CLASS_DIRS = {
    "dysarthria": ["Female_dysarthria", "Male_Dysarthria"],
    "non_dysarthria": ["Female_Non_Dysarthria", "Male_Non_Dysarthria"],
}


def main() -> None:
    for split in ["train", "val"]:
        for label in CLASS_DIRS:
            (OUT_DIR / split / label).mkdir(parents=True, exist_ok=True)

    counts = {"train": {"dysarthria": 0, "non_dysarthria": 0}, "val": {"dysarthria": 0, "non_dysarthria": 0}}

    for label, class_dirs in CLASS_DIRS.items():
        for class_dir in class_dirs:
            speaker_dirs = sorted(p for p in (RAW_DIR / class_dir).iterdir() if p.is_dir())
            if not speaker_dirs:
                continue
            val_speakers = {speaker_dirs[-1].name}  # last speaker (alphabetical) held out per class-subfolder

            for speaker_dir in speaker_dirs:
                split = "val" if speaker_dir.name in val_speakers else "train"
                for wav in speaker_dir.rglob("*.wav"):
                    dest = OUT_DIR / split / label / f"{speaker_dir.name}_{wav.stem}.wav"
                    shutil.copy2(wav, dest)
                    counts[split][label] += 1

    print(counts)


if __name__ == "__main__":
    main()
