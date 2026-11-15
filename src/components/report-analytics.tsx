import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { kpiLines, type Kpi, type StatRow } from "@/lib/reports";

const num = (v: number | null) => (v === null ? "—" : v.toFixed(1).replace(".", ","));
const pct = (v: number | null) => (v === null ? "—" : `${v}%`);

export function KpiGrid({ kpi }: { kpi: Kpi }) {
  const main: [string, string][] = [
    ["Поступило", String(kpi.total)],
    ["Отработано", String(kpi.closed)],
    ["Просрочено", String(kpi.overdue)],
    ["В срок", pct(kpi.inTimePct)],
    ["Положительный результат", pct(kpi.positivePct)],
    ["Ср. дней на обращение", num(kpi.avgDaysToClose)],
    ["Ср. часов до маршрутизации", num(kpi.avgHoursToRoute)],
    ["Направлено ДЗ", String(kpi.dzSent)],
  ];
  return (
    <Card>
      <CardHeader>
        <CardTitle>Ключевые показатели</CardTitle>
        <CardDescription>За выбранный период и по выбранным фильтрам</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {main.map(([label, value]) => (
            <div key={label} className="rounded-lg border border-[var(--border)] p-3">
              <p className="text-xs text-[var(--muted)]">{label}</p>
              <p className="text-2xl font-semibold tabular-nums">{value}</p>
            </div>
          ))}
        </div>
        <details className="text-sm">
          <summary className="cursor-pointer text-[var(--muted)]">Все показатели</summary>
          <table className="mt-2 w-full text-sm">
            <tbody>
              {kpiLines(kpi).map(([k, v]) => (
                <tr key={k} className="border-b border-[var(--border)] last:border-0">
                  <td className="py-1.5 pr-4">{k}</td>
                  <td className="py-1.5 text-right font-medium tabular-nums">{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      </CardContent>
    </Card>
  );
}

export const STAT_COLUMNS: { key: keyof StatRow; label: string; fmt?: (v: number | null) => string }[] = [
  { key: "total", label: "Поступило" },
  { key: "closed", label: "Отработано" },
  { key: "inProgress", label: "В работе" },
  { key: "overdue", label: "Просрочено" },
  { key: "positivePct", label: "Полож. результат", fmt: pct },
  { key: "inTimePct", label: "В срок", fmt: pct },
  { key: "avgDays", label: "Ср. дней", fmt: num },
  { key: "dz", label: "ДЗ" },
  { key: "gratitude", label: "Благодарности" },
];

export function StatTable({ title, description, rows, first }: { title: string; description?: string; rows: StatRow[]; first: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="overflow-x-auto">
        {rows.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">Нет данных за период.</p>
        ) : (
          <table className="w-full min-w-[760px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-left text-xs text-[var(--muted)]">
                <th className="py-2 pr-4 font-medium">{first}</th>
                {STAT_COLUMNS.map((c) => (
                  <th key={c.key} className="px-2 py-2 text-center font-medium">{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.label} className="border-b border-[var(--border)] last:border-0">
                  <td className="py-2 pr-4">{r.label}</td>
                  {STAT_COLUMNS.map((c) => {
                    const v = r[c.key] as number | null;
                    return (
                      <td key={c.key} className="px-2 py-2 text-center tabular-nums">
                        {c.fmt ? c.fmt(v) : v}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}
