"""
rest_example.py — call the TradeEdge C++ REST server from Python.

Start the server first:
    ./build/tradeedge_server 7331        # Linux / macOS
    build\Release\tradeedge_server.exe 7331   # Windows

Then run:
    python examples/rest_example.py
"""

import json, sys
try:
    import requests
except ImportError:
    print("pip install requests")
    sys.exit(1)

BASE = "http://127.0.0.1:7331"

def get(path, **params):
    r = requests.get(f"{BASE}{path}", params=params, timeout=5)
    r.raise_for_status()
    return r.json()

def post(path, body):
    r = requests.post(f"{BASE}{path}", json=body, timeout=30)
    r.raise_for_status()
    return r.json()

# ── Health ────────────────────────────────────────────────────────────────────
print("=" * 55)
print("  Health check")
print("=" * 55)
h = get("/health")
print(f"  status: {h['status']}  engine: {h['engine']}")

# ── Black-Scholes price ───────────────────────────────────────────────────────
print()
print("  /price  S=450 K=455 r=5% T=30d σ=25%")
p = get("/price", S=450, K=455, r=0.05, T=30/365, sigma=0.25)
print(f"  Call: ${p['call']:.4f}   Put: ${p['put']:.4f}")

# ── Greeks ────────────────────────────────────────────────────────────────────
print()
print("  /greeks  (call)")
g = get("/greeks", S=450, K=455, r=0.05, T=30/365, sigma=0.25, type="call")
for k, v in g.items():
    print(f"  {k:6s}: {v:+.6f}")

# ── Implied volatility ────────────────────────────────────────────────────────
print()
print("  /iv  (market_price from above call price)")
iv = get("/iv", S=450, K=455, r=0.05, T=30/365, market_price=p["call"], type="call")
print(f"  IV: {iv['iv_pct']:.2f}%  (should be ~25.00%)")

# ── Backtest ──────────────────────────────────────────────────────────────────
print()
print("  /backtest  SMA 10/50 on 300-bar uptrend")

price = 150.0
bars = []
for i in range(300):
    bars.append({
        "timestamp": 1_700_000_000 + i * 86_400,
        "open": price, "high": price + 0.8, "low": price - 0.2,
        "close": price + 0.4, "volume": 1_000_000,
    })
    price += 0.4

bt = post("/backtest", {
    "symbol": "DEMO",
    "strategy": {"type": "sma", "fast": 10, "slow": 50},
    "bars": bars,
    "config": {"initial_capital": 100_000, "position_size_pct": 0.10},
})
print(f"  Return     : {bt['total_return_pct']:+.1f}%")
print(f"  Win rate   : {bt['win_rate']:.0f}%")
print(f"  Max DD     : {bt['max_drawdown_pct']:.1f}%")
print(f"  Sharpe     : {bt['sharpe_ratio']:.2f}")
print(f"  Trades     : {bt['total_trades']}")

# ── Options flow scoring ──────────────────────────────────────────────────────
print()
print("  /flow  — score 3 orders")
flow = post("/flow", {
    "orders": [
        {"symbol": "SPY",  "strike": 510,  "expiry": "2025-06-20",
         "option_type": "call", "premium": 750_000,    "spot_price": 498,
         "contracts": 1500, "execution": "sweep"},
        {"symbol": "QQQ",  "strike": 440,  "expiry": "2025-06-20",
         "option_type": "put",  "premium": 200_000,    "spot_price": 448,
         "contracts": 400,  "execution": "block"},
        {"symbol": "NVDA", "strike": 1000, "expiry": "2025-07-18",
         "option_type": "call", "premium": 1_500_000,  "spot_price": 980,
         "contracts": 2500, "execution": "sweep"},
    ]
})
print(f"  {len(flow['events'])} events scored:")
for ev in flow["events"]:
    print(f"  [{ev['score']:5.1f}] {ev['symbol']:5s}  {ev['signal']:28s}  ${ev['premium']:>12,.0f}")

# ── Tick ingestion and stats ──────────────────────────────────────────────────
print()
print("  /tick  + /stats")
import time
ts = int(time.time() * 1000)
for i, (px, vol) in enumerate([(175.0, 80_000), (175.5, 120_000), (176.0, 95_000)]):
    post("/tick", {"symbol": "AAPL", "price": px,
                   "volume": vol, "timestamp_ms": ts + i * 1000})

stats = get("/stats", symbol="AAPL")
print(f"  AAPL  last={stats['last_price']:.2f}  vwap={stats['vwap']:.4f}"
      f"  hi={stats['session_high']:.2f}  lo={stats['session_low']:.2f}"
      f"  chg={stats['price_change_pct']:+.2f}%")

print()
print("Done.")
