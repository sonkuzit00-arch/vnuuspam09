"use client";

import { useState, useTransition } from "react";
import { Mail, Send, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { ROLES, ROLE_LABELS } from "@/lib/constants";
import { createUser, updateUser, resetUserPassword, setUserActive, setupTelegramWebhook } from "@/lib/admin-actions";

type AdminUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  notifyByEmail: boolean;
  notifyByTelegram: boolean;
  telegramLinked: boolean;
};

type Result = { error?: string; password?: string };

function RoleSelect(props: React.ComponentProps<typeof NativeSelect>) {
  return (
    <NativeSelect {...props}>
      {ROLES.map((r) => (
        <option key={r} value={r}>{ROLE_LABELS[r]}</option>
      ))}
    </NativeSelect>
  );
}

function UserRow({
  user,
  isSelf,
  run,
}: {
  user: AdminUser;
  isSelf: boolean;
  run: (fn: () => Promise<Result>, success: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [role, setRole] = useState(user.role);

  return (
    <div className={`flex flex-col gap-2 rounded-lg border border-[var(--border)] p-3 ${user.isActive ? "" : "opacity-60"}`}>
      {editing ? (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <Input value={name} onChange={(e) => setName(e.target.value)} aria-label="ФИО" />
          <Input value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Email" />
          <RoleSelect value={role} onChange={(e) => setRole(e.target.value)} aria-label="Роль" />
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium">{user.name}</p>
          <Badge variant="secondary">{ROLE_LABELS[user.role as keyof typeof ROLE_LABELS] ?? user.role}</Badge>
          {!user.isActive && <Badge variant="destructive">Заблокирован</Badge>}
          <span className="text-xs text-[var(--muted)]">{user.email}</span>
          {user.notifyByEmail && <Mail className="h-3.5 w-3.5 text-[var(--muted)]" aria-label="Уведомления на почту" />}
          {user.notifyByTelegram && user.telegramLinked && <Send className="h-3.5 w-3.5 text-[var(--muted)]" aria-label="Уведомления в Telegram" />}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {editing ? (
          <>
            <Button
              size="sm"
              onClick={() =>
                run(async () => {
                  const r = await updateUser(user.id, { name, email, role });
                  if (!r.error) setEditing(false);
                  return r;
                }, "Сохранено")
              }
            >
              Сохранить
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Отмена</Button>
          </>
        ) : (
          <>
            <Button size="sm" variant="outline" onClick={() => setEditing(true)}>Изменить</Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => confirm(`Сбросить пароль для ${user.name}?`) && run(() => resetUserPassword(user.id), "Пароль сброшен")}
            >
              Сбросить пароль
            </Button>
            {!isSelf && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => run(() => setUserActive(user.id, !user.isActive), user.isActive ? "Заблокирован" : "Разблокирован")}
              >
                {user.isActive ? "Заблокировать" : "Разблокировать"}
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export function UserAdmin({
  users,
  currentUserId,
  emailAvailable,
  telegramAvailable,
}: {
  users: AdminUser[];
  currentUserId: string;
  emailAvailable: boolean;
  telegramAvailable: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [issuedPassword, setIssuedPassword] = useState<{ email: string; password: string } | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("GD");
  const [password, setPassword] = useState("");

  function run(fn: () => Promise<Result>, success: string, forEmail?: string) {
    startTransition(async () => {
      try {
        const result = await fn();
        if (result.error) return void toast.error(result.error);
        toast.success(success);
        if (result.password) setIssuedPassword({ email: forEmail ?? "", password: result.password });
      } catch {
        toast.error("Не удалось выполнить действие");
      }
    });
  }

  function submitCreate() {
    const forEmail = email;
    run(
      async () => {
        const r = await createUser({ name, email, role, password: password || undefined });
        if (!r.error) {
          setName("");
          setEmail("");
          setPassword("");
          if (password) return {};
        }
        return r;
      },
      "Пользователь создан",
      forEmail
    );
  }

  return (
    <>
      {issuedPassword && (
        <Card className="border-amber-400">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-5">
            <p className="text-sm">
              Новый пароль{issuedPassword.email ? ` для ${issuedPassword.email}` : ""}:{" "}
              <code className="rounded bg-[var(--surface-2)] px-2 py-0.5 font-mono">{issuedPassword.password}</code>
              <span className="ml-2 text-xs text-[var(--muted)]">Передайте сотруднику — больше он показан не будет.</span>
            </p>
            <Button size="sm" variant="ghost" onClick={() => setIssuedPassword(null)}>Скрыть</Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-1.5"><UserPlus className="h-3.5 w-3.5" /> Новый пользователь</CardTitle>
          <CardDescription>Пароль можно не задавать — сгенерируется автоматически.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="new-name">ФИО</Label>
            <Input id="new-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="new-email">Email (логин)</Label>
            <Input id="new-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="new-role">Роль</Label>
            <RoleSelect id="new-role" value={role} onChange={(e) => setRole(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="new-password">Пароль (необязательно)</Label>
            <Input id="new-password" type="text" autoComplete="off" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <Button className="self-start" disabled={pending || !name || !email} onClick={submitCreate}>
            Создать
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Все пользователи · {users.length}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {users.map((u) => (
            <UserRow
              key={u.id}
              user={u}
              isSelf={u.id === currentUserId}
              run={(fn, success) => run(fn, success, u.email)}
            />
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Каналы уведомлений</CardTitle>
          <CardDescription>Настраиваются переменными окружения (см. README)</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm">
          <p>Почта: {channelStatus(emailAvailable)}</p>
          <div className="flex flex-wrap items-center gap-3">
            <p>Telegram: {channelStatus(telegramAvailable)}</p>
            {telegramAvailable && (
              <Button size="sm" variant="outline" disabled={pending} onClick={() => run(setupTelegramWebhook, "Вебхук Telegram подключён")}>
                Подключить вебхук бота
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </>
  );
}

function channelStatus(ok: boolean) {
  return ok ? <span className="text-emerald-600">настроено</span> : <span className="text-[var(--muted)]">не настроено</span>;
}
