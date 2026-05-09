#include "tradeedge/options_pricer.h"

#include <algorithm>
#include <cmath>
#include <stdexcept>

namespace tradeedge {

// ─── Math helpers ─────────────────────────────────────────────────────────────

// Avoid MSVC / portability issues with M_PI
static constexpr double kPI = 3.14159265358979323846;

// Standard normal PDF: φ(x) = exp(-x²/2) / √(2π)
static inline double norm_pdf(double x) noexcept {
    return std::exp(-0.5 * x * x) / std::sqrt(2.0 * kPI);
}

// Standard normal CDF via Abramowitz & Stegun 26.2.17 — max error < 7.5e-8
static double norm_cdf(double x) noexcept {
    if (x < -8.0) return 0.0;
    if (x >  8.0) return 1.0;

    constexpr double p  =  0.2316419;
    constexpr double a1 =  0.319381530;
    constexpr double a2 = -0.356563782;
    constexpr double a3 =  1.781477937;
    constexpr double a4 = -1.821255978;
    constexpr double a5 =  1.330274429;

    const double t    = 1.0 / (1.0 + p * std::abs(x));
    const double poly = t * (a1 + t * (a2 + t * (a3 + t * (a4 + t * a5))));
    const double cdf  = 1.0 - norm_pdf(x) * poly;
    return x >= 0.0 ? cdf : 1.0 - cdf;
}

// ─── d1 / d2 ─────────────────────────────────────────────────────────────────

static inline double d1(double S, double K, double r, double T, double sigma) noexcept {
    return (std::log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * std::sqrt(T));
}
static inline double d2(double d1_val, double T, double sigma) noexcept {
    return d1_val - sigma * std::sqrt(T);
}

// ─── Black-Scholes ─────────────────────────────────────────────────────────────

OptionPrice blackScholes(double S, double K, double r, double T, double sigma) {
    if (T <= 0.0 || sigma <= 0.0 || S <= 0.0 || K <= 0.0) return {};

    const double D1   = d1(S, K, r, T, sigma);
    const double D2   = d2(D1, T, sigma);
    const double disc = std::exp(-r * T);

    OptionPrice p;
    p.call = S * norm_cdf(D1)  - K * disc * norm_cdf(D2);
    p.put  = K * disc * norm_cdf(-D2) - S  * norm_cdf(-D1);
    return p;
}

// ─── Greeks ───────────────────────────────────────────────────────────────────

Greeks calculateGreeks(double S, double K, double r, double T, double sigma,
                       const std::string& option_type) {
    if (T <= 0.0 || sigma <= 0.0 || S <= 0.0 || K <= 0.0) return {};

    const bool   is_call = (option_type != "put");
    const double sqrtT   = std::sqrt(T);
    const double D1      = d1(S, K, r, T, sigma);
    const double D2      = d2(D1, T, sigma);
    const double disc    = std::exp(-r * T);
    const double nd1     = norm_pdf(D1);    // φ(d1)
    const double Nd1     = norm_cdf(D1);    // Φ(d1)
    const double Nd2     = norm_cdf(D2);    // Φ(d2)

    Greeks g;

    // Delta — Φ(d1) for call, Φ(d1)−1 for put
    g.delta = is_call ? Nd1 : Nd1 - 1.0;

    // Gamma — same for call and put: φ(d1) / (S · σ · √T)
    g.gamma = nd1 / (S * sigma * sqrtT);

    // Theta — per calendar day (÷365).  Put formula differs in sign of last term.
    const double theta_base = -(S * nd1 * sigma) / (2.0 * sqrtT);
    if (is_call) {
        g.theta = (theta_base - r * K * disc * Nd2)         / 365.0;
    } else {
        g.theta = (theta_base + r * K * disc * norm_cdf(-D2)) / 365.0;
    }

    // Vega — S · φ(d1) · √T / 100  (per 1 percentage-point change in σ)
    g.vega = S * nd1 * sqrtT / 100.0;

    // Rho — K · T · e^(−rT) · Φ(±d2) / 100  (per 1 pp change in r)
    if (is_call) {
        g.rho =  K * T * disc * Nd2          / 100.0;
    } else {
        g.rho = -K * T * disc * norm_cdf(-D2) / 100.0;
    }

    return g;
}

// ─── Implied Volatility ────────────────────────────────────────────────────────

double impliedVolatility(double S, double K, double r, double T,
                         double market_price, const std::string& option_type,
                         double tol, int max_iter) {
    if (T <= 0.0 || market_price <= 0.0 || S <= 0.0 || K <= 0.0) return 0.0;

    const bool is_call = (option_type != "put");

    auto price_fn = [&](double sigma) -> double {
        const auto p = blackScholes(S, K, r, T, sigma);
        return is_call ? p.call : p.put;
    };

    // Bracket search: bisect on [lo, hi]
    double lo = 0.001, hi = 5.0;

    // Verify the bracket actually straddles the target
    if (price_fn(lo) > market_price) return lo;  // extremely low vol
    if (price_fn(hi) < market_price) return hi;  // extremely high vol

    // Bisection (more robust than Newton-Raphson for deep ITM/OTM)
    double sigma = 0.25;
    for (int i = 0; i < max_iter; ++i) {
        sigma = 0.5 * (lo + hi);
        double err = price_fn(sigma) - market_price;
        if (std::abs(err) < tol) return sigma;
        if (err < 0.0) lo = sigma;
        else           hi = sigma;
    }
    return sigma;
}

} // namespace tradeedge
