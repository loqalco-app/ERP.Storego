'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Sidebar from '@/components/Sidebar'
import BottomNav from '@/components/BottomNav'
import { createClient } from '@/lib/supabase/client'

/* ── Types ── */
interface Category { id: string; name: string; slug: string; description: string | null; parent_id: string | null }
interface Brand    { id: string; name: string; description: string | null }
interface Variant  { id: string; sku: string; sale_price: number; stock_levels: { quantity_available: number }[] }
interface Product  { id: string; name: string; status: string; condition: string; created_at: string; categories: { id: string; name: string } | null; brands: { id: string; name: string } | null; product_variants: Variant[] }

interface Props { products: Product[]; categories: Category[]; brands: Brand[]; orgId: string; userName: string; orgName: string }

/* ── Helpers ── */
function slugify(s: string) { return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'') }
function totalStock(variants: Variant[]) { return variants.reduce((s,v) => s + v.stock_levels.reduce((a,sl) => a + sl.quantity_available, 0), 0) }
function minPrice(variants: Variant[]) { if (!variants.length) return null; return Math.min(...variants.map(v => v.sale_price)) }
const STATUS_LABEL: Record<string,string> = { active:'Activo', draft:'Borrador', archived:'Archivado' }
const STATUS_COLOR: Record<string,string> = { active:'rgba(5,150,105,0.10);color:#065f46', draft:'rgba(202,138,4,0.10);color:#92400e', archived:'rgba(107,114,128,0.12);color:#374151' }

