/**
 * test_scanner.cpp — unit tests for Scanner, Backtester, TickProcessor, FlowScorer.
 *
 * Build:  cmake -DBUILD_TESTS=ON .. && cmake --build .
 * Run:    ./test_scanner   (or ctest)
 */

#include "tradeedge/scanner.h"
#include "tradeedge/backtester.h"
#include "tradeedge/tick_processor.h"
#include "tradeedge/flow_scorer.h"

#include <cmath>
#include <iomanip>
#include <iostream>

using namespace tradeedge;

// ─── Test harness ─────────────────────────────────────────────────────────────

static int s_run = 0, s_pass = 0;

static void check_true(bool cond, const char* label) {
    ++s_run;
    std::cout << (cond ? "  PASS" : "  FAIL") << "  " << label << "\n";
    if (cond) ++s_pass;
}

template <typename T>
static void check_near(T got, T expected, T tol, const char* label) {
    ++s_run;
    const bool ok = std::abs(got - expected) <= tol;
    std::cout << (ok ? "  PASS" : "  FAIL") << "  " << label;
    if (!ok) std::cout << "  (got " << got << ", expected ~" << expected << ")";
    std::cout << "\n";
    if (ok) ++s_pass;
}

// ─── Data factories ───────────────────────────────────────────────────────────

// n bars with a gentle trend (+trend per bar)
static std::vector<OHLCVBar> makeBars(int n, double start = 100.0,
                                      double trend = 0.0,
                                      double avg_vol = 1'000'000.0) {
    std::vector<OHLCVBar> bars;
    bars.reserve(static_cast<size_t>(n));
    double price = start;
    for (int i = 0; i < n; ++i) {
        OHLCVBar b;
        b.timestamp = 1'700'000'000LL + static_cast<int64_t>(i) * 86400;
        b.open      = price;
        b.close     = price + trend;
        b.high      = price + trend + 0.2;
        b.low       = price - 0.1;
        b.volume    = avg_vol;
        price       = b.close;
        bars.push_back(b);
    }
    return bars;
}

static Tick makeTick(const std::string& sym, double price, double volume = 1'000'000.0) {
    Tick t;
    t.symbol       = sym;
    t.price        = price;
    t.volume       = volume;
    t.timestamp_ms = 1'700'000'000'000LL;
    return t;
}

// ─── Scanner tests ────────────────────────────────────────────────────────────

static void test_breakout_detected() {
    std::cout << "\n[Scanner: bullish breakout]\n";
    // 30 bars going from 100 → 103 (gentle drift), 20-period high ≈ 102
    auto bars = makeBars(30, 100.0, 0.1);
    // Tick price well above the 20-period high
    auto tick = makeTick("TEST", 115.0, 2'000'000.0);

    Scanner scanner;
    auto results = scanner.scan("TEST", bars, tick);

    check_true(!results.empty(), "at least one signal returned");
    bool found = false;
    for (const auto& r : results)
        if (r.signal_type == SignalType::Breakout) { found = true; break; }
    check_true(found, "Breakout signal present");
    if (!results.empty())
        check_true(results[0].score >= 50.0, "breakout score >= 50");
}

static void test_no_signal_on_flat() {
    std::cout << "\n[Scanner: no signal on flat/in-range price]\n";
    auto bars = makeBars(30, 100.0, 0.0);
    // Price unchanged — inside range, normal volume
    auto tick = makeTick("TEST", 100.0, 1'000'000.0);

    ScanConfig cfg;
    cfg.check_breakout     = true;
    cfg.check_volume_spike = true;
    cfg.check_ma_crossover = false;  // need 52+ bars for 50-SMA crossover
    cfg.min_score          = 50.0;
    Scanner scanner(cfg);
    auto results = scanner.scan("TEST", bars, tick);
    check_true(results.empty(), "no signals on flat in-range price");
}

