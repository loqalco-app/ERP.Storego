'use client'

import { useState, useMemo, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import DateRangeCalendar from '@/components/DateRangeCalendar'
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

const CAT_META: Record<string, { color: string; bg: string; icon: ReactNode }> = {
  gasto_operativo:   { color: '#D97706', bg: 'rgba(217,119,6,0.10)',  icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 7h-9a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/><path d="M4 3v14a2 2 0 0 0 2 2h9"/></svg> },
  compra_inventario: { color: '#DC2626', bg: 'rgba(220,38,38,0.10)',  icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg> },
  reembolso:         { color: '#7C3AED', bg: 'rgba(124,58,237,0.10)', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg> },
  nomina:            { color: '#0891B2', bg: 'rgba(8,145,178,0.10)',  icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> },
  servicio:          { color: '#2563EB', bg: 'rgba(37,99,235,0.10)', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg> },
  otro:              { color: '#6B7280', bg: 'rgba(107,114,128,0.10)',icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg> },
}

const PERIODOS = [
  { key: 'hoy', label: 'Hoy' },
  { key: 'semana', label: 'Semana' },
  { key: 'mes', label: 'Este mes' },
  { key: 'año', label: 'Este año' },
  { key: 'personalizado', label: 'Personalizado' },
]

const fmt = (n: number) => Number(n).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })
const fmtPct = (a: number, b: number) => b === 0 ? '—' : (Math.round(a / b * 1000) / 10).toFixed(1) + '%'

const METHOD_LABEL: Record<string, string> = { efectivo: 'Efectivo', tarjeta: 'Tarjeta', transferencia: 'Transferencia', otro: 'Otro' }

