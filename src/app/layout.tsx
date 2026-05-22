import './globals.module.css'
import type { Metadata } from 'next'
import { Main } from './components/main'
import { Header } from './components/header'
import { Footer } from './components/footer'

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
      <body>
        <Main>
          <Header />
          {children}
          <Footer />
        </Main>
      </body>
    </html>
  )
}
