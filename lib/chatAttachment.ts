import {
  formatVideoDuration,
  isVideoFile,
  MAX_VIDEO_FRAMES,
  pickFrameTimes,
  type ExtractedVideo,
} from "@/lib/extractVideoFrames";
import type { ExtractedDoc } from "@/lib/extractDocumentText";
import { isPhotoFile, type ExtractedPhoto } from "@/lib/extractPhoto";

export type ChatAttachment = ExtractedDoc | ExtractedVideo | ExtractedPhoto;

export function isPhotoAttachment(a: ChatAttachment): a is ExtractedPhoto {
  return (a as ExtractedPhoto).kind === "photo";
}

export function isVideoAttachment(a: ChatAttachment): a is ExtractedVideo {
  return "frames" in a && Array.isArray((a as ExtractedVideo).frames);
}

export { pickFrameTimes, isVideoFile, isPhotoFile, formatVideoDuration, MAX_VIDEO_FRAMES };
export type { ExtractedVideo, ExtractedPhoto };
