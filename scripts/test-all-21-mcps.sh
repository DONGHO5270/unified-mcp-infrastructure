#!/bin/bash

echo "==========================================="
echo "21개 MCP 서비스 전체 상태 확인"
echo "==========================================="

# MCP 서비스 목록 (21개)
services=(
    "21stdev-magic"
    "clear-thought"
    "code-checker"
    "code-context-provider"
    "code-runner"
    "context7"
    "desktop-commander"
    "docker"
    "github"
    "mem0"
    "mermaid"
    "node-omnibus"
    "nodejs-debugger"
    "npm-sentinel"
    "playwright"
    "serena"
    "serper-search"
    "stochastic-thinking"
    "supabase"
    "taskmaster-ai"
    "vercel"
)

success_count=0
failed_count=0
failed_services=()
total_tools=0

for service in "${services[@]}"; do
    echo -n "[$service] 테스트 중... "
    
    response=$(curl -s -X POST http://localhost:3100/mcp/$service \
        -H "Content-Type: application/json" \
        -d '{"jsonrpc":"2.0","id":"test","method":"tools/list","params":{}}' \
        --max-time 30 2>/dev/null)
    
    if [ -z "$response" ]; then
        echo "❌ 실패 (응답 없음)"
        failed_count=$((failed_count + 1))
        failed_services+=("$service")
    elif echo "$response" | grep -q '"error"'; then
        error=$(echo "$response" | grep -o '"message":"[^"]*"' | cut -d'"' -f4)
        echo "❌ 실패: $error"
        failed_count=$((failed_count + 1))
        failed_services+=("$service")
    elif echo "$response" | grep -q '"tools"'; then
        tool_count=$(echo "$response" | grep -o '"name"' | wc -l)
        echo "✅ 성공 (도구 수: $tool_count)"
        success_count=$((success_count + 1))
        total_tools=$((total_tools + tool_count))
    else
        echo "❌ 실패 (잘못된 응답)"
        failed_count=$((failed_count + 1))
        failed_services+=("$service")
    fi
done

echo ""
echo "==========================================="
echo "테스트 결과 요약"
echo "==========================================="
echo "✅ 성공: $success_count/21 ($((success_count * 100 / 21))%)"
echo "❌ 실패: $failed_count/21 ($((failed_count * 100 / 21))%)"
echo "🔧 총 도구 수: $total_tools"

if [ ${#failed_services[@]} -gt 0 ]; then
    echo ""
    echo "🔧 미해결 서비스 목록:"
    for service in "${failed_services[@]}"; do
        echo "  - $service"
    done
fi

echo ""
echo "전체 서비스: 21개"
echo "테스트 완료 시간: $(date '+%Y-%m-%d %H:%M:%S')"