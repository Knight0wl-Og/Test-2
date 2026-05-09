#pragma once

/**
 * options_pricer.h — Black-Scholes option pricing and Greeks calculator.
 *
 * Functions:
 *   blackScholes()       — price a European call and put
 *   calculateGreeks()    — Delta, Gamma, Theta, Vega, Rho
 *   impliedVolatility()  — solve IV from market price (bisection)
 *
 * All functions are stateless and thread-safe.
 *
 * Parameter conventions (consistent across all functions):
 *   S     — current underlying price (e.g. 450.0)
 *   K     — strike price             (e.g. 455.0)
 *   r     — annualised risk-free rate as a decimal (e.g. 0.05 = 5%)
 *   T     — time to expiry in years  (e.g. 30/365.0 ≈ 0.082)
 *   sigma — annualised implied volatility as a decimal (e.g. 0.25 = 25%)
 */

#include <string>

namespace tradeedge {

// ─── Result types ─────────────────────────────────────────────────────────────

struct OptionPrice {
    double call{0.0};   // European call price
    double put{0.0};    // European put price
};

struct Greeks {
    double delta{0.0};  // ∂V/∂S          — change in price per $1 move in S
    double gamma{0.0};  // ∂²V/∂S²        — change in delta per $1 move in S
    double theta{0.0};  // ∂V/∂t per day  — daily time decay (negative for long)
    double vega{0.0};   // ∂V/∂σ per 1%   — $ change per 1-point IV move
    double rho{0.0};    // ∂V/∂r per 1%   — $ change per 1-point rate move
};

// ─── API ─────────────────────────────────────────────────────────────────────

/**
 * Black-Scholes closed-form prices for European call and put.
 * Returns {0,0} for degenerate inputs (T≤0, sigma≤0, S≤0, K≤0).
 */
OptionPrice blackScholes(double S, double K, double r, double T, double sigma);

/**
 * Compute all five Greeks for either a call or a put.
 * option_type: "call" (default) | "put"
 * Theta is expressed per calendar day.
 * Vega and Rho are expressed per 1 percentage-point move (÷100).
 */
Greeks calculateGreeks(double S, double K, double r, double T, double sigma,
                       const std::string& option_type = "call");

/**
 * Solve implied volatility from an observed market price.
 * Uses bisection on the interval [0.001, 5.0] (0.1% – 500% annualised IV).
 * Returns 0 if the price is outside the solvable range or T≤0.
 */
double impliedVolatility(double S, double K, double r, double T,
                         double market_price,
                         const std::string& option_type = "call",
                         double tol      = 1e-6,
                         int    max_iter = 200);

} // namespace tradeedge
