import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { revalidateTag } from 'next/cache'
import { sendOrderConfirmationEmail } from '@/lib/email'
import { notifyNewOrder } from '@/lib/push'

function getClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

const corsHeaders = {
  'Access-Control-Allow-Origin': process.env.STORE_ORIGIN ?? '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: corsHeaders })
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders })
}

interface CheckoutBody {
  org_id?: string
  session_id?: string
  customer?: { full_name?: string; email?: string; phone?: string }
  shipping?: { address_line1?: string; address_line2?: string; city?: string; state?: string; zip?: string }
  items?: { variant_id: string; quantity: number }[]
}

// POST /api/store/checkout
// Simulated-payment checkout: confirms cart reservations into a real order,
// registers/updates the CRM customer, decrements stock, emails the customer,
// and pushes a "new sale" notification to the admin PWA.
export async function POST(req: NextRequest) {
  let body: CheckoutBody
  try { body = await req.json() } catch { return json({ error: 'invalid_json' }, 400) }

  const orgId = body.org_id ?? process.env.STORE_ORG_ID
  const sessionId = body.session_id
  const customerIn = body.customer
  const shipping = body.shipping
  const items = body.items

  if (!orgId || !sessionId) return json({ error: 'missing_fields' }, 400)
  if (!customerIn?.full_name?.trim() || !customerIn?.email?.trim()) return json({ error: 'missing_customer' }, 400)
  if (!shipping?.address_line1?.trim() || !shipping?.city?.trim() || !shipping?.state?.trim() || !shipping?.zip?.trim()) {
    return json({ error: 'missing_shipping' }, 400)
  }
  if (!items || items.length === 0) return json({ error: 'empty_cart' }, 400)

  const client = getClient()
  const variantIds = items.map(i => i.variant_id)

  // 1. Look up real prices/names server-side — never trust client-sent prices.
  const { data: variants, error: vErr } = await client
    .from('product_variants')
    .select('id, name, sku, sale_price, cost_price, product_id, products(name)')
    .in('id', variantIds)
    .eq('organization_id', orgId)

  if (vErr || !variants || variants.length !== variantIds.length) {
    return json({ error: 'invalid_items' }, 400)
  }

  // 2. Verify every item still has an active cart reservation for this session.
  const { data: reservations } = await client
    .from('inventory_reservations')
    .select('id, variant_id, quantity')
    .eq('session_id', sessionId)
    .eq('status', 'pending')
    .in('variant_id', variantIds)

  const reservationByVariant = new Map((reservations ?? []).map(r => [r.variant_id, r]))
  for (const item of items) {
    const res = reservationByVariant.get(item.variant_id)
    if (!res || res.quantity < item.quantity) {
      return json({ error: 'reservation_missing', variant_id: item.variant_id }, 409)
    }
  }

  type VariantRow = { id: string; name: string; sku: string; sale_price: number; cost_price: number; product_id: string; products: { name: string } | { name: string }[] | null }
  const variantById = new Map((variants as VariantRow[]).map(v => [v.id, v]))

  const orderItemsPayload = items.map(item => {
    const v = variantById.get(item.variant_id)!
    const productName = Array.isArray(v.products) ? v.products[0]?.name : v.products?.name
    const unitPrice = Number(v.sale_price)
    return {
      variant_id: v.id,
      product_id: v.product_id,
      product_name: productName ?? '',
      variant_name: v.name,
      sku: v.sku,
      quantity: item.quantity,
      unit_price: unitPrice,
      cost_price: Number(v.cost_price),
      discount_amount: 0,
      subtotal: unitPrice * item.quantity,
    }
  })

  const total = orderItemsPayload.reduce((n, i) => n + i.subtotal, 0)

  // 3. Find or create the CRM customer.
  const email = customerIn.email!.trim().toLowerCase()
  const { data: existingCustomer } = await client
    .from('customers')
    .select('id, phone')
    .eq('organization_id', orgId)
    .eq('email', email)
    .maybeSingle()

  let customerId = existingCustomer?.id as string | undefined
  if (customerId && !existingCustomer?.phone && customerIn.phone?.trim()) {
    await client.from('customers').update({ phone: customerIn.phone.trim() }).eq('id', customerId)
  }
  if (!customerId) {
    const { data: newCustomer, error: cErr } = await client
      .from('customers')
      .insert({ organization_id: orgId, full_name: customerIn.full_name!.trim(), email, phone: customerIn.phone?.trim() || null, status: 'active' })
      .select('id')
      .single()
    if (cErr || !newCustomer) return json({ error: 'customer_failed' }, 500)
    customerId = newCustomer.id
  }

  const streetLine = shipping.address_line1!.trim() + (shipping.address_line2?.trim() ? `, ${shipping.address_line2!.trim()}` : '')
  const { data: existingAddresses } = await client
    .from('customer_addresses')
    .select('id, street, city, zip_code')
    .eq('customer_id', customerId)

  const sameAddress = (existingAddresses ?? []).some(a =>
    a.street === streetLine && a.city === shipping.city!.trim() && a.zip_code === shipping.zip!.trim())

  if (!sameAddress) {
    await client.from('customer_addresses').insert({
      customer_id: customerId,
      label: 'Envío',
      street: streetLine,
      city: shipping.city!.trim(),
      state: shipping.state!.trim(),
      zip_code: shipping.zip!.trim(),
      country: 'MX',
      is_default: (existingAddresses ?? []).length === 0,
    })
  }

  // 4. Create the order + line items + payment + shipping snapshot.
  const { data: order, error: oErr } = await client
    .from('orders')
    .insert({ organization_id: orgId, customer_id: customerId, folio: '', status: 'pagado', subtotal: total, discount_amount: 0, total, source: 'ecommerce' })
    .select('id, folio')
    .single()

  if (oErr || !order) return json({ error: 'order_failed' }, 500)

  await client.from('order_items').insert(orderItemsPayload.map(i => ({ order_id: order.id, organization_id: orgId, ...i })))
  await client.from('order_payments').insert({ order_id: order.id, organization_id: orgId, method: 'tarjeta_simulada', amount: total })
  await client.from('order_shipping').insert({
    order_id: order.id, organization_id: orgId, type: 'envio',
    address_line1: shipping.address_line1!.trim(), address_line2: shipping.address_line2?.trim() || null,
    city: shipping.city!.trim(), state: shipping.state!.trim(), zip: shipping.zip!.trim(),
  })

  // 5. Confirm reservations into the order and decrement real stock.
  await client
    .from('inventory_reservations')
    .update({ status: 'confirmed', order_id: order.id, updated_at: new Date().toISOString() })
    .eq('session_id', sessionId)
    .eq('status', 'pending')
    .in('variant_id', variantIds)

  for (const item of orderItemsPayload) {
    await client.from('inventory_ledger').insert({
      organization_id: orgId, variant_id: item.variant_id, movement_type: 'sale',
      quantity: -item.quantity, source_type: 'order', source_id: order.id, notes: `Venta web ${order.folio}`,
    })
  }

  revalidateTag(`catalog-${orgId}`, { expire: 0 })

  // 6. Best-effort side effects — never fail the order because of these.
  await Promise.allSettled([
    sendOrderConfirmationEmail({
      to: email,
      customerName: customerIn.full_name!.trim(),
      folio: order.folio,
      items: orderItemsPayload.map(i => ({ name: i.product_name, variantLabel: i.variant_name === 'Estándar' ? '' : i.variant_name, quantity: i.quantity, unitPrice: i.unit_price, subtotal: i.subtotal })),
      total,
      shipping: { address_line1: shipping.address_line1!.trim(), address_line2: shipping.address_line2?.trim() || null, city: shipping.city!.trim(), state: shipping.state!.trim(), zip: shipping.zip!.trim() },
      siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? '',
    }),
    notifyNewOrder(orgId, { folio: order.folio, total, customerName: customerIn.full_name!.trim() }),
  ])

  return json({ order_id: order.id, folio: order.folio, total })
}

export const dynamic = 'force-dynamic'
