#!/bin/bash

# Check Node.js version
REQUIRED_NODE_VERSION=23
CURRENT_NODE_VERSION=$(node -v | cut -d'.' -f1 | sed 's/v//')

if (( CURRENT_NODE_VERSION < REQUIRED_NODE_VERSION )); then
    echo "Error: Node.js version must be $REQUIRED_NODE_VERSION or higher. Current version is $CURRENT_NODE_VERSION."
    exit 1
fi

# Navigate to the script's directory
cd "$(dirname "$0")"/..

cp .env.example .env

echo "exit" | pnpm start --character=characters/trump.character.json > output.txt

# Check the exit code of the last command
if [[ $? -ne 0 ]]; then
    echo "Error: The last command exited with an error."
    exit 1
fi

# Check if output.txt contains "Terminating and cleaning up resources..."
if grep -q "Terminating and cleaning up resources..." output.txt; then
    echo "Script completed successfully."
 else
    echo "Error: The output file does not contain the expected string."
    exit 1
fi

# Clean up
rm output.txt
