import type { Metadata } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { DesktopLayout } from "@/app/components/DesktopLayout";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const jakartaSans = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "EcoHealth — Notas SOAP com IA",
  description: "Plataforma médica com IA para gravação de consultas e geração automática de notas SOAP",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className={`${inter.variable} ${jakartaSans.variable} font-inter antialiased`}>
        <DesktopLayout>{children}</DesktopLayout>
      </body>
    </html>
  );
}
