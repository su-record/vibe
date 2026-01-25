#!/usr/bin/env node

/**
 * Gemini UI Code Generator
 *
 * 디자인 파일(이미지, HTML 등)을 분석해서 UI 코드를 생성합니다.
 *
 * Usage:
 *   node gemini-ui-gen.js --image ./design.png --framework react --output ./src/components
 *   node gemini-ui-gen.js --html ./mockup.html --framework vue --output ./src/components
 *   node gemini-ui-gen.js --design-folder ./design/ --framework react --output ./src
 */

import fs from 'fs';
import path from 'path';
import os from 'os';

// ============================================
// Config
// ============================================

function getGlobalConfigDir() {
  return process.platform === 'win32'
    ? path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'vibe')
    : path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'), 'vibe');
}

function getGeminiCredentials() {
  const configDir = getGlobalConfigDir();

  // OAuth 토큰 확인
  const tokenPath = path.join(configDir, 'gemini-token.json');
  if (fs.existsSync(tokenPath)) {
    const tokenData = JSON.parse(fs.readFileSync(tokenPath, 'utf-8'));
    if (tokenData.access_token) {
      return { type: 'oauth', accessToken: tokenData.access_token };
    }
  }

  // API Key 확인
  const keyPath = path.join(configDir, 'gemini-apikey.json');
  if (fs.existsSync(keyPath)) {
    const keyData = JSON.parse(fs.readFileSync(keyPath, 'utf-8'));
    if (keyData.apiKey) {
      return { type: 'apikey', apiKey: keyData.apiKey };
    }
  }

  return null;
}

// ============================================
// Gemini API with Vision
// ============================================

async function callGeminiWithImage(imageBase64, mimeType, prompt, creds) {
  const model = 'gemini-2.0-flash';

  const requestBody = {
    contents: [
      {
        role: 'user',
        parts: [
          {
            inlineData: {
              mimeType,
              data: imageBase64
            }
          },
          {
            text: prompt
          }
        ]
      }
    ],
    generationConfig: {
      maxOutputTokens: 8192,
      temperature: 0.3,
    }
  };

  let url;
  let headers;

  if (creds.type === 'apikey') {
    url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${creds.apiKey}`;
    headers = { 'Content-Type': 'application/json' };
  } else {
    // OAuth - Antigravity
    url = 'https://daily-cloudcode-pa.sandbox.googleapis.com/v1internal:generateContent';
    headers = {
      'Authorization': `Bearer ${creds.accessToken}`,
      'Content-Type': 'application/json',
      'x-goog-api-client': 'vibe-ui-gen',
    };

    // Wrap for Antigravity
    const wrappedBody = {
      project: 'anthropic-api-proxy',
      model: 'gemini-2.0-flash-001',
      request: requestBody,
      requestType: 'agent',
      userAgent: 'antigravity',
      requestId: `ui-gen-${Date.now()}`,
    };
    requestBody = wrappedBody;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(creds.type === 'apikey' ? requestBody : requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error (${response.status}): ${errorText}`);
  }

  const result = await response.json();
  const responseData = result.response || result;

  if (!responseData.candidates || responseData.candidates.length === 0) {
    throw new Error('Gemini returned empty response');
  }

  return responseData.candidates[0].content?.parts?.[0]?.text || '';
}

async function callGeminiText(prompt, creds) {
  const model = 'gemini-2.0-flash';

  const requestBody = {
    contents: [
      {
        role: 'user',
        parts: [{ text: prompt }]
      }
    ],
    generationConfig: {
      maxOutputTokens: 8192,
      temperature: 0.3,
    }
  };

  let url;
  let headers;

  if (creds.type === 'apikey') {
    url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${creds.apiKey}`;
    headers = { 'Content-Type': 'application/json' };
  } else {
    url = 'https://daily-cloudcode-pa.sandbox.googleapis.com/v1internal:generateContent';
    headers = {
      'Authorization': `Bearer ${creds.accessToken}`,
      'Content-Type': 'application/json',
    };
  }

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error (${response.status}): ${errorText}`);
  }

  const result = await response.json();
  const responseData = result.response || result;

  return responseData.candidates?.[0]?.content?.parts?.[0]?.text || '';
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

async function generateUIFromImage(imagePath, framework, creds) {
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

  const prompt = `Analyze this UI design image and generate production-ready code.

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

  return callGeminiWithImage(imageBase64, mimeType, prompt, creds);
}

async function generateUIFromHTML(htmlPath, framework, creds) {
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

  return callGeminiText(prompt, creds);
}

async function analyzeDesignFolder(folderPath, framework, creds) {
  const files = fs.readdirSync(folderPath);
  const results = [];

  // Read all files
  for (const file of files) {
    const filePath = path.join(folderPath, file);
    const ext = path.extname(file).toLowerCase();

    if (['.png', '.jpg', '.jpeg', '.webp'].includes(ext)) {
      console.log(`📷 Analyzing image: ${file}`);
      const result = await generateUIFromImage(filePath, framework, creds);
      results.push({ file, type: 'image', result });
    } else if (ext === '.html') {
      console.log(`📄 Analyzing HTML: ${file}`);
      const result = await generateUIFromHTML(filePath, framework, creds);
      results.push({ file, type: 'html', result });
    } else if (ext === '.json') {
      console.log(`📋 Reading tokens: ${file}`);
      const content = fs.readFileSync(filePath, 'utf-8');
      results.push({ file, type: 'tokens', content });
    } else if (['.css', '.scss'].includes(ext)) {
      console.log(`🎨 Reading styles: ${file}`);
      const content = fs.readFileSync(filePath, 'utf-8');
      results.push({ file, type: 'styles', content });
    }
  }

  return results;
}

// ============================================
// CLI
// ============================================

async function main() {
  const args = process.argv.slice(2);

  // Parse arguments
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

  // Check credentials
  const creds = getGeminiCredentials();
  if (!creds) {
    console.error('❌ Gemini credentials not found. Run: vibe gemini auth');
    process.exit(1);
  }

  console.log(`🤖 Gemini UI Generator (${creds.type})`);
  console.log(`📦 Framework: ${options.framework}`);

  try {
    let result;

    if (options.image) {
      console.log(`\n📷 Analyzing: ${options.image}\n`);
      result = await generateUIFromImage(options.image, options.framework, creds);
    } else if (options.html) {
      console.log(`\n📄 Converting: ${options.html}\n`);
      result = await generateUIFromHTML(options.html, options.framework, creds);
    } else if (options.designFolder) {
      console.log(`\n📂 Analyzing folder: ${options.designFolder}\n`);
      const results = await analyzeDesignFolder(options.designFolder, options.framework, creds);
      result = JSON.stringify(results, null, 2);
    } else {
      console.error('❌ No input specified. Use --image, --html, or --design-folder');
      process.exit(1);
    }

    console.log('\n' + '='.repeat(60) + '\n');
    console.log(result);
    console.log('\n' + '='.repeat(60));

    // Output to file if specified
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
