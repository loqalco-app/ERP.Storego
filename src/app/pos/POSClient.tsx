'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Sidebar from '@/components/Sidebar'

// ─── Types ────────────────────────────────────────────────────────────────────
type Variant  = { id: string; name: string; sku: string; sale_price: number; cost_price: number; stock: number }
type Product  = { id: string; name: string; variants: Variant[] }
type Customer = { id: string; full_name: string; email: string | null; phone: string | null }
type CartItem = {
  key: string
  productId: string; variantId: string
  productName: string; variantName: string; sku: string
  unitPrice: number; costPrice: number; quantity: number; discount: number
}
type PaymentEntry = { method: 'efectivo' | 'tarjeta' | 'transferencia' | 'otro'; amount: string }
type ParkedSale  = { id: string; savedAt: string; customer: Customer | null; cart: CartItem[]; total: number }
type PosView     = 'home' | 'selling' | 'parked'

const METHODS = [
  { value: 'efectivo',      label: 'Efectivo' },
  { value: 'tarjeta',       label: 'Tarjeta' },
  { value: 'transferencia', label: 'Transferencia' },
  { value: 'otro',          label: 'Otro' },
] as const

const fmt = (n: number) => n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })

// ─── Component ────────────────────────────────────────────────────────────────
export default function POSClient({
  orgId, userId, initialProducts, initialCustomers,
}: {
  orgId: string; userId: string
  initialProducts: Product[]; initialCustomers: Customer[]
}) {
  const router  = useRouter()
  const supabase = createClient()

  // ── View ────────────────────────────────────────────────────────────────────
  const [posView, setPosView] = useState<PosView>('home')

  // ── Products & search ───────────────────────────────────────────────────────
  const [products] = useState<Product[]>(initialProducts)
  const [search, setSearch]   = useState('')
  const [selectedVariants, setSelectedVariants] = useState<Record<string, string>>({})

  // ── Customer ────────────────────────────────────────────────────────────────
  const [customers, setCustomers] = useState<Customer[]>(initialCustomers)
  const [customer, setCustomer]   = useState<Customer | null>(null)
  const [custSearch, setCustSearch] = useState('')
  const [showCustDrop, setShowCustDrop] = useState(false)
  const [showNewCust, setShowNewCust]   = useState(false)
  const [newCust, setNewCust]           = useState({ full_name: '', email: '', phone: '' })
  const [savingCust, setSavingCust]     = useState(false)
  const custRef = useRef<HTMLDivElement>(null)

  // ── Cart ────────────────────────────────────────────────────────────────────
  const [cart, setCart] = useState<CartItem[]>([])

  // ── Payment & Shipping ──────────────────────────────────────────────────────
  const [showPayment, setShowPayment] = useState(false)
  const [payments, setPayments]       = useState<PaymentEntry[]>([{ method: 'efectivo', amount: '' }])
  const [isApartado, setIsApartado]   = useState(false)
  const [showShipping, setShowShipping] = useState(false)
  const [shipType, setShipType]         = useState<'pickup' | 'envio'>('pickup')
  const [shipAddr, setShipAddr]         = useState({ line1: '', line2: '', city: '', state: '', zip: '' })
  const [skipAddr, setSkipAddr]         = useState(false)

  // ── Mobile sheet ────────────────────────────────────────────────────────────
  const [showCartSheet, setShowCartSheet] = useState(false)
  const [sheetState, setSheetState]       = useState<'peek' | 'full'>('peek')
  const [sheetCustSearch, setSheetCustSearch]   = useState('')
  const [showSheetCustDrop, setShowSheetCustDrop] = useState(false)
  const sheetCustRef = useRef<HTMLDivElement>(null)
  const sheetRef     = useRef<HTMLDivElement>(null)
  const dragStartY   = useRef(0)
  const dragCurrentY = useRef(0)

  function onHandleTouchStart(e: React.TouchEvent) { dragStartY.current = e.touches[0].clientY; dragCurrentY.current = 0 }
  function onHandleTouchMove(e: React.TouchEvent) {
    const delta = e.touches[0].clientY - dragStartY.current
    dragCurrentY.current = delta
    if (sheetRef.current) { sheetRef.current.style.transform = `translateY(${Math.max(0, delta)}px)`; sheetRef.current.style.transition = 'none' }
  }
  function onHandleTouchEnd() {
    const delta = dragCurrentY.current
    if (sheetRef.current) { sheetRef.current.style.transform = ''; sheetRef.current.style.transition = 'height 0.3s cubic-bezier(0.32,0.72,0,1),transform 0.3s cubic-bezier(0.32,0.72,0,1)' }
    if (delta > 70) { if (sheetState === 'full') setSheetState('peek'); else setShowCartSheet(false) }
    else if (delta < -70) setSheetState('full')
    dragCurrentY.current = 0
  }

  useEffect(() => {
    function h(e: MouseEvent) { if (sheetCustRef.current && !sheetCustRef.current.contains(e.target as Node)) setShowSheetCustDrop(false) }
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h)
  }, [])
  useEffect(() => {
    function h(e: MouseEvent) { if (custRef.current && !custRef.current.contains(e.target as Node)) setShowCustDrop(false) }
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h)
  }, [])

  // ── Parked sales ────────────────────────────────────────────────────────────
  const PARK_KEY = `pos_parked_${orgId}`
  const [parkedSales, setParkedSales] = useState<ParkedSale[]>([])

  useEffect(() => {
    try { const s = localStorage.getItem(PARK_KEY); if (s) setParkedSales(JSON.parse(s)) } catch {}
  }, [PARK_KEY])

  function saveParkedState(sales: ParkedSale[]) {
    setParkedSales(sales)
    try { localStorage.setItem(PARK_KEY, JSON.stringify(sales)) } catch {}
  }

  function parkCurrentCart() {
    if (cart.length === 0) return
    const sale: ParkedSale = {
      id: crypto.randomUUID(), savedAt: new Date().toISOString(),
      customer, cart, total: cart.reduce((s, i) => s + i.unitPrice * i.quantity, 0),
    }
    saveParkedState([...parkedSales, sale])
    setCart([]); setCustomer(null); setCustSearch('')
    setShowCartSheet(false); setPosView('home')
  }

  function restoreParkedSale(id: string) {
    const sale = parkedSales.find(s => s.id === id)
    if (!sale) return
    if (cart.length > 0) {
      const current: ParkedSale = {
        id: crypto.randomUUID(), savedAt: new Date().toISOString(),
        customer, cart, total: cart.reduce((s, i) => s + i.unitPrice * i.quantity, 0),
      }
      saveParkedState([...parkedSales.filter(s => s.id !== id), current])
    } else {
      saveParkedState(parkedSales.filter(s => s.id !== id))
    }
    setCart(sale.cart); setCustomer(sale.customer); setCustSearch('')
    setPosView('selling')
  }

  function deleteParkedSale(id: string) { saveParkedState(parkedSales.filter(s => s.id !== id)) }

  // ── Result ──────────────────────────────────────────────────────────────────
  const [saving, setSaving]     = useState(false)
  const [savedFolio, setSavedFolio] = useState('')

  // ── Derived ─────────────────────────────────────────────────────────────────
  const filteredProducts = useMemo(() => {
    const q = search.toLowerCase().trim()
    if (!q) return products
    return products.filter(p => p.name.toLowerCase().includes(q) || p.variants.some(v => v.sku?.toLowerCase().includes(q) || v.name.toLowerCase().includes(q)))
  }, [products, search])

  const filteredCustomers = useMemo(() => {
    const q = custSearch.toLowerCase().trim()
    if (!q) return customers.slice(0, 8)
    return customers.filter(c => c.full_name.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q) || c.phone?.includes(q)).slice(0, 8)
  }, [customers, custSearch])

  const filteredSheetCustomers = useMemo(() => {
    const q = sheetCustSearch.toLowerCase().trim()
    if (!q) return customers.slice(0, 8)
    return customers.filter(c => c.full_name.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q) || c.phone?.includes(q)).slice(0, 8)
  }, [customers, sheetCustSearch])

  const cartTotal  = cart.reduce((s, i) => s + i.unitPrice * i.quantity, 0)
  const totalPaid  = payments.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0)
  const remaining  = Math.max(0, cartTotal - totalPaid)

  // ── Cart helpers ────────────────────────────────────────────────────────────
  function addToCart(product: Product, variant: Variant) {
    const key = `${product.id}_${variant.id}`
    setCart(prev => {
      const ex = prev.find(i => i.key === key)
      if (ex) return prev.map(i => i.key === key ? { ...i, quantity: i.quantity + 1 } : i)
      return [...prev, { key, productId: product.id, variantId: variant.id, productName: product.name, variantName: variant.name, sku: variant.sku, unitPrice: variant.sale_price, costPrice: variant.cost_price, quantity: 1, discount: 0 }]
    })
  }
  function updateQty(key: string, qty: number) { if (qty < 1) removeItem(key); else setCart(prev => prev.map(i => i.key === key ? { ...i, quantity: qty } : i)) }
  function removeItem(key: string) { setCart(prev => prev.filter(i => i.key !== key)) }

  // ── Customer helpers ─────────────────────────────────────────────────────────
  async function createCustomer() {
    if (!newCust.full_name.trim()) return
    setSavingCust(true)
    const { data, error } = await supabase.from('customers').insert({ organization_id: orgId, full_name: newCust.full_name.trim(), email: newCust.email.trim() || null, phone: newCust.phone.trim() || null, created_by: userId }).select('id, full_name, email, phone').single()
    setSavingCust(false)
    if (error || !data) return
    const c = data as Customer
    setCustomers(prev => [...prev, c]); setCustomer(c); setShowNewCust(false); setNewCust({ full_name: '', email: '', phone: '' })
  }

  // ── Order creation ────────────────────────────────────────────────────────
  async function createOrder() {
    if (!customer || cart.length === 0) return
    setSaving(true)
    const { data: order, error: oErr } = await supabase.from('orders').insert({ organization_id: orgId, customer_id: customer.id, folio: '', status: isApartado ? 'apartado' : (remaining <= 0 ? 'pagado' : 'apartado'), subtotal: cartTotal, discount_amount: 0, total: cartTotal, created_by: userId }).select('id, folio').single()
    if (oErr || !order) { setSaving(false); return }
    await supabase.from('order_items').insert(cart.map(i => ({ order_id: order.id, organization_id: orgId, product_id: i.productId, variant_id: i.variantId, product_name: i.productName, variant_name: i.variantName, sku: i.sku, quantity: i.quantity, unit_price: i.unitPrice, cost_price: i.costPrice, discount_amount: i.discount, subtotal: i.unitPrice * i.quantity - i.discount })))
    const vp = payments.filter(p => parseFloat(p.amount) > 0)
    if (vp.length > 0) await supabase.from('order_payments').insert(vp.map(p => ({ order_id: order.id, organization_id: orgId, method: p.method, amount: parseFloat(p.amount) })))
    const needsAddr = shipType === 'envio' && !skipAddr
    await supabase.from('order_shipping').insert({ order_id: order.id, organization_id: orgId, type: shipType, address_line1: needsAddr ? shipAddr.line1 || null : null, address_line2: needsAddr ? shipAddr.line2 || null : null, city: needsAddr ? shipAddr.city || null : null, state: needsAddr ? shipAddr.state || null : null, zip: needsAddr ? shipAddr.zip || null : null })
    for (const item of cart) await supabase.from('inventory_ledger').insert({ organization_id: orgId, variant_id: item.variantId, movement_type: 'sale', quantity: -item.quantity, source_type: 'order', source_id: order.id, notes: `Venta ${order.folio}` })
    setSaving(false); setSavedFolio(order.folio); setShowShipping(false)
  }

  function resetPOS() {
    setCart([]); setCustomer(null); setCustSearch('')
    setPayments([{ method: 'efectivo', amount: '' }]); setIsApartado(false)
    setShipType('pickup'); setShipAddr({ line1: '', line2: '', city: '', state: '', zip: '' })
    setSkipAddr(false); setSavedFolio(''); setShowCartSheet(false); setSheetState('peek')
    setPosView('home')
  }

  // ── CSS ──────────────────────────────────────────────────────────────────────
  const CSS = `
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
    body{background:var(--bg,#ECEEF2);font-family:'Inter',-apple-system,sans-serif;-webkit-font-smoothing:antialiased}

    /* ── SHARED ── */
    .pos-page{min-height:100dvh;background:var(--bg,#ECEEF2);font-family:'Inter',-apple-system,sans-serif}
    .btn-primary{width:100%;padding:15px;border:none;border-radius:20px;background:linear-gradient(145deg,#1D4ED8,#2563EB);color:white;font-size:15px;font-weight:700;cursor:pointer;font-family:inherit;box-shadow:0 6px 20px rgba(29,78,216,0.28);transition:opacity .15s,transform .12s}
    .btn-primary:hover{opacity:.92}
    .btn-primary:active{transform:scale(.98)}
    .btn-primary:disabled{opacity:.5;cursor:not-allowed}
    .btn-ghost{width:100%;padding:13px;border:1.5px solid rgba(0,0,0,0.12);border-radius:18px;background:none;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;color:rgba(10,10,14,0.55)}
    .btn-ghost:hover{background:rgba(0,0,0,0.04)}
    .btn-sm{padding:5px 12px;border-radius:50px;border:1.5px solid rgba(0,0,0,0.10);background:none;font-size:11px;font-weight:700;color:rgba(10,10,14,0.5);cursor:pointer;font-family:inherit;white-space:nowrap}

    /* ── HOME ── */
    .home-wrap{display:flex;flex-direction:column;min-height:100dvh;padding:max(env(safe-area-inset-top,0px),32px) 24px calc(var(--nav-h,88px) + env(safe-area-inset-bottom,0px) + 24px)}
    @media(min-width:768px){.home-wrap{padding-top:max(env(safe-area-inset-top,0px),64px);max-width:600px;margin:0 auto;padding-left:0;padding-right:0}}
    .home-greeting{font-size:13px;font-weight:700;color:rgba(10,10,14,0.40);text-transform:uppercase;letter-spacing:.08em;margin-bottom:8px}
    .home-title{font-size:30px;font-weight:900;color:#0A0A0E;letter-spacing:-.8px;margin-bottom:4px;line-height:1.1}
    @media(min-width:768px){.home-title{font-size:38px}}
    .home-sub{font-size:14px;color:rgba(10,10,14,0.45);font-weight:500;margin-bottom:40px}
    .home-cards{display:flex;flex-direction:column;gap:16px;flex:1}
    @media(min-width:480px){.home-cards{flex-direction:row}}

    .hcard{flex:1;border-radius:28px;padding:28px 24px;cursor:pointer;border:none;font-family:inherit;text-align:left;display:flex;flex-direction:column;gap:0;transition:transform .15s,box-shadow .15s;position:relative;overflow:hidden}
    .hcard:active{transform:scale(.98)}
    .hcard-new{background:linear-gradient(145deg,#1D4ED8,#2563EB);box-shadow:0 12px 40px rgba(29,78,216,0.35)}
    .hcard-parked{background:var(--bg,#ECEEF2);box-shadow:8px 8px 20px rgba(0,0,0,0.09),-6px -6px 16px rgba(255,255,255,0.95);border:1.5px solid rgba(0,0,0,0.06)}
    .hcard-icon{width:52px;height:52px;border-radius:16px;display:flex;align-items:center;justify-content:center;margin-bottom:20px}
    .hcard-new .hcard-icon{background:rgba(255,255,255,0.18)}
    .hcard-parked .hcard-icon{background:rgba(217,119,6,0.12)}
    .hcard-label{font-size:11px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;margin-bottom:6px}
    .hcard-new .hcard-label{color:rgba(255,255,255,0.65)}
    .hcard-parked .hcard-label{color:rgba(217,119,6,0.80)}
    .hcard-title{font-size:22px;font-weight:900;letter-spacing:-.4px;margin-bottom:8px;line-height:1.1}
    @media(min-width:768px){.hcard-title{font-size:26px}}
    .hcard-new .hcard-title{color:white}
    .hcard-parked .hcard-title{color:#0A0A0E}
    .hcard-desc{font-size:13px;font-weight:500;line-height:1.45}
    .hcard-new .hcard-desc{color:rgba(255,255,255,0.70)}
    .hcard-parked .hcard-desc{color:rgba(10,10,14,0.45)}
    .hcard-badge{position:absolute;top:20px;right:20px;background:rgba(255,255,255,0.25);border-radius:50px;padding:5px 12px;font-size:12px;font-weight:800;color:white}
    .hcard-parked .hcard-badge{background:rgba(217,119,6,0.15);color:#92400E}
    .hcard-arrow{position:absolute;bottom:24px;right:24px;opacity:.5;transition:opacity .15s,transform .15s}
    .hcard:hover .hcard-arrow{opacity:.9;transform:translateX(4px)}
    .hcard-new .hcard-arrow{color:white}
    .hcard-parked .hcard-arrow{color:#0A0A0E}

    /* ── PARKED VIEW ── */
    .parked-view{min-height:100dvh;padding:max(env(safe-area-inset-top,0px),20px) 20px calc(var(--nav-h,88px) + env(safe-area-inset-bottom,0px) + 24px)}
    @media(min-width:768px){.parked-view{max-width:960px;margin:0 auto;padding:max(env(safe-area-inset-top,0px),28px) 0 calc(var(--nav-h,88px) + env(safe-area-inset-bottom,0px) + 24px)}}
    .pv-topbar{display:flex;align-items:center;gap:14px;margin-bottom:28px}
    .pv-back{width:38px;height:38px;border-radius:12px;background:rgba(0,0,0,0.06);border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;color:rgba(10,10,14,0.55);flex-shrink:0}
    .pv-back:hover{background:rgba(0,0,0,0.10)}
    .pv-title{font-size:22px;font-weight:900;color:#0A0A0E;letter-spacing:-.4px}
    .pv-count{font-size:12px;font-weight:700;color:rgba(10,10,14,0.38);margin-left:auto}
    .pv-grid{display:grid;grid-template-columns:1fr;gap:14px}
    @media(min-width:640px){.pv-grid{grid-template-columns:repeat(2,1fr)}}
    @media(min-width:1024px){.pv-grid{grid-template-columns:repeat(3,1fr)}}

    .pk-card{background:var(--bg,#ECEEF2);border-radius:22px;padding:20px;box-shadow:6px 6px 16px rgba(0,0,0,0.07),-4px -4px 12px rgba(255,255,255,0.9);cursor:pointer;border:1.5px solid rgba(0,0,0,0.04);transition:border-color .15s,transform .15s;position:relative}
    .pk-card:hover{border-color:rgba(37,99,235,0.25);transform:translateY(-2px)}
    .pk-card:active{transform:scale(.98)}
    .pk-card-top{display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:14px}
    .pk-avatar{width:44px;height:44px;border-radius:14px;background:linear-gradient(135deg,#D97706,#B45309);display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:900;color:white;flex-shrink:0}
    .pk-del{background:none;border:none;cursor:pointer;color:rgba(10,10,14,0.20);padding:4px;border-radius:8px;transition:color .15s,background .15s}
    .pk-del:hover{color:#DC2626;background:rgba(220,38,38,0.08)}
    .pk-name{font-size:16px;font-weight:800;color:#0A0A0E;margin-bottom:3px;line-height:1.2}
    .pk-time{font-size:11px;font-weight:600;color:rgba(10,10,14,0.38)}
    .pk-items{display:flex;flex-direction:column;gap:4px;margin-bottom:14px;padding:10px 12px;background:rgba(0,0,0,0.03);border-radius:12px}
    .pk-item-row{font-size:12px;color:rgba(10,10,14,0.55);font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .pk-item-more{font-size:11px;font-weight:700;color:rgba(10,10,14,0.35)}
    .pk-footer{display:flex;align-items:center;justify-content:space-between}
    .pk-total{font-size:22px;font-weight:900;color:#0A0A0E;letter-spacing:-.5px}
    .pk-restore{padding:8px 18px;border-radius:50px;border:none;background:linear-gradient(145deg,#1D4ED8,#2563EB);color:white;font-size:12px;font-weight:800;cursor:pointer;font-family:inherit;box-shadow:0 4px 12px rgba(29,78,216,0.25)}
    .pk-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:64px 24px;text-align:center}
    .pk-empty-icon{width:64px;height:64px;border-radius:20px;background:rgba(0,0,0,0.05);display:flex;align-items:center;justify-content:center}
    .pk-empty-title{font-size:16px;font-weight:800;color:rgba(10,10,14,0.35)}
    .pk-empty-sub{font-size:13px;color:rgba(10,10,14,0.30);font-weight:500}

    /* ── SELLING ── */
    /* ── SELLING — desktop centrado y compacto ── */
    .pos-wrap{display:flex;flex-direction:column;height:100dvh;overflow:hidden;background:var(--bg,#ECEEF2);padding-top:env(safe-area-inset-top,0px)}
    .pos-topbar{display:flex;align-items:center;gap:10px;padding:12px 16px 8px;flex-shrink:0;position:relative;z-index:50}
    @media(min-width:768px){.pos-topbar{padding:16px 0 10px;max-width:960px;margin:0 auto;width:100%;padding-left:0;padding-right:0}}
    .pos-back-btn{width:34px;height:34px;border-radius:10px;background:rgba(0,0,0,0.06);border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;color:rgba(10,10,14,0.55);flex-shrink:0}
    .pos-topbar-title{font-size:15px;font-weight:800;color:#0A0A0E}
    .pos-body{display:flex;flex:1;overflow:hidden;min-height:0}
    /* mobile: stack vertical */
    .pos-left{flex:1;display:flex;flex-direction:column;overflow:hidden;padding:0 10px 12px 12px}
    @media(max-width:767px){.pos-left{padding-bottom:calc(var(--nav-h,88px) + env(safe-area-inset-bottom,0px) + 96px)}}
    /* desktop: centrado en max-width con dos columnas */
    @media(min-width:768px){
      .pos-body{justify-content:center}
      .pos-body-inner{display:flex;width:100%;max-width:960px;height:100%;margin:0 auto}
      .pos-left{padding:0 16px 16px 0}
      .pos-right{width:280px;flex-shrink:0;border-left:1px solid rgba(0,0,0,0.07);background:var(--bg,#ECEEF2);display:flex;flex-direction:column}
    }
    @media(min-width:1280px){
      .pos-body-inner{max-width:1100px}
      .pos-right{width:300px}
    }
    .cart-fab{display:none}
    @media(max-width:767px){
      .cart-fab{display:flex;align-items:center;gap:10px;position:fixed;left:16px;right:16px;bottom:calc(var(--nav-h,88px) + env(safe-area-inset-bottom,0px) + 16px);background:linear-gradient(145deg,#1D4ED8,#2563EB);border-radius:20px;padding:14px 18px;box-shadow:0 8px 24px rgba(29,78,216,0.38);cursor:pointer;z-index:200;border:none;font-family:inherit}
      .cart-fab-count{font-size:12px;font-weight:700;color:rgba(255,255,255,0.75)}
      .cart-fab-total{font-size:16px;font-weight:800;color:white;flex:1}
      .cart-fab-cta{font-size:13px;font-weight:700;color:rgba(255,255,255,0.85);white-space:nowrap}
    }
    .sheet-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.4);z-index:500;display:flex;flex-direction:column;justify-content:flex-end}
    .cart-sheet{background:var(--bg,#ECEEF2);border-radius:28px 28px 0 0;display:flex;flex-direction:column;padding-bottom:max(env(safe-area-inset-bottom,0px),8px);transition:height 0.3s cubic-bezier(0.32,0.72,0,1),transform 0.3s cubic-bezier(0.32,0.72,0,1)}
    .cart-sheet.peek{height:58dvh}
    .cart-sheet.full{height:92dvh}
    .sheet-handle-area{padding:12px 0 4px;cursor:grab;touch-action:none;flex-shrink:0}
    .sheet-drag{width:40px;height:4px;border-radius:2px;background:rgba(0,0,0,0.15);margin:0 auto}
    .sheet-hd{display:flex;align-items:center;justify-content:space-between;padding:8px 18px 10px;flex-shrink:0}
    .sheet-title{font-size:17px;font-weight:800;color:var(--text,#0A0A0E)}
    .sheet-close{background:rgba(0,0,0,0.06);border:none;border-radius:50%;width:32px;height:32px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:rgba(10,10,14,0.5)}
    .sheet-cust-wrap{padding:0 16px 10px;flex-shrink:0;position:relative}
    .sheet-cust-box{background:rgba(37,99,235,0.06);border:1.5px solid rgba(37,99,235,0.15);border-radius:14px;padding:10px 14px;display:flex;align-items:center;gap:10px}
    .sheet-cust-selected{display:flex;align-items:center;gap:8px;flex:1}
    .sheet-cust-av{width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,#1D4ED8,#3B82F6);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;color:white;flex-shrink:0}
    .sheet-cust-name{font-size:13px;font-weight:700;color:#1D4ED8}
    .sheet-cust-search{flex:1;border:none;background:none;font-size:14px;font-weight:500;color:var(--text,#0A0A0E);font-family:inherit;outline:none}
    .sheet-cust-search::placeholder{color:rgba(10,10,14,0.35)}
    .sheet-cust-drop{position:absolute;top:calc(100% - 4px);left:16px;right:16px;background:var(--bg,#ECEEF2);border:1.5px solid rgba(0,0,0,0.10);border-radius:14px;box-shadow:0 8px 24px rgba(0,0,0,0.12);z-index:100;overflow:hidden}
    .cust-panel{background:rgba(0,0,0,0.03);border:1.5px solid rgba(0,0,0,0.07);border-radius:16px;padding:12px 14px;margin-bottom:12px;flex-shrink:0;position:relative}
    .cust-label{font-size:10px;font-weight:700;color:rgba(10,10,14,0.38);text-transform:uppercase;letter-spacing:.07em;margin-bottom:6px}
    .cust-row{display:flex;align-items:center;gap:8px}
    .cust-input{flex:1;border:none;background:none;font-size:14px;font-weight:500;color:var(--text,#0A0A0E);font-family:inherit;outline:none}
    .cust-input::placeholder{color:rgba(10,10,14,0.35)}
    .cust-drop{position:absolute;top:calc(100% + 4px);left:0;right:0;background:var(--bg,#ECEEF2);border:1.5px solid rgba(0,0,0,0.10);border-radius:14px;box-shadow:0 8px 24px rgba(0,0,0,0.12);z-index:100;overflow:hidden}
    .cust-opt{padding:10px 14px;font-size:13px;font-weight:500;cursor:pointer;display:flex;flex-direction:column;gap:2px}
    .cust-opt:hover{background:rgba(0,0,0,0.04)}
    .cust-opt-sub{font-size:11px;color:rgba(10,10,14,0.45)}
    .cust-selected{display:flex;align-items:center;gap:8px;flex:1}
    .cust-av{width:30px;height:30px;border-radius:50%;background:linear-gradient(135deg,#1D4ED8,#3B82F6);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;color:white;flex-shrink:0}
    .cust-name{font-size:14px;font-weight:700;color:var(--text,#0A0A0E)}
    .cust-info{font-size:11px;color:rgba(10,10,14,0.45)}
    .search-wrap{position:relative;margin-bottom:12px;flex-shrink:0}
    .search-icon{position:absolute;left:12px;top:50%;transform:translateY(-50%);color:rgba(10,10,14,0.35);pointer-events:none}
    .search-input{width:100%;padding:10px 12px 10px 38px;border:1.5px solid rgba(0,0,0,0.08);border-radius:14px;background:rgba(0,0,0,0.03);font-size:14px;font-weight:500;color:var(--text,#0A0A0E);font-family:inherit;outline:none;transition:border-color .15s}
    .search-input:focus{border-color:#2563EB}
    .prod-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:8px;overflow-y:auto;flex:1;padding-right:4px;align-content:start}
    .prod-card{background:var(--bg,#ECEEF2);border-radius:14px;padding:10px 12px;border:1.5px solid rgba(0,0,0,0.07);box-shadow:3px 3px 8px rgba(0,0,0,0.06),-2px -2px 6px rgba(255,255,255,0.9);transition:transform .12s}
    .prod-card:active{transform:scale(.97)}
    .prod-card-name{font-size:12px;font-weight:700;color:var(--text,#0A0A0E);margin-bottom:2px;line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .prod-card-var{font-size:11px;color:rgba(10,10,14,0.45);margin-bottom:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .prod-card-footer{display:flex;align-items:center;justify-content:space-between}
    .prod-card-price{font-size:13px;font-weight:800;color:#1D4ED8}
    .prod-card-stock{font-size:10px;color:rgba(10,10,14,0.40)}
    .prod-var-sel{width:100%;padding:3px 6px;border-radius:7px;border:1.5px solid rgba(0,0,0,0.10);background:rgba(0,0,0,0.03);font-size:11px;font-family:inherit;margin-bottom:6px;outline:none;color:var(--text,#0A0A0E)}
    .cart-header{padding:14px 16px 10px;font-size:13px;font-weight:800;color:var(--text,#0A0A0E);border-bottom:1px solid rgba(0,0,0,0.06);display:flex;align-items:center;justify-content:space-between;flex-shrink:0}
    .cart-body{flex:1;overflow-y:auto;padding:8px 12px}
    .cart-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;color:rgba(10,10,14,0.30);font-size:13px;font-weight:600;gap:8px}
    .cart-item{padding:10px 0;border-bottom:1px solid rgba(0,0,0,0.05)}
    .cart-item-name{font-size:13px;font-weight:700;color:var(--text,#0A0A0E);margin-bottom:2px}
    .cart-item-sub{font-size:11px;color:rgba(10,10,14,0.45);margin-bottom:6px}
    .cart-item-row{display:flex;align-items:center;gap:8px}
    .qty-ctrl{display:flex;align-items:center;gap:6px}
    .qty-btn{width:26px;height:26px;border-radius:50%;border:1.5px solid rgba(0,0,0,0.12);background:none;cursor:pointer;font-size:14px;font-weight:700;display:flex;align-items:center;justify-content:center;color:var(--text,#0A0A0E);line-height:1}
    .qty-btn:hover{background:rgba(0,0,0,0.06)}
    .qty-num{font-size:14px;font-weight:700;min-width:20px;text-align:center;color:var(--text,#0A0A0E)}
    .item-price{margin-left:auto;font-size:13px;font-weight:700;color:var(--text,#0A0A0E)}
    .rm-btn{background:none;border:none;cursor:pointer;color:rgba(10,10,14,0.30);padding:2px;line-height:1}
    .rm-btn:hover{color:#DC2626}
    .cart-footer{border-top:1px solid rgba(0,0,0,0.07);padding:12px 16px;flex-shrink:0}
    .total-row{display:flex;justify-content:space-between;font-size:13px;color:rgba(10,10,14,0.55);margin-bottom:4px}
    .total-row.big{font-size:20px;font-weight:800;color:var(--text,#0A0A0E);margin-top:4px;margin-bottom:0}
    .park-btn-sm{display:flex;align-items:center;gap:5px;padding:5px 12px;border-radius:50px;border:1.5px solid rgba(0,0,0,0.10);background:none;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit;color:rgba(10,10,14,0.55);transition:background .15s}
    .park-btn-sm:hover{background:rgba(0,0,0,0.05)}
    .modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.45);z-index:1000;display:flex;align-items:flex-end;justify-content:center}
    @media(min-width:640px){.modal-overlay{align-items:center}}
    .modal-sheet{background:var(--bg,#ECEEF2);border-radius:28px 28px 0 0;padding:24px 20px 32px;width:100%;max-width:480px;max-height:90dvh;overflow-y:auto}
    @media(min-width:640px){.modal-sheet{border-radius:28px}}
    .modal-title{font-size:18px;font-weight:800;color:var(--text,#0A0A0E);margin-bottom:18px;letter-spacing:-.3px}
    .modal-label{font-size:11px;font-weight:700;color:rgba(10,10,14,0.38);text-transform:uppercase;letter-spacing:.07em;margin-bottom:6px}
    .modal-input{width:100%;padding:12px 14px;border:1.5px solid rgba(0,0,0,0.08);border-radius:14px;background:rgba(0,0,0,0.03);font-size:15px;font-family:inherit;color:var(--text,#0A0A0E);outline:none;transition:border-color .15s;margin-bottom:14px}
    .modal-input:focus{border-color:#2563EB}
    .toggle-row{display:flex;align-items:center;gap:10px;margin-bottom:14px}
    .toggle{width:40px;height:22px;border-radius:11px;background:rgba(0,0,0,0.15);border:none;cursor:pointer;position:relative;transition:background .2s;flex-shrink:0}
    .toggle.on{background:#1D4ED8}
    .toggle::after{content:'';position:absolute;top:3px;left:3px;width:16px;height:16px;border-radius:50%;background:white;transition:transform .2s;box-shadow:0 1px 4px rgba(0,0,0,0.2)}
    .toggle.on::after{transform:translateX(18px)}
    .toggle-label{font-size:13px;font-weight:600;color:var(--text,#0A0A0E)}
    .payment-entry{display:flex;gap:8px;align-items:center;margin-bottom:8px}
    .add-pay-btn{background:none;border:1.5px dashed rgba(0,0,0,0.15);border-radius:12px;padding:8px 14px;font-size:12px;font-weight:700;color:rgba(10,10,14,0.45);cursor:pointer;width:100%;font-family:inherit;margin-bottom:12px}
    .summary-box{background:rgba(0,0,0,0.035);border-radius:14px;padding:12px 14px;margin-bottom:14px}
    .summary-row{display:flex;justify-content:space-between;font-size:13px;margin-bottom:3px;color:rgba(10,10,14,0.6)}
    .summary-row.total{font-size:16px;font-weight:800;color:var(--text,#0A0A0E);margin-top:6px;padding-top:6px;border-top:1px solid rgba(0,0,0,0.07)}
    .summary-row.remaining{color:#DC2626;font-weight:700}
    .ship-type-row{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px}
    .ship-btn{padding:16px;border-radius:16px;border:1.5px solid rgba(0,0,0,0.10);background:none;cursor:pointer;font-family:inherit;text-align:center;transition:all .15s}
    .ship-btn.active{border-color:#2563EB;background:rgba(37,99,235,0.06)}
    .rm-pay{background:none;border:none;cursor:pointer;color:rgba(10,10,14,0.30);padding:4px;font-size:16px}
    .new-cust-form{margin-top:8px;padding:12px;background:rgba(0,0,0,0.025);border-radius:14px;border:1.5px solid rgba(0,0,0,0.07)}
    .new-cust-input{width:100%;padding:9px 12px;border:1.5px solid rgba(0,0,0,0.08);border-radius:12px;background:rgba(0,0,0,0.03);font-size:13px;font-family:inherit;color:var(--text,#0A0A0E);outline:none;margin-bottom:6px}
    .new-cust-input:focus{border-color:#2563EB}
    .new-cust-btns{display:flex;gap:6px;margin-top:2px}
    .btn-create{flex:1;padding:8px;border-radius:12px;border:none;background:linear-gradient(145deg,#1D4ED8,#2563EB);color:white;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit}
    .btn-cancel-sm{padding:8px 14px;border-radius:12px;border:1.5px solid rgba(0,0,0,0.10);background:none;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;color:rgba(10,10,14,0.5)}
    .success-wrap{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100dvh;background:var(--bg,#ECEEF2);padding:24px;text-align:center;font-family:'Inter',-apple-system,sans-serif}
  `

  // ── Shared sidebar + CSS ─────────────────────────────────────────────────────
  const wrap = (children: React.ReactNode) => (
    <>
      <Sidebar active="pos" />
      <style>{CSS}</style>
      {children}
    </>
  )

  // ── SUCCESS ──────────────────────────────────────────────────────────────────
  if (savedFolio) return wrap(
    <div className="success-wrap">
      <div style={{width:72,height:72,borderRadius:'50%',background:'linear-gradient(135deg,#059669,#10B981)',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 20px',boxShadow:'0 8px 24px rgba(5,150,105,0.30)'}}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
      </div>
      <div style={{fontSize:28,fontWeight:900,color:'#0A0A0E',letterSpacing:'-.5px',marginBottom:6}}>{savedFolio}</div>
      <div style={{fontSize:20,fontWeight:800,color:'#0A0A0E',marginBottom:6}}>¡Orden generada!</div>
      <div style={{fontSize:14,color:'rgba(10,10,14,0.50)',marginBottom:28}}>La venta se registró y el inventario se actualizó.</div>
      <div style={{display:'flex',flexDirection:'column',gap:10,width:'100%',maxWidth:320}}>
        <button className="btn-primary" onClick={resetPOS}>Nueva venta</button>
        <button className="btn-ghost" onClick={() => router.push('/orders')}>Ver todas las órdenes</button>
      </div>
    </div>
  )

  // ── HOME ─────────────────────────────────────────────────────────────────────
  if (posView === 'home') return wrap(
    <div className="home-wrap">
      <div className="home-greeting">Punto de Venta</div>
      <div className="home-title">¿Qué hacemos?</div>
      <div className="home-sub">Elige una opción para comenzar</div>

      <div className="home-cards">
        {/* Nueva venta */}
        <button className="hcard hcard-new" onClick={() => { setCart([]); setCustomer(null); setPosView('selling') }}>
          <div className="hcard-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
          </div>
          <div className="hcard-label">Cobrar ahora</div>
          <div className="hcard-title">Nueva venta</div>
          <div className="hcard-desc">Agrega productos, selecciona cliente y cobra al momento.</div>
          <div className="hcard-arrow">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
          </div>
        </button>

        {/* Ventas guardadas */}
        <button className="hcard hcard-parked" onClick={() => setPosView('parked')}>
          {parkedSales.length > 0 && (
            <div className="hcard-badge">{parkedSales.length} en espera</div>
          )}
          <div className="hcard-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2.5" strokeLinecap="round"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
          </div>
          <div className="hcard-label">Retomar</div>
          <div className="hcard-title">Ventas guardadas</div>
          <div className="hcard-desc">
            {parkedSales.length === 0
              ? 'Guarda ventas en curso para atender a otro cliente.'
              : `Tienes ${parkedSales.length} venta${parkedSales.length > 1 ? 's' : ''} pausada${parkedSales.length > 1 ? 's' : ''} esperando.`}
          </div>
          <div className="hcard-arrow">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
          </div>
        </button>
      </div>
    </div>
  )

  // ── PARKED SALES VIEW ─────────────────────────────────────────────────────────
  if (posView === 'parked') return wrap(
    <div className="parked-view">
      <div className="pv-topbar">
        <button className="pv-back" onClick={() => setPosView('home')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
        </button>
        <div className="pv-title">Ventas guardadas</div>
        {parkedSales.length > 0 && <div className="pv-count">{parkedSales.length} en espera</div>}
      </div>

      {parkedSales.length === 0 ? (
        <div className="pk-empty">
          <div className="pk-empty-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="rgba(10,10,14,0.30)" strokeWidth="2" strokeLinecap="round"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
          </div>
          <div className="pk-empty-title">Sin ventas guardadas</div>
          <div className="pk-empty-sub">Cuando guardes una venta en curso, aparecerá aquí.</div>
          <button className="btn-primary" style={{maxWidth:240,marginTop:8}} onClick={() => setPosView('selling')}>
            Iniciar nueva venta
          </button>
        </div>
      ) : (
        <div className="pv-grid">
          {parkedSales.slice().reverse().map(sale => {
            const t       = new Date(sale.savedAt)
            const timeStr = t.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
            const dateStr = t.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })
            const preview = sale.cart.slice(0, 3)
            const extra   = sale.cart.length - 3
            const initials = sale.customer?.full_name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() ?? '?'

            return (
              <div key={sale.id} className="pk-card" onClick={() => restoreParkedSale(sale.id)}>
                <div className="pk-card-top">
                  <div className="pk-avatar">{initials}</div>
                  <button className="pk-del" onClick={e => { e.stopPropagation(); deleteParkedSale(sale.id) }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>
                  </button>
                </div>
                <div className="pk-name">{sale.customer?.full_name ?? 'Sin cliente'}</div>
                <div className="pk-time">{dateStr} · {timeStr} · {sale.cart.reduce((s, i) => s + i.quantity, 0)} artículo{sale.cart.reduce((s, i) => s + i.quantity, 0) !== 1 ? 's' : ''}</div>

                <div className="pk-items" style={{marginTop:12}}>
                  {preview.map((item, i) => (
                    <div key={i} className="pk-item-row">
                      {item.quantity}× {item.productName}{item.variantName !== item.productName ? ` · ${item.variantName}` : ''}
                    </div>
                  ))}
                  {extra > 0 && <div className="pk-item-more">+{extra} más…</div>}
                </div>

                <div className="pk-footer">
                  <div className="pk-total">{fmt(sale.total)}</div>
                  <button className="pk-restore" onClick={e => { e.stopPropagation(); restoreParkedSale(sale.id) }}>
                    Retomar →
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )

  // ── SELLING VIEW ──────────────────────────────────────────────────────────────
  return wrap(
    <>
      <div className="pos-wrap">
        {/* Top bar */}
        <div className="pos-topbar">
          <button className="pos-back-btn" onClick={() => setPosView('home')}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
          </button>
          <div className="pos-topbar-title">Nueva venta</div>
          {cart.length > 0 && (
            <button className="park-btn-sm" style={{marginLeft:'auto'}} onClick={parkCurrentCart}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
              Guardar venta
            </button>
          )}
          {parkedSales.length > 0 && cart.length === 0 && (
            <button className="park-btn-sm" style={{marginLeft:'auto',borderColor:'rgba(217,119,6,0.25)',color:'#92400E',background:'rgba(217,119,6,0.07)'}} onClick={() => setPosView('parked')}>
              {parkedSales.length} guardada{parkedSales.length > 1 ? 's' : ''} →
            </button>
          )}
        </div>

        <div className="pos-body">
          <div className="pos-body-inner">
          {/* LEFT: Customer + Products */}
          <div className="pos-left">
            <div ref={custRef}>
              <div className="cust-panel">
                <div className="cust-label">Cliente *</div>
                {customer ? (
                  <div className="cust-row">
                    <div className="cust-selected">
                      <div className="cust-av">{customer.full_name.charAt(0).toUpperCase()}</div>
                      <div>
                        <div className="cust-name">{customer.full_name}</div>
                        <div className="cust-info">{customer.phone || customer.email || 'Sin contacto'}</div>
                      </div>
                    </div>
                    <button className="btn-sm" onClick={() => { setCustomer(null); setCustSearch('') }}>Cambiar</button>
                  </div>
                ) : (
                  <>
                    <div className="cust-row">
                      <input className="cust-input" placeholder="Buscar cliente por nombre, email o teléfono…" value={custSearch} onChange={e => { setCustSearch(e.target.value); setShowCustDrop(true) }} onFocus={() => setShowCustDrop(true)} />
                      <button className="btn-sm" onClick={() => setShowNewCust(v => !v)}>+ Nuevo</button>
                    </div>
                    {showCustDrop && filteredCustomers.length > 0 && (
                      <div className="cust-drop">
                        {filteredCustomers.map(c => (
                          <div key={c.id} className="cust-opt" onClick={() => { setCustomer(c); setCustSearch(''); setShowCustDrop(false); setShowNewCust(false) }}>
                            <span style={{fontWeight:700}}>{c.full_name}</span>
                            <span className="cust-opt-sub">{[c.phone, c.email].filter(Boolean).join(' · ')}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {showNewCust && (
                      <div className="new-cust-form">
                        <div style={{fontSize:12,fontWeight:700,color:'var(--text,#0A0A0E)',marginBottom:8}}>Nuevo cliente</div>
                        <input className="new-cust-input" placeholder="Nombre completo *" value={newCust.full_name} onChange={e => setNewCust(p => ({...p, full_name: e.target.value}))} />
                        <input className="new-cust-input" placeholder="Teléfono" value={newCust.phone} onChange={e => setNewCust(p => ({...p, phone: e.target.value}))} />
                        <input className="new-cust-input" placeholder="Email" value={newCust.email} onChange={e => setNewCust(p => ({...p, email: e.target.value}))} />
                        <div className="new-cust-btns">
                          <button className="btn-cancel-sm" onClick={() => setShowNewCust(false)}>Cancelar</button>
                          <button className="btn-create" disabled={savingCust || !newCust.full_name.trim()} onClick={createCustomer}>{savingCust ? 'Guardando…' : 'Crear cliente'}</button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            <div className="search-wrap">
              <span className="search-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg></span>
              <input className="search-input" placeholder="Buscar producto o SKU…" value={search} onChange={e => setSearch(e.target.value)} />
            </div>

            <div className="prod-grid">
              {filteredProducts.map(p => {
                const selVarId = selectedVariants[p.id] ?? p.variants[0]?.id
                const selVar   = p.variants.find(v => v.id === selVarId) ?? p.variants[0]
                if (!selVar) return null
                return (
                  <div key={p.id} className="prod-card">
                    <div className="prod-card-name">{p.name}</div>
                    {p.variants.length > 1 ? (
                      <select className="prod-var-sel" value={selVarId} onChange={e => setSelectedVariants(prev => ({...prev, [p.id]: e.target.value}))} onClick={e => e.stopPropagation()}>
                        {p.variants.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                      </select>
                    ) : (
                      <div className="prod-card-var">{selVar.name}</div>
                    )}
                    <div className="prod-card-footer">
                      <div>
                        <div className="prod-card-price">{fmt(selVar.sale_price)}</div>
                        <div className="prod-card-stock">{selVar.stock > 0 ? `${selVar.stock} en stock` : 'Sin stock'}</div>
                      </div>
                      <button style={{width:30,height:30,borderRadius:'50%',border:'none',background:'linear-gradient(145deg,#1D4ED8,#2563EB)',color:'white',cursor:'pointer',fontSize:20,display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'0 3px 10px rgba(29,78,216,0.28)',flexShrink:0}} onClick={() => addToCart(p, selVar)}>+</button>
                    </div>
                  </div>
                )
              })}
              {filteredProducts.length === 0 && (
                <div style={{gridColumn:'1/-1',textAlign:'center',padding:'40px 0',color:'rgba(10,10,14,0.35)',fontSize:13,fontWeight:600}}>No se encontraron productos</div>
              )}
            </div>
          </div>

          {/* RIGHT: Cart — desktop */}
          <div className="pos-right">
            <div className="cart-header">
              <span>Carrito</span>
              <div style={{display:'flex',gap:6}}>
                {cart.length > 0 && (
                  <button className="park-btn-sm" onClick={parkCurrentCart}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                    Guardar
                  </button>
                )}
                {cart.length > 0 && <button className="btn-sm" style={{color:'#DC2626',borderColor:'rgba(220,38,38,0.2)'}} onClick={() => setCart([])}>Vaciar</button>}
              </div>
            </div>

            <div className="cart-body">
              {cart.length === 0 ? (
                <div className="cart-empty">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
                  Agrega productos
                </div>
              ) : cart.map(item => (
                <div key={item.key} className="cart-item">
                  <div className="cart-item-name">{item.productName}</div>
                  <div className="cart-item-sub">{item.variantName} · {item.sku}</div>
                  <div className="cart-item-row">
                    <div className="qty-ctrl">
                      <button className="qty-btn" onClick={() => updateQty(item.key, item.quantity - 1)}>−</button>
                      <span className="qty-num">{item.quantity}</span>
                      <button className="qty-btn" onClick={() => updateQty(item.key, item.quantity + 1)}>+</button>
                    </div>
                    <span className="item-price">{fmt(item.unitPrice * item.quantity)}</span>
                    <button className="rm-btn" onClick={() => removeItem(item.key)}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {cart.length > 0 && (
              <div className="cart-footer">
                <div className="total-row big"><span>Total</span><span>{fmt(cartTotal)}</span></div>
                <button className="btn-primary" disabled={!customer} onClick={() => setShowPayment(true)} style={{marginTop:12}}>
                  {!customer ? 'Selecciona un cliente primero' : 'Continuar con el pago →'}
                </button>
              </div>
            )}
          </div>
          </div>{/* /pos-body-inner */}
        </div>
      </div>

      {/* Mobile floating bar */}
      {cart.length > 0 && (
        <button className="cart-fab" onClick={() => { setSheetState('peek'); setShowCartSheet(true) }}>
          <span className="cart-fab-count">{cart.length} {cart.length === 1 ? 'art.' : 'arts.'}</span>
          <span className="cart-fab-total">{fmt(cartTotal)}</span>
          <span className="cart-fab-cta">Ver carrito →</span>
        </button>
      )}

      {/* Mobile cart sheet */}
      {showCartSheet && (
        <div className="sheet-overlay" onClick={e => { if (e.target === e.currentTarget) setShowCartSheet(false) }}>
          <div className={`cart-sheet ${sheetState}`} ref={sheetRef}>
            <div className="sheet-handle-area" onTouchStart={onHandleTouchStart} onTouchMove={onHandleTouchMove} onTouchEnd={onHandleTouchEnd}>
              <div className="sheet-drag" />
            </div>

            <div className="sheet-hd">
              <span className="sheet-title">Carrito · {cart.length} {cart.length === 1 ? 'art.' : 'arts.'}</span>
              <div style={{display:'flex',gap:6,alignItems:'center'}}>
                {cart.length > 0 && (
                  <button className="park-btn-sm" onClick={parkCurrentCart}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                    Guardar
                  </button>
                )}
                {cart.length > 0 && <button className="btn-sm" style={{color:'#DC2626',borderColor:'rgba(220,38,38,0.2)'}} onClick={() => setCart([])}>Vaciar</button>}
                <button className="sheet-close" onClick={() => setShowCartSheet(false)}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
            </div>

            <div className="sheet-cust-wrap" ref={sheetCustRef}>
              {customer ? (
                <div className="sheet-cust-box">
                  <div className="sheet-cust-selected">
                    <div className="sheet-cust-av">{customer.full_name.charAt(0).toUpperCase()}</div>
                    <span className="sheet-cust-name">{customer.full_name}</span>
                  </div>
                  <button className="btn-sm" onClick={() => { setCustomer(null); setCustSearch('') }}>Cambiar</button>
                </div>
              ) : (
                <div className="sheet-cust-box" style={{borderColor:'rgba(220,38,38,0.25)',background:'rgba(220,38,38,0.05)'}}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2" strokeLinecap="round" style={{flexShrink:0}}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                  <input className="sheet-cust-search" placeholder="Buscar cliente…" value={sheetCustSearch} onChange={e => { setSheetCustSearch(e.target.value); setShowSheetCustDrop(true) }} onFocus={() => setShowSheetCustDrop(true)} />
                  {showSheetCustDrop && filteredSheetCustomers.length > 0 && (
                    <div className="sheet-cust-drop">
                      {filteredSheetCustomers.map(c => (
                        <div key={c.id} className="cust-opt" onClick={() => { setCustomer(c); setSheetCustSearch(''); setShowSheetCustDrop(false) }}>
                          <span style={{fontWeight:700}}>{c.full_name}</span>
                          <span className="cust-opt-sub">{[c.phone, c.email].filter(Boolean).join(' · ')}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="cart-body" style={{flex:1,overflowY:'auto',padding:'4px 16px'}}>
              {cart.map(item => (
                <div key={item.key} className="cart-item">
                  <div className="cart-item-name">{item.productName}</div>
                  <div className="cart-item-sub">{item.variantName} · {item.sku}</div>
                  <div className="cart-item-row">
                    <div className="qty-ctrl">
                      <button className="qty-btn" onClick={() => updateQty(item.key, item.quantity - 1)}>−</button>
                      <span className="qty-num">{item.quantity}</span>
                      <button className="qty-btn" onClick={() => updateQty(item.key, item.quantity + 1)}>+</button>
                    </div>
                    <span className="item-price" style={{marginLeft:'auto'}}>{fmt(item.unitPrice * item.quantity)}</span>
                    <button className="rm-btn" onClick={() => removeItem(item.key)}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="cart-footer" style={{flexShrink:0}}>
              <div className="total-row big"><span>Total</span><span>{fmt(cartTotal)}</span></div>
              <button className="btn-primary" disabled={!customer} onClick={() => { setShowCartSheet(false); setShowPayment(true) }} style={{marginTop:12}}>
                {!customer ? 'Elige un cliente para continuar' : 'Ir al pago →'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment modal */}
      {showPayment && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowPayment(false) }}>
          <div className="modal-sheet">
            <div className="modal-title">Pago</div>
            <div className="summary-box">
              <div className="summary-row"><span>Cliente</span><span style={{fontWeight:600}}>{customer?.full_name}</span></div>
              <div className="summary-row"><span>Productos</span><span>{cart.length}</span></div>
              <div className="summary-row total"><span>Total</span><span>{fmt(cartTotal)}</span></div>
            </div>
            <div className="toggle-row">
              <button className={`toggle ${isApartado ? 'on' : ''}`} onClick={() => setIsApartado(v => !v)} />
              <span className="toggle-label">Apartado (pago parcial)</span>
            </div>
            {payments.map((pay, i) => (
              <div key={i} className="payment-entry">
                <select className="modal-input" style={{flex:1,marginBottom:0,padding:'10px 12px'}} value={pay.method} onChange={e => setPayments(prev => prev.map((p, j) => j === i ? {...p, method: e.target.value as any} : p))}>
                  {METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
                <input className="modal-input" style={{width:120,marginBottom:0,padding:'10px 12px',textAlign:'right'}} type="number" min="0" placeholder="Monto" value={pay.amount} onChange={e => setPayments(prev => prev.map((p, j) => j === i ? {...p, amount: e.target.value} : p))} />
                {payments.length > 1 && <button className="rm-pay" onClick={() => setPayments(prev => prev.filter((_, j) => j !== i))}>×</button>}
              </div>
            ))}
            <button className="add-pay-btn" onClick={() => setPayments(prev => [...prev, { method: 'efectivo', amount: '' }])}>+ Agregar otro método de pago</button>
            <div className="summary-box">
              <div className="summary-row"><span>Total</span><span>{fmt(cartTotal)}</span></div>
              <div className="summary-row"><span>Pagado</span><span style={{color:'#059669',fontWeight:700}}>{fmt(totalPaid)}</span></div>
              {remaining > 0 && <div className="summary-row remaining"><span>{isApartado ? 'Pendiente (apartado)' : 'Falta'}</span><span>{fmt(remaining)}</span></div>}
              {remaining <= 0 && totalPaid > 0 && <div className="summary-row" style={{color:'#059669',fontWeight:700}}><span>Cambio</span><span>{fmt(totalPaid - cartTotal)}</span></div>}
            </div>
            <button className="btn-primary" disabled={totalPaid <= 0 || (!isApartado && remaining > 0.01)} onClick={() => { setShowPayment(false); setShowShipping(true) }}>
              {!isApartado && remaining > 0.01 ? `Faltan ${fmt(remaining)}` : 'Confirmar pago →'}
            </button>
            <button className="btn-ghost" onClick={() => setShowPayment(false)}>Cancelar</button>
          </div>
        </div>
      )}

      {/* Shipping modal */}
      {showShipping && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowShipping(false) }}>
          <div className="modal-sheet">
            <div className="modal-title">Entrega</div>
            <div className="ship-type-row">
              <button className={`ship-btn ${shipType === 'pickup' ? 'active' : ''}`} onClick={() => setShipType('pickup')}>
                <div style={{fontSize:22,marginBottom:4}}>🏪</div>
                <div style={{fontSize:13,fontWeight:700,color:'var(--text,#0A0A0E)'}}>Pickup</div>
                <div style={{fontSize:11,color:'rgba(10,10,14,0.45)',marginTop:2}}>Recoger en tienda</div>
              </button>
              <button className={`ship-btn ${shipType === 'envio' ? 'active' : ''}`} onClick={() => setShipType('envio')}>
                <div style={{fontSize:22,marginBottom:4}}>📦</div>
                <div style={{fontSize:13,fontWeight:700,color:'var(--text,#0A0A0E)'}}>Envío</div>
                <div style={{fontSize:11,color:'rgba(10,10,14,0.45)',marginTop:2}}>Envío a domicilio</div>
              </button>
            </div>
            {shipType === 'envio' && (
              <>
                <div className="toggle-row">
                  <button className={`toggle ${skipAddr ? 'on' : ''}`} onClick={() => setSkipAddr(v => !v)} />
                  <span className="toggle-label" style={{fontSize:13}}>Agregar dirección después</span>
                </div>
                {!skipAddr && (
                  <>
                    <div className="modal-label">Dirección de envío</div>
                    <input className="modal-input" placeholder="Calle y número" value={shipAddr.line1} onChange={e => setShipAddr(p => ({...p, line1: e.target.value}))} />
                    <input className="modal-input" placeholder="Colonia / Interior (opcional)" value={shipAddr.line2} onChange={e => setShipAddr(p => ({...p, line2: e.target.value}))} />
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                      <input className="modal-input" placeholder="Ciudad" value={shipAddr.city} onChange={e => setShipAddr(p => ({...p, city: e.target.value}))} />
                      <input className="modal-input" placeholder="Estado" value={shipAddr.state} onChange={e => setShipAddr(p => ({...p, state: e.target.value}))} />
                    </div>
                    <input className="modal-input" placeholder="CP" value={shipAddr.zip} onChange={e => setShipAddr(p => ({...p, zip: e.target.value}))} />
                  </>
                )}
              </>
            )}
            <button className="btn-primary" disabled={saving} onClick={createOrder}>{saving ? 'Generando orden…' : 'Generar orden ✓'}</button>
            <button className="btn-ghost" onClick={() => { setShowShipping(false); setShowPayment(true) }}>← Volver al pago</button>
          </div>
        </div>
      )}
    </>
  )
}
