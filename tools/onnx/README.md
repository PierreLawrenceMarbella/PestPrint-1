# PESTPRINT Phase 11B — ONNX conversion

Status: **SUCCESS**, converted and numerically validated on 7 November 2026.
This phase does not integrate mobile inference or build an APK.

## Deliverable

`model/onnx/efficientnet_b0_rice_pest.onnx`

| Property | Value |
| --- | --- |
| Architecture | Existing trained EfficientNet-B0, evaluation mode |
| Precision | FP32; no quantization or retraining |
| Size | 16,643,470 bytes, approximately 15.87 MiB |
| ONNX opset / IR | 18 / 10 |
| Input | `image`, float32 `[1, 3, 224, 224]`, NCHW RGB |
| Output | `logits`, float32 `[1, 4]` — one tensor containing four raw values |
| Model SHA-256 | `213a20863a6e2e1b91d33452a31a0d5764e0a2670b5703cc6a464090f15d9c61` |
| Original checkpoint SHA-256 | `41c048b34844319902c5a3c36fce86254a7eccb1cf463eec7662a331c511734f` |
| Validation runtime | ONNX Runtime CPU 1.24.3, matching the inspected React Native runtime version |

The model is self-contained: no external weight file and no custom ONNX operators.
Only Add, Conv, Gemm, Mul, ReduceMean, Reshape, and Sigmoid appear in the graph.
Version-matched desktop loading is verified; Android native compatibility is not.

The original `.pth`, Flask API, online deployment preparation, website, and mobile
files were not edited. Existing unrelated working-tree changes were preserved.

## Input and classification contract

Before inference, correct EXIF orientation, convert to RGB, resize by stretching
to 224×224 using Pillow-compatible bilinear/antialiased behavior, and scale bytes
to float32 `[0,1]` by dividing by 255. Arrange channels in NCHW order.
There is **no mean/std normalization, center crop, or channel reversal**.
Validation reuses the existing backend transform from `inference.py`.

| Index | API ID | Display name | Dataset directory |
| --- | --- | --- | --- |
| 0 | healthy_rice | Healthy Rice | healthy |
| 1 | rice_leaffolder | Rice Leaffolder | leaffolder |
| 2 | rice_stem_borer | Stem Borer | stemborer |
| 3 | unknown | Unknown (Other Damage) | unknown |

Preprocessing and softmax are **outside** the graph. Apply stable float32 softmax
once across the four logits, then argmax, exactly as the backend does. Unknown is
output index 3 of the trained classifier; never derive it from a confidence threshold.
The display percentage is the actual selected probability multiplied by 100.
Do not report individual educational symptoms as image-detected features.

## Validation results

All supported files in both available held-out directories were checked, using
the same tensor for each PyTorch/ONNX comparison, one image per inference.

| Label | Validation | Testing | Total | PyTorch/ONNX class agreement |
| --- | --- | --- | --- | --- |
| Healthy Rice | 20 | 20 | 40 | 40/40 |
| Rice Leaffolder | 20 | 20 | 40 | 40/40 |
| Stem Borer | 20 | 20 | 40 | 40/40 |
| Unknown (Other Damage) | 20 | 20 | 40 | 40/40 |
| **Total** | **80** | **80** | **160** | **160/160 (100%)** |

These 160 files contain **159 unique image contents**: `validation/unknown/I_6.jpg`
and `testing/unknown/I_6.jpg` have the same checksum. No images were silently
skipped or deduplicated. Dataset split provenance was not independently established.

| Comparison | Maximum absolute difference | Mean absolute difference |
| --- | --- | --- |
| Raw logits | 0.00008702278137207031 | 0.000010156165808439255 |
| Softmax probabilities | 0.000009566545486450195 | 0.0000005675405389649058 |

Means include all 640 compared values (160 images × four outputs), accumulated
in float64 from the actual FP32 outputs. Full-precision values are saved without
rounding or clamping. All outputs were finite; no class predictions changed.

Final logit criteria: `atol=1e-4, rtol=1e-4`, **and** absolute error ≤`1e-4`.
Probability criteria: `atol=1e-6, rtol=1e-4`, **and** absolute error ≤`1e-5`.
Argmax agreement is independently required for every image.

