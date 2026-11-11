import { afterEach, describe, expect, it, vi } from "vitest";
import { formatBytes, putFile } from "@/lib/uploadFile";
import { UploadError } from "@/lib/uploadTake";

type Handlers = {
  onload?: () => void;
  onerror?: () => void;
  ontimeout?: () => void;
  upload: { onprogress?: (e: { lengthComputable: boolean; loaded: number; total: number }) => void };
};

function fakeXhr(behave: (x: Handlers & { status: number }) => void) {
  class FakeXhr {
    status = 0;
    timeout = 0;
    upload: Handlers["upload"] = {};
    onload?: () => void;
    onerror?: () => void;
    ontimeout?: () => void;
    open = vi.fn();
    setRequestHeader = vi.fn();
    send = vi.fn(() => behave(this));
  }
  vi.stubGlobal("XMLHttpRequest", FakeXhr);
}

const file = new File(["abc"], "a.mp3", { type: "audio/mpeg" });

afterEach(() => vi.unstubAllGlobals());

describe("putFile", () => {
  it("resolves on 2xx and reports progress", async () => {
    const seen: number[] = [];
    fakeXhr((x) => {
      x.upload.onprogress?.({ lengthComputable: true, loaded: 1, total: 4 });
      x.status = 200;
      x.onload?.();
    });
    await expect(putFile("https://r2.test/put", file, (f) => seen.push(f))).resolves.toBeUndefined();
    expect(seen).toEqual([0.25, 1]);
  });

  it("rejects with the status on a non-2xx response", async () => {
    fakeXhr((x) => {
      x.status = 403;
      x.onload?.();
    });
    await expect(putFile("u", file)).rejects.toMatchObject({ name: "UploadError", status: 403 });
  });

  it("explains a blocked request (network or CORS)", async () => {
    fakeXhr((x) => x.onerror?.());
    const err = await putFile("u", file).catch((e) => e);
    expect(err).toBeInstanceOf(UploadError);
    expect(err.message).toMatch(/CORS/);
  });

  it("rejects on timeout", async () => {
    fakeXhr((x) => x.ontimeout?.());
    await expect(putFile("u", file)).rejects.toThrow(/timed out/);
  });
});

describe("formatBytes", () => {
  it("formats B, KB and MB", () => {
    expect(formatBytes(10)).toBe("10 B");
    expect(formatBytes(2048)).toBe("2 KB");
    expect(formatBytes(5.08 * 1024 * 1024)).toBe("5.08 MB");
  });
});
