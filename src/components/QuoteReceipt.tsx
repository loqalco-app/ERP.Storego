'use client'
import { forwardRef } from 'react'

export interface QuoteItem {
  name: string
  variantLabel: string
  quantity: number
  unitPrice: number
  subtotal: number
  image: string | null
}

export interface BankDetails { bank?: string; holder?: string; clabe?: string; account?: string }

export interface QuoteReceiptProps {
  folio: string
  customerName: string
  items: QuoteItem[]
  total: number
  method: string
  isApartado: boolean
  depositAmount: number
  bankDetails?: BankDetails | null
  paymentLink?: string | null
}

function fmt(n: number) {
  return n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

const QuoteReceipt = forwardRef<HTMLDivElement, QuoteReceiptProps>(function QuoteReceipt(
  { folio, customerName, items, total, method, isApartado, depositAmount, bankDetails, paymentLink }, ref
) {
  const balance = Math.max(0, total - (isApartado ? depositAmount : 0))
  const showBank = method === 'transferencia' && !!bankDetails && (bankDetails.bank || bankDetails.holder || bankDetails.clabe || bankDetails.account)
  const showLink = method === 'link_pago' && paymentLink

  return (
    <div ref={ref} style={{ width: 380, background: '#FFFFFF', fontFamily: 'Helvetica, Arial, sans-serif', color: '#111110' }}>
      <div style={{ textAlign: 'center', borderBottom: '1px solid #111110', padding: '28px 28px 20px' }}>
        <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: '.01em' }}>northéa</div>
      </div>

      <div style={{ textAlign: 'center', padding: '24px 28px 4px' }}>
        <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: '#8A867E' }}>Cotización</div>
        <div style={{ fontSize: 18, fontWeight: 800, marginTop: 8, lineHeight: 1.3 }}>Hola {customerName.split(' ')[0]}, aquí tu pedido</div>
        <div style={{ fontSize: 12, color: '#6B6660', marginTop: 8 }}>Folio <strong style={{ color: '#111110' }}>#{folio}</strong></div>
      </div>

      <div style={{ padding: '8px 28px 0' }}>
        {items.map((item, i) => (
          <div key={i} style={{ display: 'flex', gap: 12, padding: '14px 0', borderBottom: '1px solid #EDEDEB' }}>
            {item.image
              ? <img src={item.image} crossOrigin="anonymous" alt={item.name} style={{ width: 48, height: 60, objectFit: 'cover', borderRadius: 4, background: '#F4F3F1', flexShrink: 0 }} />
              : <div style={{ width: 48, height: 60, borderRadius: 4, background: '#F4F3F1', flexShrink: 0 }} />}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 700 }}>{item.name}</div>
              {item.variantLabel && <div style={{ fontSize: 11, color: '#8A867E', marginTop: 2, textTransform: 'uppercase', letterSpacing: '.04em' }}>{item.variantLabel}</div>}
              <div style={{ fontSize: 11.5, color: '#8A867E', marginTop: 3 }}>Cant. {item.quantity} · {fmt(item.unitPrice)} c/u</div>
            </div>
            <div style={{ fontSize: 13.5, fontWeight: 700, whiteSpace: 'nowrap' }}>{fmt(item.subtotal)}</div>
          </div>
        ))}
      </div>

      <div style={{ padding: '16px 28px', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', color: '#6B6660' }}>Total</span>
        <span style={{ fontSize: 20, fontWeight: 800 }}>{fmt(total)}</span>
      </div>

      {isApartado && (
        <div style={{ margin: '0 28px 16px', padding: '14px 18px', background: '#FBF6EC', borderRadius: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 4 }}>
            <span style={{ color: '#6B6660' }}>Anticipo</span><strong>{fmt(depositAmount)}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 800 }}>
            <span>Saldo pendiente</span><span>{fmt(balance)}</span>
          </div>
          <div style={{ fontSize: 11, color: '#7A5C1E', marginTop: 8, lineHeight: 1.5 }}>
            Para validar tu apartado se requiere un anticipo mínimo del 10% del total.
          </div>
        </div>
      )}

      {showBank && (
        <div style={{ margin: '0 28px 16px', padding: '16px 18px', background: '#F7F5F1', borderRadius: 8 }}>
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase', color: '#8A867E', marginBottom: 8 }}>Datos para tu transferencia</div>
          <div style={{ fontSize: 13, lineHeight: 1.75 }}>
            {bankDetails?.bank && <div>Banco: <strong>{bankDetails.bank}</strong></div>}
            {bankDetails?.holder && <div>Titular: <strong>{bankDetails.holder}</strong></div>}
            {bankDetails?.clabe && <div>CLABE: <strong>{bankDetails.clabe}</strong></div>}
            {bankDetails?.account && <div>Cuenta: <strong>{bankDetails.account}</strong></div>}
          </div>
          <div style={{ fontSize: 11, color: '#6B6660', marginTop: 10, lineHeight: 1.5, borderTop: '1px solid #E5E2DC', paddingTop: 10 }}>
            Una vez hecha la transferencia, envíanos el comprobante por este medio y te estará llegando vía correo electrónico la confirmación de tu pedido.
          </div>
        </div>
      )}

      {showLink && (
        <div style={{ margin: '0 28px 16px', padding: '16px 18px', background: '#F7F5F1', borderRadius: 8, textAlign: 'center' }}>
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase', color: '#8A867E', marginBottom: 8 }}>Liga de pago</div>
          <div style={{ fontSize: 12, wordBreak: 'break-all', color: '#1D4ED8' }}>{paymentLink}</div>
        </div>
      )}

      <div style={{ borderTop: '1px solid #111110', padding: '18px 28px 26px', textAlign: 'center' }}>
        <div style={{ fontSize: 10, color: '#B0AEA8' }}>Ropa, artículos y belleza de USA · EST. 2026</div>
      </div>
    </div>
  )
})

export default QuoteReceipt
