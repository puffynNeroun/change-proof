import { useEffect, useRef } from 'react';
import { EvidenceTraceCalibration } from './v9-lab/EvidenceTraceCalibration';
import { CapabilitiesCalibration } from './v9-lab/CapabilitiesCalibration';
import './post-hero.css';

/** Motion adds registration cues to the already complete, readable markup. */
function useEntryMotion() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const page = ref.current;
    if (!page || !('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const sections = page.querySelectorAll<HTMLElement>('.v9-evidence-trace, .v9-capabilities');
    const targets: HTMLElement[] = [];
    sections.forEach((section) => {
      section.dataset.entry = 'pending';
      section.querySelectorAll<HTMLElement>('.v9-evidence-trace__intro, .v9-evidence-trace__row, .v9-capabilities__intro, .v9-capabilities__band').forEach((element) => {
        element.dataset.reveal = 'pending';
        targets.push(element);
      });
    });

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const element = entry.target as HTMLElement;
        element.closest<HTMLElement>('.v9-evidence-trace, .v9-capabilities')?.setAttribute('data-entry', 'active');
        element.dataset.reveal = 'resolved';
        observer.unobserve(element);
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -8% 0px' });
    targets.forEach((element) => observer.observe(element));

    return () => {
      observer.disconnect();
      targets.forEach((element) => { delete element.dataset.reveal; });
      sections.forEach((section) => { delete section.dataset.entry; });
    };
  }, []);

  return ref;
}

export function PostHeroContent() {
  const ref = useEntryMotion();
  return <div className="v9-post-hero" ref={ref}>
    <EvidenceTraceCalibration embedded />
    <CapabilitiesCalibration embedded />
  </div>;
}
