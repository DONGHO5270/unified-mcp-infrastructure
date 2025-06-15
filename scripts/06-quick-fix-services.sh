#!/bin/bash

# Quick Fix Script for Failed MCP Services
# Based on infrastructure analysis report

set -e

# 색상 정의
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${YELLOW}========================================="
echo "MCP 서비스 긴급 수정 스크립트"
echo "=========================================${NC}"

# 작업 디렉토리
WORK_DIR="/mnt/c/claude-development/unified-mcp-infrastructure"
cd "$WORK_DIR"

# 1. Python 서비스 수정
echo -e "\n${YELLOW}1. Python 서비스 종속성 설치${NC}"

# Serena MCP
if [ -d "services/mcp/serena-mcp" ]; then
    echo "- Serena MCP 수정 중..."
    cd services/mcp/serena-mcp
    
    # requirements.txt 생성
    cat > requirements.txt << EOF
mcp
asyncio
aiofiles
EOF
    
    # 설치 스크립트 업데이트
    cat > install.sh << 'EOF'
#!/bin/sh
pip3 install -r requirements.txt
EOF
    chmod +x install.sh
    
    cd "$WORK_DIR"
    echo -e "${GREEN}✓ Serena MCP 수정 완료${NC}"
fi

# Code Checker MCP
if [ -d "services/mcp/code-checker-mcp" ]; then
    echo "- Code Checker MCP 수정 중..."
    cd services/mcp/code-checker-mcp
    
    # requirements.txt 생성
    cat > requirements.txt << EOF
mcp
asyncio
pylint
flake8
EOF
    
    # 설치 스크립트
    cat > install.sh << 'EOF'
#!/bin/sh
pip3 install -r requirements.txt
EOF
    chmod +x install.sh
    
    cd "$WORK_DIR"
    echo -e "${GREEN}✓ Code Checker MCP 수정 완료${NC}"
fi

# 2. Vercel MCP 수정
echo -e "\n${YELLOW}2. Vercel MCP 빌드 오류 수정${NC}"

if [ -d "services/mcp/vercel-mcp" ]; then
    cd services/mcp/vercel-mcp
    
    # package.json 확인 및 빌드
    if [ -f "package.json" ]; then
        echo "- 종속성 설치 중..."
        npm install
        
        echo "- 빌드 실행 중..."
        npm run build || {
            # 빌드 실패 시 대체 방안
            echo "- 표준 빌드 실패, TypeScript 직접 컴파일 시도..."
            npx tsc || echo "TypeScript 컴파일 실패"
        }
    fi
    
    cd "$WORK_DIR"
    echo -e "${GREEN}✓ Vercel MCP 처리 완료${NC}"
fi

# 3. Supabase MCP 수정
echo -e "\n${YELLOW}3. Supabase MCP 빌드 오류 수정${NC}"

