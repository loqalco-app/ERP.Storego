import Sidebar from '@/components/Sidebar'

export default function Loading() {
  return (
    <>
      <Sidebar active="dashboard" />
      <style>{`
        @keyframes sk-shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}
        .sk{border-radius:12px;background:linear-gradient(90deg,rgba(0,0,0,0.06) 25%,rgba(0,0,0,0.10) 50%,rgba(0,0,0,0.06) 75%);background-size:200%;animation:sk-shimmer 1.4s infinite}
        .sk-page{padding:max(env(safe-area-inset-top,0px),16px) 20px calc(88px + env(safe-area-inset-bottom,0px) + 16px)}
        .sk-hero{height:140px;border-radius:28px;margin-bottom:16px}
        .sk-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px}
        .sk-card{height:90px;border-radius:20px}
        .sk-title{height:18px;width:120px;border-radius:8px;margin-bottom:12px}
        .sk-list{border-radius:20px;overflow:hidden}
        .sk-row{height:58px;margin-bottom:1px}
      `}</style>
      <div className="sk-page">
        <div className="sk sk-hero" />
        <div className="sk-grid">
          {[1,2,3,4].map(i => <div key={i} className="sk sk-card" />)}
        </div>
        <div className="sk sk-title" />
        <div className="sk-list">
          {[1,2,3,4,5].map(i => <div key={i} className="sk sk-row" />)}
        </div>
      </div>
    </>
  )
}
