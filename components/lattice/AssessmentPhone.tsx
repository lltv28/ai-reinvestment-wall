'use client';

import { useEffect, useState } from 'react';
import { C } from '@/lib/adStage';
import {
  REINVESTMENT_TIMING,
  type AssessmentPhoneScreen,
  type ReinvestmentFrame,
} from '@/lib/lattice/reinvestment';

const PHONE_COUNT = 9;
const ASSESSMENT_STAGES: AssessmentPhoneScreen[] = [
  'landing',
  'question',
  'plan',
  'checkout',
  'paid',
];
const PHONE_STAGE_DURATION_MS = 3_000;
const PHONE_STAGE_DELAYS_MS = [0, 333, 666, 999, 1_332, 1_665, 1_998, 2_331, 2_664] as const;
const PHONE_START_STAGES = [0, 2, 1, 3, 4, 1, 0, 4, 2] as const;

function miniPhoneScreen(
  phoneIndex: number,
  motionElapsedMs: number,
): AssessmentPhoneScreen {
  const stageDelayMs = PHONE_STAGE_DELAYS_MS[phoneIndex] ?? 0;
  const initialStage = PHONE_START_STAGES[phoneIndex] ?? 0;
  const completedStages = Math.floor(
    (motionElapsedMs + stageDelayMs) / PHONE_STAGE_DURATION_MS,
  );
  const stageIndex = (initialStage + completedStages) % ASSESSMENT_STAGES.length;

  return ASSESSMENT_STAGES[stageIndex] ?? 'landing';
}

function MiniPhoneContent({ screen }: { screen: AssessmentPhoneScreen }) {
  if (screen === 'landing') {
    return (
      <>
        <span className="mini-kicker">ASSESSMENT</span>
        <strong className="mini-title">Find your growth gap</strong>
        <div className="mini-price">$17</div>
        <div className="mini-button">Start</div>
      </>
    );
  }

  if (screen === 'question') {
    return (
      <>
        <div className="mini-progress"><i /></div>
        <strong className="mini-title">Biggest bottleneck?</strong>
        <div className="mini-choice" />
        <div className="mini-choice selected" />
        <div className="mini-choice" />
      </>
    );
  }

  if (screen === 'plan') {
    return (
      <>
        <span className="mini-check">✓</span>
        <span className="mini-kicker">PLAN READY</span>
        <strong className="mini-title">Qualification is the gap</strong>
        <div className="mini-result" />
        <div className="mini-result short" />
      </>
    );
  }

  if (screen === 'checkout') {
    return (
      <>
        <span className="mini-kicker">CHECKOUT</span>
        <strong className="mini-title">Unlock your plan</strong>
        <div className="mini-order"><span>Assessment</span><b>$17</b></div>
        <div className="mini-card-field" />
        <div className="mini-button">Pay $17</div>
      </>
    );
  }

  if (screen === 'paid') {
    return (
      <div className="mini-centered">
        <span className="mini-check large">✓</span>
        <span className="mini-kicker">PAYMENT</span>
        <strong className="mini-paid">$17 PAID</strong>
        <small>Qualified buyer</small>
      </div>
    );
  }

  if (screen === 'funding') {
    return (
      <div className="mini-centered">
        <span className="mini-ad">AD</span>
        <strong className="mini-paid">+$8</strong>
        <small>Reinvesting</small>
      </div>
    );
  }

  return (
    <div className="mini-centered">
      <span className="mini-check large">✓</span>
      <strong className="mini-paid">READY</strong>
      <small>Next lead funded</small>
    </div>
  );
}

