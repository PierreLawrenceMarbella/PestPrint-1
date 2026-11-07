# PESTPRINT online backend — Phase 11A preparation

Status: inspected and prepared locally on 7 November 2026. No cloud service was
created, no deployment was started, and no APK was built in this phase.
The website, mobile UI, trained weights, and classification logic are unchanged.

## 1. Existing architecture

The website and Android app can share this flow:

```text
Website / standalone Android APK
          │ HTTPS multipart image upload
          ▼
Hosting provider TLS proxy → Gunicorn → existing Flask app → EfficientNet-B0
          ▲                                  │
          └────────── real prediction JSON ───┘
```

- `app.py`: Flask HTTP API, image validation, and optional built website hosting.
- `inference.py`: PyTorch/Torchvision model adapter. No inference changes needed.
- `GET /api/health`: `{available, classes, message}`. Existing endpoint returns
  HTTP 200 even when `available` is false; clients must inspect the body.
- `POST /api/analyze`: multipart field **`image`**, genuine JPEG/PNG, at most
  10 MiB and 25 million pixels. It returns genuine model values.
- `deploy.backend.wsgi:app`: deployment entry point adds `/api/ready`, which
  returns 200 when the model is loaded and 503 otherwise. The original API stays intact.
- Existing API errors: 400 invalid image, 413 oversized upload, 503 missing model,
  500 inference failure with a generic client message and server-side logging.

Successful response fields:

```text
prediction: healthy_rice | rice_leaffolder | rice_stem_borer | unknown
confidence: model probability between 0 and 1
probabilities: actual probabilities for those four IDs
model: EfficientNet-B0
unknown_method: trained_class
```

The classification head has shape `[4, 1280]`. Current training directories sort
as `healthy`, `leaffolder`, `stemborer`, `unknown`; the adapter preserves that order.
Unknown is an actual trained softmax class. No threshold or extra probability is
needed. Display names remain Healthy Rice, Rice Leaffolder, Stem Borer, and
Unknown (Other Damage).

Preprocessing remains EXIF correction, RGB conversion, resize to 224×224, and
`ToTensor()`. Do not add normalization or change output order during deployment.

## 2. Model and resources

| Item | Inspected value |
| --- | --- |
| Checkpoint | `model/efficientnet_b0_rice_pest.pth`, PyTorch state dictionary |
| Size | 16,350,891 bytes, approximately 15.59 MiB |
| Parameters | 4,012,672 |
| Local Python | 3.11.9 |
| Local dependencies | torch 2.14.1, torchvision 0.29.1, Flask 3.1.3, Pillow 13.0.0 |
| GPU requirement | None; all Phase 11A inference checks used CPU |
| Local load time | 2.65 seconds |
| Local four-sample requests | Approximately 0.04–0.20 seconds each, excluding internet transport |
| Peak resident memory, sample requests | 416.2 MiB |
| Peak resident memory, 25 MP synthetic memory probe | 717.0 MiB |
| Initial hosting target | 1 CPU, 2 GB RAM, one model worker |

These are Windows measurements from separate Python processes, not a Linux cloud
capacity guarantee. The synthetic image tested memory only, not crop recognition.
Linux, concurrent traffic, multipart buffers, and server overhead require a new
measurement after deployment. A 512 MB instance has inadequate headroom for the
current upload limits. Start at 2 GB; lower only after measuring real peak use.
The 2 GB limit is not an estimate that every request consumes 2 GB.

Four real sample uploads returned HTTP 200 with the intended class for each
sample and `unknown_method=trained_class`. This is an integration smoke test,
not an accuracy or confidence-calibration study.

The checkpoint identity is recorded in `model-manifest.json`. SHA-256:

```text
41c048b34844319902c5a3c36fce86254a7eccb1cf463eec7662a331c511734f
```

## 3. Hosting recommendation and budget

Recommend **Railway Hobby**, initially with one replica, approximately 1 CPU and
a 2 GB memory limit. It supports GitHub-based deployment and public HTTPS.
Use always-on operation for demonstrations; consider Serverless only after
testing mobile cold-start handling.

