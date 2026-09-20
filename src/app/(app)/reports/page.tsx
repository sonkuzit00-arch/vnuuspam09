import { getAllAppeals, getUsers } from "@/lib/queries";
import { requireManagementRole } from "@/lib/rbac";
import { STAGES, STAGE_LABELS } from "@/lib/constants";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { NativeSelect } from "@/components/ui/native-select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

function parseDate(v?: string) {
  return v ? new Date(v) : undefined;
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; responsibleId?: string }>;
}) {
  await requireManagementRole();
  const params = await searchParams;
  const [appeals, users] = await Promise.all([getAllAppeals(), getUsers()]);

  const from = parseDate(params.from);
  const to = parseDate(params.to);

  const filtered = appeals.filter((a) => {
    if (from && a.createdAt < from) return false;
    if (to && a.createdAt > to) return false;
    if (params.responsibleId && !a.responsible.some((r) => r.isCurrent && r.userId === params.responsibleId)) return false;
    return true;
  });

  const sources = Array.from(new Set(filtered.map((a) => a.sourceChannel))).sort();
  const table = sources.map((source) => {
    const row = STAGES.map((stage) => filtered.filter((a) => a.sourceChannel === source && a.stage === stage).length);
    return { source, row, total: row.reduce((a, b) => a + b, 0) };
  });
  const totals = STAGES.map((stage) => filtered.filter((a) => a.stage === stage).length);

  const query = new URLSearchParams(params as Record<string, string>).toString();

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Отчёты</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">Период + ответственный → итоги по источникам и статусам.</p>
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
            <Button type="submit">Сформировать</Button>
            <a href={`/api/reports/export?${query}`}>
              <Button type="button" variant="outline">Скачать CSV</Button>
            </a>
          </form>
        </CardContent>
      </Card>

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
