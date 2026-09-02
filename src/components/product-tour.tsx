import { ChevronRight, Grid3X3, LayoutDashboard, Search, Sparkles, X } from 'lucide-react';
import { useRouter } from 'next/router';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';

const STEP_DURATION = 8_000;
const STEP_STORAGE_KEY = 'authy.product-tour.step';
const DISMISSED_STORAGE_KEY = 'authy.product-tour.dismissed';

const baseSteps = [
  {
    title: 'My apps',
    description: 'Launch every application assigned to you from one focused workspace.',
    href: '/',
    selector: 'nav[aria-label="Primary"] a[href="/"]',
    icon: Grid3X3,
  },
  {
    title: 'Marketplace',
    description: 'Discover approved tools and request access with context for your administrator.',
    href: '/marketplace',
    selector: 'nav[aria-label="Primary"] a[href="/marketplace"]',
    icon: Search,
  },
  {
    title: 'Spotlight search',
    description: 'Press Ctrl or Command plus K anywhere to find apps, people, and settings fast.',
    href: '/',
    selector: '[class*="sticky"] button[class*="max-w-xl"]',
    icon: Sparkles,
  },
] as const;

const adminStep = {
  title: 'Admin control plane',
  description: 'Review identity posture, access requests, applications, people, and policy.',
  href: '/admin',
  selector: 'nav[aria-label="Primary"] a[href="/admin"]',
  icon: LayoutDashboard,
} as const;

type HighlightRect = {
  top: number;
  right: number;
  bottom: number;
  left: number;
  width: number;
  height: number;
};

