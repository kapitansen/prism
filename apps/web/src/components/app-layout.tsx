import { useTranslation } from 'react-i18next'
import { Outlet, useLocation } from 'react-router'

import { AppSidebar } from '@/components/app-sidebar'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from '@/components/ui/breadcrumb'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { mainNav, settingsNav } from '@/config/nav'
import { useSettingsSync } from '@/hooks/use-settings-sync'

export function AppLayout() {
  const { t } = useTranslation()
  const { pathname } = useLocation()
  useSettingsSync() // load + apply saved theme/language once authenticated
  const current = [...mainNav, settingsNav].find(
    (item) => item.path === pathname,
  )

  return (
    <SidebarProvider defaultOpen={false}>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbPage>
                  {current ? t(current.labelKey) : 'Prism'}
                </BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </header>
        <Outlet />
      </SidebarInset>
    </SidebarProvider>
  )
}