/* ── Component ── */
export default function CatalogClient({ products: initProducts, categories: initCats, brands: initBrands, orgId, userName, orgName }: Props) {
  const router = useRouter()
  const [tab, setTab]             = useState<'products'|'categories'|'brands'>('products')
  const [products, setProducts]   = useState(initProducts)
  const [categories, setCategories] = useState(initCats)
  const [brands, setBrands]       = useState(initBrands)
  const [q, setQ]                 = useState('')

  // Modal state
  const [modal, setModal] = useState<null|'category'|'brand'>(null)
  const [editItem, setEditItem]   = useState<Category|Brand|null>(null)
  const [mName, setMName]         = useState('')
  const [mDesc, setMDesc]         = useState('')
  const [mParent, setMParent]     = useState('')
  const [saving, setSaving]       = useState(false)
  const [err, setErr]             = useState<string|null>(null)

  function openCat(item?: Category) { setEditItem(item ?? null); setMName(item?.name ?? ''); setMDesc(item?.description ?? ''); setMParent(item?.parent_id ?? ''); setErr(null); setModal('category') }
  function openBrand(item?: Brand)  { setEditItem(item ?? null); setMName(item?.name ?? ''); setMDesc(item?.description ?? ''); setErr(null); setModal('brand') }
  function closeModal() { setModal(null); setEditItem(null) }

  /* ── Save category ── */
  async function saveCategory() {
    if (!mName.trim()) { setErr('El nombre es obligatorio.'); return }
    setSaving(true); setErr(null)
    const supabase = createClient()
    if (editItem) {
      const { error } = await supabase.from('categories').update({ name: mName.trim(), description: mDesc.trim()||null, parent_id: mParent||null }).eq('id', editItem.id)
      if (error) { setSaving(false); setErr(error.message); return }
      setCategories(cs => cs.map(c => c.id === editItem.id ? { ...c, name: mName.trim(), description: mDesc.trim()||null, parent_id: mParent||null } : c))
    } else {
      const { data, error } = await supabase.from('categories').insert({ organization_id: orgId, name: mName.trim(), description: mDesc.trim()||null, parent_id: mParent||null, slug: slugify(mName.trim()) }).select('id,name,slug,description,parent_id').single()
      if (error) { setSaving(false); setErr(error.message.includes('slug') ? 'Ya existe una categoría con ese nombre.' : error.message); return }
      setCategories(cs => [...cs, data])
    }
    setSaving(false); closeModal()
  }

  /* ── Save brand ── */
  async function saveBrand() {
    if (!mName.trim()) { setErr('El nombre es obligatorio.'); return }
    setSaving(true); setErr(null)
    const supabase = createClient()
    if (editItem) {
      const { error } = await supabase.from('brands').update({ name: mName.trim(), description: mDesc.trim()||null }).eq('id', editItem.id)
      if (error) { setSaving(false); setErr(error.message); return }
      setBrands(bs => bs.map(b => b.id === editItem.id ? { ...b, name: mName.trim(), description: mDesc.trim()||null } : b))
    } else {
      const { data, error } = await supabase.from('brands').insert({ organization_id: orgId, name: mName.trim(), description: mDesc.trim()||null, slug: slugify(mName.trim()) }).select('id,name,description').single()
      if (error) { setSaving(false); setErr(error.message.includes('slug') ? 'Ya existe una marca con ese nombre.' : error.message); return }
      setBrands(bs => [...bs, data])
    }
    setSaving(false); closeModal()
  }

  /* ── Delete ── */
  async function deleteCat(id: string) {
    if (!confirm('¿Eliminar esta categoría?')) return
    await createClient().from('categories').delete().eq('id', id)
    setCategories(cs => cs.filter(c => c.id !== id))
  }
  async function deleteBrand(id: string) {
    if (!confirm('¿Eliminar esta marca?')) return
    await createClient().from('brands').delete().eq('id', id)
    setBrands(bs => bs.filter(b => b.id !== id))
  }

  /* ── Filtered products ── */
  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(q.toLowerCase()) ||
    p.product_variants.some(v => v.sku.toLowerCase().includes(q.toLowerCase()))
  )

  /* ── Category tree ── */
  const roots = categories.filter(c => !c.parent_id)
  const children = (parentId: string) => categories.filter(c => c.parent_id === parentId)

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        body{background:#ECEEF2;font-family:'Inter',-apple-system,sans-serif;-webkit-font-smoothing:antialiased}
        .shell{display:flex;min-height:100dvh}
        .main{flex:1;overflow-y:auto}
        .topbar{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:52px 20px 16px}
        @media(min-width:768px){.topbar{padding:32px 32px 20px}}
        .page-title{font-size:26px;font-weight:800;color:#1A1A20;letter-spacing:-0.5px}
        .new-btn{display:flex;align-items:center;gap:7px;background:linear-gradient(145deg,#1D4ED8,#2563EB);color:white;border:none;border-radius:14px;padding:11px 18px;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;text-decoration:none;box-shadow:0 6px 20px rgba(29,78,216,0.28);transition:opacity 0.15s;white-space:nowrap}
        .new-btn:hover{opacity:.90}
        .content{padding:0 16px 120px}
        @media(min-width:768px){.content{padding:0 32px 48px}}

        /* Tabs */
        .tabs{display:flex;gap:4px;background:#ECEEF2;border-radius:16px;padding:4px;box-shadow:inset 3px 3px 8px rgba(0,0,0,0.07),inset -2px -2px 6px rgba(255,255,255,0.85);margin-bottom:20px}
        .tab{flex:1;padding:10px 8px;border-radius:12px;border:none;background:transparent;font-size:13px;font-weight:600;color:rgba(26,26,32,0.40);cursor:pointer;font-family:inherit;transition:all 0.15s}
        .tab.on{background:#ECEEF2;color:#1D4ED8;font-weight:700;box-shadow:3px 3px 10px rgba(0,0,0,0.08),-2px -2px 6px rgba(255,255,255,0.90)}

        /* Search */
        .search-wrap{margin-bottom:14px;position:relative}
        .search-icon{position:absolute;left:14px;top:50%;transform:translateY(-50%);pointer-events:none}
        .search-input{width:100%;padding:12px 16px 12px 42px;background:#ECEEF2;border:1.5px solid rgba(0,0,0,0.07);border-radius:16px;font-size:14px;font-weight:500;color:#1A1A20;font-family:inherit;outline:none;box-shadow:inset 3px 3px 8px rgba(0,0,0,0.07),inset -2px -2px 6px rgba(255,255,255,0.85)}
        .search-input::placeholder{color:rgba(26,26,32,0.28)}
        .search-input:focus{border-color:#2563EB}

        /* Card */
        .card{background:#ECEEF2;border-radius:24px;overflow:hidden;box-shadow:6px 6px 18px rgba(0,0,0,0.08),-4px -4px 12px rgba(255,255,255,0.95),inset 0 1px 0 rgba(255,255,255,0.7)}

        /* Product row */
        .prod-row{display:flex;align-items:center;gap:12px;padding:13px 18px;border-top:1px solid rgba(0,0,0,0.05);text-decoration:none;transition:background 0.12s}
        .prod-row:first-child{border-top:none}
        .prod-row:hover{background:rgba(37,99,235,0.04)}
        .prod-icon{width:40px;height:40px;background:#ECEEF2;border-radius:12px;display:flex;align-items:center;justify-content:center;flex-shrink:0;box-shadow:3px 3px 8px rgba(0,0,0,0.07),-2px -2px 6px rgba(255,255,255,0.90)}
        .prod-name{font-size:14px;font-weight:700;color:#1A1A20}
        .prod-meta{font-size:11px;color:rgba(26,26,32,0.38);margin-top:2px}
        .prod-right{text-align:right;flex-shrink:0}
        .prod-price{font-size:14px;font-weight:700;color:#1A1A20}
        .prod-stock{font-size:11px;color:rgba(26,26,32,0.35);margin-top:2px}
        .badge{display:inline-block;padding:2px 8px;border-radius:50px;font-size:10px;font-weight:700}

        /* Cat/Brand rows */
        .list-row{display:flex;align-items:center;gap:10px;padding:12px 18px;border-top:1px solid rgba(0,0,0,0.05)}
        .list-row:first-child{border-top:none}
        .list-icon{width:36px;height:36px;background:#ECEEF2;border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0;box-shadow:3px 3px 8px rgba(0,0,0,0.07),-2px -2px 6px rgba(255,255,255,0.90)}
        .list-name{font-size:13px;font-weight:700;color:#1A1A20}
        .list-sub{font-size:11px;color:rgba(26,26,32,0.38);margin-top:1px}
        .list-actions{display:flex;gap:6px;margin-left:auto;flex-shrink:0}
        .act{padding:5px 10px;border-radius:8px;border:none;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit}
        .act-e{background:rgba(37,99,235,0.08);color:#1D4ED8}
        .act-d{background:rgba(220,38,38,0.07);color:#DC2626}

        /* Sub-category indent */
        .sub-row{padding-left:48px}

        .empty{padding:40px 20px;text-align:center;color:rgba(26,26,32,0.32);font-size:14px;font-weight:500}
        .count{font-size:12px;color:rgba(26,26,32,0.32);font-weight:500;margin-bottom:10px}

        /* Modal */
        .overlay{position:fixed;inset:0;background:rgba(0,0,0,0.35);z-index:200;display:flex;align-items:flex-end;justify-content:center}
        @media(min-width:768px){.overlay{align-items:center}}
        .modal{background:#ECEEF2;border-radius:28px 28px 0 0;padding:28px 24px 40px;width:100%;max-width:520px;box-shadow:0 -8px 40px rgba(0,0,0,0.14)}
        @media(min-width:768px){.modal{border-radius:28px;padding:32px}}
        .modal-title{font-size:20px;font-weight:800;color:#1A1A20;margin-bottom:18px}
        .fl{font-size:10px;font-weight:700;color:rgba(26,26,32,0.35);text-transform:uppercase;letter-spacing:0.07em;margin-bottom:5px}
        .fi,.fs{width:100%;padding:12px 14px;background:rgba(0,0,0,0.03);border:1.5px solid rgba(0,0,0,0.07);border-radius:13px;font-size:14px;font-weight:500;color:#1A1A20;font-family:inherit;outline:none;box-shadow:inset 2px 2px 5px rgba(0,0,0,0.06),inset -2px -2px 4px rgba(255,255,255,0.80);margin-bottom:12px;transition:border-color 0.15s}
        .fi:focus,.fs:focus{border-color:#2563EB}
        .fs{appearance:none;background-image:url("data:image/svg+xml,%3Csvg width='12' height='8' viewBox='0 0 12 8' fill='none'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%231A1A20' stroke-opacity='.4' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 12px center;padding-right:32px}
        .alert-e{background:rgba(220,38,38,0.07);border:1px solid rgba(220,38,38,0.15);border-radius:12px;padding:10px 14px;font-size:12px;font-weight:600;color:#991b1b;margin-bottom:12px}
        .m-actions{display:flex;gap:10px;margin-top:4px}
        .m-cancel{flex:1;padding:13px;border-radius:13px;border:1.5px solid rgba(0,0,0,0.10);background:transparent;font-size:14px;font-weight:700;color:rgba(26,26,32,0.50);cursor:pointer;font-family:inherit}
        .m-save{flex:2;padding:13px;border-radius:13px;border:none;background:linear-gradient(145deg,#1D4ED8,#2563EB);font-size:14px;font-weight:700;color:white;cursor:pointer;font-family:inherit;box-shadow:0 6px 18px rgba(29,78,216,0.28)}
        .m-save:disabled{opacity:0.5;cursor:not-allowed}
      `}</style>

      <div className="shell">
        <Sidebar orgName={orgName} userName={userName} active="catalog" />
        <main className="main">
          <div className="topbar">
            <div className="page-title">Inventario</div>
            {tab === 'products'   && <Link href="/catalog/new" className="new-btn"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>Producto</Link>}
            {tab === 'categories' && <button className="new-btn" onClick={() => openCat()}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>Categoría</button>}
            {tab === 'brands'     && <button className="new-btn" onClick={() => openBrand()}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>Marca</button>}
          </div>

          <div className="content">
            {/* Tabs */}
            <div className="tabs">
              {(['products','categories','brands'] as const).map(t => (
                <button key={t} className={`tab${tab === t ? ' on' : ''}`} onClick={() => setTab(t)}>
                  {t === 'products' ? 'Productos' : t === 'categories' ? 'Categorías' : 'Marcas'}
                </button>
              ))}
            </div>

            {/* ── PRODUCTOS ── */}
            {tab === 'products' && (
              <>
                <div className="search-wrap">
                  <div className="search-icon"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="rgba(26,26,32,0.35)" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></div>
                  <input className="search-input" placeholder="Buscar por nombre o SKU..." value={q} onChange={e => setQ(e.target.value)} />
                </div>
                {filteredProducts.length > 0 && <div className="count">{filteredProducts.length} producto{filteredProducts.length !== 1 ? 's' : ''}</div>}
                <div className="card">
                  {filteredProducts.length === 0 ? (
                    <div className="empty">{q ? `Sin resultados para "${q}"` : 'Sin productos — crea el primero'}</div>
                  ) : filteredProducts.map(p => {
                    const price = minPrice(p.product_variants)
                    const stock = totalStock(p.product_variants)
                    const cat   = (p.categories as unknown as { name: string } | null)?.name
                    return (
                      <Link key={p.id} href={`/catalog/${p.id}/edit`} className="prod-row">
                        <div className="prod-icon">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(29,78,216,0.55)" strokeWidth="1.8" strokeLinecap="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
                        </div>
                        <div style={{flex:1,minWidth:0}}>
                          <div className="prod-name">{p.name}</div>
                          <div className="prod-meta">
                            {cat && <span>{cat} · </span>}
                            <span className="badge" style={{background: STATUS_COLOR[p.status]?.split(';')[0]?.replace('background:',''), color: STATUS_COLOR[p.status]?.split(';')[1]?.replace('color:','')}}>{STATUS_LABEL[p.status]}</span>
                          </div>
                        </div>
                        <div className="prod-right">
                          <div className="prod-price">{price !== null ? `$${price.toLocaleString('es-MX',{minimumFractionDigits:2})}` : '—'}</div>
                          <div className="prod-stock">{stock} en stock</div>
                        </div>
                      </Link>
                    )
                  })}
                </div>
              </>
            )}

            {/* ── CATEGORÍAS ── */}
            {tab === 'categories' && (
              <div className="card">
                {categories.length === 0 ? (
                  <div className="empty">Sin categorías — crea la primera</div>
                ) : roots.length === 0 ? (
                  categories.map(c => (
                    <div key={c.id} className="list-row">
                      <div className="list-icon"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="rgba(29,78,216,0.55)" strokeWidth="1.8" strokeLinecap="round"><rect x="2" y="3" width="9" height="9" rx="2"/><rect x="13" y="3" width="9" height="9" rx="2"/><rect x="2" y="14" width="9" height="9" rx="2"/><rect x="13" y="14" width="9" height="9" rx="2"/></svg></div>
                      <div style={{flex:1,minWidth:0}}><div className="list-name">{c.name}</div>{c.description && <div className="list-sub">{c.description}</div>}</div>
                      <div className="list-actions">
                        <button className="act act-e" onClick={() => openCat(c)}>Editar</button>
                        <button className="act act-e" style={{background:'rgba(5,150,105,0.08)',color:'#065f46'}} onClick={() => { setMParent(c.id); setMName(''); setMDesc(''); setErr(null); setModal('category') }}>+ Sub</button>
                        <button className="act act-d" onClick={() => deleteCat(c.id)}>Eliminar</button>
                      </div>
                    </div>
                  ))
                ) : (
                  roots.map(root => (
                    <div key={root.id}>
                      <div className="list-row">
                        <div className="list-icon"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="rgba(29,78,216,0.55)" strokeWidth="1.8" strokeLinecap="round"><rect x="2" y="3" width="9" height="9" rx="2"/><rect x="13" y="3" width="9" height="9" rx="2"/><rect x="2" y="14" width="9" height="9" rx="2"/><rect x="13" y="14" width="9" height="9" rx="2"/></svg></div>
                        <div style={{flex:1,minWidth:0}}><div className="list-name">{root.name}</div>{root.description && <div className="list-sub">{root.description}</div>}</div>
                        <div className="list-actions">
                          <button className="act act-e" onClick={() => openCat(root)}>Editar</button>
                          <button className="act act-e" style={{background:'rgba(5,150,105,0.08)',color:'#065f46'}} onClick={() => { setMParent(root.id); setMName(''); setMDesc(''); setErr(null); setModal('category') }}>+ Sub</button>
                          <button className="act act-d" onClick={() => deleteCat(root.id)}>Eliminar</button>
                        </div>
                      </div>
                      {children(root.id).map(child => (
                        <div key={child.id} className="list-row sub-row">
                          <div style={{width:6,height:6,borderRadius:'50%',background:'rgba(29,78,216,0.30)',flexShrink:0}} />
                          <div style={{flex:1,minWidth:0,marginLeft:4}}><div className="list-name" style={{fontSize:12}}>{child.name}</div>{child.description && <div className="list-sub">{child.description}</div>}</div>
                          <div className="list-actions">
                            <button className="act act-e" onClick={() => openCat(child)}>Editar</button>
                            <button className="act act-d" onClick={() => deleteCat(child.id)}>Eliminar</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ))
                )}
              </div>
            )}

            {/* ── MARCAS ── */}
            {tab === 'brands' && (
              <div className="card">
                {brands.length === 0 ? (
                  <div className="empty">Sin marcas — crea la primera</div>
                ) : brands.map(b => (
                  <div key={b.id} className="list-row">
                    <div className="list-icon"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="rgba(29,78,216,0.55)" strokeWidth="1.8" strokeLinecap="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg></div>
                    <div style={{flex:1,minWidth:0}}><div className="list-name">{b.name}</div>{b.description && <div className="list-sub">{b.description}</div>}</div>
                    <div className="list-actions">
                      <button className="act act-e" onClick={() => openBrand(b)}>Editar</button>
                      <button className="act act-d" onClick={() => deleteBrand(b.id)}>Eliminar</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>

      <BottomNav active="catalog" />

      {/* ── Modal categoría ── */}
      {modal === 'category' && (
        <div className="overlay" onClick={e => e.target === e.currentTarget && closeModal()}>
          <div className="modal">
            <div className="modal-title">{editItem ? 'Editar categoría' : mParent ? 'Nueva subcategoría' : 'Nueva categoría'}</div>
            {err && <div className="alert-e">{err}</div>}
            <div className="fl">Nombre *</div>
            <input className="fi" value={mName} onChange={e => setMName(e.target.value)} placeholder={mParent ? 'Ej. Zapatos, Camisas...' : 'Ej. Mujer, Hombre, Niños...'} autoFocus />
            {mParent && (
              <>
                <div className="fl">Categoría padre</div>
                <select className="fs" value={mParent} onChange={e => setMParent(e.target.value)}>
                  <option value="">Sin padre (raíz)</option>
                  {categories.filter(c => !c.parent_id).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </>
            )}
            <div className="fl">Descripción (opcional)</div>
            <input className="fi" value={mDesc} onChange={e => setMDesc(e.target.value)} placeholder="Descripción breve..." />
            <div className="m-actions">
              <button className="m-cancel" onClick={closeModal}>Cancelar</button>
              <button className="m-save" onClick={saveCategory} disabled={saving}>{saving ? 'Guardando...' : editItem ? 'Guardar' : 'Crear'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal marca ── */}
      {modal === 'brand' && (
        <div className="overlay" onClick={e => e.target === e.currentTarget && closeModal()}>
          <div className="modal">
            <div className="modal-title">{editItem ? 'Editar marca' : 'Nueva marca'}</div>
            {err && <div className="alert-e">{err}</div>}
            <div className="fl">Nombre *</div>
            <input className="fi" value={mName} onChange={e => setMName(e.target.value)} placeholder="Ej. Nike, Zara, Apple..." autoFocus />
            <div className="fl">Descripción (opcional)</div>
            <input className="fi" value={mDesc} onChange={e => setMDesc(e.target.value)} placeholder="Descripción breve..." />
            <div className="m-actions">
              <button className="m-cancel" onClick={closeModal}>Cancelar</button>
              <button className="m-save" onClick={saveBrand} disabled={saving}>{saving ? 'Guardando...' : editItem ? 'Guardar' : 'Crear'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
