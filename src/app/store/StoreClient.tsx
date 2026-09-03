'use client'
import { useState, useCallback } from 'react'
import Sidebar from '@/components/Sidebar'
import BottomNav from '@/components/BottomNav'
import { createClient } from '@/lib/supabase/client'

interface Category {
  id: string; parent_id: string | null; name: string; slug: string
  sort_order: number; is_visible: boolean; description: string | null
}
interface Product {
  id: string; name: string; slug: string | null; is_published: boolean
  product_images: { url: string; is_primary: boolean }[]
  store_product_categories: { category_id: string }[]
}
type Tab = 'categorias' | 'productos'

function slugify(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

export default function StoreClient({ orgId, categories: init, products: initP, userName, orgName }: {
  orgId: string; categories: Category[]; products: Product[]; userName: string; orgName: string
}) {
  const [tab, setTab] = useState<Tab>('categorias')
  const [cats, setCats] = useState(init)
  const [products] = useState(initP)

  // Modal state
  const [modal, setModal] = useState<'new' | 'edit' | null>(null)
  const [editing, setEditing] = useState<Category | null>(null)
  const [form, setForm] = useState({ name: '', slug: '', parent_id: '', description: '', is_visible: true })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  // Product assignment state
  const [catFilter, setCatFilter] = useState<string>('all')
  const [assigning, setAssigning] = useState<Record<string, boolean>>({})

  function openNew(parentId?: string) {
    setForm({ name: '', slug: '', parent_id: parentId ?? '', description: '', is_visible: true })
    setEditing(null); setModal('new'); setErr(null)
  }
  function openEdit(c: Category) {
    setForm({ name: c.name, slug: c.slug, parent_id: c.parent_id ?? '', description: c.description ?? '', is_visible: c.is_visible })
    setEditing(c); setModal('edit'); setErr(null)
  }
  function closeModal() { setModal(null); setEditing(null); setErr(null) }

  function handleNameChange(name: string) {
    setForm(f => ({ ...f, name, slug: modal === 'new' ? slugify(name) : f.slug }))
  }

  async function saveCategory() {
    if (!form.name.trim()) { setErr('El nombre es requerido'); return }
    if (!form.slug.trim()) { setErr('El slug es requerido'); return }
    setSaving(true); setErr(null)
    const supabase = createClient()

    if (modal === 'new') {
      const maxOrder = cats.filter(c => (c.parent_id ?? '') === (form.parent_id ?? '')).reduce((m, c) => Math.max(m, c.sort_order), -1)
      const { data, error } = await supabase.from('store_categories').insert({
        organization_id: orgId,
        name: form.name.trim(),
        slug: slugify(form.slug),
        parent_id: form.parent_id || null,
        description: form.description.trim() || null,
        is_visible: form.is_visible,
        sort_order: maxOrder + 1,
      }).select('id, parent_id, name, slug, sort_order, is_visible, description').single()
      if (error) { setErr(error.message); setSaving(false); return }
      setCats(c => [...c, data])
    } else if (modal === 'edit' && editing) {
      const { error } = await supabase.from('store_categories').update({
        name: form.name.trim(),
        slug: slugify(form.slug),
        parent_id: form.parent_id || null,
        description: form.description.trim() || null,
        is_visible: form.is_visible,
        updated_at: new Date().toISOString(),
      }).eq('id', editing.id)
      if (error) { setErr(error.message); setSaving(false); return }
      setCats(c => c.map(x => x.id === editing.id ? { ...x, ...form, parent_id: form.parent_id || null, slug: slugify(form.slug) } : x))
    }
    setSaving(false); closeModal()
  }

  async function deleteCategory(id: string) {
    const hasChildren = cats.some(c => c.parent_id === id)
    if (hasChildren) { alert('Primero elimina o mueve las subcategorías'); return }
    if (!confirm('¿Eliminar categoría?')) return
    const supabase = createClient()
    await supabase.from('store_categories').delete().eq('id', id)
    setCats(c => c.filter(x => x.id !== id))
  }

  async function moveOrder(id: string, dir: -1 | 1) {
    const cat = cats.find(c => c.id === id)!
    const siblings = cats.filter(c => (c.parent_id ?? null) === (cat.parent_id ?? null)).sort((a, b) => a.sort_order - b.sort_order)
    const idx = siblings.findIndex(c => c.id === id)
    const swapIdx = idx + dir
    if (swapIdx < 0 || swapIdx >= siblings.length) return
    const swap = siblings[swapIdx]
    const supabase = createClient()
    await Promise.all([
      supabase.from('store_categories').update({ sort_order: swap.sort_order }).eq('id', id),
      supabase.from('store_categories').update({ sort_order: cat.sort_order }).eq('id', swap.id),
    ])
    setCats(c => c.map(x => x.id === id ? { ...x, sort_order: swap.sort_order } : x.id === swap.id ? { ...x, sort_order: cat.sort_order } : x))
  }

  async function toggleProductCategory(productId: string, categoryId: string, isAssigned: boolean) {
    const key = `${productId}-${categoryId}`
    setAssigning(a => ({ ...a, [key]: true }))
    const supabase = createClient()
    if (isAssigned) {
      await supabase.from('store_product_categories').delete().eq('product_id', productId).eq('category_id', categoryId)
    } else {
      const count = products.find(p => p.id === productId)?.store_product_categories.length ?? 0
      await supabase.from('store_product_categories').insert({ product_id: productId, category_id: categoryId, sort_order: count })
    }
    setAssigning(a => { const n = { ...a }; delete n[key]; return n })
    window.location.reload()
  }

  // Build tree
  const roots = cats.filter(c => !c.parent_id).sort((a, b) => a.sort_order - b.sort_order)
  const getChildren = (parentId: string) => cats.filter(c => c.parent_id === parentId).sort((a, b) => a.sort_order - b.sort_order)

  const filteredProducts = catFilter === 'all' ? products : catFilter === 'none'
    ? products.filter(p => p.store_product_categories.length === 0)
    : products.filter(p => p.store_product_categories.some(a => a.category_id === catFilter))

  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #ECEEF2; font-family: 'Inter', -apple-system, sans-serif; -webkit-font-smoothing: antialiased; }
        .shell { display: flex; min-height: 100dvh; }
        .main  { flex: 1; overflow-y: auto; }
        .topbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 20px 20px 0; }
        @media(min-width:768px){ .topbar { padding: 20px 40px 0; } }
        .tab-row { display: flex; gap: 4px; padding: 12px 20px 16px; }
        @media(min-width:768px){ .tab-row { padding: 12px 40px 20px; } }
        .tab-pill { padding: 6px 16px; border-radius: 50px; border: 1.5px solid transparent; font-size: 13px; font-weight: 700; cursor: pointer; font-family: inherit; transition: all 0.15s; background: transparent; color: rgba(26,26,32,0.40); }
        .tab-pill.active { background: #1A1A20; color: #fff; border-color: #1A1A20; }
        .tab-pill:not(.active):hover { background: rgba(0,0,0,0.04); color: #1A1A20; }
        .content { padding: 0 16px 120px; }
        @media(min-width:768px){ .content { padding: 0 32px 64px; } }
        .page-title { font-size: 24px; font-weight: 800; color: #1A1A20; }
        .card { background: #ECEEF2; border-radius: 24px; overflow: hidden; box-shadow: 6px 6px 18px rgba(0,0,0,0.08), -4px -4px 12px rgba(255,255,255,0.95), inset 0 1px 0 rgba(255,255,255,0.7); }
        .row { display: flex; align-items: center; gap: 10px; padding: 13px 16px; border-top: 1px solid rgba(0,0,0,0.05); }
        .row:first-child { border-top: none; }
        .row-name { font-size: 14px; font-weight: 700; color: #1A1A20; }
        .row-sub  { font-size: 12px; color: rgba(26,26,32,0.38); margin-top: 1px; }
        .slug-tag { font-size: 11px; font-weight: 600; background: rgba(0,0,0,0.05); border-radius: 6px; padding: 2px 7px; color: rgba(26,26,32,0.40); font-family: monospace; }
        .vis-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
        .icon-btn { width: 30px; height: 30px; border-radius: 8px; border: none; background: transparent; cursor: pointer; display: flex; align-items: center; justify-content: center; color: rgba(26,26,32,0.40); transition: background 0.12s, color 0.12s; flex-shrink: 0; }
        .icon-btn:hover { background: rgba(0,0,0,0.06); color: #1A1A20; }
        .icon-btn.danger:hover { background: rgba(220,38,38,0.08); color: #DC2626; }
        .add-btn { display: flex; align-items: center; gap: 6px; padding: 9px 16px; border-radius: 14px; border: none; background: #1A1A20; color: #CAFF3A; font-size: 13px; font-weight: 700; cursor: pointer; font-family: inherit; }
        .add-sub-btn { display: flex; align-items: center; gap: 5px; padding: 5px 10px; border-radius: 10px; border: 1.5px solid rgba(0,0,0,0.10); background: transparent; color: rgba(26,26,32,0.45); font-size: 11px; font-weight: 700; cursor: pointer; font-family: inherit; flex-shrink: 0; white-space: nowrap; }
        .add-sub-btn:hover { background: rgba(0,0,0,0.04); color: #1A1A20; }
        .empty { padding: 40px 24px; text-align: center; color: rgba(26,26,32,0.35); font-size: 14px; font-weight: 500; }
        .top-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
        .count-label { font-size: 13px; color: rgba(26,26,32,0.35); font-weight: 500; }
        .sub-section { margin-left: 24px; margin-top: 4px; }
        .parent-label { font-size: 11px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: rgba(26,26,32,0.35); padding: 10px 16px 6px; }

        /* Filter bar */
        .filter-row { display: flex; gap: 6px; margin-bottom: 14px; flex-wrap: wrap; }
        .filter-chip { padding: 5px 14px; border-radius: 50px; border: 1.5px solid rgba(0,0,0,0.10); font-size: 12px; font-weight: 700; cursor: pointer; font-family: inherit; background: transparent; color: rgba(26,26,32,0.50); transition: all 0.12s; }
        .filter-chip.active { background: #1A1A20; color: #fff; border-color: #1A1A20; }

        /* Product assign row */
        .prod-row { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-top: 1px solid rgba(0,0,0,0.05); }
        .prod-thumb { width: 40px; height: 40px; border-radius: 10px; background: rgba(0,0,0,0.06); flex-shrink: 0; object-fit: cover; }
        .cat-chips-wrap { display: flex; flex-wrap: wrap; gap: 4px; flex: 1; }
        .cat-assign-chip { padding: 3px 10px; border-radius: 50px; font-size: 11px; font-weight: 700; cursor: pointer; border: 1.5px solid rgba(0,0,0,0.10); background: transparent; color: rgba(26,26,32,0.45); font-family: inherit; transition: all 0.12s; }
        .cat-assign-chip.on { background: #1A1A20; color: #CAFF3A; border-color: #1A1A20; }
        .cat-assign-chip:disabled { opacity: 0.4; cursor: not-allowed; }

        /* Modal */
        .overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.35); z-index: 200; display: flex; align-items: flex-end; justify-content: center; }
        @media(min-width:768px){ .overlay { align-items: center; } }
        .modal { background: #ECEEF2; border-radius: 28px 28px 0 0; padding: 28px 24px 40px; width: 100%; max-width: 480px; box-shadow: 0 -8px 40px rgba(0,0,0,0.14); }
        @media(min-width:768px){ .modal { border-radius: 28px; padding: 32px; } }
        .modal-title { font-size: 20px; font-weight: 800; color: #1A1A20; margin-bottom: 20px; }
        .field-lbl { font-size: 11px; font-weight: 700; color: rgba(26,26,32,0.35); text-transform: uppercase; letter-spacing: .07em; margin-bottom: 6px; }
        .field-input { width: 100%; padding: 12px 14px; background: rgba(0,0,0,0.03); border: 1.5px solid rgba(0,0,0,0.07); border-radius: 14px; font-size: 14px; font-weight: 500; color: #1A1A20; font-family: inherit; outline: none; margin-bottom: 14px; transition: border-color .15s; }
        .field-input:focus { border-color: #2563EB; }
        .field-select { width: 100%; padding: 12px 14px; background: rgba(0,0,0,0.03); border: 1.5px solid rgba(0,0,0,0.07); border-radius: 14px; font-size: 14px; font-weight: 500; color: #1A1A20; font-family: inherit; outline: none; margin-bottom: 14px; appearance: none; }
        .toggle-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; }
        .toggle-label { font-size: 14px; font-weight: 600; color: #1A1A20; }
        .tog-wrap { position: relative; display: inline-block; width: 44px; height: 26px; cursor: pointer; }
        .tog-wrap input { opacity: 0; width: 0; height: 0; }
        .tog-track { position: absolute; inset: 0; background: rgba(0,0,0,0.12); border-radius: 50px; transition: background .18s; }
        .tog-wrap input:checked + .tog-track { background: #059669; }
        .tog-thumb { position: absolute; left: 3px; top: 3px; width: 20px; height: 20px; border-radius: 50%; background: white; box-shadow: 0 1px 4px rgba(0,0,0,.20); transition: transform .18s; }
        .tog-wrap input:checked ~ .tog-thumb { transform: translateX(18px); }
        .alert-err { background: rgba(220,38,38,0.07); border: 1px solid rgba(220,38,38,0.15); border-radius: 12px; padding: 10px 14px; font-size: 13px; font-weight: 600; color: #991b1b; margin-bottom: 14px; }
        .modal-actions { display: flex; gap: 10px; }
        .btn-cancel { flex: 1; padding: 14px; border-radius: 14px; border: 1.5px solid rgba(0,0,0,0.10); background: transparent; font-size: 15px; font-weight: 700; color: rgba(26,26,32,0.50); cursor: pointer; font-family: inherit; }
        .btn-save   { flex: 2; padding: 14px; border-radius: 14px; border: none; background: linear-gradient(145deg,#1D4ED8,#2563EB); font-size: 15px; font-weight: 700; color: white; cursor: pointer; font-family: inherit; }
        .btn-save:disabled { opacity: 0.5; cursor: not-allowed; }
      `}</style>

      <div className="shell">
        <Sidebar orgName={orgName} userName={userName} active="store" />
        <main className="main">
          <div className="topbar">
            <div className="page-title">Tienda web</div>
          </div>
          <div className="tab-row">
            <button className={`tab-pill${tab === 'categorias' ? ' active' : ''}`} onClick={() => setTab('categorias')}>Categorías</button>
            <button className={`tab-pill${tab === 'productos' ? ' active' : ''}`} onClick={() => setTab('productos')}>Productos</button>
          </div>

          <div className="content">

            {/* ── CATEGORÍAS TAB ── */}
            {tab === 'categorias' && (
              <>
                <div className="top-row">
                  <span className="count-label">{cats.length} categoría{cats.length !== 1 ? 's' : ''}</span>
                  <button className="add-btn" onClick={() => openNew()}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    Nueva categoría
                  </button>
                </div>

                {cats.length === 0 ? (
                  <div className="card"><div className="empty">Aún no hay categorías — crea la primera arriba</div></div>
                ) : (
                  <div className="card">
                    {roots.map(root => {
                      const children = getChildren(root.id)
                      return (
                        <div key={root.id}>
                          {/* Root category row */}
                          <div className="row">
                            <div style={{ width: 7, height: 7, borderRadius: '50%', background: root.is_visible ? '#059669' : '#D1D5DB', flexShrink: 0 }} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div className="row-name">{root.name}</div>
                              <div className="row-sub"><span className="slug-tag">/{root.slug}</span> · {children.length} subcategoría{children.length !== 1 ? 's' : ''}</div>
                            </div>
                            <button className="add-sub-btn" onClick={() => openNew(root.id)}>+ Sub</button>
                            <button className="icon-btn" title="Subir" onClick={() => moveOrder(root.id, -1)}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="18 15 12 9 6 15"/></svg>
                            </button>
                            <button className="icon-btn" title="Bajar" onClick={() => moveOrder(root.id, 1)}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="6 9 12 15 18 9"/></svg>
                            </button>
                            <button className="icon-btn" title="Editar" onClick={() => openEdit(root)}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                            </button>
                            <button className="icon-btn danger" title="Eliminar" onClick={() => deleteCategory(root.id)}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
                            </button>
                          </div>

                          {/* Sub-categories */}
                          {children.map(sub => (
                            <div key={sub.id} className="row" style={{ paddingLeft: 40, background: 'rgba(0,0,0,0.015)' }}>
                              <div style={{ width: 6, height: 6, borderRadius: '50%', background: sub.is_visible ? '#059669' : '#D1D5DB', flexShrink: 0 }} />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div className="row-name" style={{ fontSize: 13 }}>{sub.name}</div>
                                <div className="row-sub"><span className="slug-tag">/{root.slug}/{sub.slug}</span></div>
                              </div>
                              <button className="icon-btn" title="Subir" onClick={() => moveOrder(sub.id, -1)}>
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="18 15 12 9 6 15"/></svg>
                              </button>
                              <button className="icon-btn" title="Bajar" onClick={() => moveOrder(sub.id, 1)}>
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="6 9 12 15 18 9"/></svg>
                              </button>
                              <button className="icon-btn" title="Editar" onClick={() => openEdit(sub)}>
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                              </button>
                              <button className="icon-btn danger" title="Eliminar" onClick={() => deleteCategory(sub.id)}>
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
                              </button>
                            </div>
                          ))}
                        </div>
                      )
                    })}
                  </div>
                )}
              </>
            )}

            {/* ── PRODUCTOS TAB ── */}
            {tab === 'productos' && (
              <>
                <div className="filter-row">
                  <button className={`filter-chip${catFilter === 'all' ? ' active' : ''}`} onClick={() => setCatFilter('all')}>Todos</button>
                  <button className={`filter-chip${catFilter === 'none' ? ' active' : ''}`} onClick={() => setCatFilter('none')}>Sin categoría</button>
                  {cats.filter(c => !c.parent_id).map(c => (
                    <button key={c.id} className={`filter-chip${catFilter === c.id ? ' active' : ''}`} onClick={() => setCatFilter(c.id)}>{c.name}</button>
                  ))}
                </div>
                <div className="count-label" style={{ marginBottom: 10 }}>{filteredProducts.length} producto{filteredProducts.length !== 1 ? 's' : ''}</div>
                <div className="card">
                  {filteredProducts.length === 0 ? (
                    <div className="empty">Sin productos en esta categoría</div>
                  ) : filteredProducts.map(p => {
                    const thumb = p.product_images.find(i => i.is_primary)?.url ?? p.product_images[0]?.url
                    const assigned = new Set(p.store_product_categories.map(a => a.category_id))
                    return (
                      <div key={p.id} className="prod-row">
                        {thumb
                          ? <img className="prod-thumb" src={thumb} alt={p.name} />
                          : <div className="prod-thumb" />
                        }
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div className="row-name" style={{ marginBottom: 6 }}>{p.name}</div>
                          <div className="cat-chips-wrap">
                            {cats.map(cat => {
                              const isOn = assigned.has(cat.id)
                              const key = `${p.id}-${cat.id}`
                              const busy = assigning[key]
                              return (
                                <button
                                  key={cat.id}
                                  className={`cat-assign-chip${isOn ? ' on' : ''}`}
                                  disabled={busy}
                                  onClick={() => toggleProductCategory(p.id, cat.id, isOn)}
                                  style={{ paddingLeft: cat.parent_id ? 8 : undefined }}
                                >
                                  {cat.parent_id ? '└ ' : ''}{cat.name}
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </div>
        </main>
      </div>

      <BottomNav active="store" />

      {/* ── CATEGORY MODAL ── */}
      {modal && (
        <div className="overlay" onClick={e => e.target === e.currentTarget && closeModal()}>
          <div className="modal">
            <div className="modal-title">{modal === 'new' ? 'Nueva categoría' : 'Editar categoría'}</div>
            {err && <div className="alert-err">{err}</div>}

            <div className="field-lbl">Nombre *</div>
            <input className="field-input" type="text" value={form.name} onChange={e => handleNameChange(e.target.value)} placeholder="Ej: Mujer, Calzado, Tops..." autoFocus />

            <div className="field-lbl">Slug (URL) *</div>
            <input className="field-input" type="text" value={form.slug} onChange={e => setForm(f => ({ ...f, slug: e.target.value }))} placeholder="mujer, calzado, tops..." />

            <div className="field-lbl">Categoría padre</div>
            <select className="field-select" value={form.parent_id} onChange={e => setForm(f => ({ ...f, parent_id: e.target.value }))}>
              <option value="">— Ninguna (categoría principal) —</option>
              {cats.filter(c => !c.parent_id && c.id !== editing?.id).map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>

            <div className="toggle-row">
              <span className="toggle-label">Visible en la tienda</span>
              <label className="tog-wrap">
                <input type="checkbox" checked={form.is_visible} onChange={e => setForm(f => ({ ...f, is_visible: e.target.checked }))} />
                <span className="tog-track" /><span className="tog-thumb" />
              </label>
            </div>

            <div className="modal-actions">
              <button className="btn-cancel" onClick={closeModal}>Cancelar</button>
              <button className="btn-save" onClick={saveCategory} disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
