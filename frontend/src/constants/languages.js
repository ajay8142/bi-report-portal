// Report languages supported end-to-end: admin sets a client's default here,
// and the client can override it per-run in Output Options. Codes are the
// short ISO 639-1 codes stored in the DB / sent to the API — the backend
// maps them to full BIP locale identifiers (e.g. 'fr' -> 'fr-FR').
export const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'fr', label: 'French' },
  { code: 'ar', label: 'Arabic' },
  { code: 'ru', label: 'Russian' },
  { code: 'vi', label: 'Vietnamese' },
];
