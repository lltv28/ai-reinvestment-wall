'use client';

import { C, R, TYPE, W } from '@/lib/adStage';
import type { ReinvestmentFrame, ReinvestmentPhase } from '@/lib/lattice/reinvestment';

const PHASE_COPY: Record<ReinvestmentPhase, { eyebrow: string; title: string; detail: string }> = {
  idle: {
    eyebrow: 'AI TRIAGERS',
    title: 'Profit reinvestment',
    detail: 'Click AI Triagers to replay the loop.',
  },
  focus: {
    eyebrow: 'AI TRIAGERS ONLINE',
    title: 'Watching every conversion',
    detail: 'The system identifies captured revenue across this lead cluster.',
  },
  collect: {
    eyebrow: 'CAPTURING PAYMENTS',
    title: 'Profit flows back in',
    detail: 'Every green pulse is a payment returning to the AI Triagers.',
  },
  aggregate: {
    eyebrow: 'PROFIT POOLED',
    title: 'Ready to reinvest',
    detail: 'The AI Triagers combine the captured value into one decision.',
  },
  brain: {
    eyebrow: 'AI BRAIN',
    title: 'Capital meets intelligence',
    detail: 'The AI Brain decides where the next dollar creates the most growth.',
  },
  ads: {
    eyebrow: 'REINVESTING INTO ADS',
    title: 'The loop funds itself',
    detail: 'One larger pulse sends the captured profit back into acquisition.',
  },
  grow: {
    eyebrow: 'NEW DEMAND CREATED',
    title: 'More leads enter the lattice',
    detail: 'Reinvested profit creates four new lead paths around Ads.',
  },
  complete: {
    eyebrow: 'FLYWHEEL COMPLETE',
    title: 'Growth compounds',
    detail: 'Click AI Triagers to run the reinvestment loop again.',
  },
};

const STEP_PHASES: ReinvestmentPhase[][] = [
  ['focus', 'collect', 'aggregate'],
  ['brain'],
  ['ads', 'grow', 'complete'],
];

function phaseRank(phase: ReinvestmentPhase): number {
  return ['idle', 'focus', 'collect', 'aggregate', 'brain', 'ads', 'grow', 'complete'].indexOf(
    phase,
  );
}

export function ReinvestmentPanel({ frame }: { frame: ReinvestmentFrame }) {
  const copy = PHASE_COPY[frame.phase];
  const visible = frame.phase !== 'idle';
  const currentRank = phaseRank(frame.phase);

  return (
    <aside
      aria-hidden={!visible}
      style={{
        position: 'absolute',
        right: 16,
        top: 176,
        width: 392,
        padding: 24,
        boxSizing: 'border-box',
        border: `1px solid ${C.border}`,
        borderRadius: R.lg,
        background: 'rgba(255,255,255,0.96)',
        boxShadow: C.cardShadow,
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(12px)',
        transition: 'opacity 520ms ease, transform 620ms cubic-bezier(0.16, 1, 0.3, 1)',
        pointerEvents: 'none',
        zIndex: 6,
      }}
    >
      <div
        style={{
          color: C.green,
          fontSize: TYPE.xs,
          fontWeight: W.semibold,
          letterSpacing: '1.8px',
          marginBottom: 10,
        }}
      >
        {copy.eyebrow}
      </div>
      <div style={{ color: C.ink, fontSize: 28, fontWeight: W.semibold, lineHeight: 1.08 }}>
        {copy.title}
      </div>
      <div
        style={{
          color: C.muted,
          fontSize: TYPE.sm,
          lineHeight: 1.45,
          marginTop: 10,
          minHeight: 46,
        }}
      >
        {copy.detail}
      </div>

      <div
        style={{
          marginTop: 20,
          padding: '18px 20px',
          borderRadius: R.card,
          background: '#F4F8F5',
          border: '1px solid rgba(46,125,82,0.14)',
        }}
      >
        <div style={{ color: C.muted, fontSize: 13, fontWeight: W.medium, letterSpacing: '1px' }}>
          PROFIT CAPTURED
        </div>
        <div
          style={{
            marginTop: 4,
            color: C.green,
            fontSize: 42,
            fontWeight: W.semibold,
            letterSpacing: '-1.5px',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          ${frame.collectedUsd.toLocaleString()}
        </div>
        <div style={{ color: C.muted, fontSize: 14, marginTop: 2 }}>
          {frame.collectedPayments} payments · {frame.generatedLeads} new lead paths
        </div>
      </div>

      <div style={{ display: 'grid', gap: 10, marginTop: 18 }}>
        {[
          'Leads → AI Triagers',
          'AI Triagers → AI Brain',
          'AI Brain → Ads',
        ].map((label, index) => {
          const activePhases = STEP_PHASES[index]!;
          const active = activePhases.includes(frame.phase);
          const firstRank = phaseRank(activePhases[0]!);
          const complete = currentRank > phaseRank(activePhases[activePhases.length - 1]!);
          const reached = active || complete || currentRank >= firstRank;
          return (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 999,
                  background: reached ? C.green : C.border,
                  boxShadow: active ? '0 0 0 5px rgba(46,125,82,0.12)' : 'none',
                  transition: 'background 240ms ease, box-shadow 240ms ease',
                }}
              />
              <span style={{ color: reached ? C.ink : C.muted, fontSize: 15 }}>{label}</span>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
