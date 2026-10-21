import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isReadOnly } from "@/lib/rbac";
import { GiftRegistry } from "@/components/gift-registry";

export default async function GiftsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const [items, issues] = await Promise.all([
    prisma.giftItem.findMany({
      where: { quantity: { gt: 0 } },
      orderBy: [{ category: "asc" }, { name: "asc" }],
      select: { id: true, category: true, name: true, description: true, nominal: true, quantity: true, note: true },
    }),
    prisma.giftIssue.findMany({
      orderBy: { approvedAt: "desc" },
      select: {
        id: true,
        quantity: true,
        recipient: true,
        reason: true,
        approvedAt: true,
        item: { select: { name: true, category: true, nominal: true } },
        issuedBy: { select: { name: true } },
      },
    }),
  ]);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Реестр подарков</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Подарки в наличии. Когда выдачу согласовал ЧСВ, нажмите «Согласовано ЧСВ» — подарок спишется из наличия и попадёт в историю выдач.
        </p>
      </div>
      <GiftRegistry items={items} issues={issues} canEdit={!isReadOnly(session.user.role)} />
    </div>
  );
}
