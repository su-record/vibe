#!/bin/bash
# Vibe 협업자 자동 설치 스크립트
# 사용법: ./.vibe/setup.sh

set -e

echo "🔧 Vibe 설치 확인 중..."

# npm/npx 확인
if ! command -v npx &> /dev/null; then
    echo "❌ Node.js/npm이 설치되어 있지 않습니다."
    echo "   https://nodejs.org 에서 설치해주세요."
    exit 1
fi

# vibe 설치 확인 및 업데이트
if command -v vibe &> /dev/null; then
    echo "✅ Vibe가 이미 설치되어 있습니다."
    vibe update --silent
    echo "✅ Vibe 업데이트 완료!"
else
    echo "📦 Vibe 설치 중..."
    npm install -g @su-record/vibe
    vibe update --silent
    echo "✅ Vibe 설치 및 설정 완료!"
fi

echo ""
echo "다음 명령어로 시작하세요:"
echo "  /vibe.spec \"기능명\"    SPEC 작성"
echo "  /vibe.run \"기능명\"     구현 실행"
