#!/bin/bash

# Docker 인프라 구성 스크립트
echo "========================================="
echo "Docker 인프라 구성"
echo "========================================="

# Docker 실행 확인
echo -e "\n[1/4] Docker 데몬 확인..."
if ! docker info &> /dev/null; then
    echo "✗ Docker 데몬이 실행되고 있지 않습니다."
    echo "  Docker Desktop을 시작하고 WSL2 통합을 활성화해주세요."
    exit 1
fi
echo "✓ Docker 데몬 실행 확인됨"

# Docker 네트워크 생성
echo -e "\n[2/4] Docker 네트워크 생성..."
if docker network ls | grep -q "mcp-network"; then
    echo "  - mcp-network가 이미 존재합니다."
else
    docker network create --driver bridge mcp-network
    echo "  ✓ mcp-network 생성됨"
fi

# Docker 볼륨 생성
echo -e "\n[3/4] Docker 볼륨 생성..."
VOLUMES=(
    "mcp-postgres-data"
    "mcp-mysql-data"
    "mcp-redis-data"
    "mcp-elasticsearch-data"
    "mcp-mongodb-data"
    "mcp-logs"
    "mcp-certs"
)

for volume in "${VOLUMES[@]}"; do
    if docker volume ls | grep -q "$volume"; then
        echo "  - $volume가 이미 존재합니다."
    else
        docker volume create "$volume"
        echo "  ✓ $volume 생성됨"
    fi
done

# Docker Compose 파일 생성
echo -e "\n[4/4] Docker Compose 설정 파일 생성..."
cat > docker/compose/docker-compose.yml << 'EOF'
version: '3.8'

# 한글 인코딩 환경 변수 (필요시 주석 해제)
x-encoding-env: &encoding-env
  LANG: C.UTF-8
  LC_ALL: C.UTF-8
  PYTHONIOENCODING: utf-8

# 공통 설정
x-common-config: &common-config
  restart: unless-stopped
  networks:
    - mcp-network
  logging:
    driver: "json-file"
    options:
      max-size: "10m"
      max-file: "3"

networks:
  mcp-network:
    external: true

volumes:
  postgres-data:
    external: true
    name: mcp-postgres-data
  mysql-data:
    external: true
    name: mcp-mysql-data
  redis-data:
    external: true
    name: mcp-redis-data
  elasticsearch-data:
    external: true
    name: mcp-elasticsearch-data
  mongodb-data:
    external: true
    name: mcp-mongodb-data
  logs:
    external: true
    name: mcp-logs
  certs:
    external: true
    name: mcp-certs

services:
  # Core Services
  mcp-hub:
    <<: *common-config
    image: node:18-alpine
    container_name: mcp-hub
    ports:
      - "${MCP_HUB_PORT}:3000"
    environment:
      <<: *encoding-env
      NODE_ENV: production
      LOG_LEVEL: ${LOG_LEVEL}
    volumes:
      - ${PROJECT_ROOT}/services/mcp-hub:/app
      - logs:/app/logs
    working_dir: /app
    command: sh -c "npm install && npm start"

  # Gateway Service
  gateway:
    <<: *common-config
    image: nginx:alpine
    container_name: mcp-gateway
    ports:
      - "${GATEWAY_PORT}:80"
    volumes:
      - ${PROJECT_ROOT}/configs/nginx.conf:/etc/nginx/nginx.conf:ro
      - logs:/var/log/nginx
    depends_on:
      - mcp-hub

  # Monitoring Stack
  prometheus:
    <<: *common-config
    image: prom/prometheus:latest
    container_name: mcp-prometheus
    ports:
      - "${MONITORING_PORT}:9090"
    volumes:
      - ${PROJECT_ROOT}/configs/prometheus.yml:/etc/prometheus/prometheus.yml:ro
      - prometheus-data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'

  # Logging Stack
  loki:
    <<: *common-config
    image: grafana/loki:latest
    container_name: mcp-loki
    ports:
      - "${LOGGING_PORT}:3100"
    volumes:
      - ${PROJECT_ROOT}/configs/loki.yml:/etc/loki/local-config.yaml:ro
      - logs:/loki

  # Database Services
  postgres:
    <<: *common-config
    image: postgres:15-alpine
    container_name: mcp-postgres
    ports:
      - "${POSTGRES_MCP_PORT}:5432"
    environment:
      <<: *encoding-env
      POSTGRES_DB: mcp_db
      POSTGRES_USER: mcp_user
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - postgres-data:/var/lib/postgresql/data

  redis:
    <<: *common-config
    image: redis:7-alpine
    container_name: mcp-redis
    ports:
      - "${REDIS_MCP_PORT}:6379"
    command: redis-server --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis-data:/data

volumes:
  prometheus-data:
EOF

# 상태 업데이트
echo -e "\n상태 파일 업데이트..."
cat > .state/deployment-status.json << EOF
{
  "infrastructure": {
    "wsl_setup": true,
    "docker_setup": true,
    "network_created": true,
    "volumes_created": true
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

echo -e "\n========================================="
echo "Docker 인프라 구성 완료!"
echo "========================================="
echo "다음 단계: 환경 변수 설정 후 서비스 배포"