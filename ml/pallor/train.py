"""Trains the Pallor Check anemia classifier on the Eyes-defy-anemia
palpebral-conjunctiva crops (WHO Hgb-threshold labels, see prepare_data.py)
and converts it to Core ML.

Unlike the face model, these are one photo per patient (not video frames),
so a standard per-file random split (via load_image_dataset) is fine —
there's no risk of the same patient's near-duplicate frames leaking across
train/val the way there was with PalsyNet's video clips.

Run: ml/pallor/prepare_data.py must be run first.
"""
import sys
from pathlib import Path

import tensorflow as tf

sys.path.insert(0, str(Path(__file__).parent.parent))
from shared.coreml_convert import (  # noqa: E402
    build_classifier,
    convert_to_coreml,
    load_image_dataset,
    unfreeze_top_layers,
)

DATA_DIR = Path(__file__).parent / "data" / "prepared"
OUTPUT_DIR = Path(__file__).parent / "output"
HEAD_EPOCHS = 12
FINE_TUNE_EPOCHS = 10


def main() -> None:
    # Fixed order (not alphabetical) so index 1 / "high score" = anemic (flagged), matching
    # the asymmetryModelScore convention in the face model and the app's existing heuristics.
    train_ds, val_ds, class_names = load_image_dataset(
        str(DATA_DIR), batch_size=16, val_split=0.2, class_names=["non_anemic", "anemic"]
    )
    print("class order (0/1):", class_names)
    train_ds = train_ds.map(lambda img, label: (tf.image.random_flip_left_right(img), label))

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
    print(model.evaluate(val_ds, return_dict=True))

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    convert_to_coreml(
        model,
        str(OUTPUT_DIR / "PallorClassifier.mlpackage"),
        short_description=(
            "Anemia-risk classifier trained on Eyes-defy-anemia palpebral conjunctiva photos "
            "(labels from real lab hemoglobin values vs. WHO thresholds, ~215 patients). "
            "Not clinically validated — a small research dataset, not a diagnostic device."
        ),
    )
    print(f"Saved to {OUTPUT_DIR / 'PallorClassifier.mlpackage'}")


if __name__ == "__main__":
    main()
