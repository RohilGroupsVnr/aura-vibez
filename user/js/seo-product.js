/* AURA SEO helper (product page) — additive only, reads the DOM that product.html already renders.
   Adds: self-canonical per product, Open Graph tags, Product + BreadcrumbList JSON-LD.
   Does NOT touch cart, checkout, Firebase or any existing script. */
(function () {
  "use strict";
  var BASE = "https://www.aura-vibez.com";
  var done = 0;

  function $(id) { return document.getElementById(id); }
  function txt(id) { var e = $(id); return e ? (e.textContent || "").trim() : ""; }
  function meta(attr, key, val) {
    var el = document.querySelector("meta[" + attr + '="' + key + '"]');
    if (!el) { el = document.createElement("meta"); el.setAttribute(attr, key); document.head.appendChild(el); }
    el.setAttribute("content", val);
  }
  function abs(src) {
    try { if (!src || /^data:/i.test(src)) return ""; return new URL(src, BASE + "/user/product.html").href; }
    catch (e) { return ""; }
  }

  function build() {
    try {
      var name = txt("pdName");
      var id = new URLSearchParams(location.search).get("id") || "";
      if (!name || /^loading/i.test(name)) return false;

      if (/not found/i.test(name) || /not found/i.test(document.title)) {
        meta("name", "robots", "noindex,follow");
        return true;
      }

      var url = BASE + "/user/product.html" + (id ? "?id=" + encodeURIComponent(id) : "");
      var desc = (document.querySelector('meta[name="description"]') || {}).content || ("Buy " + name + " online at AURA.");
      var priceEl = document.querySelector("#pdPrice span");
      var priceNum = priceEl ? (priceEl.textContent || "").replace(/[^\d.]/g, "") : "";
      var imgEl = document.querySelector("#pdSlider img");
      var img = imgEl ? abs(imgEl.getAttribute("src")) : "";
      var cart = $("pdCartBtn");
      var inStock = !(cart && /sold out|out of stock/i.test(cart.textContent || ""));

      var can = document.querySelector('link[rel="canonical"]');
      if (!can) { can = document.createElement("link"); can.rel = "canonical"; document.head.appendChild(can); }
      can.href = url;

      meta("property", "og:type", "product");
      meta("property", "og:title", document.title);
      meta("property", "og:description", desc);
      meta("property", "og:url", url);
      if (img) { meta("property", "og:image", img); meta("name", "twitter:image", img); meta("property", "og:image:alt", name); }
      meta("name", "twitter:title", document.title);
      meta("name", "twitter:description", desc);

      var product = {
        "@type": "Product", "@id": url + "#product", "name": name, "description": desc, "url": url,
        "brand": { "@type": "Brand", "name": "AURA" }, "sku": id || undefined
      };
      if (img) product.image = [img];
      if (priceNum) {
        product.offers = {
          "@type": "Offer", "url": url, "priceCurrency": "INR", "price": priceNum,
          "availability": inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
          "itemCondition": "https://schema.org/NewCondition",
          "seller": { "@type": "Organization", "name": "AURA" }
        };
      }
      var data = {
        "@context": "https://schema.org",
        "@graph": [product, {
          "@type": "BreadcrumbList", "itemListElement": [
            { "@type": "ListItem", "position": 1, "name": "Home", "item": BASE + "/" },
            { "@type": "ListItem", "position": 2, "name": "Shop", "item": BASE + "/user/shop.html" },
            { "@type": "ListItem", "position": 3, "name": name, "item": url }]
        }]
      };
      var s = $("auraProductJsonLd");
      if (!s) { s = document.createElement("script"); s.type = "application/ld+json"; s.id = "auraProductJsonLd"; document.head.appendChild(s); }
      s.textContent = JSON.stringify(data);
      return !!priceNum;
    } catch (e) { return false; }
  }

  function start() {
    var t;
    var mo = new MutationObserver(function () {
      clearTimeout(t);
      t = setTimeout(function () { if (build()) done++; }, 400);
    });
    mo.observe(document.body, { childList: true, subtree: true, characterData: true });
    build();
    setTimeout(function () { mo.disconnect(); build(); }, 20000);
  }
  if (document.body) start(); else document.addEventListener("DOMContentLoaded", start);
})();
