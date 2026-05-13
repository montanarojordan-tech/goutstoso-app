import { useEffect, useRef, useState } from "react";
import { useParams } from "wouter";

const API_BASE = "/api";

type SigningRequest = {
  token: string;
  documentType: string;
  documentTitle: string;
  documentData: Record<string, any>;
  status: string;
  signerName: string | null;
  signedAt: string | null;
  expiresAt: string;
};

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("fr-CH", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function DocumentPreview({ req }: { req: SigningRequest }) {
  const d = req.documentData;
  const type = req.documentType;
  const isProspection = type === "prospection";

  const rows: [string, string][] = [];

  if (type === "offre") {
    if (d.numero) rows.push(["Numéro", d.numero]);
    if (d.date) rows.push(["Date", formatDate(d.date)]);
    if (d.dateValidite) rows.push(["Valable jusqu'au", formatDate(d.dateValidite)]);
    if (d.clientNom) rows.push(["Client", d.clientNom]);
    if (d.clientAdresse) rows.push(["Adresse", d.clientAdresse]);
    if (d.clientNpa || d.clientVille) rows.push(["NPA / Ville", [d.clientNpa, d.clientVille].filter(Boolean).join(" ")]);
    if (d.statut) rows.push(["Statut", d.statut]);
  } else if (type === "facture") {
    if (d.numero) rows.push(["Numéro", d.numero]);
    if (d.date) rows.push(["Date", formatDate(d.date)]);
    if (d.dateEcheance) rows.push(["Échéance", formatDate(d.dateEcheance)]);
    if (d.clientNom) rows.push(["Client", d.clientNom]);
    if (d.montantTotal !== undefined) rows.push(["Montant total", `CHF ${Number(d.montantTotal).toFixed(2)}`]);
    if (d.statut) rows.push(["Statut", d.statut]);
  } else if (type === "contrat") {
    if (d.numero) rows.push(["Numéro", d.numero]);
    if (d.date) rows.push(["Date", formatDate(d.date)]);
    if (d.partenaireNom || d.clientNom) rows.push(["Partenaire", d.partenaireNom || d.clientNom]);
    if (d.type) rows.push(["Type", d.type]);
    if (d.statut) rows.push(["Statut", d.statut]);
  } else if (type === "prospection") {
    if (d.clientNom) rows.push(["Établissement", d.clientNom]);
    if (d.clientContact) rows.push(["Contact", d.clientContact]);
    if (d.clientEmail || d.email) rows.push(["Email", d.clientEmail || d.email]);
    if (d.clientTel) rows.push(["Téléphone", d.clientTel]);
    if (d.clientAdresse) rows.push(["Adresse", d.clientAdresse]);
    if (d.date) rows.push(["Date", formatDate(d.date)]);
  } else {
    Object.entries(d).forEach(([k, v]) => {
      if (typeof v === "string" || typeof v === "number") {
        rows.push([k, String(v)]);
      }
    });
  }

  const rawItems: any[] = d.items || d.lignes || d.produits || [];
  const items = rawItems
    .map((item: any) => ({
      designation: item.designation || item.nom || item.produitId || "",
      quantite: item.quantite || item.qte || 0,
      prixUnitaire: item.prixUnitaire || item.prix || 0,
    }))
    .filter(item => item.designation && (isProspection ? item.prixUnitaire > 0 : item.quantite > 0));

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="bg-[#0a0a0a] px-6 py-4 flex items-center justify-between">
        <div>
          <p className="text-[#f2c94c] font-bold text-lg tracking-wide">GOÛTSTOSO</p>
          <p className="text-gray-400 text-xs">Liqueurs artisanales · Jordan Montanaro</p>
        </div>
        <div className="text-right">
          <p className="text-[#f2c94c] text-xs font-semibold uppercase tracking-wider">{req.documentType}</p>
          <p className="text-white font-bold">{d.numero || req.documentTitle}</p>
        </div>
      </div>

      <div className="p-6 space-y-3">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between items-start gap-4 text-sm">
            <span className="text-gray-500 shrink-0">{label}</span>
            <span className="text-gray-900 font-medium text-right">{value}</span>
          </div>
        ))}

        {items.length > 0 && (
          <div className="mt-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              {isProspection ? "Tarifs partenaires (hors TVA)" : "Articles"}
            </p>
            <div className="rounded-xl overflow-hidden border border-gray-100">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-3 py-2 text-gray-500 font-medium">Désignation</th>
                    {!isProspection && <th className="text-center px-3 py-2 text-gray-500 font-medium">Qté</th>}
                    <th className="text-right px-3 py-2 text-gray-500 font-medium">
                      {isProspection ? "Prix / unité CHF" : "Total CHF"}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, i) => (
                    <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}>
                      <td className="px-3 py-2 text-gray-800">{item.designation}</td>
                      {!isProspection && <td className="px-3 py-2 text-center text-gray-600">{item.quantite}</td>}
                      <td className="px-3 py-2 text-right text-gray-800 font-medium">
                        {isProspection
                          ? Number(item.prixUnitaire || 0).toFixed(2)
                          : ((item.quantite || 0) * (item.prixUnitaire || 0)).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {isProspection && (
              <p className="text-xs text-gray-400 mt-2 text-right">
                * Prix indicatifs partenaire — commande à envoyer par e-mail
              </p>
            )}
          </div>
        )}

        {d.totalHT !== undefined && (
          <div className="pt-3 border-t border-gray-100 flex justify-between font-bold text-gray-900">
            <span>Total HT</span>
            <span>CHF {Number(d.totalHT).toFixed(2)}</span>
          </div>
        )}
        {d.totalPrix !== undefined && !d.totalHT && (
          <div className="pt-3 border-t border-gray-100 flex justify-between font-bold text-gray-900">
            <span>Total partenaire (hors TVA)</span>
            <span>CHF {Number(d.totalPrix).toFixed(2)}</span>
          </div>
        )}
        {d.montantTotal !== undefined && !d.totalPrix && !d.totalHT && (
          <div className="pt-3 border-t border-gray-100 flex justify-between font-bold text-gray-900">
            <span>Montant total</span>
            <span>CHF {Number(d.montantTotal).toFixed(2)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function SignatureCanvas({ onSign }: { onSign: (dataUrl: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [hasDrawn, setHasDrawn] = useState(false);

  function getPos(e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ("touches" in e) {
      const t = e.touches[0];
      return { x: (t.clientX - rect.left) * scaleX, y: (t.clientY - rect.top) * scaleY };
    }
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  }

  function start(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    drawing.current = true;
    const ctx = canvas.getContext("2d")!;
    const pos = getPos(e, canvas);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  }

  function move(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault();
    if (!drawing.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#0a0a0a";
    const pos = getPos(e, canvas);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    setHasDrawn(true);
  }

  function end(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault();
    drawing.current = false;
  }

  function clear() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  }

  function confirm() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    onSign(canvas.toDataURL("image/png"));
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-600">Signez ci-dessous avec votre doigt ou la souris :</p>
      <div className="border-2 border-dashed border-gray-200 rounded-xl bg-gray-50/50 overflow-hidden" style={{ touchAction: "none" }}>
        <canvas
          ref={canvasRef}
          width={600}
          height={180}
          className="w-full cursor-crosshair"
          onMouseDown={start}
          onMouseMove={move}
          onMouseUp={end}
          onMouseLeave={end}
          onTouchStart={start}
          onTouchMove={move}
          onTouchEnd={end}
        />
      </div>
      <div className="flex gap-2">
        <button
          onClick={clear}
          className="flex-1 py-2 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
        >
          Effacer
        </button>
        <button
          onClick={confirm}
          disabled={!hasDrawn}
          className="flex-2 py-2 px-6 text-sm font-semibold bg-[#f2c94c] text-[#0a0a0a] rounded-xl hover:bg-[#e8bf40] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Valider ma signature
        </button>
      </div>
    </div>
  );
}

export default function SignPage() {
  const params = useParams<{ token: string }>();
  const token = params.token;

  const [req, setReq] = useState<SigningRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [signerName, setSignerName] = useState("");
  const [step, setStep] = useState<"view" | "sign" | "done">("view");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) return;
    fetch(`${API_BASE}/sign/${token}`)
      .then(r => {
        if (!r.ok) throw new Error(r.status === 404 ? "Ce lien est invalide ou a expiré." : "Erreur serveur.");
        return r.json();
      })
      .then(data => { setReq(data); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [token]);

  async function handleSign(signatureData: string) {
    if (!signerName.trim()) return;
    setSubmitting(true);
    try {
      const r = await fetch(`${API_BASE}/sign/${token}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signerName: signerName.trim(), signatureData }),
      });
      if (!r.ok) throw new Error("Erreur lors de la soumission.");
      const data = await r.json();
      setReq(data);
      setStep("done");
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center space-y-2">
          <div className="w-8 h-8 border-2 border-[#f2c94c] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-gray-500 text-sm">Chargement du document…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-red-100 p-8 text-center">
          <div className="text-4xl mb-3">⚠️</div>
          <p className="text-gray-800 font-semibold">{error}</p>
          <p className="text-gray-500 text-sm mt-2">Contactez Goûtstoso pour obtenir un nouveau lien.</p>
        </div>
      </div>
    );
  }

  if (!req) return null;

  if (req.status === "signed" || step === "done") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-green-100 p-8 text-center">
          <div className="text-5xl mb-4">✅</div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">
            {req.documentType === "prospection" ? "Intérêt confirmé !" : "Document signé"}
          </h1>
          <p className="text-gray-600 text-sm">
            <strong>{req.signerName}</strong>{" "}
            {req.documentType === "prospection"
              ? "a confirmé son intérêt pour la gamme Goûtstoso"
              : "a signé ce document"}
            {req.signedAt && ` le ${formatDate(req.signedAt)}`}.
          </p>
          {req.documentType === "prospection" && (
            <p className="text-gray-500 text-sm mt-3">
              Pour passer votre commande, répondez simplement à l'e-mail reçu.
            </p>
          )}
          <p className="text-gray-400 text-xs mt-4">Goûtstoso a été notifié. Merci !</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-lg mx-auto px-4 py-8 space-y-6">
        <div className="text-center space-y-1">
          <p className="text-xs text-gray-400 uppercase tracking-widest">
            {req.documentType === "prospection" ? "Offre de prospection · Tarifs partenaires" : "Signature électronique"}
          </p>
          <h1 className="text-xl font-bold text-gray-900">{req.documentTitle}</h1>
          <p className="text-xs text-gray-400">Valable jusqu'au {formatDate(req.expiresAt)}</p>
        </div>

        {req.documentType === "prospection" && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-5 py-4 text-sm text-blue-800 leading-relaxed">
            Vous trouverez ci-dessous notre offre de prospection avec nos tarifs partenaires.
            Si vous êtes d'accord avec ces prix, veuillez confirmer votre intérêt en bas de page.
            Pour passer commande, répondez simplement à l'e-mail reçu.
          </div>
        )}

        <DocumentPreview req={req} />

        {step === "view" && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
            <h2 className="font-semibold text-gray-900">
              {req.documentType === "prospection" ? "Confirmer votre intérêt" : "Votre identité"}
            </h2>
            <div>
              <label className="text-sm text-gray-600 block mb-1">Nom complet *</label>
              <input
                type="text"
                value={signerName}
                onChange={e => setSignerName(e.target.value)}
                placeholder="Prénom Nom"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#f2c94c] focus:ring-1 focus:ring-[#f2c94c] transition-colors"
              />
            </div>
            <button
              onClick={() => setStep("sign")}
              disabled={!signerName.trim()}
              className="w-full py-3 bg-[#0a0a0a] text-[#f2c94c] font-bold rounded-xl hover:bg-gray-900 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-sm"
            >
              {req.documentType === "prospection" ? "Continuer → Accepter ces prix" : "Continuer → Signer"}
            </button>
          </div>
        )}

        {step === "sign" && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">
                {req.documentType === "prospection" ? "Confirmation" : "Signature"}
              </h2>
              <button onClick={() => setStep("view")} className="text-xs text-gray-400 hover:text-gray-600">← Retour</button>
            </div>
            <p className="text-sm text-gray-600">
              {req.documentType === "prospection"
                ? <><strong>{signerName}</strong> confirme son intérêt pour la gamme Goûtstoso et accepte les tarifs partenaires présentés ci-dessus. La commande sera à envoyer par e-mail.</>
                : <>En signant, <strong>{signerName}</strong> confirme avoir lu et accepté le document ci-dessus.</>}
            </p>
            {submitting ? (
              <div className="text-center py-4">
                <div className="w-6 h-6 border-2 border-[#f2c94c] border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-sm text-gray-500 mt-2">Enregistrement…</p>
              </div>
            ) : (
              <SignatureCanvas onSign={handleSign} />
            )}
          </div>
        )}

        <p className="text-center text-xs text-gray-400">
          Goûtstoso · admin@goutstoso.ch · www.goutstoso.ch
        </p>
      </div>
    </div>
  );
}
