import { db, doc, getDoc, runTransaction } from "./firebase.js";

/* color + size stock edukkum */
function stockOf(p, color, size) {
  if (!p || String(p.status || "active").toLowerCase() === "draft") return 0;
  const v = p.variants && p.variants[color];
  if (v && v.sizeStock) return Number(v.sizeStock[size]) || 0;
  return Number(p.stock) || 0;
}

/* CART CHECK: stock illaathadha kandupidikkum */
export async function validateCart(cart) {
  const ids = [...new Set(cart.map(i => i.id))];
  const snaps = await Promise.all(ids.map(id => getDoc(doc(db, "products", id))));
  const map = {};
  snaps.forEach(s => { if (s.exists()) map[s.id] = s.data(); });
  return cart.map(it => {
    const avail = stockOf(map[it.id], it.color, it.size);
    return { ...it, avail, ok: avail >= (it.qty || 1) };
  });
}

/* ORDER: stock automatic-ah kuraikkum (transaction = 2 per ore neram order pannaalum safe) */
export async function reduceStock(items) {
  // same product different size irundha group pannrom
  const groups = {};
  items.forEach(it => (groups[it.id] = groups[it.id] || []).push(it));

  await runTransaction(db, async (tx) => {
    const entries = Object.entries(groups);
    const snaps = await Promise.all(entries.map(([id]) => tx.get(doc(db, "products", id))));

    entries.forEach(([id, list], i) => {
      const snap = snaps[i];
      if (!snap.exists()) throw new Error(`${list[0].name} is no longer available`);
      const p = snap.data();
      const variants = JSON.parse(JSON.stringify(p.variants || {}));
      let stock = Number(p.stock) || 0;

      list.forEach(it => {
        const qty = it.qty || 1;
        const v = variants[it.color];
        if (v && v.sizeStock) {
          const have = Number(v.sizeStock[it.size]) || 0;
          if (have < qty) throw new Error(`${it.name} (${it.color} / ${it.size}) – only ${have} left`);
          v.sizeStock[it.size] = have - qty;
        } else {
          if (stock < qty) throw new Error(`${it.name} is out of stock`);
          stock -= qty;
        }
      });

      const upd = {};
      if (Object.keys(variants).length) {
        const colorSold = {}, colorStock = {};
        let total = 0;
        Object.entries(variants).forEach(([c, v]) => {
          const ss = v.sizeStock || {};
          v.stock = (v.sizes || []).reduce((a, s) => a + (Number(ss[s]) || 0), 0);
          v.soldSizes = (v.sizes || []).filter(s => (Number(ss[s]) || 0) <= 0);
          colorSold[c] = v.soldSizes;
          colorStock[c] = v.stock;
          total += v.stock;
        });
        Object.assign(upd, { variants, colorSold, colorStock, stock: total });
      } else {
        upd.stock = stock;
      }
      tx.update(doc(db, "products", id), upd);
    });
  });
}