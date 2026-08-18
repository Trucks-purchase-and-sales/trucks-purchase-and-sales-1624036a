export type JsonBodyResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: 400 | 413; error: string };

const INVALID_JSON = "Corps JSON invalide";
const BODY_TOO_LARGE = "Requête trop volumineuse";

/**
 * Parse a public API JSON body without first buffering an unbounded request.
 *
 * `Content-Length` is used as an early rejection only. The stream is still
 * counted while reading because chunked requests and untrusted clients may
 * omit or falsify that header.
 */
export async function readBoundedJson<T>(
  request: Request,
  maxBytes: number,
): Promise<JsonBodyResult<T>> {
  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0) {
    throw new Error("maxBytes must be a positive safe integer");
  }

  const rawLength = request.headers.get("content-length");
  if (rawLength && /^\d+$/.test(rawLength)) {
    const declaredLength = Number(rawLength);
    if (Number.isSafeInteger(declaredLength) && declaredLength > maxBytes) {
      return { ok: false, status: 413, error: BODY_TOO_LARGE };
    }
  }

  const reader = request.body?.getReader();
  if (!reader) return { ok: false, status: 400, error: INVALID_JSON };

  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;

      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel("request body too large").catch(() => undefined);
        return { ok: false, status: 413, error: BODY_TOO_LARGE };
      }
      chunks.push(value);
    }
  } catch {
    return { ok: false, status: 400, error: INVALID_JSON };
  }

  if (totalBytes === 0) return { ok: false, status: 400, error: INVALID_JSON };

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    return { ok: true, data: JSON.parse(new TextDecoder().decode(bytes)) as T };
  } catch {
    return { ok: false, status: 400, error: INVALID_JSON };
  }
}
