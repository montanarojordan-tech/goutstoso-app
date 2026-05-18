import * as React from "react";

// ── ICÔNES ─────────────────────────────────────────────────────
export const Ic = ({n,s=16}:{n:string,s?:number}) => {
const d: Record<string,string> = {
dash:"M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z",
prod:"M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-14L4 7m8 4v10M4 7v10l8 4",
stock:"M9 17H7A5 5 0 0 1 7 7h2M15 7h2a5 5 0 0 1 0 10h-2M8 12h8",
depot:"M3 9l9-6 9 6v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z",
contrat:"M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8",
facture:"M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 1 1 0 4H9a2 2 0 0 1-2-2",
compta:"M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6",
plus:"M12 5v14M5 12h14",
x:"M18 6 6 18M6 6l12 12",
check:"M20 6 9 17l-5-5",
edit:"M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4z",
trash:"M3 6h18M8 6V4h8v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6",
export:"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3",
eye:"M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z",
warn:"M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01",
coin:"M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2zM12 6v2M12 16v2M8 12h8",
more:"M12 5v.01M12 12v.01M12 19v.01",
settings:"M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z",
"log-out":"M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9",
};
return (
<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
<path d={d[n]||d.dash}/>
</svg>
);
};

// ── BADGE ──────────────────────────────────────────────────────
export const Badge = ({c="gray",children}:{c?:string,children:React.ReactNode}) => {
const styles: Record<string,React.CSSProperties> = {
green:{background:"#F0FDF4",color:"#15803D",border:"1px solid #BBF7D0"},
red:{background:"#FEF2F2",color:"#B91C1C",border:"1px solid #FECACA"},
yellow:{background:"#FDF6E3",color:"#9A3412",border:"1px solid #FCD34D"},
blue:{background:"#EFF6FF",color:"#1E40AF",border:"1px solid #BFDBFE"},
gray:{background:"#F4F4F2",color:"#525252",border:"1px solid #EAE7E0"},
};
const s = styles[c]||styles.gray;
return <span style={{display:"inline-flex",alignItems:"center",gap:4,padding:"3px 9px",borderRadius:6,fontSize:10,fontWeight:500,letterSpacing:"-0.005em",textTransform:"lowercase",...s}}>{children}</span>;
};

// ── MODAL ──────────────────────────────────────────────────────
export const Modal = ({title,onClose,children}:{title:string,onClose:()=>void,children:React.ReactNode}) => {
return (
<div style={{position:"fixed",top:0,left:0,width:"100vw",height:"100vh",zIndex:9999,background:"#FDFBF5",display:"flex",flexDirection:"column"}}>
<div style={{background:"#fff",borderBottom:"1.5px solid #E5E5E0",padding:"12px 16px",display:"flex",alignItems:"center",gap:12,flexShrink:0}}>
<button onClick={onClose} style={{background:"#F5F5F0",border:"none",borderRadius:10,padding:"8px 14px",fontSize:14,fontWeight:600,color:"#111",cursor:"pointer"}}>← Retour</button>
<span style={{fontFamily:"'Cormorant Garamond',serif",fontSize:18,fontWeight:700,color:"#111"}}>{title}</span>
</div>
<div style={{flex:1,overflowY:"auto",padding:"16px 16px 100px",WebkitOverflowScrolling:"touch" as any}}>
{children}
</div>
</div>
);
};

// ── FIELD ──────────────────────────────────────────────────────
export const F = ({label,type="text",value,onChange,placeholder,required,small}:{label?:string,type?:string,value:any,onChange:(v:any)=>void,placeholder?:string,required?:boolean,small?:boolean}) => (
  <div style={{display:"flex",flexDirection:"column",gap:4}}>
    {label && <label style={{fontSize:11,fontWeight:600,color:"#9CA3AF",textTransform:"uppercase",letterSpacing:".06em"}}>{label}{required&&" *"}</label>}
    <input
      type={type==="number"?"text":type}
      inputMode={type==="number"?"decimal":undefined}
      value={value}
      onChange={e=>{
        if(type==="number") {
          const v = e.target.value.replace(",",".");
          if(v===""||/^-?\d*\.?\d*$/.test(v)) onChange(v);
        } else {
          onChange(e.target.value);
        }
      }}
      placeholder={placeholder} style={small?{padding:"7px 10px",fontSize:13}:{}}/>
  </div>
);

