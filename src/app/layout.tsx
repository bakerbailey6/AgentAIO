import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
})

export const metadata: Metadata = { title: 'Agent Command Center' }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} font-['Inter',system-ui,sans-serif] bg-[#09090b] text-zinc-50 antialiased h-screen overflow-hidden`}>
        {children}
      </body>
    </html>
  )
}
