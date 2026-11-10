import {
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getEnv } from "@/lib/env";

const EXPIRES_IN = 600;
let override: S3Client | null = null;
let cached: { key: string; client: S3Client } | null = null;

/** Test seam: replaces the S3 client; pass null to restore the real one. */
export function setR2Client(client: S3Client | null): void {
  override = client;
}

export function storageConfigured(): boolean {
  const env = getEnv();
  return Boolean(
    env.R2_ACCOUNT_ID && env.R2_ACCESS_KEY_ID && env.R2_SECRET_ACCESS_KEY && env.R2_BUCKET,
  );
}

function client(): S3Client {
  if (override) return override;
  const env = getEnv();
  const key = [env.R2_ACCOUNT_ID, env.R2_ACCESS_KEY_ID, env.R2_SECRET_ACCESS_KEY].join("|");
  if (cached?.key !== key) {
    cached = {
      key,
      client: new S3Client({
        region: "auto",
        requestChecksumCalculation: "WHEN_REQUIRED",
        responseChecksumValidation: "WHEN_REQUIRED",
        endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
        credentials: {
          accessKeyId: env.R2_ACCESS_KEY_ID,
          secretAccessKey: env.R2_SECRET_ACCESS_KEY,
        },
      }),
    };
  }
  return cached.client;
}

const bucket = () => getEnv().R2_BUCKET;

/**
 * A presigned PUT for `key`. With `contentLength`, the length is a signed header, so R2 refuses an
 * upload of any other size.
 */
export function presignPut(key: string, contentType: string, contentLength?: number): Promise<string> {
  return getSignedUrl(
    client(),
    new PutObjectCommand({
      Bucket: bucket(),
      Key: key,
      ContentType: contentType,
      ...(contentLength !== undefined ? { ContentLength: contentLength } : {}),
    }),
    { expiresIn: EXPIRES_IN, ...(contentLength !== undefined ? { signableHeaders: new Set(["content-length"]) } : {}) },
  );
}

export function presignGet(key: string): Promise<string> {
  return getSignedUrl(client(), new GetObjectCommand({ Bucket: bucket(), Key: key }), {
    expiresIn: EXPIRES_IN,
  });
}

export async function headObject(
  key: string,
): Promise<{ size: number; contentType: string } | null> {
  try {
    const res = await client().send(new HeadObjectCommand({ Bucket: bucket(), Key: key }));
    return { size: res.ContentLength ?? 0, contentType: res.ContentType ?? "" };
  } catch (error) {
    const e = error as { name?: string; $metadata?: { httpStatusCode?: number } };
    if (e.name === "NotFound" || e.name === "NoSuchKey" || e.$metadata?.httpStatusCode === 404) {
      return null;
    }
    throw error;
  }
}

export async function getObjectBytes(key: string): Promise<Uint8Array> {
  const res = await client().send(new GetObjectCommand({ Bucket: bucket(), Key: key }));
  if (!res.Body) throw new Error(`Empty R2 object: ${key}`);
  return res.Body.transformToByteArray();
}

export async function deleteObjects(keys: string[]): Promise<void> {
  for (let i = 0; i < keys.length; i += 1000) {
    const batch = keys.slice(i, i + 1000);
    const res = await client().send(
      new DeleteObjectsCommand({
        Bucket: bucket(),
        Delete: { Objects: batch.map((Key) => ({ Key })), Quiet: true },
      }),
    );
    // A key that is already gone is what we wanted.
    const errors = (res.Errors ?? []).filter((e) => e.Code !== "NoSuchKey");
    if (errors.length) throw new Error(`R2 failed to delete ${errors.length} object(s)`);
  }
}
