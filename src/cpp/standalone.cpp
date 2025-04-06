#include <iostream>
#include <fstream>
#include <string>
#include <vector>
#include <thread>
#include <mutex>
#include <atomic>
#include <cmath>
#include <limits>
#include <algorithm>
#include "types.h"
#include "effects.h"
#include "pricing.h"
#include "bfs_algorithm.h"
#include "json_parser.h"

// Global variables for thread synchronization in DFS algorithm
std::mutex g_bestMixMutex;
std::atomic<int> g_totalProcessedCombinations(0);
std::atomic<bool> g_shouldTerminate(false);
const int MAX_SUBSTANCES = 16; // Maximum number of substances
const int MAX_DEPTH = 10;      // Maximum depth for the mix

// Add mutex for console output
std::mutex g_consoleMutex;

// Simple progress reporting to console
void reportProgressToConsole(int depth, int processed, int total)
{
    // Only report progress every 10,000 combinations instead of every time
    if (processed % 10000 != 0 && processed != total) {
        return;
    }
    
    // Lock console output to avoid garbled text from multiple threads
    std::lock_guard<std::mutex> lock(g_consoleMutex);
    std::cout << "Progress: Depth " << depth << ", "
              << processed << "/" << total
              << " (" << (processed * 100 / total) << "%)" << std::endl; // Changed to endl for cleaner output
}

// Format result as JSON string
std::string formatResultAsJson(const JsBestMixResult &result)
{
    std::string json = "{\n";
    json += "  \"mixArray\": [";

    // Handle the mix array - convert vector to JSON array
    bool first = true;
    for (const auto &substanceName : result.mixArray)
    {
        if (!first)
            json += ", ";
        first = false;
        json += "\"" + substanceName + "\"";
    }
    json += "],\n";

    json += "  \"profit\": " + std::to_string(result.profit) + ",\n";
    json += "  \"sellPrice\": " + std::to_string(result.sellPrice) + ",\n";
    json += "  \"cost\": " + std::to_string(result.cost) + "\n";
    json += "}";

    return json;
}

// Parse JSON input and run BFS with progress reporting
JsBestMixResult findBestMixJsonWithProgress(
    std::string productJson,
    std::string substancesJson,
    std::string effectMultipliersJson,
    std::string substanceRulesJson,
    int maxDepth,
    bool reportProgress)
{
    Product product = parseProductJson(productJson);
    std::vector<Substance> substances = parseSubstancesJson(substancesJson);
    std::unordered_map<std::string, int> effectMultipliers = parseEffectMultipliersJson(effectMultipliersJson);
    applySubstanceRulesJson(substances, substanceRulesJson);

    // Run the BFS algorithm with progress reporting if enabled
    if (reportProgress)
    {
        return findBestMix(product, substances, effectMultipliers, maxDepth, reportProgressToConsole);
    }
    else
    {
        return findBestMix(product, substances, effectMultipliers, maxDepth, nullptr);
    }
}

// Parse JSON input and run BFS without progress reporting
JsBestMixResult findBestMixJson(
    std::string productJson,
    std::string substancesJson,
    std::string effectMultipliersJson,
    std::string substanceRulesJson,
    int maxDepth)
{
    return findBestMixJsonWithProgress(
        productJson,
        substancesJson,
        effectMultipliersJson,
        substanceRulesJson,
        maxDepth,
        false);
}

// DFS State struct with static memory allocation
struct DFSState
{
    int substanceIndices[MAX_DEPTH]; // Fixed-size array for the current path
    int depth;                       // Current depth in the search

    DFSState() : depth(0)
    {
        // Initialize all indices to -1 (not used)
        for (int i = 0; i < MAX_DEPTH; ++i)
        {
            substanceIndices[i] = -1;
        }
    }

    // Add a substance to the current state
    void addSubstance(int index)
    {
        if (depth < MAX_DEPTH)
        {
            substanceIndices[depth] = index;
            depth++;
        }
    }

    // Remove the last substance added (backtrack)
    void removeLastSubstance()
    {
        if (depth > 0)
        {
            substanceIndices[depth - 1] = -1;
            depth--;
        }
    }

    // Convert to a vector of substance names for result reporting
    std::vector<std::string> toSubstanceNames(const std::vector<Substance> &substances) const
    {
        std::vector<std::string> names;
        names.reserve(depth);
        for (int i = 0; i < depth; ++i)
        {
            names.push_back(substances[substanceIndices[i]].name);
        }
        return names;
    }

