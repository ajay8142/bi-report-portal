// Report languages supported end-to-end. An admin assigns one of these to each
// client (USERS.REPORT_LANGUAGE, see pages/admin/Clients.jsx) — it then drives
// both that client's portal UI language (see context/LanguageContext.jsx) and
// their generated report locale (locked, not user-selectable — see
// clientController.runReport). Codes are the short ISO 639-1 codes stored in
// the DB — the backend maps them to full BIP locale identifiers (e.g. 'fr' ->
// 'fr-FR'). A code with no UI translation file (ru, vi) still works for report
// generation; the portal itself just falls back to English for that user.
export const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'fr', label: 'French' },
  { code: 'ar', label: 'Arabic' },
  { code: 'ru', label: 'Russian' },
  { code: 'vi', label: 'Vietnamese' },
];
