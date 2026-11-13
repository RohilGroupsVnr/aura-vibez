const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const Razorpay = require("razorpay");
const crypto = require("crypto");

const RAZORPAY_KEY_ID = defineSecret("RAZORPAY_KEY_ID");
const RAZORPAY_KEY_SECRET = defineSecret("RAZORPAY_KEY_SECRET");

const opts = {
  region: "asia-south1",
  cors: true,
  secrets: [RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET],
};

// Shipping charge in rupees (0 = free). checkout.js-la shipFee-oda match aaganum.
const SHIPPING = 0;

// product.html-oda same price rule: size price -> color price -> base price
function unitPrice(p, it) {
  const variants = p.variants || {};
  let v = it.color ? variants[it.color] : null;
  if (!it.color) {
    v = Object.values(variants).find(
      (x) => x && x.sizeStock && x.sizeStock[it.size] !== undefined
    ) || null;
  }
  const sizePrice = Number(
    (v && v.sizePrices && v.sizePrices[it.size]) ||
    (p.sizePrices && p.sizePrices[it.size]) ||
    0
  );
  if (sizePrice > 0) return sizePrice;

  const colorPrice = Number((v && v.price) || 0);
  if (colorPrice > 0) return colorPrice;

  return Number(p.price);
}

// 1) Create order (amount is calculated on the server from Firestore prices)
exports.createRazorpayOrder = onRequest(opts, async (req, res) => {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "POST only" });
    }

    const { items, customer } = req.body || {};
    if (!Array.isArray(items) || !items.length) {
      return res.status(400).json({ ok: false, error: "No items" });
    }

    const db = admin.firestore();
    let total = 0;

    for (const it of items) {
      const snap = await db.collection("products").doc(String(it.id)).get();
      if (!snap.exists) {
        return res.status(400).json({ ok: false, error: "Product not found: " + it.id });
      }

      const price = unitPrice(snap.data(), it);
      if (!Number.isFinite(price) || price <= 0) {
        return res.status(400).json({ ok: false, error: "Invalid price for " + it.id });
      }

      const qty = Math.min(20, Math.max(1, parseInt(it.qty, 10) || 1));
      total += price * qty;
    }

    total += SHIPPING;

    const rzp = new Razorpay({
      key_id: RAZORPAY_KEY_ID.value(),
      key_secret: RAZORPAY_KEY_SECRET.value(),
    });

    const order = await rzp.orders.create({
      amount: Math.round(total * 100), // paise
      currency: "INR",
      receipt: "aura_" + Date.now(),
      notes: { customer: JSON.stringify(customer || {}).slice(0, 200) },
    });

    return res.json({
      ok: true,
      keyId: RAZORPAY_KEY_ID.value(),
      rzpOrderId: order.id,
      amount: order.amount,
    });
  } catch (e) {
    console.error("createRazorpayOrder", e);
    const msg = (e && e.error && e.error.description) || e.message || "Server error";
    return res.status(500).json({ ok: false, error: msg });
  }
});

// 2) Verify payment signature
exports.verifyRazorpayPayment = onRequest(opts, async (req, res) => {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "POST only" });
    }

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body || {};
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ ok: false, error: "Missing fields" });
    }

    const expected = crypto
      .createHmac("sha256", RAZORPAY_KEY_SECRET.value())
      .update(razorpay_order_id + "|" + razorpay_payment_id)
      .digest("hex");

    const a = Buffer.from(expected);
    const b = Buffer.from(String(razorpay_signature));
    const valid = a.length === b.length && crypto.timingSafeEqual(a, b);

    return res.json({ ok: valid });
  } catch (e) {
    console.error("verifyRazorpayPayment", e);
    return res.status(500).json({ ok: false, error: e.message || "Server error" });
  }
});