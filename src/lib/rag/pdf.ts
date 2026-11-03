import { extractText, getDocumentProxy } from "unpdf";

export const PDF_LIMITS = { maxBytes: 10 * 1024 * 1024, maxPages: 50, minTextChars: 40 } as const;

export type PdfErrorCode = "not_pdf" | "too_large" | "empty" | "encrypted" | "malformed" | "too_many_pages" | "no_text";

export class PdfError extends Error {
  constructor(public code: PdfErrorCode, message: string) {
    super(message);
  }
}

export const PDF_ERROR_MESSAGES: Record<PdfErrorCode, string> = {
  not_pdf: "This file isn't a PDF.",
  too_large: "PDFs must be 10 MB or smaller.",
  empty: "This file is empty.",
  encrypted: "Password-protected PDFs aren't supported.",
  malformed: "This PDF couldn't be read. It may be damaged.",
  too_many_pages: "PDFs can have at most 50 pages.",
  no_text: "No selectable text found. Scanned PDFs aren't supported yet — export a text-based PDF.",
};

/** Cheap structural checks before handing bytes to the parser. */
export function assertPdfBytes(bytes: Uint8Array) {
  if (bytes.byteLength === 0) throw new PdfError("empty", PDF_ERROR_MESSAGES.empty);
  if (bytes.byteLength > PDF_LIMITS.maxBytes) throw new PdfError("too_large", PDF_ERROR_MESSAGES.too_large);
  const head = new TextDecoder("latin1").decode(bytes.subarray(0, 1024));
  if (!head.includes("%PDF-")) throw new PdfError("not_pdf", PDF_ERROR_MESSAGES.not_pdf);
}

/** Returns normalized text per page (index 0 = page 1). Treats all text as untrusted data. */
export async function extractPdfPages(bytes: Uint8Array): Promise<string[]> {
  assertPdfBytes(bytes);
  let pdf: Awaited<ReturnType<typeof getDocumentProxy>>;
  try {
    pdf = await getDocumentProxy(new Uint8Array(bytes), { disableFontFace: true, verbosity: 0 });
  } catch (error) {
    const name = error instanceof Error ? error.name : "";
    if (name === "PasswordException") throw new PdfError("encrypted", PDF_ERROR_MESSAGES.encrypted);
    throw new PdfError("malformed", PDF_ERROR_MESSAGES.malformed);
  }
  try {
    if (pdf.numPages > PDF_LIMITS.maxPages) throw new PdfError("too_many_pages", PDF_ERROR_MESSAGES.too_many_pages);
    const { text } = await extractText(pdf, { mergePages: false });
    const pages = text.map(normalizeText);
    if (pages.join("").length < PDF_LIMITS.minTextChars) throw new PdfError("no_text", PDF_ERROR_MESSAGES.no_text);
    return pages;
  } catch (error) {
    if (error instanceof PdfError) throw error;
    throw new PdfError("malformed", PDF_ERROR_MESSAGES.malformed);
  } finally {
    // Release parser resources; method availability differs across bundled pdf.js builds.
    const proxy = pdf as unknown as { destroy?: () => Promise<void>; cleanup?: () => Promise<void> };
    await (proxy.destroy?.() ?? proxy.cleanup?.())?.catch(() => undefined);
  }
}

export function normalizeText(text: string): string {
  return text
    .replace(/\u0000/g, "")
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
