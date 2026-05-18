import { useState, useRef } from "react";
import * as React from "react";
import { Btn } from "./ui";

export const SignaturePad = ({onSave,onCancel}) => {
const canvasRef = useRef(null);
const [drawing,setDrawing] = useState(false);
const [hasSig,setHasSig] = useState(false);

const getPos = (e,canvas) => {
const r = canvas.getBoundingClientRect();
const src = e.touches?e.touches[0]:e;
return {x:(src.clientX-r.left)*(canvas.width/r.width),y:(src.clientY-r.top)*(canvas.height/r.height)};
};
const start = e => { e.preventDefault(); const c=canvasRef.current; const ctx=c.getContext("2d"); const p=getPos(e,c); ctx.beginPath(); ctx.moveTo(p.x,p.y); setDrawing(true); setHasSig(true); };
const draw = e => { e.preventDefault(); if(!drawing) return; const c=canvasRef.current; const ctx=c.getContext("2d"); ctx.strokeStyle="#111"; ctx.lineWidth=2.5; ctx.lineCap="round"; const p=getPos(e,c); ctx.lineTo(p.x,p.y); ctx.stroke(); };
const stop = e => { e.preventDefault(); setDrawing(false); };
const clear = () => { const c=canvasRef.current; c.getContext("2d").clearRect(0,0,c.width,c.height); setHasSig(false); };

return (
<div>
<p style={{fontSize:12,color:"#6B7280",marginBottom:8,textAlign:"center"}}>Signez dans le cadre ci-dessous</p>
<div style={{border:"2px solid #F2C94C",borderRadius:10,overflow:"hidden",background:"#fff",marginBottom:12}}>
<canvas ref={canvasRef} width={340} height={160} style={{width:"100%",height:160,touchAction:"none",display:"block"}}
onMouseDown={start} onMouseMove={draw} onMouseUp={stop}
onTouchStart={start} onTouchMove={draw} onTouchEnd={stop}/>
</div>
<div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
<Btn onClick={clear} variant="ghost" small>Effacer</Btn>
<Btn onClick={onCancel} variant="ghost" small>Annuler</Btn>
<Btn onClick={()=>hasSig&&onSave(canvasRef.current.toDataURL())} icon="check" small>Valider</Btn>
</div>
</div>
);
};
