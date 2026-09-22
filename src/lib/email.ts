import { Resend } from 'resend'

export interface OrderConfirmationItem {
  name: string
  variantLabel: string
  quantity: number
  unitPrice: number
  subtotal: number
  imageUrl: string | null
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
      <td style="padding:16px 0;border-bottom:1px solid #EDEDEB;width:56px" valign="top">
        ${i.imageUrl
          ? `<img src="${i.imageUrl}" width="56" height="70" alt="${i.name}" style="width:56px;height:70px;object-fit:cover;border-radius:4px;background:#F4F3F1;display:block" />`
          : `<div style="width:56px;height:70px;border-radius:4px;background:#F4F3F1"></div>`}
      </td>
      <td style="padding:16px 0 16px 14px;border-bottom:1px solid #EDEDEB" valign="top">
        <div style="font-size:14px;font-weight:700;color:#111110;letter-spacing:-.01em">${i.name}</div>
        ${i.variantLabel ? `<div style="font-size:11.5px;color:#8A867E;margin-top:3px;text-transform:uppercase;letter-spacing:.05em">${i.variantLabel}</div>` : ''}
        <div style="font-size:12px;color:#8A867E;margin-top:4px">Cantidad: ${i.quantity} &nbsp;·&nbsp; ${fmt(i.unitPrice)} c/u</div>
      </td>
      <td style="padding:16px 0;border-bottom:1px solid #EDEDEB;text-align:right;font-size:14px;font-weight:700;color:#111110;white-space:nowrap" valign="top">${fmt(i.subtotal)}</td>
    </tr>`).join('')

  const html = `
  <div style="background:#FFFFFF;padding:40px 16px;font-family:Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased">
    <div style="max-width:560px;margin:0 auto">

      <!-- Header -->
      <div style="text-align:center;padding-bottom:32px;border-bottom:1px solid #111110">
        <img src="${LOGO_URL}" alt="northéa" height="24" style="height:24px;width:auto" />
      </div>

      <!-- Confirmation -->
      <div style="padding:32px 0 28px;text-align:center">
        <div style="font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#8A867E;margin-bottom:14px">Pedido confirmado</div>
        <div style="font-size:22px;font-weight:800;color:#111110;letter-spacing:-.01em;line-height:1.3">Gracias por tu compra, ${params.customerName.split(' ')[0]}</div>
        <div style="font-size:13px;color:#6B6660;margin-top:10px">Orden <strong style="color:#111110">#${params.folio}</strong></div>
      </div>

      <!-- Items -->
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation">${rows}</table>
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
        <tr>
          <td style="padding:18px 0 32px;font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#6B6660">Total</td>
          <td style="padding:18px 0 32px;text-align:right;font-size:19px;font-weight:800;color:#111110">${fmt(params.total)}</td>
        </tr>
      </table>

      <!-- Shipping -->
      <div style="padding:20px 24px;border:1px solid #EDEDEB;border-radius:8px;margin-bottom:32px">
        <div style="font-size:10.5px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#8A867E;margin-bottom:8px">Enviaremos tu pedido a</div>
        <div style="font-size:13.5px;color:#111110;line-height:1.65">
          ${params.shipping.address_line1}${params.shipping.address_line2 ? `, ${params.shipping.address_line2}` : ''}<br/>
          ${params.shipping.city}, ${params.shipping.state} ${params.shipping.zip}
        </div>
      </div>

      <!-- CTA -->
      <div style="text-align:center;padding-bottom:32px">
        <div style="font-size:12.5px;color:#6B6660;line-height:1.7">¿Dudas sobre tu pedido?<br/>Escríbenos por WhatsApp, con gusto te ayudamos.</div>
      </div>

      <!-- Policy footer -->
      <div style="border-top:1px solid #111110;padding-top:24px;text-align:center">
        <div style="font-size:11px;font-weight:800;letter-spacing:.1em;color:#111110;margin-bottom:12px">northéa</div>
        <div style="font-size:11.5px;color:#8A867E;line-height:1.75;max-width:400px;margin:0 auto">
          Todos nuestros artículos son <strong style="color:#111110">outlet / piezas únicas</strong> — cada pieza es la única disponible de su tipo, por lo que <strong style="color:#111110">no se aceptan cambios ni devoluciones</strong>.
          Si tu pedido llega con algún defecto de fábrica, escríbenos por WhatsApp dentro de las primeras 48 horas y con gusto lo resolvemos.
        </div>
        <div style="font-size:10.5px;color:#B0AEA8;margin-top:18px">Ropa, artículos y belleza de USA · EST. 2026</div>
      </div>
    </div>
  </div>`

  return resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL ?? 'northéa <no-reply@updates.northea.cc>',
    to: params.to,
    subject: `Confirmamos tu compra #${params.folio} — northéa`,
    html,
  })
}
