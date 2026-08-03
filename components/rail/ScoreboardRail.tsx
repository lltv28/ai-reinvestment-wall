import { C, TYPE, W, type FeedEvent } from '@/lib/adStage';
import { LiveRangeSelect } from './LiveRangeSelect';
import { MiniStat } from './MiniStat';
import { RevenueHero } from './RevenueHero';
import { Ticker } from './Ticker';

export function ScoreboardRail({
  revenue,
  purchases,
  calls,
  upsellPct,
  feed,
  width,
  label = 'AI Growth Loop',
}: {
  revenue: number;
  purchases: number;
  calls: number;
  upsellPct: number;
  feed: FeedEvent[];
  width: number;
  label?: string;
}) {
  return (
    <aside
      style={{
        width: `${width}px`,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: '18px',
        height: '100%',
        fontFamily: 'inherit',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <LiveRangeSelect />
        <span
          style={{
            color: C.green,
            fontSize: `${TYPE.sm}px`,
            fontWeight: W.semibold,
            letterSpacing: '2px',
            textTransform: 'uppercase',
          }}
        >
          {label}
        </span>
      </div>

      <RevenueHero amount={revenue} />

      <div style={{ display: 'flex', gap: '12px' }}>
        <MiniStat label="Purchases" value={purchases.toLocaleString()} />
        <MiniStat label="Calls" value={calls.toLocaleString()} />
        <MiniStat label="Upsell %" value={`${upsellPct}%`} />
      </div>

      <Ticker feed={feed} />
    </aside>
  );
}
