'use client'

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

const NAV = [
  { label: 'Inicio', active: true, icon: <svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor"><path d="M10.707 2.293a1 1 0 0 1 1.414 0l7 7A1 1 0 0 1 19 11h-1v9a1 1 0 0 1-1 1h-4v-5h-2v5H7a1 1 0 0 1-1-1v-9H5a1 1 0 0 1-.707-1.707l7-7z"/></svg> },
  { label: 'Órdenes', active: false, icon: <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-4 0v2M8 7V5a2 2 0 0 0-4 0v2"/></svg> },
  { label: 'Productos', active: false, icon: <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg> },
  { label: 'Clientes', active: false, icon: <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="9" cy="7" r="4"/><path d="M3 21a6 6 0 0 1 12 0"/><circle cx="17" cy="10" r="3"/><path d="M21 21a4 4 0 0 0-6 0"/></svg> },
]

export default function DashboardClient({ userName, orgName, stats, recentCustomers }: Props) {
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Buenos días' : hour < 18 ? 'Buenas tardes' : 'Buenas noches'

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #ECEEF2; }

        .dash {
          min-height: 100dvh;
          background: #ECEEF2;
          font-family: 'Inter', -apple-system, sans-serif;
          max-width: 430px;
          margin: 0 auto;
          padding-bottom: 110px;
        }

        /* ── Header ── */
        .header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 56px 20px 20px;
        }
        .greeting { font-size: 13px; color: rgba(26,26,32,0.45); font-weight: 500; }
        .username {
          font-size: 22px; font-weight: 800;
          color: #1A1A20; letter-spacing: -0.5px; line-height: 1.1;
        }
        .notif-btn {
          width: 42px; height: 42px;
          background: #ECEEF2;
          border-radius: 14px;
          display: flex; align-items: center; justify-content: center;
          box-shadow:
            5px 5px 14px rgba(0,0,0,0.09),
            -4px -4px 10px rgba(255,255,255,0.95),
            inset 0 1px 0 rgba(255,255,255,0.8);
          cursor: pointer;
          position: relative;
          flex-shrink: 0;
        }
        .notif-dot {
          position: absolute; top: 9px; right: 9px;
          width: 7px; height: 7px;
          background: #2563EB; border-radius: 50%;
          border: 1.5px solid #ECEEF2;
        }

        /* ── Hero card ── */
        .hero {
          margin: 0 16px 16px;
          background: linear-gradient(145deg, #1D4ED8 0%, #2563EB 55%, #3B82F6 100%);
          border-radius: 28px;
          padding: 28px 24px;
          box-shadow:
            0 16px 48px rgba(29,78,216,0.32),
            inset 0 1px 0 rgba(255,255,255,0.20);
          position: relative;
          overflow: hidden;
        }
        .hero::before {
          content: '';
          position: absolute;
          top: -40px; right: -40px;
          width: 200px; height: 200px;
          background: radial-gradient(circle, rgba(255,255,255,0.12) 0%, transparent 70%);
          pointer-events: none;
        }
        .hero-label { font-size: 13px; color: rgba(255,255,255,0.65); font-weight: 500; margin-bottom: 6px; }
        .hero-value {
          font-size: 44px; font-weight: 800;
          color: white; letter-spacing: -1.5px; line-height: 1;
          margin-bottom: 18px;
        }
        .hero-pills { display: flex; gap: 8px; flex-wrap: wrap; }
        .pill-outline {
          background: rgba(255,255,255,0.16);
          backdrop-filter: blur(8px);
          border: 1px solid rgba(255,255,255,0.22);
          border-radius: 50px;
          padding: 7px 14px;
          font-size: 12px; font-weight: 600; color: white;
          display: flex; align-items: center; gap: 5px;
        }
        .pill-white {
          background: rgba(255,255,255,0.95);
          border-radius: 50px;
          padding: 7px 14px;
          font-size: 12px; font-weight: 700; color: #1D4ED8;
          display: flex; align-items: center; gap: 5px;
          cursor: pointer;
        }

        /* ── Stats ── */
        .stats {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
          padding: 0 16px 16px;
        }
        .stat {
          background: #ECEEF2;
          border-radius: 20px;
          padding: 16px 14px;
          box-shadow:
            5px 5px 14px rgba(0,0,0,0.08),
            -4px -4px 10px rgba(255,255,255,0.95),
            inset 0 1px 0 rgba(255,255,255,0.7);
        }
        .stat-lbl { font-size: 10px; font-weight: 700; color: rgba(26,26,32,0.35); letter-spacing: 0.07em; text-transform: uppercase; margin-bottom: 8px; }
        .stat-val { font-size: 26px; font-weight: 800; color: #1A1A20; letter-spacing: -0.5px; line-height: 1; }
        .stat-sub { font-size: 11px; font-weight: 600; margin-top: 4px; }

        /* ── Section ── */
        .section-hd {
          display: flex; justify-content: space-between; align-items: center;
          padding: 4px 20px 12px;
        }
        .section-title { font-size: 17px; font-weight: 800; color: #1A1A20; letter-spacing: -0.3px; }
        .section-link { font-size: 13px; font-weight: 600; color: #2563EB; cursor: pointer; }

        /* ── Card ── */
        .card {
          margin: 0 16px 16px;
          background: #ECEEF2;
          border-radius: 24px;
          overflow: hidden;
          box-shadow:
            6px 6px 18px rgba(0,0,0,0.08),
            -4px -4px 12px rgba(255,255,255,0.95),
            inset 0 1px 0 rgba(255,255,255,0.7);
        }
        .card-pad { padding: 20px; }

        /* ── Customer row ── */
        .cust-row {
          display: flex; align-items: center; gap: 12px;
          padding: 12px 20px;
          border-top: 1px solid rgba(0,0,0,0.05);
          cursor: pointer;
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
        .cust-sub { font-size: 12px; color: rgba(26,26,32,0.40); margin-top: 1px; }

        /* ── Empty state ── */
        .empty {
          padding: 32px 20px;
          text-align: center;
          color: rgba(26,26,32,0.35);
          font-size: 14px;
          font-weight: 500;
        }

        /* ── Bottom nav ── */
        .bottom-nav-wrap {
          position: fixed; bottom: 20px;
          left: 50%; transform: translateX(-50%);
          width: calc(100% - 32px); max-width: 398px;
          display: flex; align-items: center; gap: 10px;
          z-index: 100;
        }
        .nav-pill {
          flex: 1;
          background: #ECEEF2;
          border-radius: 50px;
          padding: 6px;
          display: flex; align-items: center; gap: 4px;
          box-shadow:
            8px 8px 22px rgba(0,0,0,0.10),
            -5px -5px 14px rgba(255,255,255,0.95),
            inset 0 1px 0 rgba(255,255,255,0.80);
        }
        .nav-item {
          flex: 1;
          display: flex; align-items: center; justify-content: center; gap: 7px;
          padding: 10px 8px;
          border-radius: 50px;
          color: rgba(26,26,32,0.35);
          cursor: pointer;
          transition: all 0.18s ease;
          font-size: 14px; font-weight: 700;
        }
        .nav-item.active {
          background: #1A1A20;
          color: white;
          flex: none;
          padding: 10px 20px;
          box-shadow: 3px 3px 10px rgba(0,0,0,0.20), -2px -2px 6px rgba(255,255,255,0.15);
        }
        .fab {
          width: 56px; height: 56px; flex-shrink: 0;
          background: #1D4ED8;
          border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer;
          box-shadow:
            0 8px 24px rgba(29,78,216,0.40),
            inset 0 1px 0 rgba(255,255,255,0.20);
          transition: transform 0.15s, box-shadow 0.15s;
        }
        .fab:hover { transform: translateY(-2px); box-shadow: 0 12px 30px rgba(29,78,216,0.45); }
        .fab:active { transform: scale(0.96); }
      `}</style>

      <div className="dash">

        {/* Header */}
        <div className="header">
          <div>
            <div className="greeting">{greeting}, 👋</div>
            <div className="username">{userName.split(' ')[0]}</div>
          </div>
          <div className="notif-btn">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1A1A20" strokeWidth="2" strokeLinecap="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
            <div className="notif-dot" />
          </div>
        </div>

        {/* Hero */}
        <div className="hero">
          <div className="hero-label">Ventas del día</div>
          <div className="hero-value">$0.00</div>
          <div className="hero-pills">
            <div className="pill-outline">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/></svg>
              Sin ventas aún
            </div>
            <div className="pill-white">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Nueva venta
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="stats">
          <div className="stat">
            <div className="stat-lbl">Productos</div>
            <div className="stat-val">{stats.products}</div>
            <div className="stat-sub" style={{ color: stats.products > 0 ? '#2563EB' : 'rgba(26,26,32,0.30)' }}>
              {stats.variants} variantes
            </div>
          </div>
          <div className="stat">
            <div className="stat-lbl">Clientes</div>
            <div className="stat-val">{stats.customers}</div>
            <div className="stat-sub" style={{ color: 'rgba(26,26,32,0.30)' }}>este mes</div>
          </div>
          <div className="stat">
            <div className="stat-lbl">Órdenes</div>
            <div className="stat-val">0</div>
            <div className="stat-sub" style={{ color: 'rgba(26,26,32,0.30)' }}>hoy</div>
          </div>
        </div>

        {/* Clientes recientes */}
        <div className="section-hd">
          <span className="section-title">Clientes recientes</span>
          <span className="section-link">Ver todos →</span>
        </div>

        <div className="card">
          {recentCustomers.length === 0 ? (
            <div className="empty">Aún no hay clientes registrados</div>
          ) : (
            recentCustomers.map((c, i) => (
              <div key={c.id} className="cust-row">
                <div className="av" style={{
                  background: `hsl(${(i * 67) % 360},60%,55%)`
                }}>
                  {initials(c.full_name)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="cust-name">{c.full_name}</div>
                  <div className="cust-sub">{c.email ?? c.phone ?? 'Sin contacto'}</div>
                </div>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(26,26,32,0.25)" strokeWidth="2" strokeLinecap="round">
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </div>
            ))
          )}
        </div>

      </div>

      {/* Bottom nav */}
      <div className="bottom-nav-wrap">
        <div className="nav-pill">
          {NAV.map((item) => (
            <div key={item.label} className={`nav-item${item.active ? ' active' : ''}`}>
              {item.icon}
              {item.active && <span>{item.label}</span>}
            </div>
          ))}
        </div>
        <div className="fab">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
        </div>
      </div>
    </>
  )
}
