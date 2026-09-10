import { createContext, useContext, useEffect, useMemo } from 'react';
import { useAuth } from './AuthContext';
import { translations, RTL_LANGUAGES } from '../i18n/translations';

const LanguageContext = createContext(null);

// Drives the whole portal's UI language from the logged-in user's assigned
// REPORT_LANGUAGE (see authController.login / clientController.getProfile).
// There's no language switcher — one user has exactly one language, for both
// the UI and their generated reports.
export function LanguageProvider({ children }) {
  const { user } = useAuth();
  const language = (user?.language || 'en').toLowerCase();
  const dir = RTL_LANGUAGES.includes(language) ? 'rtl' : 'ltr';
  const dict = translations[language] || translations.en;

  const t = useMemo(() => (key, vars) => {
    let str = dict[key] ?? translations.en[key] ?? key;
    if (vars) {
      for (const [k, v] of Object.entries(vars)) str = str.replaceAll(`{{${k}}}`, v);
    }
    return str;
  }, [dict]);

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = dir;
  }, [language, dir]);

  return (
    <LanguageContext.Provider value={{ language, dir, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components -- hook belongs with its context/provider
export const useLanguage = () => useContext(LanguageContext);
