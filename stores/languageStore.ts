import { create } from 'zustand';
import { Language, TranslationDictionary } from '../types';
import { en, es } from '../i18n/locales';

export interface LanguageStoreState {
  language: Language;
  t: TranslationDictionary;
  setLanguage: (lang: Language) => void;
}

export const useLanguageStore = create<LanguageStoreState>()((set) => ({
  language: 'es' as Language,
  t: es,
  setLanguage: (lang: Language) =>
    set({ language: lang, t: lang === 'es' ? es : en }),
}));
