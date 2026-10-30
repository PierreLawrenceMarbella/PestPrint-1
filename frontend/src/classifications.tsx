import { Link } from "react-router-dom";
import { Check, CircleHelp, Lightbulb } from "lucide-react";
import { asset, classificationCards, classNames, guideForClass } from "./data";
import type { ModelStatus } from "./api";

export function TipsForBetterResults() {
  return (
    <aside className="photo-tips" aria-labelledby="photo-tips-title">
      <h2 id="photo-tips-title">
        <Lightbulb size={21} /> Tips for Better Results
      </h2>
      <ul>
        {[
          "Use clear, well-lit images.",
          "Focus on the damaged part (leaves, stem, or grains).",
          "Avoid blurry or distant photos.",
          "Make sure the rice crop is visible.",
        ].map((tip) => (
          <li key={tip}>
            <Check size={17} />
            <span>{tip}</span>
          </li>
        ))}
      </ul>
    </aside>
  );
}

export function SupportedClasses({
  status,
  statusError,
}: {
  status: ModelStatus | null;
  statusError: boolean;
}) {
  return (
    <section
      className="supported-classes"
      aria-labelledby="supported-classes-title"
    >
      <h2 id="supported-classes-title">Supported Classes</h2>
      <p>
        Explore four crop categories. Labels below show which are supported by
        the connected model.
      </p>
      <div className="classification-grid">
        {classificationCards.map((card) => {
          const supported = status?.classes.includes(card.id);
          const availability = status
            ? supported
              ? status.available
                ? "Model supported"
                : "Analysis unavailable"
              : "Guide only"
            : statusError
              ? "Availability unconfirmed"
              : "Checking availability…";
          return (
            <Link
              className={`classification-card ${card.id === "unknown" ? "unknown-card" : ""}`}
              key={card.id}
              to={`/pest-guide/${guideForClass[card.id]}`}
            >
              <div className="classification-image">
                <img src={asset(card.image)} alt={card.alt} loading="lazy" />
                {card.id === "unknown" && (
                  <span className="unknown-badge">
                    <CircleHelp size={26} aria-hidden="true" />
                  </span>
                )}
              </div>
              <h3>{classNames[card.id]}</h3>
              <span
                className={`class-availability ${supported && status?.available ? "supported" : ""}`}
              >
                {availability}
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
