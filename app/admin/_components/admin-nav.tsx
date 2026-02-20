"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { BarChart3, Flag, Settings, Shield } from "lucide-react"

const links = [
  {
    href: "/admin",
    label: "Dashboard",
    icon: BarChart3,
  },
  {
    href: "/admin/settings",
    label: "Settings",
    icon: Settings,
  },
  {
    href: "/admin/flags",
    label: "Flags",
    icon: Flag,
  },
  {
    href: "/admin/audit",
    label: "Audit",
    icon: Shield,
  },
]

export function AdminNav() {
  const pathname = usePathname()

  return (
    <nav className="flex items-center gap-2 overflow-x-auto pb-1">
      {links.map((link) => {
        const Icon = link.icon
        const active = pathname === link.href

        return (
          <Link
            key={link.href}
            href={link.href}
            className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors whitespace-nowrap ${
              active
                ? "bg-primary text-primary-foreground"
                : "bg-surface text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {link.label}
          </Link>
        )
      })}
    </nav>
  )
}
