import Sidebar from '@/components/Sidebar'

export default function SettingsLoading() {
  return (
    <>
      <Sidebar active="settings" />
      <style>{`
        @keyframes shimmer{0%{background-position:-400px 0}100%{background-position:400px 0}}
        .sk{background:linear-gradient(90deg,rgba(0,0,0,0.06) 25%,rgba(0,0,0,0.03) 50%,rgba(0,0,0,0.06) 75%);background-size:800px 100%;animation:shimmer 1.4s infinite linear;border-radius:12px}
      `}</style>
      <div style={{padding:'max(env(safe-area-inset-top,0px),20px) 20px calc(var(--nav-h,88px) + 24px)',maxWidth:640,margin:'0 auto'}}>
        <div className="sk" style={{width:120,height:14,marginBottom:8}} />
        <div className="sk" style={{width:200,height:28,marginBottom:32}} />
        {[160,100,120].map((w,i) => (
          <div key={i} style={{marginBottom:24}}>
            <div className="sk" style={{width:w,height:12,marginBottom:12}} />
            <div className="sk" style={{height:54,borderRadius:16,marginBottom:10}} />
            <div className="sk" style={{height:54,borderRadius:16}} />
          </div>
        ))}
      </div>
    </>
  )
}
