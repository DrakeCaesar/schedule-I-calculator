#pragma once
#include "types.h"

#ifdef __EMSCRIPTEN__

// Report the best mix found to JavaScript (for WebAssembly build)
void reportBestMixFoundToJS(const MixState &bestMix,
                            const std::vector<Substance> &substances,
                            int profitCents,
                            int sellPriceCents,
                            int costCents);

// Unified JavaScript-compatible progress reporting function
// This is used by both BFS and DFS algorithms
void reportProgressToJS(int depth, int processed, int total);

#endif