import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  CloudUpload,
  Camera,
  Image as ImageIcon,
  Info,
  X,
  RefreshCw,
  LoaderCircle,
  Check,
  ScanLine,
  Leaf,
  Bug,
  AlertCircle,
} from "lucide-react";
import {
  analyzeImage,
  getModelStatus,
  type ModelStatus,
  type Prediction,
} from "./api";
import {
  classNames,
  guideForClass,
  guides,
  unknownGuidance,
  type ClassId,
} from "./data";
import { PageHeading } from "./components";
import { SupportedClasses, TipsForBetterResults } from "./classifications";

export function CameraCapture({
  onCapture,
  onClose,
}: {
  onCapture: (file: File) => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let stream: MediaStream | undefined;
    let closed = false;
    const element = dialog.current;
    element?.showModal();
    const start = async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia)
          throw new Error(
            "Camera access requires HTTPS or localhost. Use Choose Image to upload a photo instead.",
          );
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        if (closed) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        if (video.current) {
          video.current.srcObject = stream;
          await video.current.play();
        }
      } catch (e) {
        if (!closed)
          setError(
            e instanceof DOMException
              ? "Camera access is unavailable or permission was denied. Allow camera access in your browser, or upload a photo from your device."
              : (e as Error).message,
          );
      }
    };
    void start();
    return () => {
      closed = true;
      stream?.getTracks().forEach((t) => t.stop());
      element?.close();
    };
  }, []);
  function capture() {
    if (!video.current || !ready) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.current.videoWidth;
    canvas.height = video.current.videoHeight;
    canvas.getContext("2d")?.drawImage(video.current, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (blob) {
          onCapture(
            new File([blob], "rice-crop-photo.jpg", { type: "image/jpeg" }),
          );
          onClose();
        } else setError("The photo could not be captured. Please try again.");
      },
      "image/jpeg",
      0.92,
    );
  }
  return (
    <dialog
      ref={dialog}
      className="camera-dialog"
      aria-labelledby="camera-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <div className="camera-title">
        <h2 id="camera-title">Capture your rice crop</h2>
        <button
          className="icon-button"
          onClick={onClose}
          aria-label="Close camera"
          autoFocus
        >
          <X />
        </button>
      </div>
      <p>Keep the leaf or stem in focus and use natural light.</p>
      <video
        ref={video}
        playsInline
        muted
        onLoadedData={() => setReady(true)}
        aria-label="Live camera preview"
      />
      {error && (
        <div className="error-message" role="alert">
          <AlertCircle size={20} />
          {error}
        </div>
      )}
      <div className="camera-actions">
        <button className="button secondary" onClick={onClose}>
          Cancel
        </button>
        <button
          className="button"
          disabled={!ready || !!error}
          onClick={capture}
        >
          <Camera size={19} /> Capture Photo
        </button>
      </div>
    </dialog>
  );
}

export function PredictionBar({
  id,
  value,
  leading,
  tone,
}: {
  id: ClassId;
  value: number;
  leading: boolean;
  tone: string;
}) {
  const percentage = (value * 100).toFixed(1);
  return (
    <div className={`probability-row ${leading ? "leading" : ""}`}>
      <span>{classNames[id]}</span>
      <div
        className="probability-track"
        role="progressbar"
        aria-label={classNames[id]}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Number(percentage)}
      >
        <span
          className={leading ? tone : ""}
          style={{ width: `${value * 100}%` }}
        />
      </div>
      <strong>{percentage}%</strong>
    </div>
  );
}

