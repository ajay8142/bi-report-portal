// Report languages supported end-to-end. An admin assigns one of these to each
// client (USERS.REPORT_LANGUAGE, see pages/admin/Clients.jsx) — it then drives
// both that client's portal UI language (see context/LanguageContext.jsx) and
// the REPORT_LANGUAGE report parameter passed to BIP (locked, not
// user-selectable — see clientController.runReport). Codes are the short
// ISO 639-1 codes stored in the DB; each one must have a matching translation
// file in src/locales/ (see i18n/translations.js) and be present in the
// backend's REPORT_LANGUAGES validation list (adminSchemas.js).
export const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'fr', label: 'French' },
  { code: 'ar', label: 'Arabic' },
  { code: 'ru', label: 'Russian' },
  { code: 'vi', label: 'Vietnamese' },
  { code: 'am', label: 'Amharic' },
];
