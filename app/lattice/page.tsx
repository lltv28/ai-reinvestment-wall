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

const OVERVIEW_ZOOM = 1.12;
const TRIAGER_ZOOM = 1.3;

export default function LatticePage() {
  const fit = useFitStage();
  useRecordingChrome('#F1F4F2');
  const [frame, setFrame] = useState<ReinvestmentFrame>(IDLE_REINVESTMENT_FRAME);

  const dependencies = useMemo<VisualizerDependencies>(
    () => ({ onReinvestmentUpdate: setFrame }),
    [],
  );
  const handleReady = useCallback(() => {}, []);
  const sceneZoom = frame.phase === 'idle' ? OVERVIEW_ZOOM : TRIAGER_ZOOM;

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
        <section
          style={{
            width: '100%',
            height: '100%',
            position: 'relative',
            overflow: 'hidden',
            transform: `scale(${sceneZoom})`,
            transformOrigin: 'center center',
            transition: 'transform 900ms cubic-bezier(0.16, 1, 0.3, 1)',
            willChange: 'transform',
          }}
        >
          <LatticeCanvas onReady={handleReady} dependencies={dependencies} />
          <AssessmentPhone frame={frame} />
        </section>
      </div>
    </main>
  );
}
