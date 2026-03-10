import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'

const _geist = Geist({ subsets: ["latin"] });
const _geistMono = Geist_Mono({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: 'Lunar - AI Code Review as LSP Diagnostics',
  description: 'AI-powered code review surfaced as LSP diagnostics. Inline, in your editor, as you write. Same squiggly lines, same Problems panel, same workflow.',
  generator: 'v0.app',
  icons: {
    icon: [
      {
        url: '/logo/logo.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/logo/logo.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/logo/logo.png',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        {children}
        <Analytics />
      </body>
    </html>
  )
}
