#include "tradeedge/backtester.h"

#include <algorithm>
#include <cmath>
#include <numeric>

namespace tradeedge {

Backtester::Backtester(const BacktestConfig& config) : config_(config) {}

// ─── Statistics helpers ───────────────────────────────────────────────────────

double Backtester::computeMaxDrawdown(const std::vector<double>& equity) {
    if (equity.size() < 2) return 0.0;
    double peak    = equity[0];
    double max_dd  = 0.0;
    for (double e : equity) {
        peak  = std::max(peak, e);
        max_dd = std::max(max_dd, peak > 0.0 ? (peak - e) / peak : 0.0);
    }
    return max_dd * 100.0;
}

double Backtester::computeSharpe(const std::vector<double>& equity) {
    if (equity.size() < 2) return 0.0;

    // Daily returns
    std::vector<double> rets;
    rets.reserve(equity.size() - 1);
    for (size_t i = 1; i < equity.size(); ++i) {
        if (equity[i - 1] > 0.0)
            rets.push_back((equity[i] - equity[i - 1]) / equity[i - 1]);
    }
    if (rets.empty()) return 0.0;

    const double mean = std::accumulate(rets.begin(), rets.end(), 0.0) /
                        static_cast<double>(rets.size());

    double var = 0.0;
    for (double r : rets) var += (r - mean) * (r - mean);
    var /= static_cast<double>(rets.size());

    const double stddev = std::sqrt(var);
    if (stddev < 1e-12) return 0.0;

    // Annualised Sharpe (252 trading days, risk-free rate ≈ 0)
    return (mean / stddev) * std::sqrt(252.0);
}

// ─── Core run ────────────────────────────────────────────────────────────────

BacktestResult Backtester::run(const std::string&           symbol,
                                const std::vector<OHLCVBar>& bars,
                                StrategyFn                   strategy) const {
    if (bars.empty()) return {};

    BacktestResult res;
    res.equity_curve.reserve(bars.size());

    double  equity      = config_.initial_capital;
    bool    in_position = false;
    Side    side        = Side::Long;
    double  entry_price = 0.0;
    double  shares      = 0.0;
    int64_t entry_time  = 0;

    // ── Fill helpers ─────────────────────────────────────────────────────────

    auto fill_entry = [&](double price, Side s, int64_t ts) {
        const double slipped = price * (1.0 + (s == Side::Long
                                               ?  config_.slippage_pct
                                               : -config_.slippage_pct));
        shares      = (equity * config_.position_size_pct) / slipped;
        entry_price = slipped;
        entry_time  = ts;
        side        = s;
        in_position = true;
        equity     -= config_.commission_per_trade;
    };

    auto fill_exit = [&](double price, int64_t ts, const std::string& reason) {
        const double slipped = price * (1.0 - (side == Side::Long
                                               ?  config_.slippage_pct
                                               : -config_.slippage_pct));
        const double gross   = (side == Side::Long)
                             ? (slipped - entry_price) * shares
                             : (entry_price - slipped) * shares;
        const double net     = gross - config_.commission_per_trade;
        equity += net;

        Trade t;
        t.symbol      = symbol;
        t.side        = side;
        t.entry_price = entry_price;
        t.exit_price  = slipped;
        t.shares      = shares;
        t.entry_time  = entry_time;
        t.exit_time   = ts;
        t.pnl         = net;
        t.pnl_pct     = (entry_price > 0.0 && shares > 0.0)
                      ? (net / (entry_price * shares)) * 100.0
                      : 0.0;
        t.exit_reason = reason;
        res.trade_log.push_back(t);

        if (net > 0.0) { ++res.winning_trades; res.avg_win_pct  += t.pnl_pct; }
        else           { ++res.losing_trades;  res.avg_loss_pct += t.pnl_pct; }

        in_position = false;
        entry_price = 0.0;
        shares      = 0.0;
    };

    // ── Main loop ────────────────────────────────────────────────────────────

    for (size_t i = 0; i < bars.size(); ++i) {
        const auto& bar = bars[i];

        // Check stop-loss / take-profit on the current bar's close
        if (in_position) {
            const double ret = (side == Side::Long)
                             ? (bar.close - entry_price) / entry_price
                             : (entry_price - bar.close) / entry_price;

            if (config_.stop_loss_pct > 0.0 && ret <= -config_.stop_loss_pct) {
                fill_exit(bar.close, bar.timestamp, "stop");
            } else if (config_.take_profit_pct > 0.0 && ret >= config_.take_profit_pct) {
                fill_exit(bar.close, bar.timestamp, "take_profit");
            }
        }

        // Ask strategy for a signal
        const int signal = strategy(bars, i);

        if (!in_position) {
            if (signal == 1)  fill_entry(bar.close, Side::Long,  bar.timestamp);
            if (signal == -1) fill_entry(bar.close, Side::Short, bar.timestamp);
        } else {
            // Exit on opposite signal
            if (side == Side::Long  && signal == -1) fill_exit(bar.close, bar.timestamp, "signal");
            if (side == Side::Short && signal ==  1) fill_exit(bar.close, bar.timestamp, "signal");
        }

        res.equity_curve.push_back(equity);
    }

    // Close any still-open position at end of data
    if (in_position && !bars.empty())
        fill_exit(bars.back().close, bars.back().timestamp, "end_of_data");

    // ── Aggregate statistics ─────────────────────────────────────────────────

    res.total_trades     = res.winning_trades + res.losing_trades;
    res.total_return_pct = (equity - config_.initial_capital) / config_.initial_capital * 100.0;
    res.final_equity     = equity;
    res.max_drawdown_pct = computeMaxDrawdown(res.equity_curve);
    res.sharpe_ratio     = computeSharpe(res.equity_curve);
    res.win_rate         = res.total_trades > 0
                         ? static_cast<double>(res.winning_trades) / res.total_trades * 100.0
                         : 0.0;
    if (res.winning_trades > 0) res.avg_win_pct  /= res.winning_trades;
    if (res.losing_trades  > 0) res.avg_loss_pct /= res.losing_trades;

    double gross_wins = 0.0, gross_losses = 0.0;
    for (const auto& t : res.trade_log) {
        if (t.pnl > 0.0) gross_wins   +=  t.pnl;
        else              gross_losses += -t.pnl;
    }
    res.profit_factor = (gross_losses > 0.0) ? gross_wins / gross_losses : 0.0;

    return res;
}

// ─── Built-in strategy: SMA golden/death cross ────────────────────────────────

StrategyFn Backtester::smaStrategy(int fast, int slow) {
    return [fast, slow](const std::vector<OHLCVBar>& bars, size_t idx) -> int {
        if (static_cast<int>(idx) < slow) return 0;

        // Compute current and previous fast/slow MAs from bars[0..idx]
        double fn = 0.0, sn = 0.0, fp = 0.0, sp = 0.0;
        for (int i = 0; i < fast; ++i) fn += bars[idx - static_cast<size_t>(i)].close;
        for (int i = 0; i < slow; ++i) sn += bars[idx - static_cast<size_t>(i)].close;
        for (int i = 1; i <= fast; ++i) fp += bars[idx - static_cast<size_t>(i)].close;
        for (int i = 1; i <= slow; ++i) sp += bars[idx - static_cast<size_t>(i)].close;

        fn /= fast; sn /= slow;
        fp /= fast; sp /= slow;

        if (fp <= sp && fn > sn) return  1;  // golden cross → buy
        if (fp >= sp && fn < sn) return -1;  // death cross  → sell
        return 0;
    };
}

// ─── Free function convenience wrapper ────────────────────────────────────────

BacktestResult runBacktestSMA(const std::string&           symbol,
                              const std::vector<OHLCVBar>& bars,
                              int fast, int slow,
                              const BacktestConfig&        config) {
    return Backtester(config).run(symbol, bars, Backtester::smaStrategy(fast, slow));
}

} // namespace tradeedge
