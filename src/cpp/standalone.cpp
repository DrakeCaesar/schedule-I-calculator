#include <iostream>
#include <fstream>
#include <string>
#include <vector>
#include "types.h"
#include "effects.h"
#include "pricing.h"
#include "bfs_algorithm.h"
#include "json_parser.h"

// Simple progress reporting to console
void reportProgressToConsole(int depth, int processed, int total)
{
    std::cout << "Progress: Depth " << depth << ", "
              << processed << "/" << total
              << " (" << (processed * 100 / total) << "%)\r" << std::flush;
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

// Print usage information
void printUsage(const char *programName)
{
    std::cerr << "Usage: " << programName << " [options] <product_json> <substances_json> <effect_multipliers_json> <substance_rules_json> <max_depth>\n"
              << "Options:\n"
              << "  -p, --progress  Enable progress reporting\n"
              << "  -o, --output    Output file (if not specified, prints to stdout)\n"
              << "  -h, --help      Show this help message\n";
}

// Parse JSON input and run BFS
JsBestMixResult findBestMixJson(
    std::string productJson,
    std::string substancesJson,
    std::string effectMultipliersJson,
    std::string substanceRulesJson,
    int maxDepth)
{
    // Parse JSON inputs
    Product product = parseProductJson(productJson);
    std::vector<Substance> substances = parseSubstancesJson(substancesJson);
    std::unordered_map<std::string, double> effectMultipliers = parseEffectMultipliersJson(effectMultipliersJson);
    applySubstanceRulesJson(substances, substanceRulesJson);

    // Run the BFS algorithm without progress reporting
    return findBestMix(product, substances, effectMultipliers, maxDepth, nullptr);
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
    std::unordered_map<std::string, double> effectMultipliers = parseEffectMultipliersJson(effectMultipliersJson);
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
    std::vector<std::string> jsonArgs;

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

    try
    {
        maxDepth = std::stoi(jsonArgs[4]);
    }
    catch (const std::exception &e)
    {
        std::cerr << "Error: Invalid max depth value: " << jsonArgs[4] << std::endl;
        return 1;
    }

    // Read JSON content from files
    std::string productJson, substancesJson, effectMultipliersJson, substanceRulesJson;
    try
    {
        productJson = readFileContents(productJsonPath);
        substancesJson = readFileContents(substancesJsonPath);
        effectMultipliersJson = readFileContents(effectMultipliersJsonPath);
        substanceRulesJson = readFileContents(substanceRulesJsonPath);
    }
    catch (const std::exception &e)
    {
        std::cerr << "Error reading input files: " << e.what() << std::endl;
        return 1;
    }

    // Call the BFS algorithm
    JsBestMixResult result;
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
