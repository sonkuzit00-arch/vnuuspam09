import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/providers";
import { Toaster } from "sonner";

export const metadata: Metadata = {
  title: "Обращения ДГД",
  description: "Учёт, маршрутизация и анализ обращений граждан",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className="h-full antialiased">
      <body className="min-h-full flex flex-col font-sans">
        <Providers>
          {children}
          <Toaster richColors position="top-center" />
        </Providers>
      </body>
    </html>
  );
}
