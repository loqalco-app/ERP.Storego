import Sidebar from '@/components/Sidebar'

export default function POSLoading() {
  return (
    <>
      <Sidebar active="pos" />
      <style>{`
        @keyframes shimmer{0%{background-position:-400px 0}100%{background-position:400px 0}}
        .sk{background:linear-gradient(90deg,rgba(0,0,0,0.06) 25%,rgba(0,0,0,0.03) 50%,rgba(0,0,0,0.06) 75%);background-size:800px 100%;animation:shimmer 1.4s infinite linear;border-radius:12px}
        .sk-r{border-radius:50%}
      `}</style>
      <div style={{minHeight:'100dvh',background:'var(--bg,#ECEEF2)',padding:'max(env(safe-area-inset-top,0px),32px) 24px calc(var(--nav-h,88px) + env(safe-area-inset-bottom,0px) + 24px)'}}>
        {/* Greeting */}
        <div className="sk" style={{width:80,height:12,marginBottom:10}} />
        <div className="sk" style={{width:200,height:30,marginBottom:8}} />
        <div className="sk" style={{width:140,height:14,marginBottom:40}} />
        {/* Two big cards */}
        <div style={{display:'flex',flexDirection:'column',gap:16}}>
          <div className="sk" style={{height:180,borderRadius:28}} />
          <div className="sk" style={{height:180,borderRadius:28,opacity:.6}} />
        </div>
      </div>
    </>
  )
}
