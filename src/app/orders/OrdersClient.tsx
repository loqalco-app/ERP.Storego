'use client'

import { useState, useMemo } from 'react'
import Sidebar from '@/components/Sidebar'
import { createClient } from '@/lib/supabase/client'

interface OrderPayment { id: string; method: string; amount: number; created_at?: string }
interface Customer { id: string; full_name: string; email: string | null; phone: string | null }

interface OrderSummary {
  id: string; folio: string; status: string; total: number; created_at: string
  customers: Customer | null
  order_payments: OrderPayment[]
}

interface OrderDetail extends OrderSummary {
  order_items: { id: string; product_name: string; variant_name: string; sku: string; quantity: number; unit_price: number }[]
  order_shipping: { id: string; type: string; address_line1: string | null; address_line2: string | null; city: string | null; state: string | null; zip: string | null }[]
}

const STATUS: Record<string, { label: string; color: string; bg: string }> = {
  apartado:       { label: 'Apartado',   color: '#D97706', bg: 'rgba(217,119,6,0.10)' },
  pagado:         { label: 'Pagado',     color: '#059669', bg: 'rgba(5,150,105,0.10)' },
  en_preparacion: { label: 'Preparando', color: '#2563EB', bg: 'rgba(37,99,235,0.10)' },
  enviado:        { label: 'Enviado',    color: '#7C3AED', bg: 'rgba(124,58,237,0.10)' },
  entregado:      { label: 'Entregado',  color: '#059669', bg: 'rgba(5,150,105,0.10)' },
  cancelado:      { label: 'Cancelado',  color: '#DC2626', bg: 'rgba(220,38,38,0.10)' },
}

const METHOD_LABEL: Record<string, string> = {
  efectivo: 'Efectivo', tarjeta: 'Tarjeta', transferencia: 'Transferencia', otro: 'Otro',
}
const METHODS = ['efectivo', 'tarjeta', 'transferencia', 'otro'] as const

const fmt = (n: number) => Number(n).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
const fmtShort = (iso: string) => new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

