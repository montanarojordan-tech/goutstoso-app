export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2);
export const chf = (v: any) => `CHF ${parseFloat(v||0).toFixed(2)}`;
export const fmt = (d: any) => d ? new Date(d).toLocaleDateString("fr-CH") : "-";
export const today = () => new Date().toISOString().slice(0,10);
export const sum = (arr: number[]) => arr.reduce((a,b)=>a+b,0);
export const genLot = (date?: string) => {
  const d = date ? new Date(date) : new Date();
  const dd = String(d.getDate()).padStart(2,"0");
  const mm = String(d.getMonth()+1).padStart(2,"0");
  const yyyy = d.getFullYear();
  return `${dd}-${mm}.${yyyy}`;
};

export const exportCSV = (rows: any[], filename: string) => {
  const headers = Object.keys(rows[0]||{}).join(";");
  const body = rows.map(r=>Object.values(r).map(v=>`"${String(v||"").replace(/"/g,'""')}"`).join(";")).join("\n");
  const blob = new Blob(["\uFEFF"+headers+"\n"+body],{type:"text/csv;charset=utf-8;"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
};
