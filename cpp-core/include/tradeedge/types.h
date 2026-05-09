#pragma once

/**
 * types.h — shared data structures used across all TradeEdge C++ modules.
 *
 * Keep this header lean: no heavy dependencies, no templates beyond basic STL.
 * Every other module includes this file.
 */

#include <string>
#include <vector>
#include <cstdint>

namespace tradeedge {

// ─── Market data ──────────────────────────────────────────────────────────────

/**
 * A single real-time price tick from a market data feed.
 * timestamp_ms is Unix epoch in milliseconds.
 */
struct Tick {
    std::string symbol;
    double      price{0.0};
    double      volume{0.0};   // volume for this tick (shares / contracts)
    int64_t     timestamp_ms{0};
};

/**
 * One OHLCV bar — used for historical data and backtesting.
 * timestamp is Unix epoch in seconds (start of the bar's period).
 */
struct OHLCVBar {
    int64_t timestamp{0};
    double  open{0.0};
    double  high{0.0};
    double  low{0.0};
    double  close{0.0};
    double  volume{0.0};
};

// ─── Options ─────────────────────────────────────────────────────────────────

/**
 * A single options order record — input to the FlowScorer.
 * premium = total notional premium paid (price × 100 × contracts).
 * execution: "sweep" | "block" | "split"
 */
struct OptionsOrder {
    std::string symbol;
    double      strike{0.0};
    std::string expiry;        // "YYYY-MM-DD"
    std::string option_type;   // "call" | "put"
    double      premium{0.0};  // total notional, e.g. $250,000
    double      spot_price{0.0};
    int64_t     contracts{0};
    std::string execution;     // "sweep" | "block" | "split"
    int64_t     timestamp_ms{0};
};

} // namespace tradeedge
