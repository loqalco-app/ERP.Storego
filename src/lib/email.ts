import { Resend } from 'resend'

export interface OrderConfirmationItem {
  name: string
  variantLabel: string
  quantity: number
  unitPrice: number
  subtotal: number
  imageUrl: string | null
}

export interface BankDetails { bank?: string; holder?: string; clabe?: string; account?: string }
export interface ShippingAddress { address_line1: string; address_line2?: string | null; city: string; state: string; zip: string }

function fmt(n: number) {
  return n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

const LOGO_URL = 'https://northea.cc/logo-lockup.png'
const FROM = () => process.env.RESEND_FROM_EMAIL ?? 'northéa <no-reply@updates.northea.cc>'

function getResend() {
  const apiKey = process.env.RESEND_API_KEY
  return apiKey ? new Resend(apiKey) : null
}

function itemRows(items: OrderConfirmationItem[]) {
  return items.map(i => `
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
}

function shippingBlock(shipping?: ShippingAddress | null) {
  if (!shipping) return ''
  return `
      <div style="padding:20px 24px;border:1px solid #EDEDEB;border-radius:8px;margin-bottom:32px">
        <div style="font-size:10.5px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#8A867E;margin-bottom:8px">Enviaremos tu pedido a</div>
        <div style="font-size:13.5px;color:#111110;line-height:1.65">
          ${shipping.address_line1}${shipping.address_line2 ? `, ${shipping.address_line2}` : ''}<br/>
          ${shipping.city}, ${shipping.state} ${shipping.zip}
        </div>
      </div>`
}

function footer() {
  return `
      <div style="text-align:center;padding-bottom:32px">
        <div style="font-size:12.5px;color:#6B6660;line-height:1.7">¿Dudas sobre tu pedido?<br/>Escríbenos por WhatsApp, con gusto te ayudamos.</div>
      </div>

      <div style="border-top:1px solid #111110;padding-top:24px;text-align:center">
        <div style="font-size:11px;font-weight:800;letter-spacing:.1em;color:#111110;margin-bottom:12px">northéa</div>
        <div style="font-size:11.5px;color:#8A867E;line-height:1.75;max-width:400px;margin:0 auto">
          Todos nuestros artículos son <strong style="color:#111110">outlet / piezas únicas</strong> — cada pieza es la única disponible de su tipo, por lo que <strong style="color:#111110">no se aceptan cambios ni devoluciones</strong>.
          Si tu pedido llega con algún defecto de fábrica, escríbenos por WhatsApp dentro de las primeras 48 horas y con gusto lo resolvemos.
        </div>
        <div style="font-size:10.5px;color:#B0AEA8;margin-top:18px">Ropa, artículos y belleza de USA · EST. 2026</div>
      </div>`
}

function shell(bodyHtml: string) {
  return `
  <div style="background:#FFFFFF;padding:40px 16px;font-family:Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased">
    <div style="max-width:560px;margin:0 auto">
      <div style="text-align:center;padding-bottom:32px;border-bottom:1px solid #111110">
        <img src="${LOGO_URL}" alt="northéa" height="24" style="height:24px;width:auto" />
      </div>
      ${bodyHtml}
      ${footer()}
    </div>
  </div>`
}

// ─── 1. Full receipt — paid in full, either all at once or by liquidating an apartado ───
export async function sendOrderConfirmationEmail(params: {
  to: string
  customerName: string
  folio: string
  items: OrderConfirmationItem[]
  total: number
  shipping?: ShippingAddress | null
}) {
  const resend = getResend()
  if (!resend) return { skipped: true as const }

  const body = `
      <div style="padding:32px 0 28px;text-align:center">
        <div style="font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#8A867E;margin-bottom:14px">Pedido confirmado</div>
        <div style="font-size:22px;font-weight:800;color:#111110;letter-spacing:-.01em;line-height:1.3">Gracias por tu compra, ${params.customerName.split(' ')[0]}</div>
        <div style="font-size:13px;color:#6B6660;margin-top:10px">Orden <strong style="color:#111110">#${params.folio}</strong></div>
      </div>
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation">${itemRows(params.items)}</table>
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
        <tr>
          <td style="padding:18px 0 32px;font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#6B6660">Total pagado</td>
          <td style="padding:18px 0 32px;text-align:right;font-size:19px;font-weight:800;color:#111110">${fmt(params.total)}</td>
        </tr>
      </table>
      ${shippingBlock(params.shipping)}`

  return resend.emails.send({
    from: FROM(), to: params.to,
    subject: `Confirmamos tu compra #${params.folio} — northéa`,
    html: shell(body),
  })
}

