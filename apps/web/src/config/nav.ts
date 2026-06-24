import {
  Layers,
  type LucideIcon,
  NotebookPen,
  Settings,
  Sun,
  Users,
} from 'lucide-react'

export type NavItem = {
  path: string
  labelKey: string
  icon: LucideIcon
}

// Single source of truth for navigation — used by the sidebar and the breadcrumb.
export const mainNav: NavItem[] = [
  { path: '/', labelKey: 'nav.today', icon: Sun },
  { path: '/journal', labelKey: 'nav.journal', icon: NotebookPen },
  { path: '/people', labelKey: 'nav.context', icon: Users },
  { path: '/cards', labelKey: 'nav.cards', icon: Layers },
]

// Settings lives in the sidebar footer, not the main menu.
export const settingsNav: NavItem = {
  path: '/settings',
  labelKey: 'nav.settings',
  icon: Settings,
}
