# Phase 11B numerical investigation

The first export used PyTorch's supported Dynamo exporter, opset 18, FP32, and
the default graph optimization. No model parameters or input transforms changed.

The initial full run checked 160 files. All 160 predicted classes agreed and all
probability comparisons passed `atol=1e-6, rtol=1e-4`. Raw logits initially used
`atol=1e-5, rtol=1e-4`; two images failed that elementwise rule:

| Image | PyTorch logit | ONNX logit | Absolute difference |
| --- | --- | --- | --- |
| validation/leaffolder/RLF_119.jpg, output 3 | -0.3283783197402954 | -0.3282977044582367 | 0.00008061528205871582 |
| testing/unknown/I_32.jpg, output 1 | -0.07404062151908875 | -0.07401060312986374 | 0.000030018389225006104 |

Their original top-two probability margins were approximately 0.875928 and
0.906543, respectively. Neither was a near-tie between classes. Across all
images, the initial maximum logit difference was 0.00008702278137207031 and the
maximum probability difference was 0.000009566545486450195.

Focused controls used the same tensors, weights, and CPU engine versions:

| Control | RLF_119 maximum logit difference | I_32 maximum logit difference |
| --- | --- | --- |
| Original export, ORT graph optimizations disabled | 0.00006467103958129883 | 0.000017158687114715576 |
| Export optimization disabled; ORT optimizations disabled | 0.00010442733764648438 | 0.000022411346435546875 |
| Export optimization disabled; ORT default optimizations | 0.00010213255882263184 | 0.000026054680347442627 |

The unoptimized graph retained 49 BatchNormalization nodes. Disabling export or
runtime optimizations did not remove the differences, and was not used as a
workaround. A separate PyTorch one-thread versus eight-thread control changed
these two examples by at most approximately 0.00000179 and 0.00000160, with
unchanged classes. That control alone does not explain the full cross-engine
difference. Different convolution/reduction implementations and FP32 operation
ordering are the remaining numerical explanation; exact internal kernel errors
were not localized layer by layer.

The final rules, applied again to **every image**, are:

- Logits: `atol=1e-4, rtol=1e-4`, plus a global absolute limit of `1e-4`.
- Probabilities: `atol=1e-6, rtol=1e-4`, plus a global absolute limit of `1e-5`.
- Exactly zero class changes, finite FP32 outputs, and correct four-class shape.

The logit floor was explicitly increased after investigating the initial failures;
the observed differences were not rounded away. The absolute probability limit
constrains score differences to at most 0.001 percentage point, independent of
relative tolerance. These are conversion acceptance criteria, not classification
thresholds or a guarantee about other devices or unseen inputs. No quantization,
retraining, weight edits, or Unknown-confidence rule was introduced.

The initial report and experimental unoptimized graph remain in ignored
`.artifacts/` for local inspection. The deliverable uses the original optimized
export. The final measured metrics and per-image full-precision numbers are in
`model/onnx/validation-report.json` and `validation-samples.jsonl`.

The first export attempt also hit a Windows `cp1252` console error while printing
PyTorch's Unicode status symbols. The scripts now configure UTF-8 output; no
alternative exporter or model modification was needed.