// ─── 2. Deposit confirmation — apartado created, states the 10% policy + how to pay the rest ───
export async function sendDepositConfirmationEmail(params: {
  to: string
  customerName: string
  folio: string
  items: OrderConfirmationItem[]
  total: number
  depositAmount: number
  balance: number
  method: string
  bankDetails?: BankDetails | null
  paymentLink?: string | null
  shipping?: ShippingAddress | null
}) {
  const resend = getResend()
  if (!resend) return { skipped: true as const }

  const bd = params.bankDetails
  const bankBlock = params.method === 'transferencia' && bd && (bd.clabe || bd.account) ? `
      <div style="padding:20px 24px;background:#F7F5F1;border-radius:8px;margin-bottom:20px">
        <div style="font-size:10.5px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#8A867E;margin-bottom:10px">Datos para tu transferencia</div>
        <div style="font-size:13.5px;color:#111110;line-height:1.8">
          ${bd.bank ? `Banco: <strong>${bd.bank}</strong><br/>` : ''}
          ${bd.holder ? `Titular: <strong>${bd.holder}</strong><br/>` : ''}
          ${bd.clabe ? `CLABE: <strong>${bd.clabe}</strong><br/>` : ''}
          ${bd.account ? `Cuenta: <strong>${bd.account}</strong>` : ''}
        </div>
      </div>` : ''

  const linkBlock = params.method === 'link_pago' && params.paymentLink ? `
      <div style="padding:20px 24px;background:#F7F5F1;border-radius:8px;margin-bottom:20px;text-align:center">
        <div style="font-size:10.5px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#8A867E;margin-bottom:10px">Liga de pago</div>
        <a href="${params.paymentLink}" style="display:inline-block;padding:12px 24px;background:#111110;color:#FFFFFF;border-radius:6px;font-size:13px;font-weight:700;text-decoration:none">Completar mi pago</a>
      </div>` : ''

  const body = `
      <div style="padding:32px 0 28px;text-align:center">
        <div style="font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#8A867E;margin-bottom:14px">Apartado confirmado</div>
        <div style="font-size:22px;font-weight:800;color:#111110;letter-spacing:-.01em;line-height:1.3">Recibimos tu apartado, ${params.customerName.split(' ')[0]}</div>
        <div style="font-size:13px;color:#6B6660;margin-top:10px">Orden <strong style="color:#111110">#${params.folio}</strong></div>
      </div>
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation">${itemRows(params.items)}</table>
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
        <tr><td style="padding:18px 0 4px;font-size:12px;color:#6B6660">Total del pedido</td><td style="padding:18px 0 4px;text-align:right;font-size:13px;font-weight:700;color:#111110">${fmt(params.total)}</td></tr>
        <tr><td style="padding:4px 0;font-size:12px;color:#6B6660">Anticipo recibido</td><td style="padding:4px 0;text-align:right;font-size:13px;font-weight:700;color:#111110">${fmt(params.depositAmount)}</td></tr>
        <tr><td style="padding:4px 0 32px;font-size:13px;font-weight:800;color:#111110">Saldo pendiente</td><td style="padding:4px 0 32px;text-align:right;font-size:16px;font-weight:800;color:#111110">${fmt(params.balance)}</td></tr>
      </table>
      ${bankBlock}${linkBlock}
      <div style="padding:16px 20px;background:#FBF6EC;border-radius:8px;margin-bottom:32px">
        <div style="font-size:12px;color:#7A5C1E;line-height:1.6">Para validar tu apartado se requiere un anticipo mínimo del <strong>10% del total</strong>. En cuanto recibamos cada pago te llegará un correo confirmando el monto y tu saldo restante.</div>
      </div>
      ${shippingBlock(params.shipping)}`

  return resend.emails.send({
    from: FROM(), to: params.to,
    subject: `Confirmamos tu apartado #${params.folio} — northéa`,
    html: shell(body),
  })
}

// ─── 3. Abono received — partial payment towards an existing apartado ───
export async function sendAbonoReceivedEmail(params: {
  to: string
  customerName: string
  folio: string
  items: OrderConfirmationItem[]
  total: number
  amountReceived: number
  paidToDate: number
  balance: number
}) {
  const resend = getResend()
  if (!resend) return { skipped: true as const }

  const pct = Math.max(0, Math.min(100, Math.round((params.paidToDate / params.total) * 100)))

  const body = `
      <div style="padding:32px 0 28px;text-align:center">
        <div style="font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#8A867E;margin-bottom:14px">Abono recibido — Orden #${params.folio}</div>
        <div style="font-size:22px;font-weight:800;color:#111110;letter-spacing:-.01em;line-height:1.3">Gracias por tu abono, ${params.customerName.split(' ')[0]}</div>
      </div>

      <div style="padding:24px;background:#F7F5F1;border-radius:10px;margin-bottom:28px">
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
          <tr><td style="font-size:12px;color:#6B6660;padding-bottom:6px">Recibimos hoy</td><td style="text-align:right;font-size:20px;font-weight:800;color:#111110;padding-bottom:6px">${fmt(params.amountReceived)}</td></tr>
        </table>
        <div style="height:8px;background:#EDEDEB;border-radius:4px;margin:14px 0 10px;overflow:hidden">
          <div style="height:100%;width:${pct}%;background:#111110;border-radius:4px"></div>
        </div>
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
          <tr>
            <td style="font-size:11.5px;color:#8A867E">Pagado a la fecha: <strong style="color:#111110">${fmt(params.paidToDate)}</strong> de ${fmt(params.total)} (${pct}%)</td>
            <td style="text-align:right;font-size:13px;font-weight:800;color:#111110">Resta ${fmt(params.balance)}</td>
          </tr>
        </table>
      </div>

      <div style="font-size:10.5px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#8A867E;margin-bottom:6px">Tu pedido</div>
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation">${itemRows(params.items)}</table>
      <div style="padding:14px 0 32px;text-align:right;font-size:12px;color:#6B6660">Total del pedido: <strong style="color:#111110">${fmt(params.total)}</strong></div>

      <div style="padding:16px 20px;background:#F7F5F1;border-radius:8px;margin-bottom:32px;text-align:center">
        <div style="font-size:12px;color:#6B6660">Este correo es tu comprobante oficial de este abono. Guárdalo.</div>
      </div>`

  return resend.emails.send({
    from: FROM(), to: params.to,
    subject: `Recibimos tu abono de ${fmt(params.amountReceived)} — Orden #${params.folio} — northéa`,
    html: shell(body),
  })
}
