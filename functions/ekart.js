const { onCall, onRequest, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const crypto = require("crypto");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();
const FV = admin.firestore.FieldValue;

const CLIENT_ID = defineSecret("EKART_CLIENT_ID");
const EKART_USER = defineSecret("EKART_USERNAME");
const EKART_PASS = defineSecret("EKART_PASSWORD");
const WEBHOOK_SECRET = defineSecret("EKART_WEBHOOK_SECRET");
const API_SECRETS = [CLIENT_ID, EKART_USER, EKART_PASS];

const BASE = "https://app.elite.ekartlogistics.in";
const REGION = "asia-south1";

/* ====== INGA MAATHUNGA ====== */
const CFG = {
  sellerName: "AURA",
  sellerAddress: "2nd Floor, Digital Canara Bank, Virudhunagar, Tamil Nadu 626001",
  sellerGstTin: "",                 // GST irundha podunga. Create-la error vandha Ekart account manager-kitta kelunga
  pickupAlias: "",                  // kaali = Ekart-la register aana 1st address auto-va edukkum
  service: "SURFACE",               // SURFACE illa EXPRESS
  category: "Apparel",
  weightPerItem: 500,               // grams
  length: 30, width: 25, height: 5, // cm
  verifyWebhook: false              // first test-ku false
};

/* ---------- token (24h cache) ---------- */
let tokenCache = { value: null, exp: 0 };
async function getToken() {
  if (tokenCache.value && Date.now() < tokenCache.exp) return tokenCache.value;
  const r = await fetch(`${BASE}/integrations/v2/auth/token/${CLIENT_ID.value()}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: EKART_USER.value(), password: EKART_PASS.value() })
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || !d.access_token) {
    console.error("Ekart auth failed", r.status, JSON.stringify(d));
    throw new Error("Ekart auth failed (" + r.status + ")");
  }
  tokenCache = {
    value: `${d.token_type || "Bearer"} ${d.access_token}`,
    exp: Date.now() + Math.max(60, (Number(d.expires_in) || 3600) - 300) * 1000
  };
  return tokenCache.value;
}
async function ekart(method, path, body) {
  return fetch(BASE + path, {
    method,
    headers: { Authorization: await getToken(), "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined
  });
}

/* pickup / return address alias */
let aliasCache = null;
async function getAlias() {
  if (CFG.pickupAlias) return CFG.pickupAlias;
  if (aliasCache) return aliasCache;
  const r = await ekart("GET", "/api/v2/addresses");
  const d = await r.json().catch(() => []);
  if (!r.ok || !Array.isArray(d) || !d.length || !d[0].alias) {
    console.error("Ekart addresses", r.status, JSON.stringify(d));
    throw new HttpsError("failed-precondition", "Ekart-la pickup address illa. Account manager-kitta add panna sollunga, illa CFG.pickupAlias set pannunga");
  }
  aliasCache = d[0].alias;
  return aliasCache;
}

const ADMIN_EMAILS = ["auraclothing.vnr@gmail.com", "auravibezclothing@gmail.com"];

async function requireAdmin(req) {
  if (!req.auth) throw new HttpsError("unauthenticated", "Login pannunga");
  const email = String(req.auth.token.email || "").toLowerCase();
  if (!ADMIN_EMAILS.includes(email)) throw new HttpsError("permission-denied", "Admin mattum");
}

const digits = s => String(s || "").replace(/\D/g, "").slice(-10);
const tc = s => String(s || "").toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
const refOf = s => String(s || "").replace(/[^A-Za-z0-9-]/g, "");   // AURA#01 -> AURA01

/* ---------- AURA order -> Ekart payload ---------- */
function buildPayload(o, alias) {
  const items = Array.isArray(o.items) ? o.items : [];
  const a = o.address || {};
  const qty = items.reduce((s, i) => s + (Number(i.qty) || 1), 0) || 1;
  const total = Math.round(Number(o.total) || 0);
  const isCod = String(o.paymentMethod || "").toLowerCase() === "cod";
  const phone = digits(o.phone || a.phone);
  const pin = Number(String(a.pin || "").replace(/\D/g, ""));

  if (total < 1) throw new HttpsError("failed-precondition", "Order total sari illa");
  if (!isCod && o.paymentStatus !== "paid") throw new HttpsError("failed-precondition", "Payment verify aagala. Mudhalla 'Mark paid' pannunga");
  if (isCod && total > 49999) throw new HttpsError("failed-precondition", "COD amount 49,999-ku mela anuppa mudiyaadhu");
  if (phone.length < 10) throw new HttpsError("failed-precondition", "Customer phone sari illa");
  if (pin < 100000) throw new HttpsError("failed-precondition", "Order-la pincode illa");

  const name = a.name || o.customerName || "Customer";
  const street = [a.flat, a.area, a.landmark && "Landmark: " + a.landmark].filter(Boolean).join(", ");
  const desc = items.map(i => i.name + (i.size ? " (" + i.size + ")" : "")).join(", ").slice(0, 200) || "Clothing";

  return {
    seller_name: CFG.sellerName,
    seller_address: CFG.sellerAddress,
    seller_gst_tin: CFG.sellerGstTin,
    consignee_gst_amount: 0,
    order_number: refOf(o.orderId) || "AURA" + Date.now(),
    invoice_number: refOf(o.billNo || o.orderId) || "AURA" + Date.now(),
    invoice_date: new Date().toISOString().slice(0, 10),
    consignee_name: name,
    consignee_alternate_phone: phone,
    products_desc: desc,
    payment_mode: isCod ? "COD" : "Prepaid",
    category_of_goods: CFG.category,
    total_amount: total,
    tax_value: 0,
    taxable_amount: total,
    commodity_value: String(total),
    cod_amount: isCod ? total : 0,
    quantity: qty,
    weight: CFG.weightPerItem * qty,
    length: CFG.length, width: CFG.width, height: CFG.height,
    drop_location: {
      location_type: "Home", address: street, city: tc(a.city),
      state: tc(a.state), country: "India", name, phone: Number(phone), pin
    },
    pickup_location: { name: alias },
    return_location: { name: alias },
    service: CFG.service
  };
}

/* ---------- CREATE SHIPMENT (admin) ---------- */
exports.createEkartShipment = onCall({ region: REGION, secrets: API_SECRETS }, async req => {
  await requireAdmin(req);
  const ref = db.collection("orders").doc(String(req.data?.orderDocId || ""));
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError("not-found", "Order illa");
  const o = snap.data();
  if (o.trackingId) throw new HttpsError("already-exists", "Already created: " + o.trackingId);
  if (String(o.status || "").toLowerCase() === "cancelled") throw new HttpsError("failed-precondition", "Order cancelled");

  const alias = await getAlias();
  const r = await ekart("PUT", "/api/v1/package/create", buildPayload(o, alias));
  const d = await r.json().catch(() => ({}));
  if (!r.ok || !d.status) {
    console.error("Ekart create failed", r.status, JSON.stringify(d));
    throw new HttpsError("internal", d.remark || d.message || d.description || ("Ekart error " + r.status));
  }
  await ref.update({
    trackingId: d.tracking_id,
    trackingUrl: `${BASE}/track/${d.tracking_id}`,   // Ekart public tracking link
    courier: d.vendor || "Ekart",
    ekartBarcodes: d.barcodes || null,
    ekartCancelled: false,
    status: "shipped",
    shippedAt: FV.serverTimestamp(),
    updatedAt: FV.serverTimestamp()
  });
  return { trackingId: d.tracking_id, vendor: d.vendor || "Ekart" };
});

/* ---------- CANCEL SHIPMENT (admin) ---------- */
/* shipment mattum cancel aagum, order "pending"-ku thirumbum (order cancel panna admin dropdown use pannunga) */
exports.cancelEkartShipment = onCall({ region: REGION, secrets: API_SECRETS }, async req => {
  await requireAdmin(req);
  const ref = db.collection("orders").doc(String(req.data?.orderDocId || ""));
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError("not-found", "Order illa");
  const o = snap.data();
  if (!o.trackingId) throw new HttpsError("failed-precondition", "Shipment create aagala");
  const r = await ekart("DELETE", `/api/v1/package/cancel?tracking_id=${encodeURIComponent(o.trackingId)}`);
  if (!r.ok) {
    const t = await r.text().catch(() => "");
    console.error("Ekart cancel failed", r.status, t);
    throw new HttpsError("internal", "Ekart cancel failed (" + r.status + ")");
  }
  await ref.update({
    status: "pending",
    ekartCancelled: true,
    ekartCancelledId: o.trackingId,
    trackingId: FV.delete(),
    trackingUrl: FV.delete(),
    courier: FV.delete(),
    ekartStatus: FV.delete(),
    ekartDesc: FV.delete(),
    ekartLocation: FV.delete(),
    ekartHistory: FV.delete(),
    edd: FV.delete(),
    shippedAt: FV.delete(),
    updatedAt: FV.serverTimestamp()
  });
  return { ok: true };
});

/* ---------- LABEL PDF (admin) ---------- */
exports.getEkartLabel = onCall({ region: REGION, secrets: API_SECRETS }, async req => {
  await requireAdmin(req);
  const snap = await db.collection("orders").doc(String(req.data?.orderDocId || "")).get();
  if (!snap.exists || !snap.data().trackingId) throw new HttpsError("failed-precondition", "Shipment illa");
  const r = await ekart("POST", "/api/v1/package/label?json_only=false", { ids: [snap.data().trackingId] });
  if (!r.ok) throw new HttpsError("internal", "Label error " + r.status);
  return { pdf: Buffer.from(await r.arrayBuffer()).toString("base64") };
});

/* ---------- PINCODE CHECK (checkout-ku, public) ---------- */
exports.ekartPincode = onRequest({ region: REGION, cors: true, secrets: API_SECRETS }, async (req, res) => {
  const pin = String(req.query.pincode || "").replace(/\D/g, "");
  if (pin.length !== 6) return res.status(400).json({ ok: false, error: "Invalid pincode" });
  try {
    const r = await ekart("GET", `/api/v2/serviceability/${pin}`);
    const d = await r.json().catch(() => ({}));
    if (!r.ok) return res.status(502).json({ ok: false });
    const x = d.details || {};
    res.json({
      ok: true, serviceable: !!(d.status && x.forward_drop), cod: !!x.cod,
      maxCod: x.max_cod_amount || 0, city: x.city || "", state: x.state || ""
    });
  } catch (e) { console.error(e); res.status(500).json({ ok: false }); }
});

/* ---------- WEBHOOK (Ekart -> AURA tracking updates) ---------- */
exports.ekartWebhook = onRequest({ region: REGION, secrets: [WEBHOOK_SECRET] }, async (req, res) => {
  if (req.method !== "POST") return res.status(405).end();
  console.log("ekart webhook headers:", JSON.stringify(req.headers));  // signature header paaka, apram remove pannunga

  if (CFG.verifyWebhook) {
    const h = crypto.createHmac("sha256", WEBHOOK_SECRET.value()).update(req.rawBody);
    const hex = h.copy().digest("hex"), b64 = h.digest("base64");
    const ok = Object.values(req.headers).some(v => v === hex || v === b64 || v === "sha256=" + hex);
    if (!ok) return res.status(401).end();
  }

  try {
    const b = req.body || {};
    if (b.id && b.status) {
      const q = await db.collection("orders").where("trackingId", "==", String(b.id)).limit(1).get();
      if (!q.empty) {
        const st = String(b.status).trim();
        const upd = {
          ekartStatus: st, ekartDesc: b.desc || "", ekartLocation: b.location || "",
          ekartHistory: FV.arrayUnion({ status: st, desc: b.desc || "", location: b.location || "", at: Number(b.ctime) || Date.now() }),
          updatedAt: FV.serverTimestamp()
        };
        if (b.edd) upd.edd = Number(b.edd);
        if (st.toLowerCase() === "delivered") {
          upd.status = "delivered";
          upd.deliveredAt = FV.serverTimestamp();   // 7-day return timer inge irundhu start aagum
        }
        await q.docs[0].ref.update(upd);
      }
    }
  } catch (e) { console.error("webhook error", e); }
  res.status(200).send("ok");
});