"use client";

import { useState, useTransition } from "react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { motion } from "framer-motion";
import {
  Phone,
  Mail,
  MapPin,
  Users,
  Clock,
  CheckCircle2,
  Send,
  Megaphone,
  Award,
  Forward,
  UserCog,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { StageBadge } from "@/components/stage-badge";
import {
  STAGES,
  STAGE_LABELS,
  RESOLUTION_PATHS,
  ROLE_LABELS,
  TASK_STATUS_LABELS,
  EDIT_BLOCKED_ROLES,
} from "@/lib/constants";
import { isOverdue } from "@/lib/sla";
import { cn } from "@/lib/utils";
import type { getAppeal, getUsers } from "@/lib/queries";
import {
  updateAppealStage,
  addAppealNote,
  updateAppealFields,
  reassignResponsible,
  createAppealTask,
  updateTaskStatus,
} from "@/lib/actions";

type Appeal = NonNullable<Awaited<ReturnType<typeof getAppeal>>>;
type Users = Awaited<ReturnType<typeof getUsers>>;
type CurrentUser = { id: string; name?: string | null; role: string };

const EVENT_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  CREATED: Send,
  STAGE_CHANGE: CheckCircle2,
  DZ_SENT: Forward,
  GRATITUDE: Award,
  MEDIA: Megaphone,
  NOTE: Clock,
};

const TASK_BADGE: Record<string, "secondary" | "warning" | "success"> = {
  PENDING: "secondary",
  IN_PROGRESS: "warning",
  DONE: "success",
};

function fmt(d: Date | null) {
  return d ? format(d, "d MMMM yyyy, HH:mm", { locale: ru }) : "—";
}

