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
  is_featured: boolean; home_sort_order: number
  category_id: string | null
  product_images: { url: string; is_primary: boolean }[]
  store_product_categories: { category_id: string }[]
}

export default function StoreClient({ orgId, categories: init, products: initP, userName, orgName }: {
  orgId: string; categories: Category[]; products: Product[]; userName: string; orgName: string
}) {
  const [tab, setTab] = useState<'productos' | 'home'>('productos')
  const [cats]  = useState(init)
  const [prods, setProds] = useState(initP)

  // DnD state
  const [draggedId,  setDraggedId]  = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<string | null>(null)
  const [assigning,  setAssigning]  = useState<Record<string, boolean>>({})
  const [featuring,  setFeaturing]  = useState<Record<string, boolean>>({})

  function revalidateStore() {
    fetch('/api/store/revalidate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orgId }) }).catch(() => {})
  }

  async function toggleFeatured(productId: string, newValue: boolean) {
    setFeaturing(f => ({ ...f, [productId]: true }))
    const maxOrder = prods.reduce((m, p) => Math.max(m, p.home_sort_order), -1)
    const newOrder = newValue ? maxOrder + 1 : 0
    setProds(ps => ps.map(p => p.id === productId ? { ...p, is_featured: newValue, home_sort_order: newOrder } : p))
    await createClient().from('products').update({ is_featured: newValue, home_sort_order: newOrder }).eq('id', productId)
    revalidateStore()
    setFeaturing(f => { const n = { ...f }; delete n[productId]; return n })
  }

  async function moveFeatured(productId: string, dir: -1 | 1) {
    const featured = prods.filter(p => p.is_featured).sort((a, b) => a.home_sort_order - b.home_sort_order)
    const idx = featured.findIndex(p => p.id === productId)
    const swapIdx = idx + dir
    if (swapIdx < 0 || swapIdx >= featured.length) return
    const a = featured[idx], b = featured[swapIdx]
    setProds(ps => ps.map(p => p.id === a.id ? { ...p, home_sort_order: b.home_sort_order } : p.id === b.id ? { ...p, home_sort_order: a.home_sort_order } : p))
    const supabase = createClient()
    await Promise.all([
      supabase.from('products').update({ home_sort_order: b.home_sort_order }).eq('id', a.id),
      supabase.from('products').update({ home_sort_order: a.home_sort_order }).eq('id', b.id),
    ])
    revalidateStore()
  }

  // ── Web store assignment via store_product_categories ──
  async function assignToWebCat(productId: string, catId: string) {
    const key = `${productId}-${catId}`
    setAssigning(a => ({ ...a, [key]: true }))
    const existing = prods.find(p => p.id === productId)?.store_product_categories ?? []
    await createClient().from('store_product_categories').upsert(
      { product_id: productId, category_id: catId, sort_order: existing.length },
      { onConflict: 'product_id,category_id' }
    )
    setProds(ps => ps.map(p => p.id === productId
      ? { ...p, store_product_categories: p.store_product_categories.some(a => a.category_id === catId)
          ? p.store_product_categories
          : [...p.store_product_categories, { category_id: catId }] }
      : p
    ))
    setAssigning(a => { const n = { ...a }; delete n[key]; return n })
  }

  async function removeFromWebCat(productId: string, catId: string) {
    const key = `${productId}-${catId}`
    setAssigning(a => ({ ...a, [key]: true }))
    await createClient().from('store_product_categories').delete().eq('product_id', productId).eq('category_id', catId)
    setProds(ps => ps.map(p => p.id === productId
      ? { ...p, store_product_categories: p.store_product_categories.filter(a => a.category_id !== catId) }
      : p
    ))
    setAssigning(a => { const n = { ...a }; delete n[key]; return n })
  }

  async function dropProduct(catId: string) {
    if (!draggedId) return
    setDropTarget(null)
    await assignToWebCat(draggedId, catId)
    setDraggedId(null)
  }

  const roots      = cats.filter(c => !c.parent_id).sort((a, b) => a.web_sort_order - b.web_sort_order)
  const getChildren = (pid: string) => cats.filter(c => c.parent_id === pid).sort((a, b) => a.web_sort_order - b.web_sort_order)
  const prodsByCat  = (catId: string) => prods.filter(p => p.store_product_categories.some(a => a.category_id === catId))
  const getCatLabels = (p: Product) => p.store_product_categories.map(a => cats.find(c => c.id === a.category_id)?.name).filter(Boolean).join(', ')

  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #ECEEF2; font-family: 'Inter', -apple-system, sans-serif; -webkit-font-smoothing: antialiased; }
        .shell { display: flex; min-height: 100dvh; }
        .main  { flex: 1; overflow-y: auto; }
        .page-title { font-size: 24px; font-weight: 800; color: #1A1A20; }
        .page-sub { font-size: 13px; color: rgba(26,26,32,0.38); font-weight: 500; margin-top: 2px; }
        .content { padding: 16px 16px 120px; }
        @media(min-width:768px){ .content { padding: 20px 32px 64px; } }
        .live-link { display: flex; align-items: center; gap: 6px; padding: 9px 16px; border-radius: 14px; background: #1A1A20; color: #CAFF3A; font-size: 12px; font-weight: 700; text-decoration: none; white-space: nowrap; flex-shrink: 0; }
        .tab-row { display: flex; gap: 4px; padding: 16px 20px 0; }
        @media(min-width:768px){ .tab-row { padding: 16px 40px 0; } }
        .tab-pill { padding: 6px 16px; border-radius: 50px; border: 1.5px solid transparent; font-size: 13px; font-weight: 700; cursor: pointer; font-family: inherit; transition: all 0.15s; background: transparent; color: rgba(26,26,32,0.40); }
        .tab-pill.active { background: #1A1A20; color: #fff; border-color: #1A1A20; }
        .tab-pill:not(.active):hover { background: rgba(0,0,0,0.04); color: #1A1A20; }
        .icon-btn { width: 26px; height: 26px; border-radius: 8px; border: none; background: rgba(0,0,0,0.05); cursor: pointer; display: flex; align-items: center; justify-content: center; color: rgba(26,26,32,0.45); flex-shrink: 0; }
        .icon-btn:hover:not(:disabled) { background: rgba(0,0,0,0.10); color: #1A1A20; }
        .icon-btn:disabled { opacity: 0.3; cursor: not-allowed; }
        .star-btn { background: none; border: none; cursor: pointer; padding: 3px; display: flex; flex-shrink: 0; }
        .star-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .feat-row { display: flex; align-items: center; gap: 8px; padding: 9px 10px; background: rgba(255,255,255,0.65); border-radius: 12px; margin-bottom: 8px; box-shadow: 3px 3px 8px rgba(0,0,0,0.05); }
        .feat-order { font-size: 12px; font-weight: 800; color: #1D4ED8; width: 18px; text-align: center; flex-shrink: 0; }
        .feat-actions { display: flex; align-items: center; gap: 4px; flex-shrink: 0; }

        /* ── Two-column DnD layout ── */
        .dnd-layout { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; align-items: start; }
        @media(max-width:860px){ .dnd-layout { grid-template-columns: 1fr; } }

        .col-hdr { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .07em; color: rgba(26,26,32,0.35); margin-bottom: 6px; }
        .col-hint { font-size: 12px; color: rgba(26,26,32,0.40); margin-bottom: 14px; line-height: 1.5; }

        /* Left: category zones */
        .cat-zone { background: #ECEEF2; border-radius: 18px; padding: 14px; margin-bottom: 12px; box-shadow: 5px 5px 15px rgba(0,0,0,0.07),-3px -3px 9px rgba(255,255,255,0.90); }
        .cat-zone-hdr { font-size: 14px; font-weight: 800; color: #1A1A20; margin-bottom: 10px; display: flex; align-items: center; gap: 8px; }
        .cat-count { font-size: 11px; font-weight: 700; background: rgba(29,78,216,0.10); color: #1D4ED8; border-radius: 50px; padding: 2px 8px; }

        .subcat-zone { margin-top: 8px; padding: 10px 12px; background: rgba(0,0,0,0.03); border-radius: 13px; }
        .subcat-hdr { font-size: 12px; font-weight: 700; color: rgba(26,26,32,0.52); margin-bottom: 8px; display: flex; align-items: center; gap: 6px; }
        .subcat-count { font-size: 10px; font-weight: 700; background: rgba(29,78,216,0.10); color: #1D4ED8; border-radius: 50px; padding: 2px 6px; }

        /* Assigned product row */
        .ap { display: flex; align-items: center; gap: 8px; padding: 7px 8px; background: rgba(255,255,255,0.65); border-radius: 10px; margin-bottom: 5px; }
        .ap-thumb { width: 30px; height: 30px; border-radius: 7px; object-fit: cover; background: rgba(0,0,0,0.07); flex-shrink: 0; }
        .ap-name { font-size: 12px; font-weight: 600; color: #1A1A20; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1; min-width: 0; }
        .ap-rm { background: none; border: none; cursor: pointer; color: rgba(26,26,32,0.25); padding: 2px 5px; font-size: 16px; border-radius: 6px; line-height: 1; flex-shrink: 0; }
        .ap-rm:hover:not(:disabled) { color: #DC2626; background: rgba(220,38,38,0.07); }
        .ap-rm:disabled { opacity: 0.3; cursor: not-allowed; }

        /* Drop zone */
        .drop-zone { border: 2px dashed rgba(0,0,0,0.12); border-radius: 10px; padding: 12px; text-align: center; font-size: 12px; font-weight: 600; color: rgba(26,26,32,0.28); transition: all 0.15s; margin-top: 6px; min-height: 44px; display: flex; align-items: center; justify-content: center; }
        .drop-zone.over { border-color: #2563EB; background: rgba(29,78,216,0.06); color: #2563EB; }

        /* Right: product pool */
        .prod-pool { display: flex; flex-direction: column; gap: 8px; }
        .prod-card { display: flex; align-items: center; gap: 10px; padding: 12px 14px; background: #ECEEF2; border-radius: 16px; box-shadow: 4px 4px 12px rgba(0,0,0,0.07),-3px -3px 8px rgba(255,255,255,0.90); cursor: grab; user-select: none; transition: opacity 0.15s, transform 0.12s, box-shadow 0.15s; }
        .prod-card:hover { box-shadow: 6px 6px 18px rgba(0,0,0,0.10),-4px -4px 12px rgba(255,255,255,0.95); }
        .prod-card.dragging { opacity: 0.38; cursor: grabbing; transform: scale(0.97); }
        .drag-handle { display: flex; flex-direction: column; gap: 3px; color: rgba(26,26,32,0.20); flex-shrink: 0; padding: 2px; }
        .dot-row { display: flex; gap: 3px; }
        .dot { width: 3px; height: 3px; border-radius: 50%; background: currentColor; }
        .prod-thumb { width: 40px; height: 40px; border-radius: 10px; object-fit: cover; background: rgba(0,0,0,0.07); flex-shrink: 0; }
        .prod-name { font-size: 13px; font-weight: 700; color: #1A1A20; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
        .prod-cats { font-size: 11px; font-weight: 600; color: #059669; margin-top: 3px; }
        .prod-no-cat { font-size: 11px; color: rgba(26,26,32,0.30); margin-top: 3px; }

        .empty-left { padding: 32px 20px; text-align: center; font-size: 13px; color: rgba(26,26,32,0.35); font-weight: 500; line-height: 1.6; }
        .empty-right { font-size: 13px; color: rgba(26,26,32,0.35); font-weight: 500; text-align: center; padding: 40px 20px; }
      `}</style>

      <div className="shell">
        <Sidebar orgName={orgName} userName={userName} active="store" />
        <main className="main">
          <div className="topbar">
            <div>
              <div className="page-title">Tienda web</div>
              <div className="page-sub">{tab === 'productos' ? 'Arrastra productos a las categorías para publicarlos en la tienda' : 'Elige y ordena qué se ve primero en el Home de la tienda'}</div>
            </div>
            <a href="https://northea.cc" target="_blank" rel="noopener noreferrer" className="live-link">
              Ver sitio en vivo
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
            </a>
          </div>

          <div className="tab-row">
            <button className={`tab-pill${tab === 'productos' ? ' active' : ''}`} onClick={() => setTab('productos')}>Productos</button>
            <button className={`tab-pill${tab === 'home' ? ' active' : ''}`} onClick={() => setTab('home')}>Home</button>
          </div>

          <div className="content">
            {tab === 'home' ? (
              <div className="dnd-layout">
                <div>
                  <div className="col-hdr">Destacados en Home</div>
                  <div className="col-hint">Estos productos son los que se ven primero en el Home de la tienda, en este orden. Si no marcas ninguno, se muestran todos los publicados.</div>
                  {prods.filter(p => p.is_featured).sort((a, b) => a.home_sort_order - b.home_sort_order).length === 0 ? (
                    <div className="empty-left">Sin destacados todavía.<br/>Marca productos de la lista de la derecha con la estrella.</div>
                  ) : (
                    prods.filter(p => p.is_featured).sort((a, b) => a.home_sort_order - b.home_sort_order).map((p, i, arr) => {
                      const thumb = p.product_images.find(img => img.is_primary)?.url ?? p.product_images[0]?.url
                      return (
                        <div key={p.id} className="feat-row">
                          <span className="feat-order">{i + 1}</span>
                          {thumb ? <img className="ap-thumb" src={thumb} alt="" /> : <div className="ap-thumb" />}
                          <span className="ap-name">{p.name}</span>
                          <div className="feat-actions">
                            <button className="icon-btn" disabled={i === 0} onClick={() => moveFeatured(p.id, -1)} title="Subir">
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="18 15 12 9 6 15"/></svg>
                            </button>
                            <button className="icon-btn" disabled={i === arr.length - 1} onClick={() => moveFeatured(p.id, 1)} title="Bajar">
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="6 9 12 15 18 9"/></svg>
                            </button>
                            <button className="ap-rm" disabled={!!featuring[p.id]} onClick={() => toggleFeatured(p.id, false)} title="Quitar de Home">×</button>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>

                <div>
                  <div className="col-hdr">Todos los productos publicados</div>
                  <div className="col-hint">Clic en la estrella para destacar en el Home.</div>
                  {prods.filter(p => p.is_published).length === 0 ? (
                    <div className="empty-right">No hay productos publicados aún.</div>
                  ) : (
                    <div className="prod-pool">
                      {prods.filter(p => p.is_published).map(p => {
                        const thumb = p.product_images.find(img => img.is_primary)?.url ?? p.product_images[0]?.url
                        return (
                          <div key={p.id} className="prod-card" style={{ cursor: 'default' }}>
                            <button className="star-btn" disabled={!!featuring[p.id]} onClick={() => toggleFeatured(p.id, !p.is_featured)} title={p.is_featured ? 'Quitar de Home' : 'Destacar en Home'}>
                              <svg width="18" height="18" viewBox="0 0 24 24" fill={p.is_featured ? '#D97706' : 'none'} stroke={p.is_featured ? '#D97706' : 'rgba(26,26,32,0.30)'} strokeWidth="1.8"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                            </button>
                            {thumb ? <img className="prod-thumb" src={thumb} alt="" /> : <div className="prod-thumb" />}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div className="prod-name">{p.name}</div>
                              {p.is_featured && <div className="prod-cats">✓ En Home</div>}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            ) : cats.length === 0 ? (
              <div style={{background:'#ECEEF2',borderRadius:20,boxShadow:'5px 5px 15px rgba(0,0,0,0.07),-3px -3px 9px rgba(255,255,255,0.90)',padding:32,textAlign:'center'}}>
                <div style={{fontSize:14,fontWeight:600,color:'rgba(26,26,32,0.40)',lineHeight:1.6}}>
                  Aún no hay categorías.<br/>
                  Créalas en <strong>Stock → Inventario → Categorías</strong> y aparecerán aquí.
                </div>
              </div>
            ) : (
              <div className="dnd-layout">

                {/* LEFT — category drop zones */}
                <div>
                  <div className="col-hdr">Categorías de la tienda</div>
                  <div className="col-hint">Suelta un producto en la zona punteada para asignarlo. El × lo quita.</div>

                  {roots.map(root => {
                    const subs     = getChildren(root.id)
                    const rootProds = prodsByCat(root.id)
                    const isOver    = dropTarget === root.id
                    return (
                      <div key={root.id} className="cat-zone">
                        <div className="cat-zone-hdr">
                          {root.name}
                          <span className="cat-count">{rootProds.length}</span>
                        </div>

                        {rootProds.map(p => {
                          const thumb = p.product_images.find(i => i.is_primary)?.url ?? p.product_images[0]?.url
                          const key   = `${p.id}-${root.id}`
                          return (
                            <div key={p.id} className="ap">
                              {thumb ? <img className="ap-thumb" src={thumb} alt="" /> : <div className="ap-thumb" />}
                              <span className="ap-name">{p.name}</span>
                              <button className="ap-rm" disabled={!!assigning[key]} onClick={() => removeFromWebCat(p.id, root.id)} title="Quitar de esta categoría">×</button>
                            </div>
                          )
                        })}

                        <div
                          className={`drop-zone${isOver ? ' over' : ''}`}
                          onDragOver={e => { e.preventDefault(); setDropTarget(root.id) }}
                          onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropTarget(null) }}
                          onDrop={() => dropProduct(root.id)}
                        >
                          {isOver ? '◎  Suelta aquí' : 'Arrastra un producto aquí'}
                        </div>

                        {subs.map(sub => {
                          const subProds = prodsByCat(sub.id)
                          const isOverSub = dropTarget === sub.id
                          return (
                            <div key={sub.id} className="subcat-zone">
                              <div className="subcat-hdr">
                                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
                                {sub.name}
                                <span className="subcat-count">{subProds.length}</span>
                              </div>
                              {subProds.map(p => {
                                const thumb = p.product_images.find(i => i.is_primary)?.url ?? p.product_images[0]?.url
                                const key   = `${p.id}-${sub.id}`
                                return (
                                  <div key={p.id} className="ap">
                                    {thumb ? <img className="ap-thumb" src={thumb} alt="" /> : <div className="ap-thumb" />}
                                    <span className="ap-name">{p.name}</span>
                                    <button className="ap-rm" disabled={!!assigning[key]} onClick={() => removeFromWebCat(p.id, sub.id)}>×</button>
                                  </div>
                                )
                              })}
                              <div
                                className={`drop-zone${isOverSub ? ' over' : ''}`}
                                onDragOver={e => { e.preventDefault(); setDropTarget(sub.id) }}
                                onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropTarget(null) }}
                                onDrop={() => dropProduct(sub.id)}
                              >
                                {isOverSub ? '◎  Suelta aquí' : 'Arrastra aquí'}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )
                  })}
                </div>

                {/* RIGHT — product pool */}
                <div>
                  <div className="col-hdr">Todos los productos</div>
                  <div className="col-hint">{prods.length} producto{prods.length !== 1 ? 's' : ''} en Stock. Arrastra a la categoría que quieras.</div>
                  {prods.length === 0 ? (
                    <div className="empty-right">
                      No hay productos aún.<br/>
                      Créalos en <strong>Stock → Inventario</strong>.
                    </div>
                  ) : (
                    <div className="prod-pool">
                      {prods.map(p => {
                        const thumb     = p.product_images.find(i => i.is_primary)?.url ?? p.product_images[0]?.url
                        const catLabels = getCatLabels(p)
                        const isDragging = draggedId === p.id
                        return (
                          <div
                            key={p.id}
                            className={`prod-card${isDragging ? ' dragging' : ''}`}
                            draggable
                            onDragStart={() => setDraggedId(p.id)}
                            onDragEnd={() => { setDraggedId(null); setDropTarget(null) }}
                          >
                            <div className="drag-handle">
                              <div className="dot-row"><div className="dot"/><div className="dot"/></div>
                              <div className="dot-row"><div className="dot"/><div className="dot"/></div>
                              <div className="dot-row"><div className="dot"/><div className="dot"/></div>
                            </div>
                            {thumb ? <img className="prod-thumb" src={thumb} alt="" /> : <div className="prod-thumb" />}
                            <div style={{flex:1,minWidth:0}}>
                              <div className="prod-name">{p.name}</div>
                              {catLabels
                                ? <div className="prod-cats">✓ {catLabels}</div>
                                : <div className="prod-no-cat">Sin categoría web</div>
                              }
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

              </div>
            )}
          </div>
        </main>
      </div>

      <BottomNav active="store" />
    </>
  )
}