export default function FinanzasClient({
  orgId, userId, orders, expenses: initialExpenses, apartados, periodo, desde, hasta,
}: {
  orgId: string; userId: string
  orders: Order[]; expenses: Expense[]; apartados: Apartado[]
  periodo: string; desde: string; hasta: string
}) {
  const router = useRouter()
  const supabase = createClient()

  const [tab, setTab] = useState<'resumen'|'productos'|'gastos'|'cobros'>('resumen')
  const [expenses, setExpenses] = useState<Expense[]>(initialExpenses)
  const [showExpForm, setShowExpForm] = useState(false)
  const [expForm, setExpForm] = useState({ category: 'gasto_operativo', description: '', amount: '', date: desde })
  const [savingExp, setSavingExp] = useState(false)
  const [expError, setExpError] = useState('')


  // ── KPIs ─────────────────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const ventasNetas = orders.reduce((s, o) => s + Number(o.total), 0)
    const cmv = orders.reduce((s, o) =>
      s + (o.order_items ?? []).reduce((si, i) => si + Number(i.cost_price || 0) * i.quantity, 0), 0)
    const utilidadBruta = ventasNetas - cmv
    const gastosTotales = expenses.reduce((s, e) => s + Number(e.amount), 0)
    const ingresosNetos = utilidadBruta - gastosTotales

    const byMethod: Record<string, number> = {}
    orders.forEach(o => (o.order_payments ?? []).forEach(p => {
      byMethod[p.method] = (byMethod[p.method] ?? 0) + Number(p.amount)
    }))

    return { ventasNetas, cmv, utilidadBruta, gastosTotales, ingresosNetos, byMethod }
  }, [orders, expenses])

  // ── Barra de recuperación de inversión ───────────────────────────────────────
  const recoveryPct = kpis.ventasNetas === 0 ? 0
    : Math.min(100, Math.round(kpis.cmv / kpis.ventasNetas * 100))
  const profitPct = kpis.ventasNetas === 0 ? 0
    : Math.min(100, Math.round(kpis.utilidadBruta / kpis.ventasNetas * 100))

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
      const k = i.product_name + (i.variant_name ? ' · ' + i.variant_name : '')
      if (!map[k]) map[k] = { name: k, qty: 0, revenue: 0, cost: 0 }
      map[k].qty += i.quantity
      map[k].revenue += i.unit_price * i.quantity
      map[k].cost += Number(i.cost_price || 0) * i.quantity
    }))
    return Object.values(map)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10)
      .map(p => ({ ...p, utilidad: p.revenue - p.cost, margenPct: fmtPct(p.revenue - p.cost, p.revenue) }))
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
    if (error || !data) { setExpError('Error al guardar. ¿Ejecutaste el SQL de migración en Supabase?'); return }
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

  function applyCustomRange(d: string, h: string) {
    router.push(`/finanzas?periodo=personalizado&desde=${d}&hasta=${h}`)
  }

  // ── Export modal ─────────────────────────────────────────────────────────────
  const [showExportModal, setShowExportModal] = useState(false)
  const [exportSections, setExportSections] = useState({ resumen: true, productos: false, gastos: false, cobros: false })
  const [exportDesde, setExportDesde] = useState(desde)
  const [exportHasta, setExportHasta] = useState(hasta)
  const [exporting, setExporting] = useState(false)

  function openExportModal() {
    setExportSections({ resumen: tab === 'resumen', productos: tab === 'productos', gastos: tab === 'gastos', cobros: tab === 'cobros' })
    setExportDesde(desde); setExportHasta(hasta)
    setShowExportModal(true)
  }

  function downloadCSV(filename: string, header: string[], rows: (string | number)[][]) {
    const csv = [header, ...rows].map(r => r.map(f => `"${String(f).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = filename
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  async function runExport() {
    setExporting(true)
    let expOrders = orders
    let expExpenses = expenses

    // If the chosen export range differs from what's loaded, fetch fresh data for it
    if (exportDesde !== desde || exportHasta !== hasta) {
      const desdeTs = `${exportDesde}T00:00:00`
      const hastaTs = `${exportHasta}T23:59:59`
      const [{ data: o }, { data: e }] = await Promise.all([
        supabase.from('orders').select(`
          id, folio, status, total, created_at,
          customers(full_name),
          order_items(product_name, variant_name, quantity, unit_price, cost_price),
          order_payments(method, amount)
        `).eq('organization_id', orgId).neq('status', 'cancelado').gte('created_at', desdeTs).lte('created_at', hastaTs).order('created_at', { ascending: false }),
        supabase.from('finance_expenses').select('id, date, category, description, amount, created_at').eq('organization_id', orgId).gte('date', exportDesde).lte('date', exportHasta).order('date', { ascending: false }),
      ])
      expOrders = (o ?? []) as unknown as Order[]
      expExpenses = (e ?? []) as Expense[]
    }

    const rangeLabel = `${exportDesde}_a_${exportHasta}`
    const ventasNetas = expOrders.reduce((s, o) => s + Number(o.total), 0)
    const cmv = expOrders.reduce((s, o) => s + (o.order_items ?? []).reduce((si, i) => si + Number(i.cost_price || 0) * i.quantity, 0), 0)
    const utilidadBruta = ventasNetas - cmv
    const gastosTotalesExp = expExpenses.reduce((s, e) => s + Number(e.amount), 0)
    const ingresosNetos = utilidadBruta - gastosTotalesExp

    if (exportSections.resumen) {
      downloadCSV(`resumen_${rangeLabel}.csv`, ['Concepto', 'Monto'], [
        ['Ventas netas', ventasNetas.toFixed(2)],
        ['Costo de mercancía (CMV)', cmv.toFixed(2)],
        ['Utilidad bruta', utilidadBruta.toFixed(2)],
        ['Gastos operativos', gastosTotalesExp.toFixed(2)],
        ['Ingresos netos', ingresosNetos.toFixed(2)],
      ])
    }
    if (exportSections.productos) {
      const map: Record<string, { name: string; qty: number; revenue: number; cost: number }> = {}
      expOrders.forEach(o => (o.order_items ?? []).forEach(i => {
        const k = i.product_name + (i.variant_name ? ' · ' + i.variant_name : '')
        if (!map[k]) map[k] = { name: k, qty: 0, revenue: 0, cost: 0 }
        map[k].qty += i.quantity
        map[k].revenue += i.unit_price * i.quantity
        map[k].cost += Number(i.cost_price || 0) * i.quantity
      }))
      const rows = Object.values(map).sort((a, b) => b.revenue - a.revenue)
        .map(p => [p.name, p.qty, p.revenue.toFixed(2), p.cost.toFixed(2), (p.revenue - p.cost).toFixed(2)])
      downloadCSV(`productos_${rangeLabel}.csv`, ['Producto', 'Cantidad', 'Ingresos', 'Costo', 'Utilidad'], rows)
    }
    if (exportSections.gastos) {
      const rows = expExpenses.map(e => [e.date, CATS[e.category] ?? e.category, e.description, Number(e.amount).toFixed(2)])
      downloadCSV(`gastos_${rangeLabel}.csv`, ['Fecha', 'Categoría', 'Descripción', 'Monto'], rows)
    }
    if (exportSections.cobros) {
      const rows = cxc.map(a => [a.folio, a.customers?.full_name ?? 'Sin cliente', Number(a.total).toFixed(2), a.pagado.toFixed(2), a.pendiente.toFixed(2)])
      downloadCSV(`cobros_pendientes_${rangeLabel}.csv`, ['Folio', 'Cliente', 'Total', 'Pagado', 'Pendiente'], rows)
    }

    setExporting(false)
    setShowExportModal(false)
  }

  const hasCMV = kpis.cmv > 0

  return (
    <>
      <style>{`
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        body{background:var(--bg,#ECEEF2);font-family:'Inter',-apple-system,sans-serif;-webkit-font-smoothing:antialiased}
        .periodo-pills{display:flex;gap:4px;background:rgba(0,0,0,0.04);border-radius:14px;padding:3px}
        .periodo-pill{padding:6px 12px;border-radius:11px;border:none;background:transparent;font-size:12px;font-weight:700;color:rgba(10,10,14,0.45);cursor:pointer;font-family:inherit;white-space:nowrap}
        .periodo-pill.on{background:#ECEEF2;color:#1D4ED8;box-shadow:2px 2px 6px rgba(0,0,0,0.08),-1px -1px 4px rgba(255,255,255,0.9)}
        .fin-date{font-size:11px;font-weight:600;color:rgba(10,10,14,0.35);white-space:nowrap;flex-shrink:0}

        /* ── CASCADA FINANCIERA ── */
        .cascade{background:var(--bg,#ECEEF2);border-radius:24px;box-shadow:6px 6px 16px rgba(0,0,0,0.07),-4px -4px 12px rgba(255,255,255,0.9);padding:20px;margin-bottom:24px}
        .cascade-top{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px}
        .cascade-label{font-size:11px;font-weight:700;color:rgba(10,10,14,0.38);text-transform:uppercase;letter-spacing:.07em;margin-bottom:4px}
        .cascade-val{font-size:28px;font-weight:900;color:#0A0A0E;letter-spacing:-.8px;line-height:1}
        @media(min-width:768px){.cascade-val{font-size:34px}}
        .cascade-sub{font-size:12px;font-weight:600;color:rgba(10,10,14,0.40);margin-top:4px}
        .cascade-badge{padding:6px 14px;border-radius:50px;font-size:13px;font-weight:800}
        .cascade-divider{height:1px;background:rgba(0,0,0,0.07);margin:16px 0}

        /* barra de inversión */
        .inv-bar-wrap{margin:12px 0}
        .inv-bar-track{height:12px;border-radius:6px;background:rgba(0,0,0,0.07);overflow:hidden;display:flex;margin-bottom:8px}
        .inv-bar-cost{height:100%;border-radius:6px 0 0 6px;background:linear-gradient(90deg,#F59E0B,#D97706);transition:width .6s cubic-bezier(0.34,1.56,0.64,1)}
        .inv-bar-profit{height:100%;border-radius:0 6px 6px 0;background:linear-gradient(90deg,#10B981,#059669);transition:width .6s}
        .inv-bar-labels{display:flex;justify-content:space-between;align-items:center}
        .inv-legend{display:flex;align-items:center;gap:6px;font-size:11px;font-weight:700}
        .inv-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0}

        /* líneas de desglose */
        .breakdown{display:flex;flex-direction:column;gap:0}
        .bk-line{display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid rgba(0,0,0,0.05)}
        .bk-line:last-child{border-bottom:none}
        .bk-left{display:flex;align-items:center;gap:8px}
        .bk-sign{width:20px;height:20px;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;flex-shrink:0}
        .bk-name{font-size:13px;font-weight:600;color:#0A0A0E}
        .bk-desc{font-size:11px;color:rgba(10,10,14,0.40);margin-top:1px}
        .bk-val{font-size:14px;font-weight:800;text-align:right}
        .bk-pct{font-size:10px;font-weight:700;color:rgba(10,10,14,0.38);margin-top:1px;text-align:right}
        .result-line{display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-radius:16px;margin-top:12px}

        /* small KPI row */
        .kpi-row{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:24px}
        @media(min-width:640px){.kpi-row{grid-template-columns:repeat(4,1fr)}}
        .kpi-card{background:var(--bg,#ECEEF2);border-radius:18px;padding:14px;box-shadow:4px 4px 12px rgba(0,0,0,0.06),-3px -3px 8px rgba(255,255,255,0.90)}
        .kpi-lbl{font-size:10px;font-weight:700;color:rgba(10,10,14,0.38);text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px}
        .kpi-v{font-size:16px;font-weight:900;color:#0A0A0E;letter-spacing:-.3px}
        .kpi-s{font-size:10px;font-weight:600;color:rgba(10,10,14,0.38);margin-top:3px}

        /* section header */
        .sec-hd{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}
        .sec-title{font-size:11px;font-weight:800;color:rgba(10,10,14,0.40);text-transform:uppercase;letter-spacing:.07em}
        .sec-btn{padding:6px 14px;border-radius:50px;border:1.5px solid rgba(37,99,235,0.25);background:rgba(37,99,235,0.06);font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;color:#1D4ED8;display:flex;align-items:center;gap:6px}
        .sec-btn-outline{border-color:rgba(0,0,0,0.10);background:transparent;color:rgba(10,10,14,0.55)}
        .sec-btn-outline:disabled{opacity:.4;cursor:not-allowed}

        /* category summary cards */
        .cat-card-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-bottom:16px}
        .cat-card{background:var(--bg,#ECEEF2);border-radius:18px;padding:14px;box-shadow:4px 4px 12px rgba(0,0,0,0.06),-3px -3px 8px rgba(255,255,255,0.90)}
        .cat-card-icon{width:32px;height:32px;border-radius:10px;display:flex;align-items:center;justify-content:center;margin-bottom:10px}
        .cat-card-lbl{font-size:11px;font-weight:700;color:rgba(10,10,14,0.50);margin-bottom:4px}
        .cat-card-amt{font-size:17px;font-weight:900;color:#0A0A0E;letter-spacing:-.3px;margin-bottom:10px}
        .cat-card-bar-track{height:5px;border-radius:3px;background:rgba(0,0,0,0.06);overflow:hidden;margin-bottom:6px}
        .cat-card-bar{height:100%;border-radius:3px;transition:width .5s}
        .cat-card-pct{font-size:10px;font-weight:700;color:rgba(10,10,14,0.35)}

        /* structured expense table */
        .exp-table{background:var(--bg,#ECEEF2);border-radius:20px;overflow:hidden;box-shadow:6px 6px 16px rgba(0,0,0,0.07),-4px -4px 12px rgba(255,255,255,0.9)}
        .exp-thead{display:grid;grid-template-columns:90px 150px 1fr 110px 32px;gap:10px;padding:10px 16px;font-size:10px;font-weight:800;color:rgba(10,10,14,0.35);text-transform:uppercase;letter-spacing:.06em;border-bottom:1px solid rgba(0,0,0,0.06)}
        @media(max-width:768px){.exp-thead{display:none}}
        .exp-row{display:grid;grid-template-columns:90px 150px 1fr 110px 32px;gap:10px;align-items:center;padding:12px 16px;border-top:1px solid rgba(0,0,0,0.04)}
        .exp-row:first-child{border-top:none}
        @media(max-width:768px){
          .exp-row{grid-template-columns:1fr auto;grid-template-rows:auto auto;row-gap:6px}
          .exp-cell-date{grid-column:1;order:3;font-size:10px}
          .exp-cell-desc{grid-column:1/3;order:1;font-weight:700}
          .exp-row span:nth-child(2){order:2}
          .exp-cell-amt{order:4;text-align:right!important}
          .exp-row .del-btn{order:5}
        }
        .exp-cell-date{font-size:12px;font-weight:600;color:rgba(10,10,14,0.55)}
        .exp-cat-badge{display:inline-flex;padding:3px 9px;border-radius:50px;font-size:10.5px;font-weight:700;white-space:nowrap}
        .exp-cell-desc{font-size:13px;font-weight:600;color:#0A0A0E;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .exp-cell-amt{font-size:13px;font-weight:800;color:#DC2626;text-align:right}

        /* tables */
        .fin-table{background:var(--bg,#ECEEF2);border-radius:20px;overflow:hidden;box-shadow:6px 6px 16px rgba(0,0,0,0.07),-4px -4px 12px rgba(255,255,255,0.9);margin-bottom:20px}
        .fin-row{display:flex;align-items:center;gap:10px;padding:12px 16px;border-top:1px solid rgba(0,0,0,0.04)}
        .fin-row:first-child{border-top:none}
        .fin-row-name{font-size:12px;font-weight:700;color:#0A0A0E;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .fin-row-sub{font-size:10px;color:rgba(10,10,14,0.42);margin-top:1px}
        .fin-right{display:flex;flex-direction:column;align-items:flex-end;flex-shrink:0}
        .fin-amt{font-size:13px;font-weight:800;color:#0A0A0E}
        .fin-pct{font-size:10px;font-weight:700;color:rgba(10,10,14,0.40)}
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

        .no-cmv{background:rgba(217,119,6,0.06);border:1.5px solid rgba(217,119,6,0.18);border-radius:16px;padding:12px 16px;font-size:12px;font-weight:600;color:#92400E;margin-bottom:16px;line-height:1.5}

        /* export button + modal */
        .export-btn{display:flex;align-items:center;gap:6px;padding:8px 16px;border-radius:14px;border:none;background:linear-gradient(145deg,#1D4ED8,#2563EB);color:white;font-size:12.5px;font-weight:700;cursor:pointer;font-family:inherit;white-space:nowrap;flex-shrink:0}
        .exp-modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.40);z-index:900;display:flex;align-items:center;justify-content:center;padding:16px}
        .exp-modal{background:#ECEEF2;border-radius:24px;padding:24px;width:100%;max-width:420px;box-shadow:0 20px 50px rgba(0,0,0,0.25)}
        .exp-modal-title{font-size:18px;font-weight:800;color:#0A0A0E;margin-bottom:4px}
        .exp-modal-sub{font-size:12px;color:rgba(10,10,14,0.45);margin-bottom:18px}
        .exp-check-row{display:flex;align-items:center;gap:10px;padding:11px 12px;border-radius:12px;background:rgba(0,0,0,0.03);margin-bottom:8px;cursor:pointer}
        .exp-check-row input{width:17px;height:17px;accent-color:#2563EB;cursor:pointer}
        .exp-check-lbl{font-size:13px;font-weight:700;color:#0A0A0E}
        .exp-modal-section{font-size:11px;font-weight:700;color:rgba(10,10,14,0.38);text-transform:uppercase;letter-spacing:.06em;margin:18px 0 8px}
        .exp-modal-actions{display:flex;gap:10px;margin-top:20px}
        .exp-modal-cancel{flex:1;padding:12px;border-radius:14px;border:1.5px solid rgba(0,0,0,0.10);background:transparent;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;color:rgba(10,10,14,0.55)}
        .exp-modal-go{flex:2;padding:12px;border-radius:14px;border:none;background:linear-gradient(145deg,#1D4ED8,#2563EB);color:white;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit}
        .exp-modal-go:disabled{opacity:.5;cursor:not-allowed}
      `}</style>

      <Sidebar active="finanzas" />

      <div className="content">
        <div className="page-hd">
          <div className="page-hd-row">
            <div className="page-title">Finanzas</div>
            <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
              <div className="periodo-pills">
                {PERIODOS.filter(p => p.key !== 'personalizado').map(p => (
                  <button key={p.key} className={`periodo-pill${periodo===p.key?' on':''}`} onClick={() => changePeriodo(p.key)}>{p.label}</button>
                ))}
              </div>
              <DateRangeCalendar desde={desde} hasta={hasta} onApply={applyCustomRange} />
              <button className="export-btn" onClick={openExportModal}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                Exportar
              </button>
            </div>
          </div>
          <div className="page-hd-tabs">
            {([['resumen','Resumen'],['productos','Productos'],['gastos','Gastos'],['cobros','Cobros']] as const).map(([k,l]) => (
              <button key={k} className={`page-hd-tab${tab===k?' on':''}`} onClick={() => setTab(k)}>{l}</button>
            ))}
          </div>
        </div>

        {/* ── TAB: RESUMEN ── */}
        {tab === 'resumen' && <>

        {/* ── CASCADA: visión completa de dónde va cada peso ── */}
        <div className="cascade">
          <div className="cascade-top">
            <div>
              <div className="cascade-label">Ventas netas</div>
              <div className="cascade-val">{fmt(kpis.ventasNetas)}</div>
              <div className="cascade-sub">{orders.length} {orders.length === 1 ? 'orden' : 'órdenes'}</div>
            </div>
            <div className={`cascade-badge ${kpis.ingresosNetos >= 0 ? '' : ''}`}
              style={{
                background: kpis.ingresosNetos >= 0 ? 'rgba(5,150,105,0.10)' : 'rgba(220,38,38,0.10)',
                color: kpis.ingresosNetos >= 0 ? '#059669' : '#DC2626',
              }}
            >
              {kpis.ingresosNetos >= 0 ? '▲' : '▼'} {fmtPct(Math.abs(kpis.ingresosNetos), kpis.ventasNetas)} neto
            </div>
          </div>

          {/* Barra inversión vs ganancia */}
          {hasCMV && kpis.ventasNetas > 0 && (
            <div className="inv-bar-wrap">
              <div className="inv-bar-track">
                <div className="inv-bar-cost" style={{width:`${recoveryPct}%`}} />
                <div className="inv-bar-profit" style={{width:`${Math.max(0, profitPct)}%`}} />
              </div>
              <div className="inv-bar-labels">
                <div className="inv-legend">
                  <div className="inv-dot" style={{background:'#D97706'}} />
                  <span style={{fontSize:11,fontWeight:700,color:'rgba(10,10,14,0.55)'}}>Inversión {recoveryPct}%</span>
                </div>
                <div className="inv-legend">
                  <div className="inv-dot" style={{background:'#059669'}} />
                  <span style={{fontSize:11,fontWeight:700,color:'rgba(10,10,14,0.55)'}}>Ganancia {profitPct}%</span>
                </div>
              </div>
            </div>
          )}


          <div className="cascade-divider" />

          {/* Desglose línea por línea */}
          <div className="breakdown">
            <div className="bk-line">
              <div className="bk-left">
                <div className="bk-sign" style={{background:'rgba(5,150,105,0.10)',color:'#059669'}}>+</div>
                <div>
                  <div className="bk-name">Ventas netas</div>
                  <div className="bk-desc">Lo que cobraste a tus clientes</div>
                </div>
              </div>
              <div>
                <div className="bk-val" style={{color:'#059669'}}>{fmt(kpis.ventasNetas)}</div>
              </div>
            </div>

            <div className="bk-line">
              <div className="bk-left">
                <div className="bk-sign" style={{background:'rgba(217,119,6,0.10)',color:'#D97706'}}>−</div>
                <div>
                  <div className="bk-name">Costo de mercancía (CMV)</div>
                  <div className="bk-desc">Lo que te costaron los productos vendidos</div>
                </div>
              </div>
              <div>
                <div className="bk-val" style={{color:'#D97706'}}>{fmt(kpis.cmv)}</div>
                <div className="bk-pct">{fmtPct(kpis.cmv, kpis.ventasNetas)} de las ventas</div>
              </div>
            </div>

            {/* Resultado intermedio: utilidad bruta */}
            <div className="result-line" style={{background: kpis.utilidadBruta >= 0 ? 'rgba(5,150,105,0.06)' : 'rgba(220,38,38,0.06)'}}>
              <div>
                <div style={{fontSize:12,fontWeight:800,color:kpis.utilidadBruta >= 0 ? '#059669' : '#DC2626'}}>
                  = Utilidad bruta
                </div>
                <div style={{fontSize:11,color:'rgba(10,10,14,0.40)',marginTop:2}}>
                  Ganancia sobre el costo del producto · {fmtPct(kpis.utilidadBruta, kpis.ventasNetas)} margen
                </div>
              </div>
              <div style={{fontSize:18,fontWeight:900,color:kpis.utilidadBruta >= 0 ? '#059669' : '#DC2626',letterSpacing:'-.4px'}}>
                {fmt(kpis.utilidadBruta)}
              </div>
            </div>

            <div className="bk-line">
              <div className="bk-left">
                <div className="bk-sign" style={{background:'rgba(220,38,38,0.10)',color:'#DC2626'}}>−</div>
                <div>
                  <div className="bk-name">Gastos operativos</div>
                  <div className="bk-desc">Gastos, nómina, servicios registrados</div>
                </div>
              </div>
              <div>
                <div className="bk-val" style={{color:'#DC2626'}}>{fmt(kpis.gastosTotales)}</div>
                <div className="bk-pct">{fmtPct(kpis.gastosTotales, kpis.ventasNetas)} de las ventas</div>
              </div>
            </div>

            {/* Resultado final: ingresos netos */}
            <div className="result-line" style={{
              background: kpis.ingresosNetos >= 0 ? 'rgba(29,78,216,0.07)' : 'rgba(220,38,38,0.08)',
              marginTop: 8,
            }}>
              <div>
                <div style={{fontSize:12,fontWeight:800,color:kpis.ingresosNetos >= 0 ? '#1D4ED8' : '#DC2626'}}>
                  = Ingresos netos
                </div>
                <div style={{fontSize:11,color:'rgba(10,10,14,0.40)',marginTop:2}}>
                  Lo que realmente ganaste · {fmtPct(kpis.ingresosNetos, kpis.ventasNetas)} sobre ventas
                </div>
              </div>
              <div style={{fontSize:20,fontWeight:900,color:kpis.ingresosNetos >= 0 ? '#1D4ED8' : '#DC2626',letterSpacing:'-.5px'}}>
                {fmt(kpis.ingresosNetos)}
              </div>
            </div>
          </div>
        </div>

        {/* KPIs de métodos de pago */}
        <div className="kpi-row">
          {Object.entries(kpis.byMethod).map(([m, v]) => (
            <div key={m} className="kpi-card">
              <div className="kpi-lbl">{METHOD_LABEL[m] ?? m}</div>
              <div className="kpi-v">{fmt(v)}</div>
              <div className="kpi-s">ingresos</div>
            </div>
          ))}
        </div>

        </>}

        {/* ── TAB: PRODUCTOS ── */}
        {tab === 'productos' && <>
        <div className="sec-hd"><div className="sec-title">Productos más vendidos</div></div>
        <div className="fin-table">
          {topProductos.length === 0 ? (
            <div className="fin-empty">Sin ventas en este periodo</div>
          ) : topProductos.map((p, i) => (
            <div key={i} className="fin-row">
              <div style={{width:24,height:24,borderRadius:8,background:'rgba(37,99,235,0.08)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:800,color:'#1D4ED8',flexShrink:0}}>
                {i + 1}
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div className="fin-row-name">{p.name}</div>
                <div className="fin-row-sub">{p.qty} uds · {p.margenPct} margen</div>
              </div>
              <div className="fin-right">
                <div className="fin-amt">{fmt(p.revenue)}</div>
                {p.cost > 0 && <div className="fin-pct" style={{color:'#059669'}}>+{fmt(p.utilidad)}</div>}
              </div>
            </div>
          ))}
        </div>
        </>}

        {/* ── TAB: GASTOS ── */}
        {tab === 'gastos' && <>
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

        {gastosPorCat.length > 0 && (
          <div className="cat-card-grid">
            {gastosPorCat.map(([cat, total]) => {
              const meta = CAT_META[cat] ?? CAT_META.otro
              const pct = kpis.gastosTotales === 0 ? 0 : Math.round(total / kpis.gastosTotales * 100)
              return (
                <div key={cat} className="cat-card">
                  <div className="cat-card-icon" style={{background:meta.bg,color:meta.color}}>{meta.icon}</div>
                  <div className="cat-card-lbl">{CATS[cat] ?? cat}</div>
                  <div className="cat-card-amt">{fmt(total)}</div>
                  <div className="cat-card-bar-track"><div className="cat-card-bar" style={{width:`${pct}%`,background:meta.color}} /></div>
                  <div className="cat-card-pct">{pct}% del total</div>
                </div>
              )
            })}
          </div>
        )}

        <div className="exp-table">
          <div className="exp-thead">
            <span>Fecha</span><span>Categoría</span><span>Descripción</span><span style={{textAlign:'right'}}>Monto</span><span />
          </div>
          {expenses.length === 0 ? (
            <div className="fin-empty">Sin gastos registrados en este periodo</div>
          ) : expenses.map(e => {
            const meta = CAT_META[e.category] ?? CAT_META.otro
            return (
              <div key={e.id} className="exp-row">
                <span className="exp-cell-date">{e.date}</span>
                <span><span className="exp-cat-badge" style={{background:meta.bg,color:meta.color}}>{CATS[e.category] ?? e.category}</span></span>
                <span className="exp-cell-desc">{e.description}</span>
                <span className="exp-cell-amt">{fmt(e.amount)}</span>
                <button className="del-btn" onClick={() => deleteExpense(e.id)} title="Eliminar">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
            )
          })}
        </div>
        </>}

        {/* ── TAB: COBROS / CxC ── */}
        {tab === 'cobros' && <>
        <div className="sec-hd">
          <div className="sec-title">Cuentas por cobrar</div>
          <div style={{fontSize:12,fontWeight:800,color:'#D97706'}}>{fmt(totalCxC)}</div>
        </div>
        {cxc.length === 0 ? (
          <div className="fin-table"><div className="fin-empty">Sin cuentas por cobrar en este periodo</div></div>
        ) : (
          <div className="fin-table">
            {cxc.map(a => (
              <div key={a.id} className="fin-row">
                <div style={{width:60,fontSize:11,fontWeight:800,color:'#D97706',background:'rgba(217,119,6,0.08)',borderRadius:8,padding:'4px 7px',textAlign:'center',flexShrink:0}}>
                  {a.folio}
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <div className="fin-row-name">{a.customers?.full_name ?? 'Sin cliente'}</div>
                  <div className="fin-row-sub">Pagado {fmt(a.pagado)} de {fmt(a.total)}</div>
                </div>
                <div className="fin-right">
                  <div className="fin-amt" style={{color:'#D97706'}}>{fmt(a.pendiente)}</div>
                  <div className="fin-pct">pendiente</div>
                </div>
              </div>
            ))}
          </div>
        )}
        </>}

      </div>

      {showExportModal && (
        <div className="exp-modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowExportModal(false) }}>
          <div className="exp-modal">
            <div className="exp-modal-title">Exportar a CSV</div>
            <div className="exp-modal-sub">Elige qué secciones exportar y el periodo. Se descarga un archivo por sección.</div>

            <div className="exp-modal-section">Secciones</div>
            {([['resumen','Resumen'],['productos','Productos más vendidos'],['gastos','Gastos y egresos'],['cobros','Cuentas por cobrar']] as const).map(([k, l]) => (
              <label key={k} className="exp-check-row">
                <input type="checkbox" checked={exportSections[k]} onChange={e => setExportSections(s => ({ ...s, [k]: e.target.checked }))} />
                <span className="exp-check-lbl">{l}</span>
              </label>
            ))}

            <div className="exp-modal-section">Periodo a exportar</div>
            <DateRangeCalendar desde={exportDesde} hasta={exportHasta} onApply={(d, h) => { setExportDesde(d); setExportHasta(h) }} />

            <div className="exp-modal-actions">
              <button className="exp-modal-cancel" onClick={() => setShowExportModal(false)}>Cancelar</button>
              <button
                className="exp-modal-go"
                disabled={exporting || !Object.values(exportSections).some(Boolean)}
                onClick={runExport}
              >
                {exporting ? 'Exportando…' : 'Exportar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
