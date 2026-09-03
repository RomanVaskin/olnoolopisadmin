import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Управление полисами — OLNOO Insurance",
  description: "Пулы страховых номеров и выпущенные полисы",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
