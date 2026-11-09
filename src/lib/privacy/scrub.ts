/**
 * Removes personal details from a student's message before any AI model sees it (and before it is stored):
 * Emirates ID numbers (784-YYYY-NNNNNNN-C), email addresses and phone numbers (UAE and international).
 * Deterministic and conservative: study details such as dates, times, page ranges and counts are left alone.
 * Pure, so it is unit-tested and usable anywhere.
 */
const EMIRATES_ID = /\b784[-\s]?\d{4}[-\s]?\d{7}[-\s]?\d\b/g;
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
// UAE numbers written internationally (+971 / 00971) or locally (05x mobile, 02-09 landline).
const UAE_INTERNATIONAL = /(?:\+|\b00)971[\s-]?\d{1,2}[\s-]?\d{3}[\s-]?\d{4}\b/g;
const UAE_LOCAL = /\b0(?:5\d|[234679])[\s-]?\d{3}[\s-]?\d{4}\b/g;
// Any other number written with a leading "+" and 8 to 15 digits.
const INTERNATIONAL = /\+\d{1,3}(?:[\s-]?\(?\d{1,4}\)?){2,5}/g;

export type ScrubResult = { text: string; found: { emails: number; phones: number; emiratesIds: number } };

export function scrubPersonalData(input: string): ScrubResult {
  const found = { emails: 0, phones: 0, emiratesIds: 0 };
  let text = input.replace(EMIRATES_ID, () => {
    found.emiratesIds++;
    return "[Emirates ID removed]";
  });
  text = text.replace(EMAIL, () => {
    found.emails++;
    return "[email removed]";
  });
  for (const pattern of [UAE_INTERNATIONAL, UAE_LOCAL]) {
    text = text.replace(pattern, () => {
      found.phones++;
      return "[phone removed]";
    });
  }
  text = text.replace(INTERNATIONAL, (match) => {
    const digits = match.replace(/\D/g, "").length;
    if (digits < 8 || digits > 15) return match;
    found.phones++;
    return "[phone removed]";
  });
  return { text, found };
}
