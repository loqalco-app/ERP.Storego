import Sidebar from '@/components/Sidebar'

export default function Loading() {
  return (
    <>
      <Sidebar active="orders" />
      <style>{`
        @keyframes sk-shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}
        .sk{border-radius:12px;background:linear-gradient(90deg,rgba(0,0,0,0.06) 25%,rgba(0,0,0,0.10) 50%,rgba(0,0,0,0.06) 75%);background-size:200%;animation:sk-shimmer 1.4s infinite}
        .sk-page{padding:max(env(safe-area-inset-top,0px),16px) 20px calc(88px + env(safe-area-inset-bottom,0px) + 16px)}
        .sk-title{height:28px;width:140px;margin-bottom:20px}
        .sk-chip-row{display:flex;gap:8px;margin-bottom:16px;overflow:hidden}
        .sk-chip{height:32px;width:80px;border-radius:50px;flex-shrink:0}
        .sk-card{border-radius:24px;overflow:hidden;box-shadow:6px 6px 16px rgba(0,0,0,0.07),-4px -4px 12px rgba(255,255,255,0.9)}
        .sk-row{display:flex;align-items:center;gap:12px;padding:14px 18px;border-top:1px solid rgba(0,0,0,0.04)}
        .sk-row:first-child{border-top:none}
        .sk-badge{width:60px;height:36px;border-radius:8px}
        .sk-line-a{height:14px;flex:1;border-radius:8px}
        .sk-line-b{height:12px;width:80px;border-radius:8px}
        .sk-right{display:flex;flex-direction:column;align-items:flex-end;gap:6px;flex-shrink:0}
        .sk-amt{width:70px;height:16px;border-radius:8px}
        .sk-st{width:52px;height:12px;border-radius:8px}
      `}</style>
      <div className="sk-page">
        <div className="sk sk-title" />
        <div className="sk-chip-row">
          {[80,70,90,80,76,72].map((w,i) => <div key={i} className="sk sk-chip" style={{width:w}} />)}
        </div>
        <div className="sk-card" style={{background:'var(--bg,#ECEEF2)'}}>
          {[1,2,3,4,5,6,7].map(i => (
            <div key={i} className="sk-row">
              <div className="sk sk-badge" />
              <div style={{flex:1,display:'flex',flexDirection:'column',gap:6}}>
                <div className="sk sk-line-a" style={{maxWidth:180}} />
                <div className="sk sk-line-b" />
              </div>
              <div className="sk-right">
                <div className="sk sk-amt" />
                <div className="sk sk-st" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