| Option | Current published limits/costs | Suitability |
| --- | --- | --- |
| Railway Free | $1 monthly resource credit; 0.5 GB RAM limit | Insufficient memory headroom and ongoing budget for this API |
| Railway Hobby | $5/month minimum including $5 usage; RAM $10/GB-month, CPU $20/vCPU-month, egress $0.05/GB | Recommended low-cost starting point; billed for actual use, not merely the configured RAM ceiling |
| Render Free | 512 MB, 0.1 CPU; sleeps after 15 idle minutes, roughly one-minute wake-up | Not recommended for this model and upload limits |
| Render paid 2 GB | `1c-2g` (formerly Standard), 1 CPU, $25/month compute | Simpler fixed compute budget, higher starting cost |
| Hugging Face Docker Space | CPU Basic has 16 GB RAM and no hourly hardware charge, but current creation rules require a paid plan for Docker compute Spaces | Not an unconditional free Docker API option; would also need Space-specific deployment setup |

For Railway, reserve an initial **$5–12/month budget estimate** for light school
use. It is not a quote or cap: at an average 0.5 GB resident memory, RAM alone
is approximately $5/month; CPU, network, artifact storage, and taxes can add cost.
At a constant 1 GB average, RAM alone would be approximately $10/month. Configure
spending alerts and an appropriate hard usage limit before deployment; hitting
a hard limit can interrupt availability. Set service resource limits separately.

Railway Serverless can sleep after roughly 5–10 minutes of inactivity and wake
on traffic; latency depends on container startup and model provisioning. Do not
promise a fixed wake time. Neither free credits nor sleeping services guarantee
continuous availability. Current host account limits must be checked at signup.

Sources checked for this preparation:

