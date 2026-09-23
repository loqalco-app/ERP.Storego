import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { notifyNewOrder } from '@/lib/push'
import { sendOrderConfirmationEmail, sendDepositConfirmationEmail, sendAbonoReceivedEmail, type OrderConfirmationItem, type BankDetails } from '@/lib/email'

function adminClient() {
  return createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

// POST /api/orders/notify-sale
// Called by the ERP itself (POS on sale creation, Órdenes on abono/liquidar)
// so push + the right customer email fire for in-person sales too — not
// just the public storefront checkout.
export async function POST(req: NextRequest) {
  const { order_id, event, amount } = await req.json().catch(() => ({ order_id: null, event: null, amount: null }))
  if (!order_id || !event) return NextResponse.json({ error: 'order_id and event required' }, { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('user_profiles').select('organization_id').eq('id', user.id).single()
  const orgId = profile?.organization_id
  if (!orgId) return NextResponse.json({ error: 'no_org' }, { status: 403 })

  const { data: order } = await supabase
    .from('orders')
    .select(`
      folio, total, status, source, customer_id,
      customers(full_name, email),
      order_items(product_id, product_name, variant_name, quantity, unit_price, subtotal),
      order_payments(method, amount, reference),
      order_shipping(type, address_line1, address_line2, city, state, zip)
    `)
    .eq('id', order_id)
    .eq('organization_id', orgId)
    .single()

  if (!order) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const customerRel = Array.isArray(order.customers) ? order.customers[0] : order.customers
  const customerName = customerRel?.full_name ?? 'Cliente'
  const customerEmail = customerRel?.email ?? null
  const total = Number(order.total)
  const paid = (order.order_payments ?? []).reduce((s: number, p: { amount: number }) => s + Number(p.amount), 0)
  const balance = Math.max(0, total - paid)

  const shipRel = Array.isArray(order.order_shipping) ? order.order_shipping[0] : order.order_shipping
  const shipping = shipRel && shipRel.type === 'envio' && shipRel.address_line1 ? {
    address_line1: shipRel.address_line1, address_line2: shipRel.address_line2,
    city: shipRel.city ?? '', state: shipRel.state ?? '', zip: shipRel.zip ?? '',
  } : null

  // Pull each item's primary photo in one extra query.
  const productIds = [...new Set((order.order_items ?? []).map((i: { product_id: string }) => i.product_id))]
  const admin = adminClient()
  const { data: images } = productIds.length
    ? await admin.from('product_images').select('product_id, url, is_primary, sort_order').in('product_id', productIds)
    : { data: [] as { product_id: string; url: string; is_primary: boolean; sort_order: number }[] }
  const imageByProduct = new Map<string, string>()
  for (const pid of productIds) {
    const matches = (images ?? []).filter(im => im.product_id === pid)
    const best = [...matches].sort((a, b) => (b.is_primary ? 1 : -1) - (a.is_primary ? 1 : -1) || a.sort_order - b.sort_order)[0]
    if (best) imageByProduct.set(pid, best.url)
  }

  const items: OrderConfirmationItem[] = (order.order_items ?? []).map((i: { product_id: string; product_name: string; variant_name: string; quantity: number; unit_price: number; subtotal: number }) => ({
    name: i.product_name,
    variantLabel: i.variant_name === 'Estándar' ? '' : i.variant_name,
    quantity: i.quantity,
    unitPrice: Number(i.unit_price),
    subtotal: Number(i.subtotal),
    imageUrl: imageByProduct.get(i.product_id) ?? null,
  }))

  if (event === 'created') {
    await notifyNewOrder(orgId, {
      folio: order.folio, total, customerName,
      source: order.source ?? 'pos',
      itemCount: (order.order_items ?? []).length,
    })

    if (customerEmail) {
      if (order.status === 'pagado') {
        await sendOrderConfirmationEmail({ to: customerEmail, customerName, folio: order.folio, items, total, shipping })
      } else if (order.status === 'apartado') {
        const firstPayment = (order.order_payments ?? [])[0] as { method?: string; reference?: string | null } | undefined
        const method = firstPayment?.method ?? 'efectivo'
        let bankDetails: BankDetails | null = null
        if (method === 'transferencia') {
          const { data: org } = await admin.from('organizations').select('settings').eq('id', orgId).single()
          bankDetails = (org?.settings as { bank_transfer?: BankDetails } | null)?.bank_transfer ?? null
        }
        await sendDepositConfirmationEmail({
          to: customerEmail, customerName, folio: order.folio, items, total,
          depositAmount: paid, balance, method,
          bankDetails, paymentLink: method === 'link_pago' ? (firstPayment?.reference ?? null) : null,
          shipping,
        })
      }
    }
    return NextResponse.json({ ok: true })
  }

  if (event === 'abono') {
    if (customerEmail) {
      if (order.status === 'pagado' || balance <= 0) {
        await sendOrderConfirmationEmail({ to: customerEmail, customerName, folio: order.folio, items, total, shipping })
      } else {
        await sendAbonoReceivedEmail({ to: customerEmail, customerName, folio: order.folio, amountReceived: Number(amount) || 0, balance })
      }
    }
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'unknown_event' }, { status: 400 })
}
