#!/bin/bash
# -*- coding: utf-8 -*-

# Docker MCP 실행 스크립트
# UTF-8 인코딩 설정
export LANG=C.UTF-8
export LC_ALL=C.UTF-8

# Node.js 환경 설정
export NODE_ENV=production

# 현재 디렉토리로 이동
cd "$(dirname "$0")"

# 빌드가 필요한 경우 빌드 실행
if [ ! -d "dist" ]; then
    echo "Building Docker MCP..."
    npm install --production=false
    npm run build
fi

# Docker MCP 서버 실행
echo "Starting Docker MCP server..."
exec node dist/index.js --transport stdio