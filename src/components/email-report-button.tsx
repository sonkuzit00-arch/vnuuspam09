"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { emailReport } from "@/lib/report-actions";
import type { ReportFilters } from "@/lib/reports";

export function EmailReportButton({ filters, mailbox }: { filters: ReportFilters; mailbox: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      variant="outline"
      disabled={pending}
      title={`Excel-отчёт уйдёт на ${mailbox}`}
      onClick={() =>
        startTransition(async () => {
          const r = await emailReport(filters);
          if (r.error) toast.error(r.error);
          else toast.success(`Отчёт отправлен на ${mailbox}`);
        })
      }
    >
      {pending ? "Отправка…" : "На почту"}
    </Button>
  );
}
