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

export default function StoreClient({ orgId, categories: init, products: initP, userName, orgName }: {
  orgId: string; categories: Category[]; products: Product[]; userName: string; orgName: string
}) {
  const [cats]  = useState(init)
  const [prods, setProds] = useState(initP)

  // DnD state
  const [draggedId,  setDraggedId]  = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<string | null>(null)
  const [assigning,  setAssigning]  = useState<Record<string, boolean>>({})

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
        .topbar { display: flex; align-items: center; gap: 12px; padding: 20px 20px 0; }
        @media(min-width:768px){ .topbar { padding: 20px 40px 0; } }
        .page-title { font-size: 24px; font-weight: 800; color: #1A1A20; }
        .page-sub { font-size: 13px; color: rgba(26,26,32,0.38); font-weight: 500; margin-top: 2px; }
        .content { padding: 16px 16px 120px; }
        @media(min-width:768px){ .content { padding: 20px 32px 64px; } }

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
              <div className="page-sub">Arrastra productos a las categorías para publicarlos en la tienda</div>
            </div>
          </div>

          <div className="content">
            {cats.length === 0 ? (
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
