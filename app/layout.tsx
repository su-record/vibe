import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '루피의 아카이누 주먹 피하기',
  description: 'Luffy dodges Akainu\'s fists game',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko" className="h-full">
      <body className="h-full">
        {children}
      </body>
    </html>
  )
}