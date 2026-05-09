"""
greeks_example.py — demonstrate the tradeedge_core Python module.

Build the module first, then run:
    PYTHONPATH=../build python greeks_example.py      # Linux / macOS
    set PYTHONPATH=..\build && python greeks_example.py  # Windows

Or copy tradeedge_core.so / tradeedge_core.pyd next to this file.
"""

import sys, os

# Auto-discover the build directory so this runs from the examples/ folder
_here  = os.path.dirname(os.path.abspath(__file__))
_build = os.path.join(_here, "..", "build")
for _cfg in ("", "Release", "Debug"):
    _p = os.path.join(_build, _cfg)
    if os.path.isdir(_p):
        sys.path.insert(0, _p)

import tradeedge_core as te

# ── Black-Scholes price ───────────────────────────────────────────────────────
print("=" * 50)
print("  Black-Scholes  S=450 K=455 r=5% T=30d σ=25%")
print("=" * 50)
price = te.black_scholes(S=450.0, K=455.0, r=0.05, T=30/365, sigma=0.25)
print(f"  Call : ${price.call:.4f}")
print(f"  Put  : ${price.put:.4f}")

# ── Greeks ────────────────────────────────────────────────────────────────────
print()
print("  Greeks (call)")
g = te.calculate_greeks(S=450.0, K=455.0, r=0.05, T=30/365, sigma=0.25, option_type="call")
print(f"  Delta: {g.delta:+.4f}   ($ change per $1 move in underlying)")
print(f"  Gamma: {g.gamma:.6f}   (delta change per $1 move)")
print(f"  Theta: {g.theta:+.4f}   (daily decay in $)")
print(f"  Vega : {g.vega:+.4f}   ($ change per 1% IV move)")
print(f"  Rho  : {g.rho:+.4f}   ($ change per 1% rate move)")

# ── Implied volatility ────────────────────────────────────────────────────────
print()
print("  Implied Volatility round-trip")
known_sigma = 0.25
p2 = te.black_scholes(S=450.0, K=455.0, r=0.05, T=30/365, sigma=known_sigma)
iv = te.implied_volatility(S=450.0, K=455.0, r=0.05, T=30/365,
                           market_price=p2.call, option_type="call")
print(f"  Known σ  : {known_sigma*100:.1f}%")
print(f"  Solved σ : {iv*100:.2f}%  (error: {abs(iv-known_sigma)*100:.4f}%)")

# ── Tick processor ────────────────────────────────────────────────────────────
print()
print("  TickProcessor — live session stats")
proc = te.TickProcessor(history_size=500)

import time
base_ts = int(time.time() * 1000)
prices = [174.50, 174.80, 175.20, 175.00, 175.50]
vols   = [80_000, 120_000, 95_000, 60_000, 110_000]

for i, (px, vol) in enumerate(zip(prices, vols)):
    t = te.Tick()
    t.symbol       = "AAPL"
    t.price        = px
    t.volume       = vol
    t.timestamp_ms = base_ts + i * 1000
    proc.process_tick(t)

stats = proc.get_stats("AAPL")
print(f"  Symbol      : {stats.symbol}")
print(f"  Last price  : ${stats.last_price:.2f}")
print(f"  Session open: ${stats.session_open:.2f}")
print(f"  Session high: ${stats.session_high:.2f}  low: ${stats.session_low:.2f}")
print(f"  VWAP        : ${stats.vwap:.4f}")
print(f"  Change      : {stats.price_change_pct:+.2f}%")
print(f"  Ticks       : {stats.tick_count}")

# ── Backtester ────────────────────────────────────────────────────────────────
print()
print("  Backtester — SMA 10/50 on simulated uptrend (200 bars)")

bars = []
price = 100.0
for i in range(200):
    b = te.OHLCVBar()
    b.timestamp = 1_700_000_000 + i * 86_400
    b.open   = price
    b.close  = price + 0.40
    b.high   = price + 0.60
    b.low    = price - 0.10
    b.volume = 1_000_000
    bars.append(b)
    price = b.close

cfg = te.BacktestConfig()
cfg.initial_capital   = 100_000
cfg.position_size_pct = 0.10
cfg.stop_loss_pct     = 0.05

result = te.backtest_sma("DEMO", bars, fast=10, slow=50, config=cfg)
print(f"  Return      : {result.total_return_pct:+.1f}%")
print(f"  Trades      : {result.total_trades}  (won {result.winning_trades} / lost {result.losing_trades})")
print(f"  Win rate    : {result.win_rate:.0f}%")
print(f"  Max DD      : {result.max_drawdown_pct:.1f}%")
print(f"  Sharpe      : {result.sharpe_ratio:.2f}")
print(f"  Profit fct  : {result.profit_factor:.2f}")

# ── Flow scorer ───────────────────────────────────────────────────────────────
print()
print("  FlowScorer — options flow conviction scoring")

scorer = te.FlowScorer()

orders = []
for sym, strike, typ, prem, exec_type, contracts in [
    ("SPY",  510.0, "call", 750_000.0,  "sweep",  1500),
    ("QQQ",  440.0, "put",  200_000.0,  "block",   400),
    ("NVDA", 950.0, "call", 1_200_000.0,"sweep",  2000),
    ("AAPL", 180.0, "call",  30_000.0,  "block",    60),  # below min → filtered
]:
    o = te.OptionsOrder()
    o.symbol       = sym
    o.strike       = strike
    o.option_type  = typ
    o.premium      = prem
    o.spot_price   = strike * 0.98   # slightly OTM calls
    o.contracts    = contracts
    o.execution    = exec_type
    o.timestamp_ms = base_ts
    orders.append(o)

events = scorer.score_flow(orders)
print(f"  {len(orders)} orders in → {len(events)} events above threshold")
for ev in events:
    print(f"  [{ev.score:5.1f}] {ev.symbol:5s}  {ev.signal:25s}  ${ev.premium:>12,.0f}  {ev.execution}")
