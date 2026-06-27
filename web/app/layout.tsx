import type { Metadata } from "next";
import "./globals.css";
import CustomCursor from "@/components/CustomCursor";

export const metadata: Metadata = {
  title: "PageForge",
  description:
    "Describe your business; the agent plans the marketing strategy, you approve it, and it builds a real landing page.",
  icons: { icon: "/ie-logo.png" },
};

// Set the theme before first paint to avoid a flash of the wrong theme.
const themeScript = `
(function () {
  try {
    var stored = localStorage.getItem('theme');
    var system = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    document.documentElement.dataset.theme = stored || system;
  } catch (e) {
    document.documentElement.dataset.theme = 'light';
  }
})();
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        {children}
        <CustomCursor />
      </body>
    </html>
  );
}
