'use client'

import { useState } from 'react'
import Link from 'next/link'
import Sidebar from '@/components/Sidebar'

interface OrderItem { id: string; product_name: string; variant_name: string; quantity: number; unit_price: number; discount_amount: number; subtotal: number }
interface OrderPayment { id: string; method: string; amount: number }
interface Order { id: string; folio: string; status: string; subtotal: number; discount_amount: number; total: number; created_at: string; order_items: OrderItem[]; order_payments: OrderPayment[] }
interface Customer { id: string; full_name: string; email: string | null; phone: string | null; tax_id: string | null; notes: string | null; status: string; credit_limit: number; balance_owing: number; tags: string[]; created_at: string }

interface Props { customer: Customer; orders: Order[]; orgId: string }

function initials(name: string) { return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?' }
const AVATAR_COLORS = ['linear-gradient(135deg,#1D4ED8,#3B82F6)','linear-gradient(135deg,#7C3AED,#A78BFA)','linear-gradient(135deg,#059669,#34D399)','linear-gradient(135deg,#DC2626,#F87171)','linear-gradient(135deg,#D97706,#FCD34D)','linear-gradient(135deg,#0891B2,#67E8F9)']
function avatarColor(name: string) { let h = 0; for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0xFFFFFF; return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length] }

const STATUS_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  active:   { bg: 'rgba(5,150,105,0.10)',   color: '#065f46', label: 'Activo'    },
  inactive: { bg: 'rgba(107,114,128,0.12)', color: '#374151', label: 'Inactivo'  },
  blocked:  { bg: 'rgba(220,38,38,0.10)',   color: '#991b1b', label: 'Bloqueado' },
}
const ORDER_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  pagado:         { label: 'Pagado',       color: '#065f46', bg: 'rgba(5,150,105,0.10)'  },
  apartado:       { label: 'Apartado',     color: '#92400e', bg: 'rgba(217,119,6,0.10)'  },
  en_preparacion: { label: 'Preparando',   color: '#1e40af', bg: 'rgba(29,78,216,0.10)'  },
  enviado:        { label: 'Enviado',      color: '#6b21a8', bg: 'rgba(124,58,237,0.10)' },
  entregado:      { label: 'Entregado',    color: '#065f46', bg: 'rgba(5,150,105,0.10)'  },
  cancelado:      { label: 'Cancelado',    color: '#991b1b', bg: 'rgba(220,38,38,0.10)'  },
}
const PAY_METHOD: Record<string, string> = { efectivo: 'Efectivo', tarjeta: 'Tarjeta', transferencia: 'Transferencia', otro: 'Otro' }

function fmtDate(d: string) { return new Date(d).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }) }
function fmtMoney(n: number) { return '$' + Number(n).toLocaleString('es-MX', { minimumFractionDigits: 2 }) }

