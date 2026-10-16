"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { deleteAllAppeals } from "@/lib/admin-actions";

export function DeleteAllAppeals({ count }: { count: number }) {
  const [pending, startTransition] = useTransition();
  const [confirmation, setConfirmation] = useState("");

  function submit() {
    if (!confirm(`Удалить все обращения (${count}) вместе с поручениями, историей и файлами? Это нельзя отменить.`)) return;
    startTransition(async () => {
      const r = await deleteAllAppeals(confirmation);
      if (r.error) return void toast.error(r.error);
      setConfirmation("");
      toast.success(`Удалено обращений: ${r.deleted}`);
    });
  }

  return (
    <Card className="border-red-300 dark:border-red-500/40">
      <CardHeader>
        <CardTitle className="text-red-600">Удалить все обращения</CardTitle>
        <CardDescription>
          Сейчас в базе {count} обращений. Будут удалены они сами, поручения, история и приложенные файлы.
          Пользователи останутся. Действие необратимо — перед этим можно выгрузить Excel в «Отчётах».
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-3">
        <Input
          className="max-w-56"
          placeholder="Введите УДАЛИТЬ"
          value={confirmation}
          onChange={(e) => setConfirmation(e.target.value)}
        />
        <Button
          className="bg-red-600 text-white hover:bg-red-500"
          disabled={pending || count === 0 || confirmation.trim().toUpperCase() !== "УДАЛИТЬ"}
          onClick={submit}
        >
          {pending ? "Удаление…" : "Удалить все"}
        </Button>
      </CardContent>
    </Card>
  );
}
