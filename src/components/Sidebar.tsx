'use client'

import Link from 'next/link'

const NAV = [
  {
    key: 'dashboard', href: '/dashboard', label: 'Inicio',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? 'white' : 'none'} stroke={active ? 'white' : 'currentColor'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="8" height="9" rx="1.5"/><rect x="13" y="3" width="8" height="5" rx="1.5"/>
        <rect x="13" y="12" width="8" height="9" rx="1.5"/><rect x="3" y="16" width="8" height="5" rx="1.5"/>
      </svg>
    ),
  },
  {
    key: 'pos', href: '/pos', label: 'POS',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? 'white' : 'currentColor'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="3" width="20" height="14" rx="2"/>
        <path d="M8 21h8M12 17v4"/><path d="M7 8h4M7 11.5h2"/>
      </svg>
    ),
  },
  {
    key: 'catalog', href: '/catalog', label: 'Inventario',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? 'white' : 'currentColor'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
        <polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>
      </svg>
    ),
  },
  {
    key: 'customers', href: '/customers', label: 'Clientes',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? 'white' : 'currentColor'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
  },
  {
    key: 'settings', href: '/settings/profile', label: 'Ajustes',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? 'white' : 'currentColor'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3"/>
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
      </svg>
    ),
  },
]

interface Props {
  active: string
  orgName?: string
  userName?: string
}

export default function Sidebar({ active }: Props) {
  return (
    <>
      <style>{`
        /* ── Global nav reset ── */
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

        /* Bottom fade so content doesn't clip under the nav */
        .nav-fade{
          position:fixed;bottom:0;left:0;right:0;height:var(--nav-h,88px);
          background:linear-gradient(to top,var(--bg,#ECEEF2) 55%,transparent);
          pointer-events:none;z-index:198
        }

        /* Nav wrapper */
        .nav-bar{
          position:fixed;bottom:0;left:0;right:0;z-index:199;
          display:flex;justify-content:center;
          padding:0 16px 16px;
          pointer-events:none
        }
        @media(min-width:480px){.nav-bar{padding:0 24px 20px}}
        @media(min-width:768px){.nav-bar{padding:0 32px 24px}}

        /* The floating pill */
        .nav-pill{
          display:flex;align-items:center;gap:2px;
          background:var(--bg,#ECEEF2);
          border-radius:var(--r-2xl,28px);
          padding:7px;
          box-shadow:var(--shadow-float,0 16px 48px rgba(0,0,0,0.13),0 4px 16px rgba(0,0,0,0.08));
          pointer-events:all;
          width:100%
        }
        @media(min-width:480px){.nav-pill{width:auto;min-width:380px;max-width:540px}}

        /* Each nav item */
        .nav-item{
          flex:1;
          display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;
          padding:9px 4px 8px;
          border-radius:20px;
          text-decoration:none;
          color:var(--text-4,rgba(26,26,32,0.30));
          font-family:var(--font,'Inter',-apple-system,sans-serif);
          transition:color 0.14s,background 0.14s;
          cursor:pointer;
          min-width:0;
          -webkit-tap-highlight-color:transparent
        }
        @media(min-width:480px){.nav-item{padding:10px 12px 9px;min-width:80px}}

        .nav-item.on{
          background:var(--grad-brand,linear-gradient(135deg,#1D4ED8,#2563EB));
          color:white;
          box-shadow:var(--shadow-brand-sm,0 4px 14px rgba(29,78,216,0.28))
        }
        .nav-item:not(.on):active{
          background:rgba(0,0,0,0.05);
          color:var(--text-1,#1A1A20)
        }

        .nav-icon{
          display:flex;align-items:center;justify-content:center;
          transition:transform 0.12s
        }
        .nav-item.on .nav-icon{transform:scale(1.08)}

        .nav-lbl{
          font-size:9px;font-weight:700;
          letter-spacing:0.04em;
          white-space:nowrap;
          line-height:1;
          opacity:0;
          max-height:0;
          overflow:hidden;
          transition:opacity 0.14s,max-height 0.14s
        }
        @media(min-width:380px){
          .nav-lbl{opacity:0.55;max-height:20px;font-size:9px}
          .nav-item.on .nav-lbl{opacity:1}
        }
        @media(min-width:480px){
          .nav-lbl{opacity:0.55;max-height:20px;font-size:10px}
          .nav-item.on .nav-lbl{opacity:1}
        }
      `}</style>

      <div className="nav-fade" aria-hidden="true" />
      <nav className="nav-bar" aria-label="Navegación principal">
        <div className="nav-pill">
          {NAV.map(item => {
            const isActive = active === item.key
            return (
              <Link
                key={item.key}
                href={item.href}
                className={`nav-item${isActive ? ' on' : ''}`}
                aria-current={isActive ? 'page' : undefined}
              >
                <span className="nav-icon">{item.icon(isActive)}</span>
                <span className="nav-lbl">{item.label}</span>
              </Link>
            )
          })}
        </div>
      </nav>
    </>
  )
}
