//CART Drawer from User Side
/* AURA — cart-drawer.js
   HAY-style slide-in cart on EVERY page. No HTML needed — it injects itself.
   Add before </body> on every page:  <script src="js/cart-drawer.js"></script>
   Cart data: localStorage "aura_cart" = [{id,name,price,mrp?,image,size,color?,qty,gift?}] */
(function () {
  "use strict";
  var KEY = "aura_cart", META = "aura_cart_meta";
  
  var TIERS = [
    { at: 999, label: "Exclusive Collection", icon: "fa-star", pos: 16 },    
    { at: 3000, label: "10% OFF", icon: "fa-percent", pos: 53, pct: 10 },
    { at: 5000, label: "20% OFF", icon: "fa-gift", pos: 90, pct: 20 }
  ];
  var PH = "../images/partywear.webp", B = document.body, internal = false, dr;

  function $(s, r) { return (r || document).querySelector(s); }
  function inr(n) { return "₹" + Number(n || 0).toLocaleString("en-IN"); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function read() { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) { return []; } }
  function meta() { try { return JSON.parse(localStorage.getItem(META)) || {}; } catch (e) { return {}; } }
  function setMeta(m) { try { localStorage.setItem(META, JSON.stringify(m)); } catch (e) { } }
  function count(c) { return (c || read()).reduce(function (s, i) { return s + (Number(i.qty) || 1); }, 0); }
  function write(c) { internal = true; try { localStorage.setItem(KEY, JSON.stringify(c)); } catch (e) { } internal = false; paint(); }

  function totals(c) {
    var sub = 0, gift = 0;
    c.forEach(function (i) { sub += (Number(i.price) || 0) * (Number(i.qty) || 1); gift += Number(i.gift) || 0; });
    
    // 🔥 UPDATED CALCULATION (Handles both flat and percentage) 🔥
    var pct = 0, flat = 0;
    TIERS.forEach(function (t) { 
        if (t.pct && sub >= t.at) pct = t.pct; 
        if (t.flat && sub >= t.at) flat = t.flat;
    });
    var disc = Math.round(sub * pct / 100) + flat;
    
    return { sub: sub, gift: gift, pct: pct, flat: flat, disc: disc, pay: Math.max(0, sub - disc + gift) };
  }
  
  function bannerText(s) {
    // 🔥 UPDATED BANNER TEXT (Removed Free Shipping) 🔥
    if (s >= 5000) return "You got <b>20% OFF</b> + ₹100 OFF!";
    if (s >= 3000) return "Shop <b>" + inr(5000 - s) + "</b> more to get <b>20% OFF</b>!";
    if (s >= 999) return "Shop <b>" + inr(3000 - s) + "</b> more to get <b>10% OFF</b>!";
    return "Shop <b>" + inr(999 - s) + "</b> more to get <b>₹100 OFF</b>!";
  }
  
  function fillPct(s) {
    if (s <= 0) return 0;
    if (s < 999) return s / 999 * 16;
    if (s < 3000) return 16 + (s - 999) / 2001 * 37;
    if (s < 5000) return 53 + (s - 3000) / 2000 * 37;
    return 100;
  }

  function build() {
    var h = '<div class="cd-ov" id="cdOv"></div>' +
      '<aside class="cd-dr" id="cdDr" role="dialog" aria-modal="true" aria-label="Shopping cart" aria-hidden="true">' +
      '<div class="cd-top"><h2>Shopping Cart (<span id="cdN">0</span>)</h2><button type="button" class="cd-x" id="cdX" aria-label="Close cart"><i class="fa-solid fa-xmark"></i></button></div>' +
      '<div class="cd-scroll" id="cdScroll">' +
      '<div class="cd-banner" id="cdBanner"></div>' +
      '<div class="cd-prog" id="cdProg">' +
      TIERS.map(function (t) { return '<span class="cd-pl" style="left:' + t.pos + '%">' + t.label + '</span>'; }).join("") +
      '<div class="cd-track"><i id="cdFill"></i></div>' +
      TIERS.map(function (t, k) { return '<span class="cd-ms" data-k="' + k + '" style="left:' + t.pos + '%"><i class="fa-solid ' + t.icon + '"></i></span>'; }).join("") +
      TIERS.map(function (t) { return '<span class="cd-pa" style="left:' + t.pos + '%">' + inr(t.at) + '</span>'; }).join("") +
      '</div><div class="cd-body" id="cdBody"></div></div>' +
      '<div class="cd-foot" id="cdFoot">' +
      '<button type="button" class="cd-note-t" id="cdNoteT"><i class="fa-solid fa-pencil"></i> NOTE</button>' +
      '<textarea id="cdNote" rows="2" hidden placeholder="Add a note for your order…"></textarea>' +
      '<h3 class="cd-sum">Order Summary</h3><div class="cd-lines" id="cdLines"></div>' +
      '<div class="cd-pay"><span>You Pay:</span><b id="cdPay">₹0</b></div>' +
      // 🔥 GIFT CARD BUTTON REMOVED HERE (As per your previous request) 🔥
      '<button type="button" class="cd-go" id="cdGo">CHECKOUT</button>' +
      '<div class="cd-trust"><div><i class="fa-solid fa-money-bill-wave"></i><span>CASH ON<br>DELIVERY</span></div>' +
      '<div><i class="fa-solid fa-truck-fast"></i><span>24 HOURS<br>SHIPPING</span></div>' +
      '<div><i class="fa-solid fa-arrows-rotate"></i><span>HASSLE FREE<br>EXCHANGE</span></div></div>' +
      '</div></aside>';
    var w = document.createElement("div"); w.innerHTML = h;
    while (w.firstChild) document.body.appendChild(w.firstChild);
    dr = $("#cdDr");
  }

  function paint() {
    if (!dr) { badge(); return; }
    var c = read(), t = totals(c), n = count(c);
    $("#cdN").textContent = n; badge();
    var empty = !c.length;
    $("#cdBanner").hidden = $("#cdProg").hidden = $("#cdFoot").hidden = empty;
    if (empty) {
      $("#cdBody").innerHTML = '<div class="cd-empty"><i class="fa-solid fa-cart-shopping"></i><h3>Your cart is empty</h3><p>Looks like you haven\'t added anything yet.</p><a class="cd-go" href="shop.html">CONTINUE SHOPPING</a></div>';
      return;
    }
    $("#cdBanner").innerHTML = bannerText(t.sub);
    $("#cdFill").style.width = fillPct(t.sub) + "%";
    dr.querySelectorAll(".cd-ms").forEach(function (m) { m.classList.toggle("on", t.sub >= TIERS[+m.dataset.k].at); });
    $("#cdBody").innerHTML = c.map(function (i) {
      var price = Number(i.price) || 0, mrp = Number(i.mrp) || 0, key = esc(i.id + "|" + (i.size || ""));
      return '<div class="cd-item" data-k="' + key + '">' +
        '<a class="cd-im" href="product.html?id=' + encodeURIComponent(i.id) + '"><img src="' + esc(i.image || PH) + '" alt="' + esc(i.name) + '" onerror="this.src=\'' + PH + '\'"></a>' +
        '<div class="cd-it"><div class="cd-nm"><a href="product.html?id=' + encodeURIComponent(i.id) + '">' + esc(i.name || "Product") + '</a>' +
        '<button type="button" class="cd-rx" data-rm aria-label="Remove"><i class="fa-solid fa-xmark"></i></button></div>' +
        (i.size ? '<p class="cd-at"><span>Size:</span> ' + esc(i.size) + '</p>' : '') +
        (i.color ? '<p class="cd-at"><span>Color:</span> ' + esc(i.color) + '</p>' : '') +
        '<div class="cd-pr">' + (mrp > price ? '<s>' + inr(mrp) + '</s>' : '') + '<b>' + inr(price) + '</b></div>' +
        (i.gift ? '<p class="cd-gift"><i class="fa-solid fa-gift"></i> Gift box +' + inr(i.gift) + '</p>' : '') +
        '<div class="cd-row"><div class="cd-qty"><button type="button" data-q="-1" aria-label="Decrease">−</button><span>' + (Number(i.qty) || 1) + '</span><button type="button" data-q="1" aria-label="Increase">+</button></div>' +
        '<button type="button" class="cd-rm" data-rm>Remove</button></div></div></div>';
    }).join("");
    var L = '<div><span>Subtotal</span><span>' + inr(t.sub) + '</span></div>';
    if (t.disc) L += '<div class="ok"><span>Cart discount</span><span>−' + inr(t.disc) + '</span></div>';
    if (t.gift) L += '<div><span>Gift box</span><span>' + inr(t.gift) + '</span></div>';
    
    // 🔥 SHIPPING LINE REMOVED / HIDDEN HERE 🔥
    // (Since you removed free shipping offer, shipping price is not shown here)
    
    $("#cdLines").innerHTML = L;
    $("#cdPay").textContent = inr(t.pay) + ".00";
  }
  function badge() { document.querySelectorAll("#cartBadge").forEach(function (b) { b.textContent = count(); }); }

  function open() {
    if (!dr) return; paint();
    var m = meta(); $("#cdNote").value = m.note || "";
    dr.classList.add("open"); $("#cdOv").classList.add("on"); dr.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden"; setTimeout(function () { $("#cdX").focus(); }, 300);
  }
  function close() {
    if (!dr) return;
    dr.classList.remove("open"); $("#cdOv").classList.remove("on"); dr.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }

  function openCheckout() {
    var t = totals(read()), m = meta();
    m.discountPct = t.pct; m.payable = t.pay; setMeta(m);
    close();
    if (window.AuraCheckout && typeof window.AuraCheckout.open === "function") {
      window.AuraCheckout.open();
    } else {
      setTimeout(function () {
        if (window.AuraCheckout) window.AuraCheckout.open();
        else alert("Checkout is loading, please try again.");
      }, 600);
    }
  }

  function bind() {
    $("#cdX").addEventListener("click", close);
    $("#cdOv").addEventListener("click", close);
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") close(); });
    $("#cdBody").addEventListener("click", function (e) {
      var it = e.target.closest(".cd-item"); if (!it) return;
      var c = read(), parts = it.dataset.k.split("|"), idx = c.findIndex(function (x) { return String(x.id) === parts[0] && String(x.size || "") === parts[1]; });
      if (idx < 0) return;
      if (e.target.closest("[data-rm]")) c.splice(idx, 1);
      var q = e.target.closest("[data-q]");
      if (q) { c[idx].qty = (Number(c[idx].qty) || 1) + Number(q.dataset.q); if (c[idx].qty < 1) c.splice(idx, 1); }
      write(c);
    });
    $("#cdNoteT").addEventListener("click", function () { var t = $("#cdNote"); t.hidden = !t.hidden; if (!t.hidden) t.focus(); });
    $("#cdNote").addEventListener("input", function () { var m = meta(); m.note = this.value; setMeta(m); });

    $("#cdGo").addEventListener("click", function (e) {
      e.preventDefault();
      openCheckout();
    });

    document.addEventListener("click", function (e) {
      var t = e.target.closest('#cartBtn, a.icon-btn[href$="cart.html"], .mmenu a[href$="cart.html"], [data-open-cart], .js-open-cart-drawer');
      if (!t) return;
      e.preventDefault(); e.stopPropagation();
      B.classList.remove("mmenu-open", "menu-open"); open();
    }, true);

    var _set = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k, v) {
      var before = (k === KEY && !internal) ? count() : 0;
      _set.apply(this, arguments);
      if (k === KEY && !internal) { paint(); if (count() > before) open(); }
    };
    window.addEventListener("storage", function (e) { if (e.key === KEY) paint(); });
  }

  function init() { build(); bind(); paint(); window.AuraCart = { open, close, render: paint }; }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();