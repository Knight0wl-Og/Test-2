#include "tradeedge/scanner.h"

#include <algorithm>
#include <cmath>
#include <limits>
#include <string>

namespace tradeedge {

Scanner::Scanner(const ScanConfig& config) : config_(config) {}

// ─── Simple moving average ────────────────────────────────────────────────────

double Scanner::simpleMA(const std::vector<OHLCVBar>& bars, int period, int offset) {
    const int n = static_cast<int>(bars.size());
    if (n < period + offset) return 0.0;

    // Sum bars[(n-1-offset) down to (n-period-offset)]
    double sum  = 0.0;
    int    end  = n - 1 - offset;        // inclusive last bar
    int    beg  = end - period + 1;      // inclusive first bar
    for (int i = beg; i <= end; ++i) sum += bars[static_cast<size_t>(i)].close;
    return sum / period;
}

// ─── Breakout check ───────────────────────────────────────────────────────────

std::optional<ScanResult> Scanner::checkBreakout(
    const std::string&           symbol,
    const std::vector<OHLCVBar>& bars,
    const Tick&                  tick) const
{
    const int period = config_.breakout_period;
    if (static_cast<int>(bars.size()) < period + 1) return std::nullopt;

    // N-period high/low of bars *excluding* the current (last) bar so we are
    // not peeking at the bar whose close equals our tick price.
    double period_high = std::numeric_limits<double>::lowest();
    double period_low  = std::numeric_limits<double>::max();

    const size_t last = bars.size() - 1;           // current bar (skip)
    const size_t beg  = last - static_cast<size_t>(period); // inclusive

    for (size_t i = beg; i < last; ++i) {
        period_high = std::max(period_high, bars[i].high);
        period_low  = std::min(period_low,  bars[i].low);
    }

    const bool bull_break = tick.price > period_high;
    const bool bear_break = tick.price < period_low;
    if (!bull_break && !bear_break) return std::nullopt;

    // Score 60–100: base 60 + up to 40 for how far past the level we are
    const double level    = bull_break ? period_high : period_low;
    const double range    = period_high - period_low;
    const double distance = std::abs(tick.price - level);
    const double score    = std::min(100.0, 60.0 + (range > 0.0 ? distance / range * 40.0 : 0.0));

    ScanResult r;
    r.symbol       = symbol;
    r.signal_type  = SignalType::Breakout;
    r.signal_label = (bull_break ? "Bullish " : "Bearish ")
                   + std::to_string(period) + "-bar Breakout";
    r.score        = score;
    r.price        = tick.price;
    r.volume       = tick.volume;
    r.timestamp_ms = tick.timestamp_ms;
    return r;
}

// ─── Volume-spike check ───────────────────────────────────────────────────────

std::optional<ScanResult> Scanner::checkVolumeSpike(
    const std::string&           symbol,
    const std::vector<OHLCVBar>& bars,
    const Tick&                  tick) const
{
    if (bars.size() < 20) return std::nullopt;

    // Average volume of the 20 most recent bars
    double avg_vol = 0.0;
    const size_t start = bars.size() - 20;
    for (size_t i = start; i < bars.size(); ++i) avg_vol += bars[i].volume;
    avg_vol /= 20.0;

    if (avg_vol <= 0.0) return std::nullopt;

    const double ratio = tick.volume / avg_vol;
    if (ratio < config_.volume_spike_multiplier) return std::nullopt;

    // Score 50–100: base 50 + 5 per extra multiple beyond the threshold
    const double score = std::min(100.0, 50.0 + (ratio - config_.volume_spike_multiplier) * 5.0);

    ScanResult r;
    r.symbol       = symbol;
    r.signal_type  = SignalType::VolumeSpike;
    r.signal_label = "Volume Spike (" + std::to_string(static_cast<int>(ratio)) + "x avg)";
    r.score        = score;
    r.price        = tick.price;
    r.volume       = tick.volume;
    r.timestamp_ms = tick.timestamp_ms;
    return r;
}

// ─── MA-crossover check ───────────────────────────────────────────────────────

std::optional<ScanResult> Scanner::checkMACrossover(
    const std::string&           symbol,
    const std::vector<OHLCVBar>& bars,
    const Tick&                  tick) const
{
    const int fast = config_.ma_fast_period;
    const int slow = config_.ma_slow_period;

    // Need at least slow+2 bars to detect a crossover (current and previous MA pair)
    if (static_cast<int>(bars.size()) < slow + 2) return std::nullopt;

    const double fast_now  = simpleMA(bars, fast, 0);
    const double slow_now  = simpleMA(bars, slow, 0);
    const double fast_prev = simpleMA(bars, fast, 1);
    const double slow_prev = simpleMA(bars, slow, 1);

    if (fast_now == 0.0 || slow_now == 0.0 || fast_prev == 0.0 || slow_prev == 0.0)
        return std::nullopt;

    const bool golden_cross = (fast_prev <= slow_prev) && (fast_now > slow_now);
    const bool death_cross  = (fast_prev >= slow_prev) && (fast_now < slow_now);
    if (!golden_cross && !death_cross) return std::nullopt;

    // Score: base 55 + proportional to separation magnitude (%)
    const double sep   = std::abs(fast_now - slow_now) / slow_now * 100.0;
    const double score = std::min(100.0, 55.0 + sep * 5.0);

    ScanResult r;
    r.symbol       = symbol;
    r.signal_type  = SignalType::MAcrossover;
    r.signal_label = (golden_cross ? "Golden Cross " : "Death Cross ")
                   + std::to_string(fast) + "/" + std::to_string(slow) + " SMA";
    r.score        = score;
    r.price        = tick.price;
    r.volume       = tick.volume;
    r.timestamp_ms = tick.timestamp_ms;
    return r;
}

// ─── Public scan ─────────────────────────────────────────────────────────────

std::vector<ScanResult> Scanner::scan(const std::string&           symbol,
                                      const std::vector<OHLCVBar>& bars,
                                      const Tick&                  tick) const {
    std::vector<ScanResult> results;
    results.reserve(3);

    auto add = [&](std::optional<ScanResult> opt) {
        if (opt && opt->score >= config_.min_score)
            results.push_back(std::move(*opt));
    };

    if (config_.check_breakout)     add(checkBreakout(symbol,     bars, tick));
    if (config_.check_volume_spike) add(checkVolumeSpike(symbol,  bars, tick));
    if (config_.check_ma_crossover) add(checkMACrossover(symbol,  bars, tick));

    std::sort(results.begin(), results.end(),
              [](const ScanResult& a, const ScanResult& b) { return a.score > b.score; });
    return results;
}

std::vector<ScanResult> Scanner::scanAll(
    const std::vector<std::string>&                               symbols,
    const std::function<std::vector<OHLCVBar>(const std::string&)>& barsFetcher,
    const std::function<Tick(const std::string&)>&                  tickFetcher) const
{
    std::vector<ScanResult> all;
    for (const auto& sym : symbols) {
        auto partial = scan(sym, barsFetcher(sym), tickFetcher(sym));
        all.insert(all.end(), partial.begin(), partial.end());
    }
    std::sort(all.begin(), all.end(),
              [](const ScanResult& a, const ScanResult& b) { return a.score > b.score; });
    return all;
}

} // namespace tradeedge
