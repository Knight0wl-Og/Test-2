cmake_minimum_required(VERSION 3.16)
project(tradeedge_core VERSION 1.0.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_EXPORT_COMPILE_COMMANDS ON)

if(NOT CMAKE_BUILD_TYPE)
  set(CMAKE_BUILD_TYPE Release)
endif()

# ── Compiler flags ────────────────────────────────────────────────────────────
if(MSVC)
  add_compile_options(/W4 /O2 /EHsc)
  add_compile_definitions(_USE_MATH_DEFINES _CRT_SECURE_NO_WARNINGS)
else()
  add_compile_options(-Wall -Wextra -O3 -ffast-math)
endif()

# ── Feature toggles ───────────────────────────────────────────────────────────
option(BUILD_PYTHON_BINDINGS "Build pybind11 Python extension module" ON)
option(BUILD_REST_SERVER     "Build standalone HTTP REST server"       ON)
option(BUILD_TESTS           "Build unit test executables"             ON)

# ── External dependencies via FetchContent ─────────────────────────────────────
include(FetchContent)
set(FETCHCONTENT_QUIET FALSE)

# nlohmann/json — header-only JSON library
FetchContent_Declare(nlohmann_json
  GIT_REPOSITORY https://github.com/nlohmann/json.git
  GIT_TAG        v3.11.3
  GIT_SHALLOW    TRUE
)
FetchContent_MakeAvailable(nlohmann_json)

# cpp-httplib — single-header HTTP server/client
FetchContent_Declare(httplib
  GIT_REPOSITORY https://github.com/yhirose/cpp-httplib.git
  GIT_TAG        v0.16.0
  GIT_SHALLOW    TRUE
)
FetchContent_MakeAvailable(httplib)

# pybind11 — Python/C++ binding generator
if(BUILD_PYTHON_BINDINGS)
  FetchContent_Declare(pybind11
    GIT_REPOSITORY https://github.com/pybind/pybind11.git
    GIT_TAG        v2.12.0
    GIT_SHALLOW    TRUE
  )
  FetchContent_MakeAvailable(pybind11)
endif()

# ── Core static library ────────────────────────────────────────────────────────
add_library(te_core STATIC
  src/options_pricer.cpp
  src/tick_processor.cpp
  src/scanner.cpp
  src/backtester.cpp
  src/flow_scorer.cpp
)
target_include_directories(te_core PUBLIC include)

# ── Python extension module (.so / .pyd) ──────────────────────────────────────
if(BUILD_PYTHON_BINDINGS)
  if(TARGET pybind11::pybind11)
    pybind11_add_module(tradeedge_core bindings/python_bindings.cpp)
    target_link_libraries(tradeedge_core PRIVATE te_core)
    set_target_properties(tradeedge_core PROPERTIES
      OUTPUT_NAME "tradeedge_core"
    )
    message(STATUS "[TradeEdge] Python bindings : ENABLED")
  else()
    message(WARNING "[TradeEdge] pybind11 not found — Python bindings skipped")
  endif()
endif()

# ── REST server executable ─────────────────────────────────────────────────────
if(BUILD_REST_SERVER)
  add_executable(tradeedge_server src/rest_server.cpp)
  target_link_libraries(tradeedge_server PRIVATE
    te_core
    nlohmann_json::nlohmann_json
    httplib::httplib
  )
  if(WIN32)
    target_link_libraries(tradeedge_server PRIVATE ws2_32 mswsock)
  elseif(UNIX AND NOT APPLE)
    target_link_libraries(tradeedge_server PRIVATE pthread)
  endif()
  message(STATUS "[TradeEdge] REST server      : ENABLED (port 7331 default)")
endif()

# ── Unit tests ────────────────────────────────────────────────────────────────
if(BUILD_TESTS)
  enable_testing()

  add_executable(test_options tests/test_options.cpp)
  target_link_libraries(test_options PRIVATE te_core)
  add_test(NAME OptionsPricer COMMAND test_options)

  add_executable(test_scanner tests/test_scanner.cpp)
  target_link_libraries(test_scanner PRIVATE te_core)
  add_test(NAME ScannerBacktester COMMAND test_scanner)

  message(STATUS "[TradeEdge] Tests            : ENABLED")
endif()

message(STATUS "[TradeEdge] Build type       : ${CMAKE_BUILD_TYPE}")
message(STATUS "[TradeEdge] C++ standard     : ${CMAKE_CXX_STANDARD}")
