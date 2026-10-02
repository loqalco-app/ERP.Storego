'use client'
import { useEffect } from 'react'

// Todos los modales/overlays de la app cierran con un clic sobre el fondo
// (handler con e.target === e.currentTarget). Al presionar Escape se hace ese
// mismo clic sobre el overlay visible que esté más arriba, así cualquier modal
// —actual o futuro con estas clases— se cierra con Escape sin código extra.
const OVERLAY_SELECTOR = [
  '.overlay', '.modal-overlay', '.quote-overlay', '.sheet-overlay', '.img-preview-overlay',
  '.detail-overlay', '.exp-modal-overlay', '.vp-overlay', '.modal-scrim', '.mod-back',
  '.pd-scrim', '.mobile-dd-scrim', '[data-escape-close]',
].join(',')

export default function GlobalEscape() {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      const els = Array.from(document.querySelectorAll<HTMLElement>(OVERLAY_SELECTOR))
        .filter(el => el.offsetParent !== null || getComputedStyle(el).position === 'fixed')
      if (!els.length) return
      let top = els[0], topZ = -Infinity
      for (const el of els) {
        const z = parseInt(getComputedStyle(el).zIndex, 10)
        const zi = Number.isNaN(z) ? 0 : z
        if (zi >= topZ) { top = el; topZ = zi }
      }
      e.preventDefault()
      top.click()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  return null
}