- [Railway pricing](https://docs.railway.com/pricing),
  [plan limits](https://docs.railway.com/pricing/plans),
  [Serverless behavior](https://docs.railway.com/deployments/serverless),
  [public networking](https://docs.railway.com/networking/public-networking),
  [GitHub autodeploys](https://github.com/railwayapp/docs/blob/main/content/docs/deployments/github-autodeploys.md).
- [Render compute plans](https://render.com/docs/compute-plans),
  [free limits](https://render.com/docs/free),
  [published 2 GB price](https://render.com/articles/production-rails-hosting-guide).
- [Hugging Face Space creation and resources](https://huggingface.co/docs/hub/spaces-overview).

## 4. Deployment files prepared

The files in this directory are preparation artifacts. They have not been
validated by a Linux container build or a cloud deployment.

- `Dockerfile`: Python 3.11, CPU-only torch/torchvision matching the inspected
  versions, minimal runtime dependencies, unprivileged user. No dataset, mobile
  code, website build, or weights are bundled. CPU wheel availability for Linux
  x86_64/Python 3.11 was checked against the official PyTorch index.
- `Dockerfile.dockerignore`: allowlists only required backend build inputs;
  excludes local environments, credentials, datasets, and trained weights.
- `requirements.txt`: inference web runtime only; training requirements remain
  separate. [Official matching CPU installation](https://pytorch.org/get-started/previous-versions/).
- `gunicorn.conf.py`: one synchronous worker to avoid loading multiple models
  or decoding multiple full-size images simultaneously, `0.0.0.0:$PORT`, 120-second
  worker timeout, generic server logs. Startup refuses an unavailable model.
  The worker timeout is not an end-to-end queue or platform request deadline.
- `prepare_model.py`: checks the existing checkpoint or downloads a missing one
  from a server-configured HTTPS URL. Enforces byte size and SHA-256 before model
  loading, rejects HTTP redirects, installs atomically, and removes failed
  download files. Existing files are verified and never overwritten. Read
  timeout is 30 seconds; the download loop has a roughly 120-second budget.
- `wsgi.py`: model-aware readiness endpoint, separate from client health checks.

Future production start command from the repository root, inside Linux:

```text
gunicorn --config deploy/backend/gunicorn.conf.py deploy.backend.wsgi:app
```

Do not use Flask's development server in the hosted service. The container
honors the hosting provider's `PORT`; HTTPS terminates at the provider proxy.
The internal HTTP port is not the URL used by Android.

Future Railway settings (do not deploy as part of Phase 11A):

| Setting | Value |
| --- | --- |
| Source/build context | Repository root, explicitly selected Git branch |
| `RAILWAY_DOCKERFILE_PATH` | `deploy/backend/Dockerfile` |
| Readiness path | `/api/ready` |
| Startup health deadline | Initially 300 seconds; measure download + load |
| Replica count | 1 |
| Initial RAM limit | 2 GB |
| Public access | Generated HTTPS domain |
| `MODEL_DOWNLOAD_URL` | Server secret: direct HTTPS object download URL for the exact checkpoint |

See [Railway Dockerfile settings](https://docs.railway.com/builds/dockerfiles) and
[deployment health checks](https://docs.railway.com/deployments/healthchecks).
Railway's deployment health check is not continuous uptime monitoring.

**Model provisioning remains a blocker.** The weights and dataset are ignored
by Git. Choose team-controlled artifact storage and supply a working direct URL
or mount the checkpoint at `/app/model/efficientnet_b0_rice_pest.pth`. The dataset
is not required for inference. A shared-drive preview page is not a direct model
download. Keep any signed URL in hosting secrets; its expiry must allow restarts
and future redeploys, or be refreshed beforehand. No storage URL was supplied or
uploaded in this phase. Mounted files must be readable by container UID 1000.

The app does not intentionally persist uploaded images. Werkzeug may spool
multipart files over roughly 500 KiB to OS temporary storage, which request
cleanup closes; decoded images and tensors occupy memory. Provisioning failures
remove `.download` files. Use ephemeral container storage and do not log image
contents. No upload archive or persistent database is needed.

### Before allowing public traffic

The existing API has no authentication or rate limiter. Prepared Gunicorn worker
limits help memory use but do not prevent abuse. These are launch prerequisites:

1. Add and test per-client rate limiting (initial policy: 10 analyses/minute)
   and a small bounded admission queue with clear 429/503 + `Retry-After` errors.
   Apply limits before multipart decoding. Exempt readiness from analysis limits.
2. Verify Railway's actual proxy headers before trusting a client IP or enabling
   forwarded headers. Never trust arbitrary `X-Forwarded-For` from the internet.
   Use a shared limiter store if scaling beyond one process/replica.
3. Verify proxy body limits, upload/read timeouts, HTTPS, and generic error
   responses, including overload. Retain the 10 MiB and 25 MP server-side limits.
4. If using a public anonymous API, protect it with those limits and spending
   controls. If private access is required, implement user authentication with
   short-lived tokens. A static secret inside an APK is extractable and is not
   a security boundary. No server secrets belong in `EXPO_PUBLIC_*`.
5. Recheck Python runtime dependencies/security and run a Linux image smoke test
   with the provisioned model. Direct dependencies are pinned; this is not yet
   a full transitive lock or a completed vulnerability audit.

## 5. Mobile integration changes still required

Existing `mobile/src/services/apiClient.ts` already uses real multipart uploads,
validates the actual four-output schema, checks model availability, handles
cancellation/errors/timeouts, and preserves genuine confidence values.
Keep `expo-file-system` File multipart support and automatic boundary headers.

Before building the online APK:

1. Set `EXPO_PUBLIC_API_BASE_URL` to the verified **public HTTPS origin**, without
   `/api/analyze`. The value is compiled into the app; changing a local `.env`
   afterward does not change an installed APK. Remove the development LAN URL
   from the build environment and check the resolved value before building.
2. Add a build-time public-HTTPS check for the online profile. Current runtime
   validation allows LAN HTTP for development and does not enforce a public
   production address. Keep development support separate.
3. Replace the current 10-second health deadline with a bounded cold-start
   strategy, for example up to 90 seconds with cancellable GET retries/backoff.
   Retry only transient health/network failures; validate readiness JSON before
   uploading. Keep an indeterminate indicator and a useful server-starting message.
4. Review the current 60-second prediction budget after live mobile tests; allow
   up to 120 seconds if slow uploads require it. Do not retry prediction POSTs
   automatically, since a timed-out request may still be computing on the server.
5. Replace same-Wi-Fi-only connection wording with internet/server guidance;
   handle 429 and `Retry-After` explicitly. Preserve selected images on retry.
6. Test actual mobile-data uploads, slow cold starts, server failure, offline
   mode, cancel/retry, and all four real response mappings on the hosted endpoint.

Mobile UI and API behavior were not changed in this preparation phase.

## 6. Website reuse and standalone APK

The website already uses relative `/api/*` paths. Two compatible options:

- Serve its existing build on the same origin as Flask: no API client URL
  changes needed. A later deployment build must generate/include `static/app`;
  this backend-only container intentionally omits it and `/` returns 503.
- Keep the website separately hosted and proxy `/api/*` to this backend, or add
  a configurable web API base URL and an explicit website-origin CORS allowlist.
  Native Android does not need browser CORS. CORS is not authentication.

Use existing EAS configuration later. `preview` produces APKs but permits LAN
cleartext HTTP; `production` disallows cleartext but produces an AAB. Add a
dedicated online APK profile after the hosted URL is verified, for example:

```json
"online-preview": {
  "extends": "production",
  "distribution": "internal",
  "environment": "preview",
  "env": { "PESTPRINT_ALLOW_HTTP_API": "0" },
  "android": { "buildType": "apk" }
}
```

Configure that EAS environment with the public HTTPS URL, then verify the
resolved configuration and build. An installable EAS preview APK bundles the
native app and JavaScript; it needs neither Expo Go nor a running Metro server.
Classification still requires internet and the cloud backend. An Expo account
and linked EAS project are needed for the later cloud build. Existing local
Android build/network limitations are documented in `mobile/BUILD_ANDROID.md`.

## 7. Next implementation steps

1. Confirm hosting budget and choose the exact checkpoint storage URL.
2. Implement and test the launch protections and mobile cold-start/configuration
   changes above. Build and smoke-test the Linux container locally or in CI.
3. In the deployment phase, connect the chosen Git branch to Railway, configure
   secrets/resources/readiness/spending limits, then deploy and verify HTTPS.
4. Verify genuine API responses with real crop samples and repeat memory/load
   measurements on the host; do not treat this as a model accuracy evaluation.
5. Configure and build the online APK only after the public backend passes those
   checks. Install on a physical Android phone and test with the laptop off.

Phase 11A ends here. Public inference, Linux container execution, cloud cold
starts, and a laptop-independent APK have not been verified yet.

### Verification performed in Phase 11A

| Check | Result |
| --- | --- |
| `python -m unittest deploy.backend.test_preparation -v` | 8 passed: checksum, provisioning, rejected downloads/redirects, cleanup, readiness |
| `python -m unittest discover -s tests -v` | 6 passed, including real inference and safe error responses |
| `python -m deploy.backend.prepare_model` | Existing checkpoint verified without download or modification |
| `python -m compileall -q deploy/backend` | Passed |
| `npm.cmd run typecheck` in `mobile/` | Passed |
| `npm.cmd run test:api` in `mobile/` | 9 passed; transport/mapping tests use explicitly labeled fixtures |
| Four local real-model sample uploads | All HTTP 200; intended four output mappings confirmed |
| Model SHA-256 after checks | Unchanged |
| Linux container, hosted model download, HTTPS, cold start, physical-phone online APK | Not executed; Docker is unavailable locally and cloud/APK work is outside this phase |

The backend failure-state test deliberately logs a server exception and verifies
that its private details do not reach the client. PowerShell blocked `npm.ps1`;
the checks above used `npm.cmd` successfully without changing execution policy.
