import { createContext, type ReactNode, useContext } from 'react'
import { createPortal } from 'react-dom'

// The header bar (in AppLayout) exposes a DOM node here; pages render their
// page-specific actions into it via <HeaderActions>, so the controls live in
// the top window header instead of inside the page body.
// eslint-disable-next-line react-refresh/only-export-components
export const HeaderActionsContext = createContext<HTMLElement | null>(null)

export function HeaderActions({ children }: { children: ReactNode }) {
  const target = useContext(HeaderActionsContext)
  return target ? createPortal(children, target) : null
}
