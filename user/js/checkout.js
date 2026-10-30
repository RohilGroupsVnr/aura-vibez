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
    logo: "../assets/logo.png",
    freeShipOver: 999,
    shipFee: 60,
    prepaidOff: 40,
    codFee: 50,
    codEnabled: false,             // set true to show Cash on Delivery again
    razorpayKey: "",               // paste your Razorpay key_id to enable AUTOMATIC online payment (then QR step is skipped)
    /* ---- manual UPI QR (used while razorpayKey is empty) ---- */
    upiId: "sofiajohnsonece-2@oksbi",
    upiName: "Sofia Johnson",
    qrImage: "",                   // optional: your own QR image, e.g. "../assets/upi-qr.jpg". Empty = QR is generated with the exact amount
    trackUrl: "trackorder.html",
    coupons: { AURA10: { pct: 10 }, WELCOME100: { flat: 100, min: 999 } }
  }, window.AURA_CHECKOUT_CONFIG || {});

  /* ---------- helpers ---------- */
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const inr = n => "₹" + Number(n).toLocaleString("en-IN", { maximumFractionDigits: 0 });
  const money2 = n => { const p = Number(n).toFixed(2).split("."); return `₹${p[0]}<span class="dec">.${p[1]}</span>`; };
  const digits = s => String(s ?? "").replace(/\D/g, "");
  const num = v => Number(String(v ?? 0).replace(/[^\d.]/g, "")) || 0;
  const titleCase = s => String(s || "").toLowerCase().replace(/\b\w/g, c => c.toUpperCase());

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
    info: sv(13, 13, '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>', 2),
    check: sv(38, 38, '<path d="m5 12 5 5 9-10"/>', 3)
  };

  const PAY = [
    { id: "upi", name: "UPI", ico: I.upi },
    { id: "card", name: "Debit/Credit Cards", ico: I.card },
    { id: "netbanking", name: "Netbanking", ico: I.bank },
    { id: "wallet", name: "Wallets", ico: I.wallet },
    { id: "cod", name: "Cash on Delivery", ico: I.cod }
  ];
  /* manual mode (no razorpayKey): only UPI QR + COD. Card / Netbanking / Wallet come back automatically once razorpayKey is set */
  const manualMode = () => !CFG.razorpayKey;
  const payList = () => {
    let list = manualMode() ? PAY.filter(m => m.id === "upi" || m.id === "cod") : PAY;
    if (!CFG.codEnabled) list = list.filter(m => m.id !== "cod");   // COD hidden unless codEnabled: true
    return list;
  };

  /* ---------- state ---------- */
  const S = { open: false, step: "login", items: [], buyNow: false, user: null, addr: null, coupon: null, method: null, busy: false, itemsOpen: false, tip: true, order: null, phoneDraft: "", msgI: 0, reveal: false, utr: "" };
  let authResolve, pending = null, ribbonTimer, toastTimer, flashTimer;
  const authReady = new Promise(r => (authResolve = r));

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
  function discountAmt(sub) { const c = S.coupon; if (!c) return 0; return Math.min(sub, c.pct ? Math.round(sub * c.pct / 100) : (c.flat || 0)); }
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

  /* ---------- saved address (per user) ---------- */
  const addrKey = () => "aura_addr_" + (S.user ? S.user.uid : "guest");
  function loadAddr() { try { const a = JSON.parse(localStorage.getItem(addrKey()) || "{}"); S.addr = a[a.last] || null; } catch (e) { S.addr = null; } }
  function saveAddr(a) {
    let all = {}; try { all = JSON.parse(localStorage.getItem(addrKey()) || "{}"); } catch (e) { }
    all[a.label] = a; all.last = a.label;
    try { localStorage.setItem(addrKey(), JSON.stringify(all)); } catch (e) { }
    S.addr = a;
  }

  /* ---------- open / close ---------- */
  async function open(opts = {}) {
    await authReady;
    S.items = (opts.items || readCart()).map(normItem);
    S.buyNow = !!opts.items;
    if (!S.items.length) { alert("Your bag is empty."); return; }
    S.coupon = opts.coupon || null; S.method = null; S.itemsOpen = false; S.tip = true; S.order = null; S.utr = "";
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
    if (S.step === "done" && S.order) return render();
    if (!S.user) { S.step = "login"; S.addr = null; }
    else { loadAddr(); S.step = S.addr ? "summary" : "address"; S.reveal = !!S.addr; }
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

    /* the address sheet slides up over the page behind it (like HAY) */
    const base = S.step === "address" ? (S.addr ? "summary" : "login") : S.step;
    ({ login: viewLogin, summary: viewSummary, upi: viewUpi, done: viewDone })[base]();

    const sheet = $("ckSheet"), showSheet = S.step === "address";
    $("ckDim").classList.toggle("on", showSheet);
    if (showSheet) {
      if (!sheet.dataset.built) { viewSheet(); sheet.dataset.built = "1"; requestAnimationFrame(() => requestAnimationFrame(() => sheet.classList.add("show"))); }
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

  function viewSheet() {
    const a = S.addr || {}, u = S.user || {};
    const needPhone = !u.phoneNumber;
    const sheet = $("ckSheet");
    sheet.classList.toggle("rev", S.reveal);
    sheet.innerHTML = `
      <div class="ck-sheet-b">
        <p class="ck-title">Add Delivery Address</p>
        <p class="ck-sub">Shipping Address</p>
        ${F("ckPin", "Pincode *", a.pin || "", { mode: "numeric", max: 6, ac: "postal-code" })}
        <div class="ck-more">
          <div class="ck-2">${F("ckCity", "City *", a.city || "", { ac: "address-level2" })}${F("ckState", "State *", a.state || "", { ac: "address-level1" })}</div>
          ${F("ckFlat", "Flat, House no. *", a.flat || "", { ac: "address-line1" })}
          ${F("ckArea", "Apartment, Area, Sector, Village *", a.area || "", { ac: "address-line2" })}
          ${F("ckLandmark", "Landmark (Optional)", a.landmark || "", { ac: "off" })}
          <p class="ck-title" style="margin-top:14px">Customer Information</p>
          ${F("ckName", "Full Name *", a.name || u.displayName || "", { ac: "name" })}
          ${F("ckMail", "Email Address *", a.email || u.email || "", { type: "email", ac: "email" })}
          ${needPhone ? F("ckMob", "Mobile Number *", ten(a.phone || S.phoneDraft), { mode: "numeric", max: 10, ac: "tel-national" }) : ""}
          <p class="ck-title" style="margin-top:14px">Save Address As</p>
          <div class="ck-save">
            <label class="ck-pillr"><input type="radio" name="ckLbl" value="home" ${(a.label || "home") === "home" ? "checked" : ""}>Home<i></i></label>
            <label class="ck-pillr"><input type="radio" name="ckLbl" value="work" ${a.label === "work" ? "checked" : ""}>Work<i></i></label>
          </div>
          <p class="ck-help">${I.info} Please enter the complete address for smooth delivery.</p>
        </div>
      </div>
      <div class="ck-sheet-f"><button type="button" class="ck-btn" data-a="saveAddr">Continue</button></div>`;
    if (a.pin) lockCityState(true);
    if (!S.reveal) setTimeout(() => $("ckPin") && $("ckPin").focus(), 380);
  }

  function viewSummary() {
    const a = S.addr, t = calc(), u = S.user, p = phoneOf();
    $("ckBody").innerHTML = `
      <p class="ck-sec" style="margin-top:4px">Delivery details</p>
      <div class="ck-card"><div class="ck-del">
        ${I.pin}
        <div><b>Deliver To ${esc(a.name)}</b><p class="ad">${esc(a.flat)}, ${esc(a.area)}</p>
        ${a.landmark ? `<p class="ad" style="font-size:12px; color:#666;">Landmark: ${esc(a.landmark)}</p>` : ""}
        <p>${esc(titleCase(a.state))}, ${esc(a.pin)}</p><p class="ph">${p ? esc(pCompact(p)) + " &nbsp;|&nbsp; " : ""}${esc(a.email)}</p></div></div>

      <p class="ck-sec">Price details</p>
      <div class="ck-card"><div class="ck-rows">
        <div><span>Subtotal</span><span>${inr(t.sub)}</span></div>
        <div><span>Shipping</span><span>${t.ship ? inr(t.ship) : "Free"}</span></div>
        ${t.disc ? `<div class="g"><span>Coupon discount</span><span>− ${inr(t.disc)}</span></div>` : ""}
        ${t.pre ? `<div class="g"><span>Prepaid discount</span><span>− ${inr(t.pre)}</span></div>` : ""}
        ${t.cod ? `<div><span>COD fee</span><span>${inr(t.cod)}</span></div>` : ""}
        <div class="t"><span>${S.method ? "Total payable" : "Total"}</span><span>${inr(t.total)}</span></div>
      </div></div>

      <p class="ck-sec">Payment options</p>
      <p class="ck-banner">Extra ${inr(CFG.prepaidOff)} off on Prepaid</p>
      <div class="ck-pays">${payList().map(payRow).join("")}</div>

      <div class="ck-login"><div>${I.user}<span>Logged in using ${esc(pGroup(p) || (u && u.email) || "your account")}</span></div><button type="button" data-a="logout">Logout</button></div>
      <p class="ck-fine">By proceeding, you agree to AURA's <a href="privacy-policy.html">Privacy Policy</a> and <a href="terms.html">T&amp;C</a></p>`;
    $("ckFoot").innerHTML = "";
  }

  function payRow(m) {
    const prepaid = m.id !== "cod", t = calc(m.id), open = S.method === m.id;
    /* prepaid -> automatic Razorpay when a key is set, otherwise the manual UPI QR screen */
    const act = !prepaid ? "cod" : (CFG.razorpayKey ? "pay" : "upi");
    const label = !prepaid ? `Place order · ${inr(t.total)}` : (CFG.razorpayKey ? `Pay ${inr(t.total)}` : `Pay ${inr(t.total)} with UPI QR`);
    const note = !prepaid ? "Pay in cash when your order arrives." : (CFG.razorpayKey ? "You'll complete the payment in a secure window." : "Scan the QR with any UPI app (GPay, PhonePe, Paytm…).");
    return `<div class="ck-pay ${open ? "open" : ""}">
      <button type="button" class="ck-pay-h" data-a="method" data-m="${m.id}" aria-expanded="${open}">
        <span class="ico">${m.ico}</span>
        <span class="nm"><b>${m.name}</b>${prepaid ? `<em class="ok">Get ${inr(CFG.prepaidOff)} off</em>` : `<em class="bad">${inr(CFG.codFee)} COD fee added</em>`}</span>
        <span class="amt">${prepaid ? `<s>${money2(t.base)}</s>` : ""}<b>${money2(t.total)}</b></span>
        ${open ? I.down : I.right}
      </button>
      ${open ? `<div class="ck-pay-b"><button type="button" class="ck-btn" data-a="${act}" ${S.busy ? "disabled" : ""}>${label}</button><p class="ck-note">${note}</p></div>` : ""}
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
      <p>${o.paymentMethod === "cod" ? "Pay " + inr(o.total) + " in cash on delivery." : manual ? "Payment of " + inr(o.total) + " submitted (Ref " + esc(o.paymentId) + "). We'll confirm it shortly." : "Payment of " + inr(o.total) + " received."}</p></div>`;
    $("ckFoot").innerHTML = `<button type="button" class="ck-btn" data-a="track">Track order</button><button type="button" class="ck-btn line" style="margin-top:10px" data-a="close">Continue shopping</button>`;
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
  async function revealFromPin(pin) {
    const r = await lookupPin(pin);
    if (!$("ckPin") || $("ckPin").value.trim() !== pin) return;
    if (r) { $("ckCity").value = r.city; $("ckState").value = r.state; lockCityState(true); setErr("ckCity", ""); setErr("ckState", ""); }
    else { lockCityState(false); toast("Couldn't find that pincode. Please enter city and state."); }
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
        const v = (p.variants || {})[it.color];
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
  /* manual = true  -> customer paid by scanning the QR, admin must verify the UTR (paymentStatus "verification") */
  async function placeOrder(method, paymentId, manual) {
    const t = calc(method), a = S.addr, d = digits(phoneOf());
    const order = {
      orderId: "",   // filled inside the transaction: AURA#01, AURA#02, ...
      uid: S.user.uid, phone: d.length === 10 ? "+91" + d : phoneOf(), email: a.email, customerName: a.name,
      address: a, items: S.items, subtotal: t.sub, shipping: t.ship, discount: t.disc, coupon: S.coupon ? S.coupon.code : "",
      prepaidDiscount: t.pre, codFee: t.cod, total: t.total,
      paymentMethod: method, paymentId: paymentId || "",
      paymentStatus: method === "cod" ? "pending" : (manual ? "verification" : "paid"),
      upiId: manual ? CFG.upiId : "",
      status: "pending",
      stockReduced: true     // admin uses this to give the stock back if the order is cancelled / payment rejected
    };
    S.busy = true; render();
    try {
      const { db, doc, collection, runTransaction, serverTimestamp } = FB;
      if (!db || !doc || !collection || !runTransaction)
        throw new Error("firebase.js must export db, doc, collection, runTransaction (and serverTimestamp)");

      const counterRef = doc(db, "counters", "orders");
      const orderRef = doc(collection(db, CFG.ordersCollection));   // auto document id

      await runTransaction(db, async tx => {
        /* ---- 1) ALL READS FIRST ---- */
        const counterSnap = await tx.get(counterRef);
        const ids = [...new Set(S.items.map(i => i.id))];
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
            const v = variants[it.color];
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
    } catch (err) {
      console.error("Order save failed:", err);
      S.busy = false; render();
      if (err && err.stock) {
        toast(err.message + (method !== "cod" && manual ? ". If you already paid, contact support with your UTR." : ""), true);
        S.step = "summary"; render();
      } else {
        toast("Couldn't place your order. Please try again.", true);
      }
      return;
    }
    S.busy = false; S.order = order; S.step = "done"; S.utr = "";
    if (!S.buyNow) { try { localStorage.removeItem(CFG.cartKey); } catch (e) { } }
    window.dispatchEvent(new CustomEvent("aura:order-placed", { detail: order }));
    render();
  }

  function loadRzp() {
    return new Promise((res, rej) => {
      if (window.Razorpay) return res();
      const s = document.createElement("script"); s.src = "https://checkout.razorpay.com/v1/checkout.js";
      s.onload = res; s.onerror = () => rej(new Error("gateway")); document.head.appendChild(s);
    });
  }
  async function payOnline() {
    if (!CFG.razorpayKey) { toast("Online payment isn't enabled yet. Please choose Cash on Delivery.", true); return; }
    try { await loadRzp(); } catch (e) { toast("Couldn't reach the payment gateway. Check your connection.", true); return; }
    const t = calc(), method = S.method, a = S.addr;
    new window.Razorpay({
      key: CFG.razorpayKey, amount: Math.round(t.total * 100), currency: "INR", name: "AURA", description: `${count()} item(s)`,
      prefill: { name: a.name, email: a.email, contact: ten(phoneOf()) }, theme: { color: "#A3194A" },
      handler: r => placeOrder(method, r.razorpay_payment_id)
    }).open();
  }

  /* ---------- events ---------- */
  root.addEventListener("click", async e => {
    if (e.target === root) return close();
    const b = e.target.closest("[data-a]"); if (!b) return;
    const a = b.dataset.a;
    if (a === "close") close();
    else if (a === "back") {
      if (S.step === "upi") { S.step = "summary"; render(); }
      else if (S.step === "address") { if (S.addr) { S.step = "summary"; render(); } else close(); }
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
      const mob = $("ckMob") ? digits($("ckMob").value) : "";
      saveAddr({
        pin: $("ckPin").value.trim(), city: $("ckCity").value.trim(), state: $("ckState").value.trim(),
        flat: $("ckFlat").value.trim(), area: $("ckArea").value.trim(),
        landmark: $("ckLandmark").value.trim(),
        name: $("ckName").value.trim(), email: $("ckMail").value.trim(),
        phone: mob ? "+91" + mob : (S.user && S.user.phoneNumber) || "",
        label: (document.querySelector('input[name="ckLbl"]:checked') || {}).value || "home"
      });
      S.step = "summary"; render(); flash("Your new address has been updated successfully.");
    }
    else if (a === "editAddr") { S.step = "address"; S.reveal = true; render(); }
    else if (a === "method") { S.method = S.method === b.dataset.m ? null : b.dataset.m; S.tip = false; render(); }
    else if (a === "cod") {
      if (S.busy || !CFG.codEnabled) return;
      const m = await checkStock(); if (m) return toast(m, true);
      placeOrder("cod");
    }
    else if (a === "pay") {
      const m = await checkStock(); if (m) return toast(m, true);
      payOnline();
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
    else if (a === "logout") { try { await FB.signOut(FB.auth); } catch (err) { console.error(err); } }
    else if (a === "track") { location.href = CFG.trackUrl; }
  });

  root.addEventListener("input", e => {
    const id = e.target.id;
    if (id === "ckPhone" && !e.target.readOnly) {
      const d = digits(e.target.value).slice(0, 10); S.phoneDraft = d; e.target.value = g55(d);
      const er = $("ckPhErr"); if (er) er.textContent = "";
    }
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
    });
  } else authResolve();

  window.AuraCheckout = { open, close, buyNow: item => open({ items: [item] }) };
})();