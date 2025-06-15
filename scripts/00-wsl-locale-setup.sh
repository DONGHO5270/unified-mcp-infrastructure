#!/bin/bash

# WSL 한글 인코딩 설정 스크립트
echo "========================================="
echo "WSL 한글 인코딩 설정 시작"
echo "========================================="

# 현재 로케일 확인
echo -e "\n현재 로케일 설정:"
locale

# UTF-8 로케일 생성
echo -e "\n로케일 생성 중..."
sudo locale-gen C.UTF-8
sudo locale-gen ko_KR.UTF-8

# 기본 로케일 설정
echo -e "\n기본 로케일을 UTF-8로 설정..."
sudo update-locale LANG=C.UTF-8

# 환경 변수 설정
export LANG=C.UTF-8
export LC_ALL=C.UTF-8

# .bashrc에 추가
echo -e "\n.bashrc에 인코딩 설정 추가..."
if ! grep -q "export LANG=C.UTF-8" ~/.bashrc; then
    echo "export LANG=C.UTF-8" >> ~/.bashrc
    echo "export LC_ALL=C.UTF-8" >> ~/.bashrc
fi

# WSL 설정 파일 생성
echo -e "\nWSL 설정 파일 생성..."
cat > ~/.wslconfig << 'EOF'
[automount]
options = "metadata,umask=22,fmask=11"
mountFsTab = true

[interop]
appendWindowsPath = true
EOF

echo -e "\n========================================="
echo "한글 인코딩 설정 완료!"
echo "WSL 재시작이 필요할 수 있습니다."
echo "========================================="