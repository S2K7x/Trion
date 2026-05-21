import type { Metadata } from 'next'
import { Syne, DM_Mono } from 'next/font/google'
import './globals.css'

const syne = Syne({
  subsets: ['latin'],
  variable: '--font-syne',
  display: 'swap',
})

const dmMono = DM_Mono({
  subsets: ['latin'],
  weight: ['300', '400', '500'],
  variable: '--font-dm-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Trion — SOC Dashboard',
  description: 'Security Operations Dashboard',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${syne.variable} ${dmMono.variable}`}>
      <body
        className="font-sans antialiased h-full"
        style={{ background: 'var(--bg)', color: 'var(--text)', fontSize: '14px', lineHeight: '1.5' }}
      >
        {children}
      </body>
    </html>
  )
}
