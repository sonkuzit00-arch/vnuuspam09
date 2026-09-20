"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { motion } from "framer-motion";
import { toast } from "sonner";

const DEMO_ACCOUNTS = [
  { email: "victoria@dgd.local", role: "КАУ — Бабаханова Виктория" },
  { email: "elena.k@dgd.local", role: "GR — Ковешникова Елена" },
  { email: "sofia@dgd.local", role: "Администратор / ГД — Кузнецова Софья" },
  { email: "milana@dgd.local", role: "ГД — Сибирко Милана" },
  { email: "sergey@dgd.local", role: "Наблюдатель — Чижов Сергей" },
];

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("demo1234");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const res = await signIn("credentials", { email, password, redirect: false });
    setLoading(false);
    if (res?.error) {
      toast.error("Неверный email или пароль");
      return;
    }
    toast.success("Добро пожаловать!");
    router.push("/");
    router.refresh();
  }

  return (
    <div className="bg-mesh flex min-h-screen items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="w-full max-w-sm"
      >
        <Card className="overflow-hidden">
          <CardHeader className="pt-8">
            <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-indigo-500 text-lg font-bold text-white">
              О
            </div>
            <CardTitle className="text-lg">Обращения ДГД</CardTitle>
            <CardDescription>
              Единый учёт, маршрутизация и контроль обращений граждан
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@dgd.local"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="password">Пароль</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" disabled={loading} className="mt-1">
                {loading ? "Входим…" : "Войти"}
              </Button>
            </form>

            <div className="mt-6 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-3 text-xs text-[var(--muted)]">
              <p className="mb-1.5 font-medium text-[var(--foreground)]">Демо-доступ (пароль: demo1234)</p>
              <ul className="space-y-0.5">
                {DEMO_ACCOUNTS.map((a) => (
                  <li key={a.email}>
                    <button
                      type="button"
                      className="underline decoration-dotted underline-offset-2 hover:text-violet-500"
                      onClick={() => setEmail(a.email)}
                    >
                      {a.email}
                    </button>{" "}
                    — {a.role}
                  </li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
