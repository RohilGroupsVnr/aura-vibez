const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

const WA_TOKEN = defineSecret("WA_ACCESS_TOKEN");
const WA_PHONE_ID = defineSecret("WA_PHONE_NUMBER_ID");

/* ====== INGA MAATHUNGA ====== */

// Meta-la create panni approve aana template peyar
const TEMPLATE = "recently_viewed_product";
const LANGUAGE = "en";

// Meta docs-la latest Graph API version check pannitu maathikkalaam
const GRAPH = "v21.0";

// true = users/{userId}.whatsappOptIn === true irundha mattum anuppum
const REQUIRE_OPT_IN = false;

// Product-ku public https image illa-na idhu use aagum (JPG / PNG, 5 MB-kulla)
const DEFAULT_IMAGE = "https://www.aura-vibez.com/assets/logo.png";

/* ============================ */

// Template parameter-la newline / tab / 4+ spaces irukka koodaadhu
const clean = (s, n) =>
  String(s || "").replace(/[\r\n\t]+/g, " ").replace(/ {2,}/g, " ").trim().slice(0, n);

const isHttps = u => /^https:\/\/[^\s]+$/i.test(String(u || ""));

exports.sendWhatsAppReminder = onCall(
  { region: "asia-south1", secrets: [WA_TOKEN, WA_PHONE_ID] },
  async req => {
    // Admin mattum
    if (!req.auth) throw new HttpsError("unauthenticated", "Login pannunga");
    const adminDoc = await db.collection("admins").doc(req.auth.uid).get();
    if (!adminDoc.exists) throw new HttpsError("permission-denied", "Admin mattum");

    const { phone, name, product, productId, viewerDocId, userId, imageUrl } = req.data || {};

    const to = String(phone || "").replace(/\D/g, "");
    if (!/^91[6-9]\d{9}$/.test(to)) {
      throw new HttpsError("invalid-argument", "Phone number sari illa");
    }

    if (!productId) {
      throw new HttpsError("invalid-argument", "productId illa");
    }

    if (REQUIRE_OPT_IN) {
      const u = userId ? await db.collection("users").doc(String(userId)).get() : null;
      if (!u || !u.exists || u.data().whatsappOptIn !== true) {
        throw new HttpsError("failed-precondition", "Customer WhatsApp opt-in kudukkala");
      }
    }

    const headerImage = isHttps(imageUrl) ? imageUrl : DEFAULT_IMAGE;

    const r = await fetch(
      `https://graph.facebook.com/${GRAPH}/${WA_PHONE_ID.value()}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${WA_TOKEN.value()}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to,
          type: "template",
          template: {
            name: TEMPLATE,
            language: { code: LANGUAGE },
            components: [
              // 1) Header image (product photo)
              {
                type: "header",
                parameters: [{ type: "image", image: { link: headerImage } }]
              },
              // 2) Body: {{1}} = customer name, {{2}} = product name
              {
                type: "body",
                parameters: [
                  { type: "text", text: clean(name, 40) || "dear" },
                  { type: "text", text: clean(product, 100) || "our product" }
                ]
              },
              // 3) "View Product" button: URL-oda kadaisila {{1}} = productId
              {
                type: "button",
                sub_type: "url",
                index: "0",
                parameters: [{ type: "text", text: encodeURIComponent(String(productId)) }]
              }
            ]
          }
        })
      }
    );

    const data = await r.json().catch(() => ({}));

    if (!r.ok) {
      console.error("WhatsApp send failed", r.status, JSON.stringify(data));
      throw new HttpsError(
        "internal",
        (data.error && data.error.message) || "WhatsApp error " + r.status
      );
    }

    if (viewerDocId) {
      await db
        .doc(`productViews/${productId}/viewers/${viewerDocId}`)
        .update({
          contacted: true,
          contactedAt: admin.firestore.FieldValue.serverTimestamp(),
          contactedVia: "whatsapp_api"
        })
        .catch(err => console.warn("contacted flag save failed", err));
    }

    return {
      ok: true,
      id: (data.messages && data.messages[0] && data.messages[0].id) || null
    };
  }
);