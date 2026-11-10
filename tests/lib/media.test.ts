// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { extFor, grabFrames, pickMime } from "@/lib/media";

afterEach(() => vi.restoreAllMocks());

describe("pickMime", () => {
  it("returns the first supported type in preference order", () => {
    expect(pickMime("audio", (m) => m === "audio/mp4")).toBe("audio/mp4");
    expect(pickMime("audio", () => true)).toBe("audio/webm;codecs=opus");
    expect(pickMime("video", (m) => m === "video/webm" || m === "video/mp4")).toBe("video/webm");
    expect(pickMime("video", (m) => m === "video/mp4")).toBe("video/mp4");
  });
  it("returns null when nothing is supported", () => {
    expect(pickMime("video", () => false)).toBeNull();
    expect(pickMime("audio", () => false)).toBeNull();
  });
});

describe("extFor", () => {
  it("maps both full and base mime types", () => {
    expect(extFor("audio/mp4")).toBe("m4a");
    expect(extFor("video/mp4")).toBe("mp4");
    expect(extFor("audio/webm;codecs=opus")).toBe("webm");
    expect(extFor("audio/webm")).toBe("webm");
    expect(extFor("video/webm;codecs=vp9,opus")).toBe("webm");
    expect(extFor("audio/mp4;codecs=mp4a.40.2")).toBe("m4a");
    expect(extFor("Audio/MP4")).toBe("m4a");
  });
});

describe("grabFrames", () => {
  it("seeks to evenly spaced points and returns JPEG data URLs", async () => {
    const drawImage = vi.fn();
    const toDataURL = vi.fn((type?: string, q?: number) => `data:${type};q=${q}`);
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ drawImage } as never);
    vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockImplementation(toDataURL as never);

    const seeks: number[] = [];
    const video = document.createElement("video");
    Object.defineProperty(video, "readyState", { value: 4 });
    Object.defineProperty(video, "duration", { value: 8 });
    Object.defineProperty(video, "videoWidth", { value: 1024 });
    Object.defineProperty(video, "videoHeight", { value: 768 });
    Object.defineProperty(video, "currentTime", {
      get: () => seeks.at(-1) ?? 0,
      set: (t: number) => {
        seeks.push(t);
        queueMicrotask(() => video.dispatchEvent(new Event("seeked")));
      },
    });

    const frames = await grabFrames(video, 4);
    expect(frames).toHaveLength(4);
    expect(seeks.slice(0, 4)).toEqual([1, 3, 5, 7]);
    expect(frames[0]).toBe("data:image/jpeg;q=0.7");
    expect(drawImage).toHaveBeenCalledTimes(4);
    expect(toDataURL).toHaveBeenCalledWith("image/jpeg", 0.7);
  });

  it("scales frames down to maxWidth", async () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ drawImage: vi.fn() } as never);
    vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue("data:x");
    let canvas: HTMLCanvasElement | undefined;
    const create = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation(((tag: string) => {
      const el = create(tag);
      if (tag === "canvas") canvas = el as HTMLCanvasElement;
      return el;
    }) as never);
    const video = create("video");
    Object.defineProperty(video, "readyState", { value: 4 });
    Object.defineProperty(video, "duration", { value: 2 });
    Object.defineProperty(video, "videoWidth", { value: 1024 });
    Object.defineProperty(video, "videoHeight", { value: 768 });
    Object.defineProperty(video, "currentTime", {
      get: () => 0,
      set: () => queueMicrotask(() => video.dispatchEvent(new Event("seeked"))),
    });
    await grabFrames(video, 1, 512);
    expect(canvas?.width).toBe(512);
    expect(canvas?.height).toBe(384);
  });
});
