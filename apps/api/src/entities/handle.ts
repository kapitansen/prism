// Cyrillic → Latin map for building a default @-handle from a name.
const TRANSLIT: Record<string, string> = {
  а: 'a',
  б: 'b',
  в: 'v',
  г: 'g',
  д: 'd',
  е: 'e',
  ё: 'e',
  ж: 'zh',
  з: 'z',
  и: 'i',
  й: 'y',
  к: 'k',
  л: 'l',
  м: 'm',
  н: 'n',
  о: 'o',
  п: 'p',
  р: 'r',
  с: 's',
  т: 't',
  у: 'u',
  ф: 'f',
  х: 'h',
  ц: 'ts',
  ч: 'ch',
  ш: 'sh',
  щ: 'sch',
  ъ: '',
  ы: 'y',
  ь: '',
  э: 'e',
  ю: 'yu',
  я: 'ya',
}

// Slugify a name into a base handle: transliterate, keep [a-z0-9_-], cap length.
// Hyphen and underscore are kept (they're valid in @handles, e.g. @serg-a); only
// spaces and other punctuation are dropped.
export function slugifyHandle(name: string): string {
  let out = ''
  for (const ch of name.toLowerCase().trim()) {
    if (ch in TRANSLIT) out += TRANSLIT[ch]
    else if (/[a-z0-9_-]/.test(ch)) out += ch
    // everything else (spaces, other punctuation) is dropped
  }
  // No leading/trailing separators — a handle like "-x" or "x_" reads oddly.
  out = out.slice(0, 24).replace(/^[-_]+|[-_]+$/g, '')
  return out || 'entity'
}

// Append a numeric suffix until the handle is unique within `taken` (lowercased).
export function uniqueHandle(base: string, taken: Set<string>): string {
  if (!taken.has(base)) return base
  let n = 2
  while (taken.has(`${base}${n}`)) n++
  return `${base}${n}`
}
