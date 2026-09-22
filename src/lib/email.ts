import { Resend } from 'resend'

export interface OrderConfirmationItem {
  name: string
  variantLabel: string
  quantity: number
  unitPrice: number
  subtotal: number
}

function fmt(n: number) {
  return n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

const LOGO_URL = 'https://northea.cc/logo-lockup.png'

export async function sendOrderConfirmationEmail(params: {
  to: string
  customerName: string
  folio: string
  items: OrderConfirmationItem[]
  total: number
  shipping: { address_line1: string; address_line2?: string | null; city: string; state: string; zip: string }
  siteUrl: string
}) {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return { skipped: true as const }

  const resend = new Resend(apiKey)

  const rows = params.items.map(i => `
    <tr>
      <td style="padding:16px 0;border-bottom:1px solid #ECE9E3">
        <div style="font-size:14px;font-weight:700;color:#111110;letter-spacing:-.01em">${i.name}</div>
        ${i.variantLabel ? `<div style="font-size:11.5px;color:#8A867E;margin-top:3px;text-transform:uppercase;letter-spacing:.05em">${i.variantLabel}</div>` : ''}
        <div style="font-size:12px;color:#8A867E;margin-top:4px">Cantidad: ${i.quantity} &nbsp;·&nbsp; ${fmt(i.unitPrice)} c/u</div>
      </td>
      <td style="padding:16px 0;border-bottom:1px solid #ECE9E3;text-align:right;font-size:14px;font-weight:700;color:#111110;white-space:nowrap;vertical-align:top">${fmt(i.subtotal)}</td>
    </tr>`).join('')

  const html = `
  <div style="background:#EFEDE7;padding:40px 16px;font-family:Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased">
    <div style="max-width:560px;margin:0 auto;background:#FFFFFF;border-radius:14px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06)">

      <!-- Hero -->
      <div style="background:radial-gradient(120% 160% at 20% 0%, #FCEADF 0%, #FBF6F0 45%, #FFFFFF 78%);padding:40px 40px 32px;text-align:center">
        <img src="${LOGO_URL}" alt="NORTHÉA" height="26" style="height:26px;width:auto;margin-bottom:28px" />
        <div style="width:52px;height:52px;border-radius:50%;background:#D62828;display:inline-flex;align-items:center;justify-content:center;margin-bottom:18px">
          <table role="presentation" width="100%" height="100%"><tr><td align="center" valign="middle" style="color:#fff;font-size:24px;line-height:1">✓</td></tr></table>
        </div>
        <div style="font-size:23px;font-weight:800;color:#111110;letter-spacing:-.01em;line-height:1.25">¡Gracias por tu compra,<br/>${params.customerName.split(' ')[0]}!</div>
        <div style="font-size:13px;color:#6B6660;margin-top:10px">Confirmamos tu orden <strong style="color:#111110">#${params.folio}</strong></div>
      </div>

      <!-- Items -->
      <div style="padding:8px 40px 0">
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation">${rows}</table>
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-top:6px">
          <tr>
            <td style="padding:18px 0 24px;font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#6B6660">Total</td>
            <td style="padding:18px 0 24px;text-align:right;font-size:19px;font-weight:800;color:#111110">${fmt(params.total)}</td>
          </tr>
        </table>
      </div>

      <!-- Shipping -->
      <div style="padding:22px 40px;background:#F7F5F1;margin:0 24px 32px;border-radius:10px">
        <div style="font-size:10.5px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#8A867E;margin-bottom:8px">Enviaremos tu pedido a</div>
        <div style="font-size:13.5px;color:#111110;line-height:1.65">
          ${params.shipping.address_line1}${params.shipping.address_line2 ? `, ${params.shipping.address_line2}` : ''}<br/>
          ${params.shipping.city}, ${params.shipping.state} ${params.shipping.zip}
        </div>
      </div>

      <!-- CTA -->
      <div style="padding:0 40px 36px;text-align:center">
        <div style="font-size:12.5px;color:#6B6660;line-height:1.7">¿Dudas sobre tu pedido?<br/>Escríbenos por WhatsApp, con gusto te ayudamos.</div>
      </div>

      <!-- Policy footer -->
      <div style="background:#111110;padding:28px 40px 32px;text-align:center">
        <div style="font-size:11px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#F5F3EF;margin-bottom:10px">NORTHÉA</div>
        <div style="font-size:11.5px;color:#9C9890;line-height:1.75;max-width:400px;margin:0 auto">
          Todos nuestros artículos son <strong style="color:#D8D4CC">outlet / piezas únicas</strong> — cada pieza es la única disponible de su tipo, por lo que <strong style="color:#D8D4CC">no se aceptan cambios ni devoluciones</strong>.
          Si tu pedido llega con algún defecto de fábrica, escríbenos por WhatsApp dentro de las primeras 48 horas y con gusto lo resolvemos.
        </div>
        <div style="font-size:10.5px;color:#5C594F;margin-top:22px">Ropa, artículos y belleza de USA · EST. 2026</div>
      </div>
    </div>
  </div>`

  return resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL ?? 'NORTHÉA <no-reply@updates.northea.cc>',
    to: params.to,
    subject: `Confirmamos tu compra #${params.folio} — NORTHÉA`,
    html,
  })
}