export function AnalysisResult({
  result,
  preview,
  filename,
  onReset,
}: {
  result: Prediction;
  preview: string;
  filename: string;
  onReset: () => void;
}) {
  const healthy = result.prediction === "healthy_rice";
  const unknown = result.prediction === "unknown";
  const tone = healthy ? "healthy" : unknown ? "unknown" : "pest";
  const guide = guides.find((g) => g.slug === guideForClass[result.prediction]);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);
  const characteristics = unknown ? unknownGuidance : healthy ? [
    "No visible signs of pest-related damage",
    "Leaves, stems, and grains appear normal",
    "Healthy and good condition",
  ] : guide?.symptoms ?? [];
  return (
    <div className="page-wrap results-page">
      <h1 ref={heading} tabIndex={-1} className="sr-only">Your Analysis Results</h1>
      <section className={`results-panel panel ${tone}`}>
        <div className="result-grid">
          <figure className="result-image">
            <img src={preview} alt="Uploaded rice crop used for this analysis" />
            <figcaption className="sr-only">{filename}</figcaption>
          </figure>
          <div className="result-data">
            <div className="prediction-summary">
              <div className="prediction-title">
                <span className="prediction-icon">
                  {unknown ? <span aria-hidden="true">?</span> : healthy ? <Leaf size={34} /> : <Bug size={34} />}
                </span>
                <div>
                  <p className="prediction-label">{unknown || healthy ? "Predicted Class" : "Predicted Pest"}</p>
                  <h2>{unknown ? <>Unknown <br />(Other Damage)</> : guide?.name ?? classNames[result.prediction]}</h2>
                  {!unknown && !healthy && <p className="scientific">({guide?.scientific})</p>}
                </div>
              </div>
              <p className="confidence"><span>Confidence Score: </span><strong>{(result.confidence * 100).toFixed(1)}%</strong></p>
              <div className="confidence-track" aria-hidden="true"><span style={{ width: `${result.confidence * 100}%` }} /></div>
            </div>
            <div className="characteristics">
              <h3>{healthy || unknown ? "Identified Characteristics" : "Identified Damage Characteristics"}</h3>
              <ul>{characteristics.map((item) => <li key={item}>{item}</li>)}</ul>
              <p className="characteristic-note">{unknown
                ? "General explanatory guidance, not independently detected findings in your image."
                : healthy
                  ? "Class characteristics only. This does not confirm that the plant is completely pest-free or disease-free."
                  : "Typical signs of this class; not separately verified findings in your image."}</p>
            </div>
          </div>
        </div>
        <section className="probability-section" aria-labelledby="probabilities-title">
          <h3 id="probabilities-title">Prediction Probabilities</h3>
          <div className="probabilities">
            {(Object.entries(result.probabilities) as [ClassId, number][])
              .sort((a, b) => b[1] - a[1])
              .map(([id, value]) => <PredictionBar key={id} id={id} value={value} leading={id === result.prediction} tone={tone} />)}
          </div>
        </section>
        <div className="result-actions">
          <button className="button secondary" onClick={onReset}><RefreshCw size={18} /> Analyze Another Image</button>
          {guide && <Link className="button" to={`/pest-guide/${guide.slug}`}><Info size={18} /> {unknown ? "Learn More" : `Learn More About ${guide.name}`}</Link>}
        </div>
      </section>
      <p className="result-disclaimer">Model confidence is not a guarantee of correctness. Consult an agricultural expert if you are uncertain.</p>
    </div>
  );
}

