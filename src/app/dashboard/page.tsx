import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <main style={{
      minHeight: '100dvh',
      background: '#F5F5F7',
      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", sans-serif',
      display: 'flex',
      flexDirection: 'column',
      maxWidth: '430px',
      margin: '0 auto',
      position: 'relative',
    }}>

      {/* ── HERO CARD ─────────────────────── */}
      <div style={{
        margin: '16px 16px 0',
        borderRadius: '28px',
        background: 'linear-gradient(145deg, #1D4ED8 0%, #2563EB 50%, #3B82F6 100%)',
        padding: '28px 24px 32px',
        boxShadow: '0 16px 48px rgba(29,78,216,0.35)',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* subtle pattern inside hero */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: 'radial-gradient(ellipse 80% 60% at 110% -10%, rgba(255,255,255,0.12) 0%, transparent 60%)',
        }} />

        {/* Top row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px' }}>
          <div style={{
            background: 'rgba(255,255,255,0.18)',
            backdropFilter: 'blur(8px)',
            borderRadius: '10px',
            padding: '7px 10px',
            display: 'flex', alignItems: 'center', gap: '6px',
          }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2.5px' }}>
              {[...Array(4)].map((_, i) => (
                <div key={i} style={{ width: '4px', height: '4px', borderRadius: '1px', background: 'rgba(255,255,255,0.8)' }} />
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ position: 'relative' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth="2" strokeLinecap="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
              </svg>
              <div style={{ position: 'absolute', top: '-2px', right: '-2px', width: '7px', height: '7px', background: '#F87171', borderRadius: '50%', border: '1.5px solid #2563EB' }} />
            </div>
            <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: 'rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 700, color: 'white' }}>
              JH
            </div>
          </div>
        </div>

        {/* Main number */}
        <div style={{ marginBottom: '6px' }}>
          <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.65)', fontWeight: 500, marginBottom: '4px' }}>Ventas hoy</p>
          <p style={{ fontSize: '42px', fontWeight: 800, color: 'white', letterSpacing: '-1.5px', lineHeight: 1, margin: 0 }}>
            $47,320
          </p>
        </div>

        {/* Pill badge */}
        <div style={{ display: 'flex', gap: '8px', marginTop: '16px', flexWrap: 'wrap' }}>
          <div style={{
            background: 'rgba(255,255,255,0.15)',
            backdropFilter: 'blur(8px)',
            borderRadius: '50px',
            padding: '7px 14px',
            fontSize: '13px', fontWeight: 600, color: 'white',
            display: 'flex', alignItems: 'center', gap: '6px',
          }}>
            <span style={{ fontSize: '10px' }}>▲</span> +12.4% vs ayer
          </div>
          <div style={{
            background: 'rgba(255,255,255,0.95)',
            borderRadius: '50px',
            padding: '7px 14px',
            fontSize: '13px', fontWeight: 600, color: '#1D4ED8',
            display: 'flex', alignItems: 'center', gap: '6px',
          }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>
            Ver reporte
          </div>
        </div>
      </div>

      {/* ── STATS PILLS ───────────────────── */}
      <div style={{ display: 'flex', gap: '10px', padding: '16px 16px 0', overflowX: 'auto', scrollbarWidth: 'none' }}>
        {[
          { label: 'Órdenes', value: '8', sub: '3 urgentes', color: '#FF9500' },
          { label: 'Clientes', value: '24', sub: 'este mes', color: '#34C759' },
          { label: 'Productos', value: '312', sub: '5 bajo stock', color: '#2563EB' },
        ].map((s) => (
          <div key={s.label} style={{
            flex: '0 0 auto',
            background: 'rgba(255,255,255,0.90)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            borderRadius: '20px',
            border: '1px solid rgba(255,255,255,0.95)',
            boxShadow: '0 2px 16px rgba(0,0,0,0.06)',
            padding: '16px 20px',
            minWidth: '110px',
          }}>
            <p style={{ fontSize: '11px', fontWeight: 600, color: '#AEAEB2', marginBottom: '6px', letterSpacing: '0.04em' }}>
              {s.label.toUpperCase()}
            </p>
            <p style={{ fontSize: '24px', fontWeight: 800, color: '#0A0A0B', letterSpacing: '-0.5px', lineHeight: 1, margin: 0 }}>
              {s.value}
            </p>
            <p style={{ fontSize: '11px', fontWeight: 600, color: s.color, marginTop: '4px' }}>{s.sub}</p>
          </div>
        ))}
      </div>

      {/* ── RECENT ORDERS ─────────────────── */}
      <div style={{
        margin: '16px 16px 0',
        background: 'rgba(255,255,255,0.90)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderRadius: '24px',
        border: '1px solid rgba(255,255,255,0.95)',
        boxShadow: '0 2px 16px rgba(0,0,0,0.06)',
        overflow: 'hidden',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 20px 4px' }}>
          <p style={{ fontSize: '16px', fontWeight: 700, color: '#0A0A0B', letterSpacing: '-0.3px', margin: 0 }}>Órdenes recientes</p>
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#2563EB' }}>Ver todas →</span>
        </div>

        {[
          { initials: 'ML', name: 'María López', desc: 'Nike Air Max 270 · T25', amount: '$2,899', status: 'Pagado', statusColor: '#34C759', bg: 'linear-gradient(135deg,#2563EB,#60A5FA)' },
          { initials: 'CR', name: 'Carlos Ramírez', desc: 'Adidas Ultraboost 22', amount: '$3,450', status: 'Pendiente', statusColor: '#FF9500', bg: 'linear-gradient(135deg,#FF9500,#FBBF24)' },
          { initials: 'AG', name: 'Ana González', desc: 'Vans Old Skool · T23', amount: '$1,650', status: 'Preparando', statusColor: '#2563EB', bg: 'linear-gradient(135deg,#34C759,#6EE7B7)' },
        ].map((o, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: '14px',
            padding: '14px 20px',
            borderTop: i === 0 ? 'none' : '1px solid #F2F2F4',
          }}>
            <div style={{
              width: '40px', height: '40px', borderRadius: '50%',
              background: o.bg,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '13px', fontWeight: 700, color: 'white', flexShrink: 0,
            }}>
              {o.initials}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: '14px', fontWeight: 600, color: '#0A0A0B', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{o.name}</p>
              <p style={{ fontSize: '12px', color: '#AEAEB2', margin: '2px 0 0', fontWeight: 400 }}>{o.desc}</p>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <p style={{ fontSize: '14px', fontWeight: 700, color: '#0A0A0B', margin: 0, fontVariantNumeric: 'tabular-nums' }}>{o.amount}</p>
              <div style={{
                marginTop: '4px',
                display: 'inline-block',
                background: `${o.statusColor}18`,
                color: o.statusColor,
                fontSize: '10px', fontWeight: 700,
                padding: '2px 8px', borderRadius: '50px',
                letterSpacing: '0.02em',
              }}>
                {o.status}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* spacer for bottom nav */}
      <div style={{ height: '100px' }} />

      {/* ── BOTTOM NAV ────────────────────── */}
      <div style={{
        position: 'fixed', bottom: '20px',
        left: '50%', transform: 'translateX(-50%)',
        width: 'calc(100% - 32px)', maxWidth: '398px',
        display: 'flex', alignItems: 'center', gap: '8px',
        zIndex: 100,
      }}>
        {/* Nav pill */}
        <div style={{
          flex: 1,
          background: 'rgba(255,255,255,0.88)',
          backdropFilter: 'blur(32px) saturate(200%)',
          WebkitBackdropFilter: 'blur(32px) saturate(200%)',
          borderRadius: '50px',
          border: '1px solid rgba(255,255,255,0.95)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.12), 0 1px 0 rgba(255,255,255,0.8) inset',
          padding: '6px',
          display: 'flex', alignItems: 'center', gap: '4px',
        }}>
          {[
            { label: 'Inicio', active: true, icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M10.707 2.293a1 1 0 0 1 1.414 0l7 7A1 1 0 0 1 19 11h-1v9a1 1 0 0 1-1 1h-4v-5H11v5H7a1 1 0 0 1-1-1v-9H5a1 1 0 0 1-.707-1.707l7-7z"/></svg> },
            { label: '', active: false, icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-4 0v2M8 7V5a2 2 0 0 0-4 0v2M12 12v4M10 14h4"/></svg> },
            { label: '', active: false, icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg> },
            { label: '', active: false, icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 20a8 8 0 0 1 16 0"/></svg> },
          ].map((item, i) => (
            <div key={i} style={{
              flex: item.active ? 'none' : 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
              padding: item.active ? '10px 20px' : '10px',
              borderRadius: '50px',
              background: item.active ? '#0A0A0B' : 'transparent',
              color: item.active ? 'white' : '#AEAEB2',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}>
              {item.icon}
              {item.active && item.label && (
                <span style={{ fontSize: '14px', fontWeight: 700, whiteSpace: 'nowrap' }}>{item.label}</span>
              )}
            </div>
          ))}
        </div>

        {/* FAB */}
        <div style={{
          width: '56px', height: '56px',
          background: '#0A0A0B',
          borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
          cursor: 'pointer',
          flexShrink: 0,
        }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
        </div>
      </div>

    </main>
  )
}
