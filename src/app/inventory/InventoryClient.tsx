'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import BottomNav from '@/components/BottomNav'
import { createClient } from '@/lib/supabase/client'

interface StockLevel { quantity_available: number; quantity_reserved: number; quantity_damaged: number; location_id: string; inventory_locations: { name: string } | null }
interface Variant { id: string; name: string; sku: string; sale_price: number; cost_price: number; status: string; products: { id: string; name: string }; stock_levels: StockLevel[] }
interface Props { variants: Variant[]; orgId: string; userName: string; orgName: string }

export default function InventoryClient({ variants: initial, orgId, userName, orgName }: Props) {
  const router = useRouter()
  const [variants, setVariants] = useState(initial)
  const [q, setQ]               = useState('')
  const [adjusting, setAdjusting] = useState<Variant | null>(null)
  const [adjQty, setAdjQty]     = useState('')
  const [adjNote, setAdjNote]   = useState('')
  const [saving, setSaving]     = useState(false)
  const [err, setErr]           = useState<string | null>(null)

  const filtered = variants.filter(v =>
    v.sku.toLowerCase().includes(q.toLowerCase()) ||
    v.name.toLowerCase().includes(q.toLowerCase()) ||
    v.products?.name?.toLowerCase().includes(q.toLowerCase())
  )

  function totalAvailable(v: Variant) {
    return v.stock_levels.reduce((s, sl) => s + (sl.quantity_available ?? 0), 0)
  }

  function stockColor(qty: number) {
    if (qty <= 0)  return '#DC2626'
    if (qty <= 5)  return '#D97706'
    return '#059669'
  }

  async function handleAdjust() {
    if (!adjusting) return
    const delta = parseFloat(adjQty)
    if (isNaN(delta) || delta === 0) { setErr('Ingresa una cantidad válida (puede ser negativa para reducir).'); return }
    setSaving(true); setErr(null)

    const supabase = createClient()

    // Get or create default location
    let locationId: string | null = null
    const { data: loc } = await supabase.from('inventory_locations').select('id').eq('organization_id', orgId).eq('is_default', true).single()
    if (loc) {
      locationId = loc.id
    } else {
      const { data: newLoc } = await supabase.from('inventory_locations').insert({ organization_id: orgId, name: 'Almacén principal', is_default: true }).select('id').single()
      locationId = newLoc?.id ?? null
    }

    if (!locationId) { setSaving(false); setErr('No se pudo obtener la ubicación de inventario.'); return }

    await supabase.from('inventory_ledger').insert({
      organization_id: orgId,
      variant_id: adjusting.id,
      location_id: locationId,
      movement_type: 'adjustment',
      quantity: delta,
      notes: adjNote.trim() || 'Ajuste manual',
      performed_by: (await supabase.auth.getUser()).data.user?.id,
    })

    const current = totalAvailable(adjusting)
    const newQty  = Math.max(0, current + delta)

    await supabase.from('stock_levels').upsert({
      variant_id: adjusting.id,
      location_id: locationId,
      quantity_available: newQty,
    }, { onConflict: 'variant_id,location_id' })

    // Update local state
    setVariants(vs => vs.map(v => {
      if (v.id !== adjusting.id) return v
      const hasSL = v.stock_levels.some(sl => sl.location_id === locationId)
      const updatedSL = hasSL
        ? v.stock_levels.map(sl => sl.location_id === locationId ? { ...sl, quantity_available: newQty } : sl)
        : [...v.stock_levels, { quantity_available: newQty, quantity_reserved: 0, quantity_damaged: 0, location_id: locationId!, inventory_locations: { name: 'Almacén principal' } }]
      return { ...v, stock_levels: updatedSL }
    }))

    setSaving(false); setAdjusting(null); setAdjQty(''); setAdjNote('')
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #ECEEF2; font-family: 'Inter', -apple-system, sans-serif; -webkit-font-smoothing: antialiased; }
        .shell { display: flex; min-height: 100dvh; }
        .main  { flex: 1; overflow-y: auto; }
        .topbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 52px 20px 20px; }
        @media (min-width: 768px) { .topbar { padding: 32px 32px 24px; } }
        .content { padding: 0 16px 120px; }
        @media (min-width: 768px) { .content { padding: 0 32px 48px; } }
        .search-wrap { margin-bottom: 16px; position: relative; }
        .search-icon { position: absolute; left: 14px; top: 50%; transform: translateY(-50%); pointer-events: none; }
        .search-input { width: 100%; padding: 13px 16px 13px 42px; background: #ECEEF2; border: 1.5px solid rgba(0,0,0,0.07); border-radius: 16px; font-size: 15px; font-weight: 500; color: #1A1A20; font-family: inherit; outline: none; box-shadow: inset 3px 3px 8px rgba(0,0,0,0.07), inset -2px -2px 6px rgba(255,255,255,0.85); transition: border-color 0.15s; }
        .search-input::placeholder { color: rgba(26,26,32,0.28); }
        .search-input:focus { border-color: #2563EB; }
        .card { background: #ECEEF2; border-radius: 24px; overflow: hidden; box-shadow: 6px 6px 18px rgba(0,0,0,0.08), -4px -4px 12px rgba(255,255,255,0.95), inset 0 1px 0 rgba(255,255,255,0.7); }
        .row { display: flex; align-items: center; gap: 12px; padding: 14px 20px; border-top: 1px solid rgba(0,0,0,0.05); }
        .row:first-child { border-top: none; }
        .row-name { font-size: 14px; font-weight: 700; color: #1A1A20; }
        .row-sub  { font-size: 12px; color: rgba(26,26,32,0.38); margin-top: 2px; }
        .stock-badge { font-size: 22px; font-weight: 800; min-width: 44px; text-align: right; }
        .stock-unit  { font-size: 11px; font-weight: 600; color: rgba(26,26,32,0.30); text-align: right; margin-top: 1px; }
        .adj-btn { padding: 7px 14px; border-radius: 10px; border: none; background: rgba(37,99,235,0.08); color: #1D4ED8; font-size: 12px; font-weight: 700; cursor: pointer; font-family: inherit; white-space: nowrap; flex-shrink: 0; }
        .adj-btn:hover { background: rgba(37,99,235,0.14); }
        .empty { padding: 48px 24px; text-align: center; color: rgba(26,26,32,0.35); font-size: 14px; font-weight: 500; }
        .count-label { font-size: 13px; color: rgba(26,26,32,0.35); font-weight: 500; margin-bottom: 10px; }
        .overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.35); z-index: 200; display: flex; align-items: flex-end; justify-content: center; }
        @media (min-width: 768px) { .overlay { align-items: center; } }
        .modal { background: #ECEEF2; border-radius: 28px 28px 0 0; padding: 28px 24px 40px; width: 100%; max-width: 520px; box-shadow: 0 -8px 40px rgba(0,0,0,0.14); }
        @media (min-width: 768px) { .modal { border-radius: 28px; padding: 32px; } }
        .modal-title { font-size: 20px; font-weight: 800; color: #1A1A20; margin-bottom: 4px; }
        .modal-sub { font-size: 13px; color: rgba(26,26,32,0.38); margin-bottom: 20px; }
        .field-lbl { font-size: 11px; font-weight: 700; color: rgba(26,26,32,0.35); text-transform: uppercase; letter-spacing: 0.07em; margin-bottom: 6px; }
        .field-input { width: 100%; padding: 13px 16px; background: rgba(0,0,0,0.03); border: 1.5px solid rgba(0,0,0,0.07); border-radius: 14px; font-size: 15px; font-weight: 500; color: #1A1A20; font-family: inherit; outline: none; box-shadow: inset 2px 2px 6px rgba(0,0,0,0.06), inset -2px -2px 5px rgba(255,255,255,0.80); transition: border-color 0.15s; margin-bottom: 14px; }
        .field-input:focus { border-color: #2563EB; }
        .hint { font-size: 12px; color: rgba(26,26,32,0.35); margin-top: -10px; margin-bottom: 14px; }
        .alert-err { background: rgba(220,38,38,0.07); border: 1px solid rgba(220,38,38,0.15); border-radius: 12px; padding: 10px 14px; font-size: 13px; font-weight: 600; color: #991b1b; margin-bottom: 14px; }
        .modal-actions { display: flex; gap: 10px; }
        .btn-cancel { flex: 1; padding: 14px; border-radius: 14px; border: 1.5px solid rgba(0,0,0,0.10); background: transparent; font-size: 15px; font-weight: 700; color: rgba(26,26,32,0.50); cursor: pointer; font-family: inherit; }
        .btn-save   { flex: 2; padding: 14px; border-radius: 14px; border: none; background: linear-gradient(145deg,#1D4ED8,#2563EB); font-size: 15px; font-weight: 700; color: white; cursor: pointer; font-family: inherit; box-shadow: 0 6px 18px rgba(29,78,216,0.28); }
        .btn-save:disabled { opacity: 0.5; cursor: not-allowed; }
      `}</style>

      <div className="shell">
        <Sidebar orgName={orgName} userName={userName} active="inventory" />
        <main className="main">
          <div className="topbar">
            <div className="page-title">Stock</div>
          </div>
          <div className="content">
            <div className="search-wrap">
              <div className="search-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(26,26,32,0.35)" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              </div>
              <input className="search-input" type="text" placeholder="Buscar por producto o SKU..." value={q} onChange={e => setQ(e.target.value)} />
            </div>

            {filtered.length > 0 && <div className="count-label">{filtered.length} variante{filtered.length !== 1 ? 's' : ''}</div>}

            <div className="card">
              {filtered.length === 0 ? (
                <div className="empty">{q ? `Sin resultados para "${q}"` : 'No hay productos con variantes registradas aún'}</div>
              ) : filtered.map(v => {
                const qty = totalAvailable(v)
                return (
                  <div key={v.id} className="row">
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="row-name">{v.products?.name}</div>
                      <div className="row-sub">{v.name} · SKU: {v.sku}</div>
                    </div>
                    <div style={{ textAlign: 'right', marginRight: 12 }}>
                      <div className="stock-badge" style={{ color: stockColor(qty) }}>{qty}</div>
                      <div className="stock-unit">unidades</div>
                    </div>
                    <button className="adj-btn" onClick={() => { setAdjusting(v); setAdjQty(''); setAdjNote(''); setErr(null) }}>
                      Ajustar
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        </main>
      </div>

      <BottomNav active="inventory" />

      {adjusting && (
        <div className="overlay" onClick={e => e.target === e.currentTarget && setAdjusting(null)}>
          <div className="modal">
            <div className="modal-title">Ajuste de stock</div>
            <div className="modal-sub">{adjusting.products?.name} — {adjusting.name} · Stock actual: <strong>{totalAvailable(adjusting)}</strong></div>
            {err && <div className="alert-err">{err}</div>}
            <div className="field-lbl">Cantidad a añadir o restar *</div>
            <input className="field-input" type="number" step="1" value={adjQty} onChange={e => setAdjQty(e.target.value)} placeholder="Ej: +10 o -5" autoFocus />
            <div className="hint">Usa número positivo para añadir, negativo para restar.</div>
            <div className="field-lbl">Motivo (opcional)</div>
            <input className="field-input" type="text" value={adjNote} onChange={e => setAdjNote(e.target.value)} placeholder="Ej: Recepción de mercancía, devolución..." />
            <div className="modal-actions">
              <button className="btn-cancel" onClick={() => setAdjusting(null)}>Cancelar</button>
              <button className="btn-save" onClick={handleAdjust} disabled={saving}>{saving ? 'Guardando...' : 'Aplicar ajuste'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
