import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

import en from './locales/en.json'
import ru from './locales/ru.json'

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    ru: { translation: ru },
  },
  lng: 'ru', // default display language
  fallbackLng: 'en', // used if a key is missing in the current language
  interpolation: {
    escapeValue: false, // React already protects against XSS
  },
})

export default i18n