export default function CustomerDetailClient({ customer, orders }: Props) {
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)

  const totalSpent = orders.reduce((s, o) => s + Number(o.total), 0)
  const st = STATUS_STYLE[customer.status] ?? STATUS_STYLE.active

  return (
    <>
      <style>{`
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        body{background:var(--bg,#ECEEF2);font-family:var(--font,'Inter',-apple-system,sans-serif);-webkit-font-smoothing:antialiased}

        .detail-wrap{max-width:720px;margin:0 auto;padding:16px 20px calc(var(--nav-h,88px) + env(safe-area-inset-bottom,0px) + 24px)}
        @media(min-width:768px){.detail-wrap{padding-top:28px}}

        /* Top bar */
        .dtop{display:flex;align-items:center;gap:12px;margin-bottom:20px}
        .back-btn{width:36px;height:36px;border-radius:12px;background:rgba(0,0,0,0.06);border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;color:rgba(26,26,32,0.55);flex-shrink:0;text-decoration:none;transition:background 0.12s}
        .back-btn:hover{background:rgba(0,0,0,0.10)}
        .dtop-title{font-size:20px;font-weight:800;color:var(--text-1,#1A1A20);letter-spacing:-.3px;flex:1}
        .edit-btn{display:flex;align-items:center;gap:6px;padding:8px 14px;border-radius:50px;border:none;background:linear-gradient(145deg,#1D4ED8,#2563EB);color:white;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;text-decoration:none;box-shadow:0 4px 14px rgba(29,78,216,0.28);transition:opacity .12s;white-space:nowrap}
        .edit-btn:hover{opacity:.90}

        /* Hero card */
        .hero-card{background:var(--bg,#ECEEF2);border-radius:var(--r-xl,24px);box-shadow:var(--shadow-card);padding:24px;margin-bottom:14px}
        .hero-top{display:flex;align-items:flex-start;gap:16px;margin-bottom:20px}
        .hero-av{width:64px;height:64px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:800;color:white;flex-shrink:0}
        .hero-name{font-size:22px;font-weight:900;color:var(--text-1,#1A1A20);letter-spacing:-.4px;margin-bottom:4px}
        .badge{display:inline-block;padding:3px 10px;border-radius:50px;font-size:11px;font-weight:700}
        .stats-row{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
        @media(max-width:480px){.stats-row{grid-template-columns:repeat(2,1fr)}}
        .stat-box{background:rgba(0,0,0,0.04);border-radius:14px;padding:12px}
        .stat-val{font-size:18px;font-weight:800;color:var(--text-1,#1A1A20);letter-spacing:-.3px}
        .stat-val.red{color:#DC2626}
        .stat-lbl{font-size:11px;color:var(--text-3,rgba(26,26,32,0.42));margin-top:2px}

        /* Section card */
        .sec-card{background:var(--bg,#ECEEF2);border-radius:var(--r-xl,24px);box-shadow:var(--shadow-card);margin-bottom:14px;overflow:hidden}
        .sec-hd{padding:16px 20px 12px;border-bottom:1px solid rgba(0,0,0,0.05);display:flex;align-items:center;justify-content:space-between}
        .sec-title{font-size:12px;font-weight:700;color:var(--text-3,rgba(26,26,32,0.42));text-transform:uppercase;letter-spacing:0.06em}
        .sec-count{font-size:12px;font-weight:700;color:var(--text-3,rgba(26,26,32,0.42))}
        .info-row{display:flex;align-items:center;gap:10px;padding:12px 20px;border-bottom:1px solid rgba(0,0,0,0.04)}
        .info-row:last-child{border-bottom:none}
        .info-lbl{font-size:12px;color:var(--text-3,rgba(26,26,32,0.42));font-weight:500;width:100px;flex-shrink:0}
        .info-val{font-size:14px;font-weight:600;color:var(--text-1,#1A1A20)}
        .info-val.muted{color:var(--text-3,rgba(26,26,32,0.42));font-weight:400}
        .tag{display:inline-block;padding:3px 10px;border-radius:50px;font-size:11px;font-weight:600;background:rgba(29,78,216,0.10);color:#1D4ED8;margin:0 4px 4px 0}

        /* Orders list */
        .ord-row{display:flex;align-items:center;gap:12px;padding:14px 20px;border-bottom:1px solid rgba(0,0,0,0.04);cursor:pointer;transition:background 0.12s}
        .ord-row:last-child{border-bottom:none}
        .ord-row:hover{background:rgba(29,78,216,0.03)}
        .ord-row:active{background:rgba(29,78,216,0.07)}
        .ord-folio{font-size:13px;font-weight:700;color:var(--text-1,#1A1A20)}
        .ord-date{font-size:11px;color:var(--text-3,rgba(26,26,32,0.42));margin-top:2px}
        .ord-total{font-size:15px;font-weight:800;color:var(--text-1,#1A1A20);margin-left:auto;flex-shrink:0}
        .ord-arrow{color:rgba(26,26,32,0.25);flex-shrink:0}
        .ord-empty{padding:32px 20px;text-align:center;font-size:13px;color:var(--text-3,rgba(26,26,32,0.42))}

        /* Order detail modal */
        .mod-back{position:fixed;inset:0;z-index:400;background:rgba(0,0,0,0.44);backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px);display:flex;align-items:flex-end;justify-content:center}
        @media(min-width:768px){.mod-back{align-items:center}}
        .mod-sheet{
          background:var(--bg,#ECEEF2);
          border-radius:24px 24px 0 0;
          width:100%;
          max-width:520px;
          max-height:88dvh;
          display:flex;flex-direction:column;
          transform:translateY(4px);
          padding-bottom:calc(env(safe-area-inset-bottom,0px) + 8px);
          box-shadow:0 -8px 40px rgba(0,0,0,0.14);
        }
        @media(min-width:768px){
          .mod-sheet{border-radius:24px;transform:scale(0.98);transition:transform 0.2s}
        }
        .mod-handle{width:36px;height:4px;border-radius:2px;background:rgba(0,0,0,0.15);margin:12px auto 0;flex-shrink:0}
        @media(min-width:768px){.mod-handle{display:none}}
        .mod-hd{padding:16px 20px;border-bottom:1px solid rgba(0,0,0,0.06);flex-shrink:0}
        .mod-title{font-size:18px;font-weight:800;color:var(--text-1,#1A1A20);letter-spacing:-.3px;margin-bottom:4px}
        .mod-sub{font-size:12px;color:var(--text-3,rgba(26,26,32,0.42))}
        .mod-scroll{flex:1;overflow-y:auto;overscroll-behavior:contain}
        .mod-section{padding:14px 20px;border-bottom:1px solid rgba(0,0,0,0.05)}
        .mod-section:last-of-type{border-bottom:none}
        .mod-sec-lbl{font-size:10px;font-weight:700;color:var(--text-3,rgba(26,26,32,0.38));text-transform:uppercase;letter-spacing:0.06em;margin-bottom:10px}
        .item-row{display:flex;align-items:flex-start;gap:10px;margin-bottom:8px}
        .item-row:last-child{margin-bottom:0}
        .item-qty{min-width:28px;height:28px;border-radius:8px;background:rgba(0,0,0,0.06);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;color:var(--text-1,#1A1A20);flex-shrink:0}
        .item-name{font-size:13px;font-weight:600;color:var(--text-1,#1A1A20);flex:1}
        .item-var{font-size:11px;color:var(--text-3,rgba(26,26,32,0.42));margin-top:1px}
        .item-price{font-size:13px;font-weight:700;color:var(--text-1,#1A1A20);flex-shrink:0}
        .pay-row{display:flex;justify-content:space-between;font-size:13px;font-weight:600;color:var(--text-2,rgba(26,26,32,0.70));margin-bottom:6px}
        .pay-row:last-child{margin-bottom:0}
        .total-line{display:flex;justify-content:space-between;font-size:16px;font-weight:800;color:var(--text-1,#1A1A20);padding-top:10px;margin-top:6px;border-top:1px solid rgba(0,0,0,0.08)}
        .mod-close{display:flex;gap:10px;padding:12px 20px 4px;flex-shrink:0}
        .btn-close{flex:1;padding:13px;border-radius:14px;border:none;background:rgba(0,0,0,0.06);color:var(--text-1,#1A1A20);font-size:14px;font-weight:700;font-family:inherit;cursor:pointer}
        .btn-close:hover{background:rgba(0,0,0,0.10)}
      `}</style>

      <Sidebar active="customers" />

      <div className="content">
        <div className="detail-wrap">
          {/* Top bar */}
          <div className="dtop">
            <Link href="/customers" className="back-btn" aria-label="Volver">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
            </Link>
            <div className="dtop-title">Detalle del cliente</div>
            <Link href={`/customers/${customer.id}/edit`} className="edit-btn">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              Editar
            </Link>
          </div>

          {/* Hero */}
          <div className="hero-card">
            <div className="hero-top">
              <div className="hero-av" style={{ background: avatarColor(customer.full_name) }}>{initials(customer.full_name)}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="hero-name">{customer.full_name}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
                  <span className="badge" style={{ background: st.bg, color: st.color }}>{st.label}</span>
                  <span style={{ fontSize: 12, color: 'var(--text-3,rgba(26,26,32,0.40))', fontWeight: 500 }}>
                    Cliente desde {fmtDate(customer.created_at)}
                  </span>
                </div>
              </div>
            </div>

            <div className="stats-row">
              <div className="stat-box">
                <div className={`stat-val${customer.balance_owing > 0 ? ' red' : ''}`}>{fmtMoney(customer.balance_owing)}</div>
                <div className="stat-lbl">Saldo pendiente</div>
              </div>
              <div className="stat-box">
                <div className="stat-val">{fmtMoney(customer.credit_limit)}</div>
                <div className="stat-lbl">Límite de crédito</div>
              </div>
              <div className="stat-box">
                <div className="stat-val">{fmtMoney(totalSpent)}</div>
                <div className="stat-lbl">Total comprado</div>
              </div>
            </div>
          </div>

          {/* Contact */}
          <div className="sec-card">
            <div className="sec-hd"><div className="sec-title">Contacto</div></div>
            {customer.phone && (
              <div className="info-row">
                <div className="info-lbl">Teléfono</div>
                <div className="info-val">{customer.phone}</div>
              </div>
            )}
            {customer.email && (
              <div className="info-row">
                <div className="info-lbl">Email</div>
                <div className="info-val">{customer.email}</div>
              </div>
            )}
            {customer.tax_id && (
              <div className="info-row">
                <div className="info-lbl">RFC / ID Fiscal</div>
                <div className="info-val">{customer.tax_id}</div>
              </div>
            )}
            {!customer.phone && !customer.email && !customer.tax_id && (
              <div className="info-row"><div className="info-val muted">Sin datos de contacto registrados</div></div>
            )}
            {customer.tags && customer.tags.length > 0 && (
              <div className="info-row">
                <div className="info-lbl">Etiquetas</div>
                <div>{customer.tags.map(t => <span key={t} className="tag">{t}</span>)}</div>
              </div>
            )}
            {customer.notes && (
              <div className="info-row">
                <div className="info-lbl">Notas</div>
                <div className="info-val" style={{ fontSize: 13, fontWeight: 400, whiteSpace: 'pre-wrap' }}>{customer.notes}</div>
              </div>
            )}
          </div>

          {/* Orders */}
          <div className="sec-card">
            <div className="sec-hd">
              <div className="sec-title">Historial de compras</div>
              {orders.length > 0 && <div className="sec-count">{orders.length} orden{orders.length !== 1 ? 'es' : ''}</div>}
            </div>
            {orders.length === 0 ? (
              <div className="ord-empty">Sin compras registradas</div>
            ) : (
              orders.map(o => {
                const os = ORDER_STATUS[o.status] ?? { label: o.status, color: '#374151', bg: 'rgba(0,0,0,0.08)' }
                return (
                  <div key={o.id} className="ord-row" onClick={() => setSelectedOrder(o)}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="ord-folio">{o.folio || `#${o.id.slice(0, 8)}`}</div>
                      <div className="ord-date">{fmtDate(o.created_at)} · {o.order_items.length} producto{o.order_items.length !== 1 ? 's' : ''}</div>
                    </div>
                    <span className="badge" style={{ background: os.bg, color: os.color, fontSize: 10, flexShrink: 0 }}>{os.label}</span>
                    <div className="ord-total">{fmtMoney(Number(o.total))}</div>
                    <div className="ord-arrow">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>

      {/* Order detail modal */}
      {selectedOrder && (() => {
        const os = ORDER_STATUS[selectedOrder.status] ?? { label: selectedOrder.status, color: '#374151', bg: 'rgba(0,0,0,0.08)' }
        const totalPaid = selectedOrder.order_payments.reduce((s, p) => s + Number(p.amount), 0)
        return (
          <div className="mod-back" onClick={e => { if (e.target === e.currentTarget) setSelectedOrder(null) }}>
            <div className="mod-sheet">
              <div className="mod-handle" />

              <div className="mod-hd">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div className="mod-title">{selectedOrder.folio || `Orden #${selectedOrder.id.slice(0, 8)}`}</div>
                  <span className="badge" style={{ background: os.bg, color: os.color }}>{os.label}</span>
                </div>
                <div className="mod-sub">{fmtDate(selectedOrder.created_at)}</div>
              </div>

              <div className="mod-scroll">
                {/* Items */}
                <div className="mod-section">
                  <div className="mod-sec-lbl">Productos ({selectedOrder.order_items.length})</div>
                  {selectedOrder.order_items.map(item => (
                    <div key={item.id} className="item-row">
                      <div className="item-qty">{item.quantity}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="item-name">{item.product_name}</div>
                        {item.variant_name && item.variant_name !== item.product_name && (
                          <div className="item-var">{item.variant_name}</div>
                        )}
                      </div>
                      <div className="item-price">{fmtMoney(Number(item.subtotal))}</div>
                    </div>
                  ))}
                </div>

                {/* Totals */}
                <div className="mod-section">
                  <div className="mod-sec-lbl">Resumen</div>
                  <div className="pay-row"><span>Subtotal</span><span>{fmtMoney(Number(selectedOrder.subtotal))}</span></div>
                  {Number(selectedOrder.discount_amount) > 0 && (
                    <div className="pay-row" style={{ color: '#059669' }}><span>Descuento</span><span>-{fmtMoney(Number(selectedOrder.discount_amount))}</span></div>
                  )}
                  <div className="total-line"><span>Total</span><span>{fmtMoney(Number(selectedOrder.total))}</span></div>
                </div>

                {/* Payments */}
                {selectedOrder.order_payments.length > 0 && (
                  <div className="mod-section">
                    <div className="mod-sec-lbl">Pagos registrados</div>
                    {selectedOrder.order_payments.map(p => (
                      <div key={p.id} className="pay-row">
                        <span>{PAY_METHOD[p.method] ?? p.method}</span>
                        <span style={{ fontWeight: 700, color: 'var(--text-1,#1A1A20)' }}>{fmtMoney(Number(p.amount))}</span>
                      </div>
                    ))}
                    {totalPaid < Number(selectedOrder.total) && (
                      <div className="pay-row" style={{ color: '#DC2626', marginTop: 6 }}>
                        <span>Pendiente</span>
                        <span style={{ fontWeight: 700 }}>{fmtMoney(Number(selectedOrder.total) - totalPaid)}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="mod-close">
                <button className="btn-close" onClick={() => setSelectedOrder(null)}>Cerrar</button>
              </div>
            </div>
          </div>
        )
      })()}
    </>
  )
}
