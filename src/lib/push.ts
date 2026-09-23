import webpush from 'web-push'
import { createClient } from '@supabase/supabase-js'

function getClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

function configured() {
  return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY)
}

const SOURCE_LABEL: Record<string, string> = {
  ecommerce: 'Tienda web',
  pos: 'POS',
  manual: 'Manual',
}

function fmt(n: number) {
  return n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 0 })
}

async function sendPush(orgId: string, payload: { title: string; body: string; url: string }) {
  if (!configured()) return { skipped: true as const }

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? 'mailto:soporte@northea.cc',
    process.env.VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  )

  const client = getClient()
  const { data: subs } = await client
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('organization_id', orgId)

  if (!subs || subs.length === 0) return { sent: 0 }

  const body = JSON.stringify(payload)
  let sent = 0
  await Promise.all(subs.map(async sub => {
    try {
      await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, body)
      sent++
    } catch (err: unknown) {
      const statusCode = (err as { statusCode?: number })?.statusCode
      if (statusCode === 404 || statusCode === 410) {
        await client.from('push_subscriptions').delete().eq('id', sub.id)
      }
    }
  }))

  return { sent }
}

// New order — either a fully-paid sale or a freshly created apartado.
export async function notifyNewOrder(orgId: string, params: {
  folio: string; total: number; customerName: string; source: string; itemCount: number; status: string
}) {
  const sourceLabel = SOURCE_LABEL[params.source] ?? params.source
  const itemsLabel = `${params.itemCount} producto${params.itemCount !== 1 ? 's' : ''}`
  const isApartado = params.status === 'apartado'
  return sendPush(orgId, {
    title: isApartado ? 'Nuevo apartado | northéa' : 'Nueva venta | northéa',
    body: `${sourceLabel} · ${params.customerName} · ${itemsLabel} · ${fmt(params.total)} · #${params.folio}`,
    url: '/orders',
  })
}

// A payment towards an existing apartado — either a partial abono or the one that liquidates it.
export async function notifyAbono(orgId: string, params: {
  folio: string; customerName: string; amount: number; balance: number
}) {
  const liquidated = params.balance <= 0
  return sendPush(orgId, {
    title: liquidated ? 'Apartado liquidado | northéa' : 'Abono recibido | northéa',
    body: liquidated
      ? `${params.customerName} · Pagó el resto: ${fmt(params.amount)} · #${params.folio}`
      : `${params.customerName} · Abonó ${fmt(params.amount)} · Resta ${fmt(params.balance)} · #${params.folio}`,
    url: '/orders',
  })
}
