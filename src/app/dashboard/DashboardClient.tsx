'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Customer {
  id: string
  full_name: string
  email: string | null
  phone: string | null
  created_at: string
}

interface Props {
  userName: string
  orgName: string
  stats: { products: number; customers: number; variants: number }
  recentCustomers: Customer[]
}

function initials(name: string) {
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
}

const AVATAR_COLORS = ['#2563EB','#7C3AED','#059669','#DC2626','#D97706','#0891B2']

export default function DashboardClient({ userName, orgName, stats, recentCustomers }: Props) {
  const router = useRouter()
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Buenos días' : hour < 18 ? 'Buenas tardes' : 'Buenas noches'

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { height: 100%; }
        body { background: #ECEEF2; font-family: 'Inter', -apple-system, sans-serif; }

        /* ── Layout shell ── */
        .shell { display: flex; min-height: 100dvh; }

        /* ── Sidebar (desktop) ── */
        .sidebar {
          display: none;
          width: 240px;
          flex-shrink: 0;
          background: #ECEEF2;
          border-right: 1px solid rgba(0,0,0,0.06);
          padding: 28px 16px;
          flex-direction: column;
          gap: 4px;
          box-shadow: 4px 0 20px rgba(0,0,0,0.04);
          position: sticky; top: 0; height: 100vh;
        }
        @media (min-width: 768px) { .sidebar { display: flex; } }

        .sb-logo {
          display: flex; align-items: center; gap: 10px;
          padding: 4px 8px 20px;
          margin-bottom: 8px;
          border-bottom: 1px solid rgba(0,0,0,0.06);
        }
        .sb-logo-mark {
          width: 36px; height: 36px;
          background: linear-gradient(145deg, #1D4ED8, #3B82F6);
          border-radius: 10px;
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 4px 12px rgba(29,78,216,0.30);
        }
        .sb-logo-name { font-size: 15px; font-weight: 800; color: #1A1A20; letter-spacing: -0.3px; }
        .sb-logo-sub { font-size: 10px; color: rgba(26,26,32,0.35); font-weight: 500; text-transform: uppercase; letter-spacing: 0.05em; }

        .sb-section { font-size: 10px; font-weight: 700; color: rgba(26,26,32,0.30); letter-spacing: 0.09em; text-transform: uppercase; padding: 14px 10px 4px; }

        .sb-item {
          display: flex; align-items: center; gap: 10px;
          padding: 9px 10px;
          border-radius: 12px;
          font-size: 13.5px; font-weight: 500;
          color: rgba(26,26,32,0.50);
          cursor: pointer; text-decoration: none;
          transition: all 0.12s;
        }
        .sb-item:hover { background: rgba(0,0,0,0.04); color: #1A1A20; }
        .sb-item.active {
          background: #ECEEF2;
          color: #1D4ED8;
          font-weight: 700;
          box-shadow: 3px 3px 10px rgba(0,0,0,0.08), -2px -2px 6px rgba(255,255,255,0.90);
        }

        .sb-footer {
          margin-top: auto;
          padding-top: 16px;
          border-top: 1px solid rgba(0,0,0,0.06);
        }
        .sb-user {
          display: flex; align-items: center; gap: 10px;
          padding: 8px 10px; border-radius: 12px; cursor: pointer;
        }
        .sb-av {
          width: 32px; height: 32px; border-radius: 50%;
          background: linear-gradient(135deg, #1D4ED8, #3B82F6);
          display: flex; align-items: center; justify-content: center;
          font-size: 11px; font-weight: 700; color: white; flex-shrink: 0;
        }
        .sb-uname { font-size: 13px; font-weight: 600; color: #1A1A20; }
        .sb-urole { font-size: 11px; color: rgba(26,26,32,0.35); }
        .logout-btn {
          display: flex; align-items: center; gap: 8px;
          width: 100%; padding: 8px 10px; margin-top: 4px;
          border-radius: 12px; border: none; background: transparent;
          font-size: 13px; font-weight: 500; color: rgba(26,26,32,0.40);
          cursor: pointer; font-family: inherit;
          transition: all 0.12s;
        }
        .logout-btn:hover { background: rgba(220,38,38,0.06); color: #DC2626; }

        /* ── Main content ── */
        .main { flex: 1; overflow-y: auto; }

        /* ── Top bar (mobile) ── */
        .topbar {
          display: flex; align-items: center; justify-content: space-between;
          padding: 52px 20px 20px;
        }
        @media (min-width: 768px) { .topbar { padding: 32px 32px 24px; } }

        .greeting-txt { font-size: 13px; color: rgba(26,26,32,0.40); font-weight: 500; }
        .username-txt { font-size: 24px; font-weight: 800; color: #1A1A20; letter-spacing: -0.5px; }
        @media (min-width: 768px) { .username-txt { font-size: 28px; } }

        .notif-btn {
          width: 42px; height: 42px; border-radius: 14px;
          background: #ECEEF2;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; position: relative; flex-shrink: 0;
          box-shadow: 5px 5px 14px rgba(0,0,0,0.09), -4px -4px 10px rgba(255,255,255,0.95);
        }
        .notif-dot {
          position: absolute; top: 9px; right: 9px;
          width: 7px; height: 7px;
          background: #2563EB; border-radius: 50%;
          border: 1.5px solid #ECEEF2;
        }

        /* ── Content padding ── */
        .content { padding: 0 16px 120px; }
        @media (min-width: 768px) { .content { padding: 0 32px 40px; } }

        /* ── Hero card ── */
        .hero {
          background: linear-gradient(145deg, #1D4ED8 0%, #2563EB 55%, #3B82F6 100%);
          border-radius: 28px;
          padding: 28px 24px;
          margin-bottom: 16px;
          box-shadow: 0 16px 48px rgba(29,78,216,0.28), inset 0 1px 0 rgba(255,255,255,0.20);
          position: relative; overflow: hidden;
        }
        .hero::before {
          content: ''; position: absolute;
          top: -40px; right: -40px; width: 200px; height: 200px;
          background: radial-gradient(circle, rgba(255,255,255,0.12) 0%, transparent 70%);
        }
        .hero-label { font-size: 13px; color: rgba(255,255,255,0.65); font-weight: 500; margin-bottom: 6px; }
        .hero-value { font-size: 44px; font-weight: 800; color: white; letter-spacing: -1.5px; line-height: 1; margin-bottom: 18px; }
        .hero-pills { display: flex; gap: 8px; flex-wrap: wrap; }
        .pill-glass {
          background: rgba(255,255,255,0.16);
          border: 1px solid rgba(255,255,255,0.22);
          border-radius: 50px; padding: 7px 14px;
          font-size: 12px; font-weight: 600; color: white;
          display: flex; align-items: center; gap: 5px;
        }
        .pill-solid {
          background: rgba(255,255,255,0.95);
          border-radius: 50px; padding: 7px 16px;
          font-size: 12px; font-weight: 700; color: #1D4ED8;
          display: flex; align-items: center; gap: 5px;
          cursor: pointer; border: none; font-family: inherit;
          transition: opacity 0.12s;
        }
        .pill-solid:hover { opacity: 0.90; }

        /* ── Stats grid ── */
        .stats {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px; margin-bottom: 24px;
        }
        @media (min-width: 768px) { .stats { grid-template-columns: repeat(6, 1fr); } }

        .stat {
          background: #ECEEF2; border-radius: 20px; padding: 16px 14px;
          box-shadow: 5px 5px 14px rgba(0,0,0,0.08), -4px -4px 10px rgba(255,255,255,0.95), inset 0 1px 0 rgba(255,255,255,0.7);
        }
        .stat-lbl { font-size: 10px; font-weight: 700; color: rgba(26,26,32,0.32); letter-spacing: 0.07em; text-transform: uppercase; margin-bottom: 8px; }
        .stat-val { font-size: 26px; font-weight: 800; color: #1A1A20; letter-spacing: -0.5px; line-height: 1; }
        .stat-sub { font-size: 11px; font-weight: 600; margin-top: 4px; color: rgba(26,26,32,0.30); }

        /* ── Section header ── */
        .section-hd { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
        .section-title { font-size: 17px; font-weight: 800; color: #1A1A20; letter-spacing: -0.3px; }
        .section-link { font-size: 13px; font-weight: 600; color: #2563EB; cursor: pointer; text-decoration: none; }
        .section-link:hover { text-decoration: underline; }

        /* ── Card ── */
        .card {
          background: #ECEEF2; border-radius: 24px; overflow: hidden;
          box-shadow: 6px 6px 18px rgba(0,0,0,0.08), -4px -4px 12px rgba(255,255,255,0.95), inset 0 1px 0 rgba(255,255,255,0.7);
          margin-bottom: 20px;
        }

        /* ── Customer row ── */
        .cust-row {
          display: flex; align-items: center; gap: 12px;
          padding: 13px 20px;
          border-top: 1px solid rgba(0,0,0,0.05);
          cursor: pointer; text-decoration: none;
          transition: background 0.12s;
        }
        .cust-row:first-child { border-top: none; }
        .cust-row:hover { background: rgba(37,99,235,0.04); }
        .av {
          width: 38px; height: 38px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          font-size: 13px; font-weight: 700; color: white; flex-shrink: 0;
        }
        .cust-name { font-size: 14px; font-weight: 600; color: #1A1A20; }
        .cust-sub { font-size: 12px; color: rgba(26,26,32,0.38); margin-top: 1px; }
        .empty { padding: 32px 20px; text-align: center; color: rgba(26,26,32,0.30); font-size: 14px; font-weight: 500; }

        /* ── Bottom nav (mobile only) ── */
        .bottom-nav-wrap {
          position: fixed; bottom: 20px;
          left: 50%; transform: translateX(-50%);
          width: calc(100% - 32px); max-width: 398px;
          display: flex; align-items: center; gap: 10px;
          z-index: 100;
        }
        @media (min-width: 768px) { .bottom-nav-wrap { display: none; } }

        .nav-pill {
          flex: 1; background: #ECEEF2; border-radius: 50px; padding: 6px;
          display: flex; align-items: center; gap: 4px;
          box-shadow: 8px 8px 22px rgba(0,0,0,0.10), -5px -5px 14px rgba(255,255,255,0.95), inset 0 1px 0 rgba(255,255,255,0.80);
        }
        .nav-item {
          flex: 1; display: flex; align-items: center; justify-content: center; gap: 7px;
          padding: 10px 8px; border-radius: 50px;
          color: rgba(26,26,32,0.32); cursor: pointer;
          transition: all 0.18s; font-size: 14px; font-weight: 700;
          text-decoration: none;
        }
        .nav-item.active {
          background: #1A1A20; color: white;
          flex: none; padding: 10px 20px;
          box-shadow: 3px 3px 10px rgba(0,0,0,0.20), -2px -2px 6px rgba(255,255,255,0.10);
        }
        .fab {
          width: 56px; height: 56px; flex-shrink: 0;
          background: #1D4ED8; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer;
          box-shadow: 0 8px 24px rgba(29,78,216,0.38), inset 0 1px 0 rgba(255,255,255,0.20);
          transition: transform 0.15s;
          border: none;
        }
        .fab:hover { transform: translateY(-2px); }
        .fab:active { transform: scale(0.96); }
      `}</style>

      <div className="shell">

        {/* ── Sidebar (desktop) ── */}
        <aside className="sidebar">
          <div className="sb-logo">
            <div className="sb-logo-mark">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round">
                <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/>
                <path d="M16 10a4 4 0 0 1-8 0"/>
              </svg>
            </div>
            <div>
              <div className="sb-logo-name">{orgName}</div>
              <div className="sb-logo-sub">ERP</div>
            </div>
          </div>

          <div className="sb-section">Principal</div>
          <Link href="/dashboard" className="sb-item active">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M10.707 2.293a1 1 0 0 1 1.414 0l7 7A1 1 0 0 1 19 11h-1v9a1 1 0 0 1-1 1h-4v-5h-2v5H7a1 1 0 0 1-1-1v-9H5a1 1 0 0 1-.707-1.707l7-7z"/></svg>
            Dashboard
          </Link>
          <Link href="/orders" className="sb-item">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-4 0v2M8 7V5a2 2 0 0 0-4 0v2"/></svg>
            Órdenes
          </Link>
          <Link href="/pos" className="sb-item">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>
            POS
          </Link>

          <div className="sb-section">Catálogo</div>
          <Link href="/products" className="sb-item">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="2" y="2" width="20" height="20" rx="2"/><path d="M7 7h10M7 12h10M7 17h6"/></svg>
            Productos
          </Link>
          <Link href="/inventory" className="sb-item">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
            Inventario
          </Link>

          <div className="sb-section">Clientes</div>
          <Link href="/customers" className="sb-item">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="9" cy="7" r="4"/><path d="M3 21a6 6 0 0 1 12 0"/><circle cx="17" cy="10" r="3"/><path d="M21 21a4 4 0 0 0-6 0"/></svg>
            CRM
          </Link>
          <Link href="/reports" className="sb-item">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>
            Reportes
          </Link>

          <div className="sb-section">Sistema</div>
          <Link href="/settings/users" className="sb-item">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 20a8 8 0 0 1 16 0"/></svg>
            Usuarios y roles
          </Link>
          <Link href="/settings" className="sb-item">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
            Configuración
          </Link>

          <div className="sb-footer">
            <div className="sb-user">
              <div className="sb-av">{initials(userName)}</div>
              <div>
                <div className="sb-uname">{userName}</div>
                <div className="sb-urole">Administrador</div>
              </div>
            </div>
            <button className="logout-btn" onClick={handleLogout}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
              Cerrar sesión
            </button>
          </div>
        </aside>

        {/* ── Main ── */}
        <main className="main">
          <div className="topbar">
            <div>
              <div className="greeting-txt">{greeting}</div>
              <div className="username-txt">{userName.split(' ')[0]}</div>
            </div>
            <div className="notif-btn">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1A1A20" strokeWidth="2" strokeLinecap="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
              </svg>
              <div className="notif-dot" />
            </div>
          </div>

          <div className="content">
            {/* Hero */}
            <div className="hero">
              <div className="hero-label">Ventas del día</div>
              <div className="hero-value">$0.00</div>
              <div className="hero-pills">
                <div className="pill-glass">Sin ventas aún</div>
                <button className="pill-solid">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  Nueva venta
                </button>
              </div>
            </div>

            {/* Stats */}
            <div className="stats">
              {[
                { lbl: 'Productos', val: stats.products, sub: `${stats.variants} variantes`, color: stats.products > 0 ? '#2563EB' : undefined },
                { lbl: 'Clientes', val: stats.customers, sub: 'registrados', color: stats.customers > 0 ? '#059669' : undefined },
                { lbl: 'Órdenes', val: 0, sub: 'hoy', color: undefined },
              ].map(s => (
                <div key={s.lbl} className="stat">
                  <div className="stat-lbl">{s.lbl}</div>
                  <div className="stat-val">{s.val}</div>
                  <div className="stat-sub" style={s.color ? { color: s.color } : {}}>{s.sub}</div>
                </div>
              ))}
            </div>

            {/* Clientes recientes */}
            <div className="section-hd">
              <span className="section-title">Clientes recientes</span>
              <Link href="/customers" className="section-link">Ver todos →</Link>
            </div>
            <div className="card">
              {recentCustomers.length === 0 ? (
                <div className="empty">Aún no hay clientes — agrega el primero</div>
              ) : (
                recentCustomers.map((c, i) => (
                  <Link key={c.id} href={`/customers/${c.id}`} className="cust-row">
                    <div className="av" style={{ background: AVATAR_COLORS[i % AVATAR_COLORS.length] }}>
                      {initials(c.full_name)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="cust-name">{c.full_name}</div>
                      <div className="cust-sub">{c.email ?? c.phone ?? 'Sin contacto'}</div>
                    </div>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(26,26,32,0.22)" strokeWidth="2" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
                  </Link>
                ))
              )}
            </div>
          </div>
        </main>
      </div>

      {/* ── Bottom nav (mobile) ── */}
      <div className="bottom-nav-wrap">
        <div className="nav-pill">
          {[
            { href: '/dashboard', label: 'Inicio', active: true, icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M10.707 2.293a1 1 0 0 1 1.414 0l7 7A1 1 0 0 1 19 11h-1v9a1 1 0 0 1-1 1h-4v-5h-2v5H7a1 1 0 0 1-1-1v-9H5a1 1 0 0 1-.707-1.707l7-7z"/></svg> },
            { href: '/orders', label: 'Órdenes', active: false, icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-4 0v2M8 7V5a2 2 0 0 0-4 0v2"/></svg> },
            { href: '/products', label: 'Productos', active: false, icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="2" y="2" width="20" height="20" rx="2"/><path d="M7 7h10M7 12h10M7 17h6"/></svg> },
            { href: '/customers', label: 'Clientes', active: false, icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="9" cy="7" r="4"/><path d="M3 21a6 6 0 0 1 12 0"/></svg> },
          ].map(item => (
            <Link key={item.href} href={item.href} className={`nav-item${item.active ? ' active' : ''}`}>
              {item.icon}
              {item.active && <span>{item.label}</span>}
            </Link>
          ))}
        </div>
        <button className="fab">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
        </button>
      </div>
    </>
  )
}
