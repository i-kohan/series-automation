import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Link from "next/link";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Movie Automation",
  description: "Автоматизация работы с видео",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body className={inter.className}>
        <nav className="bg-gray-800 text-white p-4">
          <div className="container mx-auto flex space-x-4">
            <Link href="/series" className="hover:text-gray-300">
              Сериалы
            </Link>
            <Link href="/" className="hover:text-gray-300">
              Анализ видео
            </Link>
          </div>
        </nav>
        {children}
      </body>
    </html>
  );
}
