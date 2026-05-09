#pragma once

/**
 * tick_processor.h — thread-safe real-time tick ingestion and session stats.
 *
 * TickProcessor maintains a bounded ring-buffer of recent ticks per symbol
 * and computes live session statistics (VWAP, session H/L, price change).
 * All public methods acquire a shared mutex and are safe to call from
 * multiple threads simultaneously.
 */

#include "tradeedge/types.h"
#include <deque>
#include <mutex>
#include <optional>
#include <string>
#include <unordered_map>
#include <vector>

namespace tradeedge {

// ─── Session statistics ───────────────────────────────────────────────────────

struct TickStats {
    std::string symbol;
    double      last_price{0.0};
    double      vwap{0.0};              // volume-weighted average price (session)
    double      total_volume{0.0};      // cumulative session volume
    double      price_change{0.0};      // vs. session open
    double      price_change_pct{0.0};  // vs. session open (%)
    int         tick_count{0};
    double      session_high{0.0};
    double      session_low{0.0};
    double      session_open{0.0};
};

// ─── TickProcessor ────────────────────────────────────────────────────────────

class TickProcessor {
public:
    /**
     * history_size — maximum ticks kept per symbol (oldest are evicted).
     * Default 1000 ticks ≈ ~16 minutes of 1-second data for a liquid name.
     */
    explicit TickProcessor(size_t history_size = 1000);

    // Feed a new market tick.  Ignored if symbol is empty or price ≤ 0.
    void processTick(const Tick& tick);

    // Current session statistics for a symbol, or nullopt if unseen.
    std::optional<TickStats> getStats(const std::string& symbol) const;

    // Up to n most-recent ticks for a symbol (oldest first).
    std::vector<Tick> getRecentTicks(const std::string& symbol,
                                     size_t n = 100) const;

    // Reset session stats for one symbol (e.g. at market open).
    void resetSession(const std::string& symbol);

    // Reset all session stats.
    void resetAllSessions();

    // Number of distinct symbols seen so far.
    size_t symbolCount() const;

private:
    size_t history_size_;
    mutable std::mutex mutex_;

    std::unordered_map<std::string, std::deque<Tick>>  history_;
    std::unordered_map<std::string, TickStats>         stats_;
    std::unordered_map<std::string, double>            cum_tpv_;  // TP × V running total
    std::unordered_map<std::string, double>            cum_vol_;  // volume running total
};

} // namespace tradeedge
