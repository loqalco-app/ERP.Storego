'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import Sidebar from '@/components/Sidebar'
import BottomNav from '@/components/BottomNav'

interface Category { id: string; name: string }
interface Brand    { id: string; name: string }
interface Variant  { name: string; sku: string; sale_price: string; cost_price: string; stock: string }

interface Props {
  mode: 'create' | 'edit'
  orgId: string
  userName: string
  orgName: string
  categories: Category[]
  brands: Brand[]
  // edit mode
  productId?: string
  initial?: {
    name: string; description: string; status: string
    condition: string; categoryId: string; brandId: string
    variants: Variant[]
  }
}

function slugify(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

const emptyVariant = (): Variant => ({ name: 'Estándar', sku: '', sale_price: '', cost_price: '', stock: '' })

export default function ProductFormClient({ mode, orgId, userName, orgName, categories, brands, productId, initial }: Props) {
  const router = useRouter()
  const [name, setName]             = useState(initial?.name ?? '')
  const [desc, setDesc]             = useState(initial?.description ?? '')
  const [status, setStatus]         = useState(initial?.status ?? 'active')
  const [condition, setCondition]   = useState(initial?.condition ?? 'new')
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? '')
  const [brandId, setBrandId]       = useState(initial?.brandId ?? '')
  const [variants, setVariants]     = useState<Variant[]>(initial?.variants ?? [emptyVariant()])
  const [saving, setSaving]         = useState(false)
  const [err, setErr]               = useState<string | null>(null)

  function updateVariant(i: number, field: keyof Variant, val: string) {
    setVariants(vs => vs.map((v, idx) => idx === i ? { ...v, [field]: val } : v))
  }
  function addVariant()    { setVariants(vs => [...vs, emptyVariant()]) }
  function removeVariant(i: number) { setVariants(vs => vs.filter((_, idx) => idx !== i)) }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setErr('El nombre del producto es obligatorio.'); return }
    if (variants.some(v => !v.sku.trim())) { setErr('Todos los SKUs son obligatorios.'); return }
    if (variants.some(v => isNaN(parseFloat(v.sale_price)) || parseFloat(v.sale_price) < 0)) {
      setErr('El precio de venta debe ser un número válido.'); return
    }
    setSaving(true); setErr(null)

    const supabase = createClient()
    const slug = slugify(name.trim())

    if (mode === 'create') {
      const { data: product, error: pErr } = await supabase
        .from('products')
        .insert({
          organization_id: orgId,
          name: name.trim(),
          description: desc.trim() || null,
          slug,
          status,
          condition,
          category_id: categoryId || null,
          brand_id: brandId || null,
        })
        .select('id')
        .single()

      if (pErr) {
        setSaving(false)
        setErr(pErr.message.includes('slug') ? 'Ya existe un producto con ese nombre. Cambia el nombre.' : pErr.message)
        return
      }

      const { data: insertedVariants, error: vErr } = await supabase
        .from('product_variants')
        .insert(
          variants.map(v => ({
            organization_id: orgId,
            product_id: product.id,
            name: v.name.trim() || 'Estándar',
            sku: v.sku.trim(),
            sale_price: parseFloat(v.sale_price),
            cost_price: parseFloat(v.cost_price) || 0,
          }))
        )
        .select('id, sku')

      if (vErr) {
        setSaving(false)
        setErr(vErr.message.includes('sku') ? 'Uno de los SKUs ya existe. Usa un SKU diferente.' : vErr.message)
        return
      }

      // Registrar stock inicial si hay cantidades
      const variantsWithStock = variants.filter(v => parseFloat(v.stock) > 0)
      if (variantsWithStock.length > 0 && insertedVariants) {
        // Obtener o crear ubicación por defecto
        let locationId: string | null = null
        const { data: loc } = await supabase
          .from('inventory_locations')
          .select('id')
          .eq('organization_id', orgId)
          .eq('is_default', true)
          .single()

        if (loc) {
          locationId = loc.id
        } else {
          const { data: newLoc } = await supabase
            .from('inventory_locations')
            .insert({ organization_id: orgId, name: 'Almacén principal', is_default: true })
            .select('id')
            .single()
          locationId = newLoc?.id ?? null
        }

        if (locationId) {
          for (const [i, v] of variants.entries()) {
            const qty = parseFloat(v.stock)
            if (!qty || qty <= 0) continue
            const variantId = insertedVariants[i]?.id
            if (!variantId) continue

            await supabase.from('inventory_ledger').insert({
              organization_id: orgId,
              variant_id: variantId,
              location_id: locationId,
              movement_type: 'purchase',
              quantity: qty,
              unit_cost: parseFloat(v.cost_price) || 0,
              notes: 'Stock inicial al crear producto',
              performed_by: (await supabase.auth.getUser()).data.user?.id,
            })

            await supabase.from('stock_levels').upsert({
              variant_id: variantId,
              location_id: locationId,
              quantity_available: qty,
            }, { onConflict: 'variant_id,location_id' })
          }
        }
      }

      router.push('/catalog')
    } else {
      // edit mode
      const { error: pErr } = await supabase
        .from('products')
        .update({
          name: name.trim(), description: desc.trim() || null,
          status, condition,
          category_id: categoryId || null,
          brand_id: brandId || null,
        })
        .eq('id', productId)

      if (pErr) { setSaving(false); setErr(pErr.message); return }
      router.push('/catalog')
    }
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #ECEEF2; font-family: 'Inter', -apple-system, sans-serif; -webkit-font-smoothing: antialiased; }

        .shell { display: flex; min-height: 100dvh; }
        .main  { flex: 1; overflow-y: auto; }

        .topbar { display: flex; align-items: center; gap: 12px; padding: 52px 20px 20px; }
        @media (min-width: 768px) { .topbar { padding: 32px 32px 24px; } }
        .back-btn { width: 38px; height: 38px; border-radius: 12px; background: #ECEEF2; display: flex; align-items: center; justify-content: center; text-decoration: none; flex-shrink: 0; box-shadow: 4px 4px 12px rgba(0,0,0,0.08), -3px -3px 8px rgba(255,255,255,0.95); }
        .page-title { font-size: 22px; font-weight: 800; color: #1A1A20; letter-spacing: -0.4px; }
        @media (min-width: 768px) { .page-title { font-size: 26px; } }

        .content { padding: 0 16px 120px; }
        @media (min-width: 768px) { .content { padding: 0 32px 48px; max-width: 680px; } }

        .section-title { font-size: 17px; font-weight: 800; color: #1A1A20; letter-spacing: -0.3px; margin-bottom: 10px; margin-top: 8px; }

        .card { background: #ECEEF2; border-radius: 24px; overflow: hidden; box-shadow: 6px 6px 18px rgba(0,0,0,0.08), -4px -4px 12px rgba(255,255,255,0.95), inset 0 1px 0 rgba(255,255,255,0.7); margin-bottom: 16px; }

        .field { padding: 4px 20px 16px; border-top: 1px solid rgba(0,0,0,0.05); }
        .field:first-child { border-top: none; padding-top: 16px; }
        .field-lbl { font-size: 11px; font-weight: 700; color: rgba(26,26,32,0.35); text-transform: uppercase; letter-spacing: 0.07em; margin-bottom: 6px; }

        .field-input, .field-select, .field-textarea {
          width: 100%; padding: 13px 16px;
          background: rgba(0,0,0,0.03); border: 1.5px solid rgba(0,0,0,0.07); border-radius: 14px;
          font-size: 15px; font-weight: 500; color: #1A1A20; font-family: inherit; outline: none;
          box-shadow: inset 2px 2px 6px rgba(0,0,0,0.06), inset -2px -2px 5px rgba(255,255,255,0.80);
          transition: border-color 0.15s;
        }
        .field-input:focus, .field-select:focus, .field-textarea:focus { border-color: #2563EB; box-shadow: inset 2px 2px 6px rgba(0,0,0,0.06), inset -2px -2px 5px rgba(255,255,255,0.80), 0 0 0 3px rgba(37,99,235,0.12); }
        .field-textarea { resize: vertical; min-height: 80px; }
        .field-select { appearance: none; background-image: url("data:image/svg+xml,%3Csvg width='12' height='8' viewBox='0 0 12 8' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%231A1A20' stroke-opacity='.4' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 14px center; padding-right: 36px; }

        .seg { display: flex; gap: 8px; }
        .seg-btn { flex: 1; padding: 11px 8px; border-radius: 12px; border: 1.5px solid rgba(0,0,0,0.08); background: #ECEEF2; font-size: 13px; font-weight: 600; color: rgba(26,26,32,0.45); cursor: pointer; font-family: inherit; transition: all 0.15s; }
        .seg-btn.on { background: #1D4ED8; color: white; border-color: #1D4ED8; box-shadow: 0 4px 14px rgba(29,78,216,0.25); }

        .variant-block { background: #ECEEF2; border-radius: 18px; padding: 16px; margin-bottom: 12px; box-shadow: 4px 4px 12px rgba(0,0,0,0.07), -3px -3px 8px rgba(255,255,255,0.90); }
        .variant-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
        .variant-title { font-size: 13px; font-weight: 700; color: #1A1A20; }
        .remove-btn { background: rgba(220,38,38,0.08); border: none; border-radius: 8px; padding: 5px 10px; font-size: 12px; font-weight: 600; color: #DC2626; cursor: pointer; font-family: inherit; }
        .price-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }

        .add-variant-btn { display: flex; align-items: center; gap: 8px; width: 100%; padding: 14px; border-radius: 16px; border: 1.5px dashed rgba(29,78,216,0.30); background: transparent; font-size: 14px; font-weight: 600; color: #2563EB; cursor: pointer; font-family: inherit; justify-content: center; transition: background 0.15s; }
        .add-variant-btn:hover { background: rgba(29,78,216,0.04); }

        .alert-err { background: rgba(220,38,38,0.07); border: 1px solid rgba(220,38,38,0.15); border-radius: 14px; padding: 12px 16px; font-size: 13px; font-weight: 600; color: #991b1b; margin-bottom: 16px; }

        .save-btn { width: 100%; padding: 16px; background: linear-gradient(145deg,#1D4ED8,#2563EB); border: none; border-radius: 18px; font-size: 16px; font-weight: 700; color: white; cursor: pointer; font-family: inherit; box-shadow: 0 8px 24px rgba(29,78,216,0.30), inset 0 1px 0 rgba(255,255,255,0.20); transition: opacity 0.15s, transform 0.12s; margin-top: 8px; }
        .save-btn:hover { opacity: 0.92; }
        .save-btn:active { transform: scale(0.98); }
        .save-btn:disabled { opacity: 0.5; cursor: not-allowed; }

        .two-col { display: grid; grid-template-columns: 1fr 1fr; }
        .two-col .field { border-left: 1px solid rgba(0,0,0,0.05); }
        .two-col .field:first-child { border-left: none; }
        @media (max-width: 480px) { .two-col { grid-template-columns: 1fr; } .two-col .field { border-left: none; border-top: 1px solid rgba(0,0,0,0.05); } }
      `}</style>

      <div className="shell">
        <Sidebar orgName={orgName} userName={userName} active="products" />

        <main className="main">
          <div className="topbar">
            <Link href="/catalog" className="back-btn">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1A1A20" strokeWidth="2.2" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
            </Link>
            <div className="page-title">{mode === 'create' ? 'Nuevo producto' : 'Editar producto'}</div>
          </div>

          <div className="content">
            {err && <div className="alert-err">{err}</div>}

            <form onSubmit={handleSubmit}>
              {/* Info básica */}
              <div className="section-title">Información básica</div>
              <div className="card">
                <div className="field">
                  <div className="field-lbl">Nombre del producto *</div>
                  <input className="field-input" type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Ej. Playera básica cuello redondo" autoFocus />
                </div>
                <div className="field">
                  <div className="field-lbl">Descripción</div>
                  <textarea className="field-textarea" value={desc} onChange={e => setDesc(e.target.value)} placeholder="Describe el producto..." />
                </div>
              </div>

              {/* Estado y condición */}
              <div className="section-title">Estado</div>
              <div className="card">
                <div className="field">
                  <div className="field-lbl">Estado</div>
                  <div className="seg">
                    {[['active','Activo'],['draft','Borrador'],['archived','Archivado']].map(([v, l]) => (
                      <button key={v} type="button" className={`seg-btn${status === v ? ' on' : ''}`} onClick={() => setStatus(v)}>{l}</button>
                    ))}
                  </div>
                </div>
                <div className="field">
                  <div className="field-lbl">Condición</div>
                  <div className="seg">
                    {[['new','Nuevo'],['used','Usado'],['refurbished','Reacondicionado']].map(([v, l]) => (
                      <button key={v} type="button" className={`seg-btn${condition === v ? ' on' : ''}`} onClick={() => setCondition(v)}>{l}</button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Categoría y marca */}
              {(categories.length > 0 || brands.length > 0) && (
                <>
                  <div className="section-title">Clasificación</div>
                  <div className="card">
                    <div className="two-col">
                      {categories.length > 0 && (
                        <div className="field">
                          <div className="field-lbl">Categoría</div>
                          <select className="field-select" value={categoryId} onChange={e => setCategoryId(e.target.value)}>
                            <option value="">Sin categoría</option>
                            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                          </select>
                        </div>
                      )}
                      {brands.length > 0 && (
                        <div className="field">
                          <div className="field-lbl">Marca</div>
                          <select className="field-select" value={brandId} onChange={e => setBrandId(e.target.value)}>
                            <option value="">Sin marca</option>
                            {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                          </select>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}

              {/* Variantes */}
              <div className="section-title">Variantes y precios</div>
              {variants.map((v, i) => (
                <div key={i} className="variant-block">
                  <div className="variant-header">
                    <div className="variant-title">Variante {i + 1}</div>
                    {variants.length > 1 && (
                      <button type="button" className="remove-btn" onClick={() => removeVariant(i)}>Eliminar</button>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div>
                      <div className="field-lbl">Nombre de variante</div>
                      <input className="field-input" type="text" value={v.name} onChange={e => updateVariant(i, 'name', e.target.value)} placeholder="Ej. Negro Talla M" />
                    </div>
                    <div>
                      <div className="field-lbl">SKU *</div>
                      <input className="field-input" type="text" value={v.sku} onChange={e => updateVariant(i, 'sku', e.target.value.toUpperCase())} placeholder="Ej. PLAY-NEG-M" />
                    </div>
                    <div className="price-row">
                      <div>
                        <div className="field-lbl">Precio de venta *</div>
                        <input className="field-input" type="number" min="0" step="0.01" value={v.sale_price} onChange={e => updateVariant(i, 'sale_price', e.target.value)} placeholder="0.00" />
                      </div>
                      <div>
                        <div className="field-lbl">Costo</div>
                        <input className="field-input" type="number" min="0" step="0.01" value={v.cost_price} onChange={e => updateVariant(i, 'cost_price', e.target.value)} placeholder="0.00" />
                      </div>
                    </div>
                    {mode === 'create' && (
                      <div>
                        <div className="field-lbl">Stock inicial</div>
                        <input className="field-input" type="number" min="0" step="1" value={v.stock} onChange={e => updateVariant(i, 'stock', e.target.value)} placeholder="0" />
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {mode === 'create' && (
                <button type="button" className="add-variant-btn" onClick={addVariant}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  Agregar otra variante
                </button>
              )}

              <button type="submit" className="save-btn" disabled={saving}>
                {saving ? 'Guardando...' : mode === 'create' ? 'Crear producto' : 'Guardar cambios'}
              </button>
            </form>
          </div>
        </main>
      </div>

      <BottomNav active="products" />
    </>
  )
}
