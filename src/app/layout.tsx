import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AppShell } from "@/components/shell/AppShell";
import { THEME_SCRIPT } from "@/components/shell/ThemeToggle";

export const metadata: Metadata = {
  title: {
    default: "COMMAND",
    template: "%s · COMMAND",
  },
  description:
    "A private operating system for body, business, finance, character and learning. Ambition into plan, plan into action, action into measurement.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#060607",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
