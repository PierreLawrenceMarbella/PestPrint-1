import { useEffect, useRef } from "react";

/** Reveal marked sections once, on their existing elements, without layout wrappers. */
export function useSectionReveals(key?: string) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const container = root.current;
    if (!container || typeof IntersectionObserver === "undefined") return;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sections = [...container.querySelectorAll<HTMLElement>(".motion-section")];
    const pending = new Set<HTMLElement>();
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) reveal(entry.target as HTMLElement);
      }
    }, { threshold: 0.05, rootMargin: "0px 0px -20px 0px" });

    function reveal(section: HTMLElement) {
      if (!pending.delete(section)) return;
      section.classList.remove("motion-reveal-pending");
      section.classList.add("motion-fade-up");
      observer.unobserve(section);
      if (!pending.size) observer.disconnect();
    }
    function focus(event: FocusEvent) {
      const section = event.target instanceof Element ? event.target.closest<HTMLElement>(".motion-section") : null;
      if (section && pending.has(section)) reveal(section);
    }
    function reduce() {
      if (!preference.matches) return;
      observer.disconnect();
      pending.clear();
      sections.forEach(section => section.classList.remove("motion-reveal-pending", "motion-fade-up"));
    }

    // Content is visible by default. Only sections below the viewport are armed.
    if (!preference.matches) {
      for (const section of sections) {
        const bounds = section.getBoundingClientRect();
        if (section.matches(":focus-within")) continue;
        if (bounds.top >= window.innerHeight) {
          pending.add(section);
          section.classList.add("motion-reveal-pending");
          observer.observe(section);
        } else if (bounds.bottom > 0) {
          section.classList.add("motion-fade-up");
        }
      }
    }
    container.addEventListener("focusin", focus);
    preference.addEventListener("change", reduce);
    return () => {
      observer.disconnect();
      pending.clear();
      container.removeEventListener("focusin", focus);
      preference.removeEventListener("change", reduce);
      sections.forEach(section => section.classList.remove("motion-reveal-pending", "motion-fade-up"));
    };
  }, [key]);
  return root;
}
