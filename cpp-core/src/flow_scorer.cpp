#include "tradeedge/flow_scorer.h"

#include <algorithm>
#include <cmath>

namespace tradeedge {

FlowScorer::FlowScorer(const FlowScorerConfig& config) : config_(config) {}

FlowEvent FlowScorer::scoreOrder(const OptionsOrder& order) const {
    FlowEvent ev;
    ev.symbol       = order.symbol;
    ev.strike       = order.strike;
    ev.expiry       = order.expiry;
    ev.option_type  = order.option_type;
    ev.premium      = order.premium;
    ev.spot_price   = order.spot_price;
    ev.contracts    = order.contracts;
    ev.execution    = order.execution;
    ev.timestamp_ms = order.timestamp_ms;

    // Filter below minimum premium threshold
    if (order.premium < config_.min_premium) {
        ev.score = -1.0;
        return ev;
    }

    double score = 0.0;

    // ── 1. Premium size: 0–40 pts (log scale so diminishing returns) ─────────
    // $50K (min) → ~0 pts, $500K → ~20 pts, $5M+ → ~40 pts
    const double premium_norm =
        std::min(40.0, std::log10(order.premium / config_.min_premium + 1.0) * 20.0);
    score += premium_norm;

    // ── 2. Execution type ──────────────────────────────────────────────────────
    const bool is_call = (order.option_type != "put");

    if (order.execution == "sweep") {
        // Sweeps hit multiple exchanges at once — signals urgency / insider intent
        score += 25.0 + config_.sweep_score_bonus;
        ev.signal = is_call ? "Bullish Sweep" : "Bearish Sweep";

    } else if (order.execution == "block") {
        // Single large institutional print
        score += 20.0;
        if (order.premium >= config_.large_block_threshold) {
            ev.signal = is_call ? "Large Bullish Block" : "Large Bearish Block";
        } else {
            ev.signal = is_call ? "Bullish Block" : "Bearish Block";
        }

    } else {
        // Split fill — lower conviction
        score += 10.0;
        ev.signal = is_call ? "Bullish Split" : "Bearish Split";
    }

    // ── 3. OTM bonus — directional conviction ─────────────────────────────────
    if (order.spot_price > 0.0) {
        const bool otm_call = (is_call  && order.strike > order.spot_price);
        const bool otm_put  = (!is_call && order.strike < order.spot_price);
        if (otm_call || otm_put) score += config_.otm_bonus;
    }

    // ── 4. Contract count contribution: 0–10 pts ─────────────────────────────
    // 1 000 contracts = full 10 pts
    score += std::min(10.0, static_cast<double>(order.contracts) / 100.0);

    ev.score = std::min(100.0, score);
    return ev;
}

std::vector<FlowEvent> FlowScorer::scoreFlow(
    const std::vector<OptionsOrder>& orders) const
{
    std::vector<FlowEvent> results;
    results.reserve(orders.size());

    for (const auto& order : orders) {
        auto ev = scoreOrder(order);
        if (ev.score >= 0.0) results.push_back(std::move(ev));
    }

    // Sort by conviction score descending
    std::sort(results.begin(), results.end(),
              [](const FlowEvent& a, const FlowEvent& b) { return a.score > b.score; });
    return results;
}

} // namespace tradeedge
