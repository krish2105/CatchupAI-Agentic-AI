-- Scanned PDFs: when a PDF has no selectable text, the server may read the page images with the AI model (OCR).
--  * text_source says where the indexed text came from, so the app can tell the student to check OCR text.
--  * The OCR call's tokens are stored on the document and count towards the operator's daily token budget
--    (src/lib/ai/guard.ts sums agent runs and these columns).
-- Written only by the server (service role, filtered by the verified owner); students can read them through the
-- existing table-level select grant on their own rows (RLS unchanged).

alter table public.documents
  add column text_source text not null default 'pdf' check (text_source in ('pdf', 'ocr')),
  add column ocr_model text check (ocr_model is null or char_length(ocr_model) <= 120),
  add column ocr_input_tokens integer check (ocr_input_tokens is null or ocr_input_tokens >= 0),
  add column ocr_output_tokens integer check (ocr_output_tokens is null or ocr_output_tokens >= 0);

-- The daily budget sums today's OCR tokens by processing time.
create index documents_ocr_processed_idx on public.documents (processed_at) where text_source = 'ocr';
