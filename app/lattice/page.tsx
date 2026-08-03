'use client';

import dynamic from 'next/dynamic';
import { useCallback, useMemo, useState } from 'react';
import { AssessmentPhone } from '@/components/lattice/AssessmentPhone';
import {
  STAGE_H,
  STAGE_W,
  useFitStage,
  useRecordingChrome,
} from '@/lib/adStage';
import type { VisualizerDependencies } from '@/lib/lattice/createVisualizerApp';
import {
  IDLE_REINVESTMENT_FRAME,
  type ReinvestmentFrame,
} from '@/lib/lattice/reinvestment';

const LatticeCanvas = dynamic(
  () => import('@/components/lattice/LatticeCanvas').then((module) => module.LatticeCanvas),
  { ssr: false },
);

export default function LatticePage() {
  const fit = useFitStage();
  useRecordingChrome('#F1F4F2');
  const [frame, setFrame] = useState<ReinvestmentFrame>(IDLE_REINVESTMENT_FRAME);

  const dependencies = useMemo<VisualizerDependencies>(
    () => ({ onReinvestmentUpdate: setFrame }),
    [],
  );
  const handleReady = useCallback(() => {}, []);

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
          background: '#F7F8F7',
          position: 'relative',
        }}
      >
        <section style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
          <LatticeCanvas onReady={handleReady} dependencies={dependencies} />

          <div
            style={{
              position: 'absolute',
              left: 420,
              top: 56,
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
