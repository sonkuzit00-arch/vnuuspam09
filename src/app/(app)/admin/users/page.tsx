import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { emailConfigured, telegramConfigured } from "@/lib/notify";
import { UserAdmin } from "@/components/user-admin";
import { DeleteAllAppeals } from "@/components/delete-all-appeals";

export default async function AdminUsersPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/");

  const appealCount = await prisma.appeal.count();
  const users = await prisma.user.findMany({
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      notifyByEmail: true,
      notifyByTelegram: true,
      telegramChatId: true,
    },
  });

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Пользователи</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Учётные записи, роли, пароли. Заблокированный сотрудник не может войти, но его история сохраняется.
        </p>
      </div>
      <DeleteAllAppeals count={appealCount} />
      <UserAdmin
        currentUserId={session.user.id}
        users={users.map(({ telegramChatId, ...u }) => ({ ...u, telegramLinked: Boolean(telegramChatId) }))}
        emailAvailable={emailConfigured()}
        telegramAvailable={telegramConfigured()}
      />
    </div>
  );
}
