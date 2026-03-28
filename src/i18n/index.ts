import { createContext, useContext } from 'react'
import { de, type TranslationKey } from './de'
import { en } from './en'

const translations = { de, en } as const
export type Language = keyof typeof translations

const I18nContext = createContext<Language>('de')
export const I18nProvider = I18nContext.Provider

export function useTranslation() {
  const lang = useContext(I18nContext)
  const t = (key: TranslationKey): string => {
    return translations[lang]?.[key] ?? translations.de[key] ?? key
  }
  return { t, lang }
}
