import { useEffect, useState } from "react";
import { LoaderCircle } from "lucide-react";

// Decorative request feedback, not model detections or measured progress.
export function AnalysisScanner({ onCancel }: { onCancel: () => void }) {
  const [hidden, setHidden] = useState(() => document.hidden);
  useEffect(() => {
    const update = () => setHidden(document.hidden);
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);

  return (
    <div className={`analysis-overlay ${hidden ? "is-paused" : ""}`}>
      <div className="analysis-scan-frame" aria-hidden="true">
        <span className="analysis-sweep" />
        <i className="analysis-corner top-left" />
        <i className="analysis-corner top-right" />
        <i className="analysis-corner bottom-left" />
        <i className="analysis-corner bottom-right" />
      </div>
      <div className="analysis-processing">
        <div className="analysis-processing-label" aria-hidden="true">
          <LoaderCircle className="spin" size={20} />
          <strong>Analyzing rice crop image...</strong>
        </div>
        <button className="analysis-cancel" onClick={onCancel}>
          Cancel Analysis
        </button>
      </div>
    </div>
  );
}