export default function OrdersClient({ orders: initialOrders, orgId }: { orders: OrderSummary[]; orgId: string }) {
  const supabase = createClient()
  const [orders, setOrders] = useState<OrderSummary[]>(initialOrders)
  const [selected, setSelected] = useState<OrderDetail | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [statusFilter, setStatusFilter] = useState('todos')

  // Abono state
  const [abonoMethod, setAbonoMethod] = useState<typeof METHODS[number]>('efectivo')
  const [abonoAmount, setAbonoAmount] = useState('')
  const [savingAbono, setSavingAbono] = useState(false)
  const [abonoError, setAbonoError] = useState('')

  const filtered = useMemo(() =>
    statusFilter === 'todos' ? orders : orders.filter(o => o.status === statusFilter),
    [orders, statusFilter]
  )

  async function openOrder(summary: OrderSummary) {
    setSelected(null); setAbonoAmount(''); setAbonoError('')
    setLoadingDetail(true)
    const { data } = await supabase
      .from('orders')
      .select(`
        id, folio, status, total, created_at,
        customers(id, full_name, phone, email),
        order_payments(id, method, amount, created_at),
        order_items(id, product_name, variant_name, sku, quantity, unit_price),
        order_shipping(id, type, address_line1, address_line2, city, state, zip)
      `)
      .eq('id', summary.id)
      .single()
    setLoadingDetail(false)
    if (data) setSelected(data as any as OrderDetail)
  }

  function syncSelected(updated: OrderDetail) {
    setSelected(updated)
    setOrders(prev => prev.map(o => o.id === updated.id
      ? { ...o, status: updated.status, order_payments: updated.order_payments }
      : o
    ))
  }

  async function addAbono() {
    if (!selected) return
    const amount = parseFloat(abonoAmount)
    if (!amount || amount <= 0) { setAbonoError('Ingresa un monto válido'); return }
    setSavingAbono(true); setAbonoError('')
    const totalPaid = selected.order_payments.reduce((s, p) => s + Number(p.amount), 0)
    const isLiquidado = totalPaid + amount >= Number(selected.total)
    const { data: payment, error } = await supabase
      .from('order_payments')
      .insert({ order_id: selected.id, organization_id: orgId, method: abonoMethod, amount })
      .select('id, method, amount, created_at')
      .single()
    if (error || !payment) { setSavingAbono(false); setAbonoError('Error al guardar el abono'); return }
    if (isLiquidado) await supabase.from('orders').update({ status: 'pagado' }).eq('id', selected.id)
    syncSelected({
      ...selected,
      status: isLiquidado ? 'pagado' : selected.status,
      order_payments: [...selected.order_payments, payment as OrderPayment],
    })
    setAbonoAmount(''); setSavingAbono(false)
  }

  async function liquidar() {
    if (!selected) return
    await supabase.from('orders').update({ status: 'pagado' }).eq('id', selected.id)
    syncSelected({ ...selected, status: 'pagado' })
  }

  return (
    <>
      <style>{`
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        body{background:var(--bg,#ECEEF2);font-family:'Inter',-apple-system,sans-serif;-webkit-font-smoothing:antialiased}
        .ord-topbar{position:sticky;top:0;z-index:100;background:rgba(236,238,242,0.82);-webkit-backdrop-filter:blur(20px) saturate(160%);backdrop-filter:blur(20px) saturate(160%);padding:max(env(safe-area-inset-top,0px),20px) 20px 16px;display:flex;align-items:center;gap:12px}
        @media(min-width:768px){.ord-topbar{padding:max(env(safe-area-inset-top,0px),20px) 40px 20px}}
        .ord-page-title{font-size:22px;font-weight:800;color:#0A0A0E;letter-spacing:-.4px}
        @media(min-width:768px){.ord-page-title{font-size:26px}}
        .ord-count{margin-left:auto;font-size:12px;font-weight:700;color:rgba(10,10,14,0.40)}
        .ord-content{padding:16px 20px calc(var(--nav-h,88px) + env(safe-area-inset-bottom,0px) + 16px)}
        @media(min-width:768px){.ord-content{padding:16px 40px calc(var(--nav-h,88px) + env(safe-area-inset-bottom,0px) + 16px)}}
        .filter-row{display:flex;gap:8px;overflow-x:auto;padding-bottom:4px;margin-bottom:16px;scrollbar-width:none}
        .filter-row::-webkit-scrollbar{display:none}
        .filter-chip{padding:7px 16px;border-radius:50px;border:1.5px solid rgba(0,0,0,0.10);background:none;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;color:rgba(10,10,14,0.55);white-space:nowrap;transition:all .15s;flex-shrink:0}
        .filter-chip.active{border-color:#2563EB;background:rgba(37,99,235,0.08);color:#1D4ED8}
        .ord-list{background:var(--bg,#ECEEF2);border-radius:24px;overflow:hidden;box-shadow:6px 6px 16px rgba(0,0,0,0.07),-4px -4px 12px rgba(255,255,255,0.9)}
        .ord-row{display:flex;align-items:center;gap:12px;padding:14px 18px;border-top:1px solid rgba(0,0,0,0.04);cursor:pointer;transition:background .12s}
        .ord-row:first-child{border-top:none}
        .ord-row:hover{background:rgba(37,99,235,0.04)}
        .ord-folio{width:74px;font-size:11px;font-weight:800;color:#1D4ED8;background:rgba(37,99,235,0.08);border-radius:8px;padding:4px 7px;text-align:center;flex-shrink:0}
        .ord-info{flex:1;min-width:0}
        .ord-cust{font-size:13px;font-weight:700;color:#0A0A0E;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .ord-date{font-size:11px;color:rgba(10,10,14,0.40);margin-top:1px}
        .ord-right{display:flex;flex-direction:column;align-items:flex-end;gap:4px;flex-shrink:0}
        .ord-total{font-size:14px;font-weight:800;color:#0A0A0E}
        .badge{font-size:10px;font-weight:700;padding:3px 9px;border-radius:50px;white-space:nowrap}
        .empty{padding:48px 20px;text-align:center;color:rgba(10,10,14,0.35);font-size:14px;font-weight:600}
        /* DETAIL SHEET */
        .detail-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.40);z-index:800;display:flex;justify-content:flex-end}
        @media(max-width:767px){.detail-overlay{align-items:flex-end;justify-content:center}}
        .detail-sheet{background:var(--bg,#ECEEF2);width:100%;max-width:480px;height:100dvh;overflow-y:auto;display:flex;flex-direction:column}
        @media(max-width:767px){.detail-sheet{border-radius:28px 28px 0 0;max-height:94dvh;height:auto}}
        .detail-top{padding:20px 20px 14px;border-bottom:1px solid rgba(0,0,0,0.06);flex-shrink:0;display:flex;align-items:center;gap:12px}
        .detail-close{width:32px;height:32px;border-radius:50%;background:rgba(0,0,0,0.06);border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0}
        .detail-folio{font-size:18px;font-weight:900;color:#0A0A0E;letter-spacing:-.3px}
        .detail-body{flex:1;overflow-y:auto;padding:16px 20px calc(env(safe-area-inset-bottom,0px) + 16px)}
        .d-section{margin-bottom:20px}
        .d-title{font-size:11px;font-weight:700;color:rgba(10,10,14,0.38);text-transform:uppercase;letter-spacing:.07em;margin-bottom:10px}
        .d-box{background:rgba(0,0,0,0.03);border:1.5px solid rgba(0,0,0,0.06);border-radius:16px;overflow:hidden}
        .d-row{display:flex;justify-content:space-between;align-items:baseline;padding:10px 14px;border-bottom:1px solid rgba(0,0,0,0.04);font-size:13px}
        .d-row:last-child{border-bottom:none}
        .d-label{color:rgba(10,10,14,0.50);font-weight:500}
        .d-val{font-weight:700;color:#0A0A0E;text-align:right;max-width:60%}
        .d-item{padding:10px 14px;border-bottom:1px solid rgba(0,0,0,0.04)}
        .d-item:last-child{border-bottom:none}
        .total-big{display:flex;justify-content:space-between;align-items:center;padding:14px 14px 0;margin-top:4px;border-top:1.5px solid rgba(0,0,0,0.08)}
        /* ABONO */
        .abono-progress{background:rgba(0,0,0,0.06);border-radius:50px;height:8px;margin:10px 0 4px;overflow:hidden}
        .abono-bar{height:100%;border-radius:50px;transition:width 0.5s cubic-bezier(0.34,1.56,0.64,1)}
        .abono-payment{display:flex;align-items:center;justify-content:space-between;padding:9px 14px;border-bottom:1px solid rgba(0,0,0,0.04)}
        .abono-payment:last-child{border-bottom:none}
        .abono-form{display:flex;gap:8px;margin-top:12px;align-items:center}
        .abono-select{flex:1;padding:10px 12px;border:1.5px solid rgba(0,0,0,0.08);border-radius:12px;background:rgba(0,0,0,0.03);font-size:13px;font-family:inherit;color:#0A0A0E;outline:none}
        .abono-input{width:110px;padding:10px 12px;border:1.5px solid rgba(0,0,0,0.08);border-radius:12px;background:rgba(0,0,0,0.03);font-size:13px;font-family:inherit;color:#0A0A0E;outline:none;text-align:right}
        .abono-select:focus,.abono-input:focus{border-color:#2563EB}
        .abono-btn{padding:10px 16px;border-radius:12px;border:none;background:linear-gradient(145deg,#1D4ED8,#2563EB);color:white;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;white-space:nowrap}
        .abono-btn:disabled{opacity:.5;cursor:not-allowed}
        .liquidar-btn{width:100%;padding:14px;border-radius:18px;border:none;background:linear-gradient(145deg,#059669,#10B981);color:white;font-size:15px;font-weight:700;cursor:pointer;font-family:inherit;box-shadow:0 6px 20px rgba(5,150,105,0.28);margin-top:12px}
        .alert-err{background:rgba(220,38,38,0.07);border:1px solid rgba(220,38,38,0.15);border-radius:12px;padding:8px 12px;font-size:12px;font-weight:600;color:#991b1b;margin-top:8px}
        @keyframes sk-s{0%{background-position:-200% 0}100%{background-position:200% 0}}
        .sk{border-radius:12px;background:linear-gradient(90deg,rgba(0,0,0,0.06) 25%,rgba(0,0,0,0.10) 50%,rgba(0,0,0,0.06) 75%);background-size:200%;animation:sk-s 1.4s infinite}
      `}</style>

      <Sidebar active="orders" />

      <div className="ord-topbar">
        <div className="ord-page-title">Órdenes</div>
        <div className="ord-count">{filtered.length} {filtered.length === 1 ? 'orden' : 'órdenes'}</div>
      </div>

      <div className="ord-content">
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
            const paid = o.order_payments.reduce((s, p) => s + Number(p.amount), 0)
            const pct = Math.min(100, Math.round(paid / Math.max(1, Number(o.total)) * 100))
            return (
              <div key={o.id} className="ord-row" onClick={() => openOrder(o)}>
                <div className="ord-folio">{o.folio}</div>
                <div className="ord-info">
                  <div className="ord-cust">{o.customers?.full_name ?? 'Sin cliente'}</div>
                  <div className="ord-date">{fmtDate(o.created_at)}</div>
                  {o.status === 'apartado' && (
                    <div style={{marginTop:4,display:'flex',alignItems:'center',gap:6}}>
                      <div style={{flex:1,height:4,borderRadius:2,background:'rgba(0,0,0,0.08)',overflow:'hidden'}}>
                        <div style={{height:'100%',borderRadius:2,width:`${pct}%`,background:pct>=100?'#059669':'#D97706'}} />
                      </div>
                      <span style={{fontSize:10,fontWeight:700,color:'rgba(10,10,14,0.45)'}}>{pct}%</span>
                    </div>
                  )}
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

      {/* LOADING SKELETON del detalle */}
      {loadingDetail && (
        <div className="detail-overlay" onClick={() => setLoadingDetail(false)}>
          <div className="detail-sheet">
            <div className="detail-top">
              <button className="detail-close" onClick={() => setLoadingDetail(false)}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
              <div className="sk" style={{flex:1,height:24,maxWidth:160}} />
            </div>
            <div style={{padding:20,display:'flex',flexDirection:'column',gap:16}}>
              {[180,140,240,100,160,80,200].map((w,i) => <div key={i} className="sk" style={{height:36,maxWidth:w}} />)}
            </div>
          </div>
        </div>
      )}

      {/* DETAIL SHEET — cargado bajo demanda */}
      {selected && !loadingDetail && (() => {
        const st = STATUS[selected.status] ?? { label: selected.status, color: '#64748B', bg: 'rgba(100,116,139,0.10)' }
        const totalPaid = selected.order_payments.reduce((s, p) => s + Number(p.amount), 0)
        const pending = Math.max(0, Number(selected.total) - totalPaid)
        const pct = Math.min(100, Math.round(totalPaid / Math.max(1, Number(selected.total)) * 100))
        const isApartado = selected.status === 'apartado'

        return (
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
                <span className="badge" style={{ color: st.color, background: st.bg, fontSize: 12, padding: '5px 12px' }}>{st.label}</span>
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
                {selected.order_items?.length > 0 && (
                  <div className="d-section">
                    <div className="d-title">Productos ({selected.order_items.length})</div>
                    <div className="d-box">
                      {selected.order_items.map(item => (
                        <div key={item.id} className="d-item">
                          <div style={{fontSize:13,fontWeight:700,color:'#0A0A0E'}}>{item.product_name}</div>
                          <div style={{fontSize:11,color:'rgba(10,10,14,0.45)',marginTop:2}}>{item.variant_name} · SKU: {item.sku}</div>
                          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:6}}>
                            <span style={{fontSize:12,color:'rgba(10,10,14,0.50)'}}>{item.quantity} × {fmt(item.unit_price)}</span>
                            <span style={{fontSize:13,fontWeight:700,color:'#0A0A0E'}}>{fmt(item.unit_price * item.quantity)}</span>
                          </div>
                        </div>
                      ))}
                      <div style={{padding:'12px 14px 14px'}}>
                        <div className="total-big">
                          <span style={{fontSize:15,fontWeight:700,color:'#0A0A0E'}}>Total</span>
                          <span style={{fontSize:22,fontWeight:900,color:'#1D4ED8',letterSpacing:'-.5px'}}>{fmt(selected.total)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Pagos / Abonos */}
                <div className="d-section">
                  <div className="d-title">{isApartado ? `Pagos y abonos · ${pct}% cubierto` : 'Pagos'}</div>

                  {isApartado && (
                    <>
                      <div className="abono-progress">
                        <div className="abono-bar" style={{ width:`${pct}%`, background: pct>=100?'#059669':'#D97706' }} />
                      </div>
                      <div style={{display:'flex',justifyContent:'space-between',fontSize:12,fontWeight:600,marginBottom:12}}>
                        <span style={{color:'#059669'}}>Pagado: {fmt(totalPaid)}</span>
                        <span style={{color:pending>0?'#D97706':'#059669'}}>{pending>0?`Pendiente: ${fmt(pending)}`:'✓ Liquidado'}</span>
                      </div>
                    </>
                  )}

                  <div className="d-box">
                    {selected.order_payments.map((p, i) => (
                      <div key={p.id ?? i} className="abono-payment">
                        <div>
                          <div style={{fontSize:12,fontWeight:700,color:'rgba(10,10,14,0.55)'}}>{METHOD_LABEL[p.method] ?? p.method}</div>
                          {p.created_at && <div style={{fontSize:10,color:'rgba(10,10,14,0.38)',marginTop:1}}>{fmtShort(p.created_at)}</div>}
                        </div>
                        <span style={{fontSize:13,fontWeight:800,color:'#059669'}}>{fmt(p.amount)}</span>
                      </div>
                    ))}
                    {selected.order_payments.length === 0 && (
                      <div style={{padding:14,fontSize:13,color:'rgba(10,10,14,0.40)',textAlign:'center'}}>Sin pagos registrados</div>
                    )}
                  </div>

                  {isApartado && pending > 0 && (
                    <>
                      <div className="abono-form">
                        <select className="abono-select" value={abonoMethod} onChange={e => setAbonoMethod(e.target.value as any)}>
                          {METHODS.map(m => <option key={m} value={m}>{METHOD_LABEL[m]}</option>)}
                        </select>
                        <input className="abono-input" type="number" min="0" step="0.01"
                          placeholder={`Máx ${fmt(pending)}`} value={abonoAmount}
                          onChange={e => setAbonoAmount(e.target.value)} />
                        <button className="abono-btn" disabled={savingAbono || !abonoAmount} onClick={addAbono}>
                          {savingAbono ? '…' : 'Abonar'}
                        </button>
                      </div>
                      {abonoError && <div className="alert-err">{abonoError}</div>}
                    </>
                  )}

                  {isApartado && (
                    <button className="liquidar-btn" onClick={liquidar}>
                      {pending <= 0 ? '✓ Marcar como pagado' : `Liquidar (${fmt(pending)} pendiente)`}
                    </button>
                  )}
                </div>

                {/* Envío */}
                {selected.order_shipping?.length > 0 && (
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
        )
      })()}
    </>
  )
}
