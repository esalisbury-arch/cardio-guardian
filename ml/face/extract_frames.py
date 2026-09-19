"""Extracts frames from PalsyNet videos, crops to the detected face, and
saves flat per-frame JPEGs named <label>__<video_stem>__<frame_idx>.jpg so
train.py can do a video-level train/val split (frames from the same person
must never end up split across train and val — they're near-duplicates and
would silently inflate validation accuracy).

PalsyNet's own extract_frames.py just dumps raw uncropped frames; this adds
face detection (OpenCV's YuNet, since Apple's Vision framework isn't
available in Python) so the model trains on the face itself rather than
background/lighting.
"""
from pathlib import Path

import cv2

RAW_DIR = Path(__file__).parent / "data" / "raw" / "palsynet" / "data"
OUT_DIR = Path(__file__).parent / "data" / "frames"
# OpenCV 5.x dropped CascadeClassifier's Haar detector from the Python build;
# YuNet (ONNX, bundled by OpenCV itself via opencv_zoo) is the replacement.
YUNET_PATH = Path(__file__).parent / "assets" / "face_detection_yunet.onnx"

FRAME_SKIP = 10  # matches PalsyNet's own default
MARGIN = 0.35  # extra crop margin around the detected face box, as a fraction of its size

LABELS = ["affected", "unaffected"]


def crop_face(frame, detector):
    h, w = frame.shape[:2]
    detector.setInputSize((w, h))
    _, faces = detector.detect(frame)
    if faces is None or len(faces) == 0:
        return None
    # Largest detected face (closest to camera) in case of false positives in the background.
    fx, fy, fw, fh = max(faces, key=lambda f: f[2] * f[3])[:4]
    mx, my = int(fw * MARGIN), int(fh * MARGIN)
    x0, y0 = max(0, int(fx - mx)), max(0, int(fy - my))
    x1, y1 = min(w, int(fx + fw + mx)), min(h, int(fy + fh + my))
    return frame[y0:y1, x0:x1]


def main() -> None:
    detector = cv2.FaceDetectorYN_create(str(YUNET_PATH), "", (320, 320))

    for label in LABELS:
        video_dir = RAW_DIR / label
        out_label_dir = OUT_DIR / label
        out_label_dir.mkdir(parents=True, exist_ok=True)

        videos = sorted(video_dir.glob("*.mp4"))
        for video in videos:
            cap = cv2.VideoCapture(str(video))
            frame_idx = 0
            saved = 0
            detected = 0
            while True:
                ok, frame = cap.read()
                if not ok:
                    break
                if frame_idx % FRAME_SKIP == 0:
                    face = crop_face(frame, detector)
                    if face is not None and face.size > 0:
                        out_path = out_label_dir / f"{label}__{video.stem}__{frame_idx:06d}.jpg"
                        cv2.imwrite(str(out_path), face)
                        detected += 1
                    saved += 1
                frame_idx += 1
            cap.release()
            print(f"{video}: sampled {saved} frames, face detected in {detected}")


if __name__ == "__main__":
    main()
