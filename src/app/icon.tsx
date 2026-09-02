import { ImageResponse } from 'next/og'

export const size = { width: 32, height: 32 }
export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    <div style={{
      background: '#0A0A0E',
      width: '100%',
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: '7px',
    }}>
      <span style={{ color: '#CAFF3A', fontSize: 22, fontWeight: 900, letterSpacing: '-1px', fontFamily: 'serif' }}>N</span>
    </div>,
    { ...size }
  )
}
