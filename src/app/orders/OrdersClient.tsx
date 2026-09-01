'use client'

import { useState } from 'react'
import Sidebar from '@/components/Sidebar'
import Link from 'next/link'

interface OrderItem { id: string; product_name: string; variant_name: string; sku: string; quantity: number; unit_price: number; discount_amount: number; subtotal: number }
interface OrderPayment { id: string; method: string; amount: number }
interface OrderShipping { id: string; type: string; address_line1: string | null; address_line2: string | null; city: string | null; state: string | null; zip: string | null }
interface Customer { id: string; full_name: string; email: string | null; phone: string | null }
interface Order {
  id: string; folio: string; status: string
  subtotal: number; discount_amount: number; total: number; created_at: string
  customers: Customer | null
  order_items: OrderItem[]
  order_payments: OrderPayment[]
  order_shipping: OrderShipping[]
}

const STATUS: Record<string, { label: string; color: string; bg: string }> = {
  apartado:        { label: 'Apartado',    color: '#D97706', bg: 'rgba(217,119,6,0.10)' },
  pagado:          { label: 'Pagado',      color: '#059669', bg: 'rgba(5,150,105,0.10)' },
  en_preparacion:  { label: 'Preparando',  color: '#2563EB', bg: 'rgba(37,99,235,0.10)' },
  enviado:         { label: 'Enviado',     color: '#7C3AED', bg: 'rgba(124,58,237,0.10)' },
  entregado:       { label: 'Entregado',   color: '#059669', bg: 'rgba(5,150,105,0.10)' },
  cancelado:       { label: 'Cancelado',   color: '#DC2626', bg: 'rgba(220,38,38,0.10)' },
}

const METHOD_LABEL: Record<string, string> = {
  efectivo: 'Efectivo', tarjeta: 'Tarjeta', transferencia: 'Transferencia', otro: 'Otro',
}

const fmt = (n: number) => Number(n).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })

function fmtDate(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function OrdersClient({ orders }: { orders: Order[] }) {
  const [selected, setSelected] = useState<Order | null>(null)
  const [statusFilter, setStatusFilter] = useState('todos')

  const filtered = statusFilter === 'todos' ? orders : orders.filter(o => o.status === statusFilter)

  const totalRevenue = orders.filter(o => o.status !== 'cancelado').reduce((s, o) => s + Number(o.total), 0)

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        body{background:var(--bg,#ECEEF2);font-family:'Inter',-apple-system,sans-serif;-webkit-font-smoothing:antialiased}
        .ord-content{padding:max(env(safe-area-inset-top,0px),16px) 20px calc(var(--nav-h,88px) + 16px)}
        @media(min-width:768px){.ord-content{padding:max(env(safe-area-inset-top,0px),16px) 40px calc(var(--nav-h,88px) + 16px)}}
        .ord-hero{background:linear-gradient(145deg,#1D4ED8,#2563EB,#3B82F6);border-radius:28px;padding:24px;margin-bottom:16px;box-shadow:0 8px 24px rgba(29,78,216,0.28);position:relative;overflow:hidden}
        .ord-hero::before{content:'';position:absolute;top:-40px;right:-40px;width:180px;height:180px;background:radial-gradient(circle,rgba(255,255,255,0.12),transparent 70%)}
        .ord-hero-lbl{font-size:12px;color:rgba(255,255,255,0.65);font-weight:600;margin-bottom:4px}
        .ord-hero-val{font-size:36px;font-weight:900;color:white;letter-spacing:-1px;line-height:1}
        .ord-hero-sub{font-size:12px;color:rgba(255,255,255,0.60);margin-top:6px}
        .filter-row{display:flex;gap:8px;overflow-x:auto;padding-bottom:4px;margin-bottom:16px;scrollbar-width:none}
        .filter-row::-webkit-scrollbar{display:none}
        .filter-chip{padding:7px 16px;border-radius:50px;border:1.5px solid rgba(0,0,0,0.10);background:none;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;color:rgba(10,10,14,0.55);white-space:nowrap;transition:all .15s}
        .filter-chip.active{border-color:#2563EB;background:rgba(37,99,235,0.08);color:#1D4ED8}
        .ord-list{background:var(--bg,#ECEEF2);border-radius:24px;overflow:hidden;box-shadow:6px 6px 16px rgba(0,0,0,0.07),-4px -4px 12px rgba(255,255,255,0.9)}
        .ord-row{display:flex;align-items:center;gap:12px;padding:14px 18px;border-top:1px solid rgba(0,0,0,0.04);cursor:pointer;transition:background .12s}
        .ord-row:first-child{border-top:none}
        .ord-row:hover{background:rgba(37,99,235,0.04)}
        .ord-folio{width:74px;font-size:11px;font-weight:800;color:#1D4ED8;background:rgba(37,99,235,0.08);border-radius:8px;padding:4px 7px;text-align:center;flex-shrink:0}
        .ord-info{flex:1;min-width:0}
        .ord-cust{font-size:13px;font-weight:700;color:var(--text,#0A0A0E);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .ord-date{font-size:11px;color:rgba(10,10,14,0.40);margin-top:1px}
        .ord-right{display:flex;flex-direction:column;align-items:flex-end;gap:4px;flex-shrink:0}
        .ord-total{font-size:14px;font-weight:800;color:var(--text,#0A0A0E)}
        .badge{font-size:10px;font-weight:700;padding:3px 9px;border-radius:50px;white-space:nowrap}
        .empty{padding:40px 20px;text-align:center;color:rgba(10,10,14,0.35);font-size:14px;font-weight:600}

        /* DETAIL SHEET */
        .detail-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.40);z-index:800;display:flex;justify-content:flex-end}
        @media(max-width:767px){.detail-overlay{align-items:flex-end;justify-content:center}}
        .detail-sheet{background:var(--bg,#ECEEF2);width:100%;max-width:480px;height:100dvh;overflow-y:auto;display:flex;flex-direction:column}
        @media(max-width:767px){.detail-sheet{border-radius:28px 28px 0 0;max-height:92dvh;height:auto}}
        .detail-top{padding:20px 20px 16px;border-bottom:1px solid rgba(0,0,0,0.06);flex-shrink:0;display:flex;align-items:center;gap:12px}
        .detail-close{width:32px;height:32px;border-radius:50%;background:rgba(0,0,0,0.06);border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0}
        .detail-folio{font-size:18px;font-weight:900;color:var(--text,#0A0A0E);letter-spacing:-.3px}
        .detail-body{flex:1;overflow-y:auto;padding:16px 20px}
        .d-section{margin-bottom:20px}
        .d-title{font-size:11px;font-weight:700;color:rgba(10,10,14,0.38);text-transform:uppercase;letter-spacing:.07em;margin-bottom:10px}
        .d-box{background:rgba(0,0,0,0.03);border:1.5px solid rgba(0,0,0,0.06);border-radius:16px;overflow:hidden}
        .d-row{display:flex;justify-content:space-between;align-items:baseline;padding:10px 14px;border-bottom:1px solid rgba(0,0,0,0.04);font-size:13px}
        .d-row:last-child{border-bottom:none}
        .d-label{color:rgba(10,10,14,0.50);font-weight:500}
        .d-val{font-weight:700;color:var(--text,#0A0A0E);text-align:right;max-width:60%}
        .d-item{padding:10px 14px;border-bottom:1px solid rgba(0,0,0,0.04)}
        .d-item:last-child{border-bottom:none}
        .d-item-name{font-size:13px;font-weight:700;color:var(--text,#0A0A0E)}
        .d-item-sub{font-size:11px;color:rgba(10,10,14,0.45);margin-top:2px}
        .d-item-row{display:flex;justify-content:space-between;align-items:center;margin-top:6px}
        .d-item-qty{font-size:12px;color:rgba(10,10,14,0.50)}
        .d-item-price{font-size:13px;font-weight:700;color:var(--text,#0A0A0E)}
        .total-big{display:flex;justify-content:space-between;align-items:center;padding:14px 14px 0;margin-top:4px;border-top:1.5px solid rgba(0,0,0,0.08)}
        .total-big-lbl{font-size:15px;font-weight:700;color:var(--text,#0A0A0E)}
        .total-big-val{font-size:22px;font-weight:900;color:#1D4ED8;letter-spacing:-.5px}
        .pay-pill{display:inline-flex;align-items:center;gap:6px;background:rgba(5,150,105,0.08);border:1.5px solid rgba(5,150,105,0.15);border-radius:50px;padding:6px 12px;font-size:12px;font-weight:700;color:#059669;margin:4px 4px 0 0}
      `}</style>

      <Sidebar active="orders" />

      <div className="ord-content">
        <div className="ord-hero">
          <div className="ord-hero-lbl">Total en ventas</div>
          <div className="ord-hero-val">{fmt(totalRevenue)}</div>
          <div className="ord-hero-sub">{orders.length} {orders.length === 1 ? 'orden registrada' : 'órdenes registradas'}</div>
        </div>

        <div className="filter-row">
          {['todos','pagado','apartado','en_preparacion','enviado','entregado','cancelado'].map(s => (
            <button key={s} className={`filter-chip ${statusFilter===s?'active':''}`} onClick={() => setStatusFilter(s)}>
              {s === 'todos' ? 'Todos' : STATUS[s]?.label ?? s}
            </button>
          ))}
        </div>

        <div className="ord-list">
          {filtered.length === 0 ? (
            <div className="empty">No hay órdenes{statusFilter !== 'todos' ? ' con este estatus' : ' todavía'}</div>
          ) : filtered.map(o => {
            const st = STATUS[o.status] ?? { label: o.status, color: '#64748B', bg: 'rgba(100,116,139,0.10)' }
            return (
              <div key={o.id} className="ord-row" onClick={() => setSelected(o)}>
                <div className="ord-folio">{o.folio}</div>
                <div className="ord-info">
                  <div className="ord-cust">{o.customers?.full_name ?? 'Sin cliente'}</div>
                  <div className="ord-date">{fmtDate(o.created_at)}</div>
                </div>
                <div className="ord-right">
                  <div className="ord-total">{fmt(o.total)}</div>
                  <span className="badge" style={{ color: st.color, background: st.bg }}>{st.label}</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* DETAIL SHEET */}
      {selected && (
        <div className="detail-overlay" onClick={e => { if (e.target === e.currentTarget) setSelected(null) }}>
          <div className="detail-sheet">
            <div className="detail-top">
              <button className="detail-close" onClick={() => setSelected(null)}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
              <div style={{ flex: 1 }}>
                <div className="detail-folio">{selected.folio}</div>
                <div style={{ fontSize: 12, color: 'rgba(10,10,14,0.40)', marginTop: 2 }}>{fmtDate(selected.created_at)}</div>
              </div>
              {(() => {
                const st = STATUS[selected.status] ?? { label: selected.status, color: '#64748B', bg: 'rgba(100,116,139,0.10)' }
                return <span className="badge" style={{ color: st.color, background: st.bg, fontSize: 12, padding: '5px 12px' }}>{st.label}</span>
              })()}
            </div>

            <div className="detail-body">
              {/* Cliente */}
              <div className="d-section">
                <div className="d-title">Cliente</div>
                <div className="d-box">
                  <div className="d-row"><span className="d-label">Nombre</span><span className="d-val">{selected.customers?.full_name ?? '—'}</span></div>
                  {selected.customers?.phone && <div className="d-row"><span className="d-label">Teléfono</span><span className="d-val">{selected.customers.phone}</span></div>}
                  {selected.customers?.email && <div className="d-row"><span className="d-label">Email</span><span className="d-val">{selected.customers.email}</span></div>}
                </div>
              </div>

              {/* Productos */}
              <div className="d-section">
                <div className="d-title">Productos ({selected.order_items.length})</div>
                <div className="d-box">
                  {selected.order_items.map(item => (
                    <div key={item.id} className="d-item">
                      <div className="d-item-name">{item.product_name}</div>
                      <div className="d-item-sub">{item.variant_name} · SKU: {item.sku}</div>
                      <div className="d-item-row">
                        <span className="d-item-qty">{item.quantity} × {fmt(item.unit_price)}{item.discount_amount > 0 ? ` − ${fmt(item.discount_amount)}` : ''}</span>
                        <span className="d-item-price">{fmt(item.subtotal)}</span>
                      </div>
                    </div>
                  ))}
                  <div className="d-box" style={{ background: 'none', border: 'none', padding: '0 14px 12px' }}>
                    {Number(selected.discount_amount) > 0 && (
                      <div className="d-row" style={{ paddingLeft: 0, paddingRight: 0 }}>
                        <span className="d-label">Descuento general</span>
                        <span className="d-val" style={{ color: '#059669' }}>−{fmt(selected.discount_amount)}</span>
                      </div>
                    )}
                    <div className="total-big">
                      <span className="total-big-lbl">Total</span>
                      <span className="total-big-val">{fmt(selected.total)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Pagos */}
              <div className="d-section">
                <div className="d-title">Pagos</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {selected.order_payments.map(p => (
                    <div key={p.id} className="pay-pill">
                      {METHOD_LABEL[p.method] ?? p.method} · {fmt(p.amount)}
                    </div>
                  ))}
                  {selected.order_payments.length === 0 && <div style={{ fontSize: 13, color: 'rgba(10,10,14,0.40)', padding: '4px 0' }}>Sin pagos registrados</div>}
                </div>
              </div>

              {/* Envío */}
              {selected.order_shipping.length > 0 && (
                <div className="d-section">
                  <div className="d-title">Entrega</div>
                  <div className="d-box">
                    {selected.order_shipping.map(s => (
                      <div key={s.id}>
                        <div className="d-row"><span className="d-label">Tipo</span><span className="d-val">{s.type === 'pickup' ? 'Recoger en tienda' : 'Envío a domicilio'}</span></div>
                        {s.address_line1 && <div className="d-row"><span className="d-label">Dirección</span><span className="d-val">{[s.address_line1, s.address_line2, s.city, s.state, s.zip].filter(Boolean).join(', ')}</span></div>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
