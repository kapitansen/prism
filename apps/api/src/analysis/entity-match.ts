// Loose name matcher for deciding which people/entities are likely mentioned in
// a day's text, so we can push their dossiers into the prompt. This is only a
// heuristic to *surface context* — the LLM does the authoritative matching
// against the candidate list. Names appear in inflected/extended forms
// (e.g. Alex → Alexa), so exact comparison fails; we match a word that starts
// with the name's stem, but cap the matched word's length so a stem like "sam"
// catches "Sammy" but not the unrelated word "samurai". Works for any script
// (\p{L}), which matters for inflection-heavy languages like Russian.

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// True if the text contains an exact @handle reference (the authoritative,
// unambiguous mention — preferred over the fuzzy name match below).
export function handleMentioned(text: string, handle: string | null): boolean {
  if (!handle) return false
  return new RegExp(`@${escapeRegex(handle)}\\b`, 'i').test(text)
}

// True if any of the given names/aliases plausibly appears in the text.
export function mentioned(text: string, names: string[]): boolean {
  return names.some((raw) => {
    const name = raw.toLowerCase().trim()
    if (name.length < 3) return false // too short to match safely
    const stem = name.slice(0, Math.max(3, name.length - 2))
    // Match the stem at a word start (not preceded by a letter — \b is ASCII
    // only, so we use a Unicode lookbehind), then the rest of the word.
    const re = new RegExp(`(?<!\\p{L})${escapeRegex(stem)}\\p{L}*`, 'giu')
    for (const m of text.matchAll(re)) {
      // Allow only short inflections (e.g. "Маша" → "Машу/Машей"); reject longer
      // words that merely share the stem ("машине" the car, "samurai").
      if (m[0].length <= name.length + 1) return true
    }
    return false
  })
}
