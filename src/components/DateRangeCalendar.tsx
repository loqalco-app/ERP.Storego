'use client'

import { useEffect, useRef, useState } from 'react'

interface Props {
  desde: string // YYYY-MM-DD
  hasta: string
  onApply: (desde: string, hasta: string) => void
}

const DIAS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']
const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

function toISO(d: Date) { return d.toISOString().slice(0, 10) }
function parseISO(s: string) { const [y,m,d] = s.split('-').map(Number); return new Date(y, m - 1, d) }
function sameDay(a: Date, b: Date) { return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate() }
function fmtShort(s: string) { const d = parseISO(s); return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}` }

function monthGrid(year: number, month: number) {
  const first = new Date(year, month, 1)
  const startOffset = (first.getDay() + 6) % 7 // Monday = 0
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: (Date | null)[] = []
  for (let i = 0; i < startOffset; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d))
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

export default function DateRangeCalendar({ desde, hasta, onApply }: Props) {
  const [open, setOpen] = useState(false)
  const [start, setStart] = useState<Date | null>(parseISO(desde))
  const [end, setEnd] = useState<Date | null>(parseISO(hasta))
  const [picking, setPicking] = useState(false) // true after first click, waiting for second
  const [viewYear, setViewYear] = useState(() => parseISO(hasta).getFullYear())
  const [viewMonth, setViewMonth] = useState(() => parseISO(hasta).getMonth())
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  function openPicker() {
    setStart(parseISO(desde)); setEnd(parseISO(hasta)); setPicking(false)
    setViewYear(parseISO(hasta).getFullYear()); setViewMonth(parseISO(hasta).getMonth())
    setOpen(true)
  }

  function handleDayClick(day: Date) {
    if (!picking) {
      setStart(day); setEnd(day); setPicking(true)
    } else {
      if (day < start!) { setEnd(start); setStart(day) } else { setEnd(day) }
      setPicking(false)
    }
  }

  function shift(delta: number) {
    let m = viewMonth + delta, y = viewYear
    if (m < 0) { m = 11; y-- } else if (m > 11) { m = 0; y++ }
    setViewMonth(m); setViewYear(y)
  }

  function quick(days: number) {
    const h = new Date()
    const d = new Date(); d.setDate(d.getDate() - days + 1)
    setStart(d); setEnd(h); setPicking(false)
    setViewYear(h.getFullYear()); setViewMonth(h.getMonth())
  }

  function apply() {
    if (!start || !end) return
    onApply(toISO(start), toISO(end))
    setOpen(false)
  }

  const cellsCurrent = monthGrid(viewYear, viewMonth)
  const nextMonthDate = new Date(viewYear, viewMonth + 1, 1)
  const cellsNext = monthGrid(nextMonthDate.getFullYear(), nextMonthDate.getMonth())

  function renderMonth(cells: (Date | null)[], label: string) {
    return (
      <div className="drc-month">
        <div className="drc-month-lbl">{label}</div>
        <div className="drc-dow-row">{DIAS.map((d, i) => <span key={i}>{d}</span>)}</div>
        <div className="drc-grid">
          {cells.map((day, i) => {
            if (!day) return <span key={i} className="drc-cell drc-empty" />
            const isStart = start && sameDay(day, start)
            const isEnd = end && sameDay(day, end)
            const inRange = start && end && day > start && day < end
            const isToday = sameDay(day, new Date())
            return (
              <button
                key={i}
                className={`drc-cell${isStart || isEnd ? ' drc-selected' : ''}${inRange ? ' drc-inrange' : ''}${isToday ? ' drc-today' : ''}`}
                onClick={() => handleDayClick(day)}
                type="button"
              >
                {day.getDate()}
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="drc-wrap" ref={wrapRef}>
      <style>{`
        .drc-wrap{position:relative}
        .drc-trigger{display:flex;align-items:center;gap:8px;padding:8px 14px;border:1.5px solid rgba(0,0,0,0.08);border-radius:14px;background:rgba(0,0,0,0.03);font-size:12.5px;font-weight:700;color:#0A0A0E;cursor:pointer;font-family:inherit;white-space:nowrap}
        .drc-trigger:hover{border-color:#2563EB}
        .drc-pop{position:absolute;top:calc(100% + 8px);left:0;z-index:50;background:#ECEEF2;border-radius:20px;box-shadow:0 12px 32px rgba(0,0,0,0.18);padding:16px;display:flex;flex-direction:column;gap:12px;width:min(560px,92vw)}
        .drc-quick-row{display:flex;gap:6px;flex-wrap:wrap}
        .drc-quick{padding:6px 12px;border-radius:50px;border:1.5px solid rgba(0,0,0,0.08);background:transparent;font-size:11.5px;font-weight:700;color:rgba(10,10,14,0.55);cursor:pointer;font-family:inherit}
        .drc-quick:hover{border-color:#2563EB;color:#2563EB}
        .drc-nav{display:flex;align-items:center;justify-content:space-between}
        .drc-nav-btn{width:28px;height:28px;border-radius:8px;border:none;background:rgba(0,0,0,0.05);cursor:pointer;display:flex;align-items:center;justify-content:center;color:rgba(10,10,14,0.55)}
        .drc-nav-btn:hover{background:rgba(0,0,0,0.10)}
        .drc-months{display:flex;gap:20px}
        @media(max-width:600px){.drc-months{flex-direction:column;gap:8px}}
        .drc-month{flex:1;min-width:0}
        .drc-month-lbl{font-size:12px;font-weight:800;color:#0A0A0E;text-align:center;margin-bottom:8px;text-transform:capitalize}
        .drc-dow-row{display:grid;grid-template-columns:repeat(7,1fr);margin-bottom:4px}
        .drc-dow-row span{text-align:center;font-size:10px;font-weight:700;color:rgba(10,10,14,0.35)}
        .drc-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:2px}
        .drc-cell{aspect-ratio:1;border:none;background:transparent;border-radius:8px;font-size:12px;font-weight:600;color:#0A0A0E;cursor:pointer;font-family:inherit;display:flex;align-items:center;justify-content:center}
        .drc-cell:hover:not(.drc-empty){background:rgba(37,99,235,0.10)}
        .drc-empty{cursor:default;pointer-events:none}
        .drc-selected{background:#2563EB!important;color:white!important;font-weight:800}
        .drc-inrange{background:rgba(37,99,235,0.12)}
        .drc-today:not(.drc-selected){box-shadow:inset 0 0 0 1.5px rgba(37,99,235,0.4)}
        .drc-footer{display:flex;align-items:center;justify-content:space-between;padding-top:8px;border-top:1px solid rgba(0,0,0,0.07)}
        .drc-range-lbl{font-size:12px;font-weight:700;color:rgba(10,10,14,0.55)}
        .drc-apply{padding:8px 20px;border-radius:50px;border:none;background:linear-gradient(145deg,#1D4ED8,#2563EB);color:white;font-size:12.5px;font-weight:700;cursor:pointer;font-family:inherit}
        .drc-apply:disabled{opacity:.4;cursor:not-allowed}
      `}</style>

      <button className="drc-trigger" onClick={openPicker} type="button">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
        {fmtShort(desde)} — {fmtShort(hasta)}
      </button>

      {open && (
        <div className="drc-pop">
          <div className="drc-quick-row">
            <button className="drc-quick" onClick={() => quick(1)}>Hoy</button>
            <button className="drc-quick" onClick={() => quick(7)}>Últimos 7 días</button>
            <button className="drc-quick" onClick={() => quick(30)}>Últimos 30 días</button>
            <button className="drc-quick" onClick={() => { const d = new Date(); setStart(new Date(d.getFullYear(), d.getMonth(), 1)); setEnd(d); setPicking(false) }}>Este mes</button>
            <button className="drc-quick" onClick={() => { const d = new Date(); setStart(new Date(d.getFullYear(), 0, 1)); setEnd(d); setPicking(false) }}>Este año</button>
          </div>

          <div className="drc-nav">
            <button className="drc-nav-btn" onClick={() => shift(-1)} type="button">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            <span style={{fontSize:11,fontWeight:600,color:'rgba(10,10,14,0.4)'}}>
              {picking ? 'Elige la fecha final' : 'Elige la fecha inicial'}
            </span>
            <button className="drc-nav-btn" onClick={() => shift(1)} type="button">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          </div>

          <div className="drc-months">
            {renderMonth(cellsCurrent, `${MESES[viewMonth]} ${viewYear}`)}
            {renderMonth(cellsNext, `${MESES[nextMonthDate.getMonth()]} ${nextMonthDate.getFullYear()}`)}
          </div>

          <div className="drc-footer">
            <span className="drc-range-lbl">
              {start && end ? `${fmtShort(toISO(start))} — ${fmtShort(toISO(end))}` : 'Sin rango seleccionado'}
            </span>
            <button className="drc-apply" onClick={apply} disabled={!start || !end}>Aplicar</button>
          </div>
        </div>
      )}
    </div>
  )
}
