/* =====================================================================
   AURA COMMON NAVBAR
   File: user/js/navbar.js

   Include on every user page:
   <script src="js/navbar.js" data-active="home"></script>

   data-active: home | new | shop | track | account
   data-ann="off": hides announcement bar
   ===================================================================== */

(function () {
  if (window.__auraNav) return;
  window.__auraNav = true;

  var me = document.currentScript;
  var ACTIVE = (me && me.dataset.active) || "";
  var SHOW_ANN = !(me && me.dataset.ann === "off");

  /* ---------- SHOP MENU ---------- */
  var SHOP = [
    { t: "Kurta Sets", h: "shop.html?cat=kurta-sets" },
    { t: "Tops", h: "shop.html?cat=tops" },
    { t: "College Wear", h: "shop.html?cat=college-wear" },
    { t: "Office Wear", h: "shop.html?cat=office-wear" },
    { t: "Jump Suits", h: "shop.html?cat=jump-suit" },
    { t: "Night Suits", h: "shop.html?cat=night-suits" },
    {
      t: "Dresses",
      sub: [
        { t: "Maxi Dresses", h: "shop.html?cat=dresses&type=maxi-dresses" },
        { t: "Casual Dresses", h: "shop.html?cat=dresses&type=casual-dresses" },
        { t: "Floral Dresses", h: "shop.html?cat=dresses&type=floral-dresses" }
      ]
    },
    {
      t: "Bottomwear",
      sub: [
        { t: "Leggings", h: "shop.html?cat=leggings" },
        { t: "Palazzo", h: "shop.html?cat=palazzo" }
      ]
    },
    { t: "Shawls", h: "shop.html?cat=shawls" },
    { t: "T-shirt", h: "shop.html?cat=t-shirt" }
  ];

  var ALL = { t: "View all products", h: "shop.html" };

  /* ---------- ICON SPRITE ---------- */
  var SPRITE =
    '<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>' +
    '<symbol id="i-heart" viewBox="0 0 24 24">' +
    '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>' +
    '</symbol>' +
    '<symbol id="i-search" viewBox="0 0 24 24">' +
    '<circle cx="11" cy="11" r="7"/>' +
    '<path d="m20 20-3.5-3.5"/>' +
    '</symbol>' +
    '<symbol id="i-user" viewBox="0 0 24 24">' +
    '<circle cx="12" cy="8" r="4"/>' +
    '<path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>' +
    '</symbol>' +
    '<symbol id="i-chev" viewBox="0 0 24 24">' +
    '<path d="m6 9 6 6 6-6"/>' +
    '</symbol>' +
    '</defs></svg>';

  /* ---------- COMMON CSS ---------- */
  var CSS =
    '@media (max-width:1100px){.nav-actions .hm-login{display:inline-flex!important;align-items:center;gap:6px;padding:8px 12px;font-size:12px}}' +
    '@media (max-width:420px){.nav-actions .hm-login span{display:none}.nav-actions .hm-login{padding:9px}}' +
    '.is-user .nav-actions .hm-login{display:none!important}' +
    '.mobile-search-wrap{display:none;width:100%;padding:12px 20px;background:#fff;border-bottom:1px solid #e6e1e4;box-sizing:border-box}' +
    '.mm-search{display:flex;align-items:center;gap:8px;width:100%;padding:8px 14px;background:#f9f7f8;border:1px solid #e6e1e4;border-radius:999px;box-sizing:border-box}' +
    '.mm-search svg{color:#8a8189;flex-shrink:0}' +
    '.mm-search input{flex:1;min-width:0;border:0;outline:0;background:transparent;font-size:14px;color:#221f22}' +
    '.mm-search input::placeholder{color:#a49ba2}' +
    '@media (max-width:900px){.mobile-search-wrap{display:block}}' +
    '.mmenu{box-sizing:border-box;overflow-y:auto;-webkit-overflow-scrolling:touch;max-height:100dvh}' +
    '.mmenu a,.mmenu button{box-sizing:border-box;max-width:100%}' +
    '.mmenu-logo img{display:block;max-width:140px;height:auto}' +
    '.mmenu-icons{display:flex;align-items:center;flex-wrap:wrap;gap:16px;padding-bottom:16px;border-bottom:1px solid #e6e1e4;margin-bottom:10px}' +
    '.m-dropdown{width:100%}' +
    '.m-dropdown-toggle{width:100%;display:flex;align-items:center;justify-content:space-between;gap:12px;text-align:left;cursor:pointer}' +
    '.m-dropdown-menu{display:none;width:100%;box-sizing:border-box;padding-left:14px}' +
    '.m-dropdown.open>.m-dropdown-menu{display:block}' +
    '.m-dropdown-menu a{display:block;width:100%;padding:12px 10px;overflow-wrap:anywhere}' +
    '.m-dropdown-toggle i{transition:transform .25s ease,color .25s ease;transform:rotate(0)}' +
    '.m-dropdown.open>.m-dropdown-toggle i{transform:rotate(180deg)!important;color:var(--rose,#a3194a)!important}' +
    '@media (max-width:768px){.mmenu{width:min(88vw,360px)}.mmenu a,.mmenu button{font-size:15px}}' +
    '@media (max-width:700px){.acct .menu{position:fixed;top:76px;right:12px;width:min(270px,calc(100vw - 24px))}}';

  /* ---------- BUILDERS ---------- */
  // Helper to add 'act' class safely without breaking the HTML quotes
  function getActiveClass(key) {
    return ACTIVE === key ? ' act' : '';
  }

  function ddItem(i) {
    if (!i.sub) {
      return '<a href="' + i.h + '" role="menuitem">' + i.t + '</a>';
    }
    return '<div class="dd-sub">' +
      '<button type="button" class="dd-sub-toggle" aria-expanded="false">' +
      '<span>' + i.t + '</span>' +
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<use href="#i-chev"/>' +
      '</svg>' +
      '</button>' +
      '<div class="dd-sub-list">' +
      i.sub.map(ddItem).join('') +
      '</div>' +
      '</div>';
  }

  function mItem(i) {
    if (!i.sub) {
      return '<a href="' + i.h + '">' + i.t + '</a>';
    }
    return '<div class="m-dropdown m-dropdown-sub">' +
      '<button type="button" class="m-dropdown-toggle m-sub-toggle" aria-expanded="false">' +
      '<span>' + i.t + '</span>' +
      '<i class="fa-solid fa-chevron-down"></i>' +
      '</button>' +
      '<div class="m-dropdown-menu">' +
      i.sub.map(mItem).join('') +
      '</div>' +
      '</div>';
  }

  /* ---------- ANNOUNCEMENT BAR ---------- */
  var ann = SHOW_ANN
    ? '<div class="hm-ann">' +
      '<span>Discover Your New Favourite Look</span>' +
      '<span class="pill">New Arrivals</span>' +
      '<span>Style Delivered to Your Doorstep</span>' +
      '</div>'
    : '';

  /* ---------- DESKTOP NAVBAR ---------- */
  var nav =
    '<nav class="nav" id="nav" aria-label="Main">' +
    '<a href="index.html" class="brand"><img src="../assets/logo.png" alt="AURA"></a>' +
    '<div class="links">' +
    '<a href="index.html" class="' + getActiveClass('home') + '">Home</a>' +
    '<a href="newcollections.html" class="' + getActiveClass('new') + '">New Collection</a>' +
    '<div class="nav-dd" id="shopDD">' +
    '<a href="shop.html" class="nav-dd-trigger' + getActiveClass('shop') + '" aria-haspopup="true" aria-expanded="false">' +
    'Shop ' +
    '<svg class="dd-caret" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<use href="#i-chev"/>' +
    '</svg>' +
    '</a>' +
    '<div class="dd-menu" role="menu" aria-label="Shop categories">' +
    SHOP.map(ddItem).join('') +
    '<a href="' + ALL.h + '" role="menuitem" class="dd-all">' + ALL.t + '</a>' +
    '</div></div>' +
    '<a href="trackorder.html" class="' + getActiveClass('track') + '">Track Order</a>' +
    '</div>' +
    '<form class="hm-search" id="hmSearch" role="search">' +
    '<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true">' +
    '<use href="#i-search"/>' +
    '</svg>' +
    '<input class="hm-in" type="search" name="q" placeholder="Search fashion, beauty, jewellery…" aria-label="Search products" autocomplete="off">' +
    '</form>' +
    '<div class="nav-actions">' +
    '<button type="button" class="hm-login" id="hmLogin" aria-haspopup="dialog" aria-controls="auraLoginOverlay">' +
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<use href="#i-user"/>' +
    '</svg>' +
    '<span>Login</span>' +
    '</button>' +
    '<button class="icon-btn" id="wishBtn" aria-label="Wishlist" onclick="location.href=\'wishlist.html\'">' +
    '<svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<use href="#i-heart"/>' +
    '</svg>' +
    '<span class="badge" id="wishBadge">0</span>' +
    '</button>' +
    '<button class="icon-btn" id="cartBtn" aria-label="Shopping Cart" onclick="location.href=\'cart.html\'">' +
    '<svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<circle cx="9" cy="21" r="1"></circle>' +
    '<circle cx="19" cy="21" r="1"></circle>' +
    '<path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>' +
    '</svg>' +
    '<span class="badge" id="cartBadge">0</span>' +
    '</button>' +
    '<div class="acct" id="acct" style="display:none">' +
    '<button class="avatar" id="avatarBtn" type="button" aria-label="Account menu" aria-haspopup="true" aria-expanded="false">' +
    '<i class="fa-regular fa-user"></i>' +
    '</button>' +
    '<div class="menu" id="acctMenu">' +
    '<div class="who">' +
    '<b id="userName">AURA Customer</b>' +
    '<small id="userEmail">Signed in</small>' +
    '</div>' +
    '<a href="order-history.html"><i class="fa-solid fa-box"></i> Order History</a>' +
    '<a href="wishlist.html"><i class="fa-regular fa-heart"></i> Wishlist</a>' +
    '<button type="button" id="logoutBtn">' +
    '<i class="fa-solid fa-arrow-right-from-bracket"></i> Logout' +
    '</button>' +
    '</div></div>' +
    '<button class="icon-btn burger" id="burger" aria-label="Open menu" aria-expanded="false" aria-controls="mmenu">' +
    '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true">' +
    '<path d="M4 6h16M4 12h16M4 18h16"/>' +
    '</svg>' +
    '</button>' +
    '</div></nav>' +

    /* Mobile Top Search Bar */
    '<div class="mobile-search-wrap">' +
    '<form class="mm-search" id="mSearch" role="search">' +
    '<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true">' +
    '<use href="#i-search"/>' +
    '</svg>' +
    '<input type="search" name="q" placeholder="Search fashion, beauty, jewellery…" aria-label="Search products" autocomplete="off">' +
    '</form>' +
    '</div>';

  /* ---------- MOBILE MENU ---------- */
  var mmenu =
    '<div class="mmenu" id="mmenu" role="dialog" aria-modal="true" aria-label="Menu">' +
    '<button class="icon-btn mclose" id="mclose" aria-label="Close menu">' +
    '<i class="fa-solid fa-xmark"></i>' +
    '</button>' +
    '<a href="index.html" class="mmenu-logo">' +
    '<img src="../assets/logo.png" alt="AURA">' +
    '</a>' +
    '<div class="mmenu-icons">' +
    '<a href="wishlist.html" class="m-icon-link">' +
    '<i class="fa-regular fa-heart"></i>' +
    '<span>Wishlist</span>' +
    '<span class="badge" id="mWishBadge">0</span>' +
    '</a>' +
    '<a href="cart.html" class="m-icon-link">' +
    '<i class="fa-solid fa-bag-shopping"></i>' +
    '<span>Cart</span>' +
    '<span class="badge" id="mCartBadge">0</span>' +
    '</a>' +
    '</div>' +
    '<a href="index.html" class="' + getActiveClass('home') + '">Home</a>' +
    '<a href="newcollections.html" class="' + getActiveClass('new') + '">New Collection</a>' +
    '<div class="m-dropdown">' +
    '<button type="button" class="m-dropdown-toggle" aria-expanded="false">' +
    '<span>Shop</span>' +
    '<i class="fa-solid fa-chevron-down"></i>' +
    '</button>' +
    '<div class="m-dropdown-menu">' +
    SHOP.map(mItem).join('') +
    '<a href="' + ALL.h + '">View All Products</a>' +
    '</div></div>' +
    '<a href="trackorder.html" class="' + getActiveClass('track') + '">Track Order</a>' +
    '</div>';

  /* ---------- INJECT HTML AND CSS ---------- */
  var style = document.createElement('style');
  style.id = 'auraNavCss';
  style.textContent = CSS;
  document.head.appendChild(style);

  var html =
    (document.getElementById('i-heart') ? '' : SPRITE) +
    ann +
    nav +
    mmenu;

  if (me && me.parentNode) {
    me.insertAdjacentHTML('beforebegin', html);
  } else {
    document.body.insertAdjacentHTML('afterbegin', html);
  }

  /* ---------- HELPERS ---------- */
  var $ = function (id) { return document.getElementById(id); };

  /* ---------- DESKTOP SHOP DROPDOWN ---------- */
  (function () {
    var dd = $('shopDD');
    if (!dd) return;
    var trigger = dd.querySelector('.nav-dd-trigger');
    var timer = null;

    function openMenu() {
      clearTimeout(timer);
      dd.classList.add('open');
      trigger.setAttribute('aria-expanded', 'true');
    }
    function closeSubs() {
      dd.querySelectorAll('.dd-sub.open').forEach(function (s) {
        s.classList.remove('open');
        var t = s.querySelector('.dd-sub-toggle');
        if (t) t.setAttribute('aria-expanded', 'false');
      });
    }
    function closeMenu() {
      dd.classList.remove('open');
      trigger.setAttribute('aria-expanded', 'false');
      closeSubs();
    }

    dd.addEventListener('mouseenter', openMenu);
    dd.addEventListener('mouseleave', function () { timer = setTimeout(closeMenu, 160); });
    dd.addEventListener('focusin', openMenu);

    trigger.addEventListener('click', function (e) {
      if (matchMedia('(hover: none)').matches && !dd.classList.contains('open')) {
        e.preventDefault();
        openMenu();
      }
    });

    dd.querySelectorAll('.dd-sub-toggle').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var sub = btn.parentElement;
        var will = !sub.classList.contains('open');
        closeSubs();
        if (will) {
          sub.classList.add('open');
          btn.setAttribute('aria-expanded', 'true');
        }
      });
    });

    document.addEventListener('click', function (e) {
      if (!dd.contains(e.target)) closeMenu();
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        closeMenu();
        closeMobile();
      }
    });
  })();

  /* ---------- MOBILE MENU ---------- */
  var burger = $('burger');
  var mclose = $('mclose');
  var mm = $('mmenu');

  function openMobile() {
    document.body.classList.add('mmenu-open');
    burger.setAttribute('aria-expanded', 'true');
  }
  function closeMobile() {
    document.body.classList.remove('mmenu-open');
    burger.setAttribute('aria-expanded', 'false');
  }

  if (burger && mclose && mm) {
    burger.addEventListener('click', openMobile);
    mclose.addEventListener('click', closeMobile);

    mm.addEventListener('click', function (e) {
      var tg = e.target.closest('.m-dropdown-toggle');
      if (tg) {
        e.preventDefault();
        var box = tg.parentElement;
        var will = !box.classList.contains('open');
        box.parentElement.querySelectorAll(':scope > .m-dropdown.open').forEach(function (s) {
          if (s !== box) {
            s.classList.remove('open');
            var t = s.querySelector(':scope > .m-dropdown-toggle');
            if (t) t.setAttribute('aria-expanded', 'false');
          }
        });
        box.classList.toggle('open', will);
        tg.setAttribute('aria-expanded', will ? 'true' : 'false');
        return;
      }
      if (e.target.closest('a[href]')) closeMobile();
    });
  }

  /* ---------- SEARCH (DESKTOP + MOBILE) ---------- */
  ['hmSearch', 'mSearch'].forEach(function (id) {
    var f = $(id);
    if (!f) return;
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var q = f.q.value.trim();
      if (q) location.href = 'shop.html?q=' + encodeURIComponent(q);
    });
  });

  /* ---------- WISHLIST + CART BADGES ---------- */
  function badges() {
    try {
      var w = (JSON.parse(localStorage.getItem('aura_wishlist')) || []).length;
      var c = (JSON.parse(localStorage.getItem('aura_cart')) || []).reduce(function (s, x) {
        return s + (Number(x.qty) || 1);
      }, 0);

      document.querySelectorAll('#wishBadge,#mWishBadge').forEach(function (b) {
        b.textContent = w;
        b.style.display = w > 0 ? 'grid' : 'none';
      });
      document.querySelectorAll('#cartBadge,#mCartBadge').forEach(function (b) {
        b.textContent = c;
        b.style.display = c > 0 ? 'grid' : 'none';
      });
    } catch (e) { }
  }

  badges();

  window.addEventListener('storage', function (e) {
    if (e.key === 'aura_wishlist' || e.key === 'aura_cart') badges();
  });
  window.addEventListener('focus', badges);

  /* ---------- PUBLIC NAVBAR METHODS ---------- */
  window.AuraNav = {
    refreshBadges: badges,
    closeMenu: closeMobile
  };

})();