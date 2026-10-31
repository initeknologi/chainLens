import type { Metadata } from 'next'
import { IBM_Plex_Mono, Outfit } from 'next/font/google'
import { AppShell } from '@/components/app-shell'
import { Providers } from './providers'
import './globals.css'

const sans = Outfit({ subsets: ['latin'], variable: '--font-sans' })
const mono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-mono' })

export const metadata: Metadata = {
  title: 'ChainLens',
  description: 'Read-only multi-chain portfolio intelligence and transaction explanations.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${sans.variable} ${mono.variable} font-sans antialiased`}>
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  )
}
