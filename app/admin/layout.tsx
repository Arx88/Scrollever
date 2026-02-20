import type { ReactNode } from "react"
import { Header } from "@/components/header"
import { requireAdminPageContext } from "@/lib/admin/page-auth"
import { AdminNav } from "@/app/admin/_components/admin-nav"

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const admin = await requireAdminPageContext()

  return (
    <main className="min-h-screen bg-background">
      <Header />
      <div className="pt-[72px] pb-16 px-4 md:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="mb-6 md:mb-8">
            <div className="flex flex-wrap items-end justify-between gap-4 mb-4">
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] text-primary font-bold mb-2">Admin Panel</p>
                <h1 className="text-2xl md:text-3xl font-display font-extrabold text-foreground uppercase tracking-tight">
                  Control Center
                </h1>
                <p className="text-xs text-muted-foreground mt-2">
                  @{admin.username} · {admin.role}
                </p>
              </div>
            </div>

            <AdminNav />
          </div>

          {children}
        </div>
      </div>
    </main>
  )
}
