'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Sidebar from '@/components/Sidebar'

// ─── Types ────────────────────────────────────────────────────────────────────
type Variant = { id: string; name: string; sku: string; sale_price: number; stock: number }
type Product  = { id: string; name: string; variants: Variant[] }
type Customer = { id: string; full_name: string; email: string | null; phone: string | null }

type CartItem = {
  key: string
  productId: string; variantId: string
  productName: string; variantName: string; sku: string
  unitPrice: number; quantity: number; discount: number
}

type PaymentEntry = { method: 'efectivo' | 'tarjeta' | 'transferencia' | 'otro'; amount: string }

const METHODS = [
  { value: 'efectivo',      label: 'Efectivo' },
  { value: 'tarjeta',       label: 'Tarjeta' },
  { value: 'transferencia', label: 'Transferencia' },
  { value: 'otro',          label: 'Otro' },
] as const

const fmt = (n: number) => n.toLocaleString('es-MX', { style:'currency', currency:'MXN' })

// ─── Component ────────────────────────────────────────────────────────────────
export default function POSClient({
  orgId, userId, initialProducts, initialCustomers,
}: {
  orgId: string; userId: string
  initialProducts: Product[]; initialCustomers: Customer[]
}) {
  const router = useRouter()
  const supabase = createClient()

  // Products & search
  const [products] = useState<Product[]>(initialProducts)
  const [search, setSearch] = useState('')
  const [selectedVariants, setSelectedVariants] = useState<Record<string, string>>({})

  // Customer
  const [customers, setCustomers] = useState<Customer[]>(initialCustomers)
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [custSearch, setCustSearch] = useState('')
  const [showCustDrop, setShowCustDrop] = useState(false)
  const [showNewCust, setShowNewCust] = useState(false)
  const [newCust, setNewCust] = useState({ full_name:'', email:'', phone:'' })
  const [savingCust, setSavingCust] = useState(false)
  const custRef = useRef<HTMLDivElement>(null)

  // Cart
  const [cart, setCart] = useState<CartItem[]>([])
  const [cartDiscount, setCartDiscount] = useState('')
  const [mobileTab, setMobileTab] = useState<'productos'|'carrito'>('productos')

  // Payment modal
  const [showPayment, setShowPayment] = useState(false)
  const [payments, setPayments] = useState<PaymentEntry[]>([{ method:'efectivo', amount:'' }])
  const [isApartado, setIsApartado] = useState(false)

  // Shipping modal
  const [showShipping, setShowShipping] = useState(false)
  const [shipType, setShipType] = useState<'pickup'|'envio'>('pickup')
  const [shipAddr, setShipAddr] = useState({ line1:'', line2:'', city:'', state:'', zip:'' })
  const [skipAddr, setSkipAddr] = useState(false)

  // Result
  const [saving, setSaving] = useState(false)
  const [savedFolio, setSavedFolio] = useState('')

  // Close customer dropdown on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (custRef.current && !custRef.current.contains(e.target as Node)) {
        setShowCustDrop(false)
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  // ── Derived ────────────────────────────────────────────────────────────────
  const filteredProducts = useMemo(() => {
    const q = search.toLowerCase().trim()
    if (!q) return products
    return products.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.variants.some(v => v.sku?.toLowerCase().includes(q) || v.name.toLowerCase().includes(q))
    )
  }, [products, search])

  const filteredCustomers = useMemo(() => {
    const q = custSearch.toLowerCase().trim()
    if (!q) return customers.slice(0, 8)
    return customers.filter(c =>
      c.full_name.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q) ||
      c.phone?.includes(q)
    ).slice(0, 8)
  }, [customers, custSearch])

  const cartSubtotal = cart.reduce((s, i) => s + i.unitPrice * i.quantity - i.discount, 0)
  const cartDiscountNum = Math.max(0, parseFloat(cartDiscount) || 0)
  const cartTotal = Math.max(0, cartSubtotal - cartDiscountNum)
  const totalPaid = payments.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0)
  const remaining = Math.max(0, cartTotal - totalPaid)

  // ── Cart helpers ───────────────────────────────────────────────────────────
  function addToCart(product: Product, variant: Variant) {
    const key = `${product.id}_${variant.id}`
    setCart(prev => {
      const existing = prev.find(i => i.key === key)
      if (existing) return prev.map(i => i.key === key ? { ...i, quantity: i.quantity + 1 } : i)
      return [...prev, {
        key, productId: product.id, variantId: variant.id,
        productName: product.name, variantName: variant.name,
        sku: variant.sku, unitPrice: variant.sale_price,
        quantity: 1, discount: 0,
      }]
    })
    setMobileTab('carrito')
  }

  function updateQty(key: string, qty: number) {
    if (qty < 1) return removeItem(key)
    setCart(prev => prev.map(i => i.key === key ? { ...i, quantity: qty } : i))
  }

  function updateItemDiscount(key: string, val: string) {
    const n = Math.max(0, parseFloat(val) || 0)
    setCart(prev => prev.map(i => i.key === key ? { ...i, discount: n } : i))
  }

  function removeItem(key: string) {
    setCart(prev => prev.filter(i => i.key !== key))
  }

  // ── Customer helpers ────────────────────────────────────────────────────────
  async function createCustomer() {
    if (!newCust.full_name.trim()) return
    setSavingCust(true)
    const { data, error } = await supabase.from('customers').insert({
      organization_id: orgId,
      full_name: newCust.full_name.trim(),
      email: newCust.email.trim() || null,
      phone: newCust.phone.trim() || null,
      created_by: userId,
    }).select('id, full_name, email, phone').single()
    setSavingCust(false)
    if (error || !data) return
    const c = data as Customer
    setCustomers(prev => [...prev, c])
    setCustomer(c)
    setShowNewCust(false)
    setNewCust({ full_name:'', email:'', phone:'' })
  }

  // ── Order creation ─────────────────────────────────────────────────────────
  async function createOrder() {
    if (!customer || cart.length === 0) return
    setSaving(true)

    // 1. Insert order
    const { data: order, error: oErr } = await supabase
      .from('orders')
      .insert({
        organization_id: orgId,
        customer_id: customer.id,
        folio: '',
        status: isApartado ? 'apartado' : (remaining <= 0 ? 'pagado' : 'apartado'),
        subtotal: cartSubtotal,
        discount_amount: cartDiscountNum,
        total: cartTotal,
        created_by: userId,
      })
      .select('id, folio')
      .single()

    if (oErr || !order) { setSaving(false); return }

    // 2. Insert items
    await supabase.from('order_items').insert(
      cart.map(i => ({
        order_id: order.id, organization_id: orgId,
        product_id: i.productId, variant_id: i.variantId,
        product_name: i.productName, variant_name: i.variantName, sku: i.sku,
        quantity: i.quantity, unit_price: i.unitPrice,
        discount_amount: i.discount,
        subtotal: i.unitPrice * i.quantity - i.discount,
      }))
    )

    // 3. Insert payments
    const validPayments = payments.filter(p => parseFloat(p.amount) > 0)
    if (validPayments.length > 0) {
      await supabase.from('order_payments').insert(
        validPayments.map(p => ({
          order_id: order.id, organization_id: orgId,
          method: p.method, amount: parseFloat(p.amount),
        }))
      )
    }

    // 4. Insert shipping
    const needsAddr = shipType === 'envio' && !skipAddr
    await supabase.from('order_shipping').insert({
      order_id: order.id, organization_id: orgId,
      type: shipType,
      address_line1: needsAddr ? shipAddr.line1 || null : null,
      address_line2: needsAddr ? shipAddr.line2 || null : null,
      city: needsAddr ? shipAddr.city || null : null,
      state: needsAddr ? shipAddr.state || null : null,
      zip: needsAddr ? shipAddr.zip || null : null,
    })

    // 5. Deduct inventory via ledger
    for (const item of cart) {
      await supabase.from('inventory_ledger').insert({
        organization_id: orgId,
        variant_id: item.variantId,
        movement_type: 'sale',
        quantity: -item.quantity,
        source_type: 'order',
        source_id: order.id,
        notes: `Venta ${order.folio}`,
      })
    }

    setSaving(false)
    setSavedFolio(order.folio)
    setShowShipping(false)
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  function resetPOS() {
    setCart([]); setCustomer(null); setCustSearch(''); setCartDiscount('')
    setPayments([{ method:'efectivo', amount:'' }]); setIsApartado(false)
    setShipType('pickup'); setShipAddr({ line1:'', line2:'', city:'', state:'', zip:'' })
    setSkipAddr(false); setSavedFolio(''); setMobileTab('productos')
  }

  if (savedFolio) return (
    <>
      <Sidebar active="pos" />
      <SuccessScreen folio={savedFolio} onNew={resetPOS} onView={() => router.push('/orders')} />
    </>
  )

  return (
    <>
      <Sidebar active="pos" />
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        .pos-wrap{display:flex;flex-direction:column;height:calc(100dvh - var(--nav-h,88px));overflow:hidden;background:var(--bg,#ECEEF2);font-family:'Inter',-apple-system,sans-serif}
        @media(min-width:768px){.pos-wrap{height:100dvh}}
        .pos-header{display:flex;align-items:center;gap:12px;padding:12px 16px;background:var(--bg,#ECEEF2);border-bottom:1px solid rgba(0,0,0,0.07);flex-shrink:0}
        .pos-title{font-size:16px;font-weight:800;color:var(--text,#0A0A0E);letter-spacing:-0.3px}
        .pos-body{display:flex;flex:1;overflow:hidden}
        /* LEFT */
        .pos-left{flex:1;display:flex;flex-direction:column;overflow:hidden;padding:12px 10px 12px 12px}
        /* RIGHT */
        .pos-right{width:300px;display:flex;flex-direction:column;border-left:1px solid rgba(0,0,0,0.07);background:var(--bg,#ECEEF2);flex-shrink:0}
        @media(min-width:768px){.pos-right{padding-top:64px}}
        @media(min-width:1024px){.pos-right{width:320px}}
        /* LEFT also needs top offset on desktop for the nav pill area */
        @media(min-width:768px){.pos-left{padding-top:64px}}
        /* CUSTOMER */
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
        .btn-sm{padding:5px 12px;border-radius:50px;border:1.5px solid rgba(0,0,0,0.10);background:none;font-size:11px;font-weight:700;color:rgba(10,10,14,0.5);cursor:pointer;font-family:inherit;white-space:nowrap}
        .btn-sm:hover{background:rgba(0,0,0,0.05)}
        /* SEARCH */
        .search-wrap{position:relative;margin-bottom:12px;flex-shrink:0}
        .search-icon{position:absolute;left:12px;top:50%;transform:translateY(-50%);color:rgba(10,10,14,0.35);pointer-events:none}
        .search-input{width:100%;padding:10px 12px 10px 38px;border:1.5px solid rgba(0,0,0,0.08);border-radius:14px;background:rgba(0,0,0,0.03);font-size:14px;font-weight:500;color:var(--text,#0A0A0E);font-family:inherit;outline:none;transition:border-color .15s}
        .search-input:focus{border-color:#2563EB}
        /* PRODUCT GRID */
        .prod-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:8px;overflow-y:auto;flex:1;padding-right:4px;align-content:start}
        .prod-card{background:var(--bg,#ECEEF2);border-radius:14px;padding:10px 12px;border:1.5px solid rgba(0,0,0,0.07);box-shadow:3px 3px 8px rgba(0,0,0,0.06),-2px -2px 6px rgba(255,255,255,0.9);transition:transform .12s}
        .prod-card:active{transform:scale(.97)}
        .prod-card-name{font-size:12px;font-weight:700;color:var(--text,#0A0A0E);margin-bottom:2px;line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .prod-card-var{font-size:11px;color:rgba(10,10,14,0.45);margin-bottom:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .prod-card-footer{display:flex;align-items:center;justify-content:space-between}
        .prod-card-price{font-size:13px;font-weight:800;color:#1D4ED8}
        .prod-card-stock{font-size:10px;color:rgba(10,10,14,0.40)}
        .prod-var-sel{width:100%;padding:3px 6px;border-radius:7px;border:1.5px solid rgba(0,0,0,0.10);background:rgba(0,0,0,0.03);font-size:11px;font-family:inherit;margin-bottom:6px;outline:none;color:var(--text,#0A0A0E)}
        /* CART */
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
        .disc-input{width:80px;padding:3px 8px;border:1.5px solid rgba(0,0,0,0.10);border-radius:8px;font-size:12px;font-family:inherit;background:rgba(0,0,0,0.03);color:var(--text,#0A0A0E);outline:none}
        /* CART FOOTER */
        .cart-footer{border-top:1px solid rgba(0,0,0,0.07);padding:12px 16px;flex-shrink:0}
        .total-row{display:flex;justify-content:space-between;font-size:13px;color:rgba(10,10,14,0.55);margin-bottom:4px}
        .total-row.big{font-size:18px;font-weight:800;color:var(--text,#0A0A0E);margin-top:6px}
        .cart-disc-row{display:flex;align-items:center;gap:8px;margin-bottom:8px}
        .cart-disc-label{font-size:12px;color:rgba(10,10,14,0.50);flex:1}
        .cart-disc-input{width:90px;padding:5px 10px;border:1.5px solid rgba(0,0,0,0.10);border-radius:10px;font-size:13px;font-family:inherit;background:rgba(0,0,0,0.03);color:var(--text,#0A0A0E);outline:none;text-align:right}
        .btn-primary{width:100%;padding:15px;border:none;border-radius:20px;background:linear-gradient(145deg,#1D4ED8,#2563EB);color:white;font-size:15px;font-weight:700;cursor:pointer;font-family:inherit;box-shadow:0 6px 20px rgba(29,78,216,0.28);transition:opacity .15s,transform .12s;margin-top:10px}
        .btn-primary:hover{opacity:.92}
        .btn-primary:active{transform:scale(.98)}
        .btn-primary:disabled{opacity:.5;cursor:not-allowed}
        /* MODAL */
        .modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.45);z-index:1000;display:flex;align-items:flex-end;justify-content:center}
        @media(min-width:640px){.modal-overlay{align-items:center}}
        .modal-sheet{background:var(--bg,#ECEEF2);border-radius:28px 28px 0 0;padding:24px 20px 32px;width:100%;max-width:480px;max-height:90dvh;overflow-y:auto}
        @media(min-width:640px){.modal-sheet{border-radius:28px}}
        .modal-title{font-size:18px;font-weight:800;color:var(--text,#0A0A0E);margin-bottom:18px;letter-spacing:-.3px}
        .modal-label{font-size:11px;font-weight:700;color:rgba(10,10,14,0.38);text-transform:uppercase;letter-spacing:.07em;margin-bottom:6px}
        .modal-input{width:100%;padding:12px 14px;border:1.5px solid rgba(0,0,0,0.08);border-radius:14px;background:rgba(0,0,0,0.03);font-size:15px;font-family:inherit;color:var(--text,#0A0A0E);outline:none;transition:border-color .15s;margin-bottom:14px}
        .modal-input:focus{border-color:#2563EB}
        .method-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px}
        .method-btn{padding:10px;border-radius:14px;border:1.5px solid rgba(0,0,0,0.10);background:none;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;color:rgba(10,10,14,0.6);transition:all .15s}
        .method-btn.active{border-color:#2563EB;background:rgba(37,99,235,0.08);color:#1D4ED8;font-weight:700}
        .toggle-row{display:flex;align-items:center;gap:10px;margin-bottom:14px}
        .toggle{width:40px;height:22px;border-radius:11px;background:rgba(0,0,0,0.15);border:none;cursor:pointer;position:relative;transition:background .2s;flex-shrink:0}
        .toggle.on{background:#1D4ED8}
        .toggle::after{content:'';position:absolute;top:3px;left:3px;width:16px;height:16px;border-radius:50%;background:white;transition:transform .2s;box-shadow:0 1px 4px rgba(0,0,0,0.2)}
        .toggle.on::after{transform:translateX(18px)}
        .toggle-label{font-size:13px;font-weight:600;color:var(--text,#0A0A0E)}
        .payment-entry{display:flex;gap:8px;align-items:center;margin-bottom:8px}
        .add-pay-btn{background:none;border:1.5px dashed rgba(0,0,0,0.15);border-radius:12px;padding:8px 14px;font-size:12px;font-weight:700;color:rgba(10,10,14,0.45);cursor:pointer;width:100%;font-family:inherit;margin-bottom:12px}
        .add-pay-btn:hover{background:rgba(0,0,0,0.04)}
        .summary-box{background:rgba(0,0,0,0.035);border-radius:14px;padding:12px 14px;margin-bottom:14px}
        .summary-row{display:flex;justify-content:space-between;font-size:13px;margin-bottom:3px;color:rgba(10,10,14,0.6)}
        .summary-row.total{font-size:16px;font-weight:800;color:var(--text,#0A0A0E);margin-top:6px;padding-top:6px;border-top:1px solid rgba(0,0,0,0.07)}
        .summary-row.remaining{color:#DC2626;font-weight:700}
        .ship-type-row{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px}
        .ship-btn{padding:16px;border-radius:16px;border:1.5px solid rgba(0,0,0,0.10);background:none;cursor:pointer;font-family:inherit;text-align:center;transition:all .15s}
        .ship-btn.active{border-color:#2563EB;background:rgba(37,99,235,0.06)}
        .ship-btn-icon{font-size:22px;margin-bottom:4px}
        .ship-btn-label{font-size:13px;font-weight:700;color:var(--text,#0A0A0E)}
        .btn-ghost{width:100%;padding:13px;border:1.5px solid rgba(0,0,0,0.12);border-radius:18px;background:none;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;color:rgba(10,10,14,0.55);margin-top:8px}
        .btn-ghost:hover{background:rgba(0,0,0,0.04)}
        .rm-pay{background:none;border:none;cursor:pointer;color:rgba(10,10,14,0.30);padding:4px;font-size:16px}
        /* Mobile tab */
        .mob-tabs{display:none}
        @media(max-width:767px){
          .pos-right{display:none}
          .mob-tabs{display:flex;border-bottom:1px solid rgba(0,0,0,0.07);flex-shrink:0}
          .mob-tab{flex:1;padding:10px;text-align:center;font-size:13px;font-weight:700;color:rgba(10,10,14,0.45);border:none;background:none;cursor:pointer;font-family:inherit;border-bottom:2px solid transparent;transition:all .15s}
          .mob-tab.active{color:#1D4ED8;border-bottom-color:#1D4ED8}
          .mob-cart-show{display:flex;flex-direction:column;height:100%}
        }
        @media(max-width:767px){.pos-left.hidden{display:none}}
        /* New customer form */
        .new-cust-form{margin-top:8px;padding:12px;background:rgba(0,0,0,0.025);border-radius:14px;border:1.5px solid rgba(0,0,0,0.07)}
        .new-cust-title{font-size:12px;font-weight:700;color:var(--text,#0A0A0E);margin-bottom:8px}
        .new-cust-input{width:100%;padding:9px 12px;border:1.5px solid rgba(0,0,0,0.08);border-radius:12px;background:rgba(0,0,0,0.03);font-size:13px;font-family:inherit;color:var(--text,#0A0A0E);outline:none;margin-bottom:6px}
        .new-cust-input:focus{border-color:#2563EB}
        .new-cust-btns{display:flex;gap:6px;margin-top:2px}
        .btn-create{flex:1;padding:8px;border-radius:12px;border:none;background:linear-gradient(145deg,#1D4ED8,#2563EB);color:white;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit}
        .btn-cancel-sm{padding:8px 14px;border-radius:12px;border:1.5px solid rgba(0,0,0,0.10);background:none;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;color:rgba(10,10,14,0.5)}
        /* Success */
        .success-wrap{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100dvh;background:var(--bg,#ECEEF2);padding:24px;text-align:center}
        .success-icon{width:72px;height:72px;border-radius:50%;background:linear-gradient(135deg,#059669,#10B981);display:flex;align-items:center;justify-content:center;margin:0 auto 20px;box-shadow:0 8px 24px rgba(5,150,105,0.30)}
        .success-folio{font-size:28px;font-weight:900;color:var(--text,#0A0A0E);letter-spacing:-.5px;margin-bottom:6px}
        .success-sub{font-size:14px;color:rgba(10,10,14,0.50);margin-bottom:28px}
        .success-btns{display:flex;flex-direction:column;gap:10px;width:100%;max-width:320px}
      `}</style>

      <div className="pos-wrap">
        {/* Mobile tabs */}
        <div className="mob-tabs">
          <button className={`mob-tab ${mobileTab==='productos'?'active':''}`} onClick={() => setMobileTab('productos')}>Productos</button>
          <button className={`mob-tab ${mobileTab==='carrito'?'active':''}`} onClick={() => setMobileTab('carrito')}>
            Carrito {cart.length > 0 && `(${cart.length})`}
          </button>
        </div>

        <div className="pos-body">
          {/* LEFT: Customer + Products */}
          <div className={`pos-left ${mobileTab==='carrito'?'hidden':''}`}>
            {/* Customer selector */}
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
                      <input
                        className="cust-input"
                        placeholder="Buscar cliente por nombre, email o teléfono…"
                        value={custSearch}
                        onChange={e => { setCustSearch(e.target.value); setShowCustDrop(true) }}
                        onFocus={() => setShowCustDrop(true)}
                      />
                      <button className="btn-sm" onClick={() => setShowNewCust(v => !v)}>+ Nuevo</button>
                    </div>
                    {showCustDrop && filteredCustomers.length > 0 && (
                      <div className="cust-drop">
                        {filteredCustomers.map(c => (
                          <div key={c.id} className="cust-opt" onClick={() => {
                            setCustomer(c); setCustSearch(''); setShowCustDrop(false); setShowNewCust(false)
                          }}>
                            <span style={{fontWeight:700}}>{c.full_name}</span>
                            <span className="cust-opt-sub">{[c.phone, c.email].filter(Boolean).join(' · ')}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {showNewCust && (
                      <div className="new-cust-form">
                        <div className="new-cust-title">Nuevo cliente</div>
                        <input className="new-cust-input" placeholder="Nombre completo *" value={newCust.full_name} onChange={e => setNewCust(p => ({...p, full_name:e.target.value}))} />
                        <input className="new-cust-input" placeholder="Teléfono" value={newCust.phone} onChange={e => setNewCust(p => ({...p, phone:e.target.value}))} />
                        <input className="new-cust-input" placeholder="Email" value={newCust.email} onChange={e => setNewCust(p => ({...p, email:e.target.value}))} />
                        <div className="new-cust-btns">
                          <button className="btn-cancel-sm" onClick={() => setShowNewCust(false)}>Cancelar</button>
                          <button className="btn-create" disabled={savingCust || !newCust.full_name.trim()} onClick={createCustomer}>
                            {savingCust ? 'Guardando…' : 'Crear cliente'}
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Product search */}
            <div className="search-wrap">
              <span className="search-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
              </span>
              <input className="search-input" placeholder="Buscar producto o SKU…" value={search} onChange={e => setSearch(e.target.value)} />
            </div>

            {/* Product grid */}
            <div className="prod-grid">
              {filteredProducts.map(p => {
                const selVarId = selectedVariants[p.id] ?? p.variants[0]?.id
                const selVar = p.variants.find(v => v.id === selVarId) ?? p.variants[0]
                if (!selVar) return null
                return (
                  <div key={p.id} className="prod-card">
                    <div className="prod-card-name">{p.name}</div>
                    {p.variants.length > 1 ? (
                      <select
                        className="prod-var-sel"
                        value={selVarId}
                        onChange={e => setSelectedVariants(prev => ({...prev, [p.id]: e.target.value}))}
                        onClick={e => e.stopPropagation()}
                      >
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
                      <button
                        style={{width:30,height:30,borderRadius:'50%',border:'none',background:'linear-gradient(145deg,#1D4ED8,#2563EB)',color:'white',cursor:'pointer',fontSize:20,display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'0 3px 10px rgba(29,78,216,0.28)',flexShrink:0}}
                        onClick={() => addToCart(p, selVar)}
                      >+</button>
                    </div>
                  </div>
                )
              })}
              {filteredProducts.length === 0 && (
                <div style={{gridColumn:'1/-1',textAlign:'center',padding:'40px 0',color:'rgba(10,10,14,0.35)',fontSize:13,fontWeight:600}}>
                  No se encontraron productos
                </div>
              )}
            </div>
          </div>

          {/* RIGHT: Cart (desktop always visible, mobile on tab) */}
          <div className={`pos-right ${mobileTab==='carrito'?'mob-cart-show':''}`} style={mobileTab==='carrito'?{display:'flex',flex:1,flexDirection:'column'}:{}}>
            <div className="cart-header">
              <span>Carrito</span>
              {cart.length > 0 && <button className="btn-sm" style={{color:'#DC2626',borderColor:'rgba(220,38,38,0.2)'}} onClick={() => setCart([])}>Vaciar</button>}
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
                    <input
                      className="disc-input"
                      type="number" min="0" placeholder="Desc."
                      value={item.discount || ''}
                      onChange={e => updateItemDiscount(item.key, e.target.value)}
                      title="Descuento"
                    />
                    <span className="item-price">{fmt(item.unitPrice * item.quantity - item.discount)}</span>
                    <button className="rm-btn" onClick={() => removeItem(item.key)} title="Eliminar">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {cart.length > 0 && (
              <div className="cart-footer">
                <div className="total-row"><span>Subtotal</span><span>{fmt(cartSubtotal)}</span></div>
                <div className="cart-disc-row">
                  <span className="cart-disc-label">Descuento general</span>
                  <input className="cart-disc-input" type="number" min="0" placeholder="$0.00" value={cartDiscount} onChange={e => setCartDiscount(e.target.value)} />
                </div>
                {cartDiscountNum > 0 && <div className="total-row" style={{color:'#059669'}}><span>Ahorro</span><span>−{fmt(cartDiscountNum)}</span></div>}
                <div className="total-row big"><span>Total</span><span>{fmt(cartTotal)}</span></div>
                <button
                  className="btn-primary"
                  disabled={!customer || cart.length === 0}
                  onClick={() => setShowPayment(true)}
                >
                  {!customer ? 'Selecciona un cliente' : 'Continuar con el pago →'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* PAYMENT MODAL */}
      {showPayment && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowPayment(false) }}>
          <div className="modal-sheet">
            <div className="modal-title">Pago</div>

            <div className="summary-box">
              <div className="summary-row"><span>Cliente</span><span style={{fontWeight:600}}>{customer?.full_name}</span></div>
              <div className="summary-row"><span>Productos</span><span>{cart.length}</span></div>
              {cartDiscountNum > 0 && <div className="summary-row" style={{color:'#059669'}}><span>Descuento</span><span>−{fmt(cartDiscountNum)}</span></div>}
              <div className="summary-row total"><span>Total</span><span>{fmt(cartTotal)}</span></div>
            </div>

            <div className="toggle-row">
              <button className={`toggle ${isApartado?'on':''}`} onClick={() => setIsApartado(v => !v)} />
              <span className="toggle-label">Apartado (pago parcial)</span>
            </div>

            {payments.map((pay, i) => (
              <div key={i} className="payment-entry">
                <select
                  className="modal-input"
                  style={{flex:1,marginBottom:0,padding:'10px 12px'}}
                  value={pay.method}
                  onChange={e => setPayments(prev => prev.map((p,j) => j===i ? {...p, method: e.target.value as any} : p))}
                >
                  {METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
                <input
                  className="modal-input"
                  style={{width:120,marginBottom:0,padding:'10px 12px',textAlign:'right'}}
                  type="number" min="0" placeholder="Monto"
                  value={pay.amount}
                  onChange={e => setPayments(prev => prev.map((p,j) => j===i ? {...p, amount:e.target.value} : p))}
                />
                {payments.length > 1 && (
                  <button className="rm-pay" onClick={() => setPayments(prev => prev.filter((_,j) => j!==i))}>×</button>
                )}
              </div>
            ))}

            <button className="add-pay-btn" onClick={() => setPayments(prev => [...prev, { method:'efectivo', amount:'' }])}>
              + Agregar otro método de pago
            </button>

            <div className="summary-box">
              <div className="summary-row"><span>Total</span><span>{fmt(cartTotal)}</span></div>
              <div className="summary-row"><span>Pagado</span><span style={{color:'#059669',fontWeight:700}}>{fmt(totalPaid)}</span></div>
              {remaining > 0 && <div className="summary-row remaining"><span>{isApartado ? 'Pendiente (apartado)' : 'Falta'}</span><span>{fmt(remaining)}</span></div>}
              {remaining <= 0 && totalPaid > 0 && <div className="summary-row" style={{color:'#059669',fontWeight:700}}><span>Cambio</span><span>{fmt(totalPaid - cartTotal)}</span></div>}
            </div>

            <button
              className="btn-primary"
              disabled={totalPaid <= 0 || (!isApartado && remaining > 0.01)}
              onClick={() => { setShowPayment(false); setShowShipping(true) }}
            >
              {!isApartado && remaining > 0.01 ? `Faltan ${fmt(remaining)}` : 'Confirmar pago →'}
            </button>
            <button className="btn-ghost" onClick={() => setShowPayment(false)}>Cancelar</button>
          </div>
        </div>
      )}

      {/* SHIPPING MODAL */}
      {showShipping && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowShipping(false) }}>
          <div className="modal-sheet">
            <div className="modal-title">Entrega</div>

            <div className="ship-type-row">
              <button className={`ship-btn ${shipType==='pickup'?'active':''}`} onClick={() => setShipType('pickup')}>
                <div className="ship-btn-icon">🏪</div>
                <div className="ship-btn-label">Pickup</div>
                <div style={{fontSize:11,color:'rgba(10,10,14,0.45)',marginTop:2}}>Recoger en tienda</div>
              </button>
              <button className={`ship-btn ${shipType==='envio'?'active':''}`} onClick={() => setShipType('envio')}>
                <div className="ship-btn-icon">📦</div>
                <div className="ship-btn-label">Envío</div>
                <div style={{fontSize:11,color:'rgba(10,10,14,0.45)',marginTop:2}}>Envío a domicilio</div>
              </button>
            </div>

            {shipType === 'envio' && (
              <>
                <div className="toggle-row">
                  <button className={`toggle ${skipAddr?'on':''}`} onClick={() => setSkipAddr(v => !v)} />
                  <span className="toggle-label" style={{fontSize:13}}>Agregar dirección después</span>
                </div>
                {!skipAddr && (
                  <>
                    <div className="modal-label">Dirección de envío</div>
                    <input className="modal-input" placeholder="Calle y número" value={shipAddr.line1} onChange={e => setShipAddr(p => ({...p,line1:e.target.value}))} />
                    <input className="modal-input" placeholder="Colonia / Interior (opcional)" value={shipAddr.line2} onChange={e => setShipAddr(p => ({...p,line2:e.target.value}))} />
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                      <input className="modal-input" placeholder="Ciudad" value={shipAddr.city} onChange={e => setShipAddr(p => ({...p,city:e.target.value}))} />
                      <input className="modal-input" placeholder="Estado" value={shipAddr.state} onChange={e => setShipAddr(p => ({...p,state:e.target.value}))} />
                    </div>
                    <input className="modal-input" placeholder="CP" value={shipAddr.zip} onChange={e => setShipAddr(p => ({...p,zip:e.target.value}))} />
                  </>
                )}
              </>
            )}

            <button className="btn-primary" disabled={saving} onClick={createOrder}>
              {saving ? 'Generando orden…' : 'Generar orden ✓'}
            </button>
            <button className="btn-ghost" onClick={() => { setShowShipping(false); setShowPayment(true) }}>← Volver al pago</button>
          </div>
        </div>
      )}
    </>
  )
}

// ─── Success Screen ────────────────────────────────────────────────────────────
function SuccessScreen({ folio, onNew, onView }: { folio: string; onNew: () => void; onView: () => void }) {
  return (
    <div className="success-wrap" style={{fontFamily:"'Inter',-apple-system,sans-serif"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        .success-wrap *{box-sizing:border-box;margin:0;padding:0}
        .success-wrap{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100dvh;background:var(--bg,#ECEEF2);padding:24px;text-align:center;font-family:'Inter',-apple-system,sans-serif}
        .success-icon{width:72px;height:72px;border-radius:50%;background:linear-gradient(135deg,#059669,#10B981);display:flex;align-items:center;justify-content:center;margin:0 auto 20px;box-shadow:0 8px 24px rgba(5,150,105,0.30)}
        .success-folio{font-size:28px;font-weight:900;color:var(--text,#0A0A0E);letter-spacing:-.5px;margin-bottom:6px}
        .success-sub{font-size:14px;color:rgba(10,10,14,0.50);margin-bottom:28px}
        .success-btns{display:flex;flex-direction:column;gap:10px;width:100%;max-width:320px}
        .btn-primary{width:100%;padding:15px;border:none;border-radius:20px;background:linear-gradient(145deg,#1D4ED8,#2563EB);color:white;font-size:15px;font-weight:700;cursor:pointer;font-family:inherit;box-shadow:0 6px 20px rgba(29,78,216,0.28)}
        .btn-ghost{width:100%;padding:13px;border:1.5px solid rgba(0,0,0,0.12);border-radius:18px;background:none;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;color:rgba(10,10,14,0.55)}
      `}</style>
      <div className="success-icon">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
      </div>
      <div className="success-folio">{folio}</div>
      <div style={{fontSize:20,fontWeight:800,color:'#0A0A0E',marginBottom:6}}>¡Orden generada!</div>
      <div className="success-sub">La venta se registró y el inventario se actualizó.</div>
      <div className="success-btns">
        <button className="btn-primary" onClick={onNew}>Nueva venta</button>
        <button className="btn-ghost" onClick={onView}>Ver todas las órdenes</button>
      </div>
    </div>
  )
}
