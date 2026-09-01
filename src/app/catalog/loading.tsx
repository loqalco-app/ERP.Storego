import Sidebar from '@/components/Sidebar'

export default function Loading() {
  return (
    <>
      <Sidebar active="catalog" />
      <style>{`
        @keyframes sk-shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}
        .sk{border-radius:12px;background:linear-gradient(90deg,rgba(0,0,0,0.06) 25%,rgba(0,0,0,0.10) 50%,rgba(0,0,0,0.06) 75%);background-size:200%;animation:sk-shimmer 1.4s infinite}
        .sk-page{padding:max(env(safe-area-inset-top,0px),16px) 20px calc(88px + env(safe-area-inset-bottom,0px) + 16px)}
        .sk-topbar{display:flex;align-items:center;justify-content:space-between;margin-bottom:20px}
        .sk-title{height:28px;width:140px;border-radius:8px}
        .sk-btn{height:38px;width:90px;border-radius:50px}
        .sk-chips{display:flex;gap:8px;margin-bottom:16px;overflow:hidden}
        .sk-chip{height:32px;border-radius:50px;flex-shrink:0}
        .sk-list{border-radius:20px;overflow:hidden}
        .sk-row{height:68px;margin-bottom:1px}
      `}</style>
      <div className="sk-page">
        <div className="sk-topbar">
          <div className="sk sk-title" />
          <div className="sk sk-btn" />
        </div>
        <div className="sk-chips">
          {[60,80,70,60,80].map((w,i) => <div key={i} className="sk sk-chip" style={{width:w}} />)}
        </div>
        <div className="sk-list">
          {[1,2,3,4,5,6,7,8].map(i => <div key={i} className="sk sk-row" />)}
        </div>
      </div>
    </>
  )
}
