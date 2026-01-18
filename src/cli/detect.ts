/**
 * 기술 스택 감지
 */

import path from 'path';
import fs from 'fs';
import { DetectedStack, StackDetails, DetectionResult } from './types.js';

/**
 * 프로젝트 기술 스택 감지
 */
export function detectTechStacks(projectRoot: string): DetectionResult {
  const stacks: DetectedStack[] = [];
  const details: StackDetails = { databases: [], stateManagement: [], hosting: [], cicd: [] };

  const detectInDir = (dir: string, prefix = ''): DetectedStack[] => {
    const detected: DetectedStack[] = [];

    // Node.js / TypeScript
    if (fs.existsSync(path.join(dir, 'package.json'))) {
      try {
        const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf-8'));
        const deps = { ...pkg.dependencies, ...pkg.devDependencies };

        // 프레임워크 감지
        if (deps['next']) detected.push({ type: 'typescript-nextjs', path: prefix });
        else if (deps['react-native']) detected.push({ type: 'typescript-react-native', path: prefix });
        else if (deps['react']) detected.push({ type: 'typescript-react', path: prefix });
        else if (deps['nuxt'] || deps['nuxt3']) detected.push({ type: 'typescript-nuxt', path: prefix });
        else if (deps['vue']) detected.push({ type: 'typescript-vue', path: prefix });
        else if (deps['express'] || deps['fastify'] || deps['koa'] || deps['nest'] || deps['@nestjs/core']) detected.push({ type: 'typescript-node', path: prefix });
        else if (pkg.name) detected.push({ type: 'typescript-node', path: prefix });

        // DB 감지
        if (deps['pg'] || deps['postgres'] || deps['@prisma/client']) details.databases.push('PostgreSQL');
        if (deps['mysql'] || deps['mysql2']) details.databases.push('MySQL');
        if (deps['mongodb'] || deps['mongoose']) details.databases.push('MongoDB');
        if (deps['redis'] || deps['ioredis']) details.databases.push('Redis');
        if (deps['sqlite3'] || deps['better-sqlite3']) details.databases.push('SQLite');
        if (deps['typeorm']) details.databases.push('TypeORM');
        if (deps['prisma'] || deps['@prisma/client']) details.databases.push('Prisma');
        if (deps['drizzle-orm']) details.databases.push('Drizzle');
        if (deps['sequelize']) details.databases.push('Sequelize');

        // 상태관리 감지
        if (deps['redux'] || deps['@reduxjs/toolkit']) details.stateManagement.push('Redux');
        if (deps['zustand']) details.stateManagement.push('Zustand');
        if (deps['jotai']) details.stateManagement.push('Jotai');
        if (deps['recoil']) details.stateManagement.push('Recoil');
        if (deps['mobx']) details.stateManagement.push('MobX');
        if (deps['@tanstack/react-query'] || deps['react-query']) details.stateManagement.push('React Query');
        if (deps['swr']) details.stateManagement.push('SWR');
        if (deps['pinia']) details.stateManagement.push('Pinia');
        if (deps['vuex']) details.stateManagement.push('Vuex');
      } catch { /* ignore: optional operation */ }
    }

    // Python
    if (fs.existsSync(path.join(dir, 'pyproject.toml'))) {
      try {
        const content = fs.readFileSync(path.join(dir, 'pyproject.toml'), 'utf-8');
        if (content.includes('fastapi')) detected.push({ type: 'python-fastapi', path: prefix });
        else if (content.includes('django')) detected.push({ type: 'python-django', path: prefix });
        else detected.push({ type: 'python', path: prefix });

        if (content.includes('psycopg') || content.includes('asyncpg')) details.databases.push('PostgreSQL');
        if (content.includes('pymongo')) details.databases.push('MongoDB');
        if (content.includes('sqlalchemy')) details.databases.push('SQLAlchemy');
        if (content.includes('prisma')) details.databases.push('Prisma');
      } catch { /* ignore: optional operation */ }
    } else if (fs.existsSync(path.join(dir, 'requirements.txt'))) {
      try {
        const content = fs.readFileSync(path.join(dir, 'requirements.txt'), 'utf-8');
        if (content.includes('fastapi')) detected.push({ type: 'python-fastapi', path: prefix });
        else if (content.includes('django')) detected.push({ type: 'python-django', path: prefix });
        else detected.push({ type: 'python', path: prefix });

        if (content.includes('psycopg') || content.includes('asyncpg')) details.databases.push('PostgreSQL');
        if (content.includes('pymongo')) details.databases.push('MongoDB');
        if (content.includes('sqlalchemy')) details.databases.push('SQLAlchemy');
      } catch { /* ignore: optional operation */ }
    }

    // Flutter / Dart
    if (fs.existsSync(path.join(dir, 'pubspec.yaml'))) {
      detected.push({ type: 'dart-flutter', path: prefix });
      try {
        const content = fs.readFileSync(path.join(dir, 'pubspec.yaml'), 'utf-8');
        if (content.includes('flutter_riverpod') || content.includes('riverpod')) details.stateManagement.push('Riverpod');
        else if (content.includes('provider')) details.stateManagement.push('Provider');
        if (content.includes('bloc')) details.stateManagement.push('BLoC');
        if (content.includes('getx') || content.includes('get:')) details.stateManagement.push('GetX');
      } catch { /* ignore: optional operation */ }
    }

    // Go
    if (fs.existsSync(path.join(dir, 'go.mod'))) {
      detected.push({ type: 'go', path: prefix });
      try {
        const content = fs.readFileSync(path.join(dir, 'go.mod'), 'utf-8');
        if (content.includes('pgx') || content.includes('pq')) details.databases.push('PostgreSQL');
        if (content.includes('go-redis')) details.databases.push('Redis');
        if (content.includes('mongo-driver')) details.databases.push('MongoDB');
      } catch { /* ignore: optional operation */ }
    }

    // Rust
    if (fs.existsSync(path.join(dir, 'Cargo.toml'))) {
      detected.push({ type: 'rust', path: prefix });
      try {
        const content = fs.readFileSync(path.join(dir, 'Cargo.toml'), 'utf-8');
        if (content.includes('sqlx') || content.includes('diesel')) details.databases.push('PostgreSQL');
        if (content.includes('mongodb')) details.databases.push('MongoDB');
      } catch { /* ignore: optional operation */ }
    }

    // Java / Kotlin
    if (fs.existsSync(path.join(dir, 'build.gradle')) || fs.existsSync(path.join(dir, 'build.gradle.kts'))) {
      try {
        const gradleFile = fs.existsSync(path.join(dir, 'build.gradle.kts'))
          ? path.join(dir, 'build.gradle.kts')
          : path.join(dir, 'build.gradle');
        const content = fs.readFileSync(gradleFile, 'utf-8');
        if (content.includes('com.android')) detected.push({ type: 'kotlin-android', path: prefix });
        else if (content.includes('kotlin')) detected.push({ type: 'kotlin', path: prefix });
        else if (content.includes('spring')) detected.push({ type: 'java-spring', path: prefix });
        else detected.push({ type: 'java', path: prefix });

        if (content.includes('postgresql')) details.databases.push('PostgreSQL');
        if (content.includes('mysql')) details.databases.push('MySQL');
        if (content.includes('jpa') || content.includes('hibernate')) details.databases.push('JPA/Hibernate');
      } catch { /* ignore: optional operation */ }
    } else if (fs.existsSync(path.join(dir, 'pom.xml'))) {
      try {
        const content = fs.readFileSync(path.join(dir, 'pom.xml'), 'utf-8');
        if (content.includes('spring')) detected.push({ type: 'java-spring', path: prefix });
        else detected.push({ type: 'java', path: prefix });

        if (content.includes('postgresql')) details.databases.push('PostgreSQL');
        if (content.includes('mysql')) details.databases.push('MySQL');
      } catch { /* ignore: optional operation */ }
    }

    // Swift / iOS
    if (fs.existsSync(path.join(dir, 'Package.swift')) ||
        fs.readdirSync(dir).some(f => f.endsWith('.xcodeproj') || f.endsWith('.xcworkspace'))) {
      detected.push({ type: 'swift-ios', path: prefix });
    }

    return detected;
  };

  // CI/CD 감지
  if (fs.existsSync(path.join(projectRoot, '.github', 'workflows'))) {
    details.cicd.push('GitHub Actions');
  }
  if (fs.existsSync(path.join(projectRoot, '.gitlab-ci.yml'))) {
    details.cicd.push('GitLab CI');
  }
  if (fs.existsSync(path.join(projectRoot, 'Jenkinsfile'))) {
    details.cicd.push('Jenkins');
  }
  if (fs.existsSync(path.join(projectRoot, '.circleci'))) {
    details.cicd.push('CircleCI');
  }

  // Hosting 감지
  if (fs.existsSync(path.join(projectRoot, 'vercel.json')) ||
      fs.existsSync(path.join(projectRoot, '.vercel'))) {
    details.hosting.push('Vercel');
  }
  if (fs.existsSync(path.join(projectRoot, 'netlify.toml'))) {
    details.hosting.push('Netlify');
  }
  if (fs.existsSync(path.join(projectRoot, 'app.yaml')) ||
      fs.existsSync(path.join(projectRoot, 'cloudbuild.yaml'))) {
    details.hosting.push('Google Cloud');
  }
  if (fs.existsSync(path.join(projectRoot, 'Dockerfile')) ||
      fs.existsSync(path.join(projectRoot, 'docker-compose.yml'))) {
    details.hosting.push('Docker');
  }
  if (fs.existsSync(path.join(projectRoot, 'fly.toml'))) {
    details.hosting.push('Fly.io');
  }
  if (fs.existsSync(path.join(projectRoot, 'railway.json'))) {
    details.hosting.push('Railway');
  }

  // 루트 디렉토리 검사
  stacks.push(...detectInDir(projectRoot));

  // 1레벨 하위 폴더 검사
  const subDirs = ['backend', 'frontend', 'server', 'client', 'api', 'web', 'mobile', 'app', 'packages', 'apps'];
  for (const subDir of subDirs) {
    const subPath = path.join(projectRoot, subDir);
    if (fs.existsSync(subPath) && fs.statSync(subPath).isDirectory()) {
      stacks.push(...detectInDir(subPath, subDir));
    }
  }

  // packages/* 또는 apps/* 내부 검사 (monorepo)
  for (const monoDir of ['packages', 'apps']) {
    const monoPath = path.join(projectRoot, monoDir);
    if (fs.existsSync(monoPath) && fs.statSync(monoPath).isDirectory()) {
      const subPackages = fs.readdirSync(monoPath).filter(f => {
        const fullPath = path.join(monoPath, f);
        return fs.statSync(fullPath).isDirectory() && !f.startsWith('.');
      });
      for (const pkg of subPackages) {
        stacks.push(...detectInDir(path.join(monoPath, pkg), `${monoDir}/${pkg}`));
      }
    }
  }

  // 중복 제거
  details.databases = [...new Set(details.databases)];
  details.stateManagement = [...new Set(details.stateManagement)];
  details.hosting = [...new Set(details.hosting)];
  details.cicd = [...new Set(details.cicd)];

  return { stacks, details };
}

