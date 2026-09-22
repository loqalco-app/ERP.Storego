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
      <td style="padding:10px 0;border-bottom:1px solid #EEECE7">
        <div style="font-size:14px;font-weight:600;color:#0A0A0A">${i.name}</div>
        ${i.variantLabel ? `<div style="font-size:12px;color:#6B6B66">${i.variantLabel}</div>` : ''}
        <div style="font-size:12px;color:#6B6B66;margin-top:2px">Cantidad: ${i.quantity}</div>
      </td>
      <td style="padding:10px 0;border-bottom:1px solid #EEECE7;text-align:right;font-size:14px;font-weight:600;color:#0A0A0A;white-space:nowrap">${fmt(i.subtotal)}</td>
    </tr>`).join('')

  const html = `
  <div style="background:#F4F3F1;padding:32px 16px;font-family:Helvetica,Arial,sans-serif">
    <div style="max-width:520px;margin:0 auto;background:#FFFFFF">
      <div style="padding:32px 32px 20px;text-align:center">
        <div style="font-size:22px;font-weight:800;letter-spacing:.04em;color:#0A0A0A">NORTHÉA</div>
      </div>
      <div style="padding:0 32px 24px;text-align:center">
        <div style="font-size:18px;font-weight:700;color:#0A0A0A;margin-bottom:6px">¡Gracias por tu compra, ${params.customerName}!</div>
        <div style="font-size:13px;color:#6B6B66">Confirmamos tu orden <strong>#${params.folio}</strong></div>
      </div>
      <div style="padding:0 32px">
        <table width="100%" cellpadding="0" cellspacing="0">${rows}</table>
        <div style="display:flex;justify-content:space-between;padding:16px 0;font-size:15px;font-weight:800;color:#0A0A0A">
          <span>Total</span><span>${fmt(params.total)}</span>
        </div>
      </div>
      <div style="padding:20px 32px;background:#F4F3F1;margin-top:8px">
        <div style="font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#6B6B66;margin-bottom:8px">Enviaremos tu pedido a</div>
        <div style="font-size:13px;color:#0A0A0A;line-height:1.6">
          ${params.shipping.address_line1}${params.shipping.address_line2 ? `, ${params.shipping.address_line2}` : ''}<br/>
          ${params.shipping.city}, ${params.shipping.state} ${params.shipping.zip}
        </div>
      </div>
      <div style="padding:24px 32px 32px;text-align:center">
        <div style="font-size:12px;color:#6B6B66;line-height:1.6">¿Dudas sobre tu pedido? Escríbenos por WhatsApp, con gusto te ayudamos.</div>
        <div style="font-size:11px;color:#B0AEA8;margin-top:20px">NORTHÉA · Ropa, artículos y belleza de USA</div>
      </div>
    </div>
  </div>`

  return resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL ?? 'NORTHÉA <pedidos@updates.northea.cc>',
    to: params.to,
    subject: `Confirmamos tu compra #${params.folio} — NORTHÉA`,
    html,
  })
}
