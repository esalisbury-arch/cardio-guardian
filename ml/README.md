# Verita Health — model training pipeline

Python training scripts that produce the Core ML models used by Face Check,
Pallor Check, and Speech Check. This directory is **not** shipped in the app
— it only produces `.mlpackage`/`.mlmodel` files that get copied into
`ios/VeritaHealth/Models/` and compiled into the app by Xcode.

Datasets are not committed to this repo (see `ml/.gitignore`) — Kaggle's
terms don't allow redistributing their datasets, so raw data always lives
only in your local `ml/*/data/raw/` folders.

## Setup

```bash
cd ml
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

If you hit `SSL: CERTIFICATE_VERIFY_FAILED` downloading ImageNet weights on
macOS, run `/Applications/Python 3.13/Install Certificates.command` once
(python.org installer doesn't wire up root certs automatically).

## Datasets — manual download required for Kaggle sets

Kaggle requires a free account to download, even for openly-licensed
datasets, so these two need to be downloaded by hand via your browser and
unzipped into the folders below. Nothing else in this pipeline needs a
Kaggle account or API token.

**Pallor Check** — download both, unzip into:
- [Eyes-defy-anemia](https://www.kaggle.com/datasets/harshwardhanfartale/eyes-defy-anemia) → `ml/pallor/data/raw/eyes_defy_anemia/`
- [Palpebral Conjunctiva](https://www.kaggle.com/datasets/guptajanavi/palpebral-conjunctiva-to-detect-anaemia) → `ml/pallor/data/raw/palpebral_conjunctiva/`

**Speech Check** — download and unzip into:
- [Dysarthria and Non-Dysarthria Speech Dataset](https://www.kaggle.com/datasets/poojag718/dysarthria-and-nondysarthria-speech-dataset) → `ml/speech/data/raw/dysarthria/`

**Face Check** — no manual step. `ml/face/download_data.py` fetches
[PalsyNet](https://huggingface.co/datasets/jasir/palsynet-data) (CC-BY-4.0,
public) automatically via `huggingface_hub`.

## Data provenance caveats (read before trusting model output)

- **Face Check model** is trained on PalsyNet, whose own documentation
  states its source is curated YouTube videos with no disclosed clinical
  verification of diagnosis. It is shipped as a **facial-asymmetry /
  Bell's-palsy-trained classifier**, never described in-app as stroke
  detection. See the root `README.md` disclaimer section.
- **Pallor Check model** is trained on ~200-700 images across two small
  Kaggle sets — enough to prototype, not enough to be a clinical-grade
  anemia detector.
- Both image models are shipped as an **additional signal alongside** the
  existing landmark/color heuristics, not a replacement — see
  `src/signal/faceSymmetryAnalysis.ts` / `facialPallorAnalysis.ts`.

## Pipeline

Each subfolder is independent: `pallor/`, `face/`, `speech/`. Each has a
`train.py` that trains, evaluates, and converts to Core ML in one run,
writing the result to `ml/<name>/output/<name>.mlpackage` (or `.mlmodel`
for speech). Copy the output into `ios/VeritaHealth/Models/` and add it to
the Xcode project to ship it.

`ml/shared/coreml_convert.py` holds the MobileNetV2 build/convert helpers
shared by the two image models (pallor, face).
