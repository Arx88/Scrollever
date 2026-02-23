import type { Metadata, Viewport } from 'next'
import { Suspense } from 'react'
import { Analytics } from '@vercel/analytics/next'
import { AuthProvider } from '@/lib/auth-context'
import { InteractionsProvider } from '@/lib/interactions-context'
import { PostLoginPopupGate } from '@/components/post-login-popup-gate'
import { AnalyticsRuntime } from '@/components/analytics-runtime'
import './globals.css'

export const metadata: Metadata = {
  title: 'SCROLLEVER - AI Art Gallery',
  description: 'Discover, explore, and collect the most stunning AI-generated images. Infinite scroll of AI creativity.',
}

export const viewport: Viewport = {
  themeColor: '#000000',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        <AuthProvider>
          <InteractionsProvider>
            {children}
            <PostLoginPopupGate />
            <Suspense fallback={null}>
              <AnalyticsRuntime />
            </Suspense>
          </InteractionsProvider>
        </AuthProvider>
        <Analytics />
      </body>
    </html>
  )
}
