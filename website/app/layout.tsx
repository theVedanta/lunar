import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "../styles/globals.css";

const _geist = Geist({ subsets: ["latin"] });
const _geistMono = Geist_Mono({ subsets: ["latin"] });

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

const title = "Lunar — AI Code Review as LSP Diagnostics";
const description =
  "Lunar reviews code as you write and surfaces issues inline in your editor as standard diagnostics. Same squiggles, same Problems panel, same workflow — just with AI-powered review built directly into the loop.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),

  title: {
    default: title,
    template: "%s | Lunar",
  },
  description,
  keywords: [
    "AI code review",
    "LSP diagnostics",
    "language server protocol",
    "code quality",
    "developer tools",
    "VS Code extension",
    "Neovim plugin",
    "inline code review",
    "static analysis",
    "AI developer tools",
  ],
  authors: [{ name: "Lunar" }],
  creator: "Lunar",

  openGraph: {
    type: "website",
    locale: "en_US",
    url: "/",
    siteName: "Lunar",
    title,
    description,
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "Lunar — AI Code Review as LSP Diagnostics",
      },
    ],
  },

  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: ["/opengraph-image"],
    // creator: "@yourhandle", // add your Twitter/X handle here
  },

  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },

  icons: {
    icon: [
      { url: "/logo/logo.ico" },
      { url: "/logo/logo.png", type: "image/png" },
    ],
    apple: "/logo/logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
