'use client'

import { useState } from 'react'
import Link from 'next/link'
import Sidebar from '@/components/Sidebar'
import { createClient } from '@/lib/supabase/client'

interface Customer {
  id: string; full_name: string; email: string | null; phone: string | null
  status: string; balance_owing: number; credit_limit: number; created_at: string; tags: string[]
}
interface OrderSummary {
  id: string; folio: string; status: string; total: number; created_at: string
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

const ORDER_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  pagado:         { label: 'Pagado',        color: '#065f46', bg: 'rgba(5,150,105,0.10)'  },
  apartado:       { label: 'Apartado',      color: '#92400e', bg: 'rgba(217,119,6,0.10)'  },
  en_preparacion: { label: 'Preparando',    color: '#1e40af', bg: 'rgba(29,78,216,0.10)'  },
  enviado:        { label: 'Enviado',       color: '#6b21a8', bg: 'rgba(124,58,237,0.10)' },
  entregado:      { label: 'Entregado',     color: '#065f46', bg: 'rgba(5,150,105,0.10)'  },
  cancelado:      { label: 'Cancelado',     color: '#991b1b', bg: 'rgba(220,38,38,0.10)'  },
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })
}
function fmtMoney(n: number) {
  return '$' + n.toLocaleString('es-MX', { minimumFractionDigits: 2 })
}

