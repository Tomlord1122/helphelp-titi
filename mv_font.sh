#!/bin/bash

set -e

FONT_DIR="$HOME/Downloads/Kaiu.ttf"
PROJECT_DIR="$HOME/helphelp-titi/static/fonts"

if [ ! -f "$FONT_DIR" ]; then
  echo "Error: Font file not found at $FONT_DIR"
  exit 1
fi

mv "$FONT_DIR" "$PROJECT_DIR"

echo "Font file moved to $PROJECT_DIR"