if [ -d "services/mcp/supabase-mcp" ]; then
    cd services/mcp/supabase-mcp
    
    echo "- @electric-sql/pglite 의존성 제거 중..."
    # Backup original package.json
    cp packages/mcp-server-supabase/package.json packages/mcp-server-supabase/package.json.bak
    
    # Remove problematic dependency
    sed -i '/@electric-sql\/pglite/d' packages/mcp-server-supabase/package.json
    
    echo "- 종속성 재설치 중..."
    rm -rf node_modules packages/*/node_modules
    npm install --no-optional --ignore-scripts
    
    echo "- 빌드 실행 중..."
    npm run build
    
    # Check if build succeeded
    if [ -f "packages/mcp-server-supabase/dist/transports/stdio.js" ]; then
        echo -e "${GREEN}✓ Supabase MCP 빌드 성공!${NC}"
        # Use optimized run script
        cat > run-direct.sh << 'EOF'
#!/bin/sh
cd /app/services/mcp/supabase-mcp
exec node packages/mcp-server-supabase/dist/transports/stdio.js
EOF
        chmod +x run-direct.sh
    else
        echo -e "${RED}✗ Supabase MCP 빌드 실패${NC}"
        # Restore original package.json
        mv packages/mcp-server-supabase/package.json.bak packages/mcp-server-supabase/package.json
    fi
    
    cd "$WORK_DIR"
    echo -e "${GREEN}✓ Supabase MCP 처리 완료${NC}"
fi

# 4. 21stdev-magic MCP 재설치
echo -e "\n${YELLOW}4. 21stdev-magic MCP 종속성 재설치${NC}"

if [ -d "services/mcp/21stdev-magic-mcp" ]; then
    cd services/mcp/21stdev-magic-mcp
    
    # 기존 node_modules 삭제 후 재설치
    rm -rf node_modules package-lock.json
    npm install
    
    cd "$WORK_DIR"
    echo -e "${GREEN}✓ 21stdev-magic MCP 재설치 완료${NC}"
fi

# 5. GitHub MCP monorepo 빌드
echo -e "\n${YELLOW}5. GitHub MCP monorepo 빌드${NC}"

if [ -d "services/mcp/github-mcp" ]; then
    cd services/mcp/github-mcp
    
    # monorepo 루트에서 설치
    echo "- monorepo 종속성 설치 중..."
    npm install
    
    # github 패키지 빌드
    if [ -d "github" ]; then
        cd github
        npm install
        npm run build || echo "GitHub 패키지 빌드 실패"
        cd ..
    fi
    
    cd "$WORK_DIR"
    echo -e "${GREEN}✓ GitHub MCP 처리 완료${NC}"
fi

# 6. MCP Router Dockerfile 업데이트 (Python 지원)
echo -e "\n${YELLOW}6. MCP Router에 Python 지원 추가${NC}"

cd services/mcp-router

# Dockerfile 백업
cp Dockerfile Dockerfile.backup

# Python 지원 추가
cat > Dockerfile << 'EOF'
FROM node:18-slim

# Python 3 설치
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-dev \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Deno 설치 (Code Runner MCP용)
RUN apt-get update && apt-get install -y curl unzip \
    && curl -fsSL https://deno.land/x/install/install.sh | sh \
    && mv /root/.deno/bin/deno /usr/local/bin/ \
    && rm -rf /var/lib/apt/lists/*

# Playwright 브라우저 설치 (Playwright MCP용)
RUN npx playwright install-deps chromium

WORKDIR /app

# 패키지 파일 복사
COPY package*.json ./
RUN npm ci --only=production

# 소스 코드 복사
COPY . .

# TypeScript 컴파일
RUN npm run build

# MCP 서비스 복사
COPY ../mcp /app/services/mcp

# Python 종속성 설치
RUN for dir in /app/services/mcp/*/; do \
    if [ -f "$dir/requirements.txt" ]; then \
        pip3 install -r "$dir/requirements.txt"; \
    fi; \
    if [ -f "$dir/install.sh" ]; then \
        cd "$dir" && sh install.sh; \
    fi; \
done

# 테스트 MCP 생성
COPY test-simple-mcp.js /app/

EXPOSE 3000

CMD ["node", "dist/index.js"]
EOF

cd "$WORK_DIR"
echo -e "${GREEN}✓ Dockerfile 업데이트 완료${NC}"

# 7. Docker 이미지 재빌드
echo -e "\n${YELLOW}7. Docker 이미지 재빌드${NC}"
echo "다음 명령어를 실행하여 Docker 이미지를 재빌드하세요:"
echo -e "${GREEN}docker-compose -f docker/compose/docker-compose-mcp-ondemand.yml build mcp-router${NC}"

echo -e "\n${YELLOW}========================================="
echo "수정 작업 완료!"
echo "=========================================${NC}"

echo -e "\n${YELLOW}다음 단계:${NC}"
echo "1. Docker 이미지 재빌드: docker-compose -f docker/compose/docker-compose-mcp-ondemand.yml build"
echo "2. 서비스 재시작: docker-compose -f docker/compose/docker-compose-mcp-ondemand.yml up -d"
echo "3. 서비스 테스트: ./scripts/test-all-mcps.sh"