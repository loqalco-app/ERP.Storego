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
    key: 'settings', href: '/settings', label: 'Ajustes',
    icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>,
  },
]

function nameInitials(name: string) {
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?'
}
function firstName(name: string) {
  return name.split(' ')[0] || name
}

interface Props { active: string; orgName?: string; userName?: string }

export default function Sidebar({ active }: Props) {
  const pathname = usePathname()
  const [initials, setInitials] = useState('?')
  const [displayName, setDisplayName] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const sb = createClient()
    sb.auth.getUser().then(async ({ data }) => {
      if (!data.user) return
      const { data: profile } = await sb
        .from('user_profiles')
        .select('full_name')
        .eq('id', data.user.id)
        .single()
      const name = profile?.full_name
        || data.user.user_metadata?.full_name
        || data.user.user_metadata?.name
        || data.user.email?.split('@')[0]
        || ''
      setInitials(nameInitials(name))
      setDisplayName(firstName(name))
    })
  }, [])

  async function signOut() {
    const sb = createClient()
    await sb.auth.signOut()
    window.location.href = '/login'
  }

  // Cierra el menú al hacer clic fuera
  useEffect(() => {
    if (!menuOpen) return
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as HTMLElement
      if (!target.closest('.nav-profile-wrap')) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [menuOpen])

  const currentKey = NAV.find(n => n.href !== '/dashboard' && pathname?.startsWith(n.href))?.key
    ?? (pathname === '/dashboard' ? 'dashboard' : active)

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

        /* ── Bottom fade ── */
        .nav-fade{
          position:fixed;bottom:0;left:0;right:0;
          height:96px;
          background:linear-gradient(to top,var(--bg,#ECEEF2) 60%,transparent);
          pointer-events:none;z-index:198
        }

        /* ── Nav bar ── */
        .nav-bar{
          position:fixed;bottom:0;left:0;right:0;z-index:199;
          display:flex;align-items:center;justify-content:center;
          padding:0 12px max(env(safe-area-inset-bottom,0px),8px);
          pointer-events:none
        }
        @media(min-width:480px){.nav-bar{padding:0 20px max(env(safe-area-inset-bottom,0px),16px)}}

        /* ── Floating pill ── */
        .nav-pill{
          flex:1;max-width:440px;
          display:flex;align-items:center;gap:2px;
          background:var(--bg,#ECEEF2);
          border-radius:var(--r-2xl,28px);
          padding:7px;
          box-shadow:0 20px 60px rgba(0,0,0,0.14),0 6px 20px rgba(0,0,0,0.09),inset 0 1px 0 rgba(255,255,255,0.80);
          pointer-events:all
        }
        @media(min-width:480px){.nav-pill{min-width:340px;max-width:460px}}

        /* ── Nav item ── */
        .nav-item{
          flex:1;
          display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;
          padding:10px 4px 9px;
          border-radius:20px;
          text-decoration:none;
          color:#0A0A0E;
          opacity:0.38;
          font-family:var(--font,'Inter',-apple-system,sans-serif);
          transition:color 0.14s,background 0.14s,opacity 0.14s;
          cursor:pointer;min-width:0;
          -webkit-tap-highlight-color:transparent
        }
        @media(min-width:480px){.nav-item{padding:10px 12px 9px;min-width:70px}}

        .nav-item.on{
          background:var(--grad-brand,linear-gradient(135deg,#1D4ED8,#2563EB));
          color:white;opacity:1;
          box-shadow:0 6px 18px rgba(29,78,216,0.30)
        }
        .nav-item:not(.on):active{opacity:0.65;background:rgba(0,0,0,0.05)}
        .nav-item.on .nav-icon{transform:scale(1.08)}

        .nav-icon{display:flex;align-items:center;justify-content:center;transition:transform 0.12s}
        .nav-lbl{font-size:9px;font-weight:700;letter-spacing:0.04em;white-space:nowrap;line-height:1}
        @media(max-width:379px){.nav-lbl{display:none}}
        @media(min-width:480px){.nav-lbl{font-size:10px}}

        /* ── Profile chip wrap — pegado a la derecha del nav-bar ── */
        .nav-profile-wrap{
          position:absolute;
          right:12px;
          bottom:max(env(safe-area-inset-bottom,0px),8px);
          pointer-events:all
        }
        @media(min-width:480px){.nav-profile-wrap{right:20px;bottom:max(env(safe-area-inset-bottom,0px),16px)}}

        /* ── Profile chip — mobile: solo avatar ── */
        .profile-chip{
          display:flex;align-items:center;justify-content:center;
          background:var(--bg,#ECEEF2);
          border:none;border-radius:50%;
          padding:6px;
          box-shadow:0 4px 16px rgba(0,0,0,0.12),0 2px 8px rgba(0,0,0,0.06),inset 0 1px 0 rgba(255,255,255,0.80);
          cursor:pointer;outline:none;
          -webkit-tap-highlight-color:transparent;
          transition:opacity 0.12s;
          font-family:inherit
        }
        .profile-chip:active{opacity:0.75}

        /* Desktop: chip expandido con nombre */
        @media(min-width:600px){
          .profile-chip{
            border-radius:50px;
            padding:5px 12px 5px 5px;
            gap:8px;
            justify-content:flex-start
          }
        }

        .pc-av{
          width:32px;height:32px;border-radius:50%;
          background:var(--grad-brand,linear-gradient(135deg,#1D4ED8,#2563EB));
          display:flex;align-items:center;justify-content:center;
          font-size:12px;font-weight:800;color:white;
          flex-shrink:0;letter-spacing:0;
          box-shadow:0 2px 8px rgba(29,78,216,0.30)
        }

        /* Texto del chip oculto en mobile, visible en desktop */
        .pc-text{
          display:none;flex-direction:column;gap:1px;min-width:0
        }
        @media(min-width:600px){.pc-text{display:flex}}

        .pc-name{
          font-size:13px;font-weight:700;
          color:var(--text-1,#0A0A0E);
          white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
          max-width:90px;
          font-family:var(--font,'Inter',-apple-system,sans-serif);
          line-height:1
        }
        .pc-role{
          font-size:10px;font-weight:500;
          color:var(--text-3,rgba(10,10,14,0.45));
          font-family:var(--font,'Inter',-apple-system,sans-serif);
          line-height:1
        }

        /* ── Dropdown ── */
        .pc-dropdown{
          position:absolute;bottom:calc(100% + 8px);right:0;top:auto;
          background:var(--bg,#ECEEF2);
          border-radius:var(--r-lg,20px);
          box-shadow:0 -8px 32px rgba(0,0,0,0.12),0 4px 16px rgba(0,0,0,0.06);
          min-width:200px;overflow:hidden;z-index:400
        }
        .pc-menu-item{
          display:flex;align-items:center;gap:10px;
          width:100%;padding:13px 18px;
          background:none;border:none;
          font-size:14px;font-weight:600;
          color:var(--text-1,#0A0A0E);
          font-family:var(--font,'Inter',-apple-system,sans-serif);
          cursor:pointer;text-decoration:none;
          transition:background 0.12s;text-align:left;
          -webkit-tap-highlight-color:transparent
        }
        .pc-menu-item:hover{background:rgba(0,0,0,0.04)}
        .pc-menu-item:active{background:rgba(0,0,0,0.07)}
        .pc-menu-item.danger{color:#DC2626}
        .pc-menu-item.danger:hover{background:rgba(220,38,38,0.06)}
        .pc-divider{height:1px;background:rgba(0,0,0,0.06);margin:4px 0}
      `}</style>

      {/* Bottom fade */}
      <div className="nav-fade" aria-hidden="true" />

      {/* Nav bar: pill de navegación + chip de perfil en la misma fila */}
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

        {/* Chip de perfil — mismo nivel que el pill */}
        <div className="nav-profile-wrap">
          <button
            className="profile-chip"
            aria-label="Menú de perfil"
            onClick={() => setMenuOpen(v => !v)}
          >
            <div className="pc-av">{initials}</div>
            {displayName && (
              <div className="pc-text">
                <span className="pc-name">{displayName}</span>
                <span className="pc-role">Mi perfil</span>
              </div>
            )}
          </button>

          {menuOpen && (
            <div className="pc-dropdown" onClick={() => setMenuOpen(false)}>
              <Link href="/settings" className="pc-menu-item">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 20a8 8 0 0 1 16 0"/></svg>
                Mi perfil
              </Link>
              <Link href="/settings?tab=team" className="pc-menu-item">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="9" cy="7" r="4"/><path d="M3 21a6 6 0 0 1 12 0"/><circle cx="17" cy="10" r="3"/><path d="M21 21a4 4 0 0 0-6 0"/></svg>
                Equipo
              </Link>
              <div className="pc-divider" />
              <button className="pc-menu-item danger" onClick={signOut}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                Cerrar sesión
              </button>
            </div>
          )}
        </div>
      </nav>
    </>
  )
}
