import React from 'react';
import { useLanguageStore, getTranslations } from '../stores/languageStore';

interface LanguageContextType {
  language: ReturnType<typeof useLanguageStore.getState>['language'];
  setLanguage: ReturnType<typeof useLanguageStore.getState>['setLanguage'];
  t: ReturnType<typeof getTranslations>;
}

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <>{children}</>;
};

export const useLanguage = (): LanguageContextType => {
  const language = useLanguageStore((state) => state.language);
  const setLanguage = useLanguageStore((state) => state.setLanguage);
  const t = getTranslations(language);

  return { language, setLanguage, t };
};
