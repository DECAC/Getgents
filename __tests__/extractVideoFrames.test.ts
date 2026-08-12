import { pickFrameTimes, isVideoFile, MAX_VIDEO_FRAMES } from "@/lib/extractVideoFrames";

describe("pickFrameTimes", () => {
  it("répartit les instants sur la durée", () => {
    const times = pickFrameTimes(100, 4);
    expect(times).toHaveLength(4);
    expect(times[0]).toBeGreaterThan(0);
    expect(times[times.length - 1]).toBeLessThan(100);
  });

  it("retourne un instant centré pour une vidéo très courte", () => {
    const times = pickFrameTimes(0.5, 1);
    expect(times).toHaveLength(1);
    expect(times[0]).toBeGreaterThan(0);
  });
});

describe("isVideoFile", () => {
  it("reconnaît mp4 et webm", () => {
    expect(isVideoFile({ name: "clip.mp4", type: "video/mp4" } as File)).toBe(true);
    expect(isVideoFile({ name: "clip.webm", type: "video/webm" } as File)).toBe(true);
    expect(isVideoFile({ name: "doc.pdf", type: "application/pdf" } as File)).toBe(false);
  });
});

describe("MAX_VIDEO_FRAMES", () => {
  it("borne le nombre d'images extraites", () => {
    expect(pickFrameTimes(120, 20).length).toBeLessThanOrEqual(MAX_VIDEO_FRAMES);
  });
});
