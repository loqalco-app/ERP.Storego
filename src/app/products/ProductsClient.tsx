'use client'

import { useState } from 'react'
import Link from 'next/link'
import Sidebar from '@/components/Sidebar'
import BottomNav from '@/components/BottomNav'

interface Variant { id: string; sku: string; sale_price: number; cost_price: number; status: string; stock_levels: { quantity_available: number }[] }
interface Product {
  id: string; name: string; slug: string; status: string
  condition: string; is_published: boolean; created_at: string
  categories: { name: string } | null
  brands: { name: string } | null
  product_variants: Variant[]
}

interface Props { products: Product[]; userName: string; orgName: string }

const STATUS_LABEL: Record<string, string> = { active: 'Activo', draft: 'Borrador', archived: 'Archivado' }
const STATUS_COLOR: Record<string, string> = {
  active:   'background:rgba(5,150,105,0.10);color:#065f46',
  draft:    'background:rgba(202,138,4,0.10);color:#92400e',
  archived: 'background:rgba(107,114,128,0.12);color:#374151',
}

function priceRange(variants: Variant[]) {
  if (!variants.length) return '—'
  const prices = variants.map(v => v.sale_price)
  const min = Math.min(...prices), max = Math.max(...prices)
  const fmt = (n: number) => `$${n.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`
  return min === max ? fmt(min) : `${fmt(min)} – ${fmt(max)}`
}

function totalStock(variants: Variant[]) {
  return variants.reduce((sum, v) =>
    sum + (v.stock_levels ?? []).reduce((s, sl) => s + (sl.quantity_available ?? 0), 0), 0
  )
}

