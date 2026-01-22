#!/usr/bin/env node
/**
 * Brand Assets Generator
 * Gemini Image API를 사용하여 앱 아이콘/파비콘 자동 생성
 *
 * Usage:
 *   node generate-brand-assets.js --name "AppName" --color "#2F6BFF" --style "modern" --output "./public"
 *   node generate-brand-assets.js --spec ".claude/vibe/specs/feature.md" --output "./public"
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import https from 'https';
import { execSync } from 'child_process';

// ============================================
// Configuration
// ============================================

const CONFIG_PATH = path.join(os.homedir(), '.config', 'vibe', 'gemini.json');

const ICON_SIZES = {
  'favicon-16x16.png': 16,
  'favicon-32x32.png': 32,
  'apple-touch-icon.png': 180,
  'android-chrome-192x192.png': 192,
  'android-chrome-512x512.png': 512,
};

// ============================================
// Gemini API
// ============================================

function getGeminiApiKey() {
  // 1. Environment variable
  if (process.env.GEMINI_API_KEY) {
    return process.env.GEMINI_API_KEY;
  }

  // 2. Config file
  if (fs.existsSync(CONFIG_PATH)) {
    try {
      const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
      if (config.apiKey) return config.apiKey;
    } catch {
      // ignore
    }
  }

  return null;
}

async function generateImageWithGemini(prompt, apiKey) {
  // Nano Banana (Gemini 2.5 Flash Image) - fast image generation for icons/logos
  // For professional assets, use gemini-3-pro-image-preview (Nano Banana Pro)
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${apiKey}`;

  const requestBody = {
    contents: [{
      parts: [{
        text: `Generate an app icon image. ${prompt}

Requirements:
- Square format (1:1 aspect ratio)
- Simple, recognizable design
- Works well at small sizes
- No text or letters in the icon
- Professional and modern look
- Single focal element on solid or gradient background`
      }]
    }],
    generationConfig: {
      responseModalities: ['TEXT', 'IMAGE'],
    }
  };

  return new Promise((resolve, reject) => {
    const req = https.request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          if (result.error) {
            reject(new Error(result.error.message));
            return;
          }

          // Find image part in response
          const parts = result.candidates?.[0]?.content?.parts || [];
          for (const part of parts) {
            if (part.inlineData?.mimeType?.startsWith('image/')) {
              resolve({
                data: Buffer.from(part.inlineData.data, 'base64'),
                mimeType: part.inlineData.mimeType
              });
              return;
            }
          }

          reject(new Error('No image in response'));
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.write(JSON.stringify(requestBody));
    req.end();
  });
}

// ============================================
// Image Processing
// ============================================

function resizeImage(inputPath, outputPath, size) {
  // Try sharp via npx, fallback to sips (macOS) or convert (ImageMagick)
  try {
    // Check if sharp is available
    execSync(`npx sharp-cli resize ${size} ${size} -i "${inputPath}" -o "${outputPath}"`, {
      stdio: 'pipe'
    });
    return true;
  } catch {
    // Fallback: macOS sips
    if (process.platform === 'darwin') {
      try {
        execSync(`sips -z ${size} ${size} "${inputPath}" --out "${outputPath}"`, {
          stdio: 'pipe'
        });
        return true;
      } catch {
        // ignore
      }
    }

    // Fallback: ImageMagick convert
    try {
      execSync(`convert "${inputPath}" -resize ${size}x${size} "${outputPath}"`, {
        stdio: 'pipe'
      });
      return true;
    } catch {
      // ignore
    }
  }

  return false;
}

function createFavicon(inputPath, outputPath) {
  // Create ICO file with multiple sizes
  try {
    // Try ImageMagick
    execSync(`convert "${inputPath}" -define icon:auto-resize=48,32,16 "${outputPath}"`, {
      stdio: 'pipe'
    });
    return true;
  } catch {
    // Fallback: just copy 32x32 as ico
    const png32 = outputPath.replace('favicon.ico', 'favicon-32x32.png');
    if (fs.existsSync(png32)) {
      fs.copyFileSync(png32, outputPath);
      return true;
    }
  }
  return false;
}

// ============================================
// SPEC Parsing
// ============================================

function parseSpecForBrand(specPath) {
  if (!fs.existsSync(specPath)) {
    return null;
  }

  const content = fs.readFileSync(specPath, 'utf8');
  const brand = {
    name: null,
    color: null,
    style: null,
    concept: null
  };

  // Extract app name from title or context
  const titleMatch = content.match(/^#\s+(.+?)(?:\s+SPEC)?$/m);
  if (titleMatch) {
    brand.name = titleMatch[1].trim();
  }

  // Extract from context section
  const contextMatch = content.match(/<context>([\s\S]*?)<\/context>/i);
  if (contextMatch) {
    const context = contextMatch[1];

    // App Name
    const nameMatch = context.match(/App\s*Name[:\s]+([^\n]+)/i);
    if (nameMatch) brand.name = nameMatch[1].trim();

    // Primary Color
    const colorMatch = context.match(/Primary\s*Color[:\s]+(#[0-9A-Fa-f]{6}|#[0-9A-Fa-f]{3})/i);
    if (colorMatch) brand.color = colorMatch[1];

    // Style
    const styleMatch = context.match(/Style[:\s]+([^\n]+)/i);
    if (styleMatch) brand.style = styleMatch[1].trim();

    // Icon Concept
    const conceptMatch = context.match(/Icon\s*Concept[:\s]+([^\n]+)/i);
    if (conceptMatch) brand.concept = conceptMatch[1].trim();
  }

  // Fallback: extract from any brand-related content
  if (!brand.color) {
    const anyColor = content.match(/#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})\b/);
    if (anyColor) brand.color = '#' + anyColor[1];
  }

  return brand;
}

// ============================================
// Prompt Generation
// ============================================

function buildIconPrompt(brand) {
  const parts = [];

  if (brand.name) {
    parts.push(`App icon for "${brand.name}"`);
  } else {
    parts.push('Modern app icon');
  }

  if (brand.concept) {
    parts.push(`Concept: ${brand.concept}`);
  }

  if (brand.style) {
    parts.push(`Style: ${brand.style}`);
  } else {
    parts.push('Style: Modern, minimalist, professional');
  }

  if (brand.color) {
    parts.push(`Primary color: ${brand.color}`);
  }

  return parts.join('. ');
}

// ============================================
// Fallback: Text Monogram
// ============================================

function generateFallbackIcon(name, color, outputPath) {
  // Generate simple SVG monogram
  const initial = (name || 'A')[0].toUpperCase();
  const bgColor = color || '#4A90D9';

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <rect width="512" height="512" rx="64" fill="${bgColor}"/>
  <text x="256" y="320" font-family="Arial, sans-serif" font-size="280" font-weight="bold" fill="white" text-anchor="middle">${initial}</text>
</svg>`;

  const svgPath = outputPath.replace(/\.(png|ico)$/, '.svg');
  fs.writeFileSync(svgPath, svg);

  // Convert SVG to PNG if possible
  try {
    execSync(`convert "${svgPath}" -resize 512x512 "${outputPath}"`, { stdio: 'pipe' });
    fs.unlinkSync(svgPath);
    return true;
  } catch {
    // Keep SVG as fallback
    console.log(`  Created SVG fallback: ${svgPath}`);
    return false;
  }
}

// ============================================
// Manifest Generation
// ============================================

function generateWebManifest(outputDir, name) {
  const manifest = {
    name: name || 'App',
    short_name: name || 'App',
    icons: [
      { src: '/android-chrome-192x192.png', sizes: '192x192', type: 'image/png' },
      { src: '/android-chrome-512x512.png', sizes: '512x512', type: 'image/png' }
    ],
    theme_color: '#ffffff',
    background_color: '#ffffff',
    display: 'standalone'
  };

  const manifestPath = path.join(outputDir, 'site.webmanifest');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  return manifestPath;
}

// ============================================
// Main
// ============================================

async function main() {
  const args = process.argv.slice(2);

  // Parse arguments
  let name = null;
  let color = null;
  let style = null;
  let specPath = null;
  let outputDir = './public';
  let force = false;

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--name':
        name = args[++i];
        break;
      case '--color':
        color = args[++i];
        break;
      case '--style':
        style = args[++i];
        break;
      case '--spec':
        specPath = args[++i];
        break;
      case '--output':
        outputDir = args[++i];
        break;
      case '--force':
      case '--regenerate':
        force = true;
        break;
      case '--help':
        console.log(`
Brand Assets Generator

Usage:
  node generate-brand-assets.js [options]

Options:
  --name <name>      App name
  --color <hex>      Primary color (e.g., #2F6BFF)
  --style <style>    Design style keywords
  --spec <path>      Path to SPEC file to extract brand info
  --output <dir>     Output directory (default: ./public)
  --force            Regenerate even if icons exist

Examples:
  node generate-brand-assets.js --name "MyApp" --color "#FF5722" --output "./public"
  node generate-brand-assets.js --spec ".claude/vibe/specs/my-feature.md"
        `);
        process.exit(0);
    }
  }

  // Check if icons already exist
  const faviconPath = path.join(outputDir, 'favicon.ico');
  if (fs.existsSync(faviconPath) && !force) {
    console.log('Brand assets already exist. Use --force to regenerate.');
    process.exit(0);
  }

  // Parse SPEC if provided
  if (specPath) {
    const brand = parseSpecForBrand(specPath);
    if (brand) {
      name = name || brand.name;
      color = color || brand.color;
      style = style || brand.style;
    }
  }

  // Ensure output directory
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Check Gemini API key
  const apiKey = getGeminiApiKey();

  console.log('Generating brand assets...');
  console.log(`  Name: ${name || '(not specified)'}`);
  console.log(`  Color: ${color || '(not specified)'}`);
  console.log(`  Style: ${style || '(not specified)'}`);
  console.log(`  Output: ${outputDir}`);
  console.log(`  Gemini: ${apiKey ? 'configured' : 'not configured'}`);
  console.log('');

  const masterIconPath = path.join(outputDir, 'icon-master.png');
  let generated = false;

  // Try Gemini Image API
  if (apiKey) {
    try {
      const prompt = buildIconPrompt({ name, color, style });
      console.log('Generating icon with Gemini...');
      console.log(`  Prompt: ${prompt}`);

      const image = await generateImageWithGemini(prompt, apiKey);
      fs.writeFileSync(masterIconPath, image.data);
      console.log('  Master icon generated successfully');
      generated = true;
    } catch (err) {
      console.log(`  Gemini generation failed: ${err.message}`);
      console.log('  Falling back to text monogram...');
    }
  }

  // Fallback to monogram
  if (!generated) {
    console.log('Generating fallback monogram icon...');
    generateFallbackIcon(name, color, masterIconPath);
    if (fs.existsSync(masterIconPath)) {
      generated = true;
    }
  }

  if (!generated) {
    console.error('Failed to generate icon');
    process.exit(1);
  }

  // Resize to all required sizes
  console.log('Resizing to platform sizes...');
  for (const [filename, size] of Object.entries(ICON_SIZES)) {
    const outPath = path.join(outputDir, filename);
    if (resizeImage(masterIconPath, outPath, size)) {
      console.log(`  Created: ${filename}`);
    } else {
      console.log(`  Warning: Could not create ${filename}`);
    }
  }

  // Create favicon.ico
  console.log('Creating favicon.ico...');
  if (createFavicon(masterIconPath, faviconPath)) {
    console.log('  Created: favicon.ico');
  }

  // Generate web manifest
  const manifestPath = generateWebManifest(outputDir, name);
  console.log(`  Created: ${path.basename(manifestPath)}`);

  // Cleanup master icon
  if (fs.existsSync(masterIconPath)) {
    fs.unlinkSync(masterIconPath);
  }

  console.log('');
  console.log('Brand assets generation complete!');
  console.log(`Output directory: ${outputDir}`);
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