export function Analyze() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [validating, setValidating] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [camera, setCamera] = useState(false);
  const [result, setResult] = useState<Prediction | null>(null);
  const [status, setStatus] = useState<ModelStatus | null>(null);
  const [statusError, setStatusError] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const request = useRef<AbortController | null>(null);
  const selection = useRef(0);
  const depth = useRef(0);
  const alive = useRef(true);
  const locked = busy || validating;
  useEffect(() => {
    alive.current = true;
    let disposed = false;
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 15000);
    getModelStatus(controller.signal)
      .then((value) => {
        if (!disposed) {
          setStatus(value);
          setStatusError("");
        }
      })
      .catch((e) => {
        if (!disposed)
          setStatusError(
            e.name === "AbortError"
              ? "The analysis service is taking too long to respond. You can retry with your image below."
              : e.message,
          );
      })
      .finally(() => clearTimeout(timer));
    return () => {
      disposed = true;
      alive.current = false;
      controller.abort();
      request.current?.abort();
      selection.current++;
      clearTimeout(timer);
    };
  }, []);
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );
  async function chooseFile(next: File | undefined) {
    if (!next || request.current) return;
    const token = ++selection.current;
    setError("");
    if (
      !/\.(jpe?g|png)$/i.test(next.name) ||
      (next.type && !["image/jpeg", "image/png"].includes(next.type))
    ) {
      setError("Unsupported format. Please choose a JPG, JPEG, or PNG image.");
      return;
    }
    if (next.size > 10 * 1024 * 1024) {
      setError("This image is too large. Choose an image under 10 MB.");
      return;
    }
    if (!next.size) {
      setError("This file is empty. Please choose another image.");
      return;
    }
    setValidating(true);
    const url = URL.createObjectURL(next);
    try {
      const probe = new Image();
      probe.src = url;
      await probe.decode();
      if (probe.naturalWidth * probe.naturalHeight > 25_000_000)
        throw new Error(
          "Image resolution is too large. Use an image under 25 megapixels.",
        );
      if (token !== selection.current || !alive.current) {
        URL.revokeObjectURL(url);
        return;
      }
      setFile(next);
      setPreview(url);
      setResult(null);
    } catch (e) {
      URL.revokeObjectURL(url);
      if (token === selection.current && alive.current)
        setError(
          e instanceof DOMException
            ? "This image could not be read. Please choose another image."
            : (e as Error).message,
        );
    } finally {
      if (token === selection.current && alive.current) setValidating(false);
    }
  }
  function clear() {
    selection.current++;
    setValidating(false);
    setFile(null);
    setPreview("");
    setResult(null);
    setError("");
    if (input.current) input.current.value = "";
    if (cameraInput.current) cameraInput.current.value = "";
  }
  async function analyze() {
    if (!file || request.current || validating) return;
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    setError("");
    let timedOut = false;
    const timer = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 90000);
    try {
      const prediction = await analyzeImage(
        file,
        controller.signal,
        status?.classes,
      );
      if (alive.current) {
        setResult(prediction);
        setStatusError("");
      }
    } catch (e) {
      if (alive.current)
        setError(
          timedOut
            ? "Analysis timed out. Please try again with a smaller image."
            : (e as Error).message,
        );
    } finally {
      clearTimeout(timer);
      request.current = null;
      if (alive.current) setBusy(false);
    }
  }
  function openCamera() {
    if (/Android|iPhone|iPad/i.test(navigator.userAgent))
      cameraInput.current?.click();
    else setCamera(true);
  }
  if (result && file)
    return (
      <AnalysisResult
        result={result}
        preview={preview}
        filename={file.name}
        onReset={clear}
      />
    );
  return (
    <div className="page-wrap analyze-page">
      <PageHeading
        title="Upload or Capture a Rice Crop Image"
      >
        Upload a clear image of the rice plant (leaves, stem, or grains) with
        visible damage for pest identification.
      </PageHeading>
      <section className="upload-panel panel" aria-busy={busy}>
        {(status?.available === false || statusError) && (
          <div className="notice model-notice" role="status">
            <Info size={20} />
            <p>
              <strong>Analysis service unavailable</strong>
              <br />
              {statusError || status?.message} No predictions will be generated
              without the model.
            </p>
          </div>
        )}
        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png"
          className="sr-only"
          tabIndex={-1}
          aria-label="Choose crop image"
          disabled={locked}
          onChange={(e) => {
            void chooseFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        <input
          ref={cameraInput}
          type="file"
          accept="image/jpeg,image/png"
          capture="environment"
          className="sr-only"
          tabIndex={-1}
          aria-label="Take crop photo"
          disabled={locked}
          onChange={(e) => {
            void chooseFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        <div className="upload-and-tips">
          <div className="upload-workspace">
            {!file ? (
              <>
                <div
                  className={`dropzone ${dragging ? "dragging" : ""}`}
                  onDragEnter={(e) => {
                    e.preventDefault();
                    depth.current++;
                    if (!locked) setDragging(true);
                  }}
                  onDragOver={(e) => e.preventDefault()}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    depth.current--;
                    if (depth.current === 0) setDragging(false);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    depth.current = 0;
                    setDragging(false);
                    if (!locked) {
                      if (e.dataTransfer.files.length > 1)
                        setError("Please choose one image at a time.");
                      else void chooseFile(e.dataTransfer.files[0]);
                    }
                  }}
                >
                  <span className="upload-cloud">
                    {validating ? (
                      <LoaderCircle className="spin" size={44} />
                    ) : (
                      <CloudUpload size={49} strokeWidth={1.6} />
                    )}
                  </span>
                  <h2>
                    {dragging
                      ? "Drop your crop image here"
                      : validating
                        ? "Checking your image…"
                        : "Drag and drop an image here"}
                  </h2>
                  <p>or</p>
                  <button
                    className="button"
                    disabled={locked}
                    onClick={() => input.current?.click()}
                  >
                    <ImageIcon size={19} /> Choose Image
                  </button>
                  <button className="button capture-button" disabled={locked} onClick={openCamera}>
                    <Camera size={19} /> Capture Image
                  </button>
                  <p className="format-note">Supported formats: JPG, PNG (Max 10MB)</p>
                </div>
              </>
            ) : (
              <div className="preview-section">
                <div className="preview-heading">
                  <span>
                    <Check size={17} /> Your image is ready
                  </span>
                  <button
                    className="icon-button"
                    disabled={locked}
                    aria-label="Remove image"
                    onClick={clear}
                  >
                    <X size={20} />
                  </button>
                </div>
                <div className={`image-preview ${busy ? "is-analyzing" : ""}`}>
                  <img src={preview} alt="Selected rice crop preview" />
                  {busy && (
                    <div className="analysis-overlay">
                      <LoaderCircle className="spin" size={32} />
                      <strong>Analyzing your crop…</strong>
                      <span>Looking at visible damage patterns</span>
                    </div>
                  )}
                </div>
                <div className="preview-meta">
                  <div>
                    <strong>{file.name}</strong>
                    <span>
                      {(file.size / 1024 / 1024).toFixed(2)} MB · Ready for
                      image-based analysis
                    </span>
                  </div>
                  <button
                    className="text-link"
                    disabled={locked}
                    onClick={() => input.current?.click()}
                  >
                    <RefreshCw size={16} /> Replace
                  </button>
                </div>
                <button
                  className="button analyze-button"
                  disabled={locked || status?.available === false}
                  onClick={() => void analyze()}
                >
                  {busy ? (
                    <LoaderCircle className="spin" size={20} />
                  ) : (
                    <ScanLine size={20} />
                  )}
                  {busy ? "Analyzing Image…" : "Analyze Image"}
                  {!busy && <ArrowRight size={20} />}
                </button>
                <div className="sr-only" role="status">
                  {busy ? "Analysis in progress. Please wait." : ""}
                </div>
              </div>
            )}
            {error && (
              <div role="alert" className="error-message">
                <AlertCircle size={20} />
                <span>{error}</span>
              </div>
            )}
          </div>
          <TipsForBetterResults />
        </div>
        <SupportedClasses status={status} statusError={!!statusError} />
      </section>
      {camera && (
        <CameraCapture
          onCapture={(f) => void chooseFile(f)}
          onClose={() => setCamera(false)}
        />
      )}
    </div>
  );
}
