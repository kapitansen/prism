// Assembles the DATA block of the parse prompt. The instruction layers
// (core.md + active coach pack + entry-analyst skill) are added in a later step;
// for now this is the per-day input the LLM reasons over.
export function buildParsePrompt(input: {
  body: string
  chips: { key: string; value: number }[]
  answers: { question: string; answer: string }[]
}): string {
  const chips = input.chips.length
    ? input.chips.map((c) => `${c.key}=${c.value}`).join(', ')
    : '—'
  const qa = input.answers.length
    ? input.answers.map((a) => `В: ${a.question}\nО: ${a.answer}`).join('\n\n')
    : '—'

  return [
    'Разбери запись дня. Верни ТОЛЬКО JSON по контракту extraction.',
    '',
    `Текст дня:\n${input.body}`,
    '',
    `Метрики (чипы пользователя): ${chips}`,
    '',
    `Ответы на уточняющие вопросы:\n${qa}`,
  ].join('\n')
}