static void test_volume_spike() {
    std::cout << "\n[Scanner: volume spike]\n";
    auto bars = makeBars(25, 100.0, 0.0);     // flat price, avg vol = 1M
    auto tick = makeTick("TEST", 100.0, 10'000'000.0);  // 10× volume

    ScanConfig cfg;
    cfg.check_breakout     = false;
    cfg.check_ma_crossover = false;
    cfg.volume_spike_multiplier = 2.5;
    Scanner scanner(cfg);
    auto results = scanner.scan("TEST", bars, tick);
    check_true(!results.empty(), "volume spike detected");
    if (!results.empty())
        check_true(results[0].signal_type == SignalType::VolumeSpike, "type is VolumeSpike");
}

static void test_ma_crossover() {
    std::cout << "\n[Scanner: golden-cross (fast crosses slow)]\n";
    // Build 60 bars where fast (10) eventually crosses above slow (50)
    // Simple way: 55 flat bars followed by a sharp upward turn
    auto bars = makeBars(55, 100.0, 0.0);  // flat
    // Append 5 strongly up bars so fast MA crosses above slow MA
    double price = bars.back().close;
    for (int i = 0; i < 5; ++i) {
        OHLCVBar b;
        b.timestamp = bars.back().timestamp + 86400;
        b.open  = price;
        b.close = price + 3.0;
        b.high  = price + 3.5;
        b.low   = price - 0.1;
        b.volume = 1'000'000.0;
        price = b.close;
        bars.push_back(b);
    }

    auto tick = makeTick("TEST", bars.back().close);
    ScanConfig cfg;
    cfg.check_breakout     = false;
    cfg.check_volume_spike = false;
    cfg.ma_fast_period     = 10;
    cfg.ma_slow_period     = 50;
    cfg.min_score          = 30.0;  // lower threshold for test
    Scanner scanner(cfg);
    auto results = scanner.scan("TEST", bars, tick);
    check_true(!results.empty(), "MA crossover signal detected");
    if (!results.empty())
        check_true(results[0].signal_type == SignalType::MAcrossover, "type is MAcrossover");
}

// ─── Backtester tests ─────────────────────────────────────────────────────────

static void test_backtest_uptrend() {
    std::cout << "\n[Backtester: SMA 10/50 on 200-bar uptrend]\n";
    auto bars = makeBars(200, 100.0, 0.5);  // +0.5 per bar = clear uptrend
    const auto result = runBacktestSMA("TEST", bars, 10, 50);

    check_true(result.total_trades > 0,    "generated trades");
    check_true(result.total_return_pct > 0,"positive return on uptrend");
    check_true(result.max_drawdown_pct >= 0,"max drawdown non-negative");
    check_true(result.final_equity > 0,    "final equity positive");

    std::cout << "    Return:   " << std::fixed << std::setprecision(1)
              << result.total_return_pct << "%\n";
    std::cout << "    Trades:   " << result.total_trades << "  "
              << "WinRate: " << result.win_rate << "%\n";
    std::cout << "    Sharpe:   " << result.sharpe_ratio << "\n";
    std::cout << "    Max DD:   " << result.max_drawdown_pct << "%\n";
}

static void test_backtest_flat() {
    std::cout << "\n[Backtester: flat data → no trades]\n";
    auto bars = makeBars(200, 100.0, 0.0);  // completely flat
    const auto result = runBacktestSMA("TEST", bars, 10, 50);
    check_true(result.total_trades == 0, "zero trades on flat data (no crossover)");
}

static void test_backtest_stop_loss() {
    std::cout << "\n[Backtester: stop-loss fires on downtrend]\n";
    // Sharp downtrend: -1 per bar → every long should hit stop
    auto bars = makeBars(100, 200.0, -1.0);
    BacktestConfig cfg;
    cfg.stop_loss_pct   = 0.03;   // 3% stop
    cfg.take_profit_pct = 0.0;    // disabled
    const auto result = Backtester(cfg).run("TEST", bars, Backtester::smaStrategy(5, 20));

    // If any trades were made they should exit via stop or end_of_data, not take_profit
    bool any_tp = false;
    for (const auto& t : result.trade_log)
        if (t.exit_reason == "take_profit") { any_tp = true; break; }
    check_true(!any_tp, "no take-profit exits on downtrend");
}

