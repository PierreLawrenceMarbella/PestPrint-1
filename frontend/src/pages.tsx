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
import { Hero } from "./hero";
import { useSectionReveals } from "./scroll-reveal";

export function Home() {
  return (
    <div className="home-page motion-page motion-fade-up">
      <Hero />
      <section className="how-section" aria-label="How PESTPRINT works"><HowItWorks animated /></section>
    </div>
  );
}
export function PestGuide() {
  const reveal = useSectionReveals();
  return (
    <div ref={reveal} className="page-wrap guide-page motion-page motion-fade-up">
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
  const reveal = useSectionReveals(slug);
  const entry = guides.find((item) => item.slug === slug);
  if (!entry) return <NotFound />;
  return (
    <div ref={reveal} key={entry.slug} className="page-wrap detail-page motion-page motion-fade-up">
      <Link className="back-link" to="/pest-guide">
        <ArrowLeft size={17} /> Back to Pest Guide
      </Link>
      <article className="detail-panel">
        <div className="detail-photo motion-fade-in">
          <img src={asset(entry.image)} alt={entry.alt} />
          <span>{entry.category}</span>
        </div>
        <div className="detail-copy motion-fade-in">
          <p className="eyebrow">CROP IDENTIFICATION GUIDE</p>
          <h1 className="motion-fade-up">{entry.name}</h1>
          <p className="scientific">{entry.scientific}</p>
          <p className="detail-intro">{entry.detail}</p>
          <h2 className="motion-section">
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
          <h2 className="motion-section">What to look for</h2>
          <p>{entry.observation}</p>
          {entry.photoTips && (
            <>
              <h2 className="motion-section">Tips for clearer crop photographs</h2>
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
      <div className="notice motion-section">
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
  const reveal = useSectionReveals();
  return (
    <div ref={reveal} className="page-wrap about-page motion-page motion-fade-up">
      <PageHeading
        eyebrow="ABOUT PESTPRINT"
        title="Understanding damage. Supporting better decisions."
      >
        A closer look at your rice crop can reveal a lot. PESTPRINT helps you
        take that first look with confidence.
      </PageHeading>
      <section className="about-intro panel motion-section">
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
      <section className="about-workflow motion-section">
        <p className="eyebrow">A SIMPLE PROCESS</p>
        <h2>How image-based identification works</h2>
        <HowItWorks />
      </section>
      <div className="about-grid">
        <section className="panel motion-section">
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
        <section className="panel motion-section">
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
      <div className="about-cta motion-section">
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
    <div className="page-wrap empty-page motion-page motion-fade-up">
      <Leaf size={44} />
      <h1>This page hasn’t taken root.</h1>
      <p>Head back home or explore the rice pest guide.</p>
      <Link className="button" to="/">
        Back to Home <ArrowRight size={18} />
      </Link>
    </div>
  );
}
