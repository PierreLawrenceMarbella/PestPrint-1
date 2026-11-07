import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { asset } from "./data";
import { staggerStyle } from "./motion";

// Decorative photography only; these images never enter the analysis pipeline.
const slides = [
  { image: "hero-rice-mountains.webp", subject: "Rice leaves with visible damage", crops: ["78% 66%", "83% 66%", "86% 78%"], zoom: [2.5, 3.7, 2.8] },
  { image: "hero-rice-morning.webp", subject: "Green rice fields", crops: ["78% 65%", "64% 76%", "89% 43%"], zoom: [1.8, 2.2, 2.1] },
  { image: "rice-field.jpg", subject: "Golden rice grains", crops: ["72% 50%", "82% 24%", "64% 76%"], zoom: [1.2, 1.5, 1.4] },
  { image: "hero-rice-sunset.webp", subject: "Rice crops and mountain scenery", crops: ["79% 63%", "67% 77%", "92% 42%"], zoom: [1.8, 2.1, 2.2] },
];
const SLIDE_INTERVAL = 6000;

// Share decoded assets across preview frames and route remounts. Failed requests
// can be retried on a later visit; a failed image is never made visible.
const decodedImages = new Map<number, Promise<boolean>>();
function preloadSlide(index: number): Promise<boolean> {
  const cached = decodedImages.get(index);
  if (cached) return cached;
  const image = new Image();
  image.decoding = "async";
  image.fetchPriority = index === 0 ? "high" : "low";
  image.src = asset(slides[index].image);
  const decoded = image.decode().then(() => true, () => {
    decodedImages.delete(index);
    return false;
  });
  decodedImages.set(index, decoded);
  return decoded;
}

export function Hero() {
  const hero = useRef<HTMLElement>(null);
  const [{ active, previous }, setSlide] = useState<{ active: number; previous: number | null }>({ active: 0, previous: null });
  const [ready, setReady] = useState<number[]>([]);
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const [visible, setVisible] = useState(() => !document.hidden);
  const [inView, setInView] = useState(true);
  const suspended = paused || reduced || !visible || !inView;

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncPreference = () => setReduced(preference.matches);
    const syncVisibility = () => setVisible(!document.hidden);
    preference.addEventListener("change", syncPreference);
    document.addEventListener("visibilitychange", syncVisibility);
    return () => {
      preference.removeEventListener("change", syncPreference);
      document.removeEventListener("visibilitychange", syncVisibility);
    };
  }, []);

  useEffect(() => {
    if (!hero.current || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting));
    observer.observe(hero.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;
    const prepare = async (index: number) => {
      const loaded = await preloadSlide(index);
      if (loaded && !cancelled) setReady((indices) => indices.includes(index) ? indices : [...indices, index]);
      return loaded;
    };
    const prepareNext = async () => {
      for (let offset = 1; offset < slides.length && !cancelled; offset++) {
        const index = (active + offset) % slides.length;
        if (await prepare(index)) return index;
      }
      return null;
    };
    const advance = (next: number | null) => {
      if (!cancelled && next !== null) setSlide({ active: next, previous: active });
    };

    // Start fetching the next image while the current one is on screen. Slow
    // decoding holds the current frame; it never exposes an empty slide.
    const currentReady = prepare(active);
    const nextReady = suspended ? null : prepareNext();
    void currentReady.then((loaded) => {
      if (cancelled) return;
      if (!loaded) {
        void (nextReady ?? prepareNext()).then(advance);
      } else if (nextReady) {
        timer = window.setTimeout(() => { void nextReady.then(advance); }, SLIDE_INTERVAL);
      }
    });
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [active, suspended]);

  const stateClass = (index: number) => index === active ? " active" : index === previous ? " previous" : "";
  return (
    <section ref={hero} className={`hero${suspended ? " motion-paused" : ""}`} style={{ "--hero-slide-interval": `${SLIDE_INTERVAL}ms` } as CSSProperties} aria-label="Rice crop image identification">
      <div className="hero-slides" aria-hidden="true">
        {slides.map((slide, index) => (
          <div key={slide.image} className={`hero-slide${stateClass(index)}`} data-slide-index={index} data-subject={slide.subject}>
            {ready.includes(index) && <img className="hero-image" src={asset(slide.image)} alt="" decoding="async" fetchPriority={index === 0 ? "high" : "low"} />}
          </div>
        ))}
      </div>
      <div className="hero-overlay" />
      <div className="hero-inner motion-stagger">
        <div className="hero-copy motion-stagger">
          <h1 className="motion-fade-up" style={staggerStyle(0)}>Identify Rice Pests<br />Through <span>Crop<br />Damage Images</span></h1>
          <p className="hero-description motion-fade-up" style={staggerStyle(1)}>
            An AI-powered tool that analyzes visible damage on rice crops and identifies the most likely pest responsible, even when the pest itself is not visible.
          </p>
          <Link to="/analyze" className="button hero-button home-action motion-fade-up motion-hover" style={staggerStyle(2)}>
            Analyze a Rice Crop Image <ArrowRight className="button-arrow motion-transition" size={19} aria-hidden="true" />
          </Link>
        </div>
        <div className="scan-visual motion-scale" style={staggerStyle(3)} aria-hidden="true">
          <div className="scan-frame">
            <i /><i /><i /><i />
            <div className="scan-sweep"><div className="scan-line" /></div>
          </div>
          {[0, 1, 2].map((detail) => (
            <div key={detail} className={`crop-preview crop-preview-${detail + 1}`}>
              {slides.map((slide, index) => ready.includes(index) && (
                <img key={slide.image} className={`crop-preview-image${stateClass(index)}`} src={asset(slide.image)} alt="" decoding="async"
                  style={{ objectPosition: slide.crops[detail], transformOrigin: slide.crops[detail], transform: `scale(${slide.zoom[detail]})` }} />
              ))}
            </div>
          ))}
        </div>
      </div>
      <button className="hero-motion-control" aria-label={paused ? "Play background animation" : "Pause background animation"}
        aria-pressed={paused} onClick={() => setPaused(!paused)}>{paused ? "Play" : "Pause"}</button>
    </section>
  );
}
