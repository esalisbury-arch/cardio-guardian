"""Shared helpers for building and converting small MobileNetV2 binary
classifiers to Core ML. Used by ml/pallor/train.py and ml/face/train.py —
both problems are "binary-classify a face/eye crop", so they share the same
architecture and conversion path; only the data-loading differs per model.
"""
import tensorflow as tf
import coremltools as ct

IMG_SIZE = 96


def build_classifier(alpha: float = 0.35) -> tf.keras.Model:
    base = tf.keras.applications.MobileNetV2(
        input_shape=(IMG_SIZE, IMG_SIZE, 3),
        include_top=False,
        weights="imagenet",
        alpha=alpha,
    )
    base.trainable = False
    inputs = tf.keras.Input(shape=(IMG_SIZE, IMG_SIZE, 3), name="image")
    x = tf.keras.applications.mobilenet_v2.preprocess_input(inputs)
    x = base(x, training=False)
    x = tf.keras.layers.GlobalAveragePooling2D()(x)
    x = tf.keras.layers.Dropout(0.2)(x)
    outputs = tf.keras.layers.Dense(1, activation="sigmoid", name="score")(x)
    return tf.keras.Model(inputs, outputs, name="binary_classifier")


def unfreeze_top_layers(model: tf.keras.Model, n: int = 20) -> None:
    base = next(layer for layer in model.layers if isinstance(layer, tf.keras.Model))
    base.trainable = True
    for layer in base.layers[:-n]:
        layer.trainable = False


def load_image_dataset(
    data_dir: str,
    batch_size: int = 16,
    val_split: float = 0.2,
    seed: int = 42,
    class_names: list[str] | None = None,
):
    """`class_names`, when given, fixes label index order (index = position in
    the list) instead of Keras's default alphabetical-by-folder-name order —
    use it so index 1 (the "high score") is always the flagged/concerning
    class, matching the convention the rest of the app uses.
    """
    train_ds = tf.keras.utils.image_dataset_from_directory(
        data_dir,
        validation_split=val_split,
        subset="training",
        seed=seed,
        image_size=(IMG_SIZE, IMG_SIZE),
        batch_size=batch_size,
        label_mode="binary",
        class_names=class_names,
    )
    val_ds = tf.keras.utils.image_dataset_from_directory(
        data_dir,
        validation_split=val_split,
        subset="validation",
        seed=seed,
        image_size=(IMG_SIZE, IMG_SIZE),
        batch_size=batch_size,
        label_mode="binary",
        class_names=class_names,
    )
    class_names = train_ds.class_names
    train_ds = train_ds.prefetch(tf.data.AUTOTUNE)
    val_ds = val_ds.prefetch(tf.data.AUTOTUNE)
    return train_ds, val_ds, class_names


def convert_to_coreml(
    model: tf.keras.Model,
    output_path: str,
    short_description: str,
    author: str = "Verita Health",
) -> ct.models.MLModel:
    mlmodel = ct.convert(
        model,
        inputs=[ct.ImageType(name="image", shape=(1, IMG_SIZE, IMG_SIZE, 3))],
        convert_to="mlprogram",
        minimum_deployment_target=ct.target.iOS15,
    )
    mlmodel.author = author
    mlmodel.short_description = short_description
    mlmodel.save(output_path)
    return mlmodel