Two images failed the initial tighter logit floor. The investigation and explicit
tolerance adjustment are disclosed in [VALIDATION_NOTES.md](VALIDATION_NOTES.md).
The first export attempt also hit a Windows console encoding error, resolved by
UTF-8 output configuration. No fallback exporter or neural-network edits were used.

This is conversion parity, not 100% classification accuracy. Both engines made
the same predictions, including 39 Unknown predictions. Android preprocessing
parity, latency, memory use, and on-device results remain Phase 11C/11D work.

## Reproduce on Windows PowerShell

Run from the repository root. Activation is not required because each command
uses the isolated environment's Python executable. The website `.venv` and root
`requirements.txt` are not changed.

```powershell
python -m venv .artifacts/venv-onnx
.artifacts\venv-onnx\Scripts\python.exe -m pip install -r tools/onnx/requirements-torch-cpu.txt
.artifacts\venv-onnx\Scripts\python.exe -m pip install -r tools/onnx/requirements-lock.txt
.artifacts\venv-onnx\Scripts\python.exe tools/onnx/convert.py
.artifacts\venv-onnx\Scripts\python.exe tools/onnx/validate.py
```

Requirements: Python 3.11 (tested 3.11.9), the original checkpoint at
`model/efficientnet_b0_rice_pest.pth`, and the existing validation/testing dataset.
Install CPU PyTorch first; the full lock records the inspected Windows environment,
including its `+cpu` builds. `requirements.txt` also lists the direct conversion
dependencies for review. These dependencies belong only in the conversion environment.

Export refuses to overwrite a model unless `--overwrite` is explicitly supplied.
It also refuses a checkpoint with a different SHA-256 or a changed class mapping.
After deliberately regenerating the ONNX file, rerun validation and use its new
checksum/report; serialized file identity is not guaranteed across toolchain changes.

Default validation checks both splits. If only one split is available, select it
explicitly, e.g. `validate.py --splits testing`. It must still cover all four
categories. Missing data, unreadable images, contract violations, excessive
numerical error, or changed classes prevent success and return a nonzero exit code.
The validator does not use training data as a substitute for held-out images.

## Files and storage

- `tools/onnx/common.py`: checkpoint verification, shared contracts, environment metadata.
- `tools/onnx/convert.py`: supported Dynamo export, ONNX checker, CPU load/smoke test, metadata.
- `tools/onnx/validate.py`: complete numerical/class comparison, dataset fingerprint, detailed results.
- `tools/onnx/requirements*.txt`: direct, CPU PyTorch, and full environment pins.
- `tools/onnx/VALIDATION_NOTES.md`: initial failure and numerical investigation.
- `model/onnx/metadata.json`: input/output contract, class mapping, model hash, and tool versions.
- `model/onnx/validation-report.json`: final machine-readable summary, counts, error metrics, limits.
- `model/onnx/validation-samples.jsonl`: full per-image logits/probabilities and comparisons.
- `model/onnx/.gitignore`: excludes binary models, export diagnostics, and detailed local results.

The ONNX file, dataset, source weights, environment, and detailed image results
stay out of ordinary Git commits. Keep the small scripts, metadata, and summary
report in Git. Preserve the ONNX binary in team artifact storage with its checksum
before sharing or integrating it; no external upload was performed in this phase.

Executed checks: complete 160-image numerical validation, exporter verification,
ONNX checker, isolated-environment `pip check`, and all six existing Flask/backend
tests. Backend failure-state testing deliberately logs an exception while checking
that private details are hidden from clients.

Phase 11C can now use this **logits** contract and validated model as its starting
artifact. Do not assume matching ONNX Runtime version numbers prove the Android
binding builds or produces identical image tensors. No native AI library was
installed, no mobile inference client changed, and no APK/cloud deployment started.

References: [PyTorch's supported ONNX exporter](https://docs.pytorch.org/docs/2.14/onnx.html),
[ONNX Runtime compatibility](https://onnxruntime.ai/docs/reference/compatibility.html).
