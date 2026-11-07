import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import {
  Menu,
  X,
  Camera,
  BrainCircuit,
  ClipboardCheck,
  ChevronRight,
  Users,
  type LucideIcon,
} from "lucide-react";
import { asset, type GuideEntry } from "./data";
import { staggerStyle } from "./motion";

export function Logo() {
  return (
    <span className="logo">
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <g
          fill="none"
          stroke="currentColor"
          strokeWidth="2.3"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M14 42 34 7M21 29C10 29 9 19 13 11c8 3 11 9 8 18Zm3-8C20 11 27 4 35 3c0 8-4 15-11 18Zm-5 14c4-12 13-16 23-13-4 11-12 17-23 13Z" />
        </g>
      </svg>
      <span>
        PEST<span className="text-green">PRINT</span>
      </span>
    </span>
  );
}
export function Navbar() {
  const [open, setOpen] = useState(false);
  const [mobile, setMobile] = useState(() => window.matchMedia("(max-width: 600px)").matches);
  const menuButton = useRef<HTMLButtonElement>(null);
  const navigation = useRef<HTMLElement>(null);
  const lastNavFocus = useRef<"menu" | "link" | null>(null);
  const pendingNavFocus = useRef<"menu" | "link" | null>(null);
  const location = useLocation();
  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);
  useEffect(() => {
    const breakpoint = window.matchMedia("(max-width: 600px)");
    const sync = () => {
      // CSS may hide the focused element before the media event fires. Keep
      // its last owner, then focus the replacement after inert is updated.
      if (breakpoint.matches && lastNavFocus.current === "link") pendingNavFocus.current = "menu";
      else if (!breakpoint.matches && lastNavFocus.current === "menu") pendingNavFocus.current = "link";
      setMobile(breakpoint.matches);
      setOpen(false);
    };
    breakpoint.addEventListener("change", sync);
    return () => breakpoint.removeEventListener("change", sync);
  }, []);
  useLayoutEffect(() => {
    if (pendingNavFocus.current === "menu") menuButton.current?.focus({ preventScroll: true });
    else if (pendingNavFocus.current === "link") navigation.current?.querySelector<HTMLAnchorElement>('a[aria-current="page"]')?.focus({ preventScroll: true });
    pendingNavFocus.current = null;
  }, [mobile]);
  useEffect(() => {
    if (!open || !mobile) return;
    const closeMenu = () => {
      setOpen(false);
      menuButton.current?.focus({ preventScroll: true });
    };
    const close = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeMenu();
      }
    };
    const outside = (e: PointerEvent) => {
      if (e.target instanceof Node && !navigation.current?.contains(e.target) && !menuButton.current?.contains(e.target)) {
        setOpen(false);
        if (navigation.current?.contains(document.activeElement)) menuButton.current?.focus({ preventScroll: true });
      }
    };
    window.addEventListener("keydown", close);
    document.addEventListener("pointerdown", outside);
    return () => {
      window.removeEventListener("keydown", close);
      document.removeEventListener("pointerdown", outside);
    };
  }, [open, mobile]);
  return (
    <header className="header"
      onFocusCapture={(event) => {
        lastNavFocus.current = event.target === menuButton.current ? "menu" : navigation.current?.contains(event.target) ? "link" : null;
      }}
      onBlurCapture={(event) => {
        if (event.relatedTarget instanceof Node && !event.currentTarget.contains(event.relatedTarget)) {
          lastNavFocus.current = null;
          if (mobile && open) setOpen(false);
        }
      }}>
      <div className="nav-inner">
        <Link to="/" aria-label="PESTPRINT home">
          <Logo />
        </Link>
        <button
          ref={menuButton}
          className="menu-button icon-button"
          aria-label={open ? "Close navigation" : "Open navigation"}
          aria-expanded={open}
          aria-controls="main-nav"
          onClick={() => setOpen(!open)}
        >
          <Menu className="menu-open-icon" aria-hidden="true" />
          <X className="menu-close-icon" aria-hidden="true" />
        </button>
        <nav
          ref={navigation}
          id="main-nav"
          className={open ? "navigation open" : "navigation"}
          aria-label="Main navigation"
          aria-hidden={mobile && !open ? true : undefined}
          inert={mobile && !open}
          onClick={(event) => {
            const link = event.target instanceof Element ? event.target.closest("a") : null;
            if (mobile && link) {
              setOpen(false);
              if (link.getAttribute("href") === location.pathname) menuButton.current?.focus({ preventScroll: true });
            }
          }}
        >
          <NavLink to="/" end>
            Home
          </NavLink>
          <NavLink to="/analyze">Analyze</NavLink>
          <NavLink to="/pest-guide">Pest Guide</NavLink>
          <NavLink to="/about">About</NavLink>
          {location.pathname === "/" && (
            <Link className="button nav-cta home-action motion-hover" to="/analyze">
              Get Started
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
export function PageHeading({
  eyebrow,
  title,
  children,
}: {
  eyebrow?: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="page-heading">
      {eyebrow && <p className="eyebrow">{eyebrow}</p>}
      <h1>{title}</h1>
      <p>{children}</p>
    </div>
  );
}
export function FeatureCard({
  number,
  icon: Icon,
  title,
  children,
  animated = false,
}: {
  number: string;
  icon: LucideIcon;
  title: string;
  children: React.ReactNode;
  animated?: boolean;
}) {
  return (
    <div className={animated ? "feature-card motion-fade-up motion-hover" : "feature-card"}
      style={animated ? staggerStyle(Number(number) - 1) : undefined}>
      <div className="feature-icon">
        <Icon size={28} strokeWidth={1.7} />
        <span>{number}</span>
      </div>
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}
export function HowItWorks({ animated = false }: { animated?: boolean }) {
  return (
    <div className={animated ? "features motion-stagger" : "features"}>
      <FeatureCard number="01" icon={Camera} title="Upload or Capture" animated={animated}>
        Take a photo or upload an image of your rice crop.
      </FeatureCard>
      <FeatureCard number="02" icon={BrainCircuit} title="AI Analysis" animated={animated}>
        Our model analyzes crop damage patterns using deep learning.
      </FeatureCard>
      <FeatureCard number="03" icon={ClipboardCheck} title="Get Results" animated={animated}>
        Receive the most likely pest, confidence score, and damage details.
      </FeatureCard>
      <FeatureCard number="04" icon={Users} title="For Farmers & Agriculture" animated={animated}>
        Helps rice farmers, LGUs, and extension workers in identifying rice pests.
      </FeatureCard>
    </div>
  );
}
export function PestGuideCard({
  entry,
  compact = false,
}: {
  entry: GuideEntry;
  compact?: boolean;
}) {
  return (
    <article className={`guide-card motion-hover motion-section ${compact ? "compact" : ""}`}>
      <img className="motion-transition-transform" src={asset(entry.image)} alt={entry.alt} loading="lazy" />
      <div className="guide-card-content">
        <h2>
          {entry.name}
        </h2>
        <p>{entry.summary}</p>
      </div>
        <Link to={`/pest-guide/${entry.slug}`} className="detail-link">
          View Details <ChevronRight className="detail-arrow motion-transition-transform" size={16} aria-hidden="true" />
        </Link>
    </article>
  );
}
export function RouteFocus() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
    document.getElementById("main-content")?.focus({ preventScroll: true });
    const title =
      pathname === "/"
        ? "Rice Pest Identification"
        : pathname === "/analyze"
          ? "Analyze a Rice Crop"
          : pathname.startsWith("/pest-guide")
            ? "Pest Guide"
            : "About";
    document.title = `PESTPRINT — ${title}`;
  }, [pathname]);
  return null;
}
