import type { Metadata } from "next";
import "./globals.css";
import { APP_NAME, APP_SHORT_NAME, THEME_STORAGE_KEY } from "@/lib/brand";

export const metadata: Metadata = {
  title: APP_NAME,
  description: `${APP_SHORT_NAME} household contractor and vehicle access tracking.`,
  icons: {
    icon: "/icon.svg",
    shortcut: "/icon.svg",
    apple: "/icon.svg",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0f172a",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full antialiased">
      {/* Inline script runs synchronously before first paint — prevents flash of wrong theme */}
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('${THEME_STORAGE_KEY}');if(t==='dark'||t==='light')document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