// ─── TickProcessor tests ──────────────────────────────────────────────────────

static void test_tick_processor() {
    std::cout << "\n[TickProcessor: VWAP and session stats]\n";
    TickProcessor proc(500);

    // Feed 5 ticks at increasing prices
    for (int i = 1; i <= 5; ++i) {
        Tick t;
        t.symbol       = "AAPL";
        t.price        = 100.0 + i;
        t.volume       = 100.0;
        t.timestamp_ms = 1'700'000'000'000LL + i * 1000;
        proc.processTick(t);
    }

    auto stats = proc.getStats("AAPL");
    check_true(stats.has_value(),          "stats available after ticks");
    if (stats) {
        check_true(stats->tick_count == 5, "tick count = 5");
        check_near(stats->session_open, 101.0, 0.001, "session open = first price (101)");
        check_near(stats->session_high, 105.0, 0.001, "session high = 105");
        check_near(stats->session_low,  101.0, 0.001, "session low  = 101");
        check_near(stats->last_price,   105.0, 0.001, "last price   = 105");
        // VWAP: equal volumes → arithmetic mean = 103
        check_near(stats->vwap,         103.0, 0.001, "VWAP = 103 (equal volumes)");
    }

    // Unseen symbol returns nullopt
    auto none = proc.getStats("UNKNOWN");
    check_true(!none.has_value(), "unknown symbol returns nullopt");

    // Reset
    proc.resetSession("AAPL");
    auto after_reset = proc.getStats("AAPL");
    check_true(!after_reset.has_value(), "stats cleared after reset");
}

// ─── FlowScorer tests ─────────────────────────────────────────────────────────

static void test_flow_scorer() {
    std::cout << "\n[FlowScorer: sweep scores higher than split]\n";
    FlowScorer scorer;

    OptionsOrder sweep, split, below_min;

    sweep.symbol       = "SPY";
    sweep.strike       = 510.0;
    sweep.option_type  = "call";
    sweep.premium      = 500'000.0;
    sweep.spot_price   = 498.0;
    sweep.contracts    = 1000;
    sweep.execution    = "sweep";

    split             = sweep;
    split.execution   = "split";

    below_min.symbol      = "AAPL";
    below_min.premium     = 10'000.0;  // below default min $50K
    below_min.option_type = "call";
    below_min.execution   = "block";

    auto events = scorer.scoreFlow({sweep, split, below_min});

    // below_min should be filtered
    check_true(events.size() == 2,   "below-min order filtered out");
    if (events.size() == 2) {
        check_true(events[0].score > events[1].score, "sweep scores higher than split");
        check_true(events[0].execution == "sweep",    "highest scorer is the sweep");
    }

    // OTM call (strike > spot) gets bonus vs ITM
    OptionsOrder otm_call, itm_call;
    otm_call         = sweep;
    otm_call.strike  = 510.0;  // OTM: 510 > 498
    itm_call         = sweep;
    itm_call.strike  = 490.0;  // ITM: 490 < 498

    auto otm_ev  = scorer.scoreOrder(otm_call);
    auto itm_ev  = scorer.scoreOrder(itm_call);
    check_true(otm_ev.score > itm_ev.score, "OTM call scores higher than ITM call");
}

// ─── Main ─────────────────────────────────────────────────────────────────────

int main() {
    std::cout << std::fixed << std::setprecision(2);
    std::cout << "═══════════════════════════════════════════════\n";
    std::cout << " TradeEdge Scanner / Backtester — Unit Tests\n";
    std::cout << "═══════════════════════════════════════════════\n";

    test_breakout_detected();
    test_no_signal_on_flat();
    test_volume_spike();
    test_ma_crossover();
    test_backtest_uptrend();
    test_backtest_flat();
    test_backtest_stop_loss();
    test_tick_processor();
    test_flow_scorer();

    std::cout << "\n───────────────────────────────────────────────\n";
    std::cout << " Results: " << s_pass << " / " << s_run << " passed\n";
    std::cout << "───────────────────────────────────────────────\n";

    return (s_pass == s_run) ? 0 : 1;
}
