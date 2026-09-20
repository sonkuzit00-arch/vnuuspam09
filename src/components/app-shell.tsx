"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { motion } from "framer-motion";
import {
  Inbox,
  LayoutGrid,
  FileBarChart,
  PlusCircle,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ROLE_LABELS } from "@/lib/constants";

type ShellUser = { id: string; name?: string | null; email?: string | null; role: string };

const NAV = [
  { href: "/", label: "Личный кабинет", icon: Inbox, roles: ["EMPLOYEE", "KAU", "ADMIN"] },
  { href: "/summary", label: "Общий свод", icon: LayoutGrid, roles: ["KAU", "ADMIN"] },
  { href: "/reports", label: "Отчёты", icon: FileBarChart, roles: ["KAU", "ADMIN"] },
];

function initials(name?: string | null) {
  if (!name) return "?";
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function AppShell({ user, children }: { user: ShellUser; children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="bg-mesh flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-[var(--border)] bg-[var(--surface)]/80 backdrop-blur-xl md:flex">
        <div className="flex items-center gap-2 px-5 py-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-indigo-500 text-sm font-bold text-white shadow-lg shadow-violet-600/20">
            О
          </div>
          <div>
            <p className="text-sm font-semibold leading-tight">Обращения ДГД</p>
            <p className="text-[11px] text-[var(--muted)]">учёт · маршрутизация · анализ</p>
          </div>
        </div>

        <nav className="flex flex-1 flex-col gap-1 px-3">
          {NAV.filter((item) => item.roles.includes(user.role)).map((item) => {
            const active = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "text-[var(--foreground)]"
                    : "text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]"
                )}
              >
                {active && (
                  <motion.span
                    layoutId="nav-active"
                    className="absolute inset-0 rounded-lg bg-[var(--surface-2)]"
                    transition={{ type: "spring", stiffness: 400, damping: 32 }}
                  />
                )}
                <Icon className="relative z-10 h-4 w-4" />
                <span className="relative z-10">{item.label}</span>
              </Link>
            );
          })}

          <Link
            href="/appeals/new"
            className="mt-3 flex items-center gap-2.5 rounded-lg bg-violet-600 px-3 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-violet-500"
          >
            <PlusCircle className="h-4 w-4" />
            Новое обращение
          </Link>
        </nav>

        <div className="flex items-center gap-2.5 border-t border-[var(--border)] p-4">
          <Avatar>
            <AvatarFallback>{initials(user.name)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium">{user.name}</p>
            <p className="text-[11px] text-[var(--muted)]">{ROLE_LABELS[user.role as keyof typeof ROLE_LABELS] ?? user.role}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={() => signOut({ callbackUrl: "/login" })}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </aside>

      <div className="flex min-h-screen flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-[var(--border)] bg-[var(--background)]/80 px-4 py-3 backdrop-blur-xl md:hidden">
          <p className="text-sm font-semibold">Обращения ДГД</p>
          <Button variant="ghost" size="icon" onClick={() => signOut({ callbackUrl: "/login" })}>
            <LogOut className="h-4 w-4" />
          </Button>
        </header>
        <main className="flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
      </div>
    </div>
  );
}
