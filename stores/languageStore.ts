import { create } from 'zustand';
import { en, es } from '../i18n/locales';
import { Language, TranslationDictionary } from '../types';

interface LanguageStoreState {
  language: Language;
  setLanguage: (lang: Language) => void;
}

export const useLanguageStore = create<LanguageStoreState>((set) => ({
  language: 'es',
  setLanguage: (lang) => set({ language: lang }),
}));

export const getTranslations = (language: Language): TranslationDictionary => (language === 'es' ? es : en);
