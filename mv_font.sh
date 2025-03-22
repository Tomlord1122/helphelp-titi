#!/bin/bash

# 強制自動執行
set -e  # 發生錯誤時立即停止執行

FONT_DIR="$HOME/Downloads/Kaiu.ttf"
PROJECT_DIR="$HOME/helphelp-titi/static/fonts"

# 檢查文件是否存在
if [ ! -f "$FONT_DIR" ]; then
  echo "Error: Font file not found at $FONT_DIR"
  exit 1
fi

# 移動文件到專案目錄
mv "$FONT_DIR" "$PROJECT_DIR"

echo "Font file moved to $PROJECT_DIR"

# 列出專案目錄中的文件
