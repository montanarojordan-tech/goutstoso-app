---
name: Goutstoso lots stay decoupled from sales
description: Auto-linking lot FIFO consumption to sale flows was tried and reverted; historical context for future work
---

The lot traceability feature (`gs_lots`/`gs_mouvements_stock`, the Lots page, manual lot creation/consumption from that page) is standalone and intentionally decoupled from the general stock counter (`st.stocks`) used by the normal sale/order flows (commandes, livraisons, dépôt-vente, achat ferme).

**Why:** an attempt was made to auto-consume lots FIFO whenever a sale finalized (to track "which lot went to which client"), wired into `saveLivraison`, `save`, `creerCommandeAchat`, and reversed in `supprimer`. The user reviewed this and explicitly asked to revert it ("reviens comme avant que avec le stock") while keeping the underlying lots/traceability feature intact. The reasoning for reverting wasn't stated, so treat this as a deliberate product decision, not a bug.

**How to apply:** do not re-add automatic lot consumption tied to sale flows without asking the user first. Lot quantities and movements should only change via explicit manual actions on the Lots page (`create_lot`, `consume_lot`, `restock_lot`, `update_lot`). Backend actions `consume_lot_fifo` / `restock_lot_fifo_by_reference` were removed — if similar functionality is requested again, confirm scope with the user before reintroducing it.
