#!/bin/bash

# WSL 환경 검증 및 프로젝트 구조 생성 스크립트
echo "========================================="
echo "WSL 환경 검증 및 프로젝트 구조 생성"
echo "========================================="

# WSL 버전 확인
echo -e "\n[1/5] WSL 버전 확인..."
if grep -qi microsoft /proc/version; then
    echo "✓ WSL 환경 확인됨"
    if [ -f /proc/sys/fs/binfmt_misc/WSLInterop ]; then
        echo "✓ WSL2 확인됨"
    else
        echo "⚠ WSL1 환경입니다. WSL2로 업그레이드를 권장합니다."
    fi
else
    echo "✗ WSL 환경이 아닙니다."
    exit 1
fi

# Docker 설치 확인
echo -e "\n[2/5] Docker 설치 확인..."
if command -v docker &> /dev/null; then
    echo "✓ Docker 설치 확인됨"
    docker version --format '  - Docker Engine: {{.Server.Version}}'
else
    echo "✗ Docker가 설치되어 있지 않습니다."
    echo "  Docker Desktop을 설치하고 WSL2 통합을 활성화해주세요."
    exit 1
fi

# 프로젝트 디렉토리 구조 생성
echo -e "\n[3/5] 프로젝트 디렉토리 구조 생성..."
DIRS=(
    "scripts"
    "configs"
    "docker/compose"
    "docker/volumes"
    "logs"
    "data"
    "certs"
    ".state"
)

for dir in "${DIRS[@]}"; do
    mkdir -p "$dir"
    echo "  ✓ $dir 생성됨"
done

# 상태 추적 파일 초기화
echo -e "\n[4/5] 상태 추적 파일 초기화..."
cat > .state/deployment-status.json << 'EOF'
{
  "infrastructure": {
    "wsl_setup": true,
    "docker_setup": false,
    "network_created": false,
    "volumes_created": false
  },
  "services": {
    "core": [],
    "ai": [],
    "development": [],
    "data": [],
    "communication": []
  },
  "last_updated": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF
echo "  ✓ 상태 추적 파일 생성됨"

# 기본 gitignore 생성
echo -e "\n[5/5] 기본 설정 파일 생성..."
cat > .gitignore << 'EOF'
# 환경 설정
configs/*.env
!configs/*.template

# 로그 및 데이터
logs/
data/
.state/

# 인증서
certs/
*.pem
*.key

# Docker 볼륨
docker/volumes/

# IDE
.vscode/
.idea/

# 임시 파일
*.tmp
*.bak
*~
EOF
echo "  ✓ .gitignore 생성됨"

echo -e "\n========================================="
echo "환경 검증 및 프로젝트 구조 생성 완료!"
echo "========================================="
echo "다음 단계: ./scripts/02-docker-infrastructure.sh 실행"