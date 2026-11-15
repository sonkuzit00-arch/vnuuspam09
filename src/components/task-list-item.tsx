"use client";

import Link from "next/link";
import { useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { updateTaskStatus } from "@/lib/actions";
import { TASK_STATUS_LABELS } from "@/lib/constants";

const VARIANT: Record<string, "warning" | "secondary" | "success"> = {
  PENDING: "secondary",
  IN_PROGRESS: "warning",
  DONE: "success",
};

type Task = {
  id: string;
  description: string;
  status: string;
  appealId: string;
  dueDate?: Date | null;
  completedAt?: Date | null;
  appeal: { lastName: string; firstName: string | null; sourceChannel: string; number?: number };
  assignedBy: { name: string };
  assignee?: { name: string };
};

export function TaskListItem({ task, readOnly }: { task: Task; readOnly?: boolean }) {
  const [pending, startTransition] = useTransition();

  function setStatus(status: string) {
    startTransition(async () => {
      await updateTaskStatus(task.id, status);
      toast.success(`Поручение: ${TASK_STATUS_LABELS[status as keyof typeof TASK_STATUS_LABELS]}`);
    });
  }

  const overdue = task.status !== "DONE" && Boolean(task.dueDate) && task.dueDate! < new Date();

  return (
    <div className={`flex flex-col gap-2 rounded-xl border bg-[var(--surface)] p-4 ${overdue ? "border-red-300 dark:border-red-800" : "border-[var(--border)]"}`}>
      <div className="flex items-start justify-between gap-3">
        <Link href={`/appeals/${task.appealId}`} className="min-w-0 hover:underline">
          <p className="truncate text-sm font-semibold">{task.appeal.lastName} {task.appeal.firstName ?? ""}</p>
          <p className="text-xs text-[var(--muted)]">
            {task.appeal.number ? `ОГ-${task.appeal.number} · ` : ""}{task.appeal.sourceChannel}
          </p>
        </Link>
        <Badge variant={VARIANT[task.status] ?? "secondary"}>{TASK_STATUS_LABELS[task.status as keyof typeof TASK_STATUS_LABELS] ?? task.status}</Badge>
      </div>
      <p className="text-sm text-[var(--foreground)]/85">{task.description}</p>
      <p className="text-xs text-[var(--muted)]">
        поручил: {task.assignedBy.name}
        {task.assignee ? ` · исполнитель: ${task.assignee.name}` : ""}
      </p>
      {task.status === "DONE" && task.completedAt ? (
        <p className="text-xs text-[var(--muted)]">выполнено {task.completedAt.toLocaleDateString("ru-RU")}</p>
      ) : (
        task.dueDate && (
          <p className={`text-xs font-medium ${overdue ? "text-red-600" : "text-[var(--muted)]"}`}>
            {overdue ? "Просрочено · срок был " : "Срок: "}
            {task.dueDate.toLocaleDateString("ru-RU")}
          </p>
        )
      )}
      {!readOnly && task.status !== "DONE" && (
        <div className="mt-1 flex gap-2">
          {task.status === "PENDING" && (
            <button
              type="button"
              disabled={pending}
              onClick={() => setStatus("IN_PROGRESS")}
              className="rounded-md bg-[var(--surface-2)] px-2.5 py-1 text-xs font-medium hover:bg-[var(--surface-3)]"
            >
              Взять в работу
            </button>
          )}
          <button
            type="button"
            disabled={pending}
            onClick={() => setStatus("DONE")}
            className="rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-emerald-500"
          >
            Отметить выполненным
          </button>
        </div>
      )}
    </div>
  );
}
