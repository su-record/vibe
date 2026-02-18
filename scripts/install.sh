#!/bin/bash

echo "📖 sutory 설치 중..."
echo ""

# 홈 디렉토리 확인
HOME_DIR="$HOME"
SUTORY_HOME="$HOME_DIR/.sutory"

# 1. .sutory 디렉토리 생성
echo "1️⃣  ~/.sutory/ 디렉토리 생성 중..."
mkdir -p "$SUTORY_HOME"
mkdir -p "$SUTORY_HOME/skills"
mkdir -p "$SUTORY_HOME/agents"
mkdir -p "$SUTORY_HOME/templates"

# 2. 스킬 복사
echo "2️⃣  스킬 파일 복사 중..."
if [ -d "skills" ]; then
    cp -r skills/* "$SUTORY_HOME/skills/"
    echo "   ✅ 스킬 17개 복사 완료"
else
    echo "   ⚠️  skills/ 폴더를 찾을 수 없습니다"
fi

# 3. 에이전트 복사
echo "3️⃣  에이전트 파일 복사 중..."
if [ -d "agents" ]; then
    cp -r agents/* "$SUTORY_HOME/agents/"
    echo "   ✅ 에이전트 7개 복사 완료"
else
    echo "   ⚠️  agents/ 폴더를 찾을 수 없습니다"
fi

# 4. 템플릿 복사
echo "4️⃣  템플릿 파일 복사 중..."
if [ -d "templates" ]; then
    cp -r templates/* "$SUTORY_HOME/templates/"
    echo "   ✅ 템플릿 4개 복사 완료"
else
    echo "   ⚠️  templates/ 폴더를 찾을 수 없습니다"
fi

# 5. CLI 설치 (npm global)
echo "5️⃣  CLI 명령어 설치 중..."
if command -v npm &> /dev/null; then
    npm link
    echo "   ✅ 'sutory' 명령어 설치 완료"
else
    echo "   ⚠️  npm이 설치되지 않았습니다. CLI는 수동으로 설정하세요."
fi

# 6. 완료 메시지
echo ""
echo "✅ sutory 설치 완료!"
echo ""
echo "설치된 위치:"
echo "  ~/.sutory/"
echo "  ├── skills/       (17개)"
echo "  ├── agents/       (7개)"
echo "  └── templates/    (4개)"
echo ""
echo "다음 단계:"
echo "  1. 프로젝트로 이동: cd your-project"
echo "  2. 초기화: sutory init"
echo "  3. 새 기능 시작: sutory story create \"기능명\""
echo ""
echo "도움말:"
echo "  sutory help"
echo ""