    // Copy the current state to a MixState for compatibility with existing code
    MixState toMixState() const
    {
        MixState mix(MAX_DEPTH);
        for (int i = 0; i < depth; ++i)
        {
            if (substanceIndices[i] >= 0)
            {
                mix.addSubstance(substanceIndices[i]);
            }
        }
        return mix;
    }
};

// DFS Worker function for each thread
void dfsThreadWorker(
    const Product &product,
    const std::vector<Substance> &substances,
    const std::unordered_map<std::string, int> &effectMultipliers,
    int startSubstanceIndex,
    int maxDepth,
    int expectedCombinations,
    MixState &globalBestMix,
    double &globalBestProfit,
    double &globalBestSellPrice,
    double &globalBestCost,
    ProgressCallback progressCallback)
{
    // Initialize thread-local best mix data
    DFSState currentState;
    MixState threadBestMix(maxDepth);
    double threadBestProfit = -std::numeric_limits<double>::infinity();
    double threadBestSellPrice = 0.0;
    double threadBestCost = 0.0;

    // Initialize with the starting substance
    currentState.addSubstance(startSubstanceIndex);

    // Create a set of all effect names for efficiency
    std::unordered_map<std::string, bool> effectsSet;
    effectsSet.reserve(effectMultipliers.size() * 2);
    for (const auto &pair : effectMultipliers)
    {
        effectsSet[pair.first] = true;
    }

    // Stack-based DFS implementation using recursion
    std::function<void(int)> dfs = [&](int currentDepth)
    {
        // Check if we should terminate early
        if (g_shouldTerminate)
        {
            return;
        }

        // Increment processed combinations counter
        g_totalProcessedCombinations++;

        // Periodically report progress - changed from 1000 to 10000
        if (progressCallback && g_totalProcessedCombinations % 10000 == 0)
        {
            progressCallback(currentDepth, g_totalProcessedCombinations.load(), expectedCombinations);
        }

        // Calculate effects and profit for current state
        MixState currentMix = currentState.toMixState();
        std::vector<std::string> effectsList = calculateEffectsForMix(
            currentMix, substances, product.initialEffect, effectsSet);

        double sellPrice = calculateFinalPrice(product.name, effectsList, effectMultipliers);
        double cost = calculateFinalCost(currentMix, substances);
        double profit = sellPrice - cost;

        // Update thread's best mix if this one is better
        if (profit > threadBestProfit)
        {
            threadBestMix = currentMix;
            threadBestProfit = profit;
            threadBestSellPrice = sellPrice;
            threadBestCost = cost;

            // Update global best mix if needed (thread-safe)
            std::lock_guard<std::mutex> lock(g_bestMixMutex);
            if (threadBestProfit > globalBestProfit)
            {
                globalBestMix = threadBestMix;
                globalBestProfit = threadBestProfit;
                globalBestSellPrice = threadBestSellPrice;
                globalBestCost = threadBestCost;

                // Report best mix found so far - now with proper locking
                {
                    std::lock_guard<std::mutex> consoleLock(g_consoleMutex);
                    std::vector<std::string> mixNames = currentState.toSubstanceNames(substances);
                    std::cout << "Best mix so far: [";
                    for (size_t i = 0; i < mixNames.size(); ++i)
                    {
                        if (i > 0)
                            std::cout << ", ";
                        std::cout << mixNames[i];
                    }
                    std::cout << "] with profit " << threadBestProfit
                              << ", price " << threadBestSellPrice
                              << ", cost " << threadBestCost << std::endl;
                }
            }
        }

        // If we haven't reached max depth, continue DFS
        if (currentDepth < maxDepth)
        {
            for (size_t i = 0; i < substances.size(); ++i)
            {
                currentState.addSubstance(i);
                dfs(currentDepth + 1);
                currentState.removeLastSubstance(); // Backtrack
            }
        }
    };

    // Start DFS from depth 1 (with the first substance already added)
    dfs(1);
}

