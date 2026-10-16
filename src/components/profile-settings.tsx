"use client";

import { useState, useTransition } from "react";
import { Bell, KeyRound, Mail, Send } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  updateNotificationSettings,
  createTelegramLinkCode,
  unlinkTelegram,
  sendTestNotification,
  changeOwnPassword,
} from "@/lib/profile-actions";

type ProfileUser = {
  email: string;
  notifyEmail: string;
  notifyByEmail: boolean;
  notifyByTelegram: boolean;
  telegramLinked: boolean;
};

export function ProfileSettings({
  user,
  emailAvailable,
  telegramAvailable,
  telegramBot,
}: {
  user: ProfileUser;
  emailAvailable: boolean;
  telegramAvailable: boolean;
  telegramBot: string;
}) {
  const [pending, startTransition] = useTransition();
  const [notifyEmail, setNotifyEmail] = useState(user.notifyEmail);
  const [byEmail, setByEmail] = useState(user.notifyByEmail);
  const [byTelegram, setByTelegram] = useState(user.notifyByTelegram);
  const [telegramLink, setTelegramLink] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  function run(fn: () => Promise<{ error?: string } | void>, success: string) {
    startTransition(async () => {
      try {
        const result = await fn();
        if (result?.error) toast.error(result.error);
        else toast.success(success);
      } catch {
        toast.error("Не удалось выполнить действие");
      }
    });
  }

  function linkTelegram() {
    startTransition(async () => {
      const code = await createTelegramLinkCode();
      const link = `https://t.me/${telegramBot}?start=${code}`;
      setTelegramLink(link);
      window.open(link, "_blank");
    });
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-1.5"><Bell className="h-3.5 w-3.5" /> Уведомления</CardTitle>
          <CardDescription>
            Новые обращения и поручения на вас, выполнение ваших поручений, приближение сроков.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input type="checkbox" checked={byEmail} disabled={!emailAvailable} onChange={(e) => setByEmail(e.target.checked)} />
              <Mail className="h-3.5 w-3.5" /> На почту
            </label>
            <Input
              type="email"
              placeholder={user.email}
              value={notifyEmail}
              disabled={!emailAvailable}
              onChange={(e) => setNotifyEmail(e.target.value)}
            />
            <p className="text-xs text-[var(--muted)]">
              {emailAvailable ? "Пусто — на адрес учётной записи." : "Почтовая рассылка ещё не настроена администратором."}
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={byTelegram}
                disabled={!telegramAvailable || !user.telegramLinked}
                onChange={(e) => setByTelegram(e.target.checked)}
              />
              <Send className="h-3.5 w-3.5" /> В Telegram
            </label>
            {!telegramAvailable ? (
              <p className="text-xs text-[var(--muted)]">Telegram-бот ещё не настроен администратором.</p>
            ) : user.telegramLinked ? (
              <div className="flex items-center gap-2">
                <p className="text-xs text-emerald-600">Telegram привязан</p>
                <Button variant="ghost" size="sm" disabled={pending} onClick={() => run(unlinkTelegram, "Telegram отвязан")}>
                  Отвязать
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                <Button variant="outline" size="sm" className="self-start" disabled={pending || !telegramBot} onClick={linkTelegram}>
                  Привязать Telegram
                </Button>
                {telegramLink && (
                  <p className="text-xs text-[var(--muted)]">
                    Нажмите «Запустить» в боте, затем обновите страницу. Ссылка не открылась?{" "}
                    <a className="underline" href={telegramLink} target="_blank" rel="noreferrer">Открыть бота</a>
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <Button
              disabled={pending}
              onClick={() =>
                run(
                  () => updateNotificationSettings({ notifyEmail, notifyByEmail: byEmail, notifyByTelegram: byTelegram }),
                  "Настройки сохранены"
                )
              }
            >
              Сохранить
            </Button>
            <Button variant="outline" disabled={pending} onClick={() => run(sendTestNotification, "Тестовое уведомление отправлено")}>
              Проверить
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-1.5"><KeyRound className="h-3.5 w-3.5" /> Смена пароля</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="currentPassword">Текущий пароль</Label>
            <Input id="currentPassword" type="password" autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="newPassword">Новый пароль (от 8 символов)</Label>
            <Input id="newPassword" type="password" autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          </div>
          <Button
            className="self-start"
            disabled={pending || !currentPassword || newPassword.length < 8}
            onClick={() =>
              run(async () => {
                const result = await changeOwnPassword(currentPassword, newPassword);
                if (!result.error) {
                  setCurrentPassword("");
                  setNewPassword("");
                }
                return result;
              }, "Пароль изменён")
            }
          >
            Сменить пароль
          </Button>
        </CardContent>
      </Card>
    </>
  );
}
