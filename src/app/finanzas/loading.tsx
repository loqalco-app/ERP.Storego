import Sidebar from '@/components/Sidebar'

export default function Loading() {
  return (
    <>
      <Sidebar active="finanzas" />
      <style>{`
        @keyframes sk-shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}
        .sk{border-radius:12px;background:linear-gradient(90deg,rgba(0,0,0,0.06) 25%,rgba(0,0,0,0.10) 50%,rgba(0,0,0,0.06) 75%);background-size:200%;animation:sk-shimmer 1.4s infinite}
        .sk-page{padding:max(env(safe-area-inset-top,0px),16px) 20px calc(88px + env(safe-area-inset-bottom,0px) + 16px)}
        .sk-title{height:28px;width:140px;margin-bottom:20px}
        .sk-chips{display:flex;gap:8px;margin-bottom:20px;overflow:hidden}
        .sk-chip{height:32px;border-radius:50px;flex-shrink:0}
        .sk-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px}
        .sk-kpi{height:100px;border-radius:20px}
        .sk-section{height:16px;width:100px;border-radius:8px;margin-bottom:12px}
        .sk-list{border-radius:20px;overflow:hidden}
        .sk-item{height:56px;margin-bottom:1px}
      `}</style>
      <div className="sk-page">
        <div className="sk sk-title" />
        <div className="sk-chips">
          {[60,70,70,60].map((w,i) => <div key={i} className="sk sk-chip" style={{width:w}} />)}
        </div>
        <div className="sk-grid">
          {[1,2,3,4,5,6].map(i => <div key={i} className="sk sk-kpi" />)}
        </div>
        <div className="sk sk-section" />
        <div className="sk-list">
          {[1,2,3,4,5].map(i => <div key={i} className="sk sk-item" />)}
        </div>
      </div>
    </>
  )
}
