import type { Metadata } from 'next'
import './globals.module.css'

export const metadata: Metadata = {
  title: 'Magic Protege',
  description: 'AI-assisted drawing playground powered by magic-crayon.',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
