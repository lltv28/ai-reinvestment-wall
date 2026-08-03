'use client';

import { C, R, W } from '@/lib/adStage';
import {
  REINVESTMENT_TIMING,
  assessmentPhoneScreen,
  type AssessmentPhoneScreen,
  type ReinvestmentFrame,
} from '@/lib/lattice/reinvestment';

const pillStyle = {
  border: `1px solid ${C.border}`,
  borderRadius: 12,
  padding: '13px 14px',
  background: '#fff',
  color: C.ink,
  fontSize: 14,
  lineHeight: 1.25,
} as const;

function PhoneContent({ screen }: { screen: AssessmentPhoneScreen }) {
  if (screen === 'landing') {
    return (
      <>
        <div className="phone-kicker">2 MINUTE ASSESSMENT</div>
        <h2>Find what is really blocking your growth</h2>
        <p>Get an instant, personalized action plan built around your business.</p>
        <div className="hero-card">
          <span>AI Growth Assessment</span>
          <strong>$17</strong>
          <small>One-time payment</small>
        </div>
        <button>Start my assessment</button>
        <div className="trust">Personalized instantly · Secure checkout</div>
      </>
    );
  }

  if (screen === 'question') {
    return (
      <>
        <div className="step-row"><span>Question 4 of 5</span><span>80%</span></div>
        <div className="progress"><i /></div>
        <h2>What is the biggest bottleneck right now?</h2>
        <div className="choices">
          <div style={pillStyle}>Getting qualified leads</div>
          <div style={{ ...pillStyle, borderColor: C.green, background: '#F1F8F4' }}>Converting interest into buyers</div>
          <div style={pillStyle}>Delivering consistently</div>
        </div>
        <button>Continue</button>
      </>
    );
  }

  if (screen === 'plan') {
    return (
      <>
        <div className="success-mark">✓</div>
        <div className="phone-kicker">YOUR PERSONALIZED PLAN</div>
        <h2>Your offer is strong. Qualification is the gap.</h2>
        <p>Your answers show three immediate opportunities:</p>
        <div className="findings">
          <div><b>01</b><span>Filter out low-intent leads earlier</span></div>
          <div><b>02</b><span>Educate prospects before the call</span></div>
          <div><b>03</b><span>Reinvest each sale into acquisition</span></div>
        </div>
        <button>Unlock the full plan · $17</button>
      </>
    );
  }

  if (screen === 'checkout') {
    return (
      <>
        <div className="phone-kicker">SECURE CHECKOUT</div>
        <h2>Unlock your full action plan</h2>
        <div className="order">
          <div><span>AI Growth Assessment</span><strong>$17</strong></div>
          <small>Instant access · One-time payment</small>
        </div>
        <label>Card information</label>
        <div className="card-field">•••• •••• •••• 4242</div>
        <div className="split-fields"><span>12 / 28</span><span>123</span></div>
        <button>Get my personalized plan · $17</button>
        <div className="trust">🔒 Encrypted and secure</div>
      </>
    );
  }

  if (screen === 'paid') {
    return (
      <div className="center-state">
        <div className="success-mark large">✓</div>
        <div className="phone-kicker">PAYMENT CONFIRMED</div>
        <h2>You are serious about solving this.</h2>
        <p>Your personalized plan is unlocked. Your answers have already qualified your best next step.</p>
        <div className="receipt"><span>Assessment complete</span><strong>$17 paid</strong></div>
      </div>
    );
  }

  if (screen === 'funding') {
    return (
      <div className="center-state">
        <div className="orbit"><i /><span>AD</span></div>
        <div className="phone-kicker">THE LOOP REINVESTS</div>
        <h2>This sale funds the next qualified lead.</h2>
        <p>Profit is routed back into acquisition automatically.</p>
        <div className="funding-row"><span>Ad budget credited</span><strong>+$8</strong></div>
      </div>
    );
  }

  return (
    <div className="center-state">
      <div className="success-mark large">✓</div>
      <div className="phone-kicker">PLAN READY</div>
      <h2>Your next move is clear.</h2>
      <p>The AI Brain now has better intent data and the next lead is already being funded.</p>
      <button>View my action plan</button>
    </div>
  );
}