export function ProductTour({ active, admin = false }: { active: boolean; admin?: boolean }) {
  const router = useRouter();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const completionStarted = useRef(false);
  const steps = admin ? [...baseSteps, adminStep] : [...baseSteps];
  const [ready, setReady] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [highlight, setHighlight] = useState<HighlightRect>();
  const [progress, setProgress] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [error, setError] = useState('');
  const step = steps[Math.min(stepIndex, steps.length - 1)];

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updatePreference = () => setReducedMotion(media.matches);
    updatePreference();
    media.addEventListener('change', updatePreference);
    return () => media.removeEventListener('change', updatePreference);
  }, []);

  useEffect(() => {
    if (!active) {
      setReady(false);
      setDismissed(false);
      return;
    }
    const wasDismissed = sessionStorage.getItem(DISMISSED_STORAGE_KEY) === 'true';
    const savedStep = Number(sessionStorage.getItem(STEP_STORAGE_KEY));
    setDismissed(wasDismissed);
    setStepIndex(
      Number.isInteger(savedStep) && savedStep >= 0 ? Math.min(savedStep, steps.length - 1) : 0,
    );
    setReady(true);
  }, [active, steps.length]);

  const completeTour = useCallback(
    async (wasSkipped: boolean) => {
      if (completionStarted.current) return;
      completionStarted.current = true;
      setCompleting(true);
      setError('');
      try {
        const response = await fetch('/api/v1/account/onboarding-complete', { method: 'POST' });
        const body = (await response.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        if (!response.ok) {
          throw new Error(body?.error?.message ?? 'Unable to save tour progress.');
        }

        sessionStorage.removeItem(STEP_STORAGE_KEY);
        sessionStorage.setItem(DISMISSED_STORAGE_KEY, 'true');
        setDismissed(true);
        const query = { ...router.query };
        delete query.tour;
        delete query.tourStep;
        await router.replace({ pathname: router.pathname, query }, undefined, { shallow: true });
      } catch (completionError) {
        setError(
          completionError instanceof Error
            ? completionError.message
            : wasSkipped
              ? 'Unable to skip the tour.'
              : 'Unable to finish the tour.',
        );
      } finally {
        completionStarted.current = false;
        setCompleting(false);
      }
    },
    [router],
  );

  const advance = useCallback(() => {
    if (stepIndex >= steps.length - 1) {
      void completeTour(false);
      return;
    }
    const nextStep = stepIndex + 1;
    sessionStorage.setItem(STEP_STORAGE_KEY, String(nextStep));
    setStepIndex(nextStep);
  }, [completeTour, stepIndex, steps.length]);

  useEffect(() => {
    if (!active || !ready || dismissed || completing) return;
    setProgress(0);
    const startedAt = Date.now();
    const progressTimer = window.setInterval(() => {
      setProgress(Math.min(100, ((Date.now() - startedAt) / STEP_DURATION) * 100));
    }, 100);
    const advanceTimer = window.setTimeout(advance, STEP_DURATION);
    return () => {
      window.clearInterval(progressTimer);
      window.clearTimeout(advanceTimer);
    };
  }, [active, advance, completing, dismissed, ready]);

  useEffect(() => {
    if (!active || !ready || dismissed || !router.isReady) return;
    let cancelled = false;
    let findTimer: number | undefined;
    let attempts = 0;

    function measure(target: Element) {
      const rect = target.getBoundingClientRect();
      setHighlight({
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      });
    }

    function findTarget() {
      if (cancelled) return;
      const target = document.querySelector(step.selector);
      if (!target && attempts < 30) {
        attempts += 1;
        findTimer = window.setTimeout(findTarget, 100);
        return;
      }
      if (!target) {
        setHighlight(undefined);
        return;
      }
      target.scrollIntoView({
        block: 'center',
        behavior: reducedMotion ? 'auto' : 'smooth',
      });
      measure(target);
    }

    async function navigateAndMeasure() {
      setHighlight(undefined);
      if (router.pathname !== step.href || router.query.tour !== '1') {
        const navigated = await router.push({ pathname: step.href, query: { tour: '1' } });
        if (!navigated || cancelled) return;
      }
      findTimer = window.setTimeout(findTarget, reducedMotion ? 0 : 180);
    }

    const updateHighlight = () => {
      const target = document.querySelector(step.selector);
      if (target) measure(target);
    };
    window.addEventListener('resize', updateHighlight);
    window.addEventListener('scroll', updateHighlight, true);
    void navigateAndMeasure();
    return () => {
      cancelled = true;
      if (findTimer !== undefined) window.clearTimeout(findTimer);
      window.removeEventListener('resize', updateHighlight);
      window.removeEventListener('scroll', updateHighlight, true);
    };
  }, [active, dismissed, ready, reducedMotion, router, step.href, step.selector]);

  useEffect(() => {
    if (!active || dismissed || !ready) return;
    headingRef.current?.focus({ preventScroll: true });
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') void completeTour(true);
      if (event.key === 'ArrowRight') advance();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [active, advance, completeTour, dismissed, ready, stepIndex]);

  if (!active || !ready || dismissed) return null;

  const Icon = step.icon;
  const pad = 8;
  const viewportWidth = typeof window === 'undefined' ? 0 : window.innerWidth;
  const viewportHeight = typeof window === 'undefined' ? 0 : window.innerHeight;
  const top = Math.max(0, (highlight?.top ?? 0) - pad);
  const left = Math.max(0, (highlight?.left ?? 0) - pad);
  const right = Math.min(viewportWidth, (highlight?.right ?? 0) + pad);
  const bottom = Math.min(viewportHeight, (highlight?.bottom ?? 0) + pad);
  const shadeStyle = { backgroundColor: 'rgb(2 6 23 / 0.74)' } as CSSProperties;

  return (
    <div className="pointer-events-none fixed inset-0 z-[90]" aria-live="polite">
      {highlight ? (
        <>
          <div className="fixed left-0 right-0 top-0" style={{ ...shadeStyle, height: top }} />
          <div
            className="fixed left-0"
            style={{ ...shadeStyle, top, width: left, height: Math.max(0, bottom - top) }}
          />
          <div
            className="fixed right-0"
            style={{
              ...shadeStyle,
              top,
              width: Math.max(0, viewportWidth - right),
              height: Math.max(0, bottom - top),
            }}
          />
          <div className="fixed bottom-0 left-0 right-0" style={{ ...shadeStyle, top: bottom }} />
          <div
            className="fixed rounded-xl border-2 border-violet-300 shadow-[0_0_0_4px_rgba(167,139,250,.22),0_0_34px_rgba(139,92,246,.45)] transition-all duration-300 motion-reduce:transition-none"
            style={{
              top,
              left,
              width: Math.max(0, right - left),
              height: Math.max(0, bottom - top),
            }}
          />
        </>
      ) : (
        <div className="fixed inset-0" style={shadeStyle} />
      )}

      <section
        aria-labelledby="product-tour-title"
        aria-modal="true"
        className="pointer-events-auto fixed bottom-4 left-4 right-4 overflow-hidden rounded-2xl border border-white/15 bg-[#121528] text-white shadow-2xl shadow-black/40 sm:bottom-6 sm:left-auto sm:right-6 sm:w-[390px]"
        role="dialog"
      >
        <div className="h-1 bg-white/10">
          <div
            className="h-full bg-violet-400 transition-[width] duration-150 motion-reduce:transition-none"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-violet-500/20 text-violet-300">
              <Icon aria-hidden="true" size={21} />
            </span>
            <button
              aria-label="Skip product tour"
              className="rounded-lg p-2 text-slate-400 transition hover:bg-white/10 hover:text-white motion-reduce:transition-none"
              disabled={completing}
              onClick={() => void completeTour(true)}
              type="button"
            >
              <X aria-hidden="true" size={18} />
            </button>
          </div>
          <p className="mt-5 text-xs font-bold uppercase tracking-[.18em] text-violet-300">
            Guided tour · {stepIndex + 1} of {steps.length}
          </p>
          <h2
            className="mt-2 text-xl font-semibold outline-none"
            id="product-tour-title"
            ref={headingRef}
            tabIndex={-1}
          >
            {step.title}
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-300">{step.description}</p>
          {error && (
            <p className="mt-3 text-sm text-red-300" role="alert">
              {error}
            </p>
          )}
          <div className="mt-5 flex items-center justify-between">
            <button
              className="text-sm font-medium text-slate-400 hover:text-white"
              disabled={completing}
              onClick={() => void completeTour(true)}
              type="button"
            >
              {error ? 'Try skip again' : 'Skip tour'}
            </button>
            <button
              className="inline-flex min-h-[40px] items-center gap-2 rounded-lg bg-violet-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-400 disabled:opacity-60 motion-reduce:transition-none"
              disabled={completing}
              onClick={advance}
              type="button"
            >
              {completing ? 'Saving...' : stepIndex === steps.length - 1 ? 'Finish tour' : 'Next'}
              {!completing && <ChevronRight aria-hidden="true" size={16} />}
            </button>
          </div>
          <ol className="mt-5 flex gap-1.5" aria-label="Tour progress">
            {steps.map((tourStep, index) => (
              <li
                aria-current={index === stepIndex ? 'step' : undefined}
                className={`h-1.5 flex-1 rounded-full transition-colors motion-reduce:transition-none ${
                  index <= stepIndex ? 'bg-violet-400' : 'bg-white/15'
                }`}
                key={tourStep.title}
              >
                <span className="sr-only">
                  {tourStep.title}:{' '}
                  {index < stepIndex ? 'complete' : index === stepIndex ? 'current' : 'upcoming'}
                </span>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </div>
  );
}
