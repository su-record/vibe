/**
 * YouTubeService - YouTube Data API v3 operations
 * Search, video info, captions, LLM summarization via REST API
 */

import { InterfaceLogger } from '../../interface/types.js';
import { GoogleAuthManager } from './GoogleAuthManager.js';
import { SmartRouterLike } from '../types.js';
import {
  VideoInfo,
  VideoDetail,
  CaptionText,
  YouTubeSearchResponse,
  YouTubeVideoResponse,
  YouTubeCaptionListResponse,
} from './google-types.js';

const YT_BASE = 'https://www.googleapis.com/youtube/v3';

export class YouTubeService {
  private auth: GoogleAuthManager;
  private logger: InterfaceLogger;
  private smartRouter: SmartRouterLike | null;

  constructor(auth: GoogleAuthManager, logger: InterfaceLogger, smartRouter?: SmartRouterLike) {
    this.auth = auth;
    this.logger = logger;
    this.smartRouter = smartRouter ?? null;
  }

  /** Set SmartRouter for LLM summarization */
  setSmartRouter(router: SmartRouterLike): void {
    this.smartRouter = router;
  }

  /** Search YouTube videos */
  async search(query: string, maxResults: number = 5): Promise<VideoInfo[]> {
    const params = new URLSearchParams({
      part: 'snippet',
      q: query,
      type: 'video',
      maxResults: String(maxResults),
    });
    const res = await this.auth.fetchApi(`${YT_BASE}/search?${params}`);
    if (!res.ok) {
      throw new Error(`YouTube 검색 실패: ${await res.text()}`);
    }
    const data = (await res.json()) as YouTubeSearchResponse;
    return data.items.map((item): VideoInfo => ({
      videoId: item.id.videoId,
      title: item.snippet.title,
      channelTitle: item.snippet.channelTitle,
      thumbnailUrl: item.snippet.thumbnails.default.url,
      publishedAt: item.snippet.publishedAt,
    }));
  }

  /** Get detailed video information */
  async getVideo(videoId: string): Promise<VideoDetail> {
    const params = new URLSearchParams({
      part: 'snippet,contentDetails,statistics',
      id: videoId,
    });
    const res = await this.auth.fetchApi(`${YT_BASE}/videos?${params}`);
    if (!res.ok) {
      throw new Error(`YouTube 비디오 정보 조회 실패: ${await res.text()}`);
    }
    const data = (await res.json()) as YouTubeVideoResponse;
    if (!data.items.length) {
      throw new Error(`비디오를 찾을 수 없습니다: ${videoId}`);
    }
    const item = data.items[0];
    return {
      videoId: item.id,
      title: item.snippet.title,
      description: item.snippet.description,
      channelTitle: item.snippet.channelTitle,
      thumbnailUrl: item.snippet.thumbnails.default.url,
      publishedAt: item.snippet.publishedAt,
      duration: item.contentDetails.duration,
      viewCount: Number(item.statistics.viewCount),
      likeCount: Number(item.statistics.likeCount),
    };
  }

  /** Get video captions (Korean/English preferred) */
  async getCaptions(videoId: string): Promise<CaptionText> {
    const params = new URLSearchParams({
      part: 'snippet',
      videoId,
    });
    const res = await this.auth.fetchApi(`${YT_BASE}/captions?${params}`);
    if (!res.ok) {
      throw new Error(`자막 목록 조회 실패: ${await res.text()}`);
    }
    const data = (await res.json()) as YouTubeCaptionListResponse;
    const caption = this.selectCaption(data.items);
    if (!caption) {
      throw new Error('사용 가능한 자막이 없습니다');
    }
    const captionText = await this.downloadCaption(caption.id);
    return { language: caption.snippet.language, text: captionText };
  }

  /** Summarize video using captions + LLM */
  async summarize(videoId: string): Promise<string> {
    if (!this.smartRouter) {
      throw new Error('LLM이 설정되지 않아 요약할 수 없습니다');
    }
    const captions = await this.getCaptions(videoId);
    const video = await this.getVideo(videoId);
    const result = await this.smartRouter.route({
      type: 'reasoning',
      systemPrompt: SUMMARIZE_SYSTEM_PROMPT,
      prompt: `제목: ${video.title}\n채널: ${video.channelTitle}\n\n자막:\n${captions.text.slice(0, 10000)}`,
    });
    if (!result.success) {
      throw new Error('비디오 요약 생성 실패');
    }
    return result.content;
  }

  /** Extract videoId from URL */
  static extractVideoId(input: string): string | null {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
      /^([a-zA-Z0-9_-]{11})$/,
    ];
    for (const pattern of patterns) {
      const match = input.match(pattern);
      if (match) return match[1];
    }
    return null;
  }

  private selectCaption(
    items: YouTubeCaptionListResponse['items'],
  ): YouTubeCaptionListResponse['items'][0] | null {
    const preferred = ['ko', 'en', 'ja'];
    for (const lang of preferred) {
      const found = items.find((i) => i.snippet.language === lang);
      if (found) return found;
    }
    return items[0] ?? null;
  }

  private async downloadCaption(captionId: string): Promise<string> {
    const res = await this.auth.fetchApi(
      `${YT_BASE}/captions/${captionId}?tfmt=srt`,
    );
    if (!res.ok) {
      throw new Error(`자막 다운로드 실패: ${await res.text()}`);
    }
    const raw = await res.text();
    return this.cleanSrtText(raw);
  }

  private cleanSrtText(srt: string): string {
    return srt
      .replace(/^\d+\s*$/gm, '')
      .replace(/\d{2}:\d{2}:\d{2},\d{3}\s*-->\s*\d{2}:\d{2}:\d{2},\d{3}/g, '')
      .replace(/\n{2,}/g, '\n')
      .trim();
  }
}

const SUMMARIZE_SYSTEM_PROMPT = `당신은 YouTube 비디오 요약 전문가입니다. 주어진 자막을 기반으로 핵심 내용을 3-5개 포인트로 요약하세요.
형식:
- 한국어로 작성
- 핵심 포인트 3-5개 (각 1-2문장)
- 마지막에 한 줄 요약`;
