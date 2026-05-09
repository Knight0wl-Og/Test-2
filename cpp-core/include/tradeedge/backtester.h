#pragma once

/**
 * backtester.h — event-driven backtesting engine over OHLCV bar data.
 *
 * The engine processes bars one at a time, calling a StrategyFn at each bar
 * to get a directional signal (+1 buy, -1 sell/short, 0 hold).  It handles:
 *   - Slippage and per-trade commission
 *   - Percentage-based position sizing (fraction of current equity)
 *   - Stop-loss and take-profit exits
 *   - Full trade log and equity curve output
 *   - Annualised Sharpe ratio and max drawdown calculation
 *
 * Built-in strategies:
 *   Backtester::smaStrategy(fast, slow) — golden/death cross
 */

#include "tradeedge/types.h"
#include <functional>
#include <string>
#include <vector>

namespace tradeedge {

// ─── Trade record ─────────────────────────────────────────────────────────────

enum class Side { Long, Short };

struct Trade {
    std::string symbol;
    Side        side{Side::Long};
    double      entry_price{0.0};
    double      exit_price{0.0};
    double      shares{1.0};
    int64_t     entry_time{0};   // Unix seconds
    int64_t     exit_time{0};
    double      pnl{0.0};        // net P&L after commission
    double      pnl_pct{0.0};    // P&L as % of entry notional
    std::string exit_reason;     // "signal" | "stop" | "take_profit" | "end_of_data"
};

// ─── Configuration ────────────────────────────────────────────────────────────

struct BacktestConfig {
    double initial_capital{100'000.0};
    double commission_per_trade{1.0};      // $ per side (flat)
    double slippage_pct{0.001};            // 0.1% adverse slippage per fill
    double position_size_pct{0.10};        // 10% of equity per position
    double stop_loss_pct{0.05};            // 5%  stop (0 = disabled)
    double take_profit_pct{0.15};          // 15% target (0 = disabled)
};

// ─── Result ───────────────────────────────────────────────────────────────────

struct BacktestResult {
    double total_return_pct{0.0};   // (final_equity - initial) / initial × 100
    double final_equity{0.0};
    double max_drawdown_pct{0.0};   // peak-to-trough decline (%)
    double sharpe_ratio{0.0};       // annualised (√252 × mean/stdev daily returns)
    double win_rate{0.0};           // winning_trades / total_trades × 100
    int    total_trades{0};
    int    winning_trades{0};
    int    losing_trades{0};
    double avg_win_pct{0.0};
    double avg_loss_pct{0.0};
    double profit_factor{0.0};      // gross_wins / gross_losses (0 if no losses)

    std::vector<Trade>  trade_log;
    std::vector<double> equity_curve;  // equity at the close of each bar
};

// ─── Strategy function type ───────────────────────────────────────────────────

/**
 * Called once per bar.  Return:
 *   +1  → go long  (or cover short)
 *   -1  → go short (or close long)
 *    0  → hold current position
 *
 * bars[0..bar_index] are valid; bars beyond bar_index must not be accessed
 * (no look-ahead).
 */
using StrategyFn = std::function<int(const std::vector<OHLCVBar>&, size_t bar_index)>;

// ─── Backtester ───────────────────────────────────────────────────────────────

class Backtester {
public:
    explicit Backtester(const BacktestConfig& config = {});

    /**
     * Run strategy over bars and return full statistics + trade log.
     * Any open position at end-of-data is closed at the last bar's close.
     */
    BacktestResult run(const std::string&           symbol,
                       const std::vector<OHLCVBar>& bars,
                       StrategyFn                   strategy) const;

    void                 setConfig(const BacktestConfig& c) { config_ = c; }
    const BacktestConfig& config()                    const { return config_; }

    // ── Built-in strategy factories ──────────────────────────────────────────

    /**
     * SMA golden/death cross strategy.
     * Buys when fast MA crosses above slow MA; sells when it crosses below.
     * fast < slow; typical values: (10,50), (20,50), (50,200).
     */
    static StrategyFn smaStrategy(int fast, int slow);

private:
    BacktestConfig config_;

    static double computeSharpe(const std::vector<double>& equity_curve);
    static double computeMaxDrawdown(const std::vector<double>& equity_curve);
};

// ─── Convenience free functions (useful for Python bindings) ─────────────────

/**
 * Run the SMA crossover strategy without constructing a Backtester object.
 * Equivalent to:  Backtester(config).run(symbol, bars, Backtester::smaStrategy(fast,slow))
 */
BacktestResult runBacktestSMA(const std::string&           symbol,
                              const std::vector<OHLCVBar>& bars,
                              int                          fast,
                              int                          slow,
                              const BacktestConfig&        config = {});

} // namespace tradeedge
