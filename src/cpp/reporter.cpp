#include "reporter.h"

#ifdef __EMSCRIPTEN__
// Unified JavaScript-compatible progress reporting function
void reportProgressToJS(int depth, int64_t processed, int64_t total)
{
  // Create a progress object
  emscripten::val progressObj = emscripten::val::object();
  progressObj.set("depth", depth);
  progressObj.set("processed", emscripten::val(static_cast<double>(processed))); // Cast to double for JavaScript compatibility
  progressObj.set("total", emscripten::val(static_cast<double>(total)));         // Cast to double for JavaScript compatibility

  // Get the global scope (works in both main thread and workers)
  emscripten::val global = emscripten::val::global("self");

  // Determine which progress function to call based on availability
  bool isDfs = global.hasOwnProperty("reportDfsProgress");
  bool isBfs = global.hasOwnProperty("reportBfsProgress");

  // Try direct function calls first
  if (isDfs)
  {
    global.call<void>("reportDfsProgress", progressObj);
  }
  else if (isBfs)
  {
    global.call<void>("reportBfsProgress", progressObj);
  }
  // Fallback to postMessage if we're in a worker thread
  else if (global.hasOwnProperty("postMessage"))
  {
    emscripten::val message = emscripten::val::object();
    message.set("type", "progress");
    message.set("depth", depth);
    message.set("processed", emscripten::val(static_cast<double>(processed))); // Cast to double for JavaScript compatibility
    message.set("total", emscripten::val(static_cast<double>(total)));         // Cast to double for JavaScript compatibility
    global.call<void>("postMessage", message);
  }
}

// Unified function to report the best mix found to JavaScript
void reportBestMixFoundToJS(const MixState &bestMix,
                            const std::vector<Substance> &substances,
                            int profitCents,
                            int sellPriceCents,
                            int costCents)
{
  // Convert mix state to substance names
  std::vector<std::string> mixNames = bestMix.toSubstanceNames(substances);

  // Create JavaScript array for mix names - two methods that do the same thing
  emscripten::val mixArray = emscripten::val::array();
  for (size_t i = 0; i < mixNames.size(); ++i)
  {
    mixArray.set(i, emscripten::val(mixNames[i]));
  }

  // Create result object
  emscripten::val resultObj = emscripten::val::object();
  resultObj.set("mixArray", mixArray);
  resultObj.set("mix", mixArray); // Include both naming conventions
  resultObj.set("profit", profitCents / 100.0);
  resultObj.set("sellPrice", sellPriceCents / 100.0);
  resultObj.set("cost", costCents / 100.0);

  // Get the global scope
  emscripten::val global = emscripten::val::global("self");

  // Determine which function to call based on availability
  bool isDfs = global.hasOwnProperty("reportBestMixFound");
  bool isBfs = global.hasOwnProperty("reportBestMixFound");

  // Try direct function calls first
  if (isDfs)
  {
    global.call<void>("reportBestMixFound", resultObj);
  }
  else if (isBfs)
  {
    global.call<void>("reportBestMixFound", resultObj);
  }
  // Fallback to postMessage if we're in a worker thread
  else if (global.hasOwnProperty("postMessage"))
  {
    emscripten::val message = emscripten::val::object();
    message.set("type", "bestMix");
    message.set("mixArray", mixArray);
    message.set("profit", profitCents / 100.0);
    message.set("sellPrice", sellPriceCents / 100.0);
    message.set("cost", costCents / 100.0);
    global.call<void>("postMessage", message);
  }
}
#endif
