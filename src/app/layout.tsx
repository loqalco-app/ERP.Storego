import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'
import './globals.css'

export const metadata: Metadata = {
  title: 'NORTHÉA',
  description: 'Sistema de gestión comercial',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'NORTHÉA',
  },
  icons: {
    apple: '/icons/apple-touch-icon.png',
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  },
}

export const viewport: Viewport = {
  themeColor: '#ECEEF2',
  width: 'device-width',
  initialScale: 1,
  minimumScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="NORTHÉA" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/icons/apple-touch-icon.png" />
        <link rel="icon" type="image/png" sizes="192x192" href="/icons/icon-192.png" />
        <link rel="icon" type="image/png" sizes="512x512" href="/icons/icon-512.png" />
        {/* Inter — loaded once globally, preconnect first to avoid extra DNS lookup */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap"
        />
      </head>
      <body>
        {/* Fix iOS PWA: captura --app-h y --safe-bottom una sola vez para que el BottomNav nunca salte */}
        <script dangerouslySetInnerHTML={{
          __html: `
            (function(){
              var root = document.documentElement;
              function setVars(){
                root.style.setProperty('--app-h', window.innerHeight + 'px');
                /* Lee safe-area-inset-bottom una sola vez y la fija como variable estable */
                var tmp = document.createElement('div');
                tmp.style.cssText = 'position:fixed;bottom:0;height:env(safe-area-inset-bottom,0px);pointer-events:none;visibility:hidden';
                document.body.appendChild(tmp);
                var safeB = tmp.getBoundingClientRect().height || 0;
                document.body.removeChild(tmp);
                root.style.setProperty('--safe-bottom', safeB + 'px');
              }
              setVars();
              window.addEventListener('resize', setVars);
              window.addEventListener('focus', function(){ setTimeout(setVars, 100); });
            })();
          `
        }} />
        {children}
        <script dangerouslySetInnerHTML={{
          __html: `
            if ('serviceWorker' in navigator) {
              window.addEventListener('load', () => {
                navigator.serviceWorker.register('/sw.js')
                  .catch(err => console.warn('SW error:', err))
              })
            }
          `
        }} />
      </body>
    </html>
  )
}
