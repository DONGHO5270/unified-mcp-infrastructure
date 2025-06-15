#!/bin/bash

# MCP 서비스 컨테이너 배포 스크립트
echo "========================================="
echo "MCP 서비스 컨테이너 배포"
echo "========================================="

# 환경 변수 확인
echo -e "\n[1/4] 환경 변수 확인..."
if [ ! -f configs/environment.env ]; then
    echo "  ⚠ environment.env 파일이 없습니다. 템플릿에서 복사합니다."
    cp configs/environment.env.template configs/environment.env
fi

if [ ! -f configs/api-keys.env ]; then
    echo "  ✗ api-keys.env 파일이 없습니다."
    echo "  configs/api-keys.env.template을 복사하여 API 키를 설정해주세요."
    exit 1
fi

# 환경 변수 로드
source configs/environment.env
source configs/api-keys.env
echo "  ✓ 환경 변수 로드됨"

# Nginx 설정 파일 생성
echo -e "\n[2/4] Nginx 설정 파일 생성..."
cat > configs/nginx.conf << 'EOF'
events {
    worker_connections 1024;
}

http {
    upstream mcp_hub {
        server mcp-hub:3000;
    }

    server {
        listen 80;
        server_name localhost;

        location / {
            proxy_pass http://mcp_hub;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_cache_bypass $http_upgrade;
        }

        location /health {
            access_log off;
            return 200 "healthy\n";
        }
    }
}
EOF
echo "  ✓ Nginx 설정 파일 생성됨"

# Prometheus 설정 파일 생성
echo -e "\n[3/4] Prometheus 설정 파일 생성..."
cat > configs/prometheus.yml << 'EOF'
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'mcp-services'
    static_configs:
      - targets:
        - 'mcp-hub:3000'
        - 'gateway:80'
        - 'postgres:5432'
        - 'redis:6379'
EOF
echo "  ✓ Prometheus 설정 파일 생성됨"

# Docker Compose 실행
echo -e "\n[4/4] Docker Compose 서비스 시작..."
cd docker/compose
docker-compose --env-file ../../configs/environment.env up -d

# 서비스 상태 확인
echo -e "\n서비스 상태 확인..."
sleep 5
docker-compose ps

echo -e "\n========================================="
echo "MCP 서비스 배포 완료!"
echo "========================================="
echo ""
echo "서비스 접속 정보:"
echo "  - MCP Hub: http://localhost:${MCP_HUB_PORT}"
echo "  - Gateway: http://localhost:${GATEWAY_PORT}"
echo "  - Prometheus: http://localhost:${MONITORING_PORT}"
echo "  - Loki: http://localhost:${LOGGING_PORT}"
echo ""
echo "다음 단계: 통합 테스트 실행"