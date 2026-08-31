'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Props { orgName: string; userName: string; active: string }

function initials(name: string) {
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?'
}

const NAV = [
  { key: 'dashboard', href: '/dashboard',  label: 'Dashboard',
    icon: <path d="M10.707 2.293a1 1 0 0 1 1.414 0l7 7A1 1 0 0 1 19 11h-1v9a1 1 0 0 1-1 1h-4v-5h-2v5H7a1 1 0 0 1-1-1v-9H5a1 1 0 0 1-.707-1.707l7-7z"/>, fill: true },
  { key: 'pos',       href: '/pos',        label: 'POS / Ventas',
    icon: <><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></>, fill: false },
  { key: 'orders',    href: '/orders',     label: 'Órdenes',
    icon: <><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-4 0v2M8 7V5a2 2 0 0 0-4 0v2"/></>, fill: false },
  { key: 'catalog',   href: '/catalog',    label: 'Inventario',
    icon: <><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></>, fill: false },
  { key: 'customers', href: '/customers',  label: 'Clientes',
    icon: <><circle cx="9" cy="7" r="4"/><path d="M3 21a6 6 0 0 1 12 0"/><circle cx="17" cy="10" r="3"/><path d="M21 21a4 4 0 0 0-6 0"/></>, fill: false },
  { key: 'reports',   href: '/reports',    label: 'Reportes',
    icon: <><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></>, fill: false },
  { key: 'settings',  href: '/settings',   label: 'Ajustes',
    icon: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></>, fill: false },
]

export default function Sidebar({ orgName, userName, active }: Props) {
  const router = useRouter()
  async function logout() {
    await createClient().auth.signOut()
    router.push('/login')
  }

  return (
    <>
      <style>{`
        .sidebar { display:none; width:240px; flex-shrink:0; background:#ECEEF2; border-right:1px solid rgba(0,0,0,0.06); padding:28px 16px; flex-direction:column; gap:4px; box-shadow:4px 0 20px rgba(0,0,0,0.04); position:sticky; top:0; height:100vh; overflow-y:auto; }
        @media(min-width:768px){ .sidebar { display:flex; } }
        .sb-logo { display:flex; align-items:center; gap:10px; padding:4px 8px 20px; margin-bottom:8px; border-bottom:1px solid rgba(0,0,0,0.06); }
        .sb-logo-mark { width:36px; height:36px; background:linear-gradient(145deg,#1D4ED8,#3B82F6); border-radius:10px; display:flex; align-items:center; justify-content:center; flex-shrink:0; box-shadow:0 4px 12px rgba(29,78,216,0.30); }
        .sb-logo-name { font-size:15px; font-weight:800; color:#1A1A20; letter-spacing:-0.3px; }
        .sb-logo-sub  { font-size:10px; color:rgba(26,26,32,0.35); font-weight:500; text-transform:uppercase; letter-spacing:0.05em; }
        .sb-item { display:flex; align-items:center; gap:10px; padding:9px 10px; border-radius:12px; font-size:13.5px; font-weight:500; color:rgba(26,26,32,0.50); text-decoration:none; transition:all 0.12s; }
        .sb-item:hover { background:rgba(0,0,0,0.04); color:#1A1A20; }
        .sb-item.active { background:#ECEEF2; color:#1D4ED8; font-weight:700; box-shadow:3px 3px 10px rgba(0,0,0,0.08),-2px -2px 6px rgba(255,255,255,0.90); }
        .sb-footer { margin-top:auto; padding-top:16px; border-top:1px solid rgba(0,0,0,0.06); }
        .sb-user { display:flex; align-items:center; gap:10px; padding:8px 10px; border-radius:12px; text-decoration:none; }
        .sb-user:hover { background:rgba(0,0,0,0.03); }
        .sb-av { width:32px; height:32px; border-radius:50%; background:linear-gradient(135deg,#1D4ED8,#3B82F6); display:flex; align-items:center; justify-content:center; font-size:11px; font-weight:700; color:white; flex-shrink:0; }
        .sb-uname { font-size:13px; font-weight:600; color:#1A1A20; }
        .sb-urole  { font-size:11px; color:#2563EB; font-weight:600; }
        .logout-btn { display:flex; align-items:center; gap:8px; width:100%; padding:8px 10px; margin-top:4px; border-radius:12px; border:none; background:transparent; font-size:13px; font-weight:500; color:rgba(26,26,32,0.40); cursor:pointer; font-family:inherit; transition:all 0.12s; }
        .logout-btn:hover { background:rgba(220,38,38,0.06); color:#DC2626; }
      `}</style>
      <aside className="sidebar">
        <div className="sb-logo">
          <div className="sb-logo-mark">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round">
              <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
              <line x1="3" y1="6" x2="21" y2="6"/>
              <path d="M16 10a4 4 0 0 1-8 0"/>
            </svg>
          </div>
          <div>
            <div className="sb-logo-name">{orgName}</div>
            <div className="sb-logo-sub">ERP</div>
          </div>
        </div>

        {NAV.map(item => (
          <Link key={item.key} href={item.href} className={`sb-item${active === item.key ? ' active' : ''}`}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill={item.fill ? 'currentColor' : 'none'} stroke={item.fill ? 'none' : 'currentColor'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              {item.icon}
            </svg>
            {item.label}
          </Link>
        ))}

        <div className="sb-footer">
          <Link href="/settings/profile" className="sb-user">
            <div className="sb-av">{initials(userName)}</div>
            <div>
              <div className="sb-uname">{userName}</div>
              <div className="sb-urole">Mi perfil →</div>
            </div>
          </Link>
          <button className="logout-btn" onClick={logout}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            Cerrar sesión
          </button>
        </div>
      </aside>
    </>
  )
}
