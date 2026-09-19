"""Trains the Face Check asymmetry classifier on PalsyNet face crops and
converts it to Core ML.

Frames are grouped by source video and split at the VIDEO level (not the
frame level) into train/val — frames from the same person are near-
duplicates, so a random per-frame split would leak a person's face into
both sets and produce a misleadingly high validation accuracy. Each video
is also capped to a max number of sampled frames so the handful of very
long clips don't dominate training.

Run: ml/extract_frames.py must be run first.
"""
import random
import sys
from collections import defaultdict
from pathlib import Path

import tensorflow as tf

sys.path.insert(0, str(Path(__file__).parent.parent))
from shared.coreml_convert import (  # noqa: E402
    IMG_SIZE,
    build_classifier,
    convert_to_coreml,
    unfreeze_top_layers,
)

FRAMES_DIR = Path(__file__).parent / "data" / "frames"
OUTPUT_DIR = Path(__file__).parent / "output"
LABELS = {"unaffected": 0, "affected": 1}
MAX_FRAMES_PER_VIDEO = 150
VAL_FRACTION = 0.2
SEED = 42
BATCH_SIZE = 32
HEAD_EPOCHS = 6
FINE_TUNE_EPOCHS = 8


def collect_videos():
    """Returns {(label, video_stem): [file paths]}."""
    videos = defaultdict(list)
    for label_name in LABELS:
        for path in (FRAMES_DIR / label_name).glob("*.jpg"):
            _, video_stem, _ = path.stem.split("__")
            videos[(label_name, video_stem)].append(path)
    return videos


def split_files(videos):
    rng = random.Random(SEED)
    train_files, train_labels, val_files, val_labels = [], [], [], []

    by_label = defaultdict(list)
    for (label_name, video_stem), paths in videos.items():
        by_label[label_name].append((video_stem, paths))

    for label_name, video_list in by_label.items():
        rng.shuffle(video_list)
        n_val_videos = max(1, int(len(video_list) * VAL_FRACTION))
        val_videos = video_list[:n_val_videos]
        train_videos = video_list[n_val_videos:]

        for _, paths in train_videos:
            sample = paths if len(paths) <= MAX_FRAMES_PER_VIDEO else rng.sample(paths, MAX_FRAMES_PER_VIDEO)
            train_files += [str(p) for p in sample]
            train_labels += [LABELS[label_name]] * len(sample)
        for _, paths in val_videos:
            sample = paths if len(paths) <= MAX_FRAMES_PER_VIDEO else rng.sample(paths, MAX_FRAMES_PER_VIDEO)
            val_files += [str(p) for p in sample]
            val_labels += [LABELS[label_name]] * len(sample)

    print(f"train: {len(train_files)} frames, val: {len(val_files)} frames")
    return train_files, train_labels, val_files, val_labels


def make_dataset(files, labels, training: bool):
    def load(path, label):
        img = tf.io.read_file(path)
        img = tf.io.decode_jpeg(img, channels=3)
        img = tf.image.resize(img, (IMG_SIZE, IMG_SIZE))
        return img, label

    ds = tf.data.Dataset.from_tensor_slices((files, labels))
    ds = ds.shuffle(len(files), seed=SEED) if training else ds
    ds = ds.map(load, num_parallel_calls=tf.data.AUTOTUNE)
    if training:
        ds = ds.map(
            lambda img, label: (tf.image.random_flip_left_right(img), label),
            num_parallel_calls=tf.data.AUTOTUNE,
        )
    ds = ds.batch(BATCH_SIZE).prefetch(tf.data.AUTOTUNE)
    return ds


def main() -> None:
    videos = collect_videos()
    train_files, train_labels, val_files, val_labels = split_files(videos)
    train_ds = make_dataset(train_files, train_labels, training=True)
    val_ds = make_dataset(val_files, val_labels, training=False)

    model = build_classifier(alpha=0.35)
    model.compile(
        optimizer=tf.keras.optimizers.Adam(1e-3),
        loss="binary_crossentropy",
        metrics=["accuracy", tf.keras.metrics.Precision(name="precision"), tf.keras.metrics.Recall(name="recall")],
    )
    print("--- training classification head ---")
    model.fit(train_ds, validation_data=val_ds, epochs=HEAD_EPOCHS)

    print("--- fine-tuning top MobileNetV2 layers ---")
    unfreeze_top_layers(model, n=20)
    model.compile(
        optimizer=tf.keras.optimizers.Adam(1e-5),
        loss="binary_crossentropy",
        metrics=["accuracy", tf.keras.metrics.Precision(name="precision"), tf.keras.metrics.Recall(name="recall")],
    )
    model.fit(train_ds, validation_data=val_ds, epochs=FINE_TUNE_EPOCHS)

    print("--- final validation ---")
    results = model.evaluate(val_ds, return_dict=True)
    print(results)

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    convert_to_coreml(
        model,
        str(OUTPUT_DIR / "FacialAsymmetryClassifier.mlpackage"),
        short_description=(
            "Facial-asymmetry classifier trained on PalsyNet (Bell's palsy vs. unaffected "
            "faces from curated YouTube videos, CC-BY-4.0). Not a stroke-specific classifier "
            "and not clinically validated."
        ),
    )
    print(f"Saved to {OUTPUT_DIR / 'FacialAsymmetryClassifier.mlpackage'}")


if __name__ == "__main__":
    main()
