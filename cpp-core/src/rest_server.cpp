/**
 * rest_server.cpp — lightweight HTTP API exposing the TradeEdge C++ core.
 *
 * Usage:
 *   ./tradeedge_server [port]   (default port: 7331)
 *
 * Endpoints:
 *   GET  /health                         — liveness probe
 *   GET  /price?S=&K=&r=&T=&sigma=       — Black-Scholes call/put price
 *   GET  /greeks?S=&K=&r=&T=&sigma=&type= — Greeks for call or put
 *   GET  /iv?S=&K=&r=&T=&market_price=&type= — implied volatility
 *   POST /backtest   { symbol, strategy, bars[], config? } — run backtest
 *   POST /flow       { orders[] }        — score options flow
 *   POST /tick       { symbol, price, volume, timestamp_ms } — ingest tick
 *   GET  /stats?symbol=                  — session stats for symbol
 */

#include "httplib.h"
#include <nlohmann/json.hpp>

#include "tradeedge/options_pricer.h"
#include "tradeedge/backtester.h"
#include "tradeedge/flow_scorer.h"
#include "tradeedge/tick_processor.h"

#include <cstdlib>
#include <iostream>
#include <string>

using json = nlohmann::json;
using namespace tradeedge;

// ─── JSON serialisation helpers ───────────────────────────────────────────────

static json to_json(const Greeks& g) {
    return { {"delta", g.delta}, {"gamma", g.gamma},
             {"theta", g.theta}, {"vega",  g.vega},  {"rho",  g.rho} };
}

static json to_json(const FlowEvent& ev) {
    return {
        {"symbol",      ev.symbol},
        {"strike",      ev.strike},
        {"expiry",      ev.expiry},
        {"option_type", ev.option_type},
        {"premium",     ev.premium},
        {"score",       ev.score},
        {"signal",      ev.signal},
        {"execution",   ev.execution},
        {"contracts",   ev.contracts},
        {"timestamp_ms",ev.timestamp_ms},
    };
}

static json to_json(const BacktestResult& r) {
    return {
        {"total_return_pct",  r.total_return_pct},
        {"final_equity",      r.final_equity},
        {"max_drawdown_pct",  r.max_drawdown_pct},
        {"sharpe_ratio",      r.sharpe_ratio},
        {"win_rate",          r.win_rate},
        {"total_trades",      r.total_trades},
        {"winning_trades",    r.winning_trades},
        {"losing_trades",     r.losing_trades},
        {"profit_factor",     r.profit_factor},
        {"avg_win_pct",       r.avg_win_pct},
        {"avg_loss_pct",      r.avg_loss_pct},
        {"equity_curve",      r.equity_curve},
    };
}

static json to_json(const TickStats& s) {
    return {
        {"symbol",           s.symbol},
        {"last_price",       s.last_price},
        {"vwap",             s.vwap},
        {"total_volume",     s.total_volume},
        {"price_change",     s.price_change},
        {"price_change_pct", s.price_change_pct},
        {"session_high",     s.session_high},
        {"session_low",      s.session_low},
        {"tick_count",       s.tick_count},
    };
}

// ─── Error response helper ────────────────────────────────────────────────────

static void bad_request(httplib::Response& res, const std::string& msg) {
    res.status = 400;
    res.set_content(json{{"error", msg}}.dump(), "application/json");
}

// ─── main ─────────────────────────────────────────────────────────────────────