// Main DFS algorithm with threading
JsBestMixResult findBestMixDFS(
    const Product &product,
    const std::vector<Substance> &substances,
    const std::unordered_map<std::string, int> &effectMultipliers,
    int maxDepth,
    ProgressCallback progressCallback)
{
    // Reset global counters
    g_totalProcessedCombinations = 0;
    g_shouldTerminate = false;

    // Initialize best mix variables
    MixState bestMix(maxDepth);
    double bestProfit = -std::numeric_limits<double>::infinity();
    double bestSellPrice = 0.0;
    double bestCost = 0.0;

    // Calculate total expected combinations for progress reporting
    int totalCombinations = 0;
    size_t substanceCount = std::min(static_cast<size_t>(MAX_SUBSTANCES), substances.size());
    for (size_t i = 1; i <= static_cast<size_t>(maxDepth); ++i)
    {
        totalCombinations += static_cast<int>(pow(substanceCount, i));
    }

    // Report initial progress
    if (progressCallback)
    {
        progressCallback(1, 0, totalCombinations);
    }

    // Create and launch threads - one for each starting substance
    std::vector<std::thread> threads;
    threads.reserve(substances.size());

    for (size_t i = 0; i < substances.size(); ++i)
    {
        threads.emplace_back(
            dfsThreadWorker,
            std::ref(product),
            std::ref(substances),
            std::ref(effectMultipliers),
            i,
            maxDepth,
            totalCombinations,
            std::ref(bestMix),
            std::ref(bestProfit),
            std::ref(bestSellPrice),
            std::ref(bestCost),
            progressCallback);
    }

    // Wait for all threads to complete
    for (auto &thread : threads)
    {
        if (thread.joinable())
        {
            thread.join();
        }
    }

    // Final progress report
    if (progressCallback)
    {
        progressCallback(maxDepth, totalCombinations, totalCombinations);
    }

    // Create the result
    JsBestMixResult result;
    result.mixArray = bestMix.toSubstanceNames(substances);
    result.profit = bestProfit;
    result.sellPrice = bestSellPrice;
    result.cost = bestCost;

    return result;
}

// Parse JSON input and run DFS with progress reporting
JsBestMixResult findBestMixDFSJson(
    std::string productJson,
    std::string substancesJson,
    std::string effectMultipliersJson,
    std::string substanceRulesJson,
    int maxDepth,
    bool reportProgress)
{
    Product product = parseProductJson(productJson);
    std::vector<Substance> substances = parseSubstancesJson(substancesJson);
    std::unordered_map<std::string, int> effectMultipliers = parseEffectMultipliersJson(effectMultipliersJson);
    applySubstanceRulesJson(substances, substanceRulesJson);

    // Run the DFS algorithm with progress reporting if enabled
    if (reportProgress)
    {
        return findBestMixDFS(product, substances, effectMultipliers, maxDepth, reportProgressToConsole);
    }
    else
    {
        return findBestMixDFS(product, substances, effectMultipliers, maxDepth, nullptr);
    }
}

// Print usage information
void printUsage(const char *programName)
{
    std::cerr << "Usage: " << programName << " [options] <product_json> <substances_json> <effect_multipliers_json> <substance_rules_json> <max_depth>\n"
              << "Options:\n"
              << "  -p, --progress  Enable progress reporting\n"
              << "  -o, --output    Output file (if not specified, prints to stdout)\n"
              << "  -a, --algorithm  Algorithm to use: bfs (default) or dfs\n"
              << "  -h, --help      Show this help message\n";
}

// Function to read file content into a string
std::string readFileContents(const std::string &filePath)
{
    std::ifstream file(filePath);
    if (!file.is_open())
    {
        throw std::runtime_error("Could not open file: " + filePath);
    }

    std::string content((std::istreambuf_iterator<char>(file)),
                        std::istreambuf_iterator<char>());
    file.close();
    return content;
}

