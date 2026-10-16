import Link from "next/link";
import { getUsers } from "@/lib/queries";
import { CHANNEL_FILTER_OPTIONS, getReportData, parseReportFilters, reportQuery, formatDate } from "@/lib/reports";
import { requireManagementRole } from "@/lib/rbac";
import { STAGES, STAGE_LABELS } from "@/lib/constants";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { NativeSelect } from "@/components/ui/native-select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; responsibleId?: string; channel?: string }>;
}) {
  await requireManagementRole();
  const params = await searchParams;
  const filters = parseReportFilters(params);
  const [data, users] = await Promise.all([getReportData(filters), getUsers()]);
  const filtered = data.appeals;

  const sources = Array.from(new Set(filtered.map((a) => a.sourceChannel))).sort();
  const table = sources.map((source) => {
    const row = STAGES.map((stage) => filtered.filter((a) => a.sourceChannel === source && a.stage === stage).length);
    return { source, row, total: row.reduce((a, b) => a + b, 0) };
  });
  const totals = STAGES.map((stage) => filtered.filter((a) => a.stage === stage).length);

  const query = reportQuery(filters);
  const exportHref = (format: string) => `/api/reports/export?${query ? `${query}&` : ""}format=${format}`;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Отчёты</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Период, ответственный, канал → итоги по месяцам, положительным результатам и благодарностям.
        </p>
      </div>

      <Card>
        <CardContent className="pt-5">
          <form className="flex flex-wrap items-end gap-4" method="get">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="from">Начало периода</Label>
              <Input id="from" name="from" type="date" defaultValue={params.from} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="to">Конец периода</Label>
              <Input id="to" name="to" type="date" defaultValue={params.to} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="responsibleId">Ответственный</Label>
              <NativeSelect id="responsibleId" name="responsibleId" defaultValue={params.responsibleId ?? ""} className="min-w-48">
                <option value="">Все ответственные</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </NativeSelect>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="channel">Канал</Label>
              <NativeSelect id="channel" name="channel" defaultValue={params.channel ?? ""} className="min-w-56">
                <option value="">Все каналы</option>
                {CHANNEL_FILTER_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </NativeSelect>
            </div>
            <Button type="submit">Сформировать</Button>
            <div className="flex gap-2">
              <a href={exportHref("xlsx")}>
                <Button type="button" variant="outline">Excel</Button>
              </a>
              <a href={exportHref("pdf")}>
                <Button type="button" variant="outline">PDF</Button>
              </a>
              <a href={exportHref("csv")}>
                <Button type="button" variant="ghost">CSV</Button>
              </a>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>По месяцам</CardTitle>
          <CardDescription>Положительный результат — обращение решено или орган власти оказал содействие</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-left text-xs text-[var(--muted)]">
                {["Месяц", "Поступило", "Решено", "Положительный результат", "В работе", "Просрочено", "Благодарности", "СМИ"].map((h, i) => (
                  <th key={h} className={i ? "px-3 py-2 text-center font-medium" : "py-2 pr-4 font-medium"}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...data.months, data.totals].map((m) => (
                <tr key={m.key} className={m.key === "total" ? "font-semibold" : "border-b border-[var(--border)]"}>
                  <td className="py-2 pr-4">{m.label}</td>
                  {[m.total, m.resolved, m.positive, m.inProgress, m.overdue, m.gratitude, m.media].map((v, i) => (
                    <td key={i} className="px-3 py-2 text-center tabular-nums">{v}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {[
          { title: "Положительные результаты", items: data.positive },
          { title: "Благодарности", items: data.gratitude },
        ].map(({ title, items }) => (
          <Card key={title}>
            <CardHeader>
              <CardTitle>{title} · {items.length}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {items.length === 0 && <p className="text-sm text-[var(--muted)]">Нет за выбранный период.</p>}
              {items.slice(0, 20).map((r) => (
                <Link key={r.id} href={`/appeals/${r.id}`} className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm hover:bg-[var(--surface-2)]">
                  <p className="font-medium">{r.name} — {r.subject}</p>
                  <p className="text-xs text-[var(--muted)]">
                    {formatDate(r.received)} · {r.responsible || "без ответственного"}{r.result ? ` · ${r.result}` : ""}
                  </p>
                </Link>
              ))}
              {items.length > 20 && <p className="text-xs text-[var(--muted)]">…и ещё {items.length - 20} — полный список в Excel/PDF.</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Итоги: {filtered.length} обращений</CardTitle>
          <CardDescription>По источникам и стадиям за выбранный период</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-left text-xs text-[var(--muted)]">
                <th className="py-2 pr-4 font-medium">Источник</th>
                {STAGES.map((s) => (
                  <th key={s} className="px-3 py-2 text-center font-medium">{STAGE_LABELS[s]}</th>
                ))}
                <th className="px-3 py-2 text-center font-medium">Итого</th>
              </tr>
            </thead>
            <tbody>
              {table.map((row) => (
                <tr key={row.source} className="border-b border-[var(--border)] last:border-0">
                  <td className="py-2 pr-4">{row.source}</td>
                  {row.row.map((v, i) => (
                    <td key={i} className="px-3 py-2 text-center tabular-nums text-[var(--muted)]">{v || ""}</td>
                  ))}
                  <td className="px-3 py-2 text-center font-semibold tabular-nums">{row.total}</td>
                </tr>
              ))}
              <tr className="font-semibold">
                <td className="py-2 pr-4">Итого</td>
                {totals.map((v, i) => (
                  <td key={i} className="px-3 py-2 text-center tabular-nums">{v}</td>
                ))}
                <td className="px-3 py-2 text-center tabular-nums">{filtered.length}</td>
              </tr>
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
