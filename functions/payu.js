const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const crypto = require("crypto");

const PAYU_KEY = defineSecret("PAYU_KEY");
const PAYU_SALT = defineSecret("PAYU_SALT");
const opts = { region: "asia-south1", cors: true, secrets: [PAYU_KEY, PAYU_SALT] };

const PAYU_URL = "https://test.payu.in/_payment"; // LIVE: https://secure.payu.in/_payment
const CALLBACK_URL = "https://asia-south1-aura-8a9b5.cloudfunctions.net/payuCallback";
const SHIPPING = 0;
// customer thirumba varura site origins (live domain vandha idhula serkkanum)
const ALLOWED_ORIGINS = ["http://127.0.0.1:5758", "http://127.0.0.1:5501", "http://localhost:5758"];

const sha512 = (s) => crypto.createHash("sha512").update(s).digest("hex");
const clean = (s, n) => String(s || "").replace(/[^a-zA-Z0-9 ]/g, "").trim().slice(0, n);

function unitPrice(p, it) {
  const variants = p.variants || {};
  let v = it.color ? variants[it.color] : null;
  if (!it.color) {
    v = Object.values(variants).find((x) => x && x.sizeStock && x.sizeStock[it.size] !== undefined) || null;
  }
  const sizePrice = Number((v && v.sizePrices && v.sizePrices[it.size]) || (p.sizePrices && p.sizePrices[it.size]) || 0);
  if (sizePrice > 0) return sizePrice;
  const colorPrice = Number((v && v.price) || 0);
  if (colorPrice > 0) return colorPrice;
  return Number(p.price);
}

// 1) Hash + params (amount server-la calculate aagum)
exports.payuInit = onRequest(opts, async (req, res) => {
  try {
    if (req.method !== "POST") return res.status(405).json({ ok: false, error: "POST only" });
    const { items, customer, returnUrl } = req.body || {};
    if (!Array.isArray(items) || !items.length) return res.status(400).json({ ok: false, error: "No items" });

    let ru;
    try { ru = new URL(String(returnUrl)); } catch (e) { return res.status(400).json({ ok: false, error: "Bad returnUrl" }); }
    if (!ALLOWED_ORIGINS.includes(ru.origin)) return res.status(400).json({ ok: false, error: "Origin not allowed" });
    ru.hash = "";

    const db = admin.firestore();
    let total = 0;
    for (const it of items) {
      const snap = await db.collection("products").doc(String(it.id)).get();
      if (!snap.exists) return res.status(400).json({ ok: false, error: "Product not found: " + it.id });
      const price = unitPrice(snap.data(), it);
      if (!Number.isFinite(price) || price <= 0) return res.status(400).json({ ok: false, error: "Invalid price for " + it.id });
      total += price * Math.min(20, Math.max(1, parseInt(it.qty, 10) || 1));
    }
    total += SHIPPING;

    const c = customer || {};
    const txnid = "AURA" + Date.now() + crypto.randomBytes(3).toString("hex");
    const amount = total.toFixed(2);
    const productinfo = "AURA order";
    const firstname = clean(c.name, 60) || "Customer";
    const email = String(c.email || "").trim();
    const phone = String(c.phone || "").replace(/\D/g, "").slice(-10);

    const hash = sha512([PAYU_KEY.value(), txnid, amount, productinfo, firstname, email, ...Array(10).fill(""), PAYU_SALT.value()].join("|"));

    await db.collection("payuTxns").doc(txnid).set({
      amount, status: "initiated", returnUrl: ru.toString(),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return res.json({
      ok: true, action: PAYU_URL, amount,
      params: { key: PAYU_KEY.value(), txnid, amount, productinfo, firstname, email, phone, surl: CALLBACK_URL, furl: CALLBACK_URL, hash },
    });
  } catch (e) {
    console.error("payuInit", e);
    return res.status(500).json({ ok: false, error: e.message || "Server error" });
  }
});

// 2) PayU inga POST pannum. Hash verify panni, customer-a site-ku thirumbi anuppum
exports.payuCallback = onRequest(opts, async (req, res) => {
  const db = admin.firestore();
  let target = null, status = "failed", txnid = "";
  try {
    const b = req.body || {};
    txnid = String(b.txnid || "");
    const ref = db.collection("payuTxns").doc(txnid);
    const doc = await ref.get();
    if (!doc.exists) return res.status(400).send("Unknown transaction");
    const t = doc.data();
    target = t.returnUrl;

    const expected = sha512([PAYU_SALT.value(), b.status, ...Array(10).fill(""), b.email, b.firstname, b.productinfo, b.amount, b.txnid, b.key].join("|"));
    const hashOk = String(b.hash || "").toLowerCase() === expected;
    const amountOk = String(b.amount) === t.amount;

    if (hashOk && amountOk && b.status === "success") status = "success";
    await ref.update({ status, mihpayid: String(b.mihpayid || ""), mode: String(b.mode || "") });
  } catch (e) {
    console.error("payuCallback", e);
  }
  if (!target) return res.status(400).send("Payment result could not be read");
  const u = new URL(target);
  u.searchParams.set("payu", status);
  u.searchParams.set("txnid", txnid);
  return res.redirect(303, u.toString());
});

// 3) Site payment-a confirm panna (Firestore-la irukkura verified result)
exports.payuVerify = onRequest(opts, async (req, res) => {
  try {
    const txnid = String(req.query.txnid || "");
    const doc = await admin.firestore().collection("payuTxns").doc(txnid).get();
    if (!doc.exists) return res.json({ ok: false });
    const t = doc.data();
    return res.json({ ok: t.status === "success", amount: t.amount, mihpayid: t.mihpayid || "", mode: t.mode || "" });
  } catch (e) {
    console.error("payuVerify", e);
    return res.status(500).json({ ok: false });
  }
});