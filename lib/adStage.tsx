'use client';

// Shared engine for the 9:16 ad recording stages (app/ad/*). Every variant
// reuses the same fixed vertical stage, the same simulated revenue cadence, and
// the same auto-playing funnel iframes, so the five concepts stay visually and
// behaviorally coherent — only the framing/layout differs per route.

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createSeededRandom } from '@/lib/demoAuto';
import { BASE_PATH } from '@/lib/basePath';

// ── Fixed landscape recording stage (16:9) ──────────────────────────────
export const STAGE_W = 1920;
export const STAGE_H = 1080;

// ── Funnel economics (mirrors the real low-ticket funnel) ───────────────
export const PRICE_USD = 27; // low-ticket report
export const UPSELL_PRICE_USD = 240; // upsell taken by some buyers
export const UPSELL_PCT = 35; // % of purchases that take the upsell

// ── Sale-notification price points (rotated for variety, not always $27) ──────
export const SALE_PRICES = [17, 97, 297, 1497, 497] as const;
const SALE_LABEL: Record<number, string> = { 17: '$17', 97: '$97', 297: '$297/mo', 1497: '$1,497', 497: '$497' };
export function saleLabel(v: number): string {
  return SALE_LABEL[v] ?? `$${v.toLocaleString()}`;
}
// Weighted toward low-ticket so the running revenue total grows realistically.
export function randomSalePrice(): number {
  const r = Math.random();
  return r < 0.42 ? 17 : r < 0.80 ? 97 : r < 0.92 ? 297 : r < 0.975 ? 497 : 1497;
}

// Realistic daily baseline: ~60 sales, ~24 calls booked, ~$4–5k revenue.
export const BASE_PURCHASES = 56;
export const BASE_CALLS = 24;
export const BASE_REVENUE = 4200;

// ── Design-system tokens (sourced from app/globals.css) ──────────────────
// The funnel app's real system: light surfaces, Instrument Sans, brand green,
// neutral inks, red for errors only. NO blue / neon / monospace. Every ad stage
// pulls from here so the chrome reads as the same product as the funnels inside.
export const C = {
  appBg: '#F6F6F7', // html/body background
  card: '#ffffff',
  border: '#e5e5e8', // ~neutral-200
  ink: '#1A1A1A', // text base (--text-rgb 26,26,26)
  muted: 'rgba(26,26,26,0.60)', // --alpha-light-600 (body text)
  faint: 'rgba(26,26,26,0.36)', // --alpha-light-400
  slate: '#404040', // neutral-700 secondary text
  subtle: '#fafafa', // neutral-50 inset surface
  green: '#2E7D52', // brand / CTA / buy / revenue
  greenHover: '#256B45',
  greenBright: '#2E7D52', // alias kept on-system (no neon green)
  blue: '#404040', // "booked" → neutral ink (system has no blue)
  blueBright: '#404040',
  red: '#dc2626', // semantic error only
  ctaGradient: 'linear-gradient(to bottom, #3A9B68, #2E7D52)',
  // --shadow-card (dropping the all-zero layers)
  cardShadow: '0px 8px 5px 0px rgba(0,0,0,0.01), 0px 4px 4px 0px rgba(0,0,0,0.02), 0px 1px 2px 0px rgba(0,0,0,0.02)',
};

// Instrument Sans is applied to <body> by the root layout via next/font; the
// generated family name isn't referenceable by string, so stages inherit it.
export const FONT = 'inherit';

// Radii observed across funnel components (10 / 12 / 14 / 16px).
export const R = { sm: '10px', card: '14px', lg: '16px' };

// Type scale + loaded weights (Instrument Sans loads 400/500/600 only).
export const TYPE = { xs: 14, sm: 16, base: 18, lg: 20, xl: 24, display: 40 };
export const W = { normal: 400, medium: 500, semibold: 600 };

export type Lead = { id: number; seed: number };
export type Outcome = { outcome: 'buy' | 'book'; valueUsd: number };
export type FeedEvent = { key: number; leadNo: number; outcome: 'buy' | 'book'; valueUsd: number };

// ── Leads ────────────────────────────────────────────────────────────────
export function createLeads(count: number): Lead[] {
  return Array.from({ length: count }, (_, index) => ({ id: index, seed: 7000 + index * 37 }));
}

// ── Per-agent stat snapshot, seeded. Distributes realistic DAY TOTALS across
// however many agents a demo shows: ~60 sales, ~24 calls booked, ~$4.5k revenue,
// with a 30–50% calls-to-sales ratio per agent (stochastic rounding keeps the
// totals on target whether there are 5 agents or 64). ──
const DAY_SALES = 60;
export function makeAgentStats(count: number, seed = 909): { sales: number; calls: number; revenue: number }[] {
  const rnd = createSeededRandom(seed);
  const stoch = (x: number) => Math.floor(x) + (rnd() < x - Math.floor(x) ? 1 : 0);
  const weights = Array.from({ length: count }, () => 0.5 + rnd());
  const wsum = weights.reduce((a, b) => a + b, 0);
  return weights.map((w) => {
    const sales = stoch((DAY_SALES * w) / wsum);
    const calls = stoch(sales * (0.30 + rnd() * 0.20));   // 30–50% of this agent's sales
    const perSale = 55 + rnd() * 40;                       // ~$55–95 → ~$4.5k total
    return { sales, calls, revenue: Math.round(sales * perSale) };
  });
}

// Compact money label: $940 / $1.2k
export function money(n: number): string {
  return n >= 1000 ? `$${(n / 1000).toFixed(1)}k` : `$${n}`;
}

// Evenly spread funnel start steps so no two tiles begin on the same screen.
export function startSteps(count: number): number[] {
  return Array.from({ length: count }, (_, i) => 1 + Math.round((i * 13) / Math.max(1, count - 1)));
}

// ── Scale the fixed stage to fit the window (1:1 at STAGE_W×STAGE_H) ──────
export function useFitStage(stageW = STAGE_W, stageH = STAGE_H): number {
  const dims = useSyncExternalStore(
    (cb) => {
      window.addEventListener('resize', cb);
      return () => window.removeEventListener('resize', cb);
    },
    () => `${window.innerWidth}x${window.innerHeight}`,
    () => `${stageW}x${stageH}`,
  );
  const [w, h] = dims.split('x').map(Number);
  return Math.min(w / stageW, h / stageH);
}

// ── Is the viewport a phone (narrow / portrait)? Lets a stage swap its fixed
// 1920×1080 recording layout for a fluid mobile layout below `maxWidth`. SSR
// snapshot returns false (desktop) so markup is stable; the client corrects on
// mount (same hydration trade-off as useFitStage). ──
export function useIsMobile(maxWidth = 820): boolean {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(`(max-width: ${maxWidth}px)`);
      mq.addEventListener('change', cb);
      return () => mq.removeEventListener('change', cb);
    },
    () => window.matchMedia(`(max-width: ${maxWidth}px)`).matches,
    () => false,
  );
}

// ── Count a number up to each new target (easeOutCubic) ──────────────────
export function useCountUp(target: number, durationMs = 700): number {
  const [display, setDisplay] = useState(target);
  const displayRef = useRef(target);

  useEffect(() => {
    const from = displayRef.current;
    const to = target;
    if (from === to) return;
    let start: number | null = null;
    let raf = 0;
    const tick = (now: number) => {
      if (start === null) start = now;
      const t = Math.min(1, Math.max(0, (now - start) / durationMs));
      const eased = 1 - Math.pow(1 - t, 3);
      const value = from + (to - from) * eased;
      displayRef.current = value;
      setDisplay(value);
      if (t < 1) raf = requestAnimationFrame(tick);
      else { displayRef.current = to; setDisplay(to); }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs]);

  return display;
}

// ── Hide Next dev overlay + reset body so nothing floats on camera ───────
export function useRecordingChrome(letterbox: string) {
  useEffect(() => {
    const prevHtml = document.documentElement.style.cssText;
    const prevBody = document.body.style.cssText;
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    document.body.style.margin = '0';
    document.body.style.background = letterbox;

    const style = document.createElement('style');
    style.textContent = `
      nextjs-portal, .nextjs-toast-errors-parent, .nextjs-toast-errors,
      [data-nextjs-toast], [data-nextjs-dialog-overlay],
      nextjs-dev-toolbar { display: none !important; }
    `;
    document.head.appendChild(style);

    return () => {
      document.documentElement.style.cssText = prevHtml;
      document.body.style.cssText = prevBody;
      style.remove();
    };
  }, [letterbox]);
}

// ── Per-tile resolved outcomes from the funnel iframes (postMessage) ──────
// Returns a map of leadId -> Outcome. Clears a tile when its iframe restarts a
// run so a "Sold" badge never lingers over a mid-quiz screen.
export function useTileOutcomes(): Record<number, Outcome | undefined> {
  const [outcomes, setOutcomes] = useState<Record<number, Outcome | undefined>>({});
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const data = event.data;
      if (!data || data.source !== 'kdr-demo') return;
      const leadId = Number(data.leadId);
      if (!Number.isInteger(leadId) || leadId < 0) return;
      const outcome: 'buy' | 'book' = data.outcome === 'book' ? 'book' : 'buy';
      const valueUsd = outcome === 'buy' ? randomSalePrice() : 0;
      setOutcomes((prev) => ({ ...prev, [leadId]: { outcome, valueUsd } }));
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);
  return outcomes;
}

