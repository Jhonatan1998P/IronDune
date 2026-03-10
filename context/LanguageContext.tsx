
import React, { createContext, useContext, useState } from 'react';
import { Language, TranslationDictionary } from '../types';
import { en, es } from '../i18n/locales';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: TranslationDictionary;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Inicializar estado desde localStorage o por defecto 'es' (Español)
  const [language, setLanguageState] = useState<Language>(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      const saved = localStorage.getItem('ironDune_language_pref');
      if (saved === 'en' || saved === 'es') {
        return saved;
      }
    }
    return 'es';
  });

  // Wrapper para actualizar estado y guardar en localStorage
  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('ironDune_language_pref', lang);
  };

  const t = language === 'es' ? es : en;

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
