#pragma once

/**
 * flow_scorer.h — unusual options flow detection and conviction scoring.
 *
 * The FlowScorer receives a batch of OptionsOrder records and scores each one
 * on a 0-100 scale based on:
 *   • Premium size (larger = higher conviction)
 *   • Execution type: sweeps score highest (urgency), blocks next, splits lowest
 *   • OTM flag: out-of-the-money options indicate directional conviction
 *   • Contract count contribution
 *
 * Orders below FlowScorerConfig::min_premium are filtered out entirely.
 * Results are returned sorted by score descending.
 */

#include "tradeedge/types.h"
#include <string>
#include <vector>

namespace tradeedge {

// ─── Scored flow event ────────────────────────────────────────────────────────

struct FlowEvent {
    std::string symbol;
    double      strike{0.0};
    std::string expiry;
    std::string option_type;   // "call" | "put"
    double      premium{0.0};  // total notional ($)
    double      spot_price{0.0};
    int64_t     contracts{0};
    double      score{0.0};    // 0-100 conviction; -1 means filtered (below min)
    std::string signal;        // "Bullish Sweep", "Large Bearish Block", etc.
    std::string execution;     // "sweep" | "block" | "split"
    int64_t     timestamp_ms{0};
};

// ─── Configuration ────────────────────────────────────────────────────────────

struct FlowScorerConfig {
    double min_premium{50'000.0};            // orders below this are dropped
    double large_block_threshold{500'000.0}; // above this = "Large" label
    double sweep_score_bonus{10.0};          // extra points for sweep urgency
    double otm_bonus{5.0};                   // extra points for OTM direction
};

// ─── FlowScorer ───────────────────────────────────────────────────────────────

class FlowScorer {
public:
    explicit FlowScorer(const FlowScorerConfig& config = {});

    /**
     * Score a batch of options orders.
     * Returns only events that pass the min_premium filter,
     * sorted by score descending.
     */
    std::vector<FlowEvent> scoreFlow(const std::vector<OptionsOrder>& orders) const;

    /**
     * Score a single order.
     * Returns the FlowEvent with score=-1 if filtered by min_premium.
     */
    FlowEvent scoreOrder(const OptionsOrder& order) const;

    void                    setConfig(const FlowScorerConfig& c) { config_ = c; }
    const FlowScorerConfig& config()                       const { return config_; }

private:
    FlowScorerConfig config_;
};

} // namespace tradeedge
