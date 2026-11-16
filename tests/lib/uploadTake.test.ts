import { afterEach, describe, expect, it, vi } from "vitest";
import { UploadError, uploadTake } from "@/lib/uploadTake";

type Fake = {
  status: number;
  sent?: unknown;
  headers: Record<string, string>;
  timeout: number;
  onload?: () => void;
  onerror?: () => void;
  ontimeout?: () => void;
  abort: () => void;
  upload: { onprogress?: (e: { lengthComputable: boolean; loaded: number; total: number }) => void };
};

/** Each send runs the next behaviour; the instances are kept for assertions. */
function fakeXhr(...behaviours: ((x: Fake) => void)[]) {
  const made: Fake[] = [];
  class FakeXhr implements Fake {
    status = 0;
    timeout = 0;
    sent?: unknown;
    headers: Record<string, string> = {};
    upload: Fake["upload"] = {};
    onload?: () => void;
    onerror?: () => void;
    ontimeout?: () => void;
    abort = vi.fn();
    open = vi.fn();
    setRequestHeader = (k: string, v: string) => {
      this.headers[k] = v;
    };
    send = (body: unknown) => {
      this.sent = body;
      made.push(this);
      behaviours[made.length - 1]?.(this);
    };
  }
  vi.stubGlobal("XMLHttpRequest", FakeXhr);
  return made;
}

const ok = (x: Fake) => {
  x.status = 200;
  x.onload?.();
};

afterEach(() => vi.unstubAllGlobals());

describe("uploadTake (F5: XHR upload with progress and a long timeout)", () => {
  it("PUTs the blob with the given Content-Type, a 10-minute timeout, and reports progress", async () => {
    const made = fakeXhr((x) => {
      x.upload.onprogress?.({ lengthComputable: true, loaded: 1, total: 2 });
      ok(x);
    });
    const blob = new Blob(["abc"], { type: "audio/webm;codecs=opus" });
    const seen: number[] = [];
    await uploadTake("https://r2.example/put", blob, "audio/webm", { onProgress: (f) => seen.push(f) });
    expect(made[0].headers["Content-Type"]).toBe("audio/webm");
    expect(made[0].sent).toBe(blob);
    expect(made[0].timeout).toBe(600_000);
    expect(seen).toEqual([0.5, 1]);
  });

  it("retries after a failed PUT without re-recording", async () => {
    const made = fakeXhr(
      (x) => {
        x.status = 500;
        x.onload?.();
      },
      ok,
    );
    const blob = new Blob(["abc"]);
    await expect(uploadTake("u", blob, "audio/mp4")).rejects.toBeInstanceOf(UploadError);
    await expect(uploadTake("u", blob, "audio/mp4")).resolves.toBeUndefined();
    expect(made[1].sent).toBe(blob);
  });

  it("wraps network failures and timeouts in UploadError", async () => {
    fakeXhr((x) => x.onerror?.(), (x) => x.ontimeout?.());
    await expect(uploadTake("u", new Blob(["x"]), "audio/mp4")).rejects.toBeInstanceOf(UploadError);
    await expect(uploadTake("u", new Blob(["x"]), "audio/mp4")).rejects.toThrow(/timed out/);
  });

  it("can be cancelled", async () => {
    const made = fakeXhr(() => {});
    const ctrl = new AbortController();
    const p = uploadTake("u", new Blob(["x"]), "audio/mp4", { signal: ctrl.signal });
    ctrl.abort();
    await expect(p).rejects.toThrow(/cancelled/);
    expect(made[0].abort).toHaveBeenCalled();
  });
});
