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

export async function notifyNewOrder(orgId: string, params: {
  folio: string; total: number; customerName: string; source: string; itemCount: number
}) {
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

  const total = params.total.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 0 })
  const sourceLabel = SOURCE_LABEL[params.source] ?? params.source
  const itemsLabel = `${params.itemCount} producto${params.itemCount !== 1 ? 's' : ''}`
  const payload = JSON.stringify({
    title: 'Nueva venta | northéa',
    body: `${sourceLabel} · ${params.customerName} · ${itemsLabel} · ${total} · #${params.folio}`,
    url: '/orders',
  })

  let sent = 0
  await Promise.all(subs.map(async sub => {
    try {
      await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload)
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
