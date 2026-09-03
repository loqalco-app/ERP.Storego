'use client'
import { useState } from 'react'
import Sidebar from '@/components/Sidebar'
import BottomNav from '@/components/BottomNav'
import { createClient } from '@/lib/supabase/client'

interface Category {
  id: string; parent_id: string | null; name: string; slug: string
  web_sort_order: number; is_web_visible: boolean; description: string | null
}
interface Product {
  id: string; name: string; slug: string | null; is_published: boolean
  category_id: string | null
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

  const [modal, setModal] = useState<'new' | 'edit' | null>(null)
  const [editing, setEditing] = useState<Category | null>(null)
  const [form, setForm] = useState({ name: '', slug: '', parent_id: '', description: '', is_web_visible: true })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const [catFilter, setCatFilter] = useState<string>('none')
  const [assigning, setAssigning] = useState<Record<string, boolean>>({})
  const [toggling, setToggling] = useState<Record<string, boolean>>({})

  function openNew(parentId?: string) {
    setForm({ name: '', slug: '', parent_id: parentId ?? '', description: '', is_web_visible: true })
    setEditing(null); setModal('new'); setErr(null)
  }
  function openEdit(c: Category) {
    setForm({ name: c.name, slug: c.slug, parent_id: c.parent_id ?? '', description: c.description ?? '', is_web_visible: c.is_web_visible })
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
      const siblings = cats.filter(c => (c.parent_id ?? '') === (form.parent_id ?? ''))
      const maxOrder = siblings.reduce((m, c) => Math.max(m, c.web_sort_order), -1)
      const { data, error } = await supabase.from('categories').insert({
        organization_id: orgId,
        name: form.name.trim(),
        slug: slugify(form.slug),
        parent_id: form.parent_id || null,
        description: form.description.trim() || null,
        is_web_visible: form.is_web_visible,
        web_sort_order: maxOrder + 1,
      }).select('id, parent_id, name, slug, web_sort_order, is_web_visible, description').single()
      if (error) { setErr(error.message); setSaving(false); return }
      setCats(c => [...c, data])
    } else if (modal === 'edit' && editing) {
      const { error } = await supabase.from('categories').update({
        name: form.name.trim(),
        slug: slugify(form.slug),
        parent_id: form.parent_id || null,
        description: form.description.trim() || null,
        is_web_visible: form.is_web_visible,
      }).eq('id', editing.id)
      if (error) { setErr(error.message); setSaving(false); return }
      setCats(c => c.map(x => x.id === editing.id ? {
        ...x, name: form.name.trim(), slug: slugify(form.slug),
        parent_id: form.parent_id || null, description: form.description.trim() || null,
        is_web_visible: form.is_web_visible,
      } : x))
    }
    setSaving(false); closeModal()
  }

  async function deleteCategory(id: string) {
    if (cats.some(c => c.parent_id === id)) { alert('Primero elimina o mueve las subcategorías'); return }
    if (!confirm('¿Eliminar categoría? Los productos de Stock quedarán sin categoría asignada.')) return
    const supabase = createClient()
    await supabase.from('categories').delete().eq('id', id)
    setCats(c => c.filter(x => x.id !== id))
  }

  async function toggleVisibility(id: string, current: boolean) {
    setToggling(t => ({ ...t, [id]: true }))
    const supabase = createClient()
    await supabase.from('categories').update({ is_web_visible: !current }).eq('id', id)
    setCats(c => c.map(x => x.id === id ? { ...x, is_web_visible: !current } : x))
    setToggling(t => { const n = { ...t }; delete n[id]; return n })
  }

  async function moveOrder(id: string, dir: -1 | 1) {
    const cat = cats.find(c => c.id === id)!
    const siblings = cats.filter(c => (c.parent_id ?? null) === (cat.parent_id ?? null)).sort((a, b) => a.web_sort_order - b.web_sort_order)
    const idx = siblings.findIndex(c => c.id === id)
    const swapIdx = idx + dir
    if (swapIdx < 0 || swapIdx >= siblings.length) return
    const swap = siblings[swapIdx]
    const supabase = createClient()
    await Promise.all([
      supabase.from('categories').update({ web_sort_order: swap.web_sort_order }).eq('id', id),
      supabase.from('categories').update({ web_sort_order: cat.web_sort_order }).eq('id', swap.id),
    ])
    setCats(c => c.map(x => x.id === id ? { ...x, web_sort_order: swap.web_sort_order } : x.id === swap.id ? { ...x, web_sort_order: cat.web_sort_order } : x))
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

  const roots = cats.filter(c => !c.parent_id).sort((a, b) => a.web_sort_order - b.web_sort_order)
  const getChildren = (parentId: string) => cats.filter(c => c.parent_id === parentId).sort((a, b) => a.web_sort_order - b.web_sort_order)

  // Products for the selected category (by primary category_id OR store_product_categories)
  const getProductsInCat = (catId: string) =>
    products.filter(p => p.category_id === catId || p.store_product_categories.some(a => a.category_id === catId))
  const getProductsNotInCat = (catId: string) =>
    products.filter(p => p.category_id !== catId && !p.store_product_categories.some(a => a.category_id === catId))
  const uncategorized = products.filter(p => !p.category_id && p.store_product_categories.length === 0)

  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #ECEEF2; font-family: 'Inter', -apple-system, sans-serif; -webkit-font-smoothing: antialiased; }
        .shell { display: flex; min-height: 100dvh; }
        .main  { flex: 1; overflow-y: auto; }
        .topbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 20px 20px 0; }
        @media(min-width:768px){ .topbar { padding: 20px 40px 0; } }
        .page-title { font-size: 24px; font-weight: 800; color: #1A1A20; }
        .tab-row { display: flex; gap: 4px; padding: 12px 20px 16px; }
        @media(min-width:768px){ .tab-row { padding: 12px 40px 20px; } }
        .tab-pill { padding: 6px 16px; border-radius: 50px; border: 1.5px solid transparent; font-size: 13px; font-weight: 700; cursor: pointer; font-family: inherit; transition: all 0.15s; background: transparent; color: rgba(26,26,32,0.40); }
        .tab-pill.active { background: #1A1A20; color: #fff; border-color: #1A1A20; }
        .tab-pill:not(.active):hover { background: rgba(0,0,0,0.04); color: #1A1A20; }
        .content { padding: 0 16px 120px; }
        @media(min-width:768px){ .content { padding: 0 32px 64px; } }
        .card { background: #ECEEF2; border-radius: 24px; overflow: hidden; box-shadow: 6px 6px 18px rgba(0,0,0,0.08), -4px -4px 12px rgba(255,255,255,0.95), inset 0 1px 0 rgba(255,255,255,0.7); margin-bottom: 16px; }
        .row { display: flex; align-items: center; gap: 10px; padding: 13px 16px; border-top: 1px solid rgba(0,0,0,0.05); }
        .row:first-child { border-top: none; }
        .row-name { font-size: 14px; font-weight: 700; color: #1A1A20; }
        .row-sub  { font-size: 12px; color: rgba(26,26,32,0.38); margin-top: 1px; }
        .slug-tag { font-size: 11px; font-weight: 600; background: rgba(0,0,0,0.05); border-radius: 6px; padding: 2px 7px; color: rgba(26,26,32,0.40); font-family: monospace; }
        .icon-btn { width: 30px; height: 30px; border-radius: 8px; border: none; background: transparent; cursor: pointer; display: flex; align-items: center; justify-content: center; color: rgba(26,26,32,0.40); transition: background 0.12s, color 0.12s; flex-shrink: 0; }
        .icon-btn:hover { background: rgba(0,0,0,0.06); color: #1A1A20; }
        .icon-btn.danger:hover { background: rgba(220,38,38,0.08); color: #DC2626; }
        .add-btn { display: flex; align-items: center; gap: 6px; padding: 9px 16px; border-radius: 14px; border: none; background: #1A1A20; color: #CAFF3A; font-size: 13px; font-weight: 700; cursor: pointer; font-family: inherit; }
        .add-sub-btn { display: flex; align-items: center; gap: 5px; padding: 5px 10px; border-radius: 10px; border: 1.5px solid rgba(0,0,0,0.10); background: transparent; color: rgba(26,26,32,0.45); font-size: 11px; font-weight: 700; cursor: pointer; font-family: inherit; flex-shrink: 0; white-space: nowrap; }
        .add-sub-btn:hover { background: rgba(0,0,0,0.04); color: #1A1A20; }
        .empty { padding: 40px 24px; text-align: center; color: rgba(26,26,32,0.35); font-size: 14px; font-weight: 500; line-height: 1.6; }
        .top-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
        .count-label { font-size: 13px; color: rgba(26,26,32,0.35); font-weight: 500; }
        .section-title { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .07em; color: rgba(26,26,32,0.35); margin-bottom: 8px; margin-top: 20px; }
        .section-title:first-child { margin-top: 0; }

        /* Visibility dot toggle */
        .vis-btn { width: 28px; height: 28px; border-radius: 50%; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: opacity 0.12s; background: transparent; }
        .vis-dot { width: 10px; height: 10px; border-radius: 50%; }
        .vis-btn:disabled { opacity: 0.4; cursor: not-allowed; }

        /* Filter bar */
        .filter-row { display: flex; gap: 6px; margin-bottom: 14px; flex-wrap: wrap; }
        .filter-chip { padding: 6px 14px; border-radius: 50px; border: 1.5px solid rgba(0,0,0,0.10); font-size: 12px; font-weight: 700; cursor: pointer; font-family: inherit; background: transparent; color: rgba(26,26,32,0.50); transition: all 0.12s; }
        .filter-chip.active { background: #1A1A20; color: #fff; border-color: #1A1A20; }

        /* Product rows */
        .prod-row { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-top: 1px solid rgba(0,0,0,0.05); }
        .prod-row:first-child { border-top: none; }
        .prod-thumb { width: 40px; height: 40px; border-radius: 10px; background: rgba(0,0,0,0.06); flex-shrink: 0; object-fit: cover; }
        .cat-add-btn { padding: 7px 14px; border-radius: 10px; font-size: 12px; font-weight: 700; cursor: pointer; border: 1.5px solid #1A1A20; background: #1A1A20; color: #CAFF3A; font-family: inherit; white-space: nowrap; flex-shrink: 0; transition: opacity 0.12s; }
        .cat-add-btn:hover { opacity: 0.8; }
        .cat-add-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .cat-remove-btn { padding: 7px 14px; border-radius: 10px; font-size: 12px; font-weight: 700; cursor: pointer; border: 1.5px solid rgba(220,38,38,0.25); background: rgba(220,38,38,0.06); color: #DC2626; font-family: inherit; white-space: nowrap; flex-shrink: 0; transition: opacity 0.12s; }
        .cat-remove-btn:hover { opacity: 0.7; }
        .cat-remove-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .primary-badge { font-size: 10px; font-weight: 700; background: rgba(29,78,216,0.10); color: #1D4ED8; border-radius: 6px; padding: 2px 7px; flex-shrink: 0; }

        /* Modal */
        .overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.35); z-index: 200; display: flex; align-items: flex-end; justify-content: center; }
        @media(min-width:768px){ .overlay { align-items: center; } }
        .modal { background: #ECEEF2; border-radius: 28px 28px 0 0; padding: 28px 24px 40px; width: 100%; max-width: 480px; box-shadow: 0 -8px 40px rgba(0,0,0,0.14); }
        @media(min-width:768px){ .modal { border-radius: 28px; padding: 32px; } }
        .modal-title { font-size: 20px; font-weight: 800; color: #1A1A20; margin-bottom: 20px; }
        .field-lbl { font-size: 11px; font-weight: 700; color: rgba(26,26,32,0.35); text-transform: uppercase; letter-spacing: .07em; margin-bottom: 6px; }
        .field-hint { font-size: 11px; color: rgba(26,26,32,0.38); margin-top: -10px; margin-bottom: 12px; }
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
        .info-banner { background: rgba(29,78,216,0.06); border: 1px solid rgba(29,78,216,0.15); border-radius: 14px; padding: 12px 16px; margin-bottom: 16px; font-size: 13px; color: #1D4ED8; font-weight: 500; line-height: 1.5; }
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
                <div className="info-banner">
                  Las categorías que creas aquí también aparecen en <strong>Stock</strong> al agregar productos. Son el mismo registro.
                </div>
                <div className="top-row">
                  <span className="count-label">{cats.length} categoría{cats.length !== 1 ? 's' : ''}</span>
                  <button className="add-btn" onClick={() => openNew()}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    Nueva categoría
                  </button>
                </div>

                {cats.length === 0 ? (
                  <div className="card"><div className="empty">Aún no hay categorías.<br/>Créalas aquí o en el módulo de <strong>Stock</strong> — se sincronizan automáticamente.</div></div>
                ) : (
                  <div className="card">
                    {roots.map(root => {
                      const children = getChildren(root.id)
                      return (
                        <div key={root.id}>
                          <div className="row">
                            <button
                              className="vis-btn" title={root.is_web_visible ? 'Visible en tienda — clic para ocultar' : 'Oculto en tienda — clic para mostrar'}
                              disabled={!!toggling[root.id]}
                              onClick={() => toggleVisibility(root.id, root.is_web_visible)}
                            >
                              <div className="vis-dot" style={{ background: root.is_web_visible ? '#059669' : '#D1D5DB' }} />
                            </button>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div className="row-name">{root.name}</div>
                              <div className="row-sub">
                                <span className="slug-tag">/{root.slug}</span>
                                {children.length > 0 && ` · ${children.length} sub`}
                              </div>
                            </div>
                            <button className="add-sub-btn" onClick={() => openNew(root.id)}>+ Sub</button>
                            <button className="icon-btn" onClick={() => moveOrder(root.id, -1)}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="18 15 12 9 6 15"/></svg>
                            </button>
                            <button className="icon-btn" onClick={() => moveOrder(root.id, 1)}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="6 9 12 15 18 9"/></svg>
                            </button>
                            <button className="icon-btn" onClick={() => openEdit(root)}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                            </button>
                            <button className="icon-btn danger" onClick={() => deleteCategory(root.id)}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
                            </button>
                          </div>

                          {children.map(sub => (
                            <div key={sub.id} className="row" style={{ paddingLeft: 40, background: 'rgba(0,0,0,0.015)' }}>
                              <button className="vis-btn" disabled={!!toggling[sub.id]} onClick={() => toggleVisibility(sub.id, sub.is_web_visible)}>
                                <div className="vis-dot" style={{ width: 8, height: 8, background: sub.is_web_visible ? '#059669' : '#D1D5DB' }} />
                              </button>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div className="row-name" style={{ fontSize: 13 }}>{sub.name}</div>
                                <div className="row-sub"><span className="slug-tag">/{root.slug}/{sub.slug}</span></div>
                              </div>
                              <button className="icon-btn" onClick={() => moveOrder(sub.id, -1)}>
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="18 15 12 9 6 15"/></svg>
                              </button>
                              <button className="icon-btn" onClick={() => moveOrder(sub.id, 1)}>
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="6 9 12 15 18 9"/></svg>
                              </button>
                              <button className="icon-btn" onClick={() => openEdit(sub)}>
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                              </button>
                              <button className="icon-btn danger" onClick={() => deleteCategory(sub.id)}>
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
                <div className="info-banner">
                  La categoría de cada producto se asigna desde <strong>Stock → producto → Categoría</strong>. Aquí puedes añadirlos a categorías adicionales de la tienda.
                </div>

                {cats.length === 0 ? (
                  <div className="card"><div className="empty">Primero crea categorías en la tab Categorías</div></div>
                ) : (
                  <>
                    <div className="filter-row">
                      <button className={`filter-chip${catFilter === 'none' ? ' active' : ''}`} onClick={() => setCatFilter('none')}>Sin categoría</button>
                      {cats.map(c => (
                        <button key={c.id} className={`filter-chip${catFilter === c.id ? ' active' : ''}`} onClick={() => setCatFilter(c.id)}>
                          {c.parent_id ? '└ ' : ''}{c.name}
                        </button>
                      ))}
                    </div>

                    {catFilter === 'none' ? (
                      <div className="card">
                        {uncategorized.length === 0
                          ? <div className="empty">Todos los productos tienen categoría asignada</div>
                          : uncategorized.map(p => {
                            const thumb = p.product_images.find(i => i.is_primary)?.url ?? p.product_images[0]?.url
                            return (
                              <div key={p.id} className="prod-row">
                                {thumb ? <img className="prod-thumb" src={thumb} alt={p.name} /> : <div className="prod-thumb" />}
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div className="row-name">{p.name}</div>
                                  <div className="row-sub">Asigna la categoría desde Stock</div>
                                </div>
                              </div>
                            )
                          })
                        }
                      </div>
                    ) : (() => {
                      const activeCat = cats.find(c => c.id === catFilter)!
                      const inCat = getProductsInCat(catFilter)
                      const notInCat = getProductsNotInCat(catFilter)
                      return (
                        <>
                          <div className="section-title">{inCat.length} producto{inCat.length !== 1 ? 's' : ''} en {activeCat.name}</div>
                          <div className="card">
                            {inCat.length === 0
                              ? <div className="empty">Sin productos aún — agrega uno abajo</div>
                              : inCat.map(p => {
                                const thumb = p.product_images.find(i => i.is_primary)?.url ?? p.product_images[0]?.url
                                const isPrimary = p.category_id === catFilter
                                const busy = !!assigning[`${p.id}-${catFilter}`]
                                return (
                                  <div key={p.id} className="prod-row">
                                    {thumb ? <img className="prod-thumb" src={thumb} alt={p.name} /> : <div className="prod-thumb" />}
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                      <div className="row-name">{p.name}</div>
                                    </div>
                                    {isPrimary
                                      ? <span className="primary-badge">Principal</span>
                                      : <button className="cat-remove-btn" disabled={busy} onClick={() => toggleProductCategory(p.id, catFilter, true)}>
                                          {busy ? '...' : 'Quitar'}
                                        </button>
                                    }
                                  </div>
                                )
                              })
                            }
                          </div>

                          {notInCat.length > 0 && (
                            <>
                              <div className="section-title">Agregar a {activeCat.name}</div>
                              <div className="card">
                                {notInCat.map(p => {
                                  const thumb = p.product_images.find(i => i.is_primary)?.url ?? p.product_images[0]?.url
                                  const busy = !!assigning[`${p.id}-${catFilter}`]
                                  const currentCat = p.category_id ? cats.find(c => c.id === p.category_id)?.name : null
                                  return (
                                    <div key={p.id} className="prod-row">
                                      {thumb ? <img className="prod-thumb" src={thumb} alt={p.name} /> : <div className="prod-thumb" />}
                                      <div style={{ flex: 1, minWidth: 0 }}>
                                        <div className="row-name">{p.name}</div>
                                        {currentCat && <div className="row-sub">Cat. principal: {currentCat}</div>}
                                      </div>
                                      <button className="cat-add-btn" disabled={busy} onClick={() => toggleProductCategory(p.id, catFilter, false)}>
                                        {busy ? '...' : '+ Agregar'}
                                      </button>
                                    </div>
                                  )
                                })}
                              </div>
                            </>
                          )}
                        </>
                      )
                    })()}
                  </>
                )}
              </>
            )}
          </div>
        </main>
      </div>

      <BottomNav active="store" />

      {/* ── MODAL CATEGORÍA ── */}
      {modal && (
        <div className="overlay" onClick={e => e.target === e.currentTarget && closeModal()}>
          <div className="modal">
            <div className="modal-title">
              {modal === 'new' ? (form.parent_id ? `Nueva subcategoría` : 'Nueva categoría') : 'Editar categoría'}
            </div>
            {form.parent_id && modal === 'new' && (
              <div className="field-hint" style={{ marginBottom: 14, fontSize: 12, color: 'rgba(26,26,32,0.45)', fontWeight: 500 }}>
                Subcategoría de: <strong>{cats.find(c => c.id === form.parent_id)?.name}</strong>
              </div>
            )}
            {err && <div className="alert-err">{err}</div>}

            <div className="field-lbl">Nombre *</div>
            <input className="field-input" type="text" value={form.name} onChange={e => handleNameChange(e.target.value)} placeholder="Ej: Mujer, Calzado, Tops..." autoFocus />

            <div className="field-lbl">Slug (URL) *</div>
            <input className="field-input" type="text" value={form.slug} onChange={e => setForm(f => ({ ...f, slug: e.target.value }))} placeholder="mujer, calzado, tops..." />
            <div className="field-hint">Se usa en la URL de la tienda: northea.cc/<em>{form.slug || 'mujer'}</em></div>

            {modal === 'edit' && editing?.parent_id && (
              <>
                <div className="field-lbl">Subcategoría de</div>
                <select className="field-select" value={form.parent_id} onChange={e => setForm(f => ({ ...f, parent_id: e.target.value }))}>
                  {cats.filter(c => !c.parent_id && c.id !== editing?.id).map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </>
            )}

            <div className="toggle-row">
              <span className="toggle-label">Visible en la tienda</span>
              <label className="tog-wrap">
                <input type="checkbox" checked={form.is_web_visible} onChange={e => setForm(f => ({ ...f, is_web_visible: e.target.checked }))} />
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
