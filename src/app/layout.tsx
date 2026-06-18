import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = { title: 'Agent Command Center' }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-[#080910] text-neutral-100 h-screen overflow-hidden">
        {children}
      </body>
    </html>
  )
}
