/* AURA nav-menu.js  ->  put in user/js/nav-menu.js
   Makes the Shop dropdown (desktop) and the mobile menu EXACTLY like index.html on any page.
   Add this ONE line right AFTER the mobile menu (<div class="mmenu" id="mmenu"> ... </div>) in each page:
       <script src="js/nav-menu.js"></script>
*/
(function () {
  if (window.__auraNavMenu) return;
  window.__auraNavMenu = true;

  /* ---------- CSS (same as index.html mobile menu + arrow fix) ---------- */
  var css = `
    .mmenu { box-sizing: border-box; overflow-y: auto; -webkit-overflow-scrolling: touch; max-height: 100dvh; padding: 24px 20px; }
    .mmenu a, .mmenu button { box-sizing: border-box; max-width: 100%; }
    .mmenu-logo img { display: block; max-width: 140px; height: auto; }
    .mmenu-icons { display: flex; align-items: center; flex-wrap: wrap; gap: 16px; }
    .m-dropdown { width: 100%; }
    .m-dropdown-toggle { width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 12px; text-align: left; cursor: pointer; }
    .m-dropdown-menu { display: none; width: 100%; box-sizing: border-box; padding-left: 14px; }
    .m-dropdown.open > .m-dropdown-menu { display: block; }
    .m-dropdown-menu a { display: block; width: 100%; padding: 12px 10px; overflow-wrap: anywhere; }
    .m-dropdown-toggle i { transition: transform .3s ease, color .3s ease; transform: rotate(0deg); }
    .m-dropdown.open > .m-dropdown-toggle i,
    .m-dropdown-sub.open > .m-sub-toggle i { transform: rotate(180deg) !important; color: var(--rose, #a3194a) !important; }
    @media (max-width: 768px) {
      .mmenu { width: min(88vw, 360px); }
      .mmenu a, .mmenu button { font-size: 15px; }
    }
  `;
  var st = document.createElement("style");
  st.setAttribute("data-aura-nav", "");
  st.textContent = css;
  document.head.appendChild(st);

  var CHEV = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><use href="#i-chev" /></svg>';

  /* ---------- DESKTOP: Shop dropdown ---------- */
  var DESKTOP = `
    <a href="shop.html?cat=kurta-sets" role="menuitem">Kurta Sets</a>
    <a href="shop.html?cat=tops" role="menuitem">Tops</a>
    <a href="shop.html?cat=college-wear" role="menuitem">College Wear</a>
    <a href="shop.html?cat=office-wear" role="menuitem">Office Wear</a>
    <a href="shop.html?cat=jump-suit" role="menuitem">Jump Suits</a>
    <a href="shop.html?cat=night-suits" role="menuitem">Night Suits</a>
    <div class="dd-sub">
      <button type="button" class="dd-sub-toggle" aria-expanded="false"><span>Dresses</span>${CHEV}</button>
      <div class="dd-sub-list">
        <a href="shop.html?cat=dresses&type=maxi-dresses" role="menuitem">Maxi Dresses</a>
        <a href="shop.html?cat=dresses&type=casual-dresses" role="menuitem">Casual Dresses</a>
        <a href="shop.html?cat=dresses&type=floral-dresses" role="menuitem">Floral Dresses</a>
      </div>
    </div>
    <div class="dd-sub">
      <button type="button" class="dd-sub-toggle" aria-expanded="false"><span>Bottomwear</span>${CHEV}</button>
      <div class="dd-sub-list">
        <a href="shop.html?cat=leggings" role="menuitem">Leggings</a>
        <a href="shop.html?cat=palazzo" role="menuitem">Palazzo</a>
      </div>
    </div>
    <a href="shop.html?cat=shawls" role="menuitem">Shawls</a>
    <a href="shop.html?cat=t-shirt" role="menuitem">T-shirt</a>
    <a href="shop.html" role="menuitem" class="dd-all">View all products</a>
  `;

  /* ---------- MOBILE: Shop dropdown (with Dresses + Bottomwear inside) ---------- */
  var MOBILE = `
    <div class="m-dropdown" data-aura-shop>
      <button type="button" class="m-dropdown-toggle" aria-expanded="false">
        <span>Shop</span><i class="fa-solid fa-chevron-down"></i>
      </button>
      <div class="m-dropdown-menu">
        <a href="shop.html?cat=kurta-sets">Kurta Sets</a>
        <a href="shop.html?cat=tops">Tops</a>
        <a href="shop.html?cat=college-wear">College Wear</a>
        <a href="shop.html?cat=office-wear">Office Wear</a>
        <a href="shop.html?cat=jump-suit">Jump Suits</a>
        <a href="shop.html?cat=night-suits">Night Suits</a>

        <div class="m-dropdown m-dropdown-sub">
          <button type="button" class="m-dropdown-toggle m-sub-toggle" aria-expanded="false">
            <span>Dresses</span><i class="fa-solid fa-chevron-down"></i>
          </button>
          <div class="m-dropdown-menu">
            <a href="shop.html?cat=dresses&type=maxi-dresses">Maxi Dresses</a>
            <a href="shop.html?cat=dresses&type=casual-dresses">Casual Dresses</a>
            <a href="shop.html?cat=dresses&type=floral-dresses">Floral Dresses</a>
          </div>
        </div>

        <div class="m-dropdown m-dropdown-sub">
          <button type="button" class="m-dropdown-toggle m-sub-toggle" aria-expanded="false">
            <span>Bottomwear</span><i class="fa-solid fa-chevron-down"></i>
          </button>
          <div class="m-dropdown-menu">
            <a href="shop.html?cat=leggings">Leggings</a>
            <a href="shop.html?cat=palazzo">Palazzo</a>
          </div>
        </div>

        <a href="shop.html?cat=shawls">Shawls</a>
        <a href="shop.html?cat=t-shirt">T-shirt</a>
        <a href="shop.html">View All Products</a>
      </div>
    </div>
  `;

  function build() {
    /* desktop */
    var dm = document.querySelector("#shopDD .dd-menu");
    if (dm) dm.innerHTML = DESKTOP;

    /* mobile: remove the old Shop / Bottomwear dropdowns, put the new one before "Track Order" */
    var mm = document.getElementById("mmenu");
    if (mm) {
      Array.prototype.slice.call(mm.children).forEach(function (el) {
        if (el.classList && el.classList.contains("m-dropdown")) el.remove();
      });
      var holder = document.createElement("div");
      holder.innerHTML = MOBILE;
      var node = holder.firstElementChild;
      var track = mm.querySelector('a[href$="trackorder.html"]');
      if (track) mm.insertBefore(node, track); else mm.appendChild(node);
    }
  }

  if (document.getElementById("mmenu") || document.getElementById("shopDD")) build();
  else document.addEventListener("DOMContentLoaded", build);

  /* ---------- CLICK HANDLERS (capture phase, so old page handlers never double-toggle) ---------- */
  document.addEventListener("click", function (e) {
    /* mobile: Shop / Dresses / Bottomwear */
    var btn = e.target.closest("#mmenu .m-dropdown-toggle");
    if (btn) {
      e.preventDefault();
      e.stopPropagation();
      var box = btn.parentElement;
      var willOpen = !box.classList.contains("open");
      box.parentElement.querySelectorAll(":scope > .m-dropdown.open").forEach(function (s) {
        if (s === box) return;
        s.classList.remove("open");
        var t = s.querySelector(":scope > .m-dropdown-toggle");
        if (t) t.setAttribute("aria-expanded", "false");
      });
      box.classList.toggle("open", willOpen);
      btn.setAttribute("aria-expanded", willOpen ? "true" : "false");
      return;
    }

    /* desktop: Dresses / Bottomwear sub menus */
    var sb = e.target.closest("#shopDD .dd-sub-toggle");
    if (sb) {
      e.preventDefault();
      e.stopPropagation();
      var sub = sb.parentElement;
      var open = !sub.classList.contains("open");
      document.querySelectorAll("#shopDD .dd-sub.open").forEach(function (s) {
        s.classList.remove("open");
        var t = s.querySelector(".dd-sub-toggle");
        if (t) t.setAttribute("aria-expanded", "false");
      });
      if (open) { sub.classList.add("open"); sb.setAttribute("aria-expanded", "true"); }
    }
  }, true);
})();