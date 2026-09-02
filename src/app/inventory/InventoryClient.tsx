'use client'

import { useState, useEffect, useCallback } from 'react'
import Sidebar from '@/components/Sidebar'
import BottomNav from '@/components/BottomNav'
import { createClient } from '@/lib/supabase/client'

interface StockLevel { quantity_available: number; quantity_reserved: number; quantity_damaged: number; location_id: string; inventory_locations: { name: string } | null }
interface Variant { id: string; name: string; sku: string; sale_price: number; cost_price: number; status: string; products: { id: string; name: string }; stock_levels: StockLevel[] }
interface ProductVariantBasic { id: string; name: string; sale_price: number }
interface ProductImage { url: string; is_primary: boolean; sort_order: number }
interface Product { id: string; name: string; slug: string | null; is_published: boolean; published_at: string | null; status: string; description: string | null; created_at: string; product_variants: ProductVariantBasic[]; product_images: ProductImage[] }
interface Props { variants: Variant[]; products: Product[]; orgId: string; userName: string; orgName: string }

type Tab = 'stock' | 'catalogo'
type PubFilter = 'all' | 'published' | 'draft'

export default function InventoryClient({ variants: initial, products: initialProducts, orgId, userName, orgName }: Props) {
  const [tab, setTab] = useState<Tab>('stock')
  const [variants, setVariants] = useState(initial)
  const [products, setProducts] = useState(initialProducts)

  // Stock tab state
  const [q, setQ]               = useState('')
  const [adjusting, setAdjusting] = useState<Variant | null>(null)
  const [adjQty, setAdjQty]     = useState('')
  const [adjNote, setAdjNote]   = useState('')
  const [saving, setSaving]     = useState(false)
  const [err, setErr]           = useState<string | null>(null)

  // Catalog tab state
  const [catQ, setCatQ]               = useState('')
  const [pubFilter, setPubFilter]     = useState<PubFilter>('all')
  const [selected, setSelected]       = useState<Set<string>>(new Set())
  const [toggling, setToggling]       = useState<Set<string>>(new Set())
  const [bulkLoading, setBulkLoading] = useState(false)

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') setAdjusting(null) }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [])

  // ─── Stock helpers ─────────────────────────────────────────────────
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
      organization_id: orgId, variant_id: adjusting.id, location_id: locationId,
      movement_type: 'adjustment', quantity: delta, notes: adjNote.trim() || 'Ajuste manual',
      performed_by: (await supabase.auth.getUser()).data.user?.id,
    })
    const current = totalAvailable(adjusting)
    const newQty  = Math.max(0, current + delta)
    await supabase.from('stock_levels').upsert({ variant_id: adjusting.id, location_id: locationId, quantity_available: newQty }, { onConflict: 'variant_id,location_id' })
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

  // ─── Catalog helpers ────────────────────────────────────────────────
  const filteredProducts = products.filter(p => {
    const matchQ = !catQ || p.name.toLowerCase().includes(catQ.toLowerCase()) || (p.slug ?? '').toLowerCase().includes(catQ.toLowerCase())
    const matchPub = pubFilter === 'all' || (pubFilter === 'published' ? p.is_published : !p.is_published)
    return matchQ && matchPub
  })

  function priceRange(p: Product): string {
    const prices = p.product_variants.map(v => v.sale_price).filter(Boolean)
    if (!prices.length) return '—'
    const min = Math.min(...prices), max = Math.max(...prices)
    const fmt = (n: number) => '$' + n.toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
    return min === max ? fmt(min) : `${fmt(min)} – ${fmt(max)}`
  }

  function thumbUrl(p: Product): string | null {
    const imgs = [...p.product_images].sort((a, b) => (b.is_primary ? 1 : -1) || a.sort_order - b.sort_order)
    return imgs[0]?.url ?? null
  }

  const togglePublish = useCallback(async (productId: string, newValue: boolean) => {
    setToggling(t => new Set(t).add(productId))
    setProducts(ps => ps.map(p => p.id === productId ? { ...p, is_published: newValue, published_at: newValue ? new Date().toISOString() : p.published_at } : p))
    const supabase = createClient()
    await supabase.from('products').update({ is_published: newValue, ...(newValue ? { published_at: new Date().toISOString() } : {}) }).eq('id', productId)
    setToggling(t => { const n = new Set(t); n.delete(productId); return n })
  }, [])

  const toggleSelect = (id: string) => {
    setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  }
  const toggleSelectAll = () => {
    if (selected.size === filteredProducts.length) { setSelected(new Set()) }
    else { setSelected(new Set(filteredProducts.map(p => p.id))) }
  }

  async function bulkPublish(value: boolean) {
    if (!selected.size) return
    setBulkLoading(true)
    const ids = [...selected]
    const now = new Date().toISOString()
    setProducts(ps => ps.map(p => ids.includes(p.id) ? { ...p, is_published: value, published_at: value ? now : p.published_at } : p))
    setSelected(new Set())
    const supabase = createClient()
    await supabase.from('products').update({ is_published: value, ...(value ? { published_at: now } : {}) }).in('id', ids)
    setBulkLoading(false)
  }

  const allSelected = filteredProducts.length > 0 && selected.size === filteredProducts.length
  const someSelected = selected.size > 0

  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #ECEEF2; font-family: 'Inter', -apple-system, sans-serif; -webkit-font-smoothing: antialiased; }
        .shell { display: flex; min-height: 100dvh; }
        .main  { flex: 1; overflow-y: auto; }
        .topbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 20px 20px 0; }
        @media (min-width: 768px) { .topbar { padding: 20px 40px 0; } }
        .tab-row { display: flex; gap: 4px; padding: 12px 20px 16px; }
        @media (min-width: 768px) { .tab-row { padding: 12px 40px 20px; } }
        .tab-pill { padding: 6px 16px; border-radius: 50px; border: 1.5px solid transparent; font-size: 13px; font-weight: 700; cursor: pointer; font-family: inherit; transition: all 0.15s; background: transparent; color: rgba(26,26,32,0.40); }
        .tab-pill.active { background: #1A1A20; color: #fff; border-color: #1A1A20; }
        .tab-pill:not(.active):hover { background: rgba(0,0,0,0.04); color: #1A1A20; }
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

        /* ── Catalog tab ── */
        .filter-row { display: flex; gap: 6px; margin-bottom: 14px; flex-wrap: wrap; }
        .filter-chip { padding: 5px 14px; border-radius: 50px; border: 1.5px solid rgba(0,0,0,0.10); font-size: 12px; font-weight: 700; cursor: pointer; font-family: inherit; background: transparent; color: rgba(26,26,32,0.50); transition: all 0.12s; }
        .filter-chip.active { background: #1A1A20; color: #fff; border-color: #1A1A20; }
        .filter-chip:not(.active):hover { background: rgba(0,0,0,0.04); color: #1A1A20; }
        .bulk-bar { position: fixed; bottom: calc(env(safe-area-inset-bottom,0px) + 72px); left: 50%; transform: translateX(-50%); background: #1A1A20; border-radius: 20px; padding: 10px 10px 10px 18px; display: flex; align-items: center; gap: 8px; box-shadow: 0 8px 32px rgba(0,0,0,0.28); z-index: 100; white-space: nowrap; }
        @media (min-width: 768px) { .bulk-bar { bottom: 24px; } }
        .bulk-count { font-size: 13px; font-weight: 700; color: rgba(255,255,255,0.65); margin-right: 4px; }
        .bulk-btn { padding: 7px 14px; border-radius: 12px; border: none; font-size: 12px; font-weight: 700; cursor: pointer; font-family: inherit; transition: all 0.12s; }
        .bulk-btn.pub  { background: #CAFF3A; color: #1A1A20; }
        .bulk-btn.hide { background: rgba(255,255,255,0.12); color: #fff; }
        .bulk-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .cat-row { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-top: 1px solid rgba(0,0,0,0.05); }
        .cat-row:first-child { border-top: none; }
        .cat-thumb { width: 44px; height: 44px; border-radius: 10px; background: #D1D5DB; object-fit: cover; flex-shrink: 0; overflow: hidden; display: flex; align-items: center; justify-content: center; }
        .cat-thumb img { width: 100%; height: 100%; object-fit: cover; border-radius: 10px; }
        .cat-thumb-placeholder { width: 44px; height: 44px; border-radius: 10px; background: rgba(0,0,0,0.05); flex-shrink: 0; }
        .cat-name { font-size: 14px; font-weight: 700; color: #1A1A20; }
        .cat-sub  { font-size: 12px; color: rgba(26,26,32,0.38); margin-top: 2px; }
        .pub-badge { display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: 50px; font-size: 11px; font-weight: 700; }
        .pub-badge.yes { background: rgba(5,150,105,0.10); color: #065F46; }
        .pub-badge.no  { background: rgba(0,0,0,0.05); color: rgba(26,26,32,0.45); }
        /* Toggle switch */
        .tog-wrap { position: relative; display: inline-block; width: 44px; height: 26px; flex-shrink: 0; cursor: pointer; }
        .tog-wrap input { opacity: 0; width: 0; height: 0; }
        .tog-track { position: absolute; inset: 0; background: rgba(0,0,0,0.12); border-radius: 50px; transition: background 0.18s; }
        .tog-wrap input:checked + .tog-track { background: #059669; }
        .tog-thumb { position: absolute; left: 3px; top: 3px; width: 20px; height: 20px; border-radius: 50%; background: white; box-shadow: 0 1px 4px rgba(0,0,0,0.20); transition: transform 0.18s; }
        .tog-wrap input:checked ~ .tog-thumb { transform: translateX(18px); }
        .tog-wrap.loading { opacity: 0.5; pointer-events: none; }
        /* Checkbox */
        .cb { width: 18px; height: 18px; border-radius: 5px; border: 1.5px solid rgba(0,0,0,0.18); appearance: none; cursor: pointer; flex-shrink: 0; display: flex; align-items: center; justify-content: center; transition: all 0.12s; background: transparent; }
        .cb:checked { background: #1A1A20; border-color: #1A1A20; background-image: url("data:image/svg+xml,%3Csvg width='10' height='8' viewBox='0 0 10 8' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 4L3.5 6.5L9 1' stroke='white' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: center; }
        .cb-all-row { display: flex; align-items: center; gap: 8px; padding: 10px 16px; border-bottom: 1px solid rgba(0,0,0,0.06); background: rgba(0,0,0,0.015); }
        .cb-all-label { font-size: 12px; font-weight: 600; color: rgba(26,26,32,0.45); }
      `}</style>

      <div className="shell">
        <Sidebar orgName={orgName} userName={userName} active="inventory" />
        <main className="main">
          <div className="topbar">
            <div className="page-title">{tab === 'stock' ? 'Stock' : 'Catálogo'}</div>
          </div>

          <div className="tab-row">
            <button className={`tab-pill${tab === 'stock' ? ' active' : ''}`} onClick={() => setTab('stock')}>Stock</button>
            <button className={`tab-pill${tab === 'catalogo' ? ' active' : ''}`} onClick={() => { setTab('catalogo'); setSelected(new Set()) }}>
              Catálogo
            </button>
          </div>

          <div className="content">
            {/* ── Stock tab ── */}
            {tab === 'stock' && (
              <>
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
              </>
            )}

            {/* ── Catálogo tab ── */}
            {tab === 'catalogo' && (
              <>
                <div className="search-wrap">
                  <div className="search-icon">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(26,26,32,0.35)" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                  </div>
                  <input className="search-input" type="text" placeholder="Buscar producto..." value={catQ} onChange={e => setCatQ(e.target.value)} />
                </div>

                <div className="filter-row">
                  {(['all','published','draft'] as PubFilter[]).map(f => (
                    <button key={f} className={`filter-chip${pubFilter === f ? ' active' : ''}`} onClick={() => { setPubFilter(f); setSelected(new Set()) }}>
                      {f === 'all' ? 'Todos' : f === 'published' ? 'Publicados' : 'Borradores'}
                    </button>
                  ))}
                </div>

                {filteredProducts.length > 0 && <div className="count-label">{filteredProducts.length} producto{filteredProducts.length !== 1 ? 's' : ''}</div>}

                <div className="card">
                  {filteredProducts.length === 0 ? (
                    <div className="empty">{catQ ? `Sin resultados para "${catQ}"` : 'No hay productos en el catálogo aún'}</div>
                  ) : (
                    <>
                      <div className="cb-all-row">
                        <input type="checkbox" className="cb" checked={allSelected} onChange={toggleSelectAll} />
                        <span className="cb-all-label">
                          {someSelected ? `${selected.size} seleccionado${selected.size !== 1 ? 's' : ''}` : 'Seleccionar todos'}
                        </span>
                      </div>
                      {filteredProducts.map(p => {
                        const thumb = thumbUrl(p)
                        const isToggling = toggling.has(p.id)
                        return (
                          <div key={p.id} className="cat-row">
                            <input type="checkbox" className="cb" checked={selected.has(p.id)} onChange={() => toggleSelect(p.id)} />
                            {thumb
                              ? <div className="cat-thumb"><img src={thumb} alt={p.name} /></div>
                              : <div className="cat-thumb-placeholder" />
                            }
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div className="cat-name">{p.name}</div>
                              <div className="cat-sub">
                                {p.product_variants.length} variante{p.product_variants.length !== 1 ? 's' : ''} · {priceRange(p)}
                                {p.slug && <span style={{ marginLeft: 6, opacity: 0.6 }}>/{p.slug}</span>}
                              </div>
                            </div>
                            <label className={`tog-wrap${isToggling ? ' loading' : ''}`} title={p.is_published ? 'Publicado — click para ocultar' : 'Borrador — click para publicar'}>
                              <input type="checkbox" checked={p.is_published} onChange={() => togglePublish(p.id, !p.is_published)} />
                              <span className="tog-track" />
                              <span className="tog-thumb" />
                            </label>
                          </div>
                        )
                      })}
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </main>
      </div>

      <BottomNav active="inventory" />

      {/* ── Bulk action bar ── */}
      {tab === 'catalogo' && someSelected && (
        <div className="bulk-bar">
          <span className="bulk-count">{selected.size} seleccionado{selected.size !== 1 ? 's' : ''}</span>
          <button className="bulk-btn pub" onClick={() => bulkPublish(true)} disabled={bulkLoading}>Publicar</button>
          <button className="bulk-btn hide" onClick={() => bulkPublish(false)} disabled={bulkLoading}>Ocultar</button>
        </div>
      )}

      {/* ── Stock adjustment modal ── */}
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