int main(int argc, char *argv[])
{
    bool reportProgress = false;
    std::string outputFile;
    std::string algorithm = "dfs"; // Changed default to "dfs" instead of "bfs"
    std::vector<std::string> jsonArgs;

    // Check if being called from server by looking for explicit algorithm flag
    bool calledFromServer = false;
    for (int i = 1; i < argc; i++) {
        if (std::string(argv[i]) == "-a" || std::string(argv[i]) == "--algorithm") {
            calledFromServer = true;
            break;
        }
    }

    // If not called from server (no -a flag), default to DFS
    // If called from server, start with "bfs" and let -a flag override it if specified
    if (calledFromServer) {
        algorithm = "bfs"; // Default for server calls
    }

    // Parse command line arguments
    for (int i = 1; i < argc; i++)
    {
        std::string arg = argv[i];
        if (arg == "-p" || arg == "--progress")
        {
            reportProgress = true;
        }
        else if (arg == "-o" || arg == "--output")
        {
            if (i + 1 < argc)
            {
                outputFile = argv[++i];
            }
            else
            {
                std::cerr << "Error: Output file path missing\n";
                printUsage(argv[0]);
                return 1;
            }
        }
        else if (arg == "-a" || arg == "--algorithm")
        {
            if (i + 1 < argc)
            {
                algorithm = argv[++i];
                if (algorithm != "bfs" && algorithm != "dfs")
                {
                    std::cerr << "Error: Invalid algorithm. Use 'bfs' or 'dfs'\n";
                    printUsage(argv[0]);
                    return 1;
                }
            }
            else
            {
                std::cerr << "Error: Algorithm name missing\n";
                printUsage(argv[0]);
                return 1;
            }
        }
        else if (arg == "-h" || arg == "--help")
        {
            printUsage(argv[0]);
            return 0;
        }
        else
        {
            jsonArgs.push_back(arg);
        }
    }

    // Check if we have enough arguments
    if (jsonArgs.size() < 5)
    {
        std::cerr << "Error: Not enough arguments\n";
        printUsage(argv[0]);
        return 1;
    }

    // Extract JSON file paths and max depth
    std::string productJsonPath = jsonArgs[0];
    std::string substancesJsonPath = jsonArgs[1];
    std::string effectMultipliersJsonPath = jsonArgs[2];
    std::string substanceRulesJsonPath = jsonArgs[3];
    int maxDepth;

    // Try to get max depth from command line first
    if (jsonArgs.size() > 4) {
        try {
            maxDepth = std::stoi(jsonArgs[4]);
        } catch (const std::exception& e) {
            std::cerr << "Error parsing max depth from command line: " << e.what() << std::endl;
            maxDepth = 5; // Default to 5 if parsing fails
        }
    } else {
        maxDepth = 5; // Default if not provided
    }

    // Read JSON content from files
    std::string productJson, substancesJson, effectMultipliersJson, substanceRulesJson;
    productJson = readFileContents(productJsonPath);
    substancesJson = readFileContents(substancesJsonPath);
    effectMultipliersJson = readFileContents(effectMultipliersJsonPath);
    substanceRulesJson = readFileContents(substanceRulesJsonPath);

    // Check if maxDepth is included in the product JSON
    try {
        // Quick and simple check for maxDepth in product JSON
        // This is not a full JSON parser but should work for our needs
        size_t maxDepthPos = productJson.find("\"maxDepth\":");
        if (maxDepthPos != std::string::npos) {
            // Extract the value after "maxDepth":
            size_t valueStart = productJson.find_first_of("0123456789", maxDepthPos);
            size_t valueEnd = productJson.find_first_not_of("0123456789", valueStart);
            if (valueStart != std::string::npos && valueEnd != std::string::npos) {
                std::string depthStr = productJson.substr(valueStart, valueEnd - valueStart);
                int jsonMaxDepth = std::stoi(depthStr);
                // Only override if we found a valid value
                if (jsonMaxDepth > 0) {
                    maxDepth = jsonMaxDepth;
                    std::cout << "Using maxDepth " << maxDepth << " from product JSON" << std::endl;
                }
            }
        }
    } catch (const std::exception& e) {
        std::cerr << "Error extracting maxDepth from product JSON: " << e.what() << std::endl;
        // Continue with the command line value
    }

    // Call the appropriate algorithm based on user selection
    JsBestMixResult result;
    if (algorithm == "dfs")
    {
        {
            std::lock_guard<std::mutex> lock(g_consoleMutex);
            std::cout << "Running DFS algorithm with " << (reportProgress ? "progress reporting" : "no progress reporting") << std::endl;
        }
        result = findBestMixDFSJson(
            productJson, substancesJson, effectMultipliersJson,
            substanceRulesJson, maxDepth, reportProgress);
    }
    else
    {
        {
            std::lock_guard<std::mutex> lock(g_consoleMutex);
            std::cout << "Running BFS algorithm with " << (reportProgress ? "progress reporting" : "no progress reporting") << std::endl;
        }
        if (reportProgress)
        {
            result = findBestMixJsonWithProgress(
                productJson, substancesJson, effectMultipliersJson,
                substanceRulesJson, maxDepth, true);
        }
        else
        {
            result = findBestMixJson(
                productJson, substancesJson, effectMultipliersJson,
                substanceRulesJson, maxDepth);
        }
    }

    // Format the result as JSON
    std::string resultJson = formatResultAsJson(result);

    // Output the result
    if (outputFile.empty())
    {
        std::cout << resultJson << std::endl;
    }
    else
    {
        std::ofstream outFile(outputFile);
        if (!outFile)
        {
            std::cerr << "Error: Could not open output file: " << outputFile << std::endl;
            return 1;
        }
        outFile << resultJson;
        outFile.close();
    }

    return 0;
}
