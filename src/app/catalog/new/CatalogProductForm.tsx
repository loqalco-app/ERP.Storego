'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import Sidebar from '@/components/Sidebar'

interface Category { id: string; name: string; parent_id: string | null }
interface Brand    { id: string; name: string }
interface Variant  { name: string; sku: string; sale_price: string; cost_price: string; stock: string }
interface PhotoEntry { url: string; path: string; colorName: string | null; tempId: string }

interface Props {
  mode: 'create' | 'edit'
  orgId: string; userName: string; orgName: string
  categories: Category[]; brands: Brand[]
  productId?: string
  initial?: { name: string; description: string; status: string; condition: string; categoryId: string; brandId: string; variants: Variant[] }
}

function slugify(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}
function uid() { return Math.random().toString(36).slice(2, 8) }

const emptyVariant = (name = ''): Variant => ({ name, sku: '', sale_price: '', cost_price: '', stock: '' })

export default function CatalogProductForm({ mode, orgId, userName, orgName, categories, brands, productId, initial }: Props) {
  const router = useRouter()

  // ── Basic info ──
  const [name, setName]           = useState(initial?.name ?? '')
  const [desc, setDesc]           = useState(initial?.description ?? '')
  const [status, setStatus]       = useState(initial?.status ?? 'active')
  const [condition, setCondition] = useState(initial?.condition ?? 'new')
  const [brandId, setBrandId]     = useState(initial?.brandId ?? '')

  // ── Category cascade ──
  const initialCatId = initial?.categoryId ?? ''
  const [rootCatId, setRootCatId] = useState(() => {
    if (!initialCatId) return ''
    const cat = categories.find(c => c.id === initialCatId)
    return cat?.parent_id ? cat.parent_id : cat?.id ?? ''
  })
  const [subCatId, setSubCatId]   = useState(() => {
    if (!initialCatId) return ''
    const cat = categories.find(c => c.id === initialCatId)
    return cat?.parent_id ? cat.id : ''
  })
  const categoryId = subCatId || rootCatId
  const [cats, setCats]           = useState<Category[]>(categories)
  const [brds, setBrds]           = useState<Brand[]>(brands)

  // ── Option builder ──
  const [colorInput, setColorInput] = useState('')
  const [sizeInput, setSizeInput]   = useState('')
  const [colorOptions, setColorOptions] = useState<string[]>([])
  const [sizeOptions, setSizeOptions]   = useState<string[]>([])

  // ── Variants ──
  const [variants, setVariants] = useState<Variant[]>(initial?.variants ?? [emptyVariant()])

  // ── Photos ──
  const [photos, setPhotos]         = useState<PhotoEntry[]>([])
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const photoInputRef               = useRef<HTMLInputElement>(null)

  // ── Inline create ──
  const [newCatName, setNewCatName]     = useState(''); const [showNewCat, setShowNewCat] = useState(false); const [catErr, setCatErr] = useState<string | null>(null)
  const [newBrandName, setNewBrandName] = useState(''); const [showNewBrand, setShowNewBrand] = useState(false); const [brandErr, setBrandErr] = useState<string | null>(null)

  // ── Save ──
  const [saving, setSaving] = useState(false)
  const [err, setErr]       = useState<string | null>(null)

  // ───────────── Helpers ─────────────

  function addColor() {
    const v = colorInput.trim()
    if (!v || colorOptions.includes(v)) return
    setColorOptions(c => [...c, v]); setColorInput('')
  }
  function addSize() {
    const v = sizeInput.trim()
    if (!v || sizeOptions.includes(v)) return
    setSizeOptions(s => [...s, v]); setSizeInput('')
  }
  function removeColor(c: string) { setColorOptions(o => o.filter(x => x !== c)) }
  function removeSize(s: string)  { setSizeOptions(o => o.filter(x => x !== s)) }

  function generateCombinations() {
    const colors = colorOptions.length > 0 ? colorOptions : ['']
    const sizes  = sizeOptions.length  > 0 ? sizeOptions  : ['']
    const generated: Variant[] = []
    for (const color of colors) {
      for (const size of sizes) {
        const varName = [color, size].filter(Boolean).join(' / ')
        const skuHint = slugify(varName).toUpperCase().slice(0, 14)
        generated.push(emptyVariant(varName))
        generated[generated.length - 1].sku = skuHint
      }
    }
    setVariants(generated)
  }

  function updateVariant(i: number, field: keyof Variant, val: string) {
    setVariants(vs => vs.map((v, idx) => idx === i ? { ...v, [field]: val } : v))
  }

  async function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    setUploadingPhoto(true)
    const supabase = createClient()
    for (const file of files) {
      const ext  = file.name.split('.').pop() ?? 'jpg'
      const path = `${orgId}/${uid()}.${ext}`
      const { error } = await supabase.storage.from('product-images').upload(path, file)
      if (error) { setErr('Error subiendo foto: ' + error.message); continue }
      const { data: { publicUrl } } = supabase.storage.from('product-images').getPublicUrl(path)
      setPhotos(p => [...p, { url: publicUrl, path, colorName: null, tempId: uid() }])
    }
    setUploadingPhoto(false)
    if (photoInputRef.current) photoInputRef.current.value = ''
  }

  async function removePhoto(tempId: string, path: string) {
    const supabase = createClient()
    await supabase.storage.from('product-images').remove([path])
    setPhotos(p => p.filter(x => x.tempId !== tempId))
  }

  async function createCategoryInline() {
    if (!newCatName.trim()) return; setCatErr(null)
    const supabase = createClient()
    const { data, error } = await supabase.from('categories').insert({ organization_id: orgId, name: newCatName.trim(), slug: slugify(newCatName.trim()) }).select('id, name, parent_id').single()
    if (error) { setCatErr(error.message.includes('slug') ? 'Ya existe esa categoría.' : error.message); return }
    if (data) { setCats(c => [...c, data]); setRootCatId(data.id); setSubCatId(''); setNewCatName(''); setShowNewCat(false) }
  }

  async function createBrandInline() {
    if (!newBrandName.trim()) return; setBrandErr(null)
    const supabase = createClient()
    const { data, error } = await supabase.from('brands').insert({ organization_id: orgId, name: newBrandName.trim() }).select('id, name').single()
    if (error) { setBrandErr(error.message); return }
    if (data) { setBrds(b => [...b, data]); setBrandId(data.id); setNewBrandName(''); setShowNewBrand(false) }
  }

  // ───────────── Submit ─────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setErr('El nombre del producto es obligatorio.'); return }
    const mainV = variants[0]
    if (!mainV?.sku.trim()) { setErr('El SKU es obligatorio en al menos una variante.'); return }
    if (!mainV?.sale_price || isNaN(parseFloat(mainV.sale_price))) { setErr('El precio de venta es obligatorio.'); return }
    setSaving(true); setErr(null)

    const supabase = createClient()

    if (mode === 'create') {
      // Try clean slug, auto-suffix on conflict
      let slug = slugify(name.trim())
      let { data: product, error: pErr } = await supabase.from('products').insert({
        organization_id: orgId, name: name.trim(), description: desc.trim() || null,
        slug, status, condition, category_id: categoryId || null, brand_id: brandId || null,
      }).select('id').single()

      if (pErr?.code === '23505' || pErr?.message.includes('slug')) {
        slug = slugify(name.trim()) + '-' + uid()
        const retry = await supabase.from('products').insert({
          organization_id: orgId, name: name.trim(), description: desc.trim() || null,
          slug, status, condition, category_id: categoryId || null, brand_id: brandId || null,
        }).select('id').single()
        if (retry.error) { setSaving(false); setErr(retry.error.message); return }
        product = retry.data
      } else if (pErr) { setSaving(false); setErr(pErr.message); return }

      // Variants
      const { data: insertedVariants, error: vErr } = await supabase.from('product_variants').insert(
        variants.map(v => ({
          organization_id: orgId, product_id: product!.id,
          name: v.name.trim() || 'Estándar',
          sku: v.sku.trim().toUpperCase(),
          sale_price: parseFloat(v.sale_price),
          cost_price: parseFloat(v.cost_price) || 0,
        }))
      ).select('id, name')

      if (vErr) { setSaving(false); setErr(vErr.message.includes('sku') ? 'Un SKU ya existe. Cámbialo e intenta de nuevo.' : vErr.message); return }

      // Stock inicial
      if (insertedVariants) {
        const hasStock = variants.some(v => parseFloat(v.stock) > 0)
        if (hasStock) {
          let locationId: string | null = null
          const { data: loc } = await supabase.from('inventory_locations').select('id').eq('organization_id', orgId).eq('is_default', true).single()
          if (loc) { locationId = loc.id } else {
            const { data: newLoc } = await supabase.from('inventory_locations').insert({ organization_id: orgId, name: 'Almacén principal', is_default: true }).select('id').single()
            locationId = newLoc?.id ?? null
          }
          if (locationId) {
            const userId = (await supabase.auth.getUser()).data.user?.id
            for (const [i, v] of variants.entries()) {
              const qty = parseFloat(v.stock)
              if (!qty || qty <= 0 || !insertedVariants[i]?.id) continue
              await supabase.from('inventory_ledger').insert({ organization_id: orgId, variant_id: insertedVariants[i].id, location_id: locationId, movement_type: 'purchase', quantity: qty, unit_cost: parseFloat(v.cost_price) || 0, notes: 'Stock inicial', performed_by: userId })
              await supabase.from('stock_levels').upsert({ variant_id: insertedVariants[i].id, location_id: locationId, quantity_available: qty }, { onConflict: 'variant_id,location_id' })
            }
          }
        }

        // Photos — link to product and variant by color
        if (photos.length > 0) {
          const variantByColor: Record<string, string> = {}
          for (const iv of insertedVariants) {
            const color = iv.name?.split(' / ')[0] ?? ''
            if (color && !variantByColor[color]) variantByColor[color] = iv.id
          }
          await supabase.from('product_images').insert(
            photos.map((p, idx) => ({
              product_id: product!.id,
              url: p.url,
              is_primary: idx === 0,
              sort_order: idx,
              variant_id: p.colorName ? (variantByColor[p.colorName] ?? null) : null,
            }))
          )
        }
      }

      router.push('/catalog')

    } else {
      const { error: pErr } = await supabase.from('products').update({
        name: name.trim(), description: desc.trim() || null,
        status, condition, category_id: categoryId || null, brand_id: brandId || null,
      }).eq('id', productId)
      if (pErr) { setSaving(false); setErr(pErr.message); return }
      router.push('/catalog')
    }
  }

  // ───────────── Render ─────────────

  const roots = cats.filter(c => !c.parent_id)
  const subs  = cats.filter(c => c.parent_id === rootCatId)

  return (
    <>
      <style>{`
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        body{background:#ECEEF2;font-family:'Inter',-apple-system,sans-serif;-webkit-font-smoothing:antialiased}

        /* Page shell */
        .pf-shell{display:flex;flex-direction:column;min-height:100dvh}
        @media(min-width:768px){.pf-shell{padding-top:60px}}

        /* Topbar */
        .pf-topbar{display:flex;align-items:center;gap:14px;padding:16px 20px 12px;position:sticky;top:0;z-index:10;background:rgba(236,238,242,0.92);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px)}
        @media(min-width:768px){.pf-topbar{padding:14px 40px 12px}}
        .back-btn{width:36px;height:36px;border-radius:10px;background:#ECEEF2;display:flex;align-items:center;justify-content:center;text-decoration:none;flex-shrink:0;box-shadow:3px 3px 8px rgba(0,0,0,0.10),-2px -2px 6px rgba(255,255,255,0.90)}
        .pf-title{font-size:20px;font-weight:800;color:#1A1A20;letter-spacing:-0.3px;flex:1}
        .save-top-btn{padding:9px 20px;border-radius:12px;border:none;background:linear-gradient(145deg,#1D4ED8,#2563EB);font-size:14px;font-weight:700;color:white;cursor:pointer;font-family:inherit;white-space:nowrap;box-shadow:0 4px 14px rgba(29,78,216,0.28)}
        .save-top-btn:disabled{opacity:.5;cursor:not-allowed}

        /* Two-col grid */
        .pf-grid{display:flex;flex-direction:column;gap:0;padding:0 16px 100px}
        @media(min-width:900px){.pf-grid{display:grid;grid-template-columns:1fr 1.3fr;gap:24px;padding:20px 40px 60px;align-items:start}}

        /* Cards */
        .sec-lbl{font-size:11px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:rgba(26,26,32,0.35);margin:18px 0 8px}
        .sec-lbl:first-child{margin-top:0}
        .card{background:#ECEEF2;border-radius:20px;overflow:hidden;box-shadow:6px 6px 18px rgba(0,0,0,0.08),-4px -4px 12px rgba(255,255,255,0.95),inset 0 1px 0 rgba(255,255,255,0.7);margin-bottom:12px}
        .field{padding:13px 18px;border-top:1px solid rgba(0,0,0,0.05)}
        .field:first-child{border-top:none}
        .fl{font-size:11px;font-weight:700;color:rgba(26,26,32,0.35);text-transform:uppercase;letter-spacing:0.07em;margin-bottom:6px}
        .fi,.fta,.fsel{width:100%;padding:11px 14px;background:rgba(0,0,0,0.03);border:1.5px solid rgba(0,0,0,0.07);border-radius:12px;font-size:14px;font-weight:500;color:#1A1A20;font-family:inherit;outline:none;transition:border-color 0.15s;box-shadow:inset 2px 2px 5px rgba(0,0,0,0.05),inset -2px -2px 4px rgba(255,255,255,0.75)}
        .fi:focus,.fta:focus,.fsel:focus{border-color:#2563EB}
        .fta{resize:vertical;min-height:72px}
        .fsel{appearance:none;background-image:url("data:image/svg+xml,%3Csvg width='12' height='8' viewBox='0 0 12 8' fill='none'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%231A1A20' stroke-opacity='.4' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 12px center;padding-right:36px}
        .seg{display:flex;gap:6px;flex-wrap:wrap}
        .seg-btn{flex:1;min-width:fit-content;padding:9px 10px;border-radius:10px;border:1.5px solid rgba(0,0,0,0.08);background:#ECEEF2;font-size:12px;font-weight:600;color:rgba(26,26,32,0.45);cursor:pointer;font-family:inherit;transition:all 0.15s;white-space:nowrap}
        .seg-btn.on{background:#1D4ED8;color:white;border-color:#1D4ED8;box-shadow:0 3px 10px rgba(29,78,216,0.22)}
        .create-link{font-size:12px;color:#2563EB;font-weight:600;cursor:pointer;margin-top:6px;display:inline-block}
        .inline-row{display:flex;gap:6px;margin-top:8px}
        .inline-input{flex:1;padding:9px 12px;background:rgba(0,0,0,0.03);border:1.5px solid rgba(37,99,235,0.30);border-radius:10px;font-size:13px;font-weight:500;color:#1A1A20;font-family:inherit;outline:none}
        .inline-input:focus{border-color:#2563EB}
        .inline-btn{padding:9px 14px;border-radius:10px;border:none;background:#2563EB;color:white;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;white-space:nowrap}
        .inline-cancel{padding:9px 12px;border-radius:10px;border:1.5px solid rgba(0,0,0,0.10);background:transparent;font-size:13px;font-weight:600;color:rgba(26,26,32,0.45);cursor:pointer;font-family:inherit}

        /* Options / tags */
        .opt-row{display:flex;gap:8px;align-items:center;margin-bottom:8px}
        .opt-input{flex:1;padding:9px 12px;background:rgba(0,0,0,0.03);border:1.5px solid rgba(0,0,0,0.07);border-radius:10px;font-size:13px;font-weight:500;color:#1A1A20;font-family:inherit;outline:none}
        .opt-input:focus{border-color:#2563EB}
        .opt-add-btn{padding:9px 14px;border-radius:10px;border:none;background:#1A1A20;color:#CAFF3A;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;white-space:nowrap}
        .tags{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:2px}
        .tag{display:flex;align-items:center;gap:5px;padding:4px 10px;border-radius:50px;background:rgba(0,0,0,0.07);font-size:12px;font-weight:700;color:#1A1A20}
        .tag-rm{background:none;border:none;cursor:pointer;color:rgba(26,26,32,0.40);font-size:14px;line-height:1;padding:0 2px}
        .tag-rm:hover{color:#DC2626}
        .gen-btn{width:100%;padding:11px;border-radius:12px;border:1.5px dashed rgba(29,78,216,0.35);background:rgba(29,78,216,0.04);font-size:13px;font-weight:700;color:#2563EB;cursor:pointer;font-family:inherit;margin-top:10px;transition:background 0.15s}
        .gen-btn:hover{background:rgba(29,78,216,0.08)}

        /* Variant cards */
        .vcard{background:#ECEEF2;border-radius:16px;padding:14px;margin-bottom:8px;box-shadow:4px 4px 12px rgba(0,0,0,0.07),-3px -3px 8px rgba(255,255,255,0.90)}
        .vcard-hdr{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}
        .vcard-name{font-size:13px;font-weight:700;color:#1A1A20}
        .rm-btn{padding:4px 10px;border-radius:8px;border:none;background:rgba(220,38,38,0.08);font-size:11px;font-weight:700;color:#DC2626;cursor:pointer;font-family:inherit}
        .v-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
        .v-grid-3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px}
        .add-v-btn{display:flex;align-items:center;gap:6px;width:100%;padding:11px;border-radius:12px;border:1.5px dashed rgba(0,0,0,0.15);background:transparent;font-size:13px;font-weight:600;color:rgba(26,26,32,0.45);cursor:pointer;font-family:inherit;justify-content:center;margin-top:4px;transition:all 0.15s}
        .add-v-btn:hover{border-color:#2563EB;color:#2563EB;background:rgba(29,78,216,0.04)}

        /* Photos */
        .photo-drop{border:2px dashed rgba(0,0,0,0.12);border-radius:16px;padding:24px;text-align:center;cursor:pointer;transition:border-color 0.15s,background 0.15s;background:rgba(0,0,0,0.01);margin-bottom:10px}
        .photo-drop:hover{border-color:#2563EB;background:rgba(29,78,216,0.03)}
        .photo-drop-txt{font-size:13px;font-weight:600;color:rgba(26,26,32,0.40)}
        .photo-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:10px}
        .photo-item{position:relative;aspect-ratio:1;border-radius:12px;overflow:hidden;background:rgba(0,0,0,0.05)}
        .photo-img{width:100%;height:100%;object-fit:cover}
        .photo-rm{position:absolute;top:4px;right:4px;width:22px;height:22px;border-radius:50%;border:none;background:rgba(0,0,0,0.55);color:white;font-size:12px;cursor:pointer;display:flex;align-items:center;justify-content:center;font-weight:700}
        .photo-color-sel{width:100%;padding:4px 8px;border-radius:8px;border:1px solid rgba(0,0,0,0.10);background:rgba(236,238,242,0.90);font-size:11px;font-weight:600;color:#1A1A20;font-family:inherit;outline:none;margin-top:4px}

        /* Error */
        .alert-e{background:rgba(220,38,38,0.07);border:1px solid rgba(220,38,38,0.15);border-radius:14px;padding:12px 16px;font-size:13px;font-weight:600;color:#991b1b;margin-bottom:14px}
      `}</style>

      <Sidebar active="catalog" />

      <div className="pf-shell">
        {/* Topbar */}
        <div className="pf-topbar">
          <Link href="/catalog" className="back-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1A1A20" strokeWidth="2.2" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
          </Link>
          <div className="pf-title">{mode === 'create' ? 'Nuevo producto' : 'Editar producto'}</div>
          <button className="save-top-btn" disabled={saving} onClick={handleSubmit as any}>
            {saving ? 'Guardando…' : mode === 'create' ? 'Agregar al inventario' : 'Guardar cambios'}
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="pf-grid">

            {/* ══ COLUMNA IZQUIERDA ══ */}
            <div>
              {err && <div className="alert-e">{err}</div>}

              <div className="sec-lbl">Información</div>
              <div className="card">
                <div className="field">
                  <div className="fl">Nombre del producto *</div>
                  <input className="fi" type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Ej. Camiseta cuello redondo" autoFocus />
                </div>
                <div className="field">
                  <div className="fl">Descripción</div>
                  <textarea className="fta" value={desc} onChange={e => setDesc(e.target.value)} placeholder="Descripción, materiales, detalles…" />
                </div>
              </div>

              <div className="sec-lbl">Clasificación</div>
              <div className="card">
                <div className="field">
                  <div className="fl">Categoría</div>
                  <select className="fsel" value={rootCatId} onChange={e => { setRootCatId(e.target.value); setSubCatId('') }}>
                    <option value="">Sin categoría</option>
                    {roots.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                  {showNewCat ? (
                    <>
                      <div className="inline-row">
                        <input className="inline-input" value={newCatName} onChange={e => { setNewCatName(e.target.value); setCatErr(null) }} placeholder="Nombre…" autoFocus onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), createCategoryInline())} />
                        <button type="button" className="inline-btn" onClick={createCategoryInline}>Crear</button>
                        <button type="button" className="inline-cancel" onClick={() => setShowNewCat(false)}>×</button>
                      </div>
                      {catErr && <div style={{ marginTop: 5, fontSize: 12, color: '#991b1b', fontWeight: 600 }}>⚠ {catErr}</div>}
                    </>
                  ) : <span className="create-link" onClick={() => setShowNewCat(true)}>+ Nueva categoría</span>}
                </div>
                {rootCatId && subs.length > 0 && (
                  <div className="field">
                    <div className="fl">Subcategoría</div>
                    <select className="fsel" value={subCatId} onChange={e => setSubCatId(e.target.value)}>
                      <option value="">— usar categoría principal —</option>
                      {subs.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
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
                      <div className="inline-row">
                        <input className="inline-input" value={newBrandName} onChange={e => { setNewBrandName(e.target.value); setBrandErr(null) }} placeholder="Nombre de la marca…" autoFocus onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), createBrandInline())} />
                        <button type="button" className="inline-btn" onClick={createBrandInline}>Crear</button>
                        <button type="button" className="inline-cancel" onClick={() => setShowNewBrand(false)}>×</button>
                      </div>
                      {brandErr && <div style={{ marginTop: 5, fontSize: 12, color: '#991b1b', fontWeight: 600 }}>⚠ {brandErr}</div>}
                    </>
                  ) : <span className="create-link" onClick={() => setShowNewBrand(true)}>+ Nueva marca</span>}
                </div>
              </div>

              <div className="sec-lbl">Estado</div>
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
            </div>

            {/* ══ COLUMNA DERECHA ══ */}
            <div>

              {/* Fotos */}
              <div className="sec-lbl">Fotos del producto</div>
              {photos.length > 0 && (
                <div className="photo-grid">
                  {photos.map(p => (
                    <div key={p.tempId}>
                      <div className="photo-item">
                        <img className="photo-img" src={p.url} alt="" />
                        <button type="button" className="photo-rm" onClick={() => removePhoto(p.tempId, p.path)}>×</button>
                      </div>
                      {colorOptions.length > 0 && (
                        <select className="photo-color-sel" value={p.colorName ?? ''} onChange={e => setPhotos(ps => ps.map(x => x.tempId === p.tempId ? { ...x, colorName: e.target.value || null } : x))}>
                          <option value="">General</option>
                          {colorOptions.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      )}
                    </div>
                  ))}
                </div>
              )}
              <div className="photo-drop" onClick={() => photoInputRef.current?.click()}>
                <input ref={photoInputRef} type="file" accept="image/*" multiple hidden onChange={handlePhotoSelect} />
                {uploadingPhoto
                  ? <div className="photo-drop-txt">Subiendo fotos…</div>
                  : <div className="photo-drop-txt">{photos.length === 0 ? '📷  Clic para agregar fotos' : '+ Agregar más fotos'}</div>
                }
              </div>
              {colorOptions.length > 0 && photos.length > 0 && (
                <div style={{ fontSize: 11, color: 'rgba(26,26,32,0.38)', fontWeight: 500, marginBottom: 12 }}>
                  Asigna cada foto a un color para que cambie al seleccionarlo en la tienda
                </div>
              )}

              {/* Opciones */}
              <div className="sec-lbl">Opciones de variantes</div>
              <div className="card">
                <div className="field">
                  <div className="fl">Colores</div>
                  {colorOptions.length > 0 && (
                    <div className="tags" style={{ marginBottom: 8 }}>
                      {colorOptions.map(c => (
                        <span key={c} className="tag">{c}<button type="button" className="tag-rm" onClick={() => removeColor(c)}>×</button></span>
                      ))}
                    </div>
                  )}
                  <div className="opt-row">
                    <input className="opt-input" value={colorInput} onChange={e => setColorInput(e.target.value)} placeholder="Ej. Blanco, Negro, Azul…" onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addColor())} />
                    <button type="button" className="opt-add-btn" onClick={addColor}>+ Agregar</button>
                  </div>
                </div>
                <div className="field">
                  <div className="fl">Tallas</div>
                  {sizeOptions.length > 0 && (
                    <div className="tags" style={{ marginBottom: 8 }}>
                      {sizeOptions.map(s => (
                        <span key={s} className="tag">{s}<button type="button" className="tag-rm" onClick={() => removeSize(s)}>×</button></span>
                      ))}
                    </div>
                  )}
                  <div className="opt-row">
                    <input className="opt-input" value={sizeInput} onChange={e => setSizeInput(e.target.value)} placeholder="Ej. XS, S, M, L, XL…" onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addSize())} />
                    <button type="button" className="opt-add-btn" onClick={addSize}>+ Agregar</button>
                  </div>
                </div>
                {(colorOptions.length > 0 || sizeOptions.length > 0) && (
                  <div className="field">
                    <button type="button" className="gen-btn" onClick={generateCombinations}>
                      ⚡ Generar {colorOptions.length > 0 && sizeOptions.length > 0 ? `${colorOptions.length * sizeOptions.length} combinaciones` : `${Math.max(colorOptions.length, sizeOptions.length)} variantes`}
                    </button>
                  </div>
                )}
              </div>

              {/* Variantes */}
              <div className="sec-lbl">Variantes — precio, SKU y stock</div>
              {variants.map((v, i) => (
                <div key={i} className="vcard">
                  <div className="vcard-hdr">
                    <div className="vcard-name">{v.name || `Variante ${i + 1}`}</div>
                    {variants.length > 1 && <button type="button" className="rm-btn" onClick={() => setVariants(vs => vs.filter((_, idx) => idx !== i))}>Eliminar</button>}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {variants.length > 1 && (
                      <div>
                        <div className="fl">Nombre de variante</div>
                        <input className="fi" type="text" value={v.name} onChange={e => updateVariant(i, 'name', e.target.value)} placeholder="Ej. Blanco / M" />
                      </div>
                    )}
                    <div>
                      <div className="fl">SKU / Código *</div>
                      <input className="fi" type="text" value={v.sku} onChange={e => updateVariant(i, 'sku', e.target.value.toUpperCase())} placeholder="Ej. CAM-BLA-M" />
                    </div>
                    <div className="v-grid">
                      <div>
                        <div className="fl">Costo</div>
                        <input className="fi" type="number" min="0" step="0.01" value={v.cost_price} onChange={e => updateVariant(i, 'cost_price', e.target.value)} placeholder="0.00" />
                      </div>
                      <div>
                        <div className="fl">Precio venta *</div>
                        <input className="fi" type="number" min="0" step="0.01" value={v.sale_price} onChange={e => updateVariant(i, 'sale_price', e.target.value)} placeholder="0.00" />
                      </div>
                    </div>
                    {mode === 'create' && (
                      <div>
                        <div className="fl">Cantidad inicial</div>
                        <input className="fi" type="number" min="0" step="1" value={v.stock} onChange={e => updateVariant(i, 'stock', e.target.value)} placeholder="0" />
                      </div>
                    )}
                  </div>
                </div>
              ))}
              <button type="button" className="add-v-btn" onClick={() => setVariants(vs => [...vs, emptyVariant()])}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Agregar variante manual
              </button>

            </div>
          </div>
        </form>
      </div>
    </>
  )
}