int main(int argc, char* argv[]) {
    const int port = (argc >= 2) ? std::atoi(argv[1]) : 7331;

    httplib::Server svr;

    // Shared stateful objects (persist across requests)
    TickProcessor tick_proc(5000);
    FlowScorer    flow_scorer;

    // ── CORS — allow calls from the React dev server and Electron ─────────
    svr.set_pre_routing_handler([](const httplib::Request&, httplib::Response& res) {
        res.set_header("Access-Control-Allow-Origin",  "*");
        res.set_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        res.set_header("Access-Control-Allow-Headers", "Content-Type");
        return httplib::Server::HandlerResponse::Unhandled;
    });
    svr.Options(".*", [](const httplib::Request&, httplib::Response& res) {
        res.status = 204;
    });

    // ── GET /health ────────────────────────────────────────────────────────
    svr.Get("/health", [](const httplib::Request&, httplib::Response& res) {
        res.set_content(
            json{{"status","ok"},{"engine","tradeedge-core"},{"version","1.0.0"}}.dump(),
            "application/json");
    });

    // ── GET /price?S=&K=&r=&T=&sigma= ─────────────────────────────────────
    svr.Get("/price", [](const httplib::Request& req, httplib::Response& res) {
        try {
            const double S     = std::stod(req.get_param_value("S"));
            const double K     = std::stod(req.get_param_value("K"));
            const double r     = std::stod(req.get_param_value("r"));
            const double T     = std::stod(req.get_param_value("T"));
            const double sigma = std::stod(req.get_param_value("sigma"));
            const auto   p     = blackScholes(S, K, r, T, sigma);
            res.set_content(json{{"call", p.call}, {"put", p.put}}.dump(),
                            "application/json");
        } catch (const std::exception& e) { bad_request(res, e.what()); }
    });

    // ── GET /greeks?S=&K=&r=&T=&sigma=&type= ──────────────────────────────
    svr.Get("/greeks", [](const httplib::Request& req, httplib::Response& res) {
        try {
            const double S     = std::stod(req.get_param_value("S"));
            const double K     = std::stod(req.get_param_value("K"));
            const double r     = std::stod(req.get_param_value("r"));
            const double T     = std::stod(req.get_param_value("T"));
            const double sigma = std::stod(req.get_param_value("sigma"));
            const std::string type = req.has_param("type")
                                   ? req.get_param_value("type") : "call";
            res.set_content(to_json(calculateGreeks(S, K, r, T, sigma, type)).dump(),
                            "application/json");
        } catch (const std::exception& e) { bad_request(res, e.what()); }
    });

    // ── GET /iv?S=&K=&r=&T=&market_price=&type= ───────────────────────────
    svr.Get("/iv", [](const httplib::Request& req, httplib::Response& res) {
        try {
            const double S            = std::stod(req.get_param_value("S"));
            const double K            = std::stod(req.get_param_value("K"));
            const double r            = std::stod(req.get_param_value("r"));
            const double T            = std::stod(req.get_param_value("T"));
            const double market_price = std::stod(req.get_param_value("market_price"));
            const std::string type    = req.has_param("type")
                                      ? req.get_param_value("type") : "call";
            const double iv = impliedVolatility(S, K, r, T, market_price, type);
            res.set_content(json{{"iv", iv}, {"iv_pct", iv * 100.0}}.dump(),
                            "application/json");
        } catch (const std::exception& e) { bad_request(res, e.what()); }
    });

    // ── POST /backtest ─────────────────────────────────────────────────────
    // Body: {
    //   "symbol": "AAPL",
    //   "strategy": { "type": "sma", "fast": 10, "slow": 50 },
    //   "bars": [ { "timestamp":…, "open":…, "high":…, "low":…,
    //               "close":…, "volume":… }, … ],
    //   "config": { "initial_capital": 100000, … }   (optional)
    // }
    svr.Post("/backtest", [](const httplib::Request& req, httplib::Response& res) {
        try {
            const auto body   = json::parse(req.body);
            const std::string symbol = body.value("symbol", "UNKNOWN");

            // Config (all fields optional — defaults are in BacktestConfig{})
            BacktestConfig cfg;
            if (body.contains("config")) {
                const auto& c = body["config"];
                cfg.initial_capital      = c.value("initial_capital",      cfg.initial_capital);
                cfg.commission_per_trade = c.value("commission_per_trade",  cfg.commission_per_trade);
                cfg.slippage_pct         = c.value("slippage_pct",          cfg.slippage_pct);
                cfg.position_size_pct    = c.value("position_size_pct",     cfg.position_size_pct);
                cfg.stop_loss_pct        = c.value("stop_loss_pct",         cfg.stop_loss_pct);
                cfg.take_profit_pct      = c.value("take_profit_pct",       cfg.take_profit_pct);
            }

            // Parse bars array
            std::vector<OHLCVBar> bars;
            bars.reserve(body["bars"].size());
            for (const auto& b : body["bars"]) {
                OHLCVBar bar;
                bar.timestamp = b.value("timestamp", int64_t{0});
                bar.open      = b.value("open",   0.0);
                bar.high      = b.value("high",   0.0);
                bar.low       = b.value("low",    0.0);
                bar.close     = b.value("close",  0.0);
                bar.volume    = b.value("volume", 0.0);
                bars.push_back(bar);
            }

            // Strategy
            const auto& s     = body["strategy"];
            const std::string stype = s.value("type", "sma");
            if (stype != "sma") {
                bad_request(res, "unknown strategy type '" + stype +
                            "' — only 'sma' is supported");
                return;
            }
            const int fast = s.value("fast", 10);
            const int slow = s.value("slow", 50);

            const auto result = runBacktestSMA(symbol, bars, fast, slow, cfg);
            res.set_content(to_json(result).dump(), "application/json");

        } catch (const std::exception& e) { bad_request(res, e.what()); }
    });

    // ── POST /flow ─────────────────────────────────────────────────────────
    // Body: {
    //   "orders": [
    //     { "symbol":"SPY", "strike":500, "expiry":"2025-06-20",
    //       "option_type":"call", "premium":750000, "spot_price":498,
    //       "contracts":1500, "execution":"sweep", "timestamp_ms":… }
    //   ]
    // }
    svr.Post("/flow", [&](const httplib::Request& req, httplib::Response& res) {
        try {
            const auto body = json::parse(req.body);
            std::vector<OptionsOrder> orders;
            orders.reserve(body["orders"].size());

            for (const auto& item : body["orders"]) {
                OptionsOrder o;
                o.symbol       = item.value("symbol",       "");
                o.strike       = item.value("strike",       0.0);
                o.expiry       = item.value("expiry",       "");
                o.option_type  = item.value("option_type",  "call");
                o.premium      = item.value("premium",      0.0);
                o.spot_price   = item.value("spot_price",   0.0);
                o.contracts    = item.value("contracts",    int64_t{0});
                o.execution    = item.value("execution",    "block");
                o.timestamp_ms = item.value("timestamp_ms", int64_t{0});
                orders.push_back(o);
            }

            const auto events = flow_scorer.scoreFlow(orders);
            json result = json::array();
            for (const auto& ev : events) result.push_back(to_json(ev));
            res.set_content(json{{"events", result}}.dump(), "application/json");

        } catch (const std::exception& e) { bad_request(res, e.what()); }
    });

    // ── POST /tick ─────────────────────────────────────────────────────────
    // Body: { "symbol":"AAPL", "price":175.50, "volume":12500, "timestamp_ms":… }
    svr.Post("/tick", [&](const httplib::Request& req, httplib::Response& res) {
        try {
            const auto body = json::parse(req.body);
            Tick tick;
            tick.symbol       = body.value("symbol",       "");
            tick.price        = body.value("price",        0.0);
            tick.volume       = body.value("volume",       0.0);
            tick.timestamp_ms = body.value("timestamp_ms", int64_t{0});
            tick_proc.processTick(tick);
            res.set_content(R"({"ok":true})", "application/json");
        } catch (const std::exception& e) { bad_request(res, e.what()); }
    });

    // ── GET /stats?symbol=AAPL ─────────────────────────────────────────────
    svr.Get("/stats", [&](const httplib::Request& req, httplib::Response& res) {
        try {
            const std::string symbol = req.get_param_value("symbol");
            const auto stats = tick_proc.getStats(symbol);
            if (!stats) {
                res.status = 404;
                res.set_content(json{{"error","symbol not found — no ticks ingested yet"}}.dump(),
                                "application/json");
                return;
            }
            res.set_content(to_json(*stats).dump(), "application/json");
        } catch (const std::exception& e) { bad_request(res, e.what()); }
    });

    // ── Start ──────────────────────────────────────────────────────────────
    std::cout << "[tradeedge-core] Server listening on http://127.0.0.1:" << port << "\n";
    std::cout << "[tradeedge-core] Endpoints: /health /price /greeks /iv "
                 "/backtest /flow /tick /stats\n";

    if (!svr.listen("127.0.0.1", port)) {
        std::cerr << "[tradeedge-core] ERROR: could not bind to port " << port << "\n";
        return 1;
    }
    return 0;
}
