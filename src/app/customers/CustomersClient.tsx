'use client'

import { useState } from 'react'
import Link from 'next/link'
import Sidebar from '@/components/Sidebar'

interface Customer {
  id: string; full_name: string; email: string | null; phone: string | null
  status: string; balance_owing: number; credit_limit: number; created_at: string; tags: string[]
}
interface Props { customers: Customer[]; orgId: string; userName: string; orgName: string }

function initials(name: string) { return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?' }

const AVATAR_COLORS = ['linear-gradient(135deg,#1D4ED8,#3B82F6)','linear-gradient(135deg,#7C3AED,#A78BFA)','linear-gradient(135deg,#059669,#34D399)','linear-gradient(135deg,#DC2626,#F87171)','linear-gradient(135deg,#D97706,#FCD34D)','linear-gradient(135deg,#0891B2,#67E8F9)']
function avatarColor(name: string) {
  let h = 0; for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0xFFFFFF
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length]
}

const STATUS_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  active:   { bg: 'rgba(5,150,105,0.10)',   color: '#065f46', label: 'Activo'    },
  inactive: { bg: 'rgba(107,114,128,0.12)', color: '#374151', label: 'Inactivo'  },
  blocked:  { bg: 'rgba(220,38,38,0.10)',   color: '#991b1b', label: 'Bloqueado' },
}

