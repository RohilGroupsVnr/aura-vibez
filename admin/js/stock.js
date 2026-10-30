import { db, doc, runTransaction, serverTimestamp } from "./firebase.js";

/* Cancel / reject aana order-oda stock-ah thirumba serkum. Oru order-ku onnu thaan (stockRestored flag). */
export async function restoreStock(order) {
  if (!order.stockReduced || order.stockRestored) return false;
  const orderRef = doc(db, "orders", order.id);
  const items = order.items || [];
  const ids = [...new Set(items.map(i => i.id).filter(Boolean))];

  return runTransaction(db, async tx => {
    const oSnap = await tx.get(orderRef);
    if (!oSnap.exists() || oSnap.data().stockRestored) return false;   // already done

    const pSnaps = await Promise.all(ids.map(id => tx.get(doc(db, "products", id))));
    pSnaps.forEach((snap, k) => {
      if (!snap.exists()) return;
      const p = snap.data();
      const variants = JSON.parse(JSON.stringify(p.variants || {}));
      let stock = Number(p.stock) || 0;

      items.filter(i => i.id === ids[k]).forEach(it => {
        const q = Number(it.qty) || 1, v = variants[it.color];
        if (v && v.sizeStock) v.sizeStock[it.size] = (Number(v.sizeStock[it.size]) || 0) + q;
        else stock += q;
      });

      const upd = { updatedAt: serverTimestamp() };
      if (Object.keys(variants).length) {
        const colorSold = {}, colorStock = {}; let total = 0;
        Object.entries(variants).forEach(([c, v]) => {
          const ss = v.sizeStock || {};
          v.stock = (v.sizes || []).reduce((a, s) => a + (Number(ss[s]) || 0), 0);
          v.soldSizes = (v.sizes || []).filter(s => (Number(ss[s]) || 0) <= 0);
          colorSold[c] = v.soldSizes; colorStock[c] = v.stock; total += v.stock;
        });
        Object.assign(upd, { variants, colorSold, colorStock, stock: total });
      } else upd.stock = stock;
      tx.update(doc(db, "products", ids[k]), upd);
    });
    tx.update(orderRef, { stockRestored: true });
    return true;
  });
}