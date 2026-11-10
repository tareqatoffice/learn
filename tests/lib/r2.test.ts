import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { S3Client } from "@aws-sdk/client-s3";
import { resetEnvCache } from "@/lib/env";
import {
  deleteObjects,
  getObjectBytes,
  headObject,
  presignGet,
  presignPut,
  setR2Client,
  storageConfigured,
} from "@/lib/r2";

const VARS = ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET"] as const;
const stubAll = () => {
  for (const v of VARS) vi.stubEnv(v, `${v.toLowerCase()}x`);
  resetEnvCache();
};
const fake = (send: ReturnType<typeof vi.fn>) => ({ send }) as unknown as S3Client;

describe("r2", () => {
  beforeEach(() => {
    for (const v of VARS) vi.stubEnv(v, "");
    resetEnvCache();
  });
  afterEach(() => {
    setR2Client(null);
    vi.unstubAllEnvs();
    resetEnvCache();
  });

  it("storageConfigured is false until all four R2 vars are set", () => {
    expect(storageConfigured()).toBe(false);
    stubAll();
    expect(storageConfigured()).toBe(true);
  });

  it("presignPut signs a PUT for the key", async () => {
    stubAll();
    const url = await presignPut("takes/u/t.webm", "audio/webm");
    expect(new URL(url).pathname).toContain("/takes/u/t.webm");
    expect(url).toContain("X-Amz-Expires=600");
  });

  it("presignGet signs a GET for the key", async () => {
    stubAll();
    const url = await presignGet("takes/u/t.webm");
    expect(new URL(url).pathname).toContain("/takes/u/t.webm");
    expect(url).toContain("X-Amz-Signature=");
  });

  it("headObject returns size and type, or null on NotFound", async () => {
    stubAll();
    const send = vi
      .fn()
      .mockResolvedValueOnce({ ContentLength: 5, ContentType: "audio/webm" })
      .mockRejectedValueOnce({ name: "NotFound" });
    setR2Client(fake(send));
    expect(await headObject("a")).toEqual({ size: 5, contentType: "audio/webm" });
    expect(await headObject("a")).toBeNull();
  });

  it("getObjectBytes reads the body", async () => {
    stubAll();
    const send = vi.fn().mockResolvedValue({
      Body: { transformToByteArray: async () => new Uint8Array([1, 2]) },
    });
    setR2Client(fake(send));
    expect(await getObjectBytes("a")).toEqual(new Uint8Array([1, 2]));
  });

  it("deleteObjects sends nothing for an empty list and batches by 1000", async () => {
    stubAll();
    const send = vi.fn().mockResolvedValue({});
    setR2Client(fake(send));
    await deleteObjects([]);
    expect(send).not.toHaveBeenCalled();
    await deleteObjects(Array.from({ length: 2001 }, (_, i) => `k${i}`));
    expect(send).toHaveBeenCalledTimes(3);
  });
});
