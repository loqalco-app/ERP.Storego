'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import { createClient } from '@/lib/supabase/client'

interface OrderItem { product_name: string; variant_name: string; quantity: number; unit_price: number; cost_price: number }
interface OrderPayment { method: string; amount: number }
interface Order { id: string; folio: string; status: string; total: number; created_at: string; customers: { full_name: string } | null; order_items: OrderItem[]; order_payments: OrderPayment[] }
interface Expense { id: string; date: string; category: string; description: string; amount: number; created_at: string }
interface Apartado { id: string; folio: string; total: number; customers: { full_name: string } | null; order_payments: { amount: number }[] }

const CATS: Record<string, string> = {
  gasto_operativo: 'Gasto operativo',
  compra_inventario: 'Compra de inventario',
  reembolso: 'Reembolso',
  nomina: 'Nómina',
  servicio: 'Servicio',
  otro: 'Otro',
}

const PERIODOS = [
  { key: 'hoy', label: 'Hoy' },
  { key: 'semana', label: 'Semana' },
  { key: 'mes', label: 'Este mes' },
  { key: 'año', label: 'Este año' },
]

const fmt = (n: number) => Number(n).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })
const pct = (a: number, b: number) => b === 0 ? 0 : Math.round(a / b * 100 * 10) / 10

