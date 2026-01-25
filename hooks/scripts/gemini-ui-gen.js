#!/usr/bin/env node

/**
 * Gemini UI Code Generator
 *
 * 디자인 파일(이미지, HTML 등)을 분석해서 UI 코드를 생성합니다.
 * 기존 gemini-api 인프라 사용.
 *
 * Usage:
 *   node gemini-ui-gen.js --image ./design.png --framework react --output ./src/components
 *   node gemini-ui-gen.js --html ./mockup.html --framework vue --output ./src/components
 *   node gemini-ui-gen.js --design-folder ./design/ --framework react --output ./src
 */

import fs from 'fs';
import path from 'path';
import { getLibBaseUrl } from './utils.js';

const LIB_URL = getLibBaseUrl();

// ============================================
// Gemini API (기존 인프라 사용)
// ============================================

let geminiApi = null;

async function getGeminiApi() {
  if (!geminiApi) {
    geminiApi = await import(`${LIB_URL}gemini-api.js`);
  }
  return geminiApi;
}

async function getGeminiStatus() {
  const api = await getGeminiApi();
  return api.vibeGeminiStatus ? await api.vibeGeminiStatus() : null;
}

async function askGemini(prompt) {
  const api = await getGeminiApi();
  return api.ask(prompt, { model: 'gemini-3-flash', maxTokens: 8192, temperature: 0.3 });
}

// ============================================
// UI Code Generation
// ============================================

function getFrameworkPrompt(framework) {
  const prompts = {
    react: `Generate React TypeScript components using:
- Functional components with hooks
- Tailwind CSS for styling
- Proper TypeScript types/interfaces
- Export as default`,

    vue: `Generate Vue 3 components using:
- Composition API with <script setup>
- Tailwind CSS for styling
- TypeScript support
- Single File Component format`,

    svelte: `Generate Svelte components using:
- Svelte 5 runes syntax
- Tailwind CSS for styling
- TypeScript support`,

    html: `Generate semantic HTML5 with:
- Tailwind CSS classes
- Accessible markup
- Responsive design`,
  };

  return prompts[framework] || prompts.react;
}

async function generateUIFromImage(imagePath, framework) {
  const imageBuffer = fs.readFileSync(imagePath);
  const imageBase64 = imageBuffer.toString('base64');

  const ext = path.extname(imagePath).toLowerCase();
  const mimeTypes = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
  };
  const mimeType = mimeTypes[ext] || 'image/png';

  const prompt = `[Image attached as base64: ${mimeType}]
data:${mimeType};base64,${imageBase64}

Analyze this UI design image and generate production-ready code.

${getFrameworkPrompt(framework)}

Requirements:
1. Match the visual design exactly (colors, spacing, typography, layout)
2. Extract exact colors as hex values
3. Use proper semantic HTML structure
4. Make it responsive (mobile-first)
5. Include hover/focus states where appropriate
6. Add appropriate accessibility attributes

Output format:
\`\`\`${framework === 'html' ? 'html' : 'tsx'}
// Component code here
\`\`\`

Also provide a summary of:
- Colors extracted
- Components identified
- Layout structure`;

  return askGemini(prompt);
}

async function generateUIFromHTML(htmlPath, framework) {
  const htmlContent = fs.readFileSync(htmlPath, 'utf-8');

  const prompt = `Convert this HTML mockup to production-ready ${framework} code.

HTML Mockup:
\`\`\`html
${htmlContent}
\`\`\`

${getFrameworkPrompt(framework)}

Requirements:
1. Preserve the exact visual appearance
2. Extract inline styles to Tailwind classes
3. Create reusable components where appropriate
4. Add proper TypeScript types
5. Make it responsive

Output the converted code in proper format.`;

  return askGemini(prompt);
}

