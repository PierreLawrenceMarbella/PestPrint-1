import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowRight,
  ArrowLeft,
  Upload,
  Leaf,
  Check,
  ShieldCheck,
  Sprout,
  Info,
  ExternalLink,
  BrainCircuit,
  CircleHelp,
} from "lucide-react";
import { asset, guides } from "./data";
import { HowItWorks, PageHeading, PestGuideCard } from "./components";

// Decorative hero assets are illustrative; analysis always uses the uploaded photo.
const heroSlides = [
  "hero-rice-mountains.webp",
  "hero-rice-morning.webp",
  "rice-field.jpg",
  "hero-rice-sunset.webp",
];

export function Home() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let timer: number | undefined;
    const sync = () => {
      window.clearInterval(timer);
      if (motion.matches) setActive(0);
      if (!motion.matches && !paused && !document.hidden)
        timer = window.setInterval(() => setActive((slide) => (slide + 1) % heroSlides.length), 5000);
    };
    sync();
    motion.addEventListener("change", sync);
    document.addEventListener("visibilitychange", sync);
    return () => {
      window.clearInterval(timer);
      motion.removeEventListener("change", sync);
      document.removeEventListener("visibilitychange", sync);
    };
  }, [paused]);
  return (
    <div className={`home-page ${paused ? "motion-paused" : ""}`}>
      <section className="hero">
        <div className="hero-slides" aria-hidden="true">
          {heroSlides.map((photo, index) => (
            <img key={photo} className={`hero-image ${index === active ? "active" : ""}`}
              src={asset(photo)} alt="" fetchPriority={index === 0 ? "high" : "low"} />
          ))}
        </div>
        <div className="hero-overlay" />
        <div className="hero-inner">
          <div className="hero-copy">
            <h1>Identify Rice Pests<br />Through <span>Crop<br />Damage Images</span></h1>
            <p className="hero-description">
              An AI-powered tool that analyzes visible damage on rice crops and identifies the most likely pest responsible, even when the pest itself is not visible.
            </p>
            <Link to="/analyze" className="button hero-button">
              Analyze a Rice Crop Image <ArrowRight size={19} />
            </Link>
          </div>
          <div className="scan-visual" aria-hidden="true">
            <div className="scan-frame"><i /><i /><i /><i /><div className="scan-line" /></div>
            {[0, 1, 2].map((detail) => (
              <div key={detail} className={`crop-preview crop-preview-${detail + 1}`}>
                <img src={asset("hero-rice-mountains.webp")} alt="" />
              </div>
            ))}
          </div>
        </div>
        <button className="hero-motion-control" aria-label={paused ? "Play background animation" : "Pause background animation"}
          aria-pressed={paused} onClick={() => setPaused(!paused)}>{paused ? "Play" : "Pause"}</button>
      </section>
      <section className="how-section" aria-label="How PESTPRINT works"><HowItWorks /></section>
    </div>
  );
}
export function PestGuide() {
  return (
    <div className="page-wrap guide-page">
      <PageHeading
        title="Common Rice Pests and Their Damage"
      >
        Learn about the common pests that affect rice crops and the typical
        damage patterns they cause.
      </PageHeading>
      <div className="guide-list">
        {guides.map((entry) => (
          <PestGuideCard key={entry.slug} entry={entry} />
        ))}
      </div>
    </div>
  );
}
export function PestDetail() {
  const { slug } = useParams();
  const entry = guides.find((item) => item.slug === slug);
  if (!entry) return <NotFound />;
  return (
    <div className="page-wrap detail-page">
      <Link className="back-link" to="/pest-guide">
        <ArrowLeft size={17} /> Back to Pest Guide
      </Link>
      <article className="detail-panel">
        <div className="detail-photo">
          <img src={asset(entry.image)} alt={entry.alt} />
          <span>{entry.category}</span>
        </div>
        <div className="detail-copy">
          <p className="eyebrow">CROP IDENTIFICATION GUIDE</p>
          <h1>{entry.name}</h1>
          <p className="scientific">{entry.scientific}</p>
          <p className="detail-intro">{entry.detail}</p>
          <h2>
            {entry.slug === "unknown-damage"
              ? "What this result can mean"
              : entry.slug === "healthy-rice"
                ? "Typical healthy characteristics"
                : "Typical damage characteristics"}
          </h2>
          <ul className="check-list">
            {entry.symptoms.map((s) => (
              <li key={s}>
                {entry.slug === "unknown-damage" ? (
                  <CircleHelp size={17} />
                ) : (
                  <Check size={17} />
                )}
                {s}
              </li>
            ))}
          </ul>
          <h2>What to look for</h2>
          <p>{entry.observation}</p>
          {entry.photoTips && (
            <>
              <h2>Tips for clearer crop photographs</h2>
              <p>{entry.photoTips}</p>
              <p className="unknown-detail-note">
                General explanatory guidance only. These factors were not
                independently detected in your uploaded image.
              </p>
            </>
          )}
          {entry.source && (
            <a
              className="source-link"
              href={entry.source}
              target="_blank"
              rel="noreferrer"
            >
              {entry.sourceName} <ExternalLink size={14} />
            </a>
          )}
          <Link className="button" to="/analyze">
            <Upload size={18} /> Analyze a Rice Crop Image{" "}
            <ArrowRight size={18} />
          </Link>
        </div>
      </article>
      <div className="notice">
        <Info size={20} />
        <p>
          These are typical characteristics, not a diagnosis of your crop. Seek
          advice from a local agricultural expert before making pest-management
          decisions.
        </p>
      </div>
    </div>
  );
}
export function About() {
  return (
    <div className="page-wrap about-page">
      <PageHeading
        eyebrow="ABOUT PESTPRINT"
        title="Understanding damage. Supporting better decisions."
      >
        A closer look at your rice crop can reveal a lot. PESTPRINT helps you
        take that first look with confidence.
      </PageHeading>
      <section className="about-intro panel">
        <img
          src={asset("rice-field.jpg")}
          alt="Developing rice grains on a green panicle"
        />
        <div>
          <span className="round-icon">
            <Sprout size={26} />
          </span>
          <h2>Crop insights, from a single image.</h2>
          <p>
            PESTPRINT is an image-based rice crop damage classification system.
            It uses deep learning to recognize patterns associated with common
            rice pests—even when the insect itself is not visible.
          </p>
          <p>
            Our purpose is to help rice growers and agricultural workers
            understand visible crop damage and make more informed observations
            in the field.
          </p>
        </div>
      </section>
      <section className="about-workflow">
        <p className="eyebrow">A SIMPLE PROCESS</p>
        <h2>How image-based identification works</h2>
        <HowItWorks />
      </section>
      <div className="about-grid">
        <section className="panel">
          <BrainCircuit size={25} />
          <h2>What the model recognizes</h2>
          <p>The connected model currently distinguishes four categories:</p>
          <ul className="check-list">
            {[
              "Healthy Rice",
              "Stem Borer Damage",
              "Rice Leaffolder Damage",
              "Unknown (Other Damage)",
            ].map((name) => (
              <li key={name}>
                <Check size={16} />
                {name}
              </li>
            ))}
          </ul>
        </section>
        <section className="panel">
          <ShieldCheck size={25} />
          <h2>Know the limits</h2>
          <p>
            Image quality, lighting, growth stage, and similar-looking symptoms
            can affect predictions. A confidence score reflects the model’s
            output, not a guarantee of correctness.
          </p>
          <p>
            A healthy prediction cannot rule out all pests or disease. Unknown
            is an explicitly trained category in this model; it is not a
            confidence cutoff or a guarantee that unrelated images will be
            rejected.
          </p>
          <p>
            Predictions support decisions and should not replace expert
            agricultural assessment when uncertainty exists.
          </p>
        </section>
      </div>
      <div className="about-cta">
        <Leaf size={28} />
        <h2>Get a clearer picture of your crop.</h2>
        <Link to="/analyze" className="button">
          Analyze an Image <ArrowRight size={18} />
        </Link>
      </div>
    </div>
  );
}
export function NotFound() {
  return (
    <div className="page-wrap empty-page">
      <Leaf size={44} />
      <h1>This page hasn’t taken root.</h1>
      <p>Head back home or explore the rice pest guide.</p>
      <Link className="button" to="/">
        Back to Home <ArrowRight size={18} />
      </Link>
    </div>
  );
}
