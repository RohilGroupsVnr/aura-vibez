//CHECKOUT From User Side
/* AURA checkout.js  ->  put in user/js/checkout.js  (loaded with <script type="module" src="js/checkout.js">) */
import * as FB from "./firebase.js";

(function () {
  if (window.AuraCheckout) return;

  /* ---------- settings (or set window.AURA_CHECKOUT_CONFIG before this script) ---------- */
  const CFG = Object.assign({
    cartKey: "aura_cart",          // localStorage key your cart uses
    ordersCollection: "orders",    // Firestore collection the admin orders page reads
    productsCollection: "products",
    intentsCollection: "paymentIntents", // started online payments (used to recover orders if the customer never comes back)
    logo: "../assets/logo.png",
    freeShipOver: 0,
    shipFee: 0,
    prepaidOff: 0,
    codFee: 0,
    deliveryDays: 5,               // fallback "Estimated Delivery" days (Ekart pincode days are used when available)
    codEnabled: true,              // set true to show Cash on Delivery again

    /* ---- ONLINE PAYMENT GATEWAY ---- */
    gateway: "payu",               // "payu"  or  "razorpay"
    // PayU (active when gateway = "payu")
    payuInitUrl: "https://asia-south1-aura-8a9b5.cloudfunctions.net/payuInit",
    payuVerifyUrl: "https://asia-south1-aura-8a9b5.cloudfunctions.net/payuVerify",
    // Razorpay (hidden now. To use it again: gateway "razorpay" + paste your public key id below)
    razorpayKey: "",               // e.g. "rzp_test_xxxxxxxx"  (public Key ID only, never the secret)
    rzpCreateUrl: "https://asia-south1-aura-8a9b5.cloudfunctions.net/createRazorpayOrder",
    rzpVerifyUrl: "https://asia-south1-aura-8a9b5.cloudfunctions.net/verifyRazorpayPayment",

    /* ---- manual UPI QR (used only when no online gateway is on) ---- */
    upiId: "sofiajohnsonece-2@oksbi",
    upiName: "Sofia Johnson",
    qrImage: "",                   // optional: your own QR image, e.g. "../assets/upi-qr.jpg". Empty = QR is generated with the exact amount
    trackUrl: "trackorder.html",
    pincodeApi: "https://asia-south1-aura-8a9b5.cloudfunctions.net/ekartPincode",
    coupons: { AURA10: { pct: 10 }, WELCOME100: { flat: 100, min: 999 } }
  }, window.AURA_CHECKOUT_CONFIG || {});

  const MAX_ADDR = 5;               // saved addresses per customer

  /* ---------- helpers ---------- */
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const inr = n => "₹" + Number(n).toLocaleString("en-IN", { maximumFractionDigits: 0 });
  const money2 = n => { const p = Number(n).toFixed(2).split("."); return `₹${p[0]}<span class="dec">.${p[1]}</span>`; };
  const digits = s => String(s ?? "").replace(/\D/g, "");
  const num = v => Number(String(v ?? 0).replace(/[^\d.]/g, "")) || 0;
  const titleCase = s => String(s || "").toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const clean = o => JSON.parse(JSON.stringify(o));   // drops undefined (Firestore rejects it)

  /* phone helpers: keep the last 10 digits + country code, so the number always shows correctly */
  const ten = p => digits(p).slice(-10);
  const ccOf = p => { const d = digits(p); return d.length > 10 ? d.slice(0, d.length - 10) : "91"; };
  const pCompact = p => ten(p).length === 10 ? `+${ccOf(p)} ${ten(p)}` : (p || "");                                  // +91 6379226432
  const pGroup = p => ten(p).length === 10 ? `+${ccOf(p)} ${ten(p).slice(0, 5)} ${ten(p).slice(5)}` : (p || "");      // +91 63792 26432
  const g55 = d => d.length > 5 ? d.slice(0, 5) + " " + d.slice(5) : d;                                               // 63792 26432

  const sv = (w, h, body, sw = 1.7) => `<svg width="${w}" height="${h}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
  const I = {
    back: sv(18, 18, '<path d="m15 18-6-6 6-6"/>', 2.2),
    down: sv(16, 16, '<path d="m6 9 6 6 6-6"/>', 2.2),
    right: sv(16, 16, '<path d="m9 6 6 6-6 6"/>', 2.4),
    x: sv(18, 18, '<path d="M18 6 6 18M6 6l12 12"/>', 2.4),
    user: sv(24, 24, '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="10" r="3"/><path d="M6.2 18.5c1.2-2 3.2-3 5.8-3s4.6 1 5.8 3"/>', 1.6),
    pin: sv(22, 22, '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="11" r="3"/><path d="M12 14v3"/>'),
    tag: sv(20, 20, '<path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8Z"/><circle cx="7.5" cy="7.5" r="1.2"/>'),
    gift: sv(20, 20, '<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13M5 12v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8M7.5 8a2.5 2.5 0 1 1 0-5C11 3 12 8 12 8s1-5 4.5-5a2.5 2.5 0 1 1 0 5"/>'),
    upi: sv(22, 22, '<rect x="7" y="2" width="10" height="20" rx="2.5"/><path d="M11 18h2"/>'),
    card: sv(22, 22, '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>'),
    bank: sv(22, 22, '<path d="M3 10 12 4l9 6M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20h18"/>'),
    wallet: sv(22, 22, '<path d="M20 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0 0 4h15v13a1 1 0 0 1-1 1H5a2 2 0 0 1-2-2V5"/><circle cx="16.5" cy="14" r="1"/>'),
    cod: sv(22, 22, '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 12h.01M18 12h.01"/>'),
    eye: sv(16, 16, '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>', 2),
    info: sv(13, 13, '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>', 2),
    check: sv(38, 38, '<path d="m5 12 5 5 9-10"/>', 3),
    warn: sv(38, 38, '<path d="M12 7v6M12 17h.01"/>', 3)
  };

  const PAY = [
    { id: "upi", name: "UPI", ico: I.upi },
    { id: "card", name: "Debit/Credit Cards", ico: I.card },
    { id: "netbanking", name: "Netbanking", ico: I.bank },
    { id: "wallet", name: "Wallets", ico: I.wallet },
    { id: "cod", name: "Cash on Delivery", ico: I.cod }
  ];

  /* is an online gateway (PayU / Razorpay) switched on? */
  const onlineOn = () => CFG.gateway === "payu" ? !!CFG.payuInitUrl : !!CFG.razorpayKey;
  /* manual mode (no online gateway): only UPI QR + COD. Card / Netbanking / Wallet come back automatically once a gateway is on */
  const manualMode = () => !onlineOn();
  const payList = () => {
    let list = manualMode() ? PAY.filter(m => m.id === "upi" || m.id === "cod") : PAY;
    if (!CFG.codEnabled) list = list.filter(m => m.id !== "cod");   // COD hidden unless codEnabled: true
    const pi = S.pinInfo && S.addr && S.pinInfo.pin === S.addr.pin ? S.pinInfo : null;
    if (pi && !pi.cod) list = list.filter(m => m.id !== "cod");      // Ekart COD support illa-na hide
    if (calc("cod").total > 49999) list = list.filter(m => m.id !== "cod");
    return list;
  };

  /* ---------- state ---------- */
  const S = {
    open: false, step: "login", items: [], buyNow: false, user: null, addr: null, coupon: null, method: null, busy: false,
    itemsOpen: false, tip: true, order: null, phoneDraft: "", msgI: 0, reveal: false, utr: "", pinInfo: null,
    addrs: [], defId: "", pickedId: "", editing: null, addrFrom: "summary", pulledFor: "", paidFail: null,
    cpOpen: false, qrShown: false
  };
  let authResolve, pending = null, ribbonTimer, toastTimer, flashTimer, resume = null;
  const authReady = new Promise(r => (authResolve = r));
  const handling = new Set();   // payment txn ids that this page is already finishing

  /* ---------- DOM shell ---------- */
  const root = document.createElement("div");
  root.className = "ck-ov";
  root.id = "ckRoot";
  root.innerHTML = `
    <div class="ck-wrap">
      <button type="button" class="ck-x" data-a="close" aria-label="Close checkout">${I.x}</button>
      <div class="ck-box" role="dialog" aria-modal="true" aria-label="Checkout">
        <header class="ck-head" id="ckHead"></header>
        <div class="ck-ribbon"><span id="ckRib"></span></div>
        <div class="ck-items" id="ckItems" hidden></div>
        <div class="ck-body" id="ckBody"></div>
        <div class="ck-foot" id="ckFoot"></div>
        <div class="ck-dim" id="ckDim" data-a="back"></div>
        <div class="ck-sheet" id="ckSheet"></div>
        <div class="ck-flash" id="ckFlash"><span id="ckFlashTxt"></span><button type="button" data-a="flashClose">Close</button></div>
        <div class="ck-toast" id="ckToast" role="status"></div>
      </div>
    </div>`;
  document.body.appendChild(root);
  const $ = id => document.getElementById(id);

  /* small extra styles (kept here so checkout.css needs no change) */
  (function addCss() {
    const st = document.createElement("style");
    st.id = "ckAddrCss";
    st.textContent = `
      .ck-chg-row{display:flex;justify-content:flex-end;margin-top:12px}
      .ck-chg{border:1px solid #A3194A;background:#fff;color:#A3194A;border-radius:999px;padding:7px 16px;font:500 13px "Jost",sans-serif;cursor:pointer}
      .ck-chg:hover{background:#A3194A;color:#fff}
      .ck-al{display:grid;gap:12px;margin:8px 0 16px}
      .ck-ai{display:flex;gap:10px;align-items:flex-start;padding:14px;border:1.5px solid #ead9df;border-radius:14px;background:#fff}
      .ck-ai.on{border-color:#A3194A;background:#fdf4f7}
      .ck-ai-main{display:flex;gap:12px;align-items:flex-start;flex:1;min-width:0;background:none;border:0;padding:0;text-align:left;font:inherit;color:inherit;cursor:pointer}
      .ck-ai-r{flex:none;width:18px;height:18px;border-radius:50%;border:2px solid #cdb6bf;margin-top:2px;background:#fff}
      .ck-ai.on .ck-ai-r{border-color:#A3194A;background:#A3194A;box-shadow:inset 0 0 0 3px #fff}
      .ck-ai-t{display:block;min-width:0}
      .ck-ai-t b{display:flex;align-items:center;gap:8px;font-size:15px}
      .ck-ai-t em{font-style:normal;font-size:11px;font-weight:600;color:#A3194A;background:#fbeef2;border-radius:999px;padding:2px 8px}
      .ck-ai-t p{margin:3px 0 0;font-size:13px;line-height:1.45;color:#5f4e54;overflow-wrap:anywhere}
      .ck-ai-act{display:flex;flex-direction:column;align-items:flex-end;gap:4px;flex:none}
      .ck-ai-act button{background:none;border:0;color:#A3194A;font:500 12px "Jost",sans-serif;cursor:pointer;padding:2px 4px}
      .ck-ai-act button:hover{text-decoration:underline}
      .ck-def{display:flex;gap:10px;align-items:flex-start;margin-top:14px;font-size:13px;line-height:1.4;cursor:pointer}
      .ck-def input{margin-top:3px;width:18px;height:18px;accent-color:#A3194A;flex:none}

      /* Nyra-style delivery card */
      .ck-dc{position:relative}
      .ck-tip{position:absolute;top:-12px;right:14px;background:#111;color:#fff;font:500 12px "Jost",sans-serif;padding:5px 10px;border-radius:8px;z-index:2}
      .ck-tip:after{content:"";position:absolute;bottom:-5px;right:30px;border:5px solid transparent;border-top-color:#111;border-bottom:0}
      .ck-chg-abs{position:absolute;right:14px;top:34px;border-color:#111;color:#111;border-radius:8px;padding:6px 12px;background:#fff}
      .ck-chg-abs:hover{background:#111;color:#fff}
      .ck-dtxt{padding-right:84px;min-width:0}
      .ck-trunc{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .ck-ship{margin-top:12px;background:#f6f6f6;border-radius:10px;padding:10px 12px}
      .ck-ship small{display:block;font-size:13px}
      .ck-ship span{font-size:13px;color:#0a7a3d}
      .ck-ship em{font-style:normal;background:#22c55e;color:#fff;font-size:11px;font-weight:600;border-radius:5px;padding:1px 7px;margin-left:6px}

      /* inline UPI QR (manual mode) */
      .ck-iqr{display:flex;align-items:center;justify-content:space-between;gap:14px;margin:6px 0 12px}
      .ck-iqr-w{position:relative;width:132px;height:132px;flex:none}
      .ck-iqr-box{width:132px;height:132px;display:flex;align-items:center;justify-content:center;overflow:hidden}
      .ck-iqr-box img,.ck-iqr-box canvas{width:132px!important;height:132px!important}
      .ck-iqr-box.blur{filter:blur(6px)}
      .ck-showqr{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);display:flex;gap:6px;align-items:center;background:#fff;border:1px solid #111;border-radius:999px;padding:6px 12px;font:600 13px "Jost",sans-serif;cursor:pointer;white-space:nowrap}
      .ck-iqr-t{flex:1;text-align:right;font-size:13px;line-height:1.4}
    `;
    document.head.appendChild(st);
  })();

  /* ---------- cart + totals ---------- */
  const normItem = i => ({ id: i.id || i.productId || "", name: i.name || i.title || "Product", price: num(i.price), qty: Number(i.qty || i.quantity || 1) || 1, image: i.image || (i.images && i.images[0]) || "", size: i.size || i.selectedSize || "", color: i.color || "" });
  function readCart() {
    try {
      let c = JSON.parse(localStorage.getItem(CFG.cartKey) || "[]");
      if (c && !Array.isArray(c)) c = c.items || [];
      return c.map(normItem).filter(i => i.price > 0);
    } catch (e) { return []; }
  }
  const subtotal = () => S.items.reduce((a, i) => a + i.price * i.qty, 0);
  const count = () => S.items.reduce((a, i) => a + i.qty, 0);
  function discountAmt(sub) {
    const c = S.coupon; if (!c) return 0;
    if (c.min && sub < c.min) return 0;
    return Math.min(sub, c.pct ? Math.round(sub * c.pct / 100) : (c.flat || 0));
  }
  function calc(method = S.method) {
    const sub = subtotal();
    const ship = sub >= CFG.freeShipOver ? 0 : CFG.shipFee;
    const disc = discountAmt(sub);
    const base = sub + ship - disc;
    const pre = method && method !== "cod" ? Math.min(CFG.prepaidOff, base) : 0;
    const cod = method === "cod" ? CFG.codFee : 0;
    return { sub, ship, disc, base, pre, cod, total: base - pre + cod };
  }

  /* the customer's mobile number: Firebase phone login first, then what they typed / saved */
  const phoneOf = () => (S.user && S.user.phoneNumber) || (S.addr && S.addr.phone) || "";

  /* ================= SAVED ADDRESSES (many per customer, kept on the account) =================
     Stored in localStorage (instant, under the uid AND the phone number) and in Firestore
     users/{uid}.savedAddresses (so a new phone / browser shows the same addresses).
     The address used for the last order becomes the default.
     Firestore rules needed:  match /users/{uid} { allow read, write: if request.auth != null && request.auth.uid == uid; } */
  const newId = () => "a" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const aKey = () => "aura_addrs_" + (S.user ? S.user.uid : "guest");
  const pKey = () => S.user && ten(S.user.phoneNumber).length === 10 ? "aura_addrs_ph_" + ten(S.user.phoneNumber) : "";   // same number = same addresses, even if the uid changes
  const oldKey = () => "aura_addr_" + (S.user ? S.user.uid : "guest");   // old single-address format (auto migrated)
  const addrLine = a => [a.flat, a.area, titleCase(a.city), titleCase(a.state), a.pin].filter(Boolean).join(", ");

  function readLocalAddrs() {
    let list = [], def = "";
    try {
      const raw = JSON.parse(localStorage.getItem(aKey()) || (pKey() ? localStorage.getItem(pKey()) : null) || "null");
      if (raw && Array.isArray(raw.list)) { list = raw.list; def = raw.def || ""; }
      else {
        const old = JSON.parse(localStorage.getItem(oldKey()) || "{}");
        Object.keys(old).forEach(k => { if (k !== "last" && old[k] && old[k].pin) list.push(Object.assign({ id: newId(), label: k }, old[k])); });
        const m = list.find(x => x.label === old.last);
        def = m ? m.id : "";
      }
    } catch (e) { }
    list = list.filter(a => a && a.pin).map(a => a.id ? a : Object.assign({ id: newId() }, a)).slice(0, MAX_ADDR);
    if (!list.some(a => a.id === def)) def = list[0] ? list[0].id : "";
    return { list, def };
  }
  function loadAddrs() {
    const r = readLocalAddrs();
    S.addrs = r.list; S.defId = r.def; S.pickedId = "";
    S.addr = S.addrs.find(a => a.id === S.defId) || S.addrs[0] || null;
  }
  function writeLocalAddrs() {
    try {
      const v = JSON.stringify({ list: S.addrs, def: S.defId });
      localStorage.setItem(aKey(), v);
      if (pKey()) localStorage.setItem(pKey(), v);
    } catch (e) { }
  }
  async function persistAddrs() {
    writeLocalAddrs();
    const u = S.user;
    if (!u || !FB.setDoc || !FB.doc || !FB.db) return;
    for (let i = 0; i < 3; i++) {
      try {
        await FB.setDoc(FB.doc(FB.db, "users", u.uid), clean({ savedAddresses: S.addrs, defaultAddressId: S.defId }), { merge: true });
        return;
      } catch (e) {
        console.error("Address sync failed:", e && (e.code || e));
        if (e && e.code === "permission-denied") return;   // Firestore rules problem: retrying won't help
        await sleep(1000 * (i + 1));
      }
    }
  }
  /* pull the account's addresses (needed on a new device / after clearing the browser) */
  async function pullAddrs() {
    const u = S.user; if (!u || !FB.getDoc || !FB.doc || !FB.db) return;
    const had = !!S.addr;
    try {
      const snap = await FB.getDoc(FB.doc(FB.db, "users", u.uid));
      if (!S.user || S.user.uid !== u.uid || !snap.exists()) { if (S.addrs.length) persistAddrs(); return; }
      const d = snap.data() || {};
      const remote = Array.isArray(d.savedAddresses) ? d.savedAddresses.filter(a => a && a.pin && a.id) : [];
      if (!remote.length) { if (S.addrs.length) persistAddrs(); return; }       // account empty -> upload this device's addresses
      const ids = new Set(remote.map(a => a.id));
      const extra = S.addrs.filter(a => !ids.has(a.id));
      S.addrs = remote.concat(extra).slice(0, MAX_ADDR);
      S.defId = S.addrs.some(a => a.id === d.defaultAddressId) ? d.defaultAddressId : (S.addrs.some(a => a.id === S.defId) ? S.defId : S.addrs[0].id);
      S.addr = S.addrs.find(a => a.id === (S.pickedId || S.defId)) || S.addrs[0];
      writeLocalAddrs();
      if (extra.length) persistAddrs();
      if (!S.open) return;
      if (!had && S.step === "address" && !S.editing && !(($("ckPin") || {}).value)) {   // first-time form was showing but the account has addresses
        S.step = "summary"; S.reveal = true; ensurePin(); render();
      } else if (S.step === "summary") { ensurePin(); render(); }
      else if (S.step === "addrlist") { delete $("ckSheet").dataset.built; render(); }
    } catch (e) { console.warn("Address load skipped:", e); }
  }
  /* after an order: that address becomes the default for next time */
  function rememberAddr(a) {
    if (!a || !S.user) return;
    if (!a.id) a.id = newId();
    const i = S.addrs.findIndex(x => x.id === a.id);
    if (i > -1) S.addrs[i] = Object.assign({}, S.addrs[i], a);
    else if (S.addrs.length < MAX_ADDR) S.addrs.push(a);
    if (S.addrs.some(x => x.id === a.id)) S.defId = a.id;
    persistAddrs();
  }

  /* ---------- open / close ---------- */
  async function open(opts = {}) {
    await authReady;
    S.items = (opts.items || readCart()).map(normItem);
    S.buyNow = !!opts.items;
    if (!S.items.length) { alert("Your bag is empty."); return; }
    S.coupon = opts.coupon || null; S.method = null; S.itemsOpen = false; S.tip = true; S.order = null; S.utr = ""; S.editing = null; S.paidFail = null;
    S.cpOpen = false; S.qrShown = false;
    S.open = true;
    root.classList.add("show");
    document.body.style.overflow = "hidden";
    startRibbon();
    route();
  }
  function close() {
    S.open = false;
    root.classList.remove("show");
    document.body.style.overflow = "";
    clearInterval(ribbonTimer);
    $("ckFlash").classList.remove("on");
  }
  function route() {
    if ((S.step === "done" && S.order) || (S.step === "paidfail" && S.paidFail)) return render();
    if (!S.user) { S.step = "login"; S.addr = null; S.addrs = []; S.pulledFor = ""; }
    else {
      loadAddrs();
      S.step = S.addr ? "summary" : "address"; S.reveal = !!S.addr; S.editing = null; ensurePin();
      if (S.pulledFor !== S.user.uid) { S.pulledFor = S.user.uid; pullAddrs(); }
    }
    render();
  }

  /* ---------- ribbon / toast / flash ---------- */
  function startRibbon() {
    const msgs = () => [`Free Shipping on orders above ${inr(CFG.freeShipOver)}`, `Extra ${inr(CFG.prepaidOff)} off on Prepaid orders`, "100% secure checkout"];
    const tick = () => { const m = msgs(), el = $("ckRib"); el.style.animation = "none"; void el.offsetWidth; el.style.animation = ""; el.textContent = m[S.msgI++ % m.length]; };
    clearInterval(ribbonTimer); tick(); ribbonTimer = setInterval(tick, 3200);
  }
  function toast(msg, err) {
    const t = $("ckToast"); t.textContent = msg; t.className = "ck-toast show" + (err ? " err" : "");
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove("show"), 3600);
  }
  function flash(msg) {
    $("ckFlashTxt").textContent = msg; $("ckFlash").classList.add("on");
    clearTimeout(flashTimer); flashTimer = setTimeout(() => $("ckFlash").classList.remove("on"), 4000);
  }

  /* ---------- render ---------- */
  function render() {
    const sub = subtotal(), n = count();
    $("ckHead").innerHTML = `
      <button type="button" class="ck-back" data-a="back" aria-label="Back">${I.back}</button>
      <img class="ck-logo" src="${esc(CFG.logo)}" alt="AURA" onerror="this.replaceWith(Object.assign(document.createElement('b'),{textContent:'AURA'}))">
      <button type="button" class="ck-sum ${S.itemsOpen ? "open" : ""}" data-a="items" aria-expanded="${S.itemsOpen}"><small>${n} item${n > 1 ? "s" : ""}</small><b>${inr(sub)}</b>${I.down}</button>`;
    const box = $("ckItems");
    box.hidden = !S.itemsOpen;
    box.innerHTML = S.itemsOpen ? S.items.map(i => `<div class="ck-it"><img src="${esc(i.image)}" alt="" onerror="this.style.visibility='hidden'"><div><b>${esc(i.name)}</b><small>${i.size ? "Size " + esc(i.size) + " · " : ""}${i.color ? esc(i.color) + " · " : ""}Qty ${i.qty}</small></div><span>${inr(i.price * i.qty)}</span></div>`).join("") : "";

    /* the address sheet (form or saved-address list) slides up over the page behind it (like Zomato / HAY) */
    const showSheet = S.step === "address" || S.step === "addrlist";
    const base = showSheet ? (S.addr ? "summary" : "login") : S.step;
    ({ login: viewLogin, summary: viewSummary, upi: viewUpi, done: viewDone, paidfail: viewPaidFail })[base]();

    const sheet = $("ckSheet");
    $("ckDim").classList.toggle("on", showSheet);
    if (showSheet) {
      const first = !sheet.dataset.built;
      if (sheet.dataset.built !== S.step) { (S.step === "addrlist" ? viewAddrList : viewSheet)(); sheet.dataset.built = S.step; }
      if (first) requestAnimationFrame(() => requestAnimationFrame(() => sheet.classList.add("show")));
    } else { delete sheet.dataset.built; sheet.classList.remove("show"); sheet.innerHTML = ""; }
    $("ckBody").scrollTop = 0;
  }

  /* login step. After login (while the address sheet is open) the SAME card shows the saved mobile number */
  function viewLogin() {
    const logged = !!S.user, p = phoneOf();
    const val = logged ? ten(p) : S.phoneDraft;
    const cc = logged && p ? ccOf(p) : "91";
    $("ckBody").innerHTML = `
      <div class="ck-card" style="margin-top: 20px;">
        <div class="ck-line">${I.user}<b>${logged ? "Logged in" : "Login to continue"}</b></div>
        <label class="ck-ph"><small>${logged ? "Mobile Number" : "Enter Mobile Number"}</small><span><em>+${esc(cc)}</em><i></i><input id="ckPhone" type="tel" inputmode="numeric" maxlength="11" autocomplete="tel-national" value="${esc(g55(val))}" ${logged ? "readonly" : ""}></span></label>
        <p class="ck-err" id="ckPhErr"></p>
      </div>
      ${logged ? "" : '<p class="ck-note">We\'ll send a one-time password to verify your number.</p>'}`;
    $("ckFoot").innerHTML = logged ? "" : `<button type="button" class="ck-btn" data-a="login">Continue</button>`;
    if (!logged) setTimeout(() => { const el = $("ckPhone"); if (S.open && el && !el.readOnly) el.focus(); }, 80);
  }

  const F = (id, label, val, o = {}) => `<div class="ck-f" data-f="${id}"><input id="${id}" placeholder=" " value="${esc(val)}" ${o.type ? `type="${o.type}"` : ""} ${o.max ? `maxlength="${o.max}"` : ""} ${o.mode ? `inputmode="${o.mode}"` : ""} autocomplete="${o.ac || "off"}"><label for="${id}">${label}</label><p class="ck-ferr"></p></div>`;

  /* add / edit address form */
  function viewSheet() {
    const a = S.editing || {}, pre = S.addr || {}, u = S.user || {};
    const needPhone = !u.phoneNumber;
    const sheet = $("ckSheet");
    const lbl = a.label || "home";
    sheet.classList.toggle("rev", S.reveal);
    sheet.innerHTML = `
      <div class="ck-sheet-b">
        <p class="ck-title">${S.editing ? "Edit Delivery Address" : "Add Delivery Address"}</p>
        <p class="ck-sub">Shipping Address</p>
        ${F("ckPin", "Pincode *", a.pin || "", { mode: "numeric", max: 6, ac: "postal-code" })}
        <div class="ck-more">
          <div class="ck-2">${F("ckCity", "City *", a.city || "", { ac: "address-level2" })}${F("ckState", "State *", a.state || "", { ac: "address-level1" })}</div>
          ${F("ckFlat", "Flat, House no. *", a.flat || "", { ac: "address-line1" })}
          ${F("ckArea", "Apartment, Area, Sector, Village *", a.area || "", { ac: "address-line2" })}
          ${F("ckLandmark", "Landmark (Optional)", a.landmark || "", { ac: "off" })}
          <p class="ck-title" style="margin-top:14px">Customer Information</p>
          ${F("ckName", "Full Name *", a.name || pre.name || u.displayName || "", { ac: "name" })}
          ${F("ckMail", "Email Address *", a.email || pre.email || u.email || "", { type: "email", ac: "email" })}
          ${needPhone ? F("ckMob", "Mobile Number *", ten(a.phone || pre.phone || S.phoneDraft), { mode: "numeric", max: 10, ac: "tel-national" }) : ""}
          <p class="ck-title" style="margin-top:14px">Save Address As</p>
          <div class="ck-save">
            <label class="ck-pillr"><input type="radio" name="ckLbl" value="home" ${lbl === "home" ? "checked" : ""}>Home<i></i></label>
            <label class="ck-pillr"><input type="radio" name="ckLbl" value="work" ${lbl === "work" ? "checked" : ""}>Work<i></i></label>
            <label class="ck-pillr"><input type="radio" name="ckLbl" value="other" ${lbl === "other" ? "checked" : ""}>Other<i></i></label>
          </div>
          ${S.addrs.length ? `<label class="ck-def"><input type="checkbox" id="ckDef" ${S.editing && S.editing.id === S.defId ? "checked" : ""}><span>Make this my default address</span></label>` : ""}
          <label class="ck-wa" style="display:flex;gap:10px;align-items:flex-start;margin-top:14px;font-size:13px;line-height:1.4;cursor:pointer">
            <input type="checkbox" id="ckWa" ${a.waOptIn || pre.waOptIn ? "checked" : ""} style="margin-top:3px;width:18px;height:18px;accent-color:#A3194A;flex:none">
            <span>I agree to receive order updates &amp; offers on WhatsApp. * <small style="color:#777">(Reply STOP anytime to opt out.)</small></span>
          </label>
          <p id="ckWaErr" style="color:#d93025;font-size:12px;margin:4px 0 0 28px;display:none">Please tick this box to continue</p>
          <p class="ck-help">${I.info} Please enter the complete address for smooth delivery.</p>
        </div>
      </div>
      <div class="ck-sheet-f"><button type="button" class="ck-btn" data-a="saveAddr">Continue</button></div>`;
    if (a.pin) lockCityState(true);
    if (!S.reveal) setTimeout(() => $("ckPin") && $("ckPin").focus(), 380);
  }

  /* saved addresses list (choose / edit / delete / make default / add new) */
  function viewAddrList() {
    const sheet = $("ckSheet");
    sheet.classList.add("rev");
    const mine = pCompact(phoneOf());
    sheet.innerHTML = `
      <div class="ck-sheet-b">
        <p class="ck-title">Select delivery address</p>
        <p class="ck-sub">Saved addresses</p>
        <div class="ck-al">${S.addrs.map(a => {
      const on = !!S.addr && S.addr.id === a.id, ph = a.phone ? pCompact(a.phone) : mine;
      return `<div class="ck-ai ${on ? "on" : ""}">
            <button type="button" class="ck-ai-main" data-a="pickAddr" data-id="${esc(a.id)}" aria-pressed="${on}">
              <span class="ck-ai-r"></span>
              <span class="ck-ai-t"><b>${esc(titleCase(a.label || "home"))}${a.id === S.defId ? "<em>Default</em>" : ""}</b>
                <p>${esc(a.name)}${ph ? " · " + esc(ph) : ""}</p>
                <p>${esc(addrLine(a))}</p></span>
            </button>
            <div class="ck-ai-act">
              <button type="button" data-a="editAddrId" data-id="${esc(a.id)}">Edit</button>
              ${a.id === S.defId ? "" : `<button type="button" data-a="setDef" data-id="${esc(a.id)}">Make default</button>`}
              <button type="button" data-a="delAddr" data-id="${esc(a.id)}">Delete</button>
            </div>
          </div>`;
    }).join("")}</div>
        ${S.addrs.length >= MAX_ADDR ? `<p class="ck-note">You can save up to ${MAX_ADDR} addresses. Delete one to add another.</p>` : ""}
      </div>
      <div class="ck-sheet-f"><button type="button" class="ck-btn" data-a="addNew" ${S.addrs.length >= MAX_ADDR ? "disabled" : ""}>+ Add new address</button></div>`;
  }

  function viewSummary() {
    const a = S.addr, t = calc(), u = S.user, p = phoneOf();
    const days = (S.pinInfo && Number(S.pinInfo.days)) || CFG.deliveryDays || 5;
    const eta = new Date(Date.now() + days * 864e5).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
    let tipSeen = false; try { tipSeen = !!localStorage.getItem("aura_tip_seen"); } catch (e) { }

    $("ckBody").innerHTML = `
      <p class="ck-sec" style="margin-top:4px">DELIVERY DETAILS</p>
      <div class="ck-card ck-dc">
        ${tipSeen ? "" : '<span class="ck-tip">Tap To Edit Address</span>'}
        <div class="ck-del">
          ${I.pin}
          <div class="ck-dtxt"><b>Deliver To ${esc(a.name)}${a.label ? " · " + esc(titleCase(a.label)) : ""}</b>
            <p class="ad ck-trunc">${esc(a.flat)}, ${esc(a.area)}</p>
            ${a.landmark ? `<p class="ad ck-trunc" style="font-size:12px;color:#666">Landmark: ${esc(a.landmark)}</p>` : ""}
            <p>${esc(titleCase(a.state))}, ${esc(a.pin)}</p>
            <p class="ph">${p ? esc(pCompact(p)) + " &nbsp;|&nbsp; " : ""}${esc(a.email)}</p></div>
          <button type="button" class="ck-chg ck-chg-abs" data-a="addrList">Change</button>
        </div>
        <div class="ck-ship"><small>Shipping</small>
          <span>Estimated Delivery By ${eta} <em>${t.ship ? inr(t.ship) : "Free"}</em></span></div>
      </div>

      <p class="ck-sec">PRICE DETAILS</p>
      <div class="ck-card"><div class="ck-rows">
        <div><span>Subtotal</span><span>${inr(t.sub)}</span></div>
        <div><span>Shipping</span><span>${t.ship ? inr(t.ship) : "Free"}</span></div>
        ${t.disc ? `<div class="g"><span>Coupon discount</span><span>− ${inr(t.disc)}</span></div>` : ""}
        ${t.pre ? `<div class="g"><span>Prepaid discount</span><span>− ${inr(t.pre)}</span></div>` : ""}
        ${t.cod ? `<div><span>COD fee</span><span>${inr(t.cod)}</span></div>` : ""}
        <div class="t"><span>${S.method ? "Total payable" : "Total"}</span><span>${inr(t.total)}</span></div>
      </div></div>

      <p class="ck-sec">PAYMENT OPTIONS</p>
      <p class="ck-banner">Extra ${inr(CFG.prepaidOff)} off on prepaid orders</p>
      <div class="ck-pays">${payList().map(payRow).join("")}</div>

      <div class="ck-login"><div>${I.user}<span>Logged in using ${esc(pGroup(p) || (u && u.email) || "your account")}</span></div><button type="button" data-a="logout">Logout</button></div>
      <p class="ck-fine">By proceeding, you agree to AURA's <a href="privacy-policy.html">Privacy Policy</a> and <a href="terms.html">T&amp;C</a></p>`;
    $("ckFoot").innerHTML = "";
    if (S.method === "upi" && manualMode()) drawInlineQr(calc("upi").total);
  }

  function payRow(m) {
    const prepaid = m.id !== "cod", t = calc(m.id), open = S.method === m.id;
    /* prepaid -> online gateway (PayU / Razorpay) when it is on, otherwise the manual UPI QR screen */
    const act = !prepaid ? "cod" : (onlineOn() ? "pay" : "upi");
    const label = !prepaid ? `Place order · ${inr(t.total)}` : (onlineOn() ? `Pay ${inr(t.total)}` : `Pay ${inr(t.total)} with UPI QR`);
    const note = !prepaid ? "Pay in cash when your order arrives." : (onlineOn() ? "You'll complete the payment on a secure payment page." : "Scan the QR with any UPI app (GPay, PhonePe, Paytm…).");
    /* manual mode: blurred QR right inside the UPI card, "Show QR" reveals it */
    const iqr = open && m.id === "upi" && manualMode()
      ? `<div class="ck-iqr">
          <div class="ck-iqr-w"><div class="ck-iqr-box ${S.qrShown ? "" : "blur"}" id="ckQrInline"></div>${S.qrShown ? "" : `<button type="button" class="ck-showqr" data-a="showQr">${I.eye}Show QR</button>`}</div>
          <div class="ck-iqr-t">Scan the QR using any UPI App</div>
        </div>` : "";
    return `<div class="ck-pay ${open ? "open" : ""}">
      <button type="button" class="ck-pay-h" data-a="method" data-m="${m.id}" aria-expanded="${open}">
        <span class="ico">${m.ico}</span>
        <span class="nm"><b>${m.name}</b>${prepaid ? `<em class="ok">Get ${inr(CFG.prepaidOff)} off</em>` : (CFG.codFee ? `<em class="bad">${inr(CFG.codFee)} COD fee added</em>` : "")}</span>
        <span class="amt">${prepaid ? `<s>${money2(t.base)}</s>` : ""}<b>${money2(t.total)}</b></span>
        ${open ? I.down : I.right}
      </button>
      ${open ? `<div class="ck-pay-b">${iqr}<button type="button" class="ck-btn" data-a="${act}" ${S.busy ? "disabled" : ""}>${label}</button><p class="ck-note">${note}</p></div>` : ""}
    </div>`;
  }

  /* ---------- manual UPI QR step ---------- */
  const upiLink = amt => `upi://pay?pa=${encodeURIComponent(CFG.upiId)}&pn=${encodeURIComponent(CFG.upiName)}&am=${Number(amt).toFixed(2)}&cu=INR&tn=${encodeURIComponent("AURA order")}`;

  function loadQrLib() {
    return new Promise((res, rej) => {
      if (window.QRCode) return res();
      const s = document.createElement("script"); s.src = "https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js";
      s.onload = res; s.onerror = () => rej(new Error("qr")); document.head.appendChild(s);
    });
  }
  async function drawQr(amt) {
    const box = $("ckQr"); if (!box) return;
    if (CFG.qrImage) { box.innerHTML = `<img src="${esc(CFG.qrImage)}" alt="UPI QR code">`; return; }
    try {
      await loadQrLib();
      const el = $("ckQr"); if (!el || S.step !== "upi") return;
      el.innerHTML = "";
      new window.QRCode(el, { text: upiLink(amt), width: 196, height: 196, correctLevel: window.QRCode.CorrectLevel.M });
    } catch (e) {
      const el = $("ckQr"); if (el) el.innerHTML = `<p class="ck-note">Couldn't load the QR. Please pay to the UPI ID below.</p>`;
    }
  }
  /* small QR inside the UPI payment row (manual mode only) */
  async function drawInlineQr(amt) {
    const box = $("ckQrInline"); if (!box) return;
    if (CFG.qrImage) { box.innerHTML = `<img src="${esc(CFG.qrImage)}" alt="UPI QR code">`; return; }
    try {
      await loadQrLib();
      const el = $("ckQrInline"); if (!el || S.step !== "summary" || S.method !== "upi") return;
      el.innerHTML = "";
      new window.QRCode(el, { text: upiLink(amt), width: 132, height: 132, correctLevel: window.QRCode.CorrectLevel.M });
    } catch (e) {
      const el = $("ckQrInline"); if (el) el.innerHTML = "";
    }
  }

  function viewUpi() {
    const t = calc("upi");
    $("ckBody").innerHTML = `
      <div class="ck-upi">
        <p class="ck-sec" style="margin-top:4px">Scan &amp; pay</p>
        <div class="ck-card">
          <p class="ck-upi-amt">${money2(t.total)}</p>
          <p class="ck-note" style="margin-top:2px">${t.pre ? `Includes ${inr(t.pre)} prepaid discount` : "Pay this exact amount"}</p>
          <div class="ck-qr" id="ckQr"><p class="ck-note">Loading QR…</p></div>
          <p class="ck-upi-name">${esc(CFG.upiName)}</p>
          <div class="ck-upi-id"><span>UPI ID: <b>${esc(CFG.upiId)}</b></span><button type="button" data-a="copyUpi">Copy</button></div>
          <a class="ck-btn line ck-upiapp" href="${esc(upiLink(t.total))}">Open in UPI app</a>
        </div>
        <ol class="ck-steps">
          <li>Scan the QR with any UPI app and pay <b>${inr(t.total)}</b>.</li>
          <li>After paying, enter the 12-digit <b>UTR / Transaction ID</b> from your payment app.</li>
          <li>Tap <b>I've paid</b>. We'll verify your payment and confirm your order.</li>
        </ol>
        <div class="ck-f" data-f="ckUtr"><input id="ckUtr" placeholder=" " value="${esc(S.utr)}" maxlength="12" inputmode="numeric" autocomplete="off"><label for="ckUtr">UTR / Transaction ID (12 digits) *</label><p class="ck-ferr"></p></div>
      </div>`;
    $("ckFoot").innerHTML = `<button type="button" class="ck-btn" data-a="upiPaid" ${S.busy ? "disabled" : ""}>${S.busy ? "Placing order…" : "I've paid · Place order"}</button>`;
    drawQr(t.total);
  }

  function viewDone() {
    const o = S.order;
    const manual = o.paymentStatus === "verification";
    $("ckBody").innerHTML = `<div class="ck-done"><div class="ck-tick">${I.check}</div><h3>Order placed!</h3>
      <p>Thank you, ${esc(o.address.name)}. We'll send updates to ${esc(pCompact(o.phone) || o.address.email)}.</p>
      <span class="id">${esc(o.orderId)}</span>
      <p>${o.paymentMethod === "cod" ? "Pay " + inr(o.total) + " in cash on delivery." : manual ? "Payment of " + inr(o.total) + " submitted (Ref " + esc(o.paymentId) + "). We'll confirm it shortly." : "Payment of " + inr(o.total) + " received."}</p>
      ${o.stockIssue ? `<p style="margin-top:10px;color:#c62828">Some items just went out of stock. Our team will contact you shortly to refund or arrange an alternative.</p>` : ""}</div>`;
    $("ckFoot").innerHTML = `<button type="button" class="ck-btn" data-a="track">Track order</button><button type="button" class="ck-btn line" style="margin-top:10px" data-a="close">Continue shopping</button>`;
  }

  /* shown when money was taken but the order couldn't be saved yet. Customer must NOT pay again */
  function viewPaidFail() {
    const it = S.paidFail || {};
    $("ckBody").innerHTML = `<div class="ck-done"><div class="ck-tick" style="background:#f3a82b">${I.warn}</div><h3>Payment received</h3>
      <p>We couldn't confirm your order just yet. <b>Please don't pay again.</b></p>
      <span class="id">${esc(it.txnid || "")}</span>
      <p>Tap “Try again” to finish your order. If it keeps failing, contact support with the reference above and we'll sort it out.</p></div>`;
    $("ckFoot").innerHTML = `<button type="button" class="ck-btn" data-a="retryIntent" ${S.busy ? "disabled" : ""}>Try again</button><button type="button" class="ck-btn line" style="margin-top:10px" data-a="close">Close</button>`;
  }

  /* ---------- address helpers ---------- */
  function lockCityState(on) { ["ckCity", "ckState"].forEach(id => { const el = $(id); if (el) el.readOnly = on; }); }
  async function lookupPin(pin) {
    try {
      const r = await fetch("https://api.postalpincode.in/pincode/" + pin);
      const j = await r.json(); const po = j && j[0] && j[0].PostOffice && j[0].PostOffice[0];
      if (po) return { city: String(po.District).toUpperCase(), state: String(po.State).toUpperCase() };
    } catch (e) { }
    return null;
  }
  async function ekartCheck(pin) {
    if (!CFG.pincodeApi) return null;
    try {
      const r = await fetch(CFG.pincodeApi + "?pincode=" + pin);
      const j = await r.json();
      return j && j.ok ? { ...j, pin } : null;
    } catch (e) { return null; }
  }
  async function ensurePin() {
    if (!S.addr || (S.pinInfo && S.pinInfo.pin === S.addr.pin)) return;
    S.pinInfo = await ekartCheck(S.addr.pin);
    if (S.open && S.step === "summary") render();
  }
  async function revealFromPin(pin) {
    const [r0, k] = await Promise.all([lookupPin(pin), ekartCheck(pin)]);
    if (!$("ckPin") || $("ckPin").value.trim() !== pin) return;
    S.pinInfo = k;
    const r = r0 || (k && k.city ? { city: String(k.city).toUpperCase(), state: String(k.state).toUpperCase() } : null);
    if (r) { $("ckCity").value = r.city; $("ckState").value = r.state; lockCityState(true); setErr("ckCity", ""); setErr("ckState", ""); }
    else { lockCityState(false); toast("Couldn't find that pincode. Please enter city and state."); }
    if (k && !k.serviceable) setErr("ckPin", "Sorry, we can't deliver to this pincode yet");
    S.reveal = true; $("ckSheet").classList.add("rev");
    if (!$("ckFlat").value) $("ckFlat").focus();
  }
  function setErr(id, msg) {
    const w = document.querySelector(`.ck-f[data-f="${id}"]`); if (!w) return;
    w.classList.toggle("err", !!msg); w.querySelector(".ck-ferr").textContent = msg || "";
  }
  function validateAddr() {
    const v = id => $(id).value.trim();
    const rules = [
      ["ckPin", /^\d{6}$/.test(v("ckPin")), "Enter a valid 6-digit pincode"],
      ["ckCity", !!v("ckCity"), "City is required"],
      ["ckState", !!v("ckState"), "State is required"],
      ["ckFlat", !!v("ckFlat"), "Flat, House no. is required"],
      ["ckArea", !!v("ckArea"), "Area / Village is required"],
      ["ckName", v("ckName").length >= 2, "Full name required"],
      ["ckMail", /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v("ckMail")), "Enter a valid email address"]
    ];
    if ($("ckMob")) rules.push(["ckMob", /^[6-9]\d{9}$/.test(digits(v("ckMob"))), "Enter a valid 10-digit mobile number"]);
    let first = null;
    rules.forEach(([id, ok, msg]) => { setErr(id, ok ? "" : msg); if (!ok && !first) first = id; });
    if (first) $(first).focus();
    return !first;
  }

  /* ================= STOCK ================= */
  const stockErr = m => Object.assign(new Error(m), { stock: true });
  const itemLabel = it => `${it.name}${it.color || it.size ? " (" + [it.color, it.size].filter(Boolean).join(" / ") + ")" : ""}`;

  /* find the variant of a cart item.
     If the cart line has no color (old cart), use the first color that has this size. */
  function pickVariant(variants, it) {
    if (it.color && variants[it.color]) return variants[it.color];
    if (!it.color) {
      return Object.values(variants).find(x => x && x.sizeStock && x.sizeStock[it.size] !== undefined) || null;
    }
    return null;
  }

  /* quick check BEFORE payment (so the customer never pays for sold-out items). Returns "" if all OK, else a message */
  async function checkStock() {
    try {
      const { db, doc, getDoc } = FB;
      const ids = [...new Set(S.items.map(i => i.id))];
      const snaps = await Promise.all(ids.map(id => getDoc(doc(db, CFG.productsCollection, id))));
      const map = {};
      snaps.forEach(s => { if (s.exists()) map[s.id] = s.data(); });

      // same product+color+size can appear in 2 cart lines; add them up
      const need = {};
      S.items.forEach(it => { const k = it.id + "|" + it.color + "|" + it.size; need[k] = (need[k] || 0) + it.qty; });

      for (const it of S.items) {
        const p = map[it.id];
        if (!p || String(p.status || "active").toLowerCase() === "draft") return `${it.name} is no longer available`;
        const v = pickVariant(p.variants || {}, it);
        const have = (v && v.sizeStock) ? (Number(v.sizeStock[it.size]) || 0) : (Number(p.stock) || 0);
        const want = need[it.id + "|" + it.color + "|" + it.size];
        if (have < want) return have <= 0 ? `${itemLabel(it)} is sold out` : `${itemLabel(it)} – only ${have} left`;
      }
      return "";
    } catch (e) {
      console.warn("Stock check skipped:", e);
      return "";   // network problem: the transaction in placeOrder is still the final safety net
    }
  }

  /* ---------- order ---------- */
  /* manual = true  -> customer paid by scanning the QR, admin must verify the UTR (paymentStatus "verification")
     extra          -> extra fields saved on the order (e.g. payuTxnId / rzpOrderId)
     returns true when the order is saved, false when it is not.
     PayU orders use the fixed document id "payu_<txnid>", so the same payment can never create two orders. */
  async function placeOrder(method, paymentId, manual, extra) {
    const t = calc(method), a = S.addr, d = digits(phoneOf());
    const paidOnline = method !== "cod" && !manual;
    const order = {
      orderId: "",   // filled inside the transaction: AURA#01, AURA#02, ...
      uid: S.user.uid, phone: d.length === 10 ? "+91" + d : phoneOf(), email: a.email, customerName: a.name,
      address: a, items: S.items, subtotal: t.sub, shipping: t.ship, discount: t.disc, coupon: S.coupon ? S.coupon.code : "",
      prepaidDiscount: t.pre, codFee: t.cod, total: t.total,
      paymentMethod: method, paymentId: paymentId || "", ...(extra || {}),
      paymentStatus: method === "cod" ? "pending" : (manual ? "verification" : "paid"),
      upiId: manual ? CFG.upiId : "",
      whatsappOptIn: !!a.waOptIn,
      status: "pending",
      stockReduced: true     // admin uses this to give the stock back if the order is cancelled / payment rejected
    };
    const fixedId = extra && extra.payuTxnId ? "payu_" + extra.payuTxnId : "";
    S.busy = true; render();
    try {
      const { db, doc, collection, runTransaction, serverTimestamp } = FB;
      if (!db || !doc || !collection || !runTransaction)
        throw new Error("firebase.js must export db, doc, collection, runTransaction (and serverTimestamp)");

      const orderRef = fixedId ? doc(db, CFG.ordersCollection, fixedId) : doc(collection(db, CFG.ordersCollection));   // auto id for normal orders

      /* same payment already turned into an order (e.g. return page + recovery both ran)? then just show it */
      let already = false;
      if (fixedId && FB.getDoc) {
        try { const ex = await FB.getDoc(orderRef); if (ex.exists()) { Object.assign(order, ex.data()); already = true; } } catch (e) { /* can't read -> carry on */ }
      }

      /* reduce = true : normal path (check + reduce stock).  reduce = false : paid online but stock ran out -> still save the order, flagged for admin */
      const commit = async reduce => {
        const counterRef = doc(db, "counters", "orders");
        await runTransaction(db, async tx => {
          /* ---- 1) ALL READS FIRST ---- */
          const counterSnap = await tx.get(counterRef);
          const ids = reduce ? [...new Set(S.items.map(i => i.id))] : [];
          const pSnaps = await Promise.all(ids.map(id => tx.get(doc(db, CFG.productsCollection, id))));

          /* ---- 2) CHECK STOCK + CALCULATE NEW VALUES ---- */
          const writes = [];
          pSnaps.forEach((snap, k) => {
            const list = S.items.filter(i => i.id === ids[k]);
            if (!snap.exists()) throw stockErr(`${list[0].name} is no longer available`);
            const p = snap.data();
            if (String(p.status || "active").toLowerCase() === "draft") throw stockErr(`${list[0].name} is no longer available`);

            const variants = JSON.parse(JSON.stringify(p.variants || {}));
            let stock = Number(p.stock) || 0;

            list.forEach(it => {
              const v = pickVariant(variants, it);   // works even if the cart line has no color
              if (v && v.sizeStock) {
                const have = Number(v.sizeStock[it.size]) || 0;
                if (have < it.qty) throw stockErr(have <= 0 ? `${itemLabel(it)} is sold out` : `${itemLabel(it)} – only ${have} left`);
                v.sizeStock[it.size] = have - it.qty;
              } else {
                if (stock < it.qty) throw stockErr(`${it.name} is out of stock`);
                stock -= it.qty;
              }
            });

            const upd = {};
            if (Object.keys(variants).length) {
              const colorSold = {}, colorStock = {};
              let total = 0;
              Object.entries(variants).forEach(([c, v]) => {
                const ss = v.sizeStock || {};
                v.stock = (v.sizes || []).reduce((acc, s) => acc + (Number(ss[s]) || 0), 0);
                v.soldSizes = (v.sizes || []).filter(s => (Number(ss[s]) || 0) <= 0);
                colorSold[c] = v.soldSizes;
                colorStock[c] = v.stock;
                total += v.stock;
              });
              Object.assign(upd, { variants, colorSold, colorStock, stock: total });
            } else {
              upd.stock = stock;
            }
            upd.updatedAt = serverTimestamp ? serverTimestamp() : new Date();
            writes.push([doc(db, CFG.productsCollection, ids[k]), upd]);
          });

          /* ---- 3) ALL WRITES (order number + stock + order) ---- */
          const next = (counterSnap.exists() ? Number(counterSnap.data().last) || 0 : 0) + 1;
          order.orderId = "AURA#" + String(next).padStart(2, "0");     // 1 -> AURA#01 ... 100 -> AURA#100
          tx.set(counterRef, { last: next });
          writes.forEach(([ref, upd]) => tx.update(ref, upd));
          tx.set(orderRef, { ...order, createdAt: serverTimestamp ? serverTimestamp() : new Date() });
        });
      };

      if (!already) {
        try { await commit(true); }
        catch (err) {
          if (err && err.stock && paidOnline) {
            /* money is already taken: never lose the order. Save it without touching stock and flag it for admin */
            order.stockReduced = false; order.stockIssue = true;
            order.adminNote = "Paid online but stock ran out (" + err.message + "). Please fulfil or refund.";
            await commit(false);
          } else throw err;
        }
      }
    } catch (err) {
      console.error("Order save failed:", err);
      S.busy = false; render();
      if (paidOnline) return false;     // the caller shows the "payment received, don't pay again" screen
      if (err && err.stock) {
        toast(err.message, true);
        S.step = "summary"; render();
      } else {
        toast("Couldn't place your order. Please try again.", true);
      }
      return false;
    }
    /* WhatsApp opt-in -> users/{uid}.whatsappOptIn (never blocks the order if it fails) */
    if (order.whatsappOptIn) {
      try {
        const ref = FB.doc(FB.db, "users", S.user.uid);
        const data = { whatsappOptIn: true, whatsappOptInAt: FB.serverTimestamp ? FB.serverTimestamp() : new Date(), whatsappPhone: order.phone };
        if (FB.setDoc) await FB.setDoc(ref, data, { merge: true });
        else if (FB.updateDoc) await FB.updateDoc(ref, data);
        else console.warn("firebase.js must export setDoc (or updateDoc) to save WhatsApp opt-in");
      } catch (e) { console.warn("WhatsApp opt-in save failed:", e); }
    }
    rememberAddr(a);     // this address is now the default for the next order
    S.busy = false; S.order = order; S.step = "done"; S.utr = "";
    if (!S.buyNow) { try { localStorage.removeItem(CFG.cartKey); } catch (e) { } }
    window.dispatchEvent(new CustomEvent("aura:order-placed", { detail: order }));
    render();
    return true;
  }

  /* ================= PAYMENT INTENTS =================
     Before the customer is sent to PayU we save "payment started" (this browser + Firestore paymentIntents/{txnid}).
     If they pay and never come back to the site (closed the tab, UPI app didn't redirect...), the next time they open
     the site the order is created automatically from that saved intent after PayU confirms the payment. */
  const INT_KEY = "aura_pay_intents";
  const readInts = () => { try { const a = JSON.parse(localStorage.getItem(INT_KEY) || "[]"); return Array.isArray(a) ? a : []; } catch (e) { return []; } };
  const writeInts = a => { try { localStorage.setItem(INT_KEY, JSON.stringify(a.slice(-10))); } catch (e) { } };
  const saveIntent = it => writeInts(readInts().filter(x => x.txnid !== it.txnid).concat(it));
  const dropIntent = txnid => writeInts(readInts().filter(x => x.txnid !== txnid));
  async function cloudIntent(txnid, data) {      // best effort, never blocks the customer
    if (!FB.setDoc || !FB.doc || !FB.db) return;
    try {
      await FB.setDoc(FB.doc(FB.db, CFG.intentsCollection, txnid), Object.assign({ updatedAt: FB.serverTimestamp ? FB.serverTimestamp() : new Date() }, clean(data)), { merge: true });
    } catch (e) { console.warn("paymentIntents write skipped:", e); }
  }
  async function fetchIntent(txnid) {
    const l = readInts().find(x => x.txnid === txnid);
    if (l) return l;
    if (!FB.getDoc || !FB.doc || !FB.db) return null;
    try {
      const s = await FB.getDoc(FB.doc(FB.db, CFG.intentsCollection, txnid));
      const d = s.exists() ? s.data() : null;
      return d && Array.isArray(d.items) && d.addr ? d : null;
    } catch (e) { return null; }
  }

  /* ask PayU (through our function) if the payment really went through. Retries because PayU can lag a few seconds */
  async function verifyPayu(txnid, tries = 3) {
    for (let i = 0; i < tries; i++) {
      try {
        const v = await (await fetch(CFG.payuVerifyUrl + "?txnid=" + encodeURIComponent(txnid))).json();
        if (v && v.ok) return v;
      } catch (e) { }
      if (i < tries - 1) await sleep(2500);
    }
    return null;
  }

  /* put the checkout popup back into the state it had when the customer left for PayU */
  function openFor(it) {
    S.items = it.items.map(normItem); S.buyNow = !!it.buyNow; S.coupon = it.coupon || null;
    loadAddrs(); S.addr = it.addr; S.pickedId = (it.addr && it.addr.id) || "";
    S.method = it.method; S.order = null; S.utr = ""; S.editing = null; S.paidFail = null; S.cpOpen = false;
    S.open = true; root.classList.add("show"); document.body.style.overflow = "hidden"; startRibbon();
  }
  function showPaidFail(it) {
    S.paidFail = it; S.busy = false; S.step = "paidfail"; render();
  }
  /* payment is confirmed by PayU -> create the order */
  async function completeIntent(it, v) {
    openFor(it);
    S.step = "summary"; render();
    const ok = await placeOrder(it.method, v.mihpayid, false, { payuTxnId: it.txnid, gateway: "payu" });
    if (ok) {
      dropIntent(it.txnid);
      cloudIntent(it.txnid, { status: "completed", orderId: S.order ? S.order.orderId : "" });
    } else showPaidFail(it);      // intent stays saved, so it also retries on the next visit
    return ok;
  }
  const amountOk = (v, it) => Math.abs(Number(v.amount) - Number(it.total)) <= 0.009;

  /* the customer came back from PayU (?payu=success|failed&txnid=...) */
  async function handleReturn(it, st) {
    if (st !== "success") {
      openFor(it); S.step = "summary"; render();
      dropIntent(it.txnid); cloudIntent(it.txnid, { status: "failed" });
      return toast("Payment failed or cancelled. Please try again.", true);
    }
    openFor(it); S.step = "summary"; render();
    toast("Confirming your payment…");
    const v = await verifyPayu(it.txnid, 3);
    if (!v || !amountOk(v, it)) return showPaidFail(it);
    return completeIntent(it, v);
  }

  /* runs on page load: when the customer comes back from PayU */
  async function finishPayu() {
    const q = new URLSearchParams(location.search);
    const st = q.get("payu"), txnid = q.get("txnid");
    if (!st || !txnid) return;
    handling.add(txnid);
    q.delete("payu"); q.delete("txnid");
    history.replaceState(null, "", location.pathname + (q.toString() ? "?" + q : ""));
    await authReady;

    const it = await fetchIntent(txnid);
    if (!it) {
      if (st === "success") alert("We received your payment (reference " + txnid + ") but couldn't restore your order on this device. Please log in with the same number and check My Orders, or contact support with this reference.");
      return;
    }
    if (!S.user) {         // keep the saved intent; we continue as soon as they log in
      openFor(it); S.step = "login"; render(); resume = { it, st };
      return toast("Please log in again to finish your order. Payment reference: " + txnid, true);
    }
    handleReturn(it, st);
  }

  /* runs after login on every page: finds payments that were started but never turned into an order */
  let recovering = false;
  async function recoverPayments() {
    if (recovering || S.open || !S.user || CFG.gateway !== "payu") return;
    recovering = true;
    try {
      const uid = S.user.uid, now = Date.now();
      const cloudDone = new Set(), cands = {};
      if (FB.getDocs && FB.query && FB.collection && FB.where && FB.db) {
        try {
          const snap = await FB.getDocs(FB.query(FB.collection(FB.db, CFG.intentsCollection), FB.where("uid", "==", uid)));
          snap.docs.forEach(d => {
            const x = d.data() || {};
            if (!x.txnid) return;
            if (x.status === "started" && Array.isArray(x.items) && x.addr) cands[x.txnid] = x; else cloudDone.add(x.txnid);
          });
        } catch (e) { /* rules not added yet / offline: local intents still work */ }
      }
      readInts().filter(x => x.uid === uid).forEach(x => { if (cloudDone.has(x.txnid)) dropIntent(x.txnid); else cands[x.txnid] = Object.assign({}, cands[x.txnid], x); });

      for (const it of Object.values(cands)) {
        if (handling.has(it.txnid)) continue;
        const age = now - (it.at || 0);
        if (age < 90000) continue;                                   // just started: the normal return page will handle it
        if (age > 24 * 3600 * 1000) { dropIntent(it.txnid); cloudIntent(it.txnid, { status: "abandoned" }); continue; }
        const v = await verifyPayu(it.txnid, 1);
        if (!v) continue;                                            // not paid (yet)
        if (!amountOk(v, it)) { console.warn("Recovered payment amount mismatch", it.txnid); continue; }
        handling.add(it.txnid);
        await completeIntent(it, v);
        return;                                                      // one at a time
      }
    } catch (e) { console.warn("Payment recovery skipped:", e); }
    finally { recovering = false; }
  }

  /* ================= PAYU (redirect flow) ================= */
  async function payOnlinePayu() {
    if (S.busy) return;
    const t = calc(), a = S.addr;
    S.busy = true;
    try {
      const r = await fetch(CFG.payuInitUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: S.items.map(i => ({ id: i.id, qty: i.qty, size: i.size, color: i.color })),
          customer: { name: a.name, phone: ten(phoneOf()), email: a.email },
          returnUrl: location.origin + location.pathname + location.search
        })
      });
      const o = await r.json();
      if (!o.ok) throw new Error(o.error || "Couldn't start the payment");
      if (Math.abs(Number(o.amount) - t.total) > 0.009) throw new Error("Price changed. Please check your bag and try again.");

      /* PayU takes the customer to its own page. Save everything first, so the order can be finished even if they never come back */
      const intent = clean({
        txnid: o.params.txnid, uid: S.user.uid, status: "started", at: Date.now(),
        items: S.items, addr: S.addr, coupon: S.coupon, method: S.method, buyNow: S.buyNow, total: t.total, phone: ten(phoneOf())
      });
      saveIntent(intent);
      await Promise.race([cloudIntent(intent.txnid, intent), sleep(1500)]);   // don't keep the customer waiting if Firestore is slow

      const f = document.createElement("form");
      f.method = "POST"; f.action = o.action;
      Object.entries(o.params).forEach(([k, v]) => {
        const i = document.createElement("input"); i.type = "hidden"; i.name = k; i.value = v; f.appendChild(i);
      });
      document.body.appendChild(f);
      f.submit();
    } catch (e) {
      S.busy = false;
      toast(e.message || "Couldn't start the payment. Please try again.", true);
    }
  }

  /* ================= RAZORPAY (popup flow, hidden unless gateway = "razorpay") ================= */
  function loadRzp() {
    return new Promise((res, rej) => {
      if (window.Razorpay) return res();
      const s = document.createElement("script"); s.src = "https://checkout.razorpay.com/v1/checkout.js";
      s.onload = res; s.onerror = () => rej(new Error("gateway")); document.head.appendChild(s);
    });
  }
  async function payOnline() {
    if (!CFG.razorpayKey) { toast("Online payment isn't enabled yet. Please choose Cash on Delivery.", true); return; }
    if (S.busy) return;
    const t = calc(), method = S.method, a = S.addr;
    S.busy = true;
    try {
      await loadRzp();
      const r = await fetch(CFG.rzpCreateUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: S.items.map(i => ({ id: i.id, qty: i.qty, size: i.size, color: i.color })),
          customer: { name: a.name, phone: ten(phoneOf()), email: a.email }
        })
      });
      const o = await r.json();
      if (!o.ok) throw new Error(o.error || "Couldn't start the payment");
      if (o.amount !== Math.round(t.total * 100)) throw new Error("Price changed. Please check your bag and try again.");

      const rzp = new window.Razorpay({
        key: o.keyId, amount: o.amount, currency: "INR", order_id: o.rzpOrderId,
        name: "AURA", description: `${count()} item(s)`,
        prefill: { name: a.name, email: a.email, contact: ten(phoneOf()) },
        theme: { color: "#A3194A" },
        handler: async resp => {
          try {
            const v = await fetch(CFG.rzpVerifyUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(resp)
            });
            const vr = await v.json();
            if (!vr.ok) throw new Error("verify");
            const ok = await placeOrder(method, resp.razorpay_payment_id, false, { rzpOrderId: resp.razorpay_order_id, gateway: "razorpay" });
            if (!ok) toast("Payment received but the order couldn't be saved. Please don't pay again. Contact support with ID " + resp.razorpay_payment_id, true);
          } catch (err) {
            toast("Payment received but couldn't be verified. Contact support with ID " + resp.razorpay_payment_id, true);
          }
        }
      });
      rzp.on("payment.failed", ev => toast((ev.error && ev.error.description) || "Payment failed. Please try again.", true));
      S.busy = false;
      rzp.open();
    } catch (e) {
      S.busy = false;
      toast(e.message || "Couldn't start the payment. Please try again.", true);
    }
  }

  /* ---------- events ---------- */
  root.addEventListener("click", async e => {
    if (e.target === root) return close();
    const b = e.target.closest("[data-a]"); if (!b) return;
    const a = b.dataset.a, id = b.dataset.id;
    if (a === "close") close();
    else if (a === "back") {
      if (S.step === "upi") { S.step = "summary"; render(); }
      else if (S.step === "addrlist") { S.step = "summary"; render(); }
      else if (S.step === "address") {
        if (S.addr) { S.editing = null; S.step = S.addrFrom === "list" ? "addrlist" : "summary"; render(); } else close();
      }
      else close();
    }
    else if (a === "flashClose") { $("ckFlash").classList.remove("on"); }
    else if (a === "items") { S.itemsOpen = !S.itemsOpen; render(); }
    else if (a === "login") {
      const d = digits($("ckPhone").value);
      if (!/^[6-9]\d{9}$/.test(d)) { $("ckPhErr").textContent = "Enter a valid 10-digit mobile number"; return; }
      S.phoneDraft = d; pending = S.buyNow ? { items: S.items, coupon: S.coupon } : { coupon: S.coupon };
      close();
      /* hand the number to the OTP login popup so it shows there exactly as typed */
      const pi = document.getElementById("auraPhone");
      if (pi) { pi.value = "+91" + d; pi.dispatchEvent(new Event("input", { bubbles: true })); }
      const lb = document.getElementById("hmLogin");
      if (lb) lb.click(); else alert("Please log in to continue.");
    }
    else if (a === "saveAddr") {
      if (!S.reveal) {
        const pin = $("ckPin").value.trim();
        if (!/^\d{6}$/.test(pin)) { setErr("ckPin", "Enter a valid 6-digit pincode"); $("ckPin").focus(); return; }
        await revealFromPin(pin); return;
      }
      if (!validateAddr()) return;
      if (!($("ckWa") && $("ckWa").checked)) {
        const er = $("ckWaErr"); if (er) er.style.display = "block";
        $("ckWa").scrollIntoView({ block: "center", behavior: "smooth" }); return;
      }
      if (S.pinInfo && S.pinInfo.pin === $("ckPin").value.trim() && !S.pinInfo.serviceable) {
        setErr("ckPin", "Sorry, we can't deliver to this pincode yet"); $("ckPin").focus(); return;
      }
      const mob = $("ckMob") ? digits($("ckMob").value) : "";
      const rec = {
        id: S.editing ? S.editing.id : newId(),
        pin: $("ckPin").value.trim(), city: $("ckCity").value.trim(), state: $("ckState").value.trim(),
        flat: $("ckFlat").value.trim(), area: $("ckArea").value.trim(),
        landmark: $("ckLandmark").value.trim(),
        name: $("ckName").value.trim(), email: $("ckMail").value.trim(),
        phone: mob ? "+91" + mob : (S.user && S.user.phoneNumber) || "",
        label: (document.querySelector('input[name="ckLbl"]:checked') || {}).value || "home",
        waOptIn: !!($("ckWa") && $("ckWa").checked)
      };
      const i = S.addrs.findIndex(x => x.id === rec.id);
      if (i > -1) S.addrs[i] = rec; else S.addrs.push(rec);
      if (($("ckDef") && $("ckDef").checked) || !S.addrs.some(x => x.id === S.defId)) S.defId = rec.id;   // first address is always the default
      S.addr = rec; S.pickedId = rec.id; S.editing = null;
      persistAddrs();
      ensurePin();
      S.step = "summary"; render(); flash("Your address has been saved successfully.");
    }
    else if (a === "addrList") {
      try { localStorage.setItem("aura_tip_seen", "1"); } catch (err) { }
      S.step = "addrlist"; render();
    }
    else if (a === "pickAddr") {
      const x = S.addrs.find(v => v.id === id); if (!x) return;
      S.addr = x; S.pickedId = x.id; S.step = "summary"; ensurePin(); render();
    }
    else if (a === "addNew") {
      if (S.addrs.length >= MAX_ADDR) return toast(`You can save up to ${MAX_ADDR} addresses`, true);
      S.editing = null; S.reveal = false; S.addrFrom = "list"; S.step = "address"; render();
    }
    else if (a === "editAddrId") {
      const x = S.addrs.find(v => v.id === id); if (!x) return;
      S.editing = x; S.reveal = true; S.addrFrom = "list"; S.step = "address"; render();
    }
    else if (a === "editAddr") { S.editing = S.addr; S.reveal = true; S.addrFrom = "summary"; S.step = "address"; render(); }
    else if (a === "setDef") {
      S.defId = id; persistAddrs();
      delete $("ckSheet").dataset.built; render(); toast("Default address updated");
    }
    else if (a === "delAddr") {
      if (!confirm("Delete this address?")) return;
      S.addrs = S.addrs.filter(v => v.id !== id);
      if (S.defId === id) S.defId = S.addrs[0] ? S.addrs[0].id : "";
      if (S.addr && S.addr.id === id) { S.addr = S.addrs.find(v => v.id === S.defId) || S.addrs[0] || null; S.pickedId = ""; }
      persistAddrs();
      if (!S.addrs.length) { S.addr = null; S.editing = null; S.reveal = false; S.addrFrom = "summary"; S.step = "address"; }
      else delete $("ckSheet").dataset.built;
      render(); toast("Address deleted");
    }
    else if (a === "method") { S.method = S.method === b.dataset.m ? null : b.dataset.m; S.tip = false; S.qrShown = false; render(); }
    else if (a === "showQr") { S.qrShown = true; render(); }
    else if (a === "cod") {
      if (S.busy || !CFG.codEnabled) return;
      const m = await checkStock(); if (m) return toast(m, true);
      placeOrder("cod");
    }
    else if (a === "pay") {
      const m = await checkStock(); if (m) return toast(m, true);
      if (CFG.gateway === "payu") payOnlinePayu(); else payOnline();
    }
    else if (a === "upi") {
      const m = await checkStock(); if (m) return toast(m, true);
      S.method = "upi"; S.step = "upi"; render();
    }
    else if (a === "copyUpi") {
      try { await navigator.clipboard.writeText(CFG.upiId); toast("UPI ID copied"); }
      catch (err) { toast("Copy failed. UPI ID: " + CFG.upiId, true); }
    }
    else if (a === "upiPaid") {
      if (S.busy) return;
      const utr = digits($("ckUtr").value);
      if (utr.length !== 12) { setErr("ckUtr", "Enter the 12-digit UTR / Transaction ID"); $("ckUtr").focus(); return; }
      S.utr = utr;
      placeOrder("upi", utr, true);
    }
    else if (a === "retryIntent") {
      const it = S.paidFail; if (!it || S.busy) return;
      S.busy = true; render();
      const v = await verifyPayu(it.txnid, 3);
      S.busy = false;
      if (v && amountOk(v, it)) completeIntent(it, v);
      else { render(); toast("Still confirming. Please try again in a minute. Don't pay again.", true); }
    }
    else if (a === "logout") { try { await FB.signOut(FB.auth); } catch (err) { console.error(err); } }
    else if (a === "track") { location.href = CFG.trackUrl; }
  });

  root.addEventListener("input", e => {
    const id = e.target.id;
    if (id === "ckPhone" && !e.target.readOnly) {
      const d = digits(e.target.value).slice(0, 10); S.phoneDraft = d; e.target.value = g55(d);
      const er = $("ckPhErr"); if (er) er.textContent = "";
    }
    if (id === "ckWa") { const er = $("ckWaErr"); if (er) er.style.display = e.target.checked ? "none" : "block"; }
    if (id === "ckMob") e.target.value = digits(e.target.value).slice(0, 10);
    if (id === "ckUtr") { const d = digits(e.target.value).slice(0, 12); e.target.value = d; S.utr = d; }
    if (id === "ckPin") {
      const pin = digits(e.target.value).slice(0, 6); e.target.value = pin; setErr("ckPin", "");
      if (pin.length === 6) revealFromPin(pin); else lockCityState(false);
    }
    if (e.target.closest(".ck-f")) setErr(id, "");
  });

  root.addEventListener("keydown", e => {
    if (e.key !== "Enter") return;
    if (e.target.id === "ckPhone" && !e.target.readOnly) root.querySelector('[data-a="login"]')?.click();
    if (e.target.id === "ckPin") root.querySelector('[data-a="saveAddr"]')?.click();
    if (e.target.id === "ckUtr") root.querySelector('[data-a="upiPaid"]')?.click();
  });
  document.addEventListener("keydown", e => { if (e.key === "Escape" && S.open) close(); });

  /* any button with data-aura-checkout opens the popup */
  document.addEventListener("click", e => {
    const b = e.target.closest("[data-aura-checkout]"); if (!b) return;
    e.preventDefault();
    let item = null; try { item = b.dataset.item ? JSON.parse(b.dataset.item) : null; } catch (err) { }
    open(item ? { items: [item] } : {});
  });

  /* ---------- follow login / logout ---------- */
  if (FB.onAuthStateChanged && FB.auth) {
    FB.onAuthStateChanged(FB.auth, u => {
      S.user = u || null;
      authResolve();
      if (S.open) { if (!u) S.step = "login"; route(); }
      else if (u && pending) { const p = pending; pending = null; open(p); }
      if (u && resume) { const r = resume; resume = null; handleReturn(r.it, r.st); }
      else if (u) setTimeout(recoverPayments, 4000);     // paid but never came back? finish that order now
    });
  } else authResolve();

  window.AuraCheckout = { open, close, buyNow: item => open({ items: [item] }) };

  /* back from PayU? finish the order */
  finishPayu();
})();