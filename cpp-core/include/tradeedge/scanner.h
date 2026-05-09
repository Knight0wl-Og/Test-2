#pragma once

/**
 * scanner.h — real-time signal scanner over OHLCV bars + live ticks.
 *
 * The Scanner checks three families of conditions:
 *   1. Breakout     — price exceeds the N-bar high or falls below N-bar low
 *   2. VolumeSpike  — current-bar volume exceeds X × 20-bar average
 *   3. MAcrossover  — fast SMA crosses above/below slow SMA
 *
 * Results carry a 0-100 conviction score and are sorted highest-first.
 * Only results at or above ScanConfig::min_score are returned.
 */

#include "tradeedge/types.h"
#include <functional>
#include <optional>
#include <string>
#include <vector>

namespace tradeedge {

// ─── Signal type ─────────────────────────────────────────────────────────────

enum class SignalType {
    Breakout,
    VolumeSpike,
    MAcrossover,
    FlowAlert,   // reserved for future use by FlowScorer integration
};

// ─── Configuration ────────────────────────────────────────────────────────────

struct ScanConfig {
    // Breakout: price breaks the N-period high / low
    bool   check_breakout{true};
    int    breakout_period{20};           // look-back in bars

    // Volume spike: volume > multiplier × 20-bar average
    bool   check_volume_spike{true};
    double volume_spike_multiplier{2.5};

    // MA crossover: fast SMA crosses slow SMA
    bool   check_ma_crossover{true};
    int    ma_fast_period{10};
    int    ma_slow_period{50};

    // Signals below this score are dropped
    double min_score{50.0};
};

// ─── Scan result ─────────────────────────────────────────────────────────────

struct ScanResult {
    std::string symbol;
    SignalType  signal_type{SignalType::Breakout};
    std::string signal_label;   // human-readable, e.g. "Bullish 20-period Breakout"
    double      score{0.0};     // 0–100 conviction
    double      price{0.0};
    double      volume{0.0};
    int64_t     timestamp_ms{0};
};

// ─── Scanner ─────────────────────────────────────────────────────────────────

class Scanner {
public:
    explicit Scanner(const ScanConfig& config = {});

    /**
     * Scan a single symbol.
     * bars       — historical OHLCV context (oldest first)
     * latest_tick — the most-recent price / volume event
     * Returns all signals above min_score, sorted by score descending.
     */
    std::vector<ScanResult> scan(const std::string&          symbol,
                                 const std::vector<OHLCVBar>& bars,
                                 const Tick&                  latest_tick) const;

    /**
     * Convenience: scan a list of symbols, fetching bars and ticks
     * via caller-supplied lambdas.  Results are merged and re-sorted.
     */
    std::vector<ScanResult> scanAll(
        const std::vector<std::string>&                               symbols,
        const std::function<std::vector<OHLCVBar>(const std::string&)>& barsFetcher,
        const std::function<Tick(const std::string&)>&                  tickFetcher
    ) const;

    void              setConfig(const ScanConfig& config) { config_ = config; }
    const ScanConfig& config()                      const { return config_; }

private:
    ScanConfig config_;

    std::optional<ScanResult> checkBreakout(const std::string&,
                                            const std::vector<OHLCVBar>&,
                                            const Tick&) const;
    std::optional<ScanResult> checkVolumeSpike(const std::string&,
                                               const std::vector<OHLCVBar>&,
                                               const Tick&) const;
    std::optional<ScanResult> checkMACrossover(const std::string&,
                                               const std::vector<OHLCVBar>&,
                                               const Tick&) const;

    // Simple moving average of the last `period` closes.
    // offset=0  → MA ending at bars.back()
    // offset=1  → MA ending at bars[bars.size()-2]  (previous bar)
    static double simpleMA(const std::vector<OHLCVBar>& bars,
                           int period, int offset = 0);
};

} // namespace tradeedge
