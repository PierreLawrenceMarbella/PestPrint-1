import { useCallback, useEffect, useRef, useState } from "react";
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
import { AnalysisScanner } from "./analysis-scanner";
import { staggerStyle } from "./motion";

// Keep the existing one-decimal display without implying zero or certainty
// for a nonzero or less-than-one response. Bar widths retain the raw values.
function formatResultPercentage(value: number) {
  const percentage = value * 100;
  if (value > 0 && percentage < 0.1) return "<0.1%";
  if (value < 1 && percentage > 99.9) return ">99.9%";
  return `${percentage.toFixed(1)}%`;
}

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
          className="icon-button upload-control"
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
        <button className="button secondary upload-control motion-hover" onClick={onClose}>
          Cancel
        </button>
        <button
          className="button upload-control motion-hover"
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
  index = 0,
}: {
  id: ClassId;
  value: number;
  leading: boolean;
  tone: string;
  index?: number;
}) {
  const percentage = formatResultPercentage(value);
  return (
    <div className={`probability-row motion-fade-in ${leading ? "leading" : ""}`} style={staggerStyle(index)}>
      <span>{classNames[id]}</span>
      <div
        className="probability-track"
        role="progressbar"
        aria-label={classNames[id]}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value * 100}
      >
        <span
          className={`result-bar-fill ${leading ? tone : ""}`}
          style={{ width: `${value * 100}%` }}
        />
      </div>
      <strong>{percentage}</strong>
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
      <section className={`results-panel panel ${tone} motion-page motion-fade-up`}>
        <div className="result-grid">
          <figure className="result-image motion-fade-in">
            <img src={preview} alt="Uploaded rice crop used for this analysis" />
            <figcaption className="sr-only">{filename}</figcaption>
          </figure>
          <div className="result-data motion-fade-in">
            <div className="prediction-summary">
              <div className="prediction-title">
                <span className="prediction-icon motion-scale" aria-hidden="true">
                  {unknown ? <span aria-hidden="true">?</span> : healthy ? <Leaf size={34} /> : <Bug size={34} />}
                </span>
                <div className="motion-fade-in">
                  <p className="prediction-label">{unknown || healthy ? "Predicted Class" : "Predicted Pest"}</p>
                  <h2>{unknown ? <>Unknown <br />(Other Damage)</> : guide?.name ?? classNames[result.prediction]}</h2>
                  {!unknown && !healthy && <p className="scientific">({guide?.scientific})</p>}
                </div>
              </div>
              <p className="confidence motion-fade-in"><span>Confidence Score: </span><strong>{formatResultPercentage(result.confidence)}</strong></p>
              <div className="confidence-track" aria-hidden="true"><span className="result-bar-fill" style={{ width: `${result.confidence * 100}%` }} /></div>
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
          <div className="probabilities motion-stagger">
            {(Object.entries(result.probabilities) as [ClassId, number][])
              .sort((a, b) => b[1] - a[1])
              .map(([id, value], index) => <PredictionBar key={id} id={id} value={value} leading={id === result.prediction} tone={tone} index={index} />)}
          </div>
        </section>
        <div className="result-actions motion-fade-in">
          <button className="button secondary result-action motion-hover" onClick={onReset}><RefreshCw size={18} /> Analyze Another Image</button>
          {guide && <Link className="button result-action motion-hover" to={`/pest-guide/${guide.slug}`}><Info size={18} /> {unknown ? "Learn More" : `Learn More About ${guide.name}`}</Link>}
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
  const [canceled, setCanceled] = useState(false);
  const [validating, setValidating] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [camera, setCamera] = useState(false);
  const [result, setResult] = useState<Prediction | null>(null);
  const [status, setStatus] = useState<ModelStatus | null>(null);
  const [statusError, setStatusError] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const chooseButton = useRef<HTMLButtonElement>(null);
  const analyzeButton = useRef<HTMLButtonElement>(null);
  const previewHeading = useRef<HTMLSpanElement>(null);
  const restoreChooseFocus = useRef(false);
  const request = useRef<AbortController | null>(null);
  const selection = useRef(0);
  const depth = useRef(0);
  const alive = useRef(true);
  const locked = busy || validating;
  const resetDrag = useCallback(() => {
    depth.current = 0;
    setDragging(false);
  }, []);
  useEffect(() => {
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") resetDrag();
    };
    const leaveWindow = (event: DragEvent) => {
      if (!event.relatedTarget && (
        event.clientX <= 0 || event.clientY <= 0 ||
        event.clientX >= innerWidth || event.clientY >= innerHeight
      )) resetDrag();
    };
    const outside = (event: DragEvent) => {
      if (!(event.target instanceof Element) || !event.target.closest(".dropzone"))
        resetDrag();
    };
    const hidden = () => {
      if (document.hidden) resetDrag();
    };
    window.addEventListener("dragend", resetDrag);
    window.addEventListener("drop", resetDrag);
    window.addEventListener("blur", resetDrag);
    window.addEventListener("dragleave", leaveWindow);
    window.addEventListener("dragover", outside);
    window.addEventListener("keydown", escape);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      window.removeEventListener("dragend", resetDrag);
      window.removeEventListener("drop", resetDrag);
      window.removeEventListener("blur", resetDrag);
      window.removeEventListener("dragleave", leaveWindow);
      window.removeEventListener("dragover", outside);
      window.removeEventListener("keydown", escape);
      document.removeEventListener("visibilitychange", hidden);
    };
  }, [resetDrag]);
  useEffect(() => {
    if (preview) previewHeading.current?.focus();
    else if (restoreChooseFocus.current) {
      restoreChooseFocus.current = false;
      chooseButton.current?.focus();
    }
  }, [preview]);
  useEffect(() => {
    if (canceled) analyzeButton.current?.focus();
  }, [canceled]);
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
    resetDrag();
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
      setCanceled(false);
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
    resetDrag();
    restoreChooseFocus.current = true;
    selection.current++;
    setValidating(false);
    setFile(null);
    setPreview("");
    setResult(null);
    setError("");
    setCanceled(false);
    if (input.current) input.current.value = "";
    if (cameraInput.current) cameraInput.current.value = "";
  }
  async function analyze() {
    if (!file || request.current || validating || status?.available === false) return;
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    setError("");
    setCanceled(false);
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
      controller.signal.throwIfAborted();
      if (alive.current) {
        setResult(prediction);
        setStatusError("");
      }
    } catch (e) {
      if (alive.current) {
        if (controller.signal.aborted && !timedOut) setCanceled(true);
        else setError(
          timedOut
            ? "Analysis timed out. Please try again with a smaller image."
            : (e as Error).message,
        );
      }
    } finally {
      clearTimeout(timer);
      if (request.current === controller) {
        request.current = null;
        if (alive.current) setBusy(false);
      }
    }
  }
  function cancelAnalysis() {
    request.current?.abort();
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
    <div className="page-wrap analyze-page motion-page motion-fade-up">
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
                  className={`dropzone motion-transition ${dragging ? "dragging" : ""}`}
                  onDragEnter={(e) => {
                    e.preventDefault();
                    if (!locked && e.dataTransfer.types.includes("Files")) {
                      depth.current++;
                      setDragging(true);
                    }
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = !locked && e.dataTransfer.types.includes("Files") ? "copy" : "none";
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    depth.current = Math.max(0, depth.current - 1);
                    if (depth.current === 0) resetDrag();
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    resetDrag();
                    if (!locked) {
                      if (e.dataTransfer.files.length > 1)
                        setError("Please choose one image at a time.");
                      else void chooseFile(e.dataTransfer.files[0]);
                    }
                  }}
                >
                  <span className="upload-cloud motion-transition" aria-hidden="true">
                    {validating ? (
                      <LoaderCircle className="spin" size={44} />
                    ) : (
                      <CloudUpload size={49} strokeWidth={1.6} />
                    )}
                  </span>
                  <h2 aria-live="polite" aria-atomic="true">
                    {dragging
                      ? "Drop your crop image here"
                      : validating
                        ? "Checking your image…"
                        : "Drag and drop an image here"}
                  </h2>
                  <p>or</p>
                  <button
                    ref={chooseButton}
                    className="button upload-control motion-hover"
                    disabled={locked}
                    onClick={() => input.current?.click()}
                  >
                    <ImageIcon size={19} /> Choose Image
                  </button>
                  <button className="button capture-button upload-control motion-hover" disabled={locked} onClick={openCamera}>
                    <Camera size={19} /> Capture Image
                  </button>
                  <p className="format-note">Supported formats: JPG, PNG (Max 10MB)</p>
                </div>
              </>
            ) : (
              <div className="preview-section">
                <div className="preview-heading">
                  <span ref={previewHeading} tabIndex={-1} className="preview-ready motion-fade-in">
                    <Check size={17} /> Your image is ready
                  </span>
                  <button
                    className="icon-button upload-control motion-fade-in"
                    disabled={locked}
                    aria-label="Remove image"
                    onClick={clear}
                  >
                    <X size={20} />
                  </button>
                </div>
                <div key={preview} className={`image-preview motion-scale ${busy ? "is-analyzing" : ""}`}>
                  <img src={preview} alt="Selected rice crop preview" />
                  {busy && <AnalysisScanner onCancel={cancelAnalysis} />}
                </div>
                <div className="preview-meta motion-fade-in">
                  <div>
                    <strong>{file.name}</strong>
                    <span>
                      {(file.size / 1024 / 1024).toFixed(2)} MB · {canceled
                        ? "Analysis canceled. Ready to try again."
                        : "Ready for image-based analysis"}
                    </span>
                  </div>
                  <button
                    className="text-link upload-control"
                    disabled={locked}
                    onClick={() => input.current?.click()}
                  >
                    <RefreshCw size={16} /> Replace
                  </button>
                </div>
                <button
                  ref={analyzeButton}
                  className="button analyze-button upload-control motion-fade-in motion-hover"
                  disabled={locked || status?.available === false}
                  onClick={() => void analyze()}
                >
                  {busy ? (
                    <LoaderCircle className="spin" size={20} />
                  ) : (
                    <ScanLine size={20} />
                  )}
                  {busy ? "Analyzing Image…" : "Analyze Image"}
                  {!busy && <ArrowRight size={20} className="upload-arrow motion-transition-transform" aria-hidden="true" />}
                </button>
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
      <div className="sr-only" role="status" aria-atomic="true">
        {busy ? "Analyzing rice crop image..." : canceled
          ? "Analysis canceled. Your image is ready to try again."
          : file ? `Image ready: ${file.name}` : ""}
      </div>
      {camera && (
        <CameraCapture
          onCapture={(f) => void chooseFile(f)}
          onClose={() => setCamera(false)}
        />
      )}
    </div>
  );
}
