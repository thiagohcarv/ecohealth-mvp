import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl as presignUrl } from "@aws-sdk/s3-request-presigner";

const REGION = process.env["AWS_REGION"] ?? "us-east-1";
const BUCKET = process.env["AWS_S3_BUCKET"];

const SIGNED_URL_TTL_SECONDS = 5 * 60; // 5 minutos

const EXT_BY_MIME: Record<string, string> = {
  "audio/webm": ".webm",
  "audio/wav": ".wav",
  "audio/mp3": ".mp3",
  "audio/mpeg": ".mp3",
  "audio/ogg": ".ogg",
  "audio/mp4": ".mp4",
  "video/webm": ".webm",
};

let client: S3Client | null = null;

function getClient(): S3Client {
  if (!client) client = new S3Client({ region: REGION });
  return client;
}

/** True se as credenciais e o bucket necessários para o S3 estão configurados. */
export function isS3Configured(): boolean {
  return Boolean(process.env["AWS_ACCESS_KEY_ID"] && process.env["AWS_SECRET_ACCESS_KEY"] && BUCKET);
}

function parseS3Uri(uri: string): { bucket: string; key: string } {
  const match = /^s3:\/\/([^/]+)\/(.+)$/.exec(uri);
  if (!match) throw new Error(`URI S3 inválida: ${uri}`);
  return { bucket: match[1]!, key: match[2]! };
}

/**
 * Faz upload do áudio para o S3 com criptografia server-side (AES256).
 * Retorna a URI no formato "s3://bucket/key" para persistir em AudioRecording.s3Key.
 */
export async function uploadAudio(
  buffer: Buffer,
  consultationId: string,
  userId: string,
  mimeType = "audio/webm"
): Promise<string> {
  if (!isS3Configured() || !BUCKET) {
    throw new Error("S3 não configurado — defina AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY e AWS_S3_BUCKET");
  }

  const ext = EXT_BY_MIME[mimeType] ?? ".webm";
  const key = `audio/${userId}/${consultationId}${ext}`;

  await getClient().send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: buffer,
      ContentType: mimeType,
      ServerSideEncryption: "AES256",
    })
  );

  return `s3://${BUCKET}/${key}`;
}

/** Gera uma URL assinada de leitura, válida por 5 minutos. */
export async function getSignedUrl(s3Key: string): Promise<string> {
  const { bucket, key } = parseS3Uri(s3Key);
  const command = new GetObjectCommand({ Bucket: bucket, Key: key });
  return presignUrl(getClient(), command, { expiresIn: SIGNED_URL_TTL_SECONDS });
}

/** Remove o objeto de áudio do S3. */
export async function deleteAudio(s3Key: string): Promise<void> {
  const { bucket, key } = parseS3Uri(s3Key);
  await getClient().send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}
