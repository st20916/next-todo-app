import type { Metadata } from "next";
import { Archivo, Noto_Sans_KR } from "next/font/google";
import { AppShell } from "@/components/AppShell";
import "./globals.css";

const archivo = Archivo({ variable: "--font-archivo", subsets: ["latin"] });
const notoKr = Noto_Sans_KR({ variable: "--font-noto-kr", weight: ["400", "500", "600"], preload: false });

export const metadata: Metadata = {
  title: "할 일 · 목표 관리",
  description: "1년 목표, 주간 계획, 일일 칸반을 하나로 연결하는 할 일 관리 앱",
};

// Runs before first paint so the saved theme never flashes.
const themeScript = `try{var t=localStorage.getItem("theme");if(t==="dark"||(!t&&matchMedia("(prefers-color-scheme: dark)").matches))document.documentElement.classList.add("dark")}catch(e){}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" suppressHydrationWarning className={`${archivo.variable} ${notoKr.variable} h-full antialiased`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="h-full">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
