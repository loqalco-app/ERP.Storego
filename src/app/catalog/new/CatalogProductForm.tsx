'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import Sidebar from '@/components/Sidebar'

interface Category { id: string; name: string; parent_id: string | null }
interface Brand    { id: string; name: string }
interface Variant  { name: string; sku: string; sale_price: string; cost_price: string; stock: string }

interface Props {
  mode: 'create' | 'edit'
  orgId: string
  userName: string
  orgName: string
  categories: Category[]
  brands: Brand[]
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

export default function CatalogProductForm({ mode, orgId, userName, orgName, categories, brands, productId, initial }: Props) {
  const router = useRouter()

  const [name, setName]             = useState(initial?.name ?? '')
  const [desc, setDesc]             = useState(initial?.description ?? '')
  const [status, setStatus]         = useState(initial?.status ?? 'active')
  const [condition, setCondition]   = useState(initial?.condition ?? 'new')
  const [brandId, setBrandId]       = useState(initial?.brandId ?? '')

  // Cascading category: rootCatId → subcategoryId
  // Determine initial root/sub from initial.categoryId
  const initialCatId = initial?.categoryId ?? ''
  const [rootCatId, setRootCatId]   = useState(() => {
    if (!initialCatId) return ''
    const cat = categories.find(c => c.id === initialCatId)
    if (!cat) return ''
    return cat.parent_id ? cat.parent_id : cat.id
  })
  const [subCatId, setSubCatId]     = useState(() => {
    if (!initialCatId) return ''
    const cat = categories.find(c => c.id === initialCatId)
    return cat?.parent_id ? cat.id : ''
  })
  const categoryId = subCatId || rootCatId
  const [variants, setVariants]     = useState<Variant[]>(initial?.variants ?? [emptyVariant()])
  const [saving, setSaving]         = useState(false)
  const [err, setErr]               = useState<string | null>(null)

  // Para crear categoría inline
  const [newCatName, setNewCatName] = useState('')
  const [showNewCat, setShowNewCat] = useState(false)
  const [cats, setCats]             = useState<Category[]>(categories)

  // Para crear marca inline
  const [newBrandName, setNewBrandName] = useState('')
  const [showNewBrand, setShowNewBrand] = useState(false)
  const [brds, setBrds]                 = useState<Brand[]>(brands)
  const [brandErr, setBrandErr]         = useState<string | null>(null)
  const [catErr, setCatErr]             = useState<string | null>(null)

  async function createCategoryInline() {
    if (!newCatName.trim()) return
    setCatErr(null)
    const supabase = createClient()
    const { data, error } = await supabase.from('categories')
      .insert({ organization_id: orgId, name: newCatName.trim(), slug: slugify(newCatName.trim()) })
      .select('id, name, parent_id').single()
    if (error) { setCatErr(error.message.includes('slug') ? 'Ya existe una categoría con ese nombre.' : error.message); return }
    if (data) { setCats(cs => [...cs, data]); setRootCatId(data.id); setSubCatId(''); setNewCatName(''); setShowNewCat(false) }
  }

  async function createBrandInline() {
    if (!newBrandName.trim()) return
    setBrandErr(null)
    const supabase = createClient()
    const { data, error } = await supabase.from('brands')
      .insert({ organization_id: orgId, name: newBrandName.trim() })
      .select('id, name').single()
    if (error) { setBrandErr(error.message.includes('slug') ? 'Ya existe una marca con ese nombre.' : error.message); return }
    if (data) { setBrds(bs => [...bs, data]); setBrandId(data.id); setNewBrandName(''); setShowNewBrand(false) }
  }

  function updateVariant(i: number, field: keyof Variant, val: string) {
    setVariants(vs => vs.map((v, idx) => idx === i ? { ...v, [field]: val } : v))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setErr('El nombre del producto es obligatorio.'); return }
    const mainVariant = variants[0]
    if (!mainVariant.sku.trim()) { setErr('El SKU es obligatorio.'); return }
    if (!mainVariant.sale_price || isNaN(parseFloat(mainVariant.sale_price))) { setErr('El precio de venta es obligatorio.'); return }
    setSaving(true); setErr(null)

    const supabase = createClient()
    const slug = slugify(name.trim())

    if (mode === 'create') {
      const { data: product, error: pErr } = await supabase.from('products').insert({
        organization_id: orgId,
        name: name.trim(),
        description: desc.trim() || null,
        slug,
        status,
        condition,
        category_id: categoryId || null,
        brand_id: brandId || null,
      }).select('id').single()

      if (pErr) {
        setSaving(false)
        setErr(pErr.message.includes('slug') ? 'Ya existe un producto con ese nombre. Usa un nombre diferente.' : pErr.message)
        return
      }

      const { data: insertedVariants, error: vErr } = await supabase.from('product_variants').insert(
        variants.map(v => ({
          organization_id: orgId,
          product_id: product.id,
          name: v.name.trim() || 'Estándar',
          sku: v.sku.trim().toUpperCase(),
          sale_price: parseFloat(v.sale_price),
          cost_price: parseFloat(v.cost_price) || 0,
        }))
      ).select('id')

      if (vErr) {
        setSaving(false)
        setErr(vErr.message.includes('sku') ? 'Ese SKU ya existe. Usa uno diferente.' : vErr.message)
        return
      }

      // Stock inicial
      const hasStock = variants.some(v => parseFloat(v.stock) > 0)
      if (hasStock && insertedVariants) {
        let locationId: string | null = null
        const { data: loc } = await supabase.from('inventory_locations').select('id').eq('organization_id', orgId).eq('is_default', true).single()
        if (loc) {
          locationId = loc.id
        } else {
          const { data: newLoc } = await supabase.from('inventory_locations')
            .insert({ organization_id: orgId, name: 'Almacén principal', is_default: true })
            .select('id').single()
          locationId = newLoc?.id ?? null
        }

        if (locationId) {
          const userId = (await supabase.auth.getUser()).data.user?.id
          for (const [i, v] of variants.entries()) {
            const qty = parseFloat(v.stock)
            if (!qty || qty <= 0 || !insertedVariants[i]?.id) continue
            await supabase.from('inventory_ledger').insert({
              organization_id: orgId, variant_id: insertedVariants[i].id,
              location_id: locationId, movement_type: 'purchase',
              quantity: qty, unit_cost: parseFloat(v.cost_price) || 0,
              notes: 'Stock inicial', performed_by: userId,
            })
            await supabase.from('stock_levels').upsert({
              variant_id: insertedVariants[i].id, location_id: locationId,
              quantity_available: qty,
            }, { onConflict: 'variant_id,location_id' })
          }
        }
      }

      router.push('/catalog')

    } else {
      const { error: pErr } = await supabase.from('products').update({
        name: name.trim(), description: desc.trim() || null,
        status, condition,
        category_id: categoryId || null,
        brand_id: brandId || null,
      }).eq('id', productId)

      if (pErr) { setSaving(false); setErr(pErr.message); return }
      router.push('/catalog')
    }
  }

