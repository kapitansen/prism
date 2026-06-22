import { useLayoutEffect, useRef, useState } from 'react'

// A suggestion shown in the @-mention dropdown.
export interface MentionOption {
  handle: string
  name: string
}

// CSS properties the mirror div must copy so its text wraps exactly like the
// textarea — that's how we locate the caret in pixels (textareas don't expose it).
const MIRROR_PROPS = [
  'boxSizing',
  'width',
  'height',
  'overflowX',
  'overflowY',
  'borderTopWidth',
  'borderRightWidth',
  'borderBottomWidth',
  'borderLeftWidth',
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',
  'fontStyle',
  'fontVariant',
  'fontWeight',
  'fontStretch',
  'fontSize',
  'lineHeight',
  'fontFamily',
  'textAlign',
  'textTransform',
  'textIndent',
  'letterSpacing',
  'wordSpacing',
  'tabSize',
  'whiteSpace',
  'wordWrap',
] as const

// Pixel position of the caret inside a textarea, via a hidden mirror element.
function caretCoordinates(el: HTMLTextAreaElement, position: number) {
  const div = document.createElement('div')
  const computed = getComputedStyle(el)
  div.style.position = 'absolute'
  div.style.visibility = 'hidden'
  div.style.whiteSpace = 'pre-wrap'
  div.style.wordWrap = 'break-word'
  for (const prop of MIRROR_PROPS) {
    div.style[prop] = computed[prop]
  }
  div.textContent = el.value.slice(0, position)
  const marker = document.createElement('span')
  marker.textContent = el.value.slice(position) || '.'
  div.appendChild(marker)
  document.body.appendChild(div)
  const top = marker.offsetTop + parseInt(computed.borderTopWidth)
  const left = marker.offsetLeft + parseInt(computed.borderLeftWidth)
  const lineHeight = parseInt(computed.lineHeight) || 18
  document.body.removeChild(div)
  return { top, left, lineHeight }
}

// The active @-token immediately left of the caret (e.g. "@nas|"), or null.
function detectMention(value: string, caret: number) {
  let i = caret - 1
  while (i >= 0) {
    const ch = value[i]
    if (ch === '@') {
      const before = i === 0 ? ' ' : value[i - 1]
      return /\s|[([]/.test(before)
        ? { start: i, query: value.slice(i + 1, caret) }
        : null
    }
    if (/\s|@/.test(ch)) return null // whitespace (or another @) ends the token
    i--
  }
  return null
}

// A controlled textarea with a Slack-style floating @-mention picker. Inserts a
// plain "@handle" into the text — no rich-text model, so the body stays portable.
export function MentionTextarea({
  value,
  onChange,
  options,
  placeholder,
  rows,
  className,
}: {
  value: string
  onChange: (value: string) => void
  options: MentionOption[]
  placeholder?: string
  rows?: number
  className?: string
}) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const [mention, setMention] = useState<{
    start: number
    query: string
    top: number
    left: number
  } | null>(null)
  const [active, setActive] = useState(0)
  // After inserting, skip the value-change refresh so it doesn't re-open before
  // the caret is repositioned past the inserted "@handle ".
  const skipRefresh = useRef(false)

  const matches = mention
    ? options
        .filter((o) => {
          const q = mention.query.toLowerCase()
          return (
            o.handle.toLowerCase().includes(q) ||
            o.name.toLowerCase().includes(q)
          )
        })
        .slice(0, 6)
    : []
  const open = mention !== null && matches.length > 0

  // Recompute the active mention from the current caret position.
  function refresh() {
    if (skipRefresh.current) {
      skipRefresh.current = false
      return
    }
    const ta = ref.current
    if (!ta) return
    const caret = ta.selectionStart
    const m = detectMention(value, caret)
    if (!m) {
      setMention(null)
      return
    }
    const { top, left, lineHeight } = caretCoordinates(ta, m.start)
    setMention({
      start: m.start,
      query: m.query,
      top: top + lineHeight - ta.scrollTop,
      left: left - ta.scrollLeft,
    })
    setActive(0)
  }

  // Keep the dropdown anchored after value/caret changes.
  useLayoutEffect(refresh, [value])

  function insert(opt: MentionOption) {
    const ta = ref.current
    if (!ta || !mention) return
    const caret = ta.selectionStart
    const next = `${value.slice(0, mention.start)}@${opt.handle} ${value.slice(caret)}`
    const pos = mention.start + opt.handle.length + 2 // after "@handle "
    skipRefresh.current = true
    onChange(next)
    setMention(null)
    requestAnimationFrame(() => {
      ta.focus()
      ta.setSelectionRange(pos, pos)
    })
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (!open) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((a) => (a + 1) % matches.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => (a - 1 + matches.length) % matches.length)
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault()
      insert(matches[active])
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setMention(null)
    }
  }

  return (
    <div className="relative">
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        onClick={refresh}
        onBlur={() => setMention(null)}
        placeholder={placeholder}
        rows={rows}
        className={className}
      />
      {open && (
        <ul
          className="absolute z-50 max-h-56 w-64 overflow-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
          style={{ top: mention.top, left: mention.left }}
        >
          {matches.map((o, i) => (
            <li key={o.handle}>
              <button
                type="button"
                // onMouseDown (not onClick) so it fires before the textarea blur.
                onMouseDown={(e) => {
                  e.preventDefault()
                  insert(o)
                }}
                className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm ${
                  i === active ? 'bg-accent text-accent-foreground' : ''
                }`}
              >
                <span className="font-medium">@{o.handle}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {o.name}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
