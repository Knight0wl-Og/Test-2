/**
 * python_bindings.cpp — pybind11 extension exposing the TradeEdge C++ core
 * as the Python module `tradeedge_core`.
 *
 * Build:
 *   cmake -DBUILD_PYTHON_BINDINGS=ON ..
 *   cmake --build .
 *
 * Usage:
 *   import tradeedge_core as te
 *   p = te.black_scholes(S=450, K=455, r=0.05, T=30/365, sigma=0.25)
 *   print(p.call, p.put)
 */

#include <pybind11/pybind11.h>
#include <pybind11/stl.h>       // automatic std::vector / std::optional conversion
#include <pybind11/functional.h>

#include "tradeedge/options_pricer.h"
#include "tradeedge/tick_processor.h"
#include "tradeedge/scanner.h"
#include "tradeedge/backtester.h"
#include "tradeedge/flow_scorer.h"

namespace py = pybind11;
using namespace tradeedge;

PYBIND11_MODULE(tradeedge_core, m) {
    m.doc() = "TradeEdge C++ performance core — options pricing, scanner, backtester, flow scorer";

    // ── Shared types ──────────────────────────────────────────────────────────

    py::class_<Tick>(m, "Tick",
        "A single real-time price tick.")
        .def(py::init<>())
        .def_readwrite("symbol",       &Tick::symbol)
        .def_readwrite("price",        &Tick::price)
        .def_readwrite("volume",       &Tick::volume)
        .def_readwrite("timestamp_ms", &Tick::timestamp_ms)
        .def("__repr__", [](const Tick& t) {
            return "<Tick " + t.symbol + " price=" + std::to_string(t.price) + ">";
        });

    py::class_<OHLCVBar>(m, "OHLCVBar",
        "One OHLCV bar (any timeframe).")
        .def(py::init<>())
        .def_readwrite("timestamp", &OHLCVBar::timestamp)
        .def_readwrite("open",      &OHLCVBar::open)
        .def_readwrite("high",      &OHLCVBar::high)
        .def_readwrite("low",       &OHLCVBar::low)
        .def_readwrite("close",     &OHLCVBar::close)
        .def_readwrite("volume",    &OHLCVBar::volume);

    py::class_<OptionsOrder>(m, "OptionsOrder",
        "An options order record for the FlowScorer.")
        .def(py::init<>())
        .def_readwrite("symbol",       &OptionsOrder::symbol)
        .def_readwrite("strike",       &OptionsOrder::strike)
        .def_readwrite("expiry",       &OptionsOrder::expiry)
        .def_readwrite("option_type",  &OptionsOrder::option_type)
        .def_readwrite("premium",      &OptionsOrder::premium)
        .def_readwrite("spot_price",   &OptionsOrder::spot_price)
        .def_readwrite("contracts",    &OptionsOrder::contracts)
        .def_readwrite("execution",    &OptionsOrder::execution)
        .def_readwrite("timestamp_ms", &OptionsOrder::timestamp_ms);

    // ── Options pricer ────────────────────────────────────────────────────────

    py::class_<OptionPrice>(m, "OptionPrice",
        "Black-Scholes call and put prices.")
        .def_readonly("call", &OptionPrice::call)
        .def_readonly("put",  &OptionPrice::put)
        .def("__repr__", [](const OptionPrice& p) {
            return "<OptionPrice call=" + std::to_string(p.call) +
                   " put=" + std::to_string(p.put) + ">";
        });

    py::class_<Greeks>(m, "Greeks",
        "Option Greeks: Delta, Gamma, Theta (daily), Vega (per 1% IV), Rho (per 1% rate).")
        .def_readonly("delta", &Greeks::delta)
        .def_readonly("gamma", &Greeks::gamma)
        .def_readonly("theta", &Greeks::theta)
        .def_readonly("vega",  &Greeks::vega)
        .def_readonly("rho",   &Greeks::rho)
        .def("__repr__", [](const Greeks& g) {
            return "<Greeks Δ=" + std::to_string(g.delta) +
                   " Γ=" + std::to_string(g.gamma) +
                   " Θ=" + std::to_string(g.theta) + "/day>";
        });

    m.def("black_scholes", &blackScholes,
          py::arg("S"), py::arg("K"), py::arg("r"), py::arg("T"), py::arg("sigma"),
          "Black-Scholes European call/put price.\n\n"
          "  S     current underlying price\n"
          "  K     strike price\n"
          "  r     annualised risk-free rate (decimal, e.g. 0.05)\n"
          "  T     time to expiry in years (e.g. 30/365)\n"
          "  sigma annualised IV (decimal, e.g. 0.25)\n");

    m.def("calculate_greeks", &calculateGreeks,
          py::arg("S"), py::arg("K"), py::arg("r"), py::arg("T"), py::arg("sigma"),
          py::arg("option_type") = "call",
          "Compute all five Greeks.  option_type: 'call' or 'put'.\n"
          "Theta is per calendar day.  Vega and Rho are per 1 percentage-point change.");

    m.def("implied_volatility", &impliedVolatility,
          py::arg("S"), py::arg("K"), py::arg("r"), py::arg("T"),
          py::arg("market_price"),
          py::arg("option_type") = "call",
          py::arg("tol")         = 1e-6,
          py::arg("max_iter")    = 200,
          "Solve implied volatility from an observed market price (bisection).\n"
          "Returns 0.0 if the price is outside the solvable range [0.001, 5.0].");

    // ── Tick processor ────────────────────────────────────────────────────────

    py::class_<TickStats>(m, "TickStats",
        "Live session statistics for one symbol.")
        .def_readonly("symbol",           &TickStats::symbol)
        .def_readonly("last_price",       &TickStats::last_price)
        .def_readonly("vwap",             &TickStats::vwap)
        .def_readonly("total_volume",     &TickStats::total_volume)
        .def_readonly("price_change",     &TickStats::price_change)
        .def_readonly("price_change_pct", &TickStats::price_change_pct)
        .def_readonly("tick_count",       &TickStats::tick_count)
        .def_readonly("session_high",     &TickStats::session_high)
        .def_readonly("session_low",      &TickStats::session_low)
        .def_readonly("session_open",     &TickStats::session_open);

    py::class_<TickProcessor>(m, "TickProcessor",
        "Thread-safe real-time tick ingestion with per-symbol VWAP and session stats.")
        .def(py::init<size_t>(), py::arg("history_size") = 1000,
             "history_size: max ticks kept per symbol (ring buffer).")
        .def("process_tick",    &TickProcessor::processTick,  py::arg("tick"),
             "Feed a tick.  Thread-safe.")
        .def("get_stats",       &TickProcessor::getStats,     py::arg("symbol"),
             "Get current session stats for a symbol.  Returns None if unseen.")
        .def("get_recent_ticks",&TickProcessor::getRecentTicks,
             py::arg("symbol"), py::arg("n") = 100,
             "Return up to n recent ticks for a symbol (oldest first).")
        .def("reset_session",   &TickProcessor::resetSession, py::arg("symbol"),
             "Reset session stats for one symbol (call at market open).")
        .def("reset_all",       &TickProcessor::resetAllSessions,
             "Reset all session stats.")
        .def("symbol_count",    &TickProcessor::symbolCount,
             "Number of distinct symbols seen.");

    // ── Scanner ───────────────────────────────────────────────────────────────

    py::enum_<SignalType>(m, "SignalType")
        .value("Breakout",    SignalType::Breakout)
        .value("VolumeSpike", SignalType::VolumeSpike)
        .value("MAcrossover", SignalType::MAcrossover)
        .value("FlowAlert",   SignalType::FlowAlert)
        .export_values();

    py::class_<ScanConfig>(m, "ScanConfig",
        "Configuration for the signal scanner.")
        .def(py::init<>())
        .def_readwrite("check_breakout",          &ScanConfig::check_breakout)
        .def_readwrite("breakout_period",         &ScanConfig::breakout_period)
        .def_readwrite("check_volume_spike",      &ScanConfig::check_volume_spike)
        .def_readwrite("volume_spike_multiplier", &ScanConfig::volume_spike_multiplier)
        .def_readwrite("check_ma_crossover",      &ScanConfig::check_ma_crossover)
        .def_readwrite("ma_fast_period",          &ScanConfig::ma_fast_period)
        .def_readwrite("ma_slow_period",          &ScanConfig::ma_slow_period)
        .def_readwrite("min_score",               &ScanConfig::min_score);

    py::class_<ScanResult>(m, "ScanResult",
        "A triggered scanner signal.")
        .def_readonly("symbol",       &ScanResult::symbol)
        .def_readonly("signal_type",  &ScanResult::signal_type)
        .def_readonly("signal_label", &ScanResult::signal_label)
        .def_readonly("score",        &ScanResult::score)
        .def_readonly("price",        &ScanResult::price)
        .def_readonly("volume",       &ScanResult::volume)
        .def_readonly("timestamp_ms", &ScanResult::timestamp_ms)
        .def("__repr__", [](const ScanResult& r) {
            return "<ScanResult " + r.symbol + " '" + r.signal_label +
                   "' score=" + std::to_string(r.score) + ">";
        });

    py::class_<Scanner>(m, "Scanner",
        "Real-time signal scanner over OHLCV bars + live ticks.")
        .def(py::init<const ScanConfig&>(), py::arg("config") = ScanConfig{})
        .def("scan", &Scanner::scan,
             py::arg("symbol"), py::arg("bars"), py::arg("latest_tick"),
             "Scan a single symbol.  Returns list of ScanResult sorted by score.")
        .def("set_config", &Scanner::setConfig, py::arg("config"))
        .def("config",     &Scanner::config);

    // ── Backtester ────────────────────────────────────────────────────────────

    py::class_<BacktestConfig>(m, "BacktestConfig",
        "Backtesting engine parameters.")
        .def(py::init<>())
        .def_readwrite("initial_capital",      &BacktestConfig::initial_capital)
        .def_readwrite("commission_per_trade", &BacktestConfig::commission_per_trade)
        .def_readwrite("slippage_pct",         &BacktestConfig::slippage_pct)
        .def_readwrite("position_size_pct",    &BacktestConfig::position_size_pct)
        .def_readwrite("stop_loss_pct",        &BacktestConfig::stop_loss_pct)
        .def_readwrite("take_profit_pct",      &BacktestConfig::take_profit_pct);

    py::class_<Trade>(m, "Trade",
        "A completed trade record from a backtest.")
        .def_readonly("symbol",      &Trade::symbol)
        .def_readonly("entry_price", &Trade::entry_price)
        .def_readonly("exit_price",  &Trade::exit_price)
        .def_readonly("shares",      &Trade::shares)
        .def_readonly("pnl",         &Trade::pnl)
        .def_readonly("pnl_pct",     &Trade::pnl_pct)
        .def_readonly("exit_reason", &Trade::exit_reason);

    py::class_<BacktestResult>(m, "BacktestResult",
        "Full backtest output: statistics, trade log, equity curve.")
        .def_readonly("total_return_pct",  &BacktestResult::total_return_pct)
        .def_readonly("final_equity",      &BacktestResult::final_equity)
        .def_readonly("max_drawdown_pct",  &BacktestResult::max_drawdown_pct)
        .def_readonly("sharpe_ratio",      &BacktestResult::sharpe_ratio)
        .def_readonly("win_rate",          &BacktestResult::win_rate)
        .def_readonly("total_trades",      &BacktestResult::total_trades)
        .def_readonly("winning_trades",    &BacktestResult::winning_trades)
        .def_readonly("losing_trades",     &BacktestResult::losing_trades)
        .def_readonly("profit_factor",     &BacktestResult::profit_factor)
        .def_readonly("avg_win_pct",       &BacktestResult::avg_win_pct)
        .def_readonly("avg_loss_pct",      &BacktestResult::avg_loss_pct)
        .def_readonly("trade_log",         &BacktestResult::trade_log)
        .def_readonly("equity_curve",      &BacktestResult::equity_curve)
        .def("__repr__", [](const BacktestResult& r) {
            return "<BacktestResult return=" + std::to_string(r.total_return_pct) +
                   "% trades=" + std::to_string(r.total_trades) +
                   " sharpe=" + std::to_string(r.sharpe_ratio) + ">";
        });

    // Convenience free function: run SMA strategy without constructing Backtester
    m.def("backtest_sma", &runBacktestSMA,
          py::arg("symbol"), py::arg("bars"),
          py::arg("fast"), py::arg("slow"),
          py::arg("config") = BacktestConfig{},
          "Run the SMA golden/death-cross strategy over bars and return BacktestResult.\n\n"
          "  fast, slow — SMA periods (e.g. fast=10, slow=50)\n"
          "  config     — optional BacktestConfig (defaults: $100K capital, 10% sizing)");

    // ── Flow scorer ───────────────────────────────────────────────────────────

    py::class_<FlowScorerConfig>(m, "FlowScorerConfig",
        "Configuration for the options flow scorer.")
        .def(py::init<>())
        .def_readwrite("min_premium",            &FlowScorerConfig::min_premium)
        .def_readwrite("large_block_threshold",  &FlowScorerConfig::large_block_threshold)
        .def_readwrite("sweep_score_bonus",       &FlowScorerConfig::sweep_score_bonus)
        .def_readwrite("otm_bonus",               &FlowScorerConfig::otm_bonus);

    py::class_<FlowEvent>(m, "FlowEvent",
        "A scored unusual options flow event.")
        .def_readonly("symbol",      &FlowEvent::symbol)
        .def_readonly("strike",      &FlowEvent::strike)
        .def_readonly("expiry",      &FlowEvent::expiry)
        .def_readonly("option_type", &FlowEvent::option_type)
        .def_readonly("premium",     &FlowEvent::premium)
        .def_readonly("score",       &FlowEvent::score)
        .def_readonly("signal",      &FlowEvent::signal)
        .def_readonly("execution",   &FlowEvent::execution)
        .def_readonly("contracts",   &FlowEvent::contracts)
        .def("__repr__", [](const FlowEvent& ev) {
            return "<FlowEvent " + ev.symbol + " " + ev.signal +
                   " score=" + std::to_string(ev.score) + ">";
        });

    py::class_<FlowScorer>(m, "FlowScorer",
        "Unusual options flow scorer (0-100 conviction).")
        .def(py::init<const FlowScorerConfig&>(), py::arg("config") = FlowScorerConfig{})
        .def("score_flow",  &FlowScorer::scoreFlow,  py::arg("orders"),
             "Score a list of OptionsOrder records.  Returns FlowEvent list sorted by score.")
        .def("score_order", &FlowScorer::scoreOrder, py::arg("order"),
             "Score a single order.  score=-1 means filtered by min_premium.");
}
