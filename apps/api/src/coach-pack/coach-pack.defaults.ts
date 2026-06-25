// Default coach-pack content seeded for every new user (spec §5.2, layers 2–3).
// The base methodology lives in `skills/`; this is the per-user, tunable overlay.
// Localized by the user's UI language (the user can still rewrite it freely;
// the AI responds in the language of the entry regardless).

export type Lang = 'en' | 'ru'

// Map a UserSettings.uiLanguage string to a supported content language.
export function resolveLang(uiLanguage: string | null | undefined): Lang {
  return uiLanguage?.startsWith('ru') ? 'ru' : 'en'
}

export interface CoachDefaults {
  voiceMd: string
  analysisMd: string
  sourceNote: string
}

export const COACH_DEFAULTS: Record<Lang, CoachDefaults> = {
  en: {
    voiceMd: `# Coach voice
- Tone: warm, calm, informal.
- Praise effort and concrete actions, not the person.
- No empty positivity: every bit of encouragement rests on a fact from the entries.
- Message of the day: 1–2 thoughts, not a wall of text.
`,
    analysisMd: `# Day analysis
- Extract only what is explicitly stated; never invent metrics.
- Match entities by the user's names and aliases.
- Clarifying questions: at most 3, to the point, in a friendly tone.
`,
    sourceNote: 'default',
  },
  ru: {
    voiceMd: `# Голос коуча
- Тон: тёплый, спокойный, неформальный.
- Хвали усилия и конкретные действия, а не личность.
- Без пустого позитива: каждое ободрение опирается на факт из записей.
- Сообщение дня: 1–2 мысли, а не простыня текста.
`,
    analysisMd: `# Разбор дня
- Извлекай только явно сказанное; никогда не выдумывай метрики.
- Сопоставляй сущности по именам и псевдонимам пользователя.
- Уточняющие вопросы: не больше 3, по делу, в дружелюбном тоне.
`,
    sourceNote: 'default',
  },
}
