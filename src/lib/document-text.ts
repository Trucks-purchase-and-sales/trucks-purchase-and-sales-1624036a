/**
 * Browser-side text extraction for office documents so they can be fed to the
 * AI scan alongside photos/PDF (the AI gateway only accepts images and PDF).
 */

const MAX_CHARS = 12000;

function clamp(text: string) {
  const t = text.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  return t.length > MAX_CHARS ? `${t.slice(0, MAX_CHARS)}\n…[tronqué]` : t;
}

export function isSpreadsheet(file: File) {
  return /\.(xlsx|xlsm|xls|csv|ods)$/i.test(file.name);
}

export function isWordDoc(file: File) {
  return /\.(docx)$/i.test(file.name);
}

export function isTextDoc(file: File) {
  return /\.(txt|md)$/i.test(file.name);
}

export function isOfficeDoc(file: File) {
  return isSpreadsheet(file) || isWordDoc(file) || isTextDoc(file);
}

async function extractSpreadsheet(file: File): Promise<string> {
  const XLSX = await import("xlsx");
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const parts: string[] = [];
  for (const name of wb.SheetNames.slice(0, 5)) {
    const sheet = wb.Sheets[name];
    if (!sheet) continue;
    parts.push(`## Feuille: ${name}\n${XLSX.utils.sheet_to_csv(sheet, { blankrows: false })}`);
  }
  return parts.join("\n\n");
}

async function extractDocx(file: File): Promise<string> {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const entry = zip.file("word/document.xml");
  if (!entry) throw new Error("Document Word illisible");
  const xml = await entry.async("string");
  return xml
    .replace(/<w:p[^>]*>/g, "\n")
    .replace(/<w:tab[^>]*\/>/g, "\t")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

/** Returns plain text for Excel/CSV/Word/txt files. Throws on unsupported input. */
export async function extractDocumentText(file: File): Promise<string> {
  let raw: string;
  if (isSpreadsheet(file)) raw = await extractSpreadsheet(file);
  else if (isWordDoc(file)) raw = await extractDocx(file);
  else if (isTextDoc(file)) raw = await file.text();
  else throw new Error("Format non pris en charge");
  const text = clamp(raw);
  if (!text) throw new Error(`${file.name}: aucun texte détecté`);
  return text;
}
