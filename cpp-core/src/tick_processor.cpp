#include "tradeedge/tick_processor.h"

#include <algorithm>

namespace tradeedge {

TickProcessor::TickProcessor(size_t history_size)
    : history_size_(history_size) {}

void TickProcessor::processTick(const Tick& tick) {
    if (tick.symbol.empty() || tick.price <= 0.0) return;

    std::lock_guard<std::mutex> lock(mutex_);

    auto& hist = history_[tick.symbol];
    auto& st   = stats_[tick.symbol];
    auto& tpv  = cum_tpv_[tick.symbol];
    auto& vol  = cum_vol_[tick.symbol];

    // Maintain bounded history ring
    hist.push_back(tick);
    if (hist.size() > history_size_) hist.pop_front();

    // Initialise session stats on first tick for this symbol
    if (st.tick_count == 0) {
        st.symbol       = tick.symbol;
        st.session_open = tick.price;
        st.session_high = tick.price;
        st.session_low  = tick.price;
    }

    // Update running stats
    st.last_price    = tick.price;
    st.session_high  = std::max(st.session_high, tick.price);
    st.session_low   = std::min(st.session_low,  tick.price);
    st.total_volume += tick.volume;
    ++st.tick_count;

    // VWAP = Σ(price × volume) / Σ(volume)
    // Using last-price as the "typical price" for tick data
    tpv += tick.price * tick.volume;
    vol += tick.volume;
    st.vwap = (vol > 0.0) ? tpv / vol : tick.price;

    // Change vs. session open
    st.price_change     = tick.price - st.session_open;
    st.price_change_pct = (st.session_open > 0.0)
                        ? (st.price_change / st.session_open) * 100.0
                        : 0.0;
}

std::optional<TickStats> TickProcessor::getStats(const std::string& symbol) const {
    std::lock_guard<std::mutex> lock(mutex_);
    auto it = stats_.find(symbol);
    if (it == stats_.end()) return std::nullopt;
    return it->second;
}

std::vector<Tick> TickProcessor::getRecentTicks(const std::string& symbol,
                                                 size_t n) const {
    std::lock_guard<std::mutex> lock(mutex_);
    auto it = history_.find(symbol);
    if (it == history_.end()) return {};

    const auto& dq = it->second;
    size_t count   = std::min(n, dq.size());
    return std::vector<Tick>(dq.end() - static_cast<std::ptrdiff_t>(count), dq.end());
}

void TickProcessor::resetSession(const std::string& symbol) {
    std::lock_guard<std::mutex> lock(mutex_);
    stats_.erase(symbol);
    cum_tpv_.erase(symbol);
    cum_vol_.erase(symbol);
    // Keep history — it may still be useful for scanners
}

void TickProcessor::resetAllSessions() {
    std::lock_guard<std::mutex> lock(mutex_);
    stats_.clear();
    cum_tpv_.clear();
    cum_vol_.clear();
}

size_t TickProcessor::symbolCount() const {
    std::lock_guard<std::mutex> lock(mutex_);
    return history_.size();
}

} // namespace tradeedge
