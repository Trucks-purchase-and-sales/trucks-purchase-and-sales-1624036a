export type AiInputStatus = 400 | 413 | 415;

export class AiInputError extends Error {
  readonly status: AiInputStatus;

  constructor(status: AiInputStatus, message: string) {
    super(message);
    this.name = "AiInputError";
    this.status = status;
  }
}

export const VOICE_ALLOWED_MIME = new Set([
  "audio/webm",
  "audio/mp4",
  "audio/m4a",
  "audio/ogg",
  "audio/wav",
  "audio/x-wav",
  "audio/mpeg",
]);

export const OCR_ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

export const MAX_VOICE_DECODED_BYTES = 6 * 1024 * 1024;
export const MAX_OCR_IMAGE_DECODED_BYTES = 4 * 1024 * 1024;
export const MAX_OCR_AGGREGATE_DECODED_BYTES = 12 * 1024 * 1024;

// Zod transport ceilings stop a caller from replacing the old bounded strings
// with arbitrarily large serialized inputs before decoded-byte validation runs.
const encodedCharsForBytes = (bytes: number) => Math.ceil(bytes / 3) * 4;
export const MAX_VOICE_DATA_URL_CHARS = encodedCharsForBytes(MAX_VOICE_DECODED_BYTES) + 128;
export const MAX_OCR_IMAGE_DATA_URL_CHARS = encodedCharsForBytes(MAX_OCR_IMAGE_DECODED_BYTES) + 128;
export const MAX_OCR_AGGREGATE_DATA_URL_CHARS =
  encodedCharsForBytes(MAX_OCR_AGGREGATE_DECODED_BYTES) + 6 * 128;

const BASE64_DATA_URL = /^data:([^;,]+);base64,([A-Za-z0-9+/]*={0,2})$/i;

export type ValidatedDataUrl = {
  mime: string;
  base64: string;
  decodedBytes: number;
};

export function decodedBase64Bytes(base64: string): number {
  if (!base64 || base64.length % 4 !== 0) {
    throw new AiInputError(400, "Fichier encodé invalide.");
  }

  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return (base64.length / 4) * 3 - padding;
}

export function validateBase64DataUrl(
  dataUrl: string,
  opts: {
    allowedMime: ReadonlySet<string>;
    maxDecodedBytes: number;
  },
): ValidatedDataUrl {
  const match = BASE64_DATA_URL.exec(dataUrl);
  if (!match) {
    throw new AiInputError(400, "Fichier encodé invalide.");
  }

  const mime = match[1]!.toLowerCase();
  if (!opts.allowedMime.has(mime)) {
    throw new AiInputError(415, "Type de fichier non pris en charge.");
  }

  const base64 = match[2]!;
  const decodedBytes = decodedBase64Bytes(base64);
  if (decodedBytes > opts.maxDecodedBytes) {
    throw new AiInputError(413, "Fichier trop volumineux.");
  }

  return { mime, base64, decodedBytes };
}

export function validateVoiceDataUrl(dataUrl: string): ValidatedDataUrl {
  return validateBase64DataUrl(dataUrl, {
    allowedMime: VOICE_ALLOWED_MIME,
    maxDecodedBytes: MAX_VOICE_DECODED_BYTES,
  });
}

export function validateOcrImageBudgets(
  images: Array<{ data_url: string }>,
  opts: {
    perFileBytes?: number;
    aggregateBytes?: number;
  } = {},
): ValidatedDataUrl[] {
  const perFileBytes = opts.perFileBytes ?? MAX_OCR_IMAGE_DECODED_BYTES;
  const aggregateBytes = opts.aggregateBytes ?? MAX_OCR_AGGREGATE_DECODED_BYTES;
  let total = 0;

  const validated = images.map((image) => {
    const parsed = validateBase64DataUrl(image.data_url, {
      allowedMime: OCR_ALLOWED_MIME,
      maxDecodedBytes: perFileBytes,
    });
    total += parsed.decodedBytes;
    if (total > aggregateBytes) {
      throw new AiInputError(413, "Volume total des fichiers trop important.");
    }
    return parsed;
  });

  return validated;
}
