/**
 * CLI: vibe voice [subcommand]
 *
 * vibe voice status     — 음성 프로바이더 상태
 * vibe voice test-tts   — TTS 테스트
 * vibe voice test-stt   — STT 테스트
 */

export async function voiceStatusCmd(): Promise<void> {
  try {
    const { voiceStatus } = await import('../../tools/voice/index.js');
    const result = await voiceStatus();
    const data = JSON.parse(result.content[0].text);

    console.log('🎙️ Voice Pipeline Status');
    console.log(`  STT Providers: ${data.stt?.providers?.join(', ') || 'none'}`);
    console.log(`  TTS Providers: ${data.tts?.providers?.join(', ') || 'none'}`);
    console.log(`  Active Sessions: ${data.sessions?.length ?? 0}`);
  } catch (err) {
    console.error('❌ Voice status failed:', err instanceof Error ? err.message : String(err));
  }
}

export async function voiceTestTTS(text: string): Promise<void> {
  try {
    const { ttsSpeak } = await import('../../tools/voice/index.js');
    console.log(`🔊 TTS 변환 중: "${text}"`);

    const result = await ttsSpeak({ text, format: 'mp3' });
    const data = JSON.parse(result.content[0].text);

    if (data.error) {
      console.error(`❌ TTS failed: ${data.error}`);
      return;
    }

    console.log(`✅ 음성 파일 생성: ${data.audioPath}`);
    console.log(`   Provider: ${data.provider}`);
    console.log(`   Format: ${data.format}`);
    console.log(`   Size: ${data.sizeBytes} bytes`);
    console.log(`   Duration: ${data.durationMs}ms`);
  } catch (err) {
    console.error('❌ TTS test failed:', err instanceof Error ? err.message : String(err));
  }
}

export async function voiceTestSTT(filePath: string): Promise<void> {
  try {
    const { sttTranscribe } = await import('../../tools/voice/index.js');
    console.log(`🎤 STT 변환 중: ${filePath}`);

    const result = await sttTranscribe({ audioPath: filePath });
    const data = JSON.parse(result.content[0].text);

    if (data.error) {
      console.error(`❌ STT failed: ${data.error}`);
      return;
    }

    console.log(`✅ 텍스트 변환 결과: "${data.text}"`);
    console.log(`   Provider: ${data.provider}`);
    console.log(`   Duration: ${data.durationMs}ms`);
  } catch (err) {
    console.error('❌ STT test failed:', err instanceof Error ? err.message : String(err));
  }
}

export function voiceHelp(): void {
  console.log(`Voice Commands:
  vibe voice status           Check voice provider status
  vibe voice test-tts "text"  Test TTS (text to speech)
  vibe voice test-stt <file>  Test STT (speech to text)
  `);
}