/**
 * 스택 타입에 대한 이름 매핑
 */
export const STACK_NAMES: Record<string, { name: string; lang: string; framework: string }> = {
  'typescript-nextjs': { name: 'Next.js', lang: 'TypeScript', framework: 'Next.js' },
  'typescript-react': { name: 'React', lang: 'TypeScript', framework: 'React' },
  'typescript-react-native': { name: 'React Native', lang: 'TypeScript', framework: 'React Native' },
  'typescript-nuxt': { name: 'Nuxt', lang: 'TypeScript', framework: 'Nuxt' },
  'typescript-vue': { name: 'Vue', lang: 'TypeScript', framework: 'Vue' },
  'typescript-node': { name: 'Node.js', lang: 'TypeScript', framework: 'Node.js' },
  'python-fastapi': { name: 'FastAPI', lang: 'Python 3.11+', framework: 'FastAPI' },
  'python-django': { name: 'Django', lang: 'Python 3.11+', framework: 'Django' },
  'python': { name: 'Python', lang: 'Python 3.11+', framework: 'Python' },
  'dart-flutter': { name: 'Flutter', lang: 'Dart', framework: 'Flutter' },
  'go': { name: 'Go', lang: 'Go 1.21+', framework: 'Go' },
  'rust': { name: 'Rust', lang: 'Rust', framework: 'Rust' },
  'kotlin-android': { name: 'Android', lang: 'Kotlin', framework: 'Android' },
  'kotlin': { name: 'Kotlin', lang: 'Kotlin', framework: 'Kotlin' },
  'java-spring': { name: 'Spring', lang: 'Java 17+', framework: 'Spring Boot' },
  'java': { name: 'Java', lang: 'Java 17+', framework: 'Java' },
  'swift-ios': { name: 'iOS', lang: 'Swift', framework: 'SwiftUI/UIKit' },
};

