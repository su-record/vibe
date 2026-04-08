import { GoogleGenerativeAI } from '@google/generative-ai';
import { execSync } from 'child_process';
import fetch from 'node-fetch';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const DEV_LOG_TOKEN = process.env.DEV_LOG_TOKEN;
const DEV_LOG_REPO = process.env.DEV_LOG_REPO;

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-flash-latest' });

function getCommitsSinceLastLog() {
  let gitRange = 'HEAD';
  try {
    const lastLogTag = execSync(
      `git tag -l "log-*" | sort -V | tail -1`,
      { encoding: 'utf-8' }
    ).trim();

    if (lastLogTag) {
      gitRange = `${lastLogTag}..HEAD`;
      console.log(`📌 마지막 개발 일지 태그: ${lastLogTag}`);
    } else {
      console.log(`📌 첫 개발 일지 생성`);
    }
  } catch {
    console.log(`📌 태그 없음, 전체 커밋 사용`);
  }

  const commits = execSync(
    `git log ${gitRange} --pretty=format:"%H|%an|%ad|%s" --date=short`,
    { encoding: 'utf-8' }
  );

  if (!commits.trim()) return [];

  return commits.trim().split('\n').map(line => {
    const [hash, author, date, message] = line.split('|');
    return { hash, author, date, message };
  });
}

async function generateLogPost(commits) {
  const commitSummary = commits.map(c =>
    `- ${c.date}: ${c.message}`
  ).join('\n');

  const startCommit = commits[commits.length - 1].hash.substring(0, 7);
  const endCommit = commits[0].hash.substring(0, 7);
  const commitRange = `${startCommit}..${endCommit}`;

  const startDate = commits[commits.length - 1].date;
  const endDate = commits[0].date;
  const dateRange = startDate === endDate ? startDate : `${startDate} ~ ${endDate}`;

  const prompt = `
당신은 vibe 프로젝트(@su-record/vibe npm 패키지)를 개발하는 Su 개발자의 개발 블로그를 작성하는 AI입니다.

# Su 개발자 소개
- 10+년 경력 프론트엔드 개발자
- React, Next.js, Vue.js, TypeScript 전문
- vibe: AI 코딩 하네스 도구 — "Easy vibe coding + Minimum quality guaranteed"
- Agent = Model + Harness 철학. vibe는 Harness를 제공

# vibe 프로젝트 소개
- npm 패키지: @su-record/vibe
- Claude Code, Codex CLI, Gemini CLI와 연동하는 AI 코딩 하네스
- 스킬, 훅, 에이전트 시스템으로 코드 품질 자동 보장
- /vibe.spec → /vibe.run → Done 워크플로우

# 작성 스타일
- 존댓말 사용
- 친근하고 솔직한 어투
- 기술적 도전과 해결 과정 중심
- 실패와 배움도 공유

# 최근 커밋 내역 (${commitRange}, ${commits.length}개)
${commitSummary}

# 요청사항
위 ${commits.length}개의 커밋 내역 (${commitRange})을 바탕으로 **개발 일지(Dev Log)**를 작성해주세요.

**반드시 아래 Front Matter 형식으로 시작해야 합니다:**

---
title: "vibe 개발일지 #N - {핵심 주제} (${commits.length}개 커밋)"
date: "${endDate}"
category: "dev-log"
description: "작업 내용을 한 줄로 요약 (20-40자)"
tags: ["vibe", "개발일지"]
author: "Su"
lang: "ko"
---

# vibe 개발일지 #N - {핵심 주제} (${commits.length}개 커밋)

**작업 기간**: ${dateRange}

## 📝 이번 기간 작업 내용
- 커밋들을 **기능/영역별로 그룹화**하여 정리
  * 예: "스킬 시스템 개선", "Figma 파이프라인", "Hook 최적화", "모델 업데이트" 등
- 각 그룹별로 주요 커밋 2-3개씩 간단히 설명
- 작업량을 숫자로 표현 (예: "-2,980줄 최적화", "3개 스킬 추가")

## 💡 작업 하이라이트
- 이번 기간의 가장 의미 있는 작업 1-2가지
- Before/After 비교나 아키텍처 다이어그램 활용

## 📊 개발 현황
- 버전 변화 (예: v2.8.40 → v2.8.51)
- 핵심 수치

길이: 1,500-2,500자 (간결하게)

**주의**: #N의 N은 순차 번호입니다. 이전 개발일지 번호를 모르면 #N 그대로 두세요.
커밋 메시지를 그대로 나열하지 말고 의미 있게 그룹화하세요.
블로그 포스트만 출력하고, 다른 설명은 붙이지 마세요.
`;

  let retries = 3;
  let delay = 30000;

  for (let i = 0; i < retries; i++) {
    try {
      const result = await model.generateContent(prompt);
      const response = await result.response;
      return response.text();
    } catch (error) {
      if (error.status === 429) {
        console.log(`⏳ Quota 초과. ${delay / 1000}초 후 재시도 (${i + 1}/${retries})...`);
        if (i < retries - 1) {
          await new Promise(resolve => setTimeout(resolve, delay));
          delay *= 2;
        } else {
          throw new Error('Gemini API quota 초과. 나중에 다시 시도해주세요.');
        }
      } else {
        throw error;
      }
    }
  }
}

