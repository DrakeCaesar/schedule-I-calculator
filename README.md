# Schedule-I Calculator

A tool for calculating the most profitable substance mixtures.

## Licensing

All original source code in this repository is licensed under the MIT License (see LICENSE file).

**This project is intended for non-commercial use only.** If you would like to use it commercially, please contact the author.

## Disclaimer

This project is an unofficial fan-made tool for Schedule I. It is not affiliated with, endorsed, or sponsored by TVGS. All trademarks and copyrights belong to their respective owners.

## Prerequisites

To build this project, you'll need:

1. [Emscripten SDK](https://emscripten.org/docs/getting_started/downloads.html) for compiling C++ to WebAssembly
2. [vcpkg](https://github.com/microsoft/vcpkg) for managing C++ dependencies
3. Node.js and npm for the frontend

## Setup

1. Install and activate the Emscripten SDK:
   ```
   # Clone the repository
   git clone https://github.com/emscripten-core/emsdk.git
   cd emsdk
   
   # Download and install the latest SDK
   ./emsdk install latest
   ./emsdk activate latest
   
   # Activate environment variables (Windows)
   emsdk_env.bat
   
   # Activate environment variables (Linux/Mac)
   source ./emsdk_env.sh
   ```

2. Set up vcpkg and install RapidJSON:
   ```
   # Clone vcpkg
   git clone https://github.com/Microsoft/vcpkg.git
   cd vcpkg
   
   # Bootstrap vcpkg
   ./bootstrap-vcpkg.bat  # Windows
   ./bootstrap-vcpkg.sh   # Linux/Mac
   
   # Set VCPKG_ROOT environment variable
   # Windows (Command Prompt):
   set VCPKG_ROOT=C:\path\to\vcpkg
   
   # Linux/Mac:
   export VCPKG_ROOT=/path/to/vcpkg
   ```

3. Clone this repository:
   ```
   git clone https://github.com/yourusername/schedule-I-calculator.git
   cd schedule-I-calculator
   ```

4. Install frontend dependencies:
   ```
   npm install
   ```

## Building

1. Compile the C++ code to WebAssembly:
   ```
   # Windows
   build.bat
   
   # Linux/Mac
   ./build.sh
   ```

2. Start the development server:
   ```
   npm start
   ```

## Project Structure

- `src/cpp/` - C++ source files for the algorithm
- `src/` - TypeScript frontend
- `public/` - Static assets

## Implementation Details

The BFS (Breadth-First Search) algorithm is implemented in C++ and compiled to WebAssembly for performance. The frontend is built with TypeScript and communicates with the WebAssembly module using a simple API.
```
<copilot-edited-file>
```markdown
# Schedule-I Calculator

A tool for calculating the most profitable substance mixtures.

## Prerequisites

To build this project, you'll need:

1. [Emscripten SDK](https://emscripten.org/docs/getting_started/downloads.html) for compiling C++ to WebAssembly
2. [vcpkg](https://github.com/microsoft/vcpkg) for managing C++ dependencies
3. Node.js and npm for the frontend

## Setup

1. Install and activate the Emscripten SDK:
   ```
   # Clone the repository
   git clone https://github.com/emscripten-core/emsdk.git
   cd emsdk
   
   # Download and install the latest SDK
   ./emsdk install latest
   ./emsdk activate latest
   
   # Activate environment variables (Windows)
   emsdk_env.bat
   
   # Activate environment variables (Linux/Mac)
   source ./emsdk_env.sh
   ```

2. Set up vcpkg and install RapidJSON:
   ```
   # Clone vcpkg
   git clone https://github.com/Microsoft/vcpkg.git
   cd vcpkg
   
   # Bootstrap vcpkg
   ./bootstrap-vcpkg.bat  # Windows
   ./bootstrap-vcpkg.sh   # Linux/Mac
   
   # Set VCPKG_ROOT environment variable
   # Windows (Command Prompt):
   set VCPKG_ROOT=C:\path\to\vcpkg
   
   # Linux/Mac:
   export VCPKG_ROOT=/path/to/vcpkg
   ```

3. Clone this repository:
   ```
   git clone https://github.com/yourusername/schedule-I-calculator.git
   cd schedule-I-calculator
   ```

4. Install frontend dependencies:
   ```
   npm install
   ```

## Building

1. Compile the C++ code to WebAssembly:
   ```
   # Windows
   build.bat
   
   # Linux/Mac
   ./build.sh
   ```

2. Start the development server:
   ```
   npm start
   ```

## Project Structure

- `src/cpp/` - C++ source files for the algorithm
- `src/` - TypeScript frontend
- `public/` - Static assets

## Implementation Details

The BFS (Breadth-First Search) algorithm is implemented in C++ and compiled to WebAssembly for performance. The frontend is built with TypeScript and communicates with the WebAssembly module using a simple API.