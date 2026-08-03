'use client';

import dynamic from 'next/dynamic';
import { useCallback, useMemo, useState } from 'react';
import { AssessmentPhone } from '@/components/lattice/AssessmentPhone';
import { ScoreboardRail } from '@/components/rail/ScoreboardRail';
import {
  BASE_CALLS,
  BASE_PURCHASES,
  BASE_REVENUE,
  STAGE_H,
  STAGE_W,
  UPSELL_PCT,
  useFitStage,
  useLiveTally,
  useRecordingChrome,
} from '@/lib/adStage';
import type { VisualizerDependencies } from '@/lib/lattice/createVisualizerApp';
import {
  IDLE_REINVESTMENT_FRAME,
  PAYMENT_PARTICLE_COUNT,
  REINVESTMENT_VALUE_USD,
  type ReinvestmentFrame,
} from '@/lib/lattice/reinvestment';

const LatticeCanvas = dynamic(
  () => import('@/components/lattice/LatticeCanvas').then((module) => module.LatticeCanvas),
  { ssr: false },
);

const PAD = 40;
const RAIL_W = 360;
const COL_GAP = 40;
const AMBIENT_FIRST_LEAD_NO = 200;

export default function LatticePage() {
  const fit = useFitStage();
  useRecordingChrome('#F1F4F2');
  const { tally, feed } = useLiveTally({
    baseRevenue: BASE_REVENUE,
    basePurchases: BASE_PURCHASES,
    baseCalls: BASE_CALLS,
    feedStartLeadNo: AMBIENT_FIRST_LEAD_NO,
  });
  const [frame, setFrame] = useState<ReinvestmentFrame>(IDLE_REINVESTMENT_FRAME);

  const dependencies = useMemo<VisualizerDependencies>(
    () => ({ onReinvestmentUpdate: setFrame }),
    [],
  );
  const handleReady = useCallback(() => {}, []);

  const completedCycles = Math.max(0, frame.cycle - 1);
  const displayRevenue =
    tally.revenue + completedCycles * REINVESTMENT_VALUE_USD + frame.collectedUsd;
  const displayPurchases =
    tally.purchases + completedCycles * PAYMENT_PARTICLE_COUNT + frame.collectedPayments;

  return (
    <main
      style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          width: `${STAGE_W}px`,
          height: `${STAGE_H}px`,
          transform: `scale(${fit})`,
          transformOrigin: 'center center',
          flexShrink: 0,
          padding: `${PAD}px`,
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'row',
          gap: `${COL_GAP}px`,
          background: '#F7F8F7',
          position: 'relative',
        }}
      >
        <ScoreboardRail
          revenue={displayRevenue}
          purchases={displayPurchases}
          calls={tally.calls}
          upsellPct={UPSELL_PCT}
          feed={feed}
          width={RAIL_W}
        />

        <section style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          <LatticeCanvas onReady={handleReady} dependencies={dependencies} />

          <div
            style={{
              position: 'absolute',
              left: 28,
              top: 24,
              pointerEvents: 'none',
              zIndex: 3,
            }}
          >
            <div
              style={{
                color: '#2E7D52',
                fontSize: 13,
                fontWeight: 600,
                letterSpacing: '1.8px',
              }}
            >
              AI TRIAGERS
            </div>
            <div style={{ color: '#14201B', fontSize: 24, fontWeight: 600, marginTop: 6 }}>
              Cold stranger → $17 assessment → qualified lead
            </div>
          </div>

          <AssessmentPhone frame={frame} />
        </section>
      </div>
    </main>
  );
}
