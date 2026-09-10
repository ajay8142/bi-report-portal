import en from '../locales/en.json';
import fr from '../locales/fr.json';
import ar from '../locales/ar.json';

// Languages with a UI translation file. A user's REPORT_LANGUAGE can be set to
// a code with no entry here (e.g. 'ru', 'vi') — report generation still uses
// that language (see backend clientController.runReport), the UI just falls
// back to English until a translation file for it is added.
export const translations = { en, fr, ar };

export const RTL_LANGUAGES = ['ar'];