async function uploadToGitHub(content, commitCount, commitRange) {
  let logNumber = 18; // vibe-devlog-0017.md 다음부터
  try {
    const response = await fetch(
      `https://api.github.com/repos/${DEV_LOG_REPO}/contents/posts`,
      {
        headers: {
          'Authorization': `token ${DEV_LOG_TOKEN}`,
        },
      }
    );
    if (response.ok) {
      const files = await response.json();
      const devlogFiles = files.filter(f => f.name.match(/^vibe-devlog-\d{4}\.md$/));
      if (devlogFiles.length > 0) {
        const numbers = devlogFiles.map(f => parseInt(f.name.match(/\d{4}/)[0]));
        logNumber = Math.max(...numbers) + 1;
      }
    }
  } catch {
    console.log(`📝 첫 개발 일지 생성 (번호: ${String(logNumber).padStart(4, '0')})`);
  }

  // 생성된 콘텐츠에서 #N을 실제 번호로 교체
  content = content.replace(/#N/g, `#${logNumber}`);

  const fileName = `vibe-devlog-${String(logNumber).padStart(4, '0')}.md`;
  const filePath = `posts/${fileName}`;
  console.log(`📝 파일명: ${fileName}`);

  let sha = null;
  try {
    const checkResponse = await fetch(
      `https://api.github.com/repos/${DEV_LOG_REPO}/contents/${filePath}`,
      {
        headers: {
          'Authorization': `Bearer ${DEV_LOG_TOKEN}`,
          'Accept': 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      }
    );
    if (checkResponse.ok) {
      const data = await checkResponse.json();
      sha = data.sha;
      console.log(`📝 기존 파일 발견, 업데이트 모드 (SHA: ${sha})`);
    }
  } catch {
    console.log('📝 새 파일 생성 모드');
  }

  const body = {
    message: `post: Add vibe dev log: ${commitRange} (${commitCount} commits)`,
    content: Buffer.from(content).toString('base64'),
  };

  if (sha) {
    body.sha = sha;
  }

  const response = await fetch(
    `https://api.github.com/repos/${DEV_LOG_REPO}/contents/${filePath}`,
    {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${DEV_LOG_TOKEN}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    }
  );

  if (!response.ok) {
    const errorData = await response.json();
    console.error('GitHub API 에러 상세:', errorData);
    throw new Error(`GitHub API error: ${response.statusText} - ${JSON.stringify(errorData)}`);
  }

  return response.json();
}

async function main() {
  try {
    console.log('🔍 마지막 개발 일지 이후 커밋 수집 중...');
    const commits = getCommitsSinceLastLog();

    if (commits.length === 0) {
      console.log('⚠️  새로운 커밋이 없습니다.');
      return;
    }

    console.log(`✅ ${commits.length}개 커밋 발견`);

    console.log('✍️  Gemini로 개발 일지 생성 중...');
    const logPost = await generateLogPost(commits);

    const startCommit = commits[commits.length - 1].hash.substring(0, 7);
    const endCommit = commits[0].hash.substring(0, 7);
    const commitRange = `${startCommit}..${endCommit}`;

    console.log('📤 GitHub에 업로드 중...');
    const result = await uploadToGitHub(logPost, commits.length, commitRange);

    console.log('🎉 개발 일지 발행 완료!');
    console.log(`📝 ${result.content.html_url}`);
  } catch (error) {
    console.error('❌ 오류 발생:', error);
    process.exit(1);
  }
}

main();
