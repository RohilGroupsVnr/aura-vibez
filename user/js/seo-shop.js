/* AURA SEO helper (shop page) — additive only.
   Gives every category its own canonical URL and keeps internal search results out of the index.
   Does NOT touch product loading, filters, cart or Firebase code. */
(function () {
  "use strict";
  var BASE = "https://www.aura-vibez.com/user/shop.html";
  try {
    var p = new URLSearchParams(location.search);
    var cat = (p.get("cat") || "").trim(), type = (p.get("type") || "").trim();
    var q = (p.get("q") || "").trim();
    var url = BASE;
    if (cat) { url += "?cat=" + encodeURIComponent(cat); if (type) url += "&type=" + encodeURIComponent(type); }
    var can = document.querySelector('link[rel="canonical"]');
    if (!can) { can = document.createElement("link"); can.rel = "canonical"; document.head.appendChild(can); }
    can.href = url;
    function meta(attr, key, val) {
      var el = document.querySelector("meta[" + attr + '="' + key + '"]');
      if (!el) { el = document.createElement("meta"); el.setAttribute(attr, key); document.head.appendChild(el); }
      el.setAttribute("content", val);
    }
    meta("property", "og:url", url);
    if (q) meta("name", "robots", "noindex,follow");
    window.addEventListener("load", function () {
      setTimeout(function () {
        meta("property", "og:title", document.title);
        meta("name", "twitter:title", document.title);
      }, 600);
    });
  } catch (e) { /* never break the page */ }
})();
