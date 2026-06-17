import { type ReactNode } from 'react'
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router'

import { AppLayout } from '@/components/app-layout'
import { isAuthenticated } from '@/lib/auth'
import { CardsPage } from '@/pages/cards'
import { JournalPage } from '@/pages/journal'
import { LoginPage } from '@/pages/login'
import { PeoplePage } from '@/pages/people'
import { SettingsPage } from '@/pages/settings'
import { TodayPage } from '@/pages/today'

// Gate: no token → bounce to the login screen.
function RequireAuth({ children }: { children: ReactNode }) {
  return isAuthenticated() ? children : <Navigate to="/login" replace />
}

const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    element: (
      <RequireAuth>
        <AppLayout />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <TodayPage /> },
      { path: 'journal', element: <JournalPage /> },
      { path: 'people', element: <PeoplePage /> },
      { path: 'cards', element: <CardsPage /> },
      { path: 'settings', element: <SettingsPage /> },
    ],
  },
])

export function App() {
  return <RouterProvider router={router} />
}