export const Sel = ({label,value,onChange,options,required}:{label?:string,value:any,onChange:(v:string)=>void,options:{v:any,l:string}[],required?:boolean}) => (
  <div style={{display:"flex",flexDirection:"column",gap:4}}>
    {label && <label style={{fontSize:11,fontWeight:600,color:"#9CA3AF",textTransform:"uppercase",letterSpacing:".06em"}}>{label}{required&&" *"}</label>}
    <select value={value} onChange={e=>onChange(e.target.value)}>
      {options.map(o=><option key={o.v} value={o.v}>{o.l}</option>)}
    </select>
  </div>
);

// ── BTN ────────────────────────────────────────────────────────
export const Btn = ({onClick,children,variant="primary",small,icon,danger,full}:{onClick?:()=>void,children?:React.ReactNode,variant?:string,small?:boolean,icon?:string,danger?:boolean,full?:boolean}) => {
const bg = danger?"#FEF2F2":variant==="primary"?"#0A0A0A":variant==="ghost"?"#F4F4F2":variant==="outline"?"transparent":"transparent";
const col = danger?"#B91C1C":variant==="primary"?"#FAFAF7":"#0A0A0A";
const border = variant==="outline"?"1px solid #EAE7E0":"none";
return (
<button onClick={onClick} style={{background:bg,color:col,border,borderRadius:10,padding:small?"7px 14px":"11px 18px",fontSize:small?12:13,fontWeight:500,display:"flex",alignItems:"center",gap:6,width:full?"100%":"auto",justifyContent:"center",transition:"all .15s"}}>
{icon && <Ic n={icon} s={small?13:15}/>}
{children}
</button>
);
};

// ── CARD ───────────────────────────────────────────────────────
export const Card = ({children,style,onClick}:{children:React.ReactNode,style?:React.CSSProperties,onClick?:()=>void}) => (
  <div onClick={onClick} style={Object.assign({background:"#fff",borderRadius:12,border:"1px solid #EAE7E0",padding:"12px"},style||{})}>{children}</div>
);

// ── SECTION TITLE ──────────────────────────────────────────────
export const SectionTitle = ({children,action}:{children:React.ReactNode,action?:React.ReactNode}) => (
  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12,gap:8,flexWrap:"wrap"}}>
    <h2 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:20,fontWeight:700,color:"#111",flexShrink:0}}>{children}</h2>
    {action && <div style={{display:"flex",gap:6,alignItems:"center",flexShrink:0,flexWrap:"wrap"}}>{action}</div>}
  </div>
);

// ── HELPER RAPPELS ──────────────────────────────────────────────
export const getProchainRappelFn = (f: any) => {
  if(f.statut==="payée") return null;
  const now = new Date();
  const echeance = new Date(new Date(f.date).getTime()+30*86400000);
  if(now < echeance) return null;
  const rappels = f.rappels||[];
  if(rappels.length===0) return {degree:1,frais:0,available:true,daysLeft:0};
  const last = rappels[rappels.length-1];
  if(last.degree>=3) return {degree:null,available:false};
  const daysSince = Math.floor((now.getTime()-new Date(last.date).getTime())/86400000);
  const nextDeg = last.degree+1;
  const nextFrais = nextDeg===2?15:25;
  if(daysSince>=10) return {degree:nextDeg,frais:nextFrais,available:true,daysLeft:0};
  return {degree:nextDeg,frais:nextFrais,available:false,daysLeft:10-daysSince};
};
