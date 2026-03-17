import { useLanguageStore, getTranslations } from '../stores/languageStore';

export const useLanguage = () => {
  const language = useLanguageStore((state) => state.language);
  const setLanguage = useLanguageStore((state) => state.setLanguage);
  const t = getTranslations(language);

  return { language, setLanguage, t };
};
