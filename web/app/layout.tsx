import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PageForge — AI landing pages for small businesses",
  description:
    "Makes the marketing decisions a strategist would — positioning, audience, value proposition — then renders them into a real landing page.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
