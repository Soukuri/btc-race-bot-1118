// Trend-aware dip buyer for the cbBTC 1-minute bars race, long only.
//
// A pure dip buyer bleeds in a rising market (it waits for falls that do
// not come, then buys the first real top), and a pure momentum chaser
// buys every local top in a falling one. This bot splits the difference:
// it only buys a dip while the slow trend is not down, so the dip is a
// pause in an advance rather than a falling knife, and it also takes a
// deep capitulation bounce when the fall is extreme and turns up. A
// round trip costs about 12 bps of fees and slippage plus price impact,
// so entries wait for a real turn, and exits trail the recovery instead
// of fixing a target the market may never revisit.
//   - Trend (flat): the 240-bar momentum is at or above TREND_MIN_BPS.
//   - Entry A (trend dip): trend is up, the 10-bar momentum is at or
//     below DIP_SHORT_BPS, and the last close is above the previous one.
//   - Entry B (capitulation): the 120-bar momentum is at or below
//     DEEP_DIP_BPS while the 10-bar momentum has turned up by at least
//     TURN_BPS. Stake is STAKE_BPS of equity either way.
//   - Exit (holding, whole position): take profit at +TAKE_BPS of value
//     against cost, a trailing stop TRAIL_BPS under the best close since
//     entry, a hard stop at STOP_BPS, or MAX_HOLD_BARS held.
//   - After an exit the bot waits COOLDOWN_BARS before entering again,
//     so one market cannot churn it through fees.
// Indicators run on every bar, warm-up included, in float64 on closes
// only: the same bars give the same orders on every run.

import { runBars, type Bar, type BarsState, type BuyInput, type SellInput } from './vendor/makefun-bars.ts';

const TREND_BARS = 240;
const TREND_MIN_BPS = -25;
const DIP_SHORT_BARS = 10;
const DIP_SHORT_BPS = -20;
const LONG_BARS = 120;
const DEEP_DIP_BPS = -70;
const TURN_BPS = 10;
const STAKE_BPS = 9500;
const STOP_BPS = -120;
const TAKE_BPS = 170;
const TRAIL_BPS = 80;
const TRAIL_MIN_BARS = 5;
const MAX_HOLD_BARS = 600;
const COOLDOWN_BARS = 45;
const BUY_SLIPPAGE_BPS = 120;
const SELL_SLIPPAGE_BPS = 250;

interface Tracker {
  closes: number[];
  peakClose: number;
  heldBars: number;
  cooldown: number;
}

const trackers = new Map<string, Tracker>();

function tracker(symbol: string): Tracker {
  let t = trackers.get(symbol);
  if (t === undefined) {
    t = { closes: [], peakClose: 0, heldBars: 0, cooldown: 0 };
    trackers.set(symbol, t);
  }
  return t;
}

/** Momentum in bps of the last `bars` closes ending at the newest close. */
function momentumBps(closes: number[], bars: number): number {
  const n = closes.length;
  if (n <= bars) return 0;
  return (closes[n - 1] / closes[n - 1 - bars] - 1) * 10000;
}

await runBars({
  onBatch(state: BarsState, batch) {
    const fresh = new Set<string>();
    for (const bar of batch.bars) {
      const t = tracker(bar.symbol);
      t.closes.push(Number(bar.c));
      if (t.closes.length > 720) t.closes.shift();
      fresh.add(bar.symbol);
    }
    if (state.warmingUp) return [];

    const orders: (BuyInput | SellInput)[] = [];
    const minNotional = BigInt(state.hello.fees.min_notional_quote_units);

    for (const { symbol } of state.hello.symbols) {
      if (!fresh.has(symbol)) continue;
      const t = tracker(symbol);
      const close = state.close(symbol);
      if (close === null) continue;
      const held = state.positions.get(symbol);
      const c = Number(close);

      if (held !== undefined) {
        t.heldBars += 1;
        if (c > t.peakClose) t.peakClose = c;
        const value = state.value(symbol, held.qty);
        const pnlBps = held.cost > 0n ? Number(((value - held.cost) * 10000n) / held.cost) : 0;
        const trailing = t.heldBars >= TRAIL_MIN_BARS && t.peakClose > 0 && c <= t.peakClose * (1 - TRAIL_BPS / 10000);
        if (pnlBps <= STOP_BPS || pnlBps >= TAKE_BPS || trailing || t.heldBars >= MAX_HOLD_BARS) {
          orders.push({ side: 'sell', symbol, qty: held.qty, max_slippage_bps: SELL_SLIPPAGE_BPS });
          t.cooldown = COOLDOWN_BARS;
          t.heldBars = 0;
          t.peakClose = 0;
        }
        continue;
      }

      if (t.cooldown > 0) { t.cooldown -= 1; continue; }
      const n = t.closes.length;
      if (n <= TREND_BARS) continue;
      const trend = momentumBps(t.closes, TREND_BARS);
      const momShort = momentumBps(t.closes, DIP_SHORT_BARS);
      const momLong = momentumBps(t.closes, LONG_BARS);
      const turnedUp = n >= 2 && t.closes[n - 1] > t.closes[n - 2];
      const trendDip = trend >= TREND_MIN_BPS && momShort <= DIP_SHORT_BPS && turnedUp;
      const capitulation = momLong <= DEEP_DIP_BPS && momShort >= TURN_BPS;
      if (trendDip || capitulation) {
        let notional = (state.equity * BigInt(STAKE_BPS)) / 10000n;
        if (notional > state.cash) notional = state.cash;
        const room = state.weightRoom(symbol);
        if (notional > room) notional = room;
        if (notional >= minNotional * 2n) {
          orders.push({ side: 'buy', symbol, notional_quote_units: notional, max_slippage_bps: BUY_SLIPPAGE_BPS });
          t.peakClose = c;
          t.heldBars = 0;
        }
      }
    }
    return orders;
  },
});