  const roots = cats.filter(c => !c.parent_id)

  return (
    <>
      <style>{`
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        body{background:var(--bg,#ECEEF2);font-family:var(--font,'Inter',-apple-system,sans-serif);-webkit-font-smoothing:antialiased}
        .topbar{padding-bottom:20px}
        .back-btn{width:38px;height:38px;border-radius:var(--r-sm,12px);background:var(--bg,#ECEEF2);display:flex;align-items:center;justify-content:center;text-decoration:none;flex-shrink:0;box-shadow:var(--shadow-sm)}
        .page-title{font-size:22px;font-weight:800;color:var(--text-1,#1A1A20);letter-spacing:-0.4px}
        @media(min-width:768px){.page-title{font-size:var(--text-xl,26px)}}
        .content{padding-left:20px;padding-right:20px;padding-bottom:calc(var(--nav-h,88px) + 16px)}
        @media(min-width:768px){.content{padding-left:40px;padding-right:40px;padding-bottom:calc(var(--nav-h,88px) + 16px);max-width:680px;margin:0 auto}}
        .sec-title{font-size:17px;font-weight:800;color:#1A1A20;letter-spacing:-0.3px;margin:20px 0 10px}
        .card{background:#ECEEF2;border-radius:24px;overflow:hidden;box-shadow:6px 6px 18px rgba(0,0,0,0.08),-4px -4px 12px rgba(255,255,255,0.95),inset 0 1px 0 rgba(255,255,255,0.7);margin-bottom:16px}
        .field{padding:14px 20px;border-top:1px solid rgba(0,0,0,0.05)}
        .field:first-child{border-top:none}
        .fl{font-size:11px;font-weight:700;color:rgba(26,26,32,0.35);text-transform:uppercase;letter-spacing:0.07em;margin-bottom:6px}
        .fi,.fta,.fsel{width:100%;padding:13px 16px;background:rgba(0,0,0,0.03);border:1.5px solid rgba(0,0,0,0.07);border-radius:14px;font-size:15px;font-weight:500;color:#1A1A20;font-family:inherit;outline:none;box-shadow:inset 2px 2px 6px rgba(0,0,0,0.06),inset -2px -2px 5px rgba(255,255,255,0.80);transition:border-color 0.15s}
        .fi:focus,.fta:focus,.fsel:focus{border-color:#2563EB;box-shadow:inset 2px 2px 6px rgba(0,0,0,0.06),inset -2px -2px 5px rgba(255,255,255,0.80),0 0 0 3px rgba(37,99,235,0.12)}
        .fta{resize:vertical;min-height:80px}
        .fsel{appearance:none;background-image:url("data:image/svg+xml,%3Csvg width='12' height='8' viewBox='0 0 12 8' fill='none'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%231A1A20' stroke-opacity='.4' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 14px center;padding-right:38px}
        .two{display:grid;grid-template-columns:1fr 1fr}
        .two .field{border-left:1px solid rgba(0,0,0,0.05)}
        .two .field:first-child{border-left:none}
        @media(max-width:480px){.two{grid-template-columns:1fr}.two .field{border-left:none;border-top:1px solid rgba(0,0,0,0.05)}}
        .seg{display:flex;gap:8px}
        .seg-btn{flex:1;padding:11px 8px;border-radius:12px;border:1.5px solid rgba(0,0,0,0.08);background:#ECEEF2;font-size:13px;font-weight:600;color:rgba(26,26,32,0.45);cursor:pointer;font-family:inherit;transition:all 0.15s}
        .seg-btn.on{background:#1D4ED8;color:white;border-color:#1D4ED8;box-shadow:0 4px 14px rgba(29,78,216,0.25)}
        .inline-new{display:flex;gap:8px;margin-top:8px}
        .inline-input{flex:1;padding:10px 12px;background:rgba(0,0,0,0.03);border:1.5px solid rgba(37,99,235,0.30);border-radius:12px;font-size:13px;font-weight:500;color:#1A1A20;font-family:inherit;outline:none}
        .inline-input:focus{border-color:#2563EB}
        .inline-btn{padding:10px 14px;border-radius:12px;border:none;background:#2563EB;color:white;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;white-space:nowrap}
        .inline-cancel{padding:10px 12px;border-radius:12px;border:1.5px solid rgba(0,0,0,0.10);background:transparent;font-size:13px;font-weight:600;color:rgba(26,26,32,0.45);cursor:pointer;font-family:inherit}
        .create-link{font-size:12px;color:#2563EB;font-weight:600;cursor:pointer;margin-top:6px;display:inline-block}
        .vblock{background:#ECEEF2;border-radius:18px;padding:16px;margin-bottom:12px;box-shadow:4px 4px 12px rgba(0,0,0,0.07),-3px -3px 8px rgba(255,255,255,0.90)}
        .vhdr{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}
        .vtitle{font-size:13px;font-weight:700;color:#1A1A20}
        .rm-btn{background:rgba(220,38,38,0.08);border:none;border-radius:8px;padding:5px 10px;font-size:12px;font-weight:600;color:#DC2626;cursor:pointer;font-family:inherit}
        .price-row{display:grid;grid-template-columns:1fr 1fr;gap:10px}
        .add-v-btn{display:flex;align-items:center;gap:8px;width:100%;padding:14px;border-radius:16px;border:1.5px dashed rgba(29,78,216,0.30);background:transparent;font-size:14px;font-weight:600;color:#2563EB;cursor:pointer;font-family:inherit;justify-content:center;transition:background 0.15s}
        .add-v-btn:hover{background:rgba(29,78,216,0.04)}
        .alert-e{background:rgba(220,38,38,0.07);border:1px solid rgba(220,38,38,0.15);border-radius:14px;padding:12px 16px;font-size:13px;font-weight:600;color:#991b1b;margin-bottom:16px}
        .save-btn{width:100%;padding:16px;background:linear-gradient(145deg,#1D4ED8,#2563EB);border:none;border-radius:18px;font-size:16px;font-weight:700;color:white;cursor:pointer;font-family:inherit;box-shadow:0 8px 24px rgba(29,78,216,0.30),inset 0 1px 0 rgba(255,255,255,0.20);transition:opacity 0.15s,transform 0.12s;margin-top:8px}
        .save-btn:hover{opacity:.92}
        .save-btn:active{transform:scale(0.98)}
        .save-btn:disabled{opacity:.5;cursor:not-allowed}
      `}</style>

      <Sidebar active="catalog" />
      <div className="topbar">
            <Link href="/catalog" className="back-btn">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1A1A20" strokeWidth="2.2" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
            </Link>
            <div className="page-title">{mode === 'create' ? 'Nuevo producto' : 'Editar producto'}</div>
          </div>

          <div className="content">
            {err && <div className="alert-e">{err}</div>}
            <form onSubmit={handleSubmit}>

              {/* Info básica */}
              <div className="sec-title">Información</div>
              <div className="card">
                <div className="field">
                  <div className="fl">Nombre del producto *</div>
                  <input className="fi" type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Ej. Playera básica cuello redondo" autoFocus />
                </div>
                <div className="field">
                  <div className="fl">Descripción (opcional)</div>
                  <textarea className="fta" value={desc} onChange={e => setDesc(e.target.value)} placeholder="Descripción del producto..." />
                </div>
              </div>

              {/* Categoría y Marca */}
              <div className="sec-title">Clasificación</div>
              <div className="card">
                {/* Categoría raíz */}
                <div className="field">
                  <div className="fl">Categoría</div>
                  <select className="fsel" value={rootCatId} onChange={e => { setRootCatId(e.target.value); setSubCatId('') }}>
                    <option value="">Sin categoría</option>
                    {roots.map(root => <option key={root.id} value={root.id}>{root.name}</option>)}
                  </select>
                  {showNewCat ? (
                    <>
                      <div className="inline-new">
                        <input className="inline-input" type="text" value={newCatName} onChange={e => { setNewCatName(e.target.value); setCatErr(null) }} placeholder="Nombre de la categoría..." autoFocus onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), createCategoryInline())} />
                        <button type="button" className="inline-btn" onClick={createCategoryInline}>Crear</button>
                        <button type="button" className="inline-cancel" onClick={() => { setShowNewCat(false); setCatErr(null) }}>×</button>
                      </div>
                      {catErr && <div style={{marginTop:6,fontSize:12,color:'#991b1b',fontWeight:600}}>⚠ {catErr}</div>}
                    </>
                  ) : (
                    <span className="create-link" onClick={() => setShowNewCat(true)}>+ Crear nueva categoría</span>
                  )}
                </div>
                {/* Subcategoría — solo aparece si la categoría raíz tiene hijos */}
                {rootCatId && cats.filter(c => c.parent_id === rootCatId).length > 0 && (
                  <div className="field">
                    <div className="fl">Subcategoría</div>
                    <select className="fsel" value={subCatId} onChange={e => setSubCatId(e.target.value)}>
                      <option value="">Sin subcategoría (usar categoría raíz)</option>
                      {cats.filter(c => c.parent_id === rootCatId).map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="field">
                  <div className="fl">Marca</div>
                  <select className="fsel" value={brandId} onChange={e => setBrandId(e.target.value)}>
                    <option value="">Sin marca</option>
                    {brds.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                  {showNewBrand ? (
                    <>
                      <div className="inline-new">
                        <input className="inline-input" type="text" value={newBrandName} onChange={e => { setNewBrandName(e.target.value); setBrandErr(null) }} placeholder="Nombre de la marca..." autoFocus onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), createBrandInline())} />
                        <button type="button" className="inline-btn" onClick={createBrandInline}>Crear</button>
                        <button type="button" className="inline-cancel" onClick={() => { setShowNewBrand(false); setBrandErr(null) }}>×</button>
                      </div>
                      {brandErr && <div style={{marginTop:6,fontSize:12,color:'#991b1b',fontWeight:600}}>⚠ {brandErr}</div>}
                    </>
                  ) : (
                    <span className="create-link" onClick={() => setShowNewBrand(true)}>+ Crear nueva marca</span>
                  )}
                </div>
              </div>

              {/* Condición y estado */}
              <div className="sec-title">Estado</div>
              <div className="card">
                <div className="field">
                  <div className="fl">Condición</div>
                  <div className="seg">
                    {[['new','Nuevo'],['used','Usado'],['refurbished','Reacondicionado']].map(([v,l]) => (
                      <button key={v} type="button" className={`seg-btn${condition===v?' on':''}`} onClick={() => setCondition(v)}>{l}</button>
                    ))}
                  </div>
                </div>
                <div className="field">
                  <div className="fl">Estado</div>
                  <div className="seg">
                    {[['active','Activo'],['draft','Borrador'],['archived','Archivado']].map(([v,l]) => (
                      <button key={v} type="button" className={`seg-btn${status===v?' on':''}`} onClick={() => setStatus(v)}>{l}</button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Variantes */}
              <div className="sec-title">Precios, SKU y cantidad</div>
              {variants.map((v, i) => (
                <div key={i} className="vblock">
                  <div className="vhdr">
                    <div className="vtitle">{variants.length > 1 ? `Variante ${i+1}` : 'Producto'}</div>
                    {variants.length > 1 && <button type="button" className="rm-btn" onClick={() => setVariants(vs => vs.filter((_,idx) => idx!==i))}>Eliminar</button>}
                  </div>
                  <div style={{display:'flex',flexDirection:'column',gap:10}}>
                    {variants.length > 1 && (
                      <div>
                        <div className="fl">Nombre de variante</div>
                        <input className="fi" type="text" value={v.name} onChange={e => updateVariant(i,'name',e.target.value)} placeholder="Ej. Negro Talla M" />
                      </div>
                    )}
                    <div>
                      <div className="fl">SKU / Código *</div>
                      <input className="fi" type="text" value={v.sku} onChange={e => updateVariant(i,'sku',e.target.value.toUpperCase())} placeholder="Ej. PLAY-NEG-M" />
                    </div>
                    <div className="price-row">
                      <div>
                        <div className="fl">Precio de adquisición</div>
                        <input className="fi" type="number" min="0" step="0.01" value={v.cost_price} onChange={e => updateVariant(i,'cost_price',e.target.value)} placeholder="0.00" />
                      </div>
                      <div>
                        <div className="fl">Precio de venta *</div>
                        <input className="fi" type="number" min="0" step="0.01" value={v.sale_price} onChange={e => updateVariant(i,'sale_price',e.target.value)} placeholder="0.00" />
                      </div>
                    </div>
                    {mode === 'create' && (
                      <div>
                        <div className="fl">Cantidad en stock</div>
                        <input className="fi" type="number" min="0" step="1" value={v.stock} onChange={e => updateVariant(i,'stock',e.target.value)} placeholder="0" />
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {mode === 'create' && (
                <button type="button" className="add-v-btn" onClick={() => setVariants(vs => [...vs, emptyVariant()])}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  Agregar otra variante
                </button>
              )}

              <button type="submit" className="save-btn" disabled={saving}>
                {saving ? 'Guardando...' : mode === 'create' ? 'Agregar al inventario' : 'Guardar cambios'}
              </button>
            </form>
          </div>
    </>
  )
}
