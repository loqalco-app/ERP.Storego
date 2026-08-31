'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'

const NAV = [
  {
    key: 'dashboard', href: '/dashboard', label: 'Inicio',
    icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="8" height="9" rx="1.5"/><rect x="13" y="3" width="8" height="5" rx="1.5"/>
      <rect x="13" y="12" width="8" height="9" rx="1.5"/><rect x="3" y="16" width="8" height="5" rx="1.5"/>
    </svg>,
  },
  {
    key: 'pos', href: '/pos', label: 'POS',
    icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2"/>
      <path d="M8 21h8M12 17v4"/><path d="M7 8h4M7 11.5h2"/>
    </svg>,
  },
  {
    key: 'catalog', href: '/catalog', label: 'Inventario',
    icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
      <polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>
    </svg>,
  },
  {
    key: 'customers', href: '/customers', label: 'Clientes',
    icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>,
  },
  {
    key: 'settings', href: '/settings/profile', label: 'Ajustes',
    icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>,
  },
]

function nameInitials(name: string) {
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?'
}

interface Props { active: string; orgName?: string; userName?: string }

export default function Sidebar({ active }: Props) {
  const pathname = usePathname()
  const [initials, setInitials] = useState('?')

  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => {
      if (!data.user) return
      const meta = data.user.user_metadata
      const name = meta?.full_name || meta?.name || data.user.email?.split('@')[0] || '?'
      setInitials(nameInitials(name))
    })
  }, [])

  // Derive active key from pathname for auto-highlighting
  const currentKey = NAV.find(n => n.href !== '/dashboard' && pathname?.startsWith(n.href))?.key
    ?? (pathname === '/dashboard' ? 'dashboard' : active)

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

        /* ── Profile button — top right ── */
        .nav-profile{
          position:fixed;top:0;right:0;z-index:300;
          padding:env(safe-area-inset-top,12px) 16px 0;
          padding-top:max(env(safe-area-inset-top,0px),12px)
        }
        @media(min-width:768px){.nav-profile{padding-top:max(env(safe-area-inset-top,0px),20px);right:20px}}
        .profile-btn{
          width:38px;height:38px;border-radius:50%;
          background:linear-gradient(135deg,var(--brand,#1D4ED8),var(--brand-light,#3B82F6));
          display:flex;align-items:center;justify-content:center;
          font-size:13px;font-weight:800;color:white;
          text-decoration:none;
          box-shadow:var(--shadow-brand-sm,0 4px 14px rgba(29,78,216,0.28));
          letter-spacing:0;
          -webkit-tap-highlight-color:transparent;
          transition:transform 0.12s,box-shadow 0.12s
        }
        .profile-btn:active{transform:scale(0.93)}

        /* ── Bottom fade ── */
        .nav-fade{
          position:fixed;bottom:0;left:0;right:0;
          height:calc(var(--nav-h,88px) + 10px);
          background:linear-gradient(to top,var(--bg,#ECEEF2) 60%,transparent);
          pointer-events:none;z-index:198
        }

        /* ── Nav bar ── */
        .nav-bar{
          position:fixed;bottom:0;left:0;right:0;z-index:199;
          display:flex;justify-content:center;
          padding:0 14px env(safe-area-inset-bottom,16px);
          padding-bottom:max(env(safe-area-inset-bottom,0px),16px);
          pointer-events:none
        }
        @media(min-width:480px){.nav-bar{padding-left:24px;padding-right:24px}}

        /* ── Floating pill ── */
        .nav-pill{
          display:flex;align-items:center;gap:2px;
          background:var(--bg,#ECEEF2);
          border-radius:var(--r-2xl,28px);
          padding:7px;
          box-shadow:0 20px 60px rgba(0,0,0,0.14),0 6px 20px rgba(0,0,0,0.09),inset 0 1px 0 rgba(255,255,255,0.80);
          pointer-events:all;
          width:100%
        }
        @media(min-width:480px){.nav-pill{width:auto;min-width:380px;max-width:520px}}

        /* ── Nav item ── */
        .nav-item{
          flex:1;
          display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;
          padding:10px 4px 9px;
          border-radius:20px;
          text-decoration:none;
          /* INACTIVE: black icon, good contrast */
          color:#0A0A0E;
          opacity:0.40;
          font-family:var(--font,'Inter',-apple-system,sans-serif);
          transition:color 0.14s,background 0.14s,opacity 0.14s;
          cursor:pointer;
          min-width:0;
          -webkit-tap-highlight-color:transparent
        }
        @media(min-width:480px){.nav-item{padding:10px 14px 9px;min-width:76px}}

        /* ACTIVE: blue pill, white icon */
        .nav-item.on{
          background:var(--grad-brand,linear-gradient(135deg,#1D4ED8,#2563EB));
          color:white;
          opacity:1;
          box-shadow:0 6px 18px rgba(29,78,216,0.30)
        }
        .nav-item:not(.on):active{opacity:0.70;background:rgba(0,0,0,0.05)}

        .nav-icon{
          display:flex;align-items:center;justify-content:center;
          transition:transform 0.12s
        }
        .nav-item.on .nav-icon{transform:scale(1.08)}

        /* Label: always visible but subtle when inactive */
        .nav-lbl{
          font-size:9px;font-weight:700;
          letter-spacing:0.04em;
          white-space:nowrap;line-height:1;
          transition:opacity 0.14s
        }
        @media(max-width:379px){.nav-lbl{display:none}}
        @media(min-width:380px){.nav-lbl{font-size:9px}}
        @media(min-width:480px){.nav-lbl{font-size:10px}}
      `}</style>

      {/* Profile avatar — fixed top right */}
      <Link href="/settings/profile" className="nav-profile" aria-label="Mi perfil">
        <div className="profile-btn">{initials}</div>
      </Link>

      {/* Bottom fade */}
      <div className="nav-fade" aria-hidden="true" />

      {/* Bottom nav pill */}
      <nav className="nav-bar" aria-label="Navegación principal">
        <div className="nav-pill">
          {NAV.map(item => {
            const isActive = currentKey === item.key
            return (
              <Link
                key={item.key}
                href={item.href}
                className={`nav-item${isActive ? ' on' : ''}`}
                aria-current={isActive ? 'page' : undefined}
              >
                <span className="nav-icon">{item.icon}</span>
                <span className="nav-lbl">{item.label}</span>
              </Link>
            )
          })}
        </div>
      </nav>
    </>
  )
}
