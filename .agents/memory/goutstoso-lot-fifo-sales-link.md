---
name: Goutstoso lot FIFO auto-consumption on sales
description: How the lot traceability system is (and isn't) linked to sales/orders flows
---

Lots (`gs_lots`/`gs_mouvements_stock`) are auto-consumed FIFO (oldest `date_fabrication` first) whenever a sale finalizes, via a fire-and-forget call to `consume_lot_fifo` on the api-server. Wired into 4 flows: `saveLivraison` (dépôt-vente/livraison), `save` (ventes/commandes, including coffret sub-components), `creerCommandeAchat` (achat ferme from an offre), and reversed via `restock_lot_fifo_by_reference` in `supprimer` (delete commande).

**Why:** the user wants to know which lot went to which client going forward, without touching the existing general stock (`st.stocks`) accounting/order logic. `consume_lot_fifo` is additive and best-effort — if no lot exists for a product (or the call fails), it silently no-ops and never blocks the sale. `restock_lot_fifo_by_reference` is idempotent (checks for an existing `ajustement`/`canal_vente='annulation-auto'` movement before reversing) so double-cancellation can't over-restock.

**How to apply:** the general "Stock" page (`st.stocks`) and the lot system remain two independent counters — selling via the normal flow decrements both now, but they were NOT reconciled retroactively (historical sales before this session have no lot linkage). Manual ad-hoc stock adjustments (`annulerMouvement`, the générale régularisation tool) are intentionally NOT linked to lots — only the 4 formal sale/cancellation flows above call the FIFO endpoints. If a new sale-type flow is added later, it must call `autoConsumeLotFifo`/`autoRestockLotFifo` (helpers in `artifacts/goutstoso/app/index.tsx`) to stay consistent.
