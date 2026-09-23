'use client'

import { useEffect, useState } from 'react'
import Sidebar from '@/components/Sidebar'

interface Inputs {
  productPriceUsd: string
  tripTotalUsd: string
  shopperFeeUsd: string
  importCostUsd: string
  salesTaxPct: string
  exchangeRate: string
  marginPct: string
  packagingMxn: string
  shippingMxn: string
}

const DEFAULTS: Inputs = {
  productPriceUsd: '', tripTotalUsd: '', shopperFeeUsd: '', importCostUsd: '',
  salesTaxPct: '8', exchangeRate: '18.50', marginPct: '40', packagingMxn: '15', shippingMxn: '80',
}

const STORAGE_KEY = '_erp_calc_inputs'

function fmtUsd(n: number) { return n.toLocaleString('es-MX', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }) }
function fmtMxn(n: number) { return n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 2 }) }
function pct(n: number) { return `${(n * 100).toFixed(2)}%` }
function num(s: string) { const n = parseFloat(s); return Number.isFinite(n) ? n : 0 }

export default function CalculatorClient() {
  const [inputs, setInputs] = useState<Inputs>(DEFAULTS)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) setInputs(prev => ({ ...prev, ...JSON.parse(raw) }))
    } catch { /* ignore */ }
    setLoaded(true)
  }, [])

  useEffect(() => {
    if (!loaded) return
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(inputs)) } catch { /* ignore */ }
  }, [inputs, loaded])

  function set<K extends keyof Inputs>(key: K, value: string) {
    setInputs(prev => ({ ...prev, [key]: value }))
  }

  // ── Cálculo ──────────────────────────────────────────────────────────────
  const productPrice = num(inputs.productPriceUsd)
  const tripTotal = num(inputs.tripTotalUsd)
  const shopperFee = num(inputs.shopperFeeUsd)
  const importCost = num(inputs.importCostUsd)
  const salesTaxPct = num(inputs.salesTaxPct) / 100
  const exchangeRate = num(inputs.exchangeRate)
  const marginPct = num(inputs.marginPct) / 100
  const packaging = num(inputs.packagingMxn)
  const shipping = num(inputs.shippingMxn)

  const shopperPct = tripTotal > 0 ? shopperFee / tripTotal : 0
  const importPct = tripTotal > 0 ? importCost / tripTotal : 0

  const withTax = productPrice * (1 + salesTaxPct)
  const withShopper = withTax + withTax * shopperPct
  const totalUsd = withShopper + withTax * importPct
  const costBaseMxn = totalUsd * exchangeRate
  const priceWithMargin = marginPct < 1 ? costBaseMxn / (1 - marginPct) : 0
  const finalPrice = priceWithMargin + packaging + shipping

  // Comparación: qué pasaría si en vez de margen real usaras markup sobre costo
  const markupPrice = costBaseMxn * (1 + marginPct) + packaging + shipping
  const realMarginOnMarkup = markupPrice > 0 ? (markupPrice - packaging - shipping - costBaseMxn) / (markupPrice - packaging - shipping) : 0

  const ready = productPrice > 0 && exchangeRate > 0 && marginPct < 1

  const rows: { label: string; value: string; sub?: string; bold?: boolean; accent?: boolean }[] = [
    { label: 'Precio del producto', value: fmtUsd(productPrice) },
    { label: `+ Sales tax (${(salesTaxPct * 100).toFixed(1)}%)`, value: fmtUsd(withTax), sub: 'Subtotal con tax' },
    { label: `+ Fee del shopper (${pct(shopperPct)} del viaje)`, value: fmtUsd(withShopper) },
    { label: `+ Importación (${pct(importPct)} del viaje)`, value: fmtUsd(totalUsd), sub: 'Costo total en USD' },
    { label: `× Tipo de cambio (${exchangeRate || 0})`, value: fmtMxn(costBaseMxn), sub: 'COSTO BASE EN MXN', bold: true },
    { label: `÷ (1 − ${(marginPct * 100).toFixed(0)}% margen)`, value: fmtMxn(priceWithMargin), sub: 'Precio con tu ganancia', accent: true },
    { label: '+ Packaging (a costo)', value: fmtMxn(packaging) },
    { label: '+ Envío al cliente (a costo)', value: fmtMxn(shipping) },
  ]

  return (
    <>
      <style>{`
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        body{background:var(--bg,#ECEEF2);font-family:var(--font,'Inter',-apple-system,sans-serif);-webkit-font-smoothing:antialiased}
        .content{padding-left:20px;padding-right:20px;padding-top:20px;padding-bottom:calc(var(--nav-h,88px) + 16px)}
        @media(min-width:768px){.content{padding-left:40px;padding-right:40px;padding-top:76px;max-width:960px;margin:0 auto}}
        .page-title{font-size:22px;font-weight:800;color:var(--text-1,#1A1A20);letter-spacing:-0.4px;margin-bottom:4px}
        .page-sub{font-size:13px;color:var(--text-3,rgba(26,26,32,0.45));margin-bottom:22px}

        .grid{display:grid;grid-template-columns:1fr;gap:16px}
        @media(min-width:900px){.grid{grid-template-columns:1fr 1fr}}

        .sec-title{font-size:12px;font-weight:800;color:var(--text-3,rgba(26,26,32,0.45));text-transform:uppercase;letter-spacing:0.06em;margin:18px 0 10px}
        .sec-title:first-child{margin-top:0}
        .card{background:var(--bg,#ECEEF2);border-radius:var(--r-xl,24px);overflow:hidden;box-shadow:var(--shadow-card);margin-bottom:4px}
        .field{padding:12px 18px;border-top:1px solid var(--border-light,rgba(0,0,0,0.04))}
        .field:first-child{border-top:none}
        .fl{font-size:11px;font-weight:700;color:var(--text-4,rgba(26,26,32,0.35));text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px}
        .fi{width:100%;padding:11px 14px;background:rgba(0,0,0,0.03);border:1.5px solid var(--border,rgba(0,0,0,0.07));border-radius:var(--r-md,14px);font-size:14px;font-weight:600;color:var(--text-1,#1A1A20);font-family:inherit;outline:none;transition:border-color 0.15s;text-align:right}
        .fi:focus{border-color:var(--brand-mid,#2563EB)}
        .derived{padding:10px 18px;font-size:11.5px;color:var(--text-3,rgba(26,26,32,0.45));border-top:1px solid var(--border-light,rgba(0,0,0,0.04))}
        .derived strong{color:var(--text-1,#1A1A20)}

        .waterfall{background:var(--bg,#ECEEF2);border-radius:var(--r-xl,24px);box-shadow:var(--shadow-card);overflow:hidden}
        .w-row{display:flex;justify-content:space-between;align-items:baseline;padding:12px 20px;border-top:1px solid var(--border-light,rgba(0,0,0,0.05))}
        .w-row:first-child{border-top:none}
        .w-label{font-size:12.5px;color:var(--text-3,rgba(26,26,32,0.55));font-weight:600}
        .w-value{font-size:13.5px;font-weight:700;color:var(--text-1,#1A1A20);font-variant-numeric:tabular-nums}
        .w-row.bold .w-label,.w-row.bold .w-value{font-size:14.5px;font-weight:800;color:var(--text-1,#1A1A20)}
        .w-row.accent{background:rgba(37,99,235,0.06)}
        .w-row.accent .w-value{color:#1D4ED8}
        .w-sub{font-size:10px;color:var(--text-4,rgba(26,26,32,0.35));text-transform:uppercase;letter-spacing:0.05em;margin-top:2px}

        .final-box{padding:22px 20px;text-align:center;background:linear-gradient(145deg,#1D4ED8,#2563EB);color:white}
        .final-lbl{font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;opacity:.75;margin-bottom:6px}
        .final-val{font-size:34px;font-weight:900;letter-spacing:-0.5px}

        .compare-box{margin-top:14px;padding:14px 18px;background:rgba(217,119,6,0.08);border-radius:16px;font-size:12px;color:#92400E;line-height:1.6}
        .compare-box strong{color:#7A5C1E}

        .not-ready{padding:60px 20px;text-align:center;color:var(--text-3,rgba(26,26,32,0.4));font-size:13px}
      `}</style>

      <Sidebar active="calculadora" />

      <div className="content">
        <div className="page-title">Calculadora de precios</div>
        <div className="page-sub">Herramienta interna — no afecta productos, stock ni ventas. Solo te ayuda a decidir cuánto cobrar.</div>

        <div className="grid">
          <div>
            <div className="sec-title">Datos de este viaje de compra</div>
            <div className="card">
              <div className="field"><div className="fl">Valor total de la compra (USD)</div><input className="fi" type="number" min="0" step="0.01" placeholder="1773.00" value={inputs.tripTotalUsd} onChange={e => set('tripTotalUsd', e.target.value)} /></div>
              <div className="field"><div className="fl">Costo del shopper, total (USD)</div><input className="fi" type="number" min="0" step="0.01" placeholder="200.00" value={inputs.shopperFeeUsd} onChange={e => set('shopperFeeUsd', e.target.value)} /></div>
              <div className="field"><div className="fl">Costo de envío / importación, total (USD)</div><input className="fi" type="number" min="0" step="0.01" placeholder="150.00" value={inputs.importCostUsd} onChange={e => set('importCostUsd', e.target.value)} /></div>
              {tripTotal > 0 && (
                <div className="derived">% shopper: <strong>{pct(shopperPct)}</strong> &nbsp;·&nbsp; % importación: <strong>{pct(importPct)}</strong> — se aplican a cualquier producto de este viaje</div>
              )}
            </div>

            <div className="sec-title">Este producto</div>
            <div className="card">
              <div className="field"><div className="fl">Precio del producto (USD)</div><input className="fi" type="number" min="0" step="0.01" placeholder="50.00" value={inputs.productPriceUsd} onChange={e => set('productPriceUsd', e.target.value)} /></div>
              <div className="field"><div className="fl">Packaging de este producto (MXN)</div><input className="fi" type="number" min="0" step="0.01" value={inputs.packagingMxn} onChange={e => set('packagingMxn', e.target.value)} /></div>
              <div className="field"><div className="fl">Envío al cliente final (MXN)</div><input className="fi" type="number" min="0" step="0.01" value={inputs.shippingMxn} onChange={e => set('shippingMxn', e.target.value)} /></div>
            </div>

            <div className="sec-title">General</div>
            <div className="card">
              <div className="field"><div className="fl">Sales tax EUA (%)</div><input className="fi" type="number" min="0" step="0.01" value={inputs.salesTaxPct} onChange={e => set('salesTaxPct', e.target.value)} /></div>
              <div className="field"><div className="fl">Tipo de cambio USD → MXN</div><input className="fi" type="number" min="0" step="0.01" value={inputs.exchangeRate} onChange={e => set('exchangeRate', e.target.value)} /></div>
              <div className="field"><div className="fl">Margen deseado (%)</div><input className="fi" type="number" min="0" max="99" step="1" value={inputs.marginPct} onChange={e => set('marginPct', e.target.value)} /></div>
            </div>
          </div>

          <div>
            <div className="sec-title">Resultado</div>
            {!ready ? (
              <div className="waterfall"><div className="not-ready">Ingresa el precio del producto, tipo de cambio y margen para ver el cálculo.</div></div>
            ) : (
              <>
                <div className="waterfall">
                  {rows.map((r, i) => (
                    <div key={i} className={`w-row${r.bold ? ' bold' : ''}${r.accent ? ' accent' : ''}`}>
                      <div>
                        <div className="w-label">{r.label}</div>
                        {r.sub && <div className="w-sub">{r.sub}</div>}
                      </div>
                      <div className="w-value">{r.value}</div>
                    </div>
                  ))}
                  <div className="final-box">
                    <div className="final-lbl">Precio final de venta</div>
                    <div className="final-val">{fmtMxn(finalPrice)}</div>
                  </div>
                </div>

                <div className="compare-box">
                  <strong>Ojo con la diferencia:</strong> si en vez de margen real usaras un markup del {(marginPct * 100).toFixed(0)}% sobre tu costo, el precio saldría en {fmtMxn(markupPrice)} — pero tu margen real ahí sería solo {pct(realMarginOnMarkup)}, no {(marginPct * 100).toFixed(0)}%. Esta calculadora usa margen real (el {(marginPct * 100).toFixed(0)}% que pediste es exactamente lo que te queda sobre el precio de venta del producto).
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
