import {
  formatVideoDuration,
  isVideoFile,
  MAX_VIDEO_FRAMES,
  pickFrameTimes,
  type ExtractedVideo,
} from "@/lib/extractVideoFrames";
import type { ExtractedDoc } from "@/lib/extractDocumentText";

export type ChatAttachment = ExtractedDoc | ExtractedVideo;

export function isVideoAttachment(a: ChatAttachment): a is ExtractedVideo {
  return "frames" in a && Array.isArray((a as ExtractedVideo).frames);
}

export { pickFrameTimes, isVideoFile, formatVideoDuration, MAX_VIDEO_FRAMES };
export type { ExtractedVideo };
