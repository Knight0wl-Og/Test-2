#!/usr/bin/env bash
# build.sh — build the TradeEdge C++ core on Linux / macOS
# Usage: ./scripts/build.sh [clean]
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BUILD="$ROOT/build"

if [[ "${1:-}" == "clean" ]]; then
    echo "Cleaning $BUILD ..."
    rm -rf "$BUILD"
fi

mkdir -p "$BUILD"
cd "$BUILD"

# Detect CPU count
JOBS=$(nproc 2>/dev/null || sysctl -n hw.ncpu 2>/dev/null || echo 4)

cmake "$ROOT" \
    -DCMAKE_BUILD_TYPE=Release \
    -DBUILD_PYTHON_BINDINGS=ON \
    -DBUILD_REST_SERVER=ON \
    -DBUILD_TESTS=ON

cmake --build . --parallel "$JOBS"

echo ""
echo "══════════════════════════════════════════"
echo " Build complete"
echo "══════════════════════════════════════════"

if ls tradeedge_server 2>/dev/null; then
    echo "  REST server  : $BUILD/tradeedge_server"
    echo "  Start with   : $BUILD/tradeedge_server [port]  (default 7331)"
fi

if ls tradeedge_core*.so 2>/dev/null || ls tradeedge_core*.pyd 2>/dev/null; then
    echo "  Python module: $BUILD/tradeedge_core.so"
    echo "  Usage        : PYTHONPATH=$BUILD python examples/greeks_example.py"
fi

echo ""
echo "  Run tests    : cd $BUILD && ctest --output-on-failure"
echo ""