export default function CustomersClient({ customers: initCustomers, userName, orgName }: Props) {
  const [customers] = useState(initCustomers)
  const [q, setQ]         = useState('')
  const [filter, setFilter] = useState<'all'|'active'|'inactive'|'blocked'>('all')

  const filtered = customers.filter(c => {
    const matchQ = !q || c.full_name.toLowerCase().includes(q.toLowerCase()) ||
      (c.email ?? '').toLowerCase().includes(q.toLowerCase()) || (c.phone ?? '').includes(q)
    const matchF = filter === 'all' || c.status === filter
    return matchQ && matchF
  })

  const totals = { all: customers.length, active: customers.filter(c => c.status==='active').length, inactive: customers.filter(c => c.status==='inactive').length, blocked: customers.filter(c => c.status==='blocked').length }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        body{background:var(--bg,#ECEEF2);font-family:var(--font,'Inter',-apple-system,sans-serif);-webkit-font-smoothing:antialiased}
        .topbar{justify-content:space-between}
        .page-title{font-size:26px;font-weight:800;color:var(--text-1,#1A1A20);letter-spacing:-0.5px}
        .new-btn{display:flex;align-items:center;justify-content:center;width:40px;height:40px;background:var(--grad-brand-btn,linear-gradient(145deg,#1D4ED8,#2563EB));color:white;border:none;border-radius:50%;cursor:pointer;font-family:inherit;text-decoration:none;box-shadow:var(--shadow-brand-sm);transition:opacity 0.15s,transform 0.12s;flex-shrink:0}
        .new-btn:hover{opacity:.90}
        .new-btn:active{transform:scale(0.93)}
        @media(min-width:480px){.new-btn{width:auto;height:auto;border-radius:var(--r-pill,50px);padding:10px 18px;gap:6px}}
        .new-btn-lbl{display:none}
        @media(min-width:480px){.new-btn-lbl{display:inline;font-size:13px;font-weight:700}}
        .content{padding:0 20px calc(var(--nav-h,88px) + 16px)}
        @media(min-width:768px){.content{padding:0 40px calc(var(--nav-h,88px) + 16px)}}
        .stats{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:18px}
        @media(max-width:600px){.stats{grid-template-columns:repeat(2,1fr)}}
        .stat{background:var(--bg,#ECEEF2);border-radius:var(--r-lg,20px);padding:14px 16px;box-shadow:var(--shadow-md);cursor:pointer;border:2px solid transparent;transition:all 0.15s}
        .stat.on{border-color:var(--brand-mid,#2563EB);box-shadow:0 4px 16px var(--brand-alpha,rgba(37,99,235,0.18))}
        .stat-num{font-size:26px;font-weight:800;color:var(--text-1,#1A1A20);letter-spacing:-0.5px}
        .stat-lbl{font-size:11px;font-weight:600;color:var(--text-3,rgba(26,26,32,0.38));text-transform:uppercase;letter-spacing:0.05em;margin-top:2px}
        .stat.on .stat-num{color:var(--brand,#1D4ED8)}
        .stat.on .stat-lbl{color:var(--brand-mid,#2563EB)}
        .search-wrap{margin-bottom:14px;position:relative}
        .search-icon{position:absolute;left:14px;top:50%;transform:translateY(-50%);pointer-events:none}
        .search-input{width:100%;padding:12px 16px 12px 42px;background:var(--bg,#ECEEF2);border:1.5px solid var(--border,rgba(0,0,0,0.07));border-radius:var(--r-md,16px);font-size:14px;font-weight:500;color:var(--text-1,#1A1A20);font-family:inherit;outline:none;box-shadow:var(--shadow-inset)}
        .search-input::placeholder{color:var(--text-4,rgba(26,26,32,0.28))}
        .search-input:focus{border-color:var(--brand-mid,#2563EB)}
        .card{background:var(--bg,#ECEEF2);border-radius:var(--r-xl,24px);overflow:hidden;box-shadow:var(--shadow-card)}
        .cust-row{display:flex;align-items:center;gap:12px;padding:13px 18px;border-top:1px solid var(--border-light,rgba(0,0,0,0.04));text-decoration:none;transition:background 0.12s}
        .cust-row:first-child{border-top:none}
        .cust-row:hover{background:var(--brand-alpha,rgba(37,99,235,0.04))}
        .av{width:42px;height:42px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:800;color:white;flex-shrink:0}
        .cust-name{font-size:14px;font-weight:700;color:var(--text-1,#1A1A20)}
        .cust-meta{font-size:12px;color:var(--text-3,rgba(26,26,32,0.40));margin-top:2px}
        .cust-right{text-align:right;flex-shrink:0}
        .badge{display:inline-block;padding:3px 9px;border-radius:var(--r-pill,50px);font-size:10px;font-weight:700}
        .balance{font-size:13px;font-weight:700;color:var(--text-1,#1A1A20);margin-top:3px}
        .balance.owing{color:#DC2626}
        .empty{padding:48px 20px;text-align:center}
        .empty-icon{width:56px;height:56px;background:var(--bg,#ECEEF2);border-radius:var(--r-lg,20px);display:flex;align-items:center;justify-content:center;margin:0 auto 14px;box-shadow:var(--shadow-sm)}
        .empty-title{font-size:15px;font-weight:700;color:var(--text-1,#1A1A20);margin-bottom:4px}
        .empty-sub{font-size:13px;color:var(--text-3,rgba(26,26,32,0.38))}
        .count{font-size:12px;color:var(--text-4,rgba(26,26,32,0.32));font-weight:500;margin-bottom:10px}
      `}</style>

      <Sidebar active="customers" />

      <div className="topbar">
        <div className="page-title">Clientes</div>
        <Link href="/customers/new" className="new-btn">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          <span className="new-btn-lbl">Cliente</span>
        </Link>
      </div>

      <div className="content">
        <div className="stats">
          {([['all','Todos'],['active','Activos'],['inactive','Inactivos'],['blocked','Bloqueados']] as const).map(([k,l]) => (
            <div key={k} className={`stat${filter===k?' on':''}`} onClick={() => setFilter(k)}>
              <div className="stat-num">{totals[k]}</div>
              <div className="stat-lbl">{l}</div>
            </div>
          ))}
        </div>

        <div className="search-wrap">
          <div className="search-icon"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--text-4,rgba(26,26,32,0.35))" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></div>
          <input className="search-input" placeholder="Buscar por nombre, email o teléfono..." value={q} onChange={e => setQ(e.target.value)} />
        </div>

        {filtered.length > 0 && <div className="count">{filtered.length} cliente{filtered.length !== 1 ? 's' : ''}</div>}

        <div className="card">
          {filtered.length === 0 ? (
            <div className="empty">
              <div className="empty-icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="rgba(29,78,216,0.50)" strokeWidth="1.8" strokeLinecap="round"><circle cx="9" cy="7" r="4"/><path d="M3 21a6 6 0 0 1 12 0"/><circle cx="17" cy="10" r="3"/><path d="M21 21a4 4 0 0 0-6 0"/></svg></div>
              <div className="empty-title">{q || filter !== 'all' ? 'Sin resultados' : 'Sin clientes aún'}</div>
              <div className="empty-sub">{q || filter !== 'all' ? 'Intenta con otra búsqueda o filtro' : 'Agrega tu primer cliente'}</div>
            </div>
          ) : filtered.map(c => {
            const st = STATUS_STYLE[c.status] ?? STATUS_STYLE.active
            return (
              <Link key={c.id} href={`/customers/${c.id}`} className="cust-row">
                <div className="av" style={{ background: avatarColor(c.full_name) }}>{initials(c.full_name)}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="cust-name">{c.full_name}</div>
                  <div className="cust-meta">
                    {c.phone && <span>{c.phone}</span>}
                    {c.phone && c.email && <span> · </span>}
                    {c.email && <span>{c.email}</span>}
                    {!c.phone && !c.email && <span>Sin contacto</span>}
                  </div>
                </div>
                <div className="cust-right">
                  <span className="badge" style={{ background: st.bg, color: st.color }}>{st.label}</span>
                  {c.balance_owing > 0 && <div className="balance owing">-${c.balance_owing.toLocaleString('es-MX',{minimumFractionDigits:2})}</div>}
                </div>
              </Link>
            )
          })}
        </div>
      </div>
    </>
  )
}
