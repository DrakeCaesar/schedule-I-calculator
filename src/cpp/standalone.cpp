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
#include "dfs_algorithm.h"
#include "json_parser.h"

// External console mutex declaration (defined in dfs_algorithm.cpp)
extern std::mutex g_consoleMutex;

// Forward declaration of functions defined in dfs.cpp
JsBestMixResult findBestMixDFSJsonWithProgress(
    std::string productJson,
    std::string substancesJson,
    std::string effectMultipliersJson,
    std::string substanceRulesJson,
    int maxDepth,
    bool reportProgress,
    bool useHashingOptimization);

// Simple progress reporting to console
void reportProgressToConsole(int depth, int64_t processed, int64_t total)
{
    // Only report progress every 10,000 combinations instead of every time
    if (processed % 10000 != 0 && processed != total)
    {
        return;
    }

    // Lock console output to avoid garbled text from multiple threads
    std::lock_guard<std::mutex> lock(g_consoleMutex);

    // Calculate percentage safely to avoid negative values
    int percentage = 0;
    if (total > 0)
    {
        // Calculate percentage using 64-bit arithmetic
        percentage = static_cast<int>((100 * processed) / total);

        // Make sure percentage is between 0 and 100
        percentage = std::max(0, std::min(100, percentage));
    }

    std::cout << "Progress: Depth " << depth << ", "
              << processed << "/" << total
              << " (" << percentage << "%)" << std::endl;
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

    // Convert cents back to dollars with 2 decimal places for JSON output
    double profit = result.profitCents / 100.0;
    double sellPrice = result.sellPriceCents / 100.0;
    double cost = result.costCents / 100.0;

    json += "  \"profit\": " + std::to_string(profit) + ",\n";
    json += "  \"sellPrice\": " + std::to_string(sellPrice) + ",\n";
    json += "  \"cost\": " + std::to_string(cost) + "\n";
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
    // Parse JSON inputs
    Product product = parseProductJson(productJson);
    std::vector<Substance> substances = parseSubstancesJson(substancesJson);
    std::unordered_map<std::string, int> effectMultipliers = parseEffectMultipliersJson(effectMultipliersJson);
    applySubstanceRulesJson(substances, substanceRulesJson);

    // Run the BFS algorithm with progress reporting if enabled
#ifdef __EMSCRIPTEN__
    if (reportProgress)
    {
        // Use the WebAssembly-specific progress reporting function
        return findBestMix(product, substances, effectMultipliers, maxDepth, reportProgressToJS);
    }
    else
#else
    if (reportProgress)
    {
        return findBestMix(product, substances, effectMultipliers, maxDepth, reportProgressToConsole);
    }
    else
#endif
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

// Print usage information
void printUsage(const char *programName)
{
    std::cerr << "Usage: " << programName << " [options] <product_json> <substances_json> <effect_multipliers_json> <substance_rules_json> <max_depth>\n"
              << "Options:\n"
              << "  -p, --progress  Enable progress reporting\n"
              << "  -o, --output    Output file (if not specified, prints to stdout)\n"
              << "  -a, --algorithm  Algorithm to use: bfs (default) or dfs\n"
              << "  --no-hashing     Disable the hashing optimization for DFS (for benchmarking)\n"
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
    std::string algorithm = "dfs";      // Changed default to "dfs" instead of "bfs"
    bool useHashingOptimization = true; // Default to using hashing optimization
    std::vector<std::string> jsonArgs;

    // Check if being called from server by looking for explicit algorithm flag
    bool calledFromServer = false;
    for (int i = 1; i < argc; i++)
    {
        if (std::string(argv[i]) == "-a" || std::string(argv[i]) == "--algorithm")
        {
            calledFromServer = true;
            break;
        }
    }

    // If not called from server (no -a flag), default to DFS
    // If called from server, start with "bfs" and let -a flag override it if specified
    if (calledFromServer)
    {
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
        else if (arg == "--no-hashing")
        {
            useHashingOptimization = false;
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
    if (jsonArgs.size() > 4)
    {
        try
        {
            maxDepth = std::stoi(jsonArgs[4]);
        }
        catch (const std::exception &e)
        {
            std::cerr << "Error parsing max depth from command line: " << e.what() << std::endl;
            maxDepth = 5; // Default to 5 if parsing fails
        }
    }
    else
    {
        maxDepth = 5; // Default if not provided
    }

    // Read JSON content from files
    std::string productJson, substancesJson, effectMultipliersJson, substanceRulesJson;
    productJson = readFileContents(productJsonPath);
    substancesJson = readFileContents(substancesJsonPath);
    effectMultipliersJson = readFileContents(effectMultipliersJsonPath);
    substanceRulesJson = readFileContents(substanceRulesJsonPath);

    // Check if maxDepth is included in the product JSON
    try
    {
        // Quick and simple check for maxDepth in product JSON
        // This is not a full JSON parser but should work for our needs
        size_t maxDepthPos = productJson.find("\"maxDepth\":");
        if (maxDepthPos != std::string::npos)
        {
            // Extract the value after "maxDepth":
            size_t valueStart = productJson.find_first_of("0123456789", maxDepthPos);
            size_t valueEnd = productJson.find_first_not_of("0123456789", valueStart);
            if (valueStart != std::string::npos && valueEnd != std::string::npos)
            {
                std::string depthStr = productJson.substr(valueStart, valueEnd - valueStart);
                int jsonMaxDepth = std::stoi(depthStr);
                // Only override if we found a valid value
                if (jsonMaxDepth > 0)
                {
                    maxDepth = jsonMaxDepth;
                    std::cout << "Using maxDepth " << maxDepth << " from product JSON" << std::endl;
                }
            }
        }
    }
    catch (const std::exception &e)
    {
        std::cerr << "Error extracting maxDepth from product JSON: " << e.what() << std::endl;
        // Continue with the command line value
    }

    // Call the appropriate algorithm based on user selection
    JsBestMixResult result;
    if (algorithm == "dfs")
    {
        {
            std::lock_guard<std::mutex> lock(g_consoleMutex);
            std::cout << "Running DFS algorithm with " << (reportProgress ? "progress reporting" : "no progress reporting")
                      << " and hashing optimization " << (useHashingOptimization ? "ENABLED" : "DISABLED") << std::endl;
        }
        result = findBestMixDFSJsonWithProgress(
            productJson, substancesJson, effectMultipliersJson,
            substanceRulesJson, maxDepth, reportProgress, useHashingOptimization);
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