export default function CustomersClient({ customers: initCustomers, orgId }: Props) {
  const [customers] = useState(initCustomers)
  const [q, setQ]         = useState('')
  const [filter, setFilter] = useState<'all'|'active'|'inactive'|'blocked'>('all')
  const [preview, setPreview] = useState<Customer | null>(null)
  const [orders, setOrders]   = useState<OrderSummary[]>([])
  const [loadingOrders, setLoadingOrders] = useState(false)

  const filtered = customers.filter(c => {
    const matchQ = !q || c.full_name.toLowerCase().includes(q.toLowerCase()) ||
      (c.email ?? '').toLowerCase().includes(q.toLowerCase()) || (c.phone ?? '').includes(q)
    const matchF = filter === 'all' || c.status === filter
    return matchQ && matchF
  })

  const totals = { all: customers.length, active: customers.filter(c => c.status==='active').length, inactive: customers.filter(c => c.status==='inactive').length, blocked: customers.filter(c => c.status==='blocked').length }

  async function openPreview(c: Customer) {
    setPreview(c)
    setOrders([])
    setLoadingOrders(true)
    const sb = createClient()
    const { data } = await sb
      .from('orders')
      .select('id, folio, status, total, created_at')
      .eq('customer_id', c.id)
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false })
      .limit(20)
    setOrders(data ?? [])
    setLoadingOrders(false)
  }

  function closePreview() { setPreview(null); setOrders([]) }

  return (
    <>
      <style>{`
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        body{background:var(--bg,#ECEEF2);font-family:var(--font,'Inter',-apple-system,sans-serif);-webkit-font-smoothing:antialiased}
        .new-btn{display:flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:50%;background:linear-gradient(145deg,#1D4ED8,#2563EB);color:white;border:none;cursor:pointer;font-family:inherit;text-decoration:none;box-shadow:0 4px 14px rgba(29,78,216,0.30);transition:opacity 0.15s,transform 0.12s;flex-shrink:0}
        .new-btn:hover{opacity:.90}
        .new-btn:active{transform:scale(0.90)}
        .new-btn-lbl{display:none}
        @media(min-width:600px){
          .new-btn{width:auto;height:auto;border-radius:50px;padding:8px 14px;gap:6px}
          .new-btn-lbl{display:inline;font-size:12px;font-weight:700}
        }
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
        .cust-row{display:flex;align-items:center;gap:12px;padding:13px 18px;border-top:1px solid var(--border-light,rgba(0,0,0,0.04));cursor:pointer;transition:background 0.12s}
        .cust-row:first-child{border-top:none}
        .cust-row:hover{background:var(--brand-alpha,rgba(37,99,235,0.04))}
        .cust-row:active{background:rgba(37,99,235,0.08)}
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

        /* ── Preview modal ─────────────────────────────────────── */
        .modal-backdrop{
          position:fixed;inset:0;z-index:400;
          background:rgba(0,0,0,0);
          transition:background 0.25s;
          pointer-events:none;
          display:flex;align-items:flex-end;justify-content:center
        }
        @media(min-width:768px){
          .modal-backdrop{align-items:center;justify-content:center}
        }
        .modal-backdrop.open{background:rgba(0,0,0,0.44);backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px);pointer-events:all}

        /* Mobile: bottom sheet */
        .cust-modal{
          position:fixed;
          bottom:0;left:0;right:0;
          z-index:401;
          background:var(--bg,#ECEEF2);
          border-radius:24px 24px 0 0;
          padding-bottom:calc(env(safe-area-inset-bottom,0px) + 16px);
          box-shadow:0 -8px 40px rgba(0,0,0,0.14);
          transform:translateY(100%);
          transition:transform 0.30s cubic-bezier(0.32,0.72,0,1);
          max-height:92dvh;
          display:flex;flex-direction:column;
        }
        .cust-modal.open{transform:translateY(0)}

        /* Desktop: centered dialog */
        @media(min-width:768px){
          .cust-modal{
            position:fixed;
            bottom:auto;left:50%;top:50%;right:auto;
            width:min(520px,90vw);
            border-radius:24px;
            transform:translate(-50%,-48%) scale(0.97);
            opacity:0;
            transition:transform 0.25s cubic-bezier(0.32,0.72,0,1),opacity 0.20s;
            max-height:88dvh;
          }
          .cust-modal.open{transform:translate(-50%,-50%) scale(1);opacity:1}
        }

        .modal-scroll{overflow-y:auto;flex:1;overscroll-behavior:contain}
        .sheet-handle{width:36px;height:4px;border-radius:2px;background:rgba(0,0,0,0.15);margin:12px auto 0;flex-shrink:0}
        @media(min-width:768px){.sheet-handle{display:none}}
        .sheet-head{padding:20px 20px 16px;border-bottom:1px solid rgba(0,0,0,0.06);flex-shrink:0}
        .sheet-avatar{width:60px;height:60px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:800;color:white;margin-bottom:12px}
        .sheet-name{font-size:20px;font-weight:800;color:var(--text-1,#1A1A20);letter-spacing:-0.3px}
        .sheet-body{padding:0 20px}
        .sheet-section{padding:14px 0;border-bottom:1px solid rgba(0,0,0,0.05)}
        .sheet-section:last-of-type{border-bottom:none}
        .sheet-label{font-size:10px;font-weight:700;color:var(--text-3,rgba(26,26,32,0.38));text-transform:uppercase;letter-spacing:0.06em;margin-bottom:8px}
        .sheet-row{display:flex;align-items:center;gap:10px;margin-bottom:6px}
        .sheet-row:last-child{margin-bottom:0}
        .sheet-val{font-size:14px;font-weight:500;color:var(--text-1,#1A1A20)}
        .sheet-val.muted{color:var(--text-3,rgba(26,26,32,0.45));font-weight:400}
        .sheet-num-row{display:flex;gap:10px}
        .sheet-num-card{flex:1;background:rgba(0,0,0,0.04);border-radius:14px;padding:12px}
        .sheet-num-val{font-size:18px;font-weight:800;color:var(--text-1,#1A1A20)}
        .sheet-num-val.red{color:#DC2626}
        .sheet-num-lbl{font-size:11px;color:var(--text-3,rgba(26,26,32,0.45));margin-top:2px}
        .sheet-tag{display:inline-block;padding:3px 10px;border-radius:50px;font-size:11px;font-weight:600;background:rgba(29,78,216,0.10);color:#1D4ED8;margin:0 4px 4px 0}
        .sheet-actions{display:flex;gap:10px;padding:14px 20px 4px;flex-shrink:0}
        .sheet-close-btn{flex:1;padding:13px;border-radius:14px;border:none;background:rgba(0,0,0,0.06);color:var(--text-1,#1A1A20);font-size:14px;font-weight:700;font-family:inherit;cursor:pointer;transition:background 0.12s}
        .sheet-close-btn:hover{background:rgba(0,0,0,0.10)}
        .sheet-edit-btn{flex:2;padding:13px;border-radius:14px;border:none;background:linear-gradient(145deg,#1D4ED8,#2563EB);color:white;font-size:14px;font-weight:700;font-family:inherit;cursor:pointer;text-align:center;text-decoration:none;display:flex;align-items:center;justify-content:center;gap:6px;box-shadow:0 4px 16px rgba(29,78,216,0.28);transition:opacity .12s}
        .sheet-edit-btn:hover{opacity:.90}

        /* Order history rows */
        .ord-item{display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid rgba(0,0,0,0.05)}
        .ord-item:last-child{border-bottom:none}
        .ord-folio{font-size:12px;font-weight:700;color:var(--text-1,#1A1A20);min-width:70px}
        .ord-date{font-size:11px;color:var(--text-3,rgba(26,26,32,0.42));margin-top:1px}
        .ord-total{font-size:14px;font-weight:800;color:var(--text-1,#1A1A20);margin-left:auto;flex-shrink:0}
        .ord-empty{font-size:13px;color:var(--text-3,rgba(26,26,32,0.42));padding:8px 0}
        .ord-loading{font-size:13px;color:var(--text-3);padding:10px 0;display:flex;align-items:center;gap:8px}
      `}</style>

      <Sidebar active="customers" />

      <div className="content">
        <div className="page-hd">
          <div className="page-hd-row">
            <div className="page-title">Clientes</div>
            <Link href="/customers/new" className="new-btn" aria-label="Agregar cliente">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              <span className="new-btn-lbl">+ Cliente</span>
            </Link>
          </div>
        </div>
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
              <div key={c.id} className="cust-row" onClick={() => openPreview(c)}>
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
                  {c.balance_owing > 0 && <div className="balance owing">-{fmtMoney(c.balance_owing)}</div>}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Backdrop */}
      <div className={`modal-backdrop${preview ? ' open' : ''}`} onClick={closePreview} />

      {/* Customer detail modal */}
      {preview && (() => {
        const st = STATUS_STYLE[preview.status] ?? STATUS_STYLE.active
        const totalSpent = orders.reduce((s, o) => s + Number(o.total), 0)
        return (
          <div className={`cust-modal${preview ? ' open' : ''}`}>
            <div className="sheet-handle" />

            {/* Scrollable area */}
            <div className="modal-scroll">
              <div className="sheet-head">
                <div className="sheet-avatar" style={{ background: avatarColor(preview.full_name) }}>{initials(preview.full_name)}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <div className="sheet-name">{preview.full_name}</div>
                  <span className="badge" style={{ background: st.bg, color: st.color, fontSize: 11 }}>{st.label}</span>
                </div>
              </div>

              <div className="sheet-body">
                {/* Contact */}
                <div className="sheet-section">
                  <div className="sheet-label">Contacto</div>
                  {preview.phone && (
                    <div className="sheet-row">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="rgba(26,26,32,0.40)" strokeWidth="2" strokeLinecap="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 11.5a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.59a16 16 0 0 0 6 6l.91-.91a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21.73 16z"/></svg>
                      <span className="sheet-val">{preview.phone}</span>
                    </div>
                  )}
                  {preview.email && (
                    <div className="sheet-row">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="rgba(26,26,32,0.40)" strokeWidth="2" strokeLinecap="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                      <span className="sheet-val">{preview.email}</span>
                    </div>
                  )}
                  {!preview.phone && !preview.email && <span className="sheet-val muted">Sin datos de contacto</span>}
                </div>

                {/* Balance */}
                <div className="sheet-section">
                  <div className="sheet-label">Cuenta</div>
                  <div className="sheet-num-row">
                    <div className="sheet-num-card">
                      <div className={`sheet-num-val${preview.balance_owing > 0 ? ' red' : ''}`}>
                        {fmtMoney(preview.balance_owing)}
                      </div>
                      <div className="sheet-num-lbl">Saldo pendiente</div>
                    </div>
                    <div className="sheet-num-card">
                      <div className="sheet-num-val">{fmtMoney(preview.credit_limit)}</div>
                      <div className="sheet-num-lbl">Límite de crédito</div>
                    </div>
                    {!loadingOrders && orders.length > 0 && (
                      <div className="sheet-num-card">
                        <div className="sheet-num-val">{fmtMoney(totalSpent)}</div>
                        <div className="sheet-num-lbl">Total comprado</div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Purchase history */}
                <div className="sheet-section">
                  <div className="sheet-label">
                    Historial de compras {!loadingOrders && orders.length > 0 ? `(${orders.length})` : ''}
                  </div>
                  {loadingOrders ? (
                    <div className="ord-loading">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ animation:'spin 1s linear infinite' }}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                      Cargando...
                    </div>
                  ) : orders.length === 0 ? (
                    <div className="ord-empty">Sin compras registradas</div>
                  ) : (
                    orders.map(o => {
                      const os = ORDER_STATUS[o.status] ?? { label: o.status, color: '#374151', bg: 'rgba(0,0,0,0.08)' }
                      return (
                        <div key={o.id} className="ord-item">
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div className="ord-folio">{o.folio || `#${o.id.slice(0,8)}`}</div>
                            <div className="ord-date">{fmtDate(o.created_at)}</div>
                          </div>
                          <span className="badge" style={{ background: os.bg, color: os.color, fontSize: 10, flexShrink: 0 }}>{os.label}</span>
                          <div className="ord-total">{fmtMoney(Number(o.total))}</div>
                        </div>
                      )
                    })
                  )}
                </div>

                {/* Tags */}
                {preview.tags && preview.tags.length > 0 && (
                  <div className="sheet-section">
                    <div className="sheet-label">Etiquetas</div>
                    <div>{preview.tags.map(t => <span key={t} className="sheet-tag">{t}</span>)}</div>
                  </div>
                )}

                {/* Meta */}
                <div className="sheet-section">
                  <div className="sheet-label">Información</div>
                  <div className="sheet-row">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(26,26,32,0.40)" strokeWidth="2" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                    <span className="sheet-val">Cliente desde {fmtDate(preview.created_at)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Fixed actions */}
            <div className="sheet-actions">
              <button className="sheet-close-btn" onClick={closePreview}>Cerrar</button>
              <Link href={`/customers/${preview.id}`} className="sheet-edit-btn">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                Ver perfil completo
              </Link>
            </div>
          </div>
        )
      })()}

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </>
  )
}
