"use client";

import { useTransition } from "react";
import { MailPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { importMailNow } from "@/lib/actions";

export function ImportMailButton() {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const r = await importMailNow();
          if (r.error) return void toast.error(r.error);
          if (!r.imported && !r.linked) toast.success("Новых писем нет");
          if (r.imported) toast.success(`Новых обращений из почты: ${r.imported}`);
          if (r.linked) toast.success(`Писем по существующим карточкам: ${r.linked}`);
          if (r.failed) toast.error(`Не удалось обработать писем: ${r.failed}`);
        })
      }
    >
      <MailPlus className="h-4 w-4" />
      {pending ? "Проверяю почту…" : "Забрать письма"}
    </Button>
  );
}
