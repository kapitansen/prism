import { createBrowserRouter, RouterProvider } from 'react-router'

import { AppLayout } from '@/components/app-layout'
import { CardsPage } from '@/pages/cards'
import { JournalPage } from '@/pages/journal'
import { PeoplePage } from '@/pages/people'
import { SettingsPage } from '@/pages/settings'
import { TodayPage } from '@/pages/today'

const router = createBrowserRouter([
  {
    element: <AppLayout />,
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
