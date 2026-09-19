"""Fetches PalsyNet (CC-BY-4.0, public, no auth needed) from Hugging Face.

https://huggingface.co/datasets/jasir/palsynet-data
"""
from pathlib import Path

from huggingface_hub import snapshot_download

DATA_DIR = Path(__file__).parent / "data" / "raw" / "palsynet"


def main() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    path = snapshot_download(
        repo_id="jasir/palsynet-data",
        repo_type="dataset",
        local_dir=str(DATA_DIR),
    )
    print(f"Downloaded to {path}")
    for p in sorted(Path(path).rglob("*")):
        if p.is_file():
            print(" ", p.relative_to(path), f"({p.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
