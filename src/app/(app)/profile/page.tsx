import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { emailConfigured, telegramConfigured } from "@/lib/notify";
import { ProfileSettings } from "@/components/profile-settings";

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = await prisma.user.findUniqueOrThrow({ where: { id: session.user.id } });

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Профиль</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">{user.name} · {user.email}</p>
      </div>
      <ProfileSettings
        user={{
          email: user.email,
          notifyEmail: user.notifyEmail ?? "",
          notifyByEmail: user.notifyByEmail,
          notifyByTelegram: user.notifyByTelegram,
          telegramLinked: Boolean(user.telegramChatId),
        }}
        emailAvailable={emailConfigured()}
        telegramAvailable={telegramConfigured()}
        telegramBot={process.env.TELEGRAM_BOT_USERNAME ?? ""}
      />
    </div>
  );
}