export function AssessmentPhone({ frame }: { frame: ReinvestmentFrame }) {
  const visible = frame.elapsedMs >= REINVESTMENT_TIMING.phoneReveal;
  const screen = assessmentPhoneScreen(frame);

  return (
    <aside
      aria-hidden={!visible}
      style={{
        position: 'absolute',
        right: 440,
        top: 150,
        width: 360,
        height: 760,
        padding: 11,
        boxSizing: 'border-box',
        borderRadius: 50,
        background: '#151917',
        boxShadow: '0 28px 70px rgba(20,32,27,0.20), 0 8px 22px rgba(20,32,27,0.12)',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0) scale(1)' : 'translateY(24px) scale(0.97)',
        transition: 'opacity 650ms ease, transform 650ms cubic-bezier(0.16, 1, 0.3, 1)',
        pointerEvents: 'none',
        zIndex: 6,
      }}
    >
      <div className="speaker" />
      <div className="phone-screen">
        <header><div className="brand-mark">K</div><span>Kodara AI</span><em>•••</em></header>
        <div key={screen} className="phone-content">
          <PhoneContent screen={screen} />
        </div>
        <div className="home-bar" />
      </div>

      <style jsx global>{`
        .speaker { position:absolute; z-index:3; top:17px; left:50%; width:92px; height:25px; border-radius:0 0 15px 15px; background:#151917; transform:translateX(-50%); }
        .phone-screen { position:relative; height:100%; overflow:hidden; border-radius:40px; background:#fbfcfb; color:${C.ink}; }
        .phone-screen header { height:62px; display:flex; align-items:center; gap:9px; padding:0 19px; border-bottom:1px solid ${C.border}; background:rgba(255,255,255,.96); }
        .phone-screen header span { font-size:14px; font-weight:${W.semibold}; }
        .phone-screen header em { margin-left:auto; color:${C.faint}; font-style:normal; letter-spacing:2px; }
        .brand-mark { width:27px; height:27px; display:grid; place-items:center; border-radius:8px; color:white; background:${C.green}; font-size:13px; font-weight:700; }
        .phone-content { position:absolute; inset:62px 0 0; padding:34px 24px 38px; box-sizing:border-box; animation:screenIn 620ms cubic-bezier(.16,1,.3,1) both; }
        @keyframes screenIn { from { opacity:0; transform:translateX(15px); } to { opacity:1; transform:translateX(0); } }
        .phone-kicker { margin-bottom:10px; color:${C.green}; font-size:11px; font-weight:700; letter-spacing:1.45px; }
        .phone-content h2 { margin:0; color:${C.ink}; font-size:25px; line-height:1.08; letter-spacing:-.65px; font-weight:${W.semibold}; }
        .phone-content p { margin:13px 0 0; color:${C.muted}; font-size:14px; line-height:1.48; }
        .phone-content button { width:100%; margin-top:20px; padding:15px 12px; border:0; border-radius:${R.card}; background:${C.green}; color:white; font-family:inherit; font-size:14px; font-weight:600; box-shadow:0 5px 12px rgba(46,125,82,.18); }
        .hero-card { display:flex; flex-direction:column; margin-top:25px; padding:21px; border:1px solid rgba(46,125,82,.18); border-radius:16px; background:#F1F8F4; }
        .hero-card span { font-size:14px; font-weight:600; }
        .hero-card strong { margin-top:8px; color:${C.green}; font-size:38px; line-height:1; }
        .hero-card small, .trust { color:${C.muted}; font-size:11px; }
        .hero-card small { margin-top:5px; }
        .trust { margin-top:13px; text-align:center; }
        .step-row { display:flex; justify-content:space-between; color:${C.muted}; font-size:12px; }
        .progress { height:5px; margin:9px 0 26px; overflow:hidden; border-radius:99px; background:#E8ECE9; }
        .progress i { display:block; width:80%; height:100%; border-radius:inherit; background:${C.green}; }
        .choices { display:grid; gap:10px; margin-top:24px; }
        .success-mark { width:34px; height:34px; display:grid; place-items:center; margin-bottom:15px; border-radius:50%; color:white; background:${C.green}; font-size:18px; font-weight:700; }
        .success-mark.large { width:54px; height:54px; margin:0 auto 20px; font-size:25px; box-shadow:0 0 0 10px rgba(46,125,82,.09); }
        .findings { display:grid; gap:9px; margin-top:18px; }
        .findings div { display:flex; align-items:center; gap:11px; padding:11px; border-radius:12px; background:#F1F8F4; font-size:12px; line-height:1.3; }
        .findings b { color:${C.green}; font-size:11px; }
        .order { margin:22px 0; padding:17px; border-radius:14px; background:#F1F8F4; }
        .order div, .receipt, .funding-row { display:flex; justify-content:space-between; align-items:center; gap:10px; }
        .order span { font-size:13px; font-weight:600; }
        .order strong { color:${C.green}; font-size:20px; }
        .order small { display:block; margin-top:5px; color:${C.muted}; font-size:11px; }
        .phone-content label { display:block; margin-bottom:7px; color:${C.muted}; font-size:11px; }
        .card-field, .split-fields span { padding:13px; border:1px solid ${C.border}; background:white; color:${C.muted}; font-size:13px; }
        .card-field { border-radius:11px 11px 0 0; }
        .split-fields { display:grid; grid-template-columns:1fr 1fr; }
        .split-fields span:first-child { border-top:0; border-radius:0 0 0 11px; }
        .split-fields span:last-child { border-top:0; border-left:0; border-radius:0 0 11px 0; }
        .center-state { padding-top:55px; text-align:center; }
        .center-state .phone-kicker { text-align:center; }
        .receipt, .funding-row { margin-top:25px; padding:16px; border-radius:14px; background:#F1F8F4; font-size:13px; text-align:left; }
        .receipt strong, .funding-row strong { color:${C.green}; }
        .orbit { position:relative; width:72px; height:72px; display:grid; place-items:center; margin:0 auto 24px; border:1px solid rgba(46,125,82,.2); border-radius:50%; }
        .orbit span { width:40px; height:40px; display:grid; place-items:center; border-radius:11px; background:${C.green}; color:white; font-size:12px; font-weight:700; }
        .orbit i { position:absolute; width:9px; height:9px; border-radius:50%; background:${C.green}; animation:orbit 1.4s linear infinite; }
        @keyframes orbit { from { transform:rotate(0deg) translateX(47px) rotate(0deg); } to { transform:rotate(360deg) translateX(47px) rotate(-360deg); } }
        .home-bar { position:absolute; bottom:8px; left:50%; width:105px; height:4px; border-radius:99px; background:#151917; transform:translateX(-50%); opacity:.9; }
      `}</style>
    </aside>
  );
}
