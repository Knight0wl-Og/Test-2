/**
 * test_options.cpp — unit tests for the options pricer.
 *
 * Build:  cmake -DBUILD_TESTS=ON .. && cmake --build .
 * Run:    ./test_options   (or ctest)
 *
 * Expected: all PASS, exit code 0.
 */

#include "tradeedge/options_pricer.h"

#include <cmath>
#include <iomanip>
#include <iostream>

using namespace tradeedge;

// ─── Minimal test harness ─────────────────────────────────────────────────────

static int s_run = 0, s_pass = 0;

static void check_near(double got, double expected, double tol,
                       const char* label) {
    ++s_run;
    const bool ok = std::abs(got - expected) <= tol;
    std::cout << (ok ? "  PASS" : "  FAIL") << "  " << label;
    if (!ok) std::cout << "  (got " << got << ", expected ~" << expected << ")";
    std::cout << "\n";
    if (ok) ++s_pass;
}

static void check_true(bool cond, const char* label) {
    ++s_run;
    std::cout << (cond ? "  PASS" : "  FAIL") << "  " << label << "\n";
    if (cond) ++s_pass;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

static void test_atm_pricing() {
    std::cout << "\n[ATM pricing: S=100, K=100, r=5%, T=1yr, σ=20%]\n";
    // Textbook reference: call ≈ 10.4506  (Hull, "Options, Futures, Derivatives")
    const auto p = blackScholes(100.0, 100.0, 0.05, 1.0, 0.20);
    check_near(p.call, 10.4506, 0.01, "call price ≈ 10.45");

    // Put–call parity: C - P = S - K·e^(−rT)
    const double parity_lhs = p.call - p.put;
    const double parity_rhs = 100.0 - 100.0 * std::exp(-0.05 * 1.0);
    check_near(parity_lhs - parity_rhs, 0.0, 0.001, "put–call parity holds");
}

static void test_deep_itm_call() {
    std::cout << "\n[Deep ITM call: S=150, K=100, T=0.25yr]\n";
    const auto p = blackScholes(150.0, 100.0, 0.05, 0.25, 0.20);
    // Must be worth at least intrinsic value S - K·e^(−rT)
    const double intrinsic = 150.0 - 100.0 * std::exp(-0.05 * 0.25);
    check_true(p.call >= intrinsic - 0.01, "call >= intrinsic value");
    check_true(p.call > 50.0,              "call > $50");
}

static void test_near_zero_theta() {
    std::cout << "\n[Short T: S=100, K=100, T=1day]\n";
    const auto p = blackScholes(100.0, 100.0, 0.05, 1.0 / 365.0, 0.20);
    check_true(p.call >= 0.0, "call price non-negative for T=1day");
    check_true(p.call < 2.0,  "call price small for T=1day");
}

static void test_zero_t_returns_zero() {
    std::cout << "\n[Edge: T=0]\n";
    const auto p = blackScholes(100.0, 100.0, 0.05, 0.0, 0.20);
    check_near(p.call, 0.0, 0.001, "T=0 → call = 0");
    check_near(p.put,  0.0, 0.001, "T=0 → put  = 0");
}

static void test_greeks_atm_call() {
    std::cout << "\n[Greeks: ATM call, S=100, K=100, r=5%, T=1yr, σ=20%]\n";
    const auto g = calculateGreeks(100.0, 100.0, 0.05, 1.0, 0.20, "call");

    // ATM call delta ≈ 0.636 (with positive drift term)
    check_near(g.delta, 0.636, 0.05, "delta ≈ 0.636");
    check_true(g.gamma > 0.0,        "gamma > 0");
    check_true(g.theta < 0.0,        "theta < 0 (time decay)");
    check_true(g.vega  > 0.0,        "vega  > 0");
    check_true(g.rho   > 0.0,        "rho   > 0 (call)");
}

static void test_greeks_atm_put() {
    std::cout << "\n[Greeks: ATM put, S=100, K=100, r=5%, T=1yr, σ=20%]\n";
    const auto gc = calculateGreeks(100.0, 100.0, 0.05, 1.0, 0.20, "call");
    const auto gp = calculateGreeks(100.0, 100.0, 0.05, 1.0, 0.20, "put");

    // Δcall − Δput = 1  (put–call delta parity)
    check_near(gc.delta - gp.delta, 1.0, 0.001, "Δcall - Δput = 1");
    // Gamma is symmetric
    check_near(gc.gamma, gp.gamma, 1e-9, "gamma same for call/put");
    // Vega is symmetric
    check_near(gc.vega,  gp.vega,  1e-9, "vega  same for call/put");
    // Put rho is negative
    check_true(gp.rho < 0.0,            "put rho < 0");
}

static void test_iv_roundtrip_call() {
    std::cout << "\n[IV round-trip: call, σ=25%]\n";
    const double known  = 0.25;
    const auto   p      = blackScholes(100.0, 100.0, 0.05, 0.5, known);
    const double solved = impliedVolatility(100.0, 100.0, 0.05, 0.5, p.call, "call");
    check_near(solved, known, 0.001, "IV recovered to < 0.1%");
}

static void test_iv_roundtrip_put() {
    std::cout << "\n[IV round-trip: put, σ=35%]\n";
    const double known  = 0.35;
    const auto   p      = blackScholes(100.0, 105.0, 0.05, 0.25, known);
    const double solved = impliedVolatility(100.0, 105.0, 0.05, 0.25, p.put, "put");
    check_near(solved, known, 0.001, "IV recovered to < 0.1%");
}

static void test_iv_otm() {
    std::cout << "\n[IV OTM: S=450, K=460, T=30d, σ=22%]\n";
    const double known  = 0.22;
    const auto   p      = blackScholes(450.0, 460.0, 0.05, 30.0/365.0, known);
    const double solved = impliedVolatility(450.0, 460.0, 0.05, 30.0/365.0, p.call, "call");
    check_near(solved, known, 0.002, "OTM IV recovered to < 0.2%");
}

// ─── Main ─────────────────────────────────────────────────────────────────────

int main() {
    std::cout << std::fixed << std::setprecision(6);
    std::cout << "══════════════════════════════════════\n";
    std::cout << " TradeEdge Options Pricer — Unit Tests\n";
    std::cout << "══════════════════════════════════════\n";

    test_atm_pricing();
    test_deep_itm_call();
    test_near_zero_theta();
    test_zero_t_returns_zero();
    test_greeks_atm_call();
    test_greeks_atm_put();
    test_iv_roundtrip_call();
    test_iv_roundtrip_put();
    test_iv_otm();

    std::cout << "\n──────────────────────────────────────\n";
    std::cout << " Results: " << s_pass << " / " << s_run << " passed\n";
    std::cout << "──────────────────────────────────────\n";

    return (s_pass == s_run) ? 0 : 1;
}