export default function FinanzasClient({
  orgId, userId, orders, expenses: initialExpenses, apartados, periodo, desde, hasta,
}: {
  orgId: string; userId: string
  orders: Order[]; expenses: Expense[]; apartados: Apartado[]
  periodo: string; desde: string; hasta: string
}) {
  const router = useRouter()
  const supabase = createClient()

  const [expenses, setExpenses] = useState<Expense[]>(initialExpenses)
  const [showExpForm, setShowExpForm] = useState(false)
  const [expForm, setExpForm] = useState({ category: 'gasto_operativo', description: '', amount: '', date: desde })
  const [savingExp, setSavingExp] = useState(false)
  const [expError, setExpError] = useState('')

  // ── KPIs ─────────────────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const ventasNetas = orders.reduce((s, o) => s + Number(o.total), 0)
    const cmv = orders.reduce((s, o) => s + (o.order_items ?? []).reduce((si, i) => si + Number(i.cost_price || 0) * i.quantity, 0), 0)
    const utilidadBruta = ventasNetas - cmv
    const margen = pct(utilidadBruta, ventasNetas)
    const gastosTotales = expenses.reduce((s, e) => s + Number(e.amount), 0)
    const ingresosNetos = utilidadBruta - gastosTotales

    // Pagos por método
    const byMethod: Record<string, number> = {}
    orders.forEach(o => (o.order_payments ?? []).forEach(p => {
      byMethod[p.method] = (byMethod[p.method] ?? 0) + Number(p.amount)
    }))

    return { ventasNetas, cmv, utilidadBruta, margen, gastosTotales, ingresosNetos, byMethod }
  }, [orders, expenses])

  // ── Cuentas por cobrar ────────────────────────────────────────────────────────
  const cxc = useMemo(() => apartados.map(a => {
    const pagado = (a.order_payments ?? []).reduce((s, p) => s + Number(p.amount), 0)
    return { ...a, pagado, pendiente: Number(a.total) - pagado }
  }).filter(a => a.pendiente > 0), [apartados])

  const totalCxC = cxc.reduce((s, a) => s + a.pendiente, 0)

  // ── Top productos ─────────────────────────────────────────────────────────────
  const topProductos = useMemo(() => {
    const map: Record<string, { name: string; qty: number; revenue: number; cost: number }> = {}
    orders.forEach(o => (o.order_items ?? []).forEach(i => {
      const k = i.product_name + ' · ' + i.variant_name
      if (!map[k]) map[k] = { name: k, qty: 0, revenue: 0, cost: 0 }
      map[k].qty += i.quantity
      map[k].revenue += i.unit_price * i.quantity
      map[k].cost += Number(i.cost_price || 0) * i.quantity
    }))
    return Object.values(map)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10)
      .map(p => ({ ...p, utilidad: p.revenue - p.cost, margen: pct(p.revenue - p.cost, p.revenue) }))
  }, [orders])

  // ── Gastos por categoría ──────────────────────────────────────────────────────
  const gastosPorCat = useMemo(() => {
    const map: Record<string, number> = {}
    expenses.forEach(e => { map[e.category] = (map[e.category] ?? 0) + Number(e.amount) })
    return Object.entries(map).sort((a, b) => b[1] - a[1])
  }, [expenses])

  // ── Add expense ───────────────────────────────────────────────────────────────
  async function saveExpense() {
    const amount = parseFloat(expForm.amount)
    if (!expForm.description.trim() || !amount || amount <= 0) { setExpError('Completa todos los campos'); return }
    setSavingExp(true); setExpError('')
    const { data, error } = await supabase
      .from('finance_expenses')
      .insert({ organization_id: orgId, created_by: userId, ...expForm, amount })
      .select('id, date, category, description, amount, created_at')
      .single()
    setSavingExp(false)
    if (error || !data) { setExpError('Error al guardar el gasto'); return }
    setExpenses(prev => [data as Expense, ...prev])
    setExpForm({ category: 'gasto_operativo', description: '', amount: '', date: desde })
    setShowExpForm(false)
  }

  async function deleteExpense(id: string) {
    await supabase.from('finance_expenses').delete().eq('id', id)
    setExpenses(prev => prev.filter(e => e.id !== id))
  }

  function changePeriodo(p: string) {
    router.push(`/finanzas?periodo=${p}`)
  }

  const metodoLabel: Record<string, string> = { efectivo: 'Efectivo', tarjeta: 'Tarjeta', transferencia: 'Transferencia', otro: 'Otro' }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        body{background:var(--bg,#ECEEF2);font-family:'Inter',-apple-system,sans-serif;-webkit-font-smoothing:antialiased}
        .fin-topbar{position:sticky;top:0;z-index:100;background:rgba(236,238,242,0.82);-webkit-backdrop-filter:blur(20px) saturate(160%);backdrop-filter:blur(20px) saturate(160%);padding:max(env(safe-area-inset-top,0px),20px) 20px 16px;display:flex;align-items:center;gap:12px}
        @media(min-width:768px){.fin-topbar{padding:max(env(safe-area-inset-top,0px),20px) 40px 20px}}
        .fin-title{font-size:22px;font-weight:800;color:#0A0A0E;letter-spacing:-.4px}
        @media(min-width:768px){.fin-title{font-size:26px}}
        .fin-content{padding:16px 20px calc(var(--nav-h,88px) + env(safe-area-inset-bottom,0px) + 16px)}
        @media(min-width:768px){.fin-content{padding:16px 40px calc(var(--nav-h,88px) + env(safe-area-inset-bottom,0px) + 16px)}}

        /* periodo chips */
        .periodo-row{display:flex;gap:8px;margin-bottom:20px;overflow-x:auto;scrollbar-width:none}
        .periodo-row::-webkit-scrollbar{display:none}
        .periodo-chip{padding:7px 18px;border-radius:50px;border:1.5px solid rgba(0,0,0,0.10);background:none;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;color:rgba(10,10,14,0.55);white-space:nowrap;transition:all .15s;flex-shrink:0}
        .periodo-chip.on{border-color:#2563EB;background:rgba(37,99,235,0.08);color:#1D4ED8}

        /* KPI grid */
        .kpi-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:24px}
        @media(min-width:640px){.kpi-grid{grid-template-columns:repeat(3,1fr)}}
        @media(min-width:1024px){.kpi-grid{grid-template-columns:repeat(6,1fr)}}
        .kpi-card{background:var(--bg,#ECEEF2);border-radius:20px;padding:16px 16px 14px;box-shadow:6px 6px 16px rgba(0,0,0,0.07),-4px -4px 12px rgba(255,255,255,0.9)}
        .kpi-card.accent{background:linear-gradient(145deg,#1D4ED8,#2563EB);box-shadow:0 8px 24px rgba(29,78,216,0.28)}
        .kpi-card.green{background:linear-gradient(145deg,#059669,#10B981);box-shadow:0 8px 24px rgba(5,150,105,0.25)}
        .kpi-label{font-size:10px;font-weight:700;color:rgba(10,10,14,0.42);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px;white-space:nowrap}
        .kpi-card.accent .kpi-label,.kpi-card.green .kpi-label{color:rgba(255,255,255,0.65)}
        .kpi-val{font-size:20px;font-weight:900;color:#0A0A0E;letter-spacing:-.5px;line-height:1}
        @media(min-width:768px){.kpi-val{font-size:22px}}
        .kpi-card.accent .kpi-val,.kpi-card.green .kpi-val{color:white}
        .kpi-sub{font-size:11px;font-weight:600;margin-top:4px}

        /* section header */
        .sec-hd{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}
        .sec-title{font-size:13px;font-weight:800;color:#0A0A0E;text-transform:uppercase;letter-spacing:.05em}
        .sec-btn{padding:6px 14px;border-radius:50px;border:1.5px solid rgba(0,0,0,0.10);background:none;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;color:#1D4ED8;border-color:rgba(37,99,235,0.25);background:rgba(37,99,235,0.06)}

        /* table */
        .fin-table{background:var(--bg,#ECEEF2);border-radius:20px;overflow:hidden;box-shadow:6px 6px 16px rgba(0,0,0,0.07),-4px -4px 12px rgba(255,255,255,0.9);margin-bottom:24px}
        .fin-row{display:flex;align-items:center;gap:10px;padding:12px 16px;border-top:1px solid rgba(0,0,0,0.04)}
        .fin-row:first-child{border-top:none}
        .fin-row-name{font-size:12px;font-weight:700;color:#0A0A0E;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .fin-row-sub{font-size:10px;color:rgba(10,10,14,0.42);margin-top:1px}
        .fin-right{display:flex;flex-direction:column;align-items:flex-end;flex-shrink:0}
        .fin-amt{font-size:13px;font-weight:800;color:#0A0A0E}
        .fin-pct{font-size:10px;font-weight:700;color:rgba(10,10,14,0.40)}
        .fin-green{color:#059669}
        .fin-red{color:#DC2626}
        .fin-empty{padding:24px;text-align:center;color:rgba(10,10,14,0.35);font-size:13px;font-weight:600}

        /* expense form */
        .exp-form{background:rgba(0,0,0,0.02);border:1.5px solid rgba(0,0,0,0.08);border-radius:18px;padding:16px;margin-bottom:16px}
        .exp-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px}
        .exp-input{width:100%;padding:10px 12px;border:1.5px solid rgba(0,0,0,0.08);border-radius:12px;background:rgba(0,0,0,0.03);font-size:13px;font-family:inherit;color:#0A0A0E;outline:none}
        .exp-input:focus{border-color:#2563EB}
        .exp-btns{display:flex;gap:8px;margin-top:10px}
        .exp-save{flex:1;padding:10px;border-radius:12px;border:none;background:linear-gradient(145deg,#1D4ED8,#2563EB);color:white;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit}
        .exp-save:disabled{opacity:.5}
        .exp-cancel{padding:10px 16px;border-radius:12px;border:1.5px solid rgba(0,0,0,0.10);background:none;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;color:rgba(10,10,14,0.55)}
        .alert-err{background:rgba(220,38,38,0.07);border:1px solid rgba(220,38,38,0.15);border-radius:12px;padding:8px 12px;font-size:12px;font-weight:600;color:#991b1b;margin-top:8px}
        .del-btn{background:none;border:none;cursor:pointer;color:rgba(10,10,14,0.25);padding:4px;line-height:1;flex-shrink:0}
        .del-btn:hover{color:#DC2626}

        /* periodo label */
        .periodo-lbl{font-size:11px;color:rgba(10,10,14,0.40);font-weight:600;margin-bottom:20px}

        /* métodos pago */
        .method-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:24px}
        @media(min-width:640px){.method-grid{grid-template-columns:repeat(4,1fr)}}
        .method-card{background:var(--bg,#ECEEF2);border-radius:16px;padding:14px;box-shadow:4px 4px 12px rgba(0,0,0,0.06),-3px -3px 8px rgba(255,255,255,0.90)}
        .method-lbl{font-size:10px;font-weight:700;color:rgba(10,10,14,0.42);text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px}
        .method-val{font-size:16px;font-weight:800;color:#0A0A0E}

        /* cxc */
        .cxc-total{font-size:13px;font-weight:600;color:rgba(10,10,14,0.55);margin-bottom:10px}
        .cxc-total span{color:#D97706;font-weight:800}
      `}</style>

      <Sidebar active="finanzas" />

      <div className="fin-topbar">
        <div className="fin-title">Finanzas</div>
        <div style={{marginLeft:'auto',fontSize:11,fontWeight:700,color:'rgba(10,10,14,0.40)'}}>
          {desde === hasta ? desde : `${desde} → ${hasta}`}
        </div>
      </div>

      <div className="fin-content">
        {/* Selector de periodo */}
        <div className="periodo-row">
          {PERIODOS.map(p => (
            <button key={p.key} className={`periodo-chip${periodo===p.key?' on':''}`} onClick={() => changePeriodo(p.key)}>
              {p.label}
            </button>
          ))}
        </div>

        {/* KPI cards */}
        <div className="kpi-grid">
          <div className="kpi-card accent">
            <div className="kpi-label">Ventas netas</div>
            <div className="kpi-val">{fmt(kpis.ventasNetas)}</div>
            <div className="kpi-sub" style={{color:'rgba(255,255,255,0.65)'}}>{orders.length} órdenes</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Costo merc. vendida</div>
            <div className="kpi-val">{fmt(kpis.cmv)}</div>
            <div className="kpi-sub" style={{color:'rgba(10,10,14,0.38)'}}>CMV</div>
          </div>
          <div className={`kpi-card${kpis.utilidadBruta >= 0 ? ' green' : ''}`}>
            <div className="kpi-label">Utilidad bruta</div>
            <div className="kpi-val">{fmt(kpis.utilidadBruta)}</div>
            <div className="kpi-sub" style={{color: kpis.utilidadBruta >= 0 ? 'rgba(255,255,255,0.65)' : '#DC2626'}}>
              {kpis.margen}% margen
            </div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Gastos totales</div>
            <div className="kpi-val fin-red">{fmt(kpis.gastosTotales)}</div>
            <div className="kpi-sub" style={{color:'rgba(10,10,14,0.38)'}}>{expenses.length} registros</div>
          </div>
          <div className={`kpi-card${kpis.ingresosNetos >= 0 ? '' : ''}`}>
            <div className="kpi-label">Ingresos netos</div>
            <div className={`kpi-val ${kpis.ingresosNetos >= 0 ? 'fin-green' : 'fin-red'}`}>{fmt(kpis.ingresosNetos)}</div>
            <div className="kpi-sub" style={{color:'rgba(10,10,14,0.38)'}}>Utilidad − Gastos</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">C×C · Apartados</div>
            <div className="kpi-val" style={{color:'#D97706'}}>{fmt(totalCxC)}</div>
            <div className="kpi-sub" style={{color:'rgba(10,10,14,0.38)'}}>{cxc.length} pendientes</div>
          </div>
        </div>

        {/* Pagos por método */}
        {Object.keys(kpis.byMethod).length > 0 && (
          <>
            <div className="sec-hd"><div className="sec-title">Ingresos por método de pago</div></div>
            <div className="method-grid">
              {Object.entries(kpis.byMethod).map(([m, v]) => (
                <div key={m} className="method-card">
                  <div className="method-lbl">{metodoLabel[m] ?? m}</div>
                  <div className="method-val">{fmt(v)}</div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Top productos */}
        <div className="sec-hd"><div className="sec-title">Productos más vendidos</div></div>
        <div className="fin-table" style={{marginBottom:24}}>
          {topProductos.length === 0 ? (
            <div className="fin-empty">Sin ventas en este periodo</div>
          ) : topProductos.map((p, i) => (
            <div key={i} className="fin-row">
              <div style={{width:24,height:24,borderRadius:8,background:'rgba(37,99,235,0.08)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:800,color:'#1D4ED8',flexShrink:0}}>
                {i + 1}
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div className="fin-row-name">{p.name}</div>
                <div className="fin-row-sub">{p.qty} unidades · {p.margen}% margen</div>
              </div>
              <div className="fin-right">
                <div className="fin-amt">{fmt(p.revenue)}</div>
                {p.cost > 0 && <div className="fin-pct fin-green">+{fmt(p.utilidad)} utilidad</div>}
              </div>
            </div>
          ))}
        </div>

        {/* Cuentas por cobrar */}
        {cxc.length > 0 && (
          <>
            <div className="sec-hd">
              <div className="sec-title">Cuentas por cobrar</div>
            </div>
            <div className="cxc-total">Total pendiente: <span>{fmt(totalCxC)}</span></div>
            <div className="fin-table" style={{marginBottom:24}}>
              {cxc.map(a => (
                <div key={a.id} className="fin-row">
                  <div style={{width:60,fontSize:11,fontWeight:800,color:'#D97706',background:'rgba(217,119,6,0.08)',borderRadius:8,padding:'4px 7px',textAlign:'center',flexShrink:0}}>
                    {a.folio}
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div className="fin-row-name">{a.customers?.full_name ?? 'Sin cliente'}</div>
                    <div className="fin-row-sub">Pagado: {fmt(a.pagado)} de {fmt(a.total)}</div>
                  </div>
                  <div className="fin-right">
                    <div className="fin-amt" style={{color:'#D97706'}}>{fmt(a.pendiente)}</div>
                    <div className="fin-pct">pendiente</div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Gastos */}
        <div className="sec-hd">
          <div className="sec-title">Gastos y egresos</div>
          <button className="sec-btn" onClick={() => setShowExpForm(v => !v)}>
            {showExpForm ? 'Cancelar' : '+ Agregar gasto'}
          </button>
        </div>

        {showExpForm && (
          <div className="exp-form">
            <div className="exp-grid">
              <select className="exp-input" value={expForm.category} onChange={e => setExpForm(p => ({...p, category: e.target.value}))}>
                {Object.entries(CATS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <input className="exp-input" type="date" value={expForm.date} onChange={e => setExpForm(p => ({...p, date: e.target.value}))} />
            </div>
            <input className="exp-input" style={{marginBottom:10}} placeholder="Descripción *" value={expForm.description} onChange={e => setExpForm(p => ({...p, description: e.target.value}))} />
            <input className="exp-input" type="number" min="0" step="0.01" placeholder="Monto *" value={expForm.amount} onChange={e => setExpForm(p => ({...p, amount: e.target.value}))} />
            {expError && <div className="alert-err">{expError}</div>}
            <div className="exp-btns">
              <button className="exp-cancel" onClick={() => { setShowExpForm(false); setExpError('') }}>Cancelar</button>
              <button className="exp-save" disabled={savingExp} onClick={saveExpense}>
                {savingExp ? 'Guardando…' : 'Guardar gasto'}
              </button>
            </div>
          </div>
        )}

        {/* Gastos por categoría */}
        {gastosPorCat.length > 0 && (
          <div className="fin-table" style={{marginBottom:12}}>
            {gastosPorCat.map(([cat, total]) => (
              <div key={cat} className="fin-row">
                <div style={{flex:1}}>
                  <div className="fin-row-name">{CATS[cat] ?? cat}</div>
                </div>
                <div className="fin-amt fin-red">{fmt(total)}</div>
              </div>
            ))}
          </div>
        )}

        {/* Lista de gastos */}
        <div className="fin-table">
          {expenses.length === 0 ? (
            <div className="fin-empty">Sin gastos registrados en este periodo</div>
          ) : expenses.map(e => (
            <div key={e.id} className="fin-row">
              <div style={{flex:1,minWidth:0}}>
                <div className="fin-row-name">{e.description}</div>
                <div className="fin-row-sub">{CATS[e.category] ?? e.category} · {e.date}</div>
              </div>
              <div className="fin-amt fin-red" style={{marginRight:8}}>{fmt(e.amount)}</div>
              <button className="del-btn" onClick={() => deleteExpense(e.id)} title="Eliminar">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