async function analyzeDesignFolder(folderPath, framework) {
  const files = fs.readdirSync(folderPath);
  let combinedPrompt = `Analyze the following design files and generate production-ready ${framework} code.\n\n`;

  for (const file of files) {
    const filePath = path.join(folderPath, file);
    const ext = path.extname(file).toLowerCase();

    if (['.png', '.jpg', '.jpeg', '.webp', '.gif'].includes(ext)) {
      const imageBuffer = fs.readFileSync(filePath);
      const imageBase64 = imageBuffer.toString('base64');
      const mimeType = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
      combinedPrompt += `\n--- Image: ${file} ---\ndata:${mimeType};base64,${imageBase64}\n`;
      console.log(`📷 ${file}`);
    } else if (ext === '.html') {
      const content = fs.readFileSync(filePath, 'utf-8');
      combinedPrompt += `\n--- HTML: ${file} ---\n${content}\n`;
      console.log(`📄 ${file}`);
    } else if (ext === '.json') {
      const content = fs.readFileSync(filePath, 'utf-8');
      combinedPrompt += `\n--- Design Tokens: ${file} ---\n${content}\n`;
      console.log(`📋 ${file}`);
    } else if (['.css', '.scss'].includes(ext)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      combinedPrompt += `\n--- Styles: ${file} ---\n${content}\n`;
      console.log(`🎨 ${file}`);
    } else if (ext === '.md') {
      const content = fs.readFileSync(filePath, 'utf-8');
      combinedPrompt += `\n--- Guide: ${file} ---\n${content}\n`;
      console.log(`📝 ${file}`);
    }
  }

  combinedPrompt += `\n${getFrameworkPrompt(framework)}

Requirements:
1. Match the visual design exactly
2. Extract design tokens from JSON if provided
3. Use CSS variables from stylesheets if provided
4. Create separate component files for each major UI section
5. Make it responsive (mobile-first)
6. Include accessibility attributes

Output complete component code.`;

  return askGemini(combinedPrompt);
}

// ============================================
// CLI
// ============================================

async function main() {
  const args = process.argv.slice(2);

  const options = {
    image: null,
    html: null,
    designFolder: null,
    framework: 'react',
    output: './generated',
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--image':
        options.image = args[++i];
        break;
      case '--html':
        options.html = args[++i];
        break;
      case '--design-folder':
      case '--folder':
        options.designFolder = args[++i];
        break;
      case '--framework':
      case '-f':
        options.framework = args[++i];
        break;
      case '--output':
      case '-o':
        options.output = args[++i];
        break;
      case '--help':
      case '-h':
        console.log(`
Gemini UI Code Generator

Usage:
  node gemini-ui-gen.js --image ./design.png --framework react
  node gemini-ui-gen.js --html ./mockup.html --framework vue
  node gemini-ui-gen.js --design-folder ./design/ --framework react

Options:
  --image <path>         Image file to analyze
  --html <path>          HTML mockup to convert
  --design-folder <path> Folder with design files
  --framework <name>     Target framework (react, vue, svelte, html)
  --output <path>        Output directory
  --help                 Show this help
`);
        process.exit(0);
    }
  }

  // Check Gemini status
  const status = await getGeminiStatus();
  if (!status) {
    console.error('❌ Gemini credentials not found. Run: vibe gemini auth');
    process.exit(1);
  }

  console.log(`🤖 Gemini UI Generator (${status.type}${status.email ? `: ${status.email}` : ''})`);
  console.log(`📦 Framework: ${options.framework}`);

  try {
    let result;

    if (options.image) {
      console.log(`\n📷 Analyzing: ${options.image}\n`);
      result = await generateUIFromImage(options.image, options.framework);
    } else if (options.html) {
      console.log(`\n📄 Converting: ${options.html}\n`);
      result = await generateUIFromHTML(options.html, options.framework);
    } else if (options.designFolder) {
      console.log(`\n📂 Analyzing folder: ${options.designFolder}\n`);
      result = await analyzeDesignFolder(options.designFolder, options.framework);
    } else {
      console.error('❌ No input specified. Use --image, --html, or --design-folder');
      process.exit(1);
    }

    console.log('\n' + '='.repeat(60) + '\n');
    console.log(result);
    console.log('\n' + '='.repeat(60));

    if (options.output && result) {
      if (!fs.existsSync(options.output)) {
        fs.mkdirSync(options.output, { recursive: true });
      }
      const outputFile = path.join(options.output, `generated-${Date.now()}.txt`);
      fs.writeFileSync(outputFile, result);
      console.log(`\n✅ Output saved to: ${outputFile}`);
    }

  } catch (error) {
    console.error(`\n❌ Error: ${error.message}`);
    process.exit(1);
  }
}

main();