/**
 * 스택에 맞는 언어 규칙 파일 목록 반환
 */
export function getLanguageRulesForStacks(stacks: Array<{ type: string; path: string }>): string {
  const ruleFiles: string[] = [];

  for (const stack of stacks) {
    if (STACK_NAMES[stack.type]) {
      ruleFiles.push(`${stack.type}.md`);
    }
  }

  return [...new Set(ruleFiles)].join(', ');
}

/**
 * 언어별 CLAUDE.md 규칙
 */
export const LANGUAGE_RULES: Record<string, string> = {
  typescript: `### TypeScript Rules
- No \`any\` type → use \`unknown\` + type guards
- No \`as any\` casting → define proper interfaces
- No \`@ts-ignore\` → fix type issues at root
- Explicit return types on all functions`,
  python: `### Python Rules
- Type hints required (parameters, return values)
- No \`# type: ignore\` → fix type issues at root
- Prefer f-strings (over format())
- Use list comprehensions appropriately`,
  go: `### Go Rules
- Handle errors immediately (if err != nil)
- Explicit error wrapping (fmt.Errorf with %w)
- Define interfaces at point of use
- Prevent goroutine leaks (use context)`,
  rust: `### Rust Rules
- No unwrap()/expect() in production → handle Result/Option
- Minimize unsafe blocks
- Define explicit error types
- Document ownership/lifetime clearly`,
  java: `### Java Rules
- Use Optional (instead of null)
- Prefer immutable objects (final fields)
- Handle checked exceptions properly
- Utilize Stream API`,
  kotlin: `### Kotlin Rules
- Explicit nullable types (?)
- No !! operator → use safe call (?.)
- Use data classes actively
- Implement utilities as extension functions`,
  dart: `### Dart Rules
- Follow null safety (use ? and ! properly)
- Avoid late keyword abuse
- Use const constructors
- Use async/await for async code`,
  swift: `### Swift Rules
- No force unwrapping → use guard let / if let
- Prefer protocol-oriented programming
- Prefer value types (struct)
- Watch memory management with @escaping closures`
};

/**
 * 스택에 맞는 언어 규칙 내용 반환
 */
export function getLanguageRulesContent(stacks: Array<{ type: string; path: string }>): string {
  const addedRules = new Set<string>();
  const rules: string[] = [];

  for (const stack of stacks) {
    let langKey = '';
    if (stack.type.startsWith('typescript')) langKey = 'typescript';
    else if (stack.type.startsWith('python')) langKey = 'python';
    else if (stack.type === 'go') langKey = 'go';
    else if (stack.type === 'rust') langKey = 'rust';
    else if (stack.type.startsWith('java')) langKey = 'java';
    else if (stack.type.startsWith('kotlin')) langKey = 'kotlin';
    else if (stack.type.startsWith('dart')) langKey = 'dart';
    else if (stack.type.startsWith('swift')) langKey = 'swift';

    if (langKey && !addedRules.has(langKey) && LANGUAGE_RULES[langKey]) {
      addedRules.add(langKey);
      rules.push(LANGUAGE_RULES[langKey]);
    }
  }

  return rules.join('\n\n');
}