// ── Simulated live revenue tally + conversion feed ───────────────────────
// Runs on a fixed cadence so the stage always reads "live", independent of how
// fast any individual funnel happens to finish.
export function useLiveTally(opts?: {
  baseRevenue?: number;
  basePurchases?: number;
  baseCalls?: number;
  buyShare?: number; // fraction of conversions that are purchases
  minMs?: number;
  maxMs?: number;
  feedStartLeadNo?: number;
  feedLen?: number;
}) {
  const baseRevenue = opts?.baseRevenue ?? BASE_REVENUE;
  const basePurchases = opts?.basePurchases ?? BASE_PURCHASES;
  const baseCalls = opts?.baseCalls ?? BASE_CALLS;
  const buyShare = opts?.buyShare ?? 0.6;
  const minMs = opts?.minMs ?? 6000;
  const maxMs = opts?.maxMs ?? 8000;
  const feedLen = opts?.feedLen ?? 9;
  const feedStart = opts?.feedStartLeadNo ?? basePurchases + baseCalls + 80;

  const [tally, setTally] = useState({ purchases: basePurchases, calls: baseCalls, revenue: baseRevenue });
  const [feed, setFeed] = useState<FeedEvent[]>([]);
  const feedCounterRef = useRef(feedStart);
  const eventKeyRef = useRef(0);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const emit = () => {
      const isBuy = Math.random() < buyShare;
      const outcome: 'buy' | 'book' = isBuy ? 'buy' : 'book';
      const valueUsd = isBuy ? randomSalePrice() : 0;
      setTally((prev) => ({
        purchases: prev.purchases + (isBuy ? 1 : 0),
        calls: prev.calls + (isBuy ? 0 : 1),
        revenue: prev.revenue + valueUsd,
      }));
      const leadNo = feedCounterRef.current++;
      const key = eventKeyRef.current++;
      setFeed((prev) => [{ key, leadNo, outcome, valueUsd }, ...prev].slice(0, feedLen));
      timer = setTimeout(emit, minMs + Math.random() * (maxMs - minMs));
    };
    timer = setTimeout(emit, minMs + Math.random() * (maxMs - minMs));
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { tally, feed };
}

// ── Per-tile outcomes keeping the funnel's REAL sale value (postMessage). ──
// Used by the /hive/* stages: a badge on a tile must match what that tile's
// own screen shows (same rule as /live-wall). useTileOutcomes (above) instead
// substitutes randomSalePrice() and is kept as-is for the older /ad/* stages.
export function useRealTileOutcomes(): Record<number, Outcome | undefined> {
  const [outcomes, setOutcomes] = useState<Record<number, Outcome | undefined>>({});
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const data = event.data;
      if (!data || data.source !== 'kdr-demo') return;
      const leadId = Number(data.leadId);
      if (!Number.isInteger(leadId) || leadId < 0) return;
      const outcome: 'buy' | 'book' = data.outcome === 'book' ? 'book' : 'buy';
      const valueUsd = outcome === 'buy' ? Number(data.valueUsd) || PRICE_USD : 0;
      setOutcomes((prev) => ({ ...prev, [leadId]: { outcome, valueUsd } }));
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);
  return outcomes;
}

// ── Build a funnel iframe URL for one tile ───────────────────────────────
export function buildFunnelSrc(
  lead: Lead,
  index: number,
  opts: {
    count: number;
    demoScale?: number; // funnel content scale, 0.5–1 (clamped by App.tsx)
    speed?: number;
    answerSeed?: number;
    route?: string; // which surface to embed, e.g. '/use' for the member dashboard; '' = the quiz root
  },
): string {
  const random = createSeededRandom(lead.seed + (opts.answerSeed ?? 0));
  const steps = startSteps(opts.count);
  const demoStartAt = steps[index % steps.length];
  const answerDelay = 1150 + Math.floor(random() * 650);
  const loopDelay = 3500 + Math.floor(random() * 3000);

  const params = new URLSearchParams({
    demoAuto: '1',
    demoLeadId: String(lead.id),
    demoSeed: String(lead.seed),
    demoStartAt: String(demoStartAt),
    demoAnswerDelayMs: String(answerDelay),
    demoScale: String(opts.demoScale ?? 0.62),
    demoSpeed: String(opts.speed ?? 0.5),
    demoLoop: '1',
    demoLoopDelayMs: String(loopDelay),
    skipPaywallTimer: '1',
    hideDemoControls: '1',
  });

  return `${BASE_PATH}${opts.route ?? ''}/?${params.toString()}`;
}