export default function ProductsClient({ products, userName, orgName }: Props) {
  const [q, setQ] = useState('')

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(q.toLowerCase()) ||
    p.product_variants.some(v => v.sku.toLowerCase().includes(q.toLowerCase()))
  )

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #ECEEF2; font-family: 'Inter', -apple-system, sans-serif; -webkit-font-smoothing: antialiased; }

        .shell { display: flex; min-height: 100dvh; }
        .main  { flex: 1; overflow-y: auto; }

        .topbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 20px 20px 16px; }
        @media (min-width: 768px) { .topbar { padding: 20px 40px 20px; } }
        .page-title { font-size: 26px; font-weight: 800; color: #1A1A20; letter-spacing: -0.5px; }

        .new-btn {
          display: flex; align-items: center; gap: 7px;
          background: linear-gradient(145deg, #1D4ED8, #2563EB);
          color: white; border: none; border-radius: 14px;
          padding: 11px 18px; font-size: 14px; font-weight: 700;
          cursor: pointer; font-family: inherit; text-decoration: none;
          box-shadow: 0 6px 20px rgba(29,78,216,0.28);
          transition: opacity 0.15s;
        }
        .new-btn:hover { opacity: 0.90; }

        .content { padding: 0 16px 120px; }
        @media (min-width: 768px) { .content { padding: 0 32px 48px; } }

        .search-wrap { margin-bottom: 16px; position: relative; }
        .search-icon { position: absolute; left: 14px; top: 50%; transform: translateY(-50%); pointer-events: none; }
        .search-input {
          width: 100%; padding: 13px 16px 13px 42px;
          background: #ECEEF2;
          border: 1.5px solid rgba(0,0,0,0.07);
          border-radius: 16px;
          font-size: 15px; font-weight: 500; color: #1A1A20;
          font-family: inherit; outline: none;
          box-shadow: inset 3px 3px 8px rgba(0,0,0,0.07), inset -2px -2px 6px rgba(255,255,255,0.85);
          transition: border-color 0.15s;
        }
        .search-input::placeholder { color: rgba(26,26,32,0.28); }
        .search-input:focus { border-color: #2563EB; }

        .card { background: #ECEEF2; border-radius: 24px; overflow: hidden; box-shadow: 6px 6px 18px rgba(0,0,0,0.08), -4px -4px 12px rgba(255,255,255,0.95), inset 0 1px 0 rgba(255,255,255,0.7); }

        .prod-row { display: flex; align-items: center; gap: 14px; padding: 14px 20px; border-top: 1px solid rgba(0,0,0,0.05); text-decoration: none; transition: background 0.12s; cursor: pointer; }
        .prod-row:first-child { border-top: none; }
        .prod-row:hover { background: rgba(37,99,235,0.04); }

        .prod-icon { width: 44px; height: 44px; background: #ECEEF2; border-radius: 14px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; box-shadow: 4px 4px 10px rgba(0,0,0,0.08), -3px -3px 7px rgba(255,255,255,0.90); }
        .prod-name { font-size: 14px; font-weight: 700; color: #1A1A20; margin-bottom: 3px; }
        .prod-meta { font-size: 12px; color: rgba(26,26,32,0.38); }
        .prod-price { font-size: 14px; font-weight: 700; color: #1A1A20; white-space: nowrap; text-align: right; }
        .prod-sku   { font-size: 11px; color: rgba(26,26,32,0.35); text-align: right; margin-top: 2px; }

        .badge { display: inline-block; padding: 3px 10px; border-radius: 50px; font-size: 11px; font-weight: 700; }

        .empty { padding: 56px 24px; text-align: center; }
        .empty-icon { width: 64px; height: 64px; background: #ECEEF2; border-radius: 20px; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px; box-shadow: 5px 5px 14px rgba(0,0,0,0.07), -4px -4px 10px rgba(255,255,255,0.90); }
        .empty-title { font-size: 17px; font-weight: 800; color: #1A1A20; margin-bottom: 6px; }
        .empty-sub   { font-size: 14px; color: rgba(26,26,32,0.38); margin-bottom: 20px; }
        .empty-btn { display: inline-flex; align-items: center; gap: 7px; background: linear-gradient(145deg,#1D4ED8,#2563EB); color: white; border: none; border-radius: 14px; padding: 12px 22px; font-size: 14px; font-weight: 700; cursor: pointer; text-decoration: none; font-family: inherit; box-shadow: 0 6px 20px rgba(29,78,216,0.28); }

        .count-label { font-size: 13px; color: rgba(26,26,32,0.35); font-weight: 500; margin-bottom: 10px; }
      `}</style>

      <div className="shell">
        <Sidebar orgName={orgName} userName={userName} active="products" />

        <main className="main">
          <div className="topbar">
            <div className="page-title">Productos</div>
            <Link href="/products/new" className="new-btn">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              Nuevo
            </Link>
          </div>

          <div className="content">
            <div className="search-wrap">
              <div className="search-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(26,26,32,0.35)" strokeWidth="2" strokeLinecap="round">
                  <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
              </div>
              <input
                className="search-input"
                type="text"
                placeholder="Buscar por nombre o SKU..."
                value={q}
                onChange={e => setQ(e.target.value)}
              />
            </div>

            {filtered.length > 0 && (
              <div className="count-label">{filtered.length} producto{filtered.length !== 1 ? 's' : ''}</div>
            )}

            <div className="card">
              {filtered.length === 0 ? (
                <div className="empty">
                  <div className="empty-icon">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="rgba(26,26,32,0.30)" strokeWidth="1.8" strokeLinecap="round">
                      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                    </svg>
                  </div>
                  <div className="empty-title">{q ? 'Sin resultados' : 'Sin productos aún'}</div>
                  <div className="empty-sub">{q ? `No se encontró "${q}"` : 'Agrega tu primer producto para empezar'}</div>
                  {!q && (
                    <Link href="/products/new" className="empty-btn">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
                        <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                      </svg>
                      Crear primer producto
                    </Link>
                  )}
                </div>
              ) : (
                filtered.map(p => {
                  const firstSku = p.product_variants[0]?.sku ?? '—'
                  const cat = (p.categories as unknown as { name: string } | null)?.name
                  return (
                    <Link key={p.id} href={`/products/${p.id}/edit`} className="prod-row">
                      <div className="prod-icon">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(29,78,216,0.60)" strokeWidth="1.8" strokeLinecap="round">
                          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                        </svg>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="prod-name">{p.name}</div>
                        <div className="prod-meta">
                          {cat && <span>{cat} · </span>}
                          {p.product_variants.length} variante{p.product_variants.length !== 1 ? 's' : ''}
                          {' · '}
                          <span style={{ display: 'inline-block' }}>
                            <span className="badge" style={{ cssText: STATUS_COLOR[p.status] } as React.CSSProperties}>{STATUS_LABEL[p.status]}</span>
                          </span>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div className="prod-price">{priceRange(p.product_variants)}</div>
                        <div className="prod-sku">
                          {totalStock(p.product_variants)} en stock · {firstSku}
                        </div>
                      </div>
                    </Link>
                  )
                })
              )}
            </div>
          </div>
        </main>
      </div>

      <BottomNav active="products" />
    </>
  )
}
