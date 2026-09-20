"use client";

import { motion, useSpring, useTransform } from "framer-motion";
import { useEffect } from "react";
import { cn } from "@/lib/utils";

export function StatTile({
  label,
  value,
  accent,
  icon,
  decimals = 0,
}: {
  label: string;
  value: number;
  accent?: "violet" | "emerald" | "amber" | "red";
  icon?: React.ReactNode;
  /** Знаков после запятой (напр. для «дней в среднем»). */
  decimals?: number;
}) {
  const spring = useSpring(0, { stiffness: 90, damping: 20 });
  const display = useTransform(spring, (v) =>
    decimals > 0
      ? v.toLocaleString("ru-RU", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
      : Math.round(v).toLocaleString("ru-RU")
  );

  useEffect(() => {
    spring.set(value);
  }, [value, spring]);

  const accentClass = {
    violet: "from-violet-600/10 to-violet-600/0 text-violet-600 dark:text-violet-300",
    emerald: "from-emerald-600/10 to-emerald-600/0 text-emerald-600 dark:text-emerald-300",
    amber: "from-amber-600/10 to-amber-600/0 text-amber-700 dark:text-amber-300",
    red: "from-red-600/10 to-red-600/0 text-red-600 dark:text-red-300",
  }[accent ?? "violet"];

  return (
    <div className="relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <div className={cn("absolute inset-0 bg-gradient-to-br", accentClass)} />
      <div className="relative flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-[var(--muted)]">{label}</p>
          <motion.p className="mt-1.5 text-3xl font-semibold tracking-tight">{display}</motion.p>
        </div>
        {icon && (
          <div className={cn("rounded-xl bg-[var(--surface-2)] p-2", accentClass)}>
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