export function AssessmentPhone({ frame }: { frame: ReinvestmentFrame }) {
  const visible =
    frame.cycle > 1 ||
    (frame.cycle === 1 && frame.elapsedMs >= REINVESTMENT_TIMING.phoneReveal);
  const [motionElapsedMs, setMotionElapsedMs] = useState(0);

  useEffect(() => {
    if (!visible) return;
    const interval = window.setInterval(() => {
      setMotionElapsedMs((elapsedMs) => elapsedMs + 250);
    }, 250);
    return () => window.clearInterval(interval);
  }, [visible]);

  return (
    <aside
      aria-hidden={!visible}
      data-visible={visible}
      style={{
        position: 'absolute',
        right: 518,
        top: 303,
        width: 282,
        height: 454,
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 86px)',
        gridTemplateRows: 'repeat(3, 142px)',
        gap: '14px 12px',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0) scale(1)' : 'translateY(18px) scale(0.97)',
        transition: 'opacity 500ms ease, transform 650ms cubic-bezier(0.16, 1, 0.3, 1)',
        pointerEvents: 'none',
        zIndex: 6,
      }}
    >
      {Array.from({ length: PHONE_COUNT }, (_, index) => {
        const phoneScreen = miniPhoneScreen(index, motionElapsedMs);

        return (
          <div
            className="mini-phone"
            key={index}
            style={{ transitionDelay: visible ? `${index * 35}ms` : '0ms' }}
          >
            <div className="mini-speaker" />
            <div className="mini-screen">
              <header><span>K</span><i /></header>
              <div key={phoneScreen} className="mini-content">
                <MiniPhoneContent screen={phoneScreen} />
              </div>
              <div className="mini-home" />
            </div>
          </div>
        );
      })}

      <style jsx global>{`
        .mini-phone { position:relative; width:86px; height:142px; padding:4px; box-sizing:border-box; border-radius:16px; background:#151917; box-shadow:0 10px 22px rgba(20,32,27,.13), 0 2px 7px rgba(20,32,27,.1); opacity:0; transform:translateY(10px) scale(.94); transition:opacity 420ms ease, transform 520ms cubic-bezier(.16,1,.3,1); }
        [data-visible="true"] .mini-phone { opacity:1; transform:translateY(0) scale(1); }
        .mini-speaker { position:absolute; z-index:3; top:4px; left:50%; width:24px; height:7px; border-radius:0 0 5px 5px; background:#151917; transform:translateX(-50%); }
        .mini-screen { position:relative; height:100%; overflow:hidden; border-radius:12px; background:#fbfcfb; color:${C.ink}; }
        .mini-screen header { height:18px; display:flex; align-items:center; gap:4px; padding:0 5px; border-bottom:1px solid ${C.border}; background:#fff; }
        .mini-screen header span { width:10px; height:10px; display:grid; place-items:center; border-radius:3px; color:#fff; background:${C.green}; font-size:5px; font-weight:700; }
        .mini-screen header i { width:18px; height:2px; border-radius:99px; background:${C.border}; }
        .mini-content { position:absolute; inset:18px 0 0; padding:10px 7px 12px; box-sizing:border-box; animation:miniScreenIn 360ms cubic-bezier(.16,1,.3,1) both; }
        @keyframes miniScreenIn { from { opacity:0; transform:translateX(5px); } to { opacity:1; transform:translateX(0); } }
        .mini-kicker { display:block; margin-bottom:4px; color:${C.green}; font-size:4.5px; font-weight:700; letter-spacing:.55px; }
        .mini-title { display:block; font-size:8px; line-height:1.04; letter-spacing:-.15px; }
        .mini-price { margin-top:10px; padding:7px 5px; border-radius:6px; background:#eef7f1; color:${C.green}; font-size:14px; font-weight:700; }
        .mini-button { margin-top:7px; padding:5px 4px; border-radius:5px; background:${C.green}; color:#fff; font-size:5px; font-weight:700; text-align:center; }
        .mini-progress { height:2px; margin-bottom:9px; border-radius:99px; background:#e5ebe7; }
        .mini-progress i { display:block; width:80%; height:100%; border-radius:inherit; background:${C.green}; }
        .mini-choice { height:10px; margin-top:5px; border:1px solid ${C.border}; border-radius:4px; background:#fff; }
        .mini-choice.selected { border-color:${C.green}; background:#eef7f1; }
        .mini-check { width:13px; height:13px; display:grid; place-items:center; margin-bottom:4px; border-radius:50%; color:#fff; background:${C.green}; font-size:7px; font-weight:700; }
        .mini-check.large { width:24px; height:24px; margin:0 auto 7px; font-size:13px; box-shadow:0 0 0 5px rgba(46,125,82,.08); }
        .mini-result { height:12px; margin-top:6px; border-radius:4px; background:#eef7f1; }
        .mini-result.short { width:72%; }
        .mini-order { display:flex; justify-content:space-between; margin-top:9px; padding:6px 4px; border-radius:5px; background:#eef7f1; font-size:4.5px; }
        .mini-order b { color:${C.green}; }
        .mini-card-field { height:11px; margin-top:5px; border:1px solid ${C.border}; border-radius:4px; background:#fff; }
        .mini-centered { padding-top:14px; text-align:center; }
        .mini-centered .mini-kicker { text-align:center; }
        .mini-paid { display:block; color:${C.green}; font-size:10px; line-height:1.1; }
        .mini-centered small { display:block; margin-top:4px; color:${C.muted}; font-size:5px; }
        .mini-ad { width:26px; height:26px; display:grid; place-items:center; margin:0 auto 8px; border-radius:7px; background:${C.green}; color:#fff; font-size:7px; font-weight:700; box-shadow:0 0 0 5px rgba(46,125,82,.08); }
        .mini-home { position:absolute; bottom:3px; left:50%; width:24px; height:1.5px; border-radius:99px; background:#151917; transform:translateX(-50%); opacity:.75; }
      `}</style>
    </aside>
  );
}
