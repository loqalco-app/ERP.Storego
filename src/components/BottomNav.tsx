'use client'

import Link from 'next/link'

interface Props { active: string }

const ITEMS = [
  { key: 'dashboard', href: '/dashboard', icon: <path d="M10.707 2.293a1 1 0 0 1 1.414 0l7 7A1 1 0 0 1 19 11h-1v9a1 1 0 0 1-1 1h-4v-5h-2v5H7a1 1 0 0 1-1-1v-9H5a1 1 0 0 1-.707-1.707l7-7z"/>, fill: true, label: 'Inicio' },
  { key: 'orders',    href: '/orders',    icon: <><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-4 0v2M8 7V5a2 2 0 0 0-4 0v2"/></>, fill: false, label: 'Órdenes' },
  { key: 'products',  href: '/products',  icon: <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>, fill: false, label: 'Productos' },
  { key: 'customers', href: '/customers', icon: <><circle cx="9" cy="7" r="4"/><path d="M3 21a6 6 0 0 1 12 0"/></>, fill: false, label: 'Clientes' },
]

export default function BottomNav({ active }: Props) {
  return (
    <>
      <style>{`
        .bnav { position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%); width: calc(100% - 32px); max-width: 398px; display: flex; align-items: center; gap: 10px; z-index: 100; }
        @media (min-width: 768px) { .bnav { display: none; } }
        .bnav-pill { flex: 1; background: #ECEEF2; border-radius: 50px; padding: 6px; display: flex; align-items: center; gap: 4px; box-shadow: 8px 8px 22px rgba(0,0,0,0.10), -5px -5px 14px rgba(255,255,255,0.95), inset 0 1px 0 rgba(255,255,255,0.80); }
        .bnav-item { flex: 1; display: flex; align-items: center; justify-content: center; padding: 10px 8px; border-radius: 50px; color: rgba(26,26,32,0.32); text-decoration: none; transition: all 0.18s; }
        .bnav-item.active { background: #1A1A20; color: white; flex: none; padding: 10px 18px; gap: 6px; font-size: 13px; font-weight: 700; font-family: 'Inter', -apple-system, sans-serif; }
      `}</style>
      <div className="bnav">
        <div className="bnav-pill">
          {ITEMS.map(item => (
            <Link key={item.key} href={item.href} className={`bnav-item${active === item.key ? ' active' : ''}`}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill={item.fill ? 'currentColor' : 'none'} stroke={item.fill ? 'none' : 'currentColor'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                {item.icon}
              </svg>
              {active === item.key && <span>{item.label}</span>}
            </Link>
          ))}
        </div>
        <Link href="/products/new" style={{ width: 56, height: 56, flexShrink: 0, background: '#1D4ED8', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 24px rgba(29,78,216,0.38)', textDecoration: 'none' }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
        </Link>
      </div>
    </>
  )
}
