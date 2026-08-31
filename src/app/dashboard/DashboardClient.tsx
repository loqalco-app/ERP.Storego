'use client'

import Link from 'next/link'
import Sidebar from '@/components/Sidebar'

interface Customer { id: string; full_name: string; email: string | null; phone: string | null; created_at: string }
interface Props { userName: string; orgName: string; stats: { products: number; customers: number; variants: number }; recentCustomers: Customer[] }

function initials(name: string) { return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase() }
const AVATAR_COLORS = ['linear-gradient(135deg,#2563EB,#60A5FA)','linear-gradient(135deg,#7C3AED,#A78BFA)','linear-gradient(135deg,#059669,#34D399)','linear-gradient(135deg,#DC2626,#F87171)','linear-gradient(135deg,#D97706,#FCD34D)','linear-gradient(135deg,#0891B2,#67E8F9)']

export default function DashboardClient({ userName, orgName, stats, recentCustomers }: Props) {
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Buenos días' : hour < 18 ? 'Buenas tardes' : 'Buenas noches'

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        body{background:var(--bg,#ECEEF2);font-family:var(--font,'Inter',-apple-system,sans-serif);-webkit-font-smoothing:antialiased}
        /* topbar: padding-right extra para no encimarse con el chip de perfil fijo */
        .topbar{padding:max(env(safe-area-inset-top,0px),52px) 20px 20px}
        @media(min-width:480px){.topbar{padding-top:max(env(safe-area-inset-top,0px),52px);padding-right:calc(20px + 150px)}}
        @media(min-width:768px){.topbar{padding-top:max(env(safe-area-inset-top,0px),36px);padding-left:40px;padding-right:calc(40px + 160px)}}
        .greeting-txt{font-size:var(--text-sm,13px);color:var(--text-3,rgba(10,10,14,0.45));font-weight:500;margin-bottom:2px}
        .username-txt{font-size:28px;font-weight:800;color:var(--text-1,#0A0A0E);letter-spacing:-0.8px;line-height:1.1}
        @media(min-width:768px){.username-txt{font-size:34px}}
        .content{padding:0 20px calc(var(--nav-h,88px) + 16px)}
        @media(min-width:768px){.content{padding:0 40px calc(var(--nav-h,88px) + 16px)}}
        .hero{background:var(--grad-brand-hero,linear-gradient(145deg,#1D4ED8,#2563EB,#3B82F6));border-radius:var(--r-2xl,28px);padding:28px 24px;margin-bottom:16px;box-shadow:var(--shadow-brand),inset 0 1px 0 rgba(255,255,255,0.20);position:relative;overflow:hidden}
        .hero::before{content:'';position:absolute;top:-40px;right:-40px;width:200px;height:200px;background:radial-gradient(circle,rgba(255,255,255,0.12) 0%,transparent 70%)}
        .hero-label{font-size:var(--text-sm,13px);color:rgba(255,255,255,0.65);font-weight:500;margin-bottom:6px}
        .hero-value{font-size:44px;font-weight:800;color:white;letter-spacing:-1.5px;line-height:1;margin-bottom:18px}
        .hero-pills{display:flex;gap:8px;flex-wrap:wrap}
        .pill-glass{background:rgba(255,255,255,0.16);border:1px solid rgba(255,255,255,0.22);border-radius:var(--r-pill,50px);padding:7px 14px;font-size:12px;font-weight:600;color:white;display:flex;align-items:center;gap:5px}
        .pill-solid{background:rgba(255,255,255,0.95);border-radius:var(--r-pill,50px);padding:7px 16px;font-size:12px;font-weight:700;color:var(--brand,#1D4ED8);display:flex;align-items:center;gap:5px;cursor:pointer;border:none;font-family:inherit;text-decoration:none;transition:opacity 0.12s}
        .pill-solid:hover{opacity:.90}
        .stats{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:24px}
        .stat{background:var(--bg,#ECEEF2);border-radius:var(--r-lg,20px);padding:16px 14px;box-shadow:var(--shadow-md)}
        .stat-lbl{font-size:var(--text-2xs,10px);font-weight:700;color:var(--text-4,rgba(26,26,32,0.28));letter-spacing:0.07em;text-transform:uppercase;margin-bottom:8px}
        .stat-val{font-size:26px;font-weight:800;color:var(--text-1,#1A1A20);letter-spacing:-0.5px;line-height:1}
        .stat-sub{font-size:11px;font-weight:600;margin-top:4px;color:var(--text-4,rgba(26,26,32,0.28))}
        .section-hd{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px}
        .section-title{font-size:var(--text-md,17px);font-weight:800;color:var(--text-1,#1A1A20);letter-spacing:-0.3px}
        .section-link{font-size:var(--text-sm,13px);font-weight:600;color:var(--brand-mid,#2563EB);text-decoration:none}
        .section-link:hover{text-decoration:underline}
        .card{background:var(--bg,#ECEEF2);border-radius:var(--r-xl,24px);overflow:hidden;box-shadow:var(--shadow-card);margin-bottom:20px}
        .cust-row{display:flex;align-items:center;gap:12px;padding:13px 20px;border-top:1px solid var(--border-light,rgba(0,0,0,0.04));text-decoration:none;transition:background 0.12s}
        .cust-row:first-child{border-top:none}
        .cust-row:hover{background:var(--brand-alpha,rgba(37,99,235,0.04))}
        .av{width:38px;height:38px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:white;flex-shrink:0}
        .cust-name{font-size:14px;font-weight:600;color:var(--text-1,#1A1A20)}
        .cust-sub{font-size:12px;color:var(--text-3,rgba(26,26,32,0.38));margin-top:1px}
        .empty{padding:32px 20px;text-align:center;color:var(--text-4,rgba(26,26,32,0.30));font-size:14px;font-weight:500}
      `}</style>

      <Sidebar active="dashboard" />

      <div className="topbar">
        <div className="greeting-txt">{greeting}</div>
        <div className="username-txt">{userName.split(' ')[0]}</div>
      </div>

      <div className="content">
        <div className="hero">
          <div className="hero-label">Ventas del día</div>
          <div className="hero-value">$0.00</div>
          <div className="hero-pills">
            <div className="pill-glass">Sin ventas aún</div>
            <Link href="/pos" className="pill-solid">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Nueva venta
            </Link>
          </div>
        </div>

        <div className="stats">
          {[
            { lbl: 'Productos', val: stats.products, sub: `${stats.variants} variantes`, color: stats.products > 0 ? 'var(--brand-mid)' : undefined },
            { lbl: 'Clientes',  val: stats.customers, sub: 'registrados', color: stats.customers > 0 ? '#059669' : undefined },
            { lbl: 'Órdenes',  val: 0, sub: 'hoy', color: undefined },
          ].map(s => (
            <div key={s.lbl} className="stat">
              <div className="stat-lbl">{s.lbl}</div>
              <div className="stat-val">{s.val}</div>
              <div className="stat-sub" style={s.color ? { color: s.color } : {}}>{s.sub}</div>
            </div>
          ))}
        </div>

        <div className="section-hd">
          <span className="section-title">Clientes recientes</span>
          <Link href="/customers" className="section-link">Ver todos →</Link>
        </div>
        <div className="card">
          {recentCustomers.length === 0 ? (
            <div className="empty">Aún no hay clientes — agrega el primero</div>
          ) : recentCustomers.map((c, i) => (
            <Link key={c.id} href={`/customers/${c.id}`} className="cust-row">
              <div className="av" style={{ background: AVATAR_COLORS[i % AVATAR_COLORS.length] }}>{initials(c.full_name)}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="cust-name">{c.full_name}</div>
                <div className="cust-sub">{c.email ?? c.phone ?? 'Sin contacto'}</div>
              </div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-4,rgba(26,26,32,0.22))" strokeWidth="2" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
            </Link>
          ))}
        </div>
      </div>
    </>
  )
}
