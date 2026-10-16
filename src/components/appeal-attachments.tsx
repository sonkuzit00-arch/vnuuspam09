"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { Paperclip, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { upload } from "@vercel/blob/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { deleteAttachment, registerBlobAttachment } from "@/lib/actions";

type Attachment = {
  id: string;
  fileName: string;
  size: number;
  createdAt: Date;
  uploadedBy: { name: string } | null;
};

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} КБ`;
  return `${(bytes / 1024 / 1024).toFixed(1)} МБ`;
}

export function AppealAttachments({
  appealId,
  attachments,
  canEdit,
  blobEnabled,
}: {
  appealId: string;
  attachments: Attachment[];
  canEdit: boolean;
  blobEnabled: boolean;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [pending, startTransition] = useTransition();

  async function uploadOne(file: File) {
    if (blobEnabled) {
      const blob = await upload(`appeals/${appealId}/${file.name}`, file, {
        access: "private",
        handleUploadUrl: "/api/attachments/blob-token",
        clientPayload: appealId,
      });
      await registerBlobAttachment(appealId, blob.pathname, file.name);
      return;
    }
    const form = new FormData();
    form.set("appealId", appealId);
    form.set("file", file);
    const res = await fetch("/api/attachments", { method: "POST", body: form });
    if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? "Не удалось загрузить файл");
  }

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        await uploadOne(file);
      }
      toast.success(files.length > 1 ? "Файлы приложены" : "Файл приложен");
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function handleDelete(id: string) {
    if (!confirm("Удалить файл?")) return;
    startTransition(async () => {
      await deleteAttachment(id);
      toast.success("Файл удалён");
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-1.5"><Paperclip className="h-3.5 w-3.5" /> Файлы</CardTitle>
        <CardDescription>Сканы письма, ответы органов власти, проекты документов</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {attachments.length === 0 && <p className="text-sm text-[var(--muted)]">Файлов пока нет.</p>}

        <div className="flex flex-col gap-1.5">
          {attachments.map((a) => (
            <div key={a.id} className="flex items-center justify-between gap-2 rounded-lg border border-[var(--border)] px-3 py-2">
              <div className="min-w-0">
                <a href={`/api/attachments/${a.id}`} target="_blank" rel="noreferrer" className="block truncate text-sm font-medium hover:underline">
                  {a.fileName}
                </a>
                <p className="text-xs text-[var(--muted)]">
                  {formatSize(a.size)} · {format(a.createdAt, "d MMMM yyyy, HH:mm", { locale: ru })}
                  {a.uploadedBy ? ` · ${a.uploadedBy.name}` : ""}
                </p>
              </div>
              {canEdit && (
                <Button variant="ghost" size="icon" disabled={pending} onClick={() => handleDelete(a.id)} aria-label="Удалить файл">
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
        </div>

        {canEdit && (
          <>
            <input ref={inputRef} type="file" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} />
            <Button variant="outline" size="sm" className="self-start" disabled={uploading} onClick={() => inputRef.current?.click()}>
              <Upload className="h-4 w-4" />
              {uploading ? "Загрузка…" : "Приложить файлы"}
            </Button>
            <p className="text-xs text-[var(--muted)]">До {blobEnabled ? 25 : 10} МБ на файл.</p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
