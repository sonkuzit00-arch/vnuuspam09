import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getMyTasks, getTasksAssignedBy } from "@/lib/queries";
import { StatTile } from "@/components/stat-tile";
import { TaskListItem } from "@/components/task-list-item";
import { AlertTriangle, BellRing, CheckCircle2, Clock3 } from "lucide-react";

type Task = Awaited<ReturnType<typeof getMyTasks>>[number];

/** Сначала просроченные и с ближайшим сроком, без срока — в конце. */
function byDue(a: Task, b: Task) {
  return (a.dueDate?.getTime() ?? Infinity) - (b.dueDate?.getTime() ?? Infinity);
}

function Section({ title, hint, children, count }: { title: string; hint?: string; count: number; children: React.ReactNode }) {
  if (!count) return null;
  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <h2 className="text-sm font-semibold">{title}</h2>
        <span className="rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-xs text-[var(--muted)]">{count}</span>
      </div>
      {hint && <p className="mb-3 text-xs text-[var(--muted)]">{hint}</p>}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">{children}</div>
    </div>
  );
}

export default async function TasksPage() {
  const session = await auth();
  const user = session!.user;
  if (user.role === "VIEWER") redirect("/summary");

  const [tasks, assignedByMe] = await Promise.all([getMyTasks(user.id), getTasksAssignedBy(user.id)]);
  const now = new Date();
  const fresh = tasks.filter((t) => t.status === "PENDING").sort(byDue);
  const inProgress = tasks.filter((t) => t.status === "IN_PROGRESS").sort(byDue);
  const done = tasks
    .filter((t) => t.status === "DONE")
    .sort((a, b) => (b.completedAt?.getTime() ?? 0) - (a.completedAt?.getTime() ?? 0))
    .slice(0, 30);
  const overdue = tasks.filter((t) => t.status !== "DONE" && t.dueDate && t.dueDate < now).length;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Мои задачи</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Поручения, которые поступили вам по обращениям. Нажмите на задачу, чтобы открыть карточку обращения.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatTile label="Новые" value={fresh.length} icon={<BellRing className="h-4 w-4" />} accent="violet" />
        <StatTile label="В работе" value={inProgress.length} icon={<Clock3 className="h-4 w-4" />} accent="amber" />
        <StatTile label="Просрочено" value={overdue} icon={<AlertTriangle className="h-4 w-4" />} accent="red" />
        <StatTile label="Выполнено" value={tasks.filter((t) => t.status === "DONE").length} icon={<CheckCircle2 className="h-4 w-4" />} accent="emerald" />
      </div>

      {tasks.length === 0 && assignedByMe.length === 0 && (
        <div className="rounded-2xl border border-dashed border-[var(--border)] p-10 text-center text-sm text-[var(--muted)]">
          Задач пока нет. Когда вам поставят поручение, оно появится здесь.
        </div>
      )}

      <Section title="Новые" count={fresh.length} hint="Ещё не взяты в работу — число в меню показывает именно их.">
        {fresh.map((t) => <TaskListItem key={t.id} task={t} />)}
      </Section>
      <Section title="В работе" count={inProgress.length}>
        {inProgress.map((t) => <TaskListItem key={t.id} task={t} />)}
      </Section>
      <Section title="Я поручил(а) — ждут выполнения" count={assignedByMe.length}>
        {assignedByMe.map((t) => <TaskListItem key={t.id} task={t} readOnly />)}
      </Section>
      <Section title="Выполненные" count={done.length} hint="Последние 30.">
        {done.map((t) => <TaskListItem key={t.id} task={t} readOnly />)}
      </Section>
    </div>
  );
}