export function AppealDetail({
  appeal,
  users,
  currentUser,
}: {
  appeal: Appeal;
  users: Users;
  currentUser: CurrentUser;
}) {
  const [pending, startTransition] = useTransition();
  const [note, setNote] = useState("");
  const [reassignTo, setReassignTo] = useState("");
  const [taskAssignee, setTaskAssignee] = useState("");
  const [taskDescription, setTaskDescription] = useState("");
  const overdue = isOverdue(appeal);
  // Наблюдатель и согласующий не редактируют обращение — согласующему при
  // этом отдельно, ниже, разрешено отмечать статус СВОИХ поручений.
  const readOnly = (EDIT_BLOCKED_ROLES as readonly string[]).includes(currentUser.role);
  const canActOnTasks = currentUser.role !== "VIEWER";
  const canRoute = currentUser.role === "KAU" || currentUser.role === "ADMIN";

  const responsible = appeal.responsible.find((r) => r.isCurrent)?.user ?? appeal.responsible[0]?.user;
  const responsibleHistory = appeal.responsible.filter((r) => !r.isCurrent);

  function handleStage(stage: string) {
    startTransition(async () => {
      await updateAppealStage(appeal.id, stage);
      toast.success(`Статус: ${STAGE_LABELS[stage as keyof typeof STAGE_LABELS]}`);
    });
  }

  function handleField(name: Parameters<typeof updateAppealFields>[1]) {
    startTransition(async () => {
      await updateAppealFields(appeal.id, name);
    });
  }

  function submitNote() {
    if (!note.trim()) return;
    startTransition(async () => {
      await addAppealNote(appeal.id, note);
      setNote("");
      toast.success("Комментарий добавлен");
    });
  }

  function submitReassign() {
    if (!reassignTo) return;
    startTransition(async () => {
      await reassignResponsible(appeal.id, reassignTo);
      toast.success("Обращение передано");
      setReassignTo("");
    });
  }

  function submitTask() {
    if (!taskAssignee || !taskDescription.trim()) return;
    startTransition(async () => {
      await createAppealTask(appeal.id, taskAssignee, taskDescription);
      toast.success("Поручение создано");
      setTaskAssignee("");
      setTaskDescription("");
    });
  }

  function setTaskStatus(taskId: string, status: string) {
    startTransition(async () => {
      await updateTaskStatus(taskId, status);
      toast.success(`Поручение: ${TASK_STATUS_LABELS[status as keyof typeof TASK_STATUS_LABELS]}`);
    });
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              {appeal.lastName} {appeal.firstName} {appeal.middleName}
            </h1>
            <StageBadge stage={appeal.stage} />
            {overdue && <Badge variant="destructive">просрочено</Badge>}
          </div>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {appeal.sourceChannel} · зарегистрировано {fmt(appeal.receivedAtKau ?? appeal.createdAt)}
          </p>
        </div>

        {!readOnly && (
          <div className="flex flex-wrap gap-2">
            {STAGES.map((s) => (
              <Button
                key={s}
                size="sm"
                variant={appeal.stage === s ? "default" : "outline"}
                disabled={pending}
                onClick={() => handleStage(s)}
              >
                {STAGE_LABELS[s]}
              </Button>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Суть обращения</CardTitle>
              <CardDescription>{appeal.category}{appeal.targetAudience ? ` · ${appeal.targetAudience}` : ""}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <p className="text-sm font-medium">{appeal.goal}</p>
              {appeal.description && (
                <p className="whitespace-pre-line text-sm text-[var(--foreground)]/80">{appeal.description}</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Маршрут КАУ</CardTitle>
              <CardDescription>
                {canRoute ? "Формат ответа назначает КАУ при поступлении обращения" : "Назначается КАУ — доступно только для просмотра"}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label>Формат ответа / маршрут</Label>
                {canRoute && !readOnly ? (
                  <NativeSelect
                    defaultValue={appeal.resolutionPath ?? ""}
                    onChange={(e) => handleField({ resolutionPath: e.target.value })}
                  >
                    <option value="">— требует маршрутизации —</option>
                    {RESOLUTION_PATHS.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </NativeSelect>
                ) : (
                  <p className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm">
                    {appeal.resolutionPath ?? "— ещё не назначено —"}
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Куда направлено (депутат/комитет)</Label>
                {canRoute && !readOnly ? (
                  <Input
                    defaultValue={appeal.routingTarget ?? ""}
                    placeholder="ФИО депутата / название комитета"
                    onBlur={(e) => handleField({ routingTarget: e.target.value })}
                  />
                ) : (
                  <p className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm">
                    {appeal.routingTarget || "—"}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Концепция и алгоритм решения</CardTitle>
              <CardDescription>Согласовывается с СД до начала работы (регламент)</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <EditableField
                label="Концепция"
                defaultValue={appeal.concept ?? ""}
                onSave={(v) => handleField({ concept: v })}
                readOnly={readOnly}
              />
              <EditableField
                label="Алгоритм действий"
                defaultValue={appeal.actionPlan ?? ""}
                onSave={(v) => handleField({ actionPlan: v })}
                rows={5}
                readOnly={readOnly}
              />
              <div className="flex flex-col gap-1.5 sm:w-64">
                <Label>Контрольный срок</Label>
                <Input
                  type="date"
                  disabled={readOnly}
                  defaultValue={appeal.controlDate ? format(appeal.controlDate, "yyyy-MM-dd") : ""}
                  onBlur={(e) => handleField({ controlDate: e.target.value })}
                />
              </div>
              <EditableField
                label="Результат"
                defaultValue={appeal.result ?? ""}
                onSave={(v) => handleField({ result: v })}
                readOnly={readOnly}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Поручения</CardTitle>
              <CardDescription>Кто кому что поручил по этому обращению (цепочка делегирования)</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {!readOnly && (
                <div className="flex flex-col gap-2 rounded-lg border border-dashed border-[var(--border)] p-3">
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <NativeSelect value={taskAssignee} onChange={(e) => setTaskAssignee(e.target.value)}>
                      <option value="">Кому поручить…</option>
                      {users.filter((u) => u.id !== currentUser.id).map((u) => (
                        <option key={u.id} value={u.id}>{u.name} · {ROLE_LABELS[u.role as keyof typeof ROLE_LABELS] ?? u.role}</option>
                      ))}
                    </NativeSelect>
                  </div>
                  <Textarea
                    placeholder="Что нужно сделать (напр. подготовить и направить запрос, зарегистрировать в САДД, присвоить номер)"
                    value={taskDescription}
                    onChange={(e) => setTaskDescription(e.target.value)}
                    className="min-h-16"
                  />
                  <Button size="sm" className="self-end" disabled={pending || !taskAssignee || !taskDescription.trim()} onClick={submitTask}>
                    Поручить
                  </Button>
                </div>
              )}

              {appeal.tasks.length === 0 && (
                <p className="text-sm text-[var(--muted)]">Поручений по обращению пока нет.</p>
              )}

              <div className="flex flex-col gap-2">
                {appeal.tasks.map((task) => (
                  <div key={task.id} className="flex flex-col gap-1.5 rounded-lg border border-[var(--border)] p-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium">
                        {task.assignedBy.name} → {task.assignee.name}
                      </p>
                      <Badge variant={TASK_BADGE[task.status] ?? "secondary"}>
                        {TASK_STATUS_LABELS[task.status as keyof typeof TASK_STATUS_LABELS] ?? task.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-[var(--foreground)]/80">{task.description}</p>
                    <p className="text-xs text-[var(--muted)]">{fmt(task.createdAt)}</p>
                    {canActOnTasks &&
                      task.status !== "DONE" &&
                      (currentUser.role !== "APPROVER" || task.assigneeId === currentUser.id) && (
                        <div className="mt-1 flex gap-2">
                          {task.status === "PENDING" && currentUser.role !== "APPROVER" && (
                            <button
                              type="button"
                              disabled={pending}
                              onClick={() => setTaskStatus(task.id, "IN_PROGRESS")}
                              className="rounded-md bg-[var(--surface-2)] px-2.5 py-1 text-xs font-medium hover:bg-[var(--surface-3)]"
                            >
                              Взять в работу
                            </button>
                          )}
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() => setTaskStatus(task.id, "DONE")}
                            className="rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-emerald-500"
                          >
                            {currentUser.role === "APPROVER" ? "Согласовать" : "Выполнено"}
                          </button>
                        </div>
                      )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>История взаимодействия</CardTitle>
              <CardDescription>Полная CRM-история по обращению (требование регламента)</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {!readOnly && (
                <div className="flex gap-2">
                  <Textarea
                    placeholder="Добавить заметку / этап переписки…"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    className="min-h-16"
                  />
                  <Button onClick={submitNote} disabled={pending || !note.trim()}>Добавить</Button>
                </div>
              )}
              <ol className="flex flex-col gap-4 border-l border-[var(--border)] pl-4">
                {appeal.events.map((ev) => {
                  const Icon = EVENT_ICON[ev.type] ?? Clock;
                  return (
                    <motion.li
                      key={ev.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="relative"
                    >
                      <span className="absolute -left-[21px] flex h-4 w-4 items-center justify-center rounded-full bg-violet-600 text-white">
                        <Icon className="h-2.5 w-2.5" />
                      </span>
                      <p className="text-sm">{ev.message}</p>
                      <p className="text-xs text-[var(--muted)]">
                        {ev.author?.name ?? "Система"} · {fmt(ev.createdAt)}
                      </p>
                    </motion.li>
                  );
                })}
              </ol>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Заявитель</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2.5 text-sm">
              {appeal.phone && (
                <div className="flex items-center gap-2 text-[var(--foreground)]/80">
                  <Phone className="h-3.5 w-3.5 text-[var(--muted)]" /> {appeal.phone}
                </div>
              )}
              {appeal.email && (
                <div className="flex items-center gap-2 text-[var(--foreground)]/80">
                  <Mail className="h-3.5 w-3.5 text-[var(--muted)]" /> {appeal.email}
                </div>
              )}
              {appeal.address && (
                <div className="flex items-center gap-2 text-[var(--foreground)]/80">
                  <MapPin className="h-3.5 w-3.5 text-[var(--muted)]" /> {appeal.address}
                </div>
              )}
              {appeal.isCollective && (
                <div className="flex items-center gap-2 text-[var(--foreground)]/80">
                  <Users className="h-3.5 w-3.5 text-[var(--muted)]" /> Коллективное · {appeal.signatoryCount ?? "?"} подписей
                </div>
              )}
              {responsible && (
                <div className="mt-2 rounded-lg bg-[var(--surface-2)] p-2.5 text-xs">
                  Ответственный: <span className="font-medium">{responsible.name}</span>
                </div>
              )}
              {responsibleHistory.length > 0 && (
                <div className="text-xs text-[var(--muted)]">
                  Ранее: {responsibleHistory.map((r) => r.user.name).join(" → ")}
                </div>
              )}
            </CardContent>
          </Card>

          {!readOnly && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-1.5"><UserCog className="h-3.5 w-3.5" /> Передать обращение</CardTitle>
                <CardDescription>Полная передача ответственности (не поручение)</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                <NativeSelect value={reassignTo} onChange={(e) => setReassignTo(e.target.value)}>
                  <option value="">Выберите ответственного…</option>
                  {users.filter((u) => u.id !== responsible?.id).map((u) => (
                    <option key={u.id} value={u.id}>{u.name} · {ROLE_LABELS[u.role as keyof typeof ROLE_LABELS] ?? u.role}</option>
                  ))}
                </NativeSelect>
                <Button size="sm" disabled={pending || !reassignTo} onClick={submitReassign}>Передать</Button>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Регистрация</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm">
              <EditableField
                label="Номер в САДД"
                defaultValue={appeal.registrationNumber ?? ""}
                onSave={(v) => handleField({ registrationNumber: v })}
                compact
                readOnly={readOnly}
              />
              <EditableField
                label="Номер перенаправления"
                defaultValue={appeal.redirectNumber ?? ""}
                onSave={(v) => handleField({ redirectNumber: v })}
                compact
                readOnly={readOnly}
              />
              <ToggleRow
                label="Отправлено в ОП"
                checked={appeal.forwardedToOp}
                onChange={(v) => handleField({ forwardedToOp: v })}
                disabled={readOnly}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Закрытие обращения</CardTitle>
              <CardDescription>Обязательные шаги по регламенту</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <ToggleRow
                label="Благодарственное письмо"
                checked={appeal.gratitudeSent}
                onChange={(v) => handleField({ gratitudeSent: v })}
                icon={Award}
                disabled={readOnly}
              />
              <ToggleRow
                label="Освещено в СМИ"
                checked={appeal.mediaCoverageSent}
                onChange={(v) => handleField({ mediaCoverageSent: v })}
                icon={Megaphone}
                disabled={readOnly}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function EditableField({
  label,
  defaultValue,
  onSave,
  rows,
  compact,
  readOnly,
}: {
  label: string;
  defaultValue: string;
  onSave: (v: string) => void;
  rows?: number;
  compact?: boolean;
  readOnly?: boolean;
}) {
  const [value, setValue] = useState(defaultValue);

  if (readOnly) {
    return (
      <div className="flex flex-col gap-1.5">
        <Label>{label}</Label>
        <p className="whitespace-pre-line rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm">
          {defaultValue || "—"}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      {compact ? (
        <Input value={value} onChange={(e) => setValue(e.target.value)} onBlur={() => onSave(value)} />
      ) : (
        <Textarea
          value={value}
          rows={rows}
          onChange={(e) => setValue(e.target.value)}
          onBlur={() => onSave(value)}
          placeholder="—"
        />
      )}
    </div>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
  icon: Icon,
  disabled,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  icon?: React.ComponentType<{ className?: string }>;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "flex items-center justify-between rounded-lg border px-3 py-2 text-sm transition-colors disabled:cursor-default disabled:opacity-70",
        checked
          ? "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300"
          : "border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)]/80 enabled:hover:bg-[var(--surface-2)]"
      )}
    >
      <span className="flex items-center gap-2">
        {Icon && <Icon className="h-3.5 w-3.5" />}
        {label}
      </span>
      <span className={cn("h-4 w-4 rounded-full border", checked ? "border-emerald-500 bg-emerald-500" : "border-[var(--border)]")} />
    </button>
  );
}
