/* AURA — admin/js/admin-shell.js */
import {
  auth, onAuthStateChanged, signOut, isAdminEmail, db, collection, getDocs,
  setPersistence, browserLocalPersistence
} from "./firebase.js";

/* ---------- THEME: apply saved theme immediately (no flash) ---------- */
const THEME_KEY = "aura_admin_theme";
let savedTheme = "light";
try { savedTheme = localStorage.getItem(THEME_KEY) || "light"; } catch (e) { }
document.documentElement.setAttribute("data-theme", savedTheme);

const ic = body => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;

const NAV = [
  ["dashboard.html", "Dashboard", '<rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/>'],
  ["home.html", "Home Page", '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>'],
  ["products.html", "Products", '<path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 8 9 5 9-5"/><path d="M12 13v9"/><path d="m3 8 0 9 9 5 9-5V8"/>', "products"],
  ["newcollection.html", "New Collection", '<path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8L12 3Z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15Z"/>'],
  ["orders.html", "Orders", '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/>', "orders"],
  ["returns.html", "Returns", '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>', "returns"],
  ["newsletter.html", "Subscribers", '<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>'],
  ["settings.html", "Settings", '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"/>'],

  ["__label", "Direct Billing"],
  ["billing.html", "Billing", '<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M8 6h8M8 10h2M14 10h2M8 14h2M14 14h2M8 18h8"/>'],
  ["billing-history.html", "Billing History", '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h8"/>'],
  
  ["__label", "Inventory"],
  ["stock.html", "Stock Management", '<path d="M20 7 12 3 4 7v10l8 4 8-4V7Z"/><path d="m4 7 8 4 8-4"/><path d="M12 21V11"/>']
];

/* ---- Premium sidebar CSS ---- */
const st = document.createElement("style");
st.textContent = `
.admin-side .admin-brand{
  position:relative !important; display:flex !important; flex-direction:column !important;
  align-items:center !important; justify-content:center !important; gap:8px !important; text-align:center !important;
  background:linear-gradient(150deg,#a3194a 0%,#7a1234 55%,#4a0a1e 100%) !important;
  border-radius:18px !important; padding:30px 16px 24px !important; margin:0 0 22px 0 !important;
  height:auto !important; min-height:0 !important; max-height:none !important;
  box-shadow:0 18px 40px -18px rgba(163,25,74,.6), inset 0 1px 0 rgba(255,255,255,.16) !important;
  overflow:hidden !important; width:100% !important; box-sizing:border-box !important; border:0 !important;
}
.admin-side .admin-brand::before{ content:"" !important; position:absolute !important; inset:-40% -20% auto auto !important; width:200px !important; height:200px !important; background:radial-gradient(circle, rgba(255,255,255,.25), transparent 65%) !important; pointer-events:none !important; }
.admin-side .admin-brand::after{ content:"" !important; position:absolute !important; inset:0 !important; border-radius:18px !important; border:1px solid rgba(255,255,255,.16) !important; pointer-events:none !important; }
.admin-side .admin-brand img{ height:75px !important; min-height:0 !important; max-height:none !important; width:auto !important; max-width:200px !important; object-fit:contain !important; display:block !important; margin:0 auto !important; position:relative !important; z-index:1 !important; background:none !important; border:0 !important; outline:0 !important; padding:0 !important; border-radius:0 !important; box-shadow:none !important; filter:brightness(0) invert(1) !important; -webkit-filter:brightness(0) invert(1) !important; opacity:1 !important; }
.admin-side .admin-brand > div{ display:block !important; margin:0 !important; position:relative !important; z-index:1 !important; }
.admin-side .admin-brand small{ display:block !important; font:600 11px "Jost",system-ui,sans-serif !important; letter-spacing:.36em !important; text-transform:uppercase !important; color:#FFFFFF !important; opacity:1 !important; margin:0 !important; padding-left:.36em !important; text-shadow:0 1px 3px rgba(0,0,0,.25) !important; }
.admin-side .admin-brand > div::after{ content:"" !important; display:block !important; width:40px !important; height:1px !important; margin:12px auto 0 !important; background:rgba(255,255,255,.55) !important; }

/* 🔥 Nav Links 🔥 */
.admin-side .admin-nav a{ color:#FFFFFF !important; font:400 14.5px "Jost",system-ui,sans-serif !important; letter-spacing:.02em !important; padding:11px 14px !important; border-radius:10px !important; margin-bottom:2px !important; display:flex !important; align-items:center !important; gap:12px !important; opacity:1 !important; transition:background .25s ease, color .25s ease, padding-left .25s ease, box-shadow .25s ease !important; }
.admin-side .admin-nav a svg{ width:18px !important; height:18px !important; flex:none !important; color:#FFFFFF !important; opacity:1 !important; stroke-width:2 !important; }
.admin-side .admin-nav a:hover{ opacity:1 !important; background:rgba(255,255,255,.10) !important; padding-left:18px !important; color:#FFFFFF !important; }
.admin-side .admin-nav a.active{ opacity:1 !important; background:#FFFFFF !important; color:#a3194a !important; font-weight:600 !important; padding-left:18px !important; box-shadow:0 8px 22px -10px rgba(0,0,0,.4), 0 0 0 1px rgba(255,255,255,.35), inset 0 1px 0 rgba(255,255,255,.9) !important; }
.admin-side .admin-nav a.active svg{ color:#a3194a !important; opacity:1 !important; stroke-width:2.4 !important; }
.admin-side .admin-nav a.active:hover{ background:#FFFFFF !important; color:#a3194a !important; }

/* 🔥 Label Text (Direct Billing & Inventory) 🔥 */
.admin-side .admin-nav .nav-label {
  color: #e8a5bb !important; /* Light pink color */
  font: 600 11px "Jost", system-ui, sans-serif !important;
  letter-spacing: 0.15em !important;
  text-transform: uppercase !important;
  padding: 22px 14px 8px !important; /* Top space */
  margin-bottom: 4px !important;
  opacity: 1 !important;
  border-bottom: 1px solid rgba(255,255,255,0.1); /* Light line */
  pointer-events: none;
}

.admin-me{ display:flex !important; align-items:center !important; gap:10px !important; padding:12px !important; margin-bottom:12px !important; border-radius:12px !important; background:rgba(255,255,255,.09) !important; border:1px solid rgba(255,255,255,.14) !important; }
.admin-me i{ width:38px !important;height:38px !important;flex:none !important; border-radius:50% !important; display:grid !important;place-items:center !important; background:linear-gradient(135deg,#C93A68,#A3194A) !important; color:#fff !important; font:600 15px/1 "Jost",system-ui,sans-serif !important; font-style:normal !important; text-transform:uppercase !important; box-shadow:0 6px 16px -8px rgba(163,25,74,.9) !important; border:1.5px solid rgba(255,255,255,.25) !important; }
.admin-me span{min-width:0 !important;display:grid !important;gap:3px !important}
.admin-me b{ font:500 9.5px "Jost",system-ui,sans-serif !important; letter-spacing:.2em !important; text-transform:uppercase !important; color:#FFFFFF !important; opacity:1 !important; }
.admin-me em{ font-style:normal !important; font-size:13px !important; color:#FFFFFF !important; overflow:hidden !important; text-overflow:ellipsis !important; white-space:nowrap !important; }
.admin-side .admin-side-foot > div{ color:#FFFFFF !important; font-size:11.5px !important; letter-spacing:.08em !important; }
.admin-side .admin-signout{ color:#FFFFFF !important; border:1px solid rgba(255,255,255,.22) !important; background:rgba(255,255,255,.05) !important; border-radius:10px !important; transition:background .25s, border-color .25s, color .25s !important; }
.admin-side .admin-signout:hover{ background:rgba(255,255,255,.14) !important; border-color:rgba(255,255,255,.35) !important; }
.admin-side .admin-signout svg{ color:#FFFFFF !important; }

/* Count Badge */
.nav-count { margin-left:auto; background:#a3194a; color:white; font:600 11px "Jost",sans-serif; padding:2px 8px; border-radius:12px; min-width:22px; text-align:center; }
.admin-nav a.active .nav-count { background:#a3194a; color:white; }
`;
document.head.appendChild(st);

/* ---------- cached admin hint (avoids flicker) ---------- */
const HINT = "aura_admin_email";
let cached = ""; try { cached = localStorage.getItem(HINT) || ""; } catch (e) { }
const trusted = !!cached && isAdminEmail(cached);
if (!trusted) document.body.style.visibility = "hidden";
const forget = () => { try { localStorage.removeItem(HINT); } catch (e) { } };

/* ---------- sidebar (same on every page) ---------- */
const page = (location.pathname.split("/").pop() || "dashboard.html").toLowerCase();
const side = document.getElementById("adminSide") || document.querySelector(".admin-side");
if (side) {
  side.id = "adminSide";
  side.innerHTML = `
    <div class="admin-brand" style="height:auto !important;min-height:120px !important;max-height:none !important;overflow:visible !important;">
      <img src="../assets/logo.png" alt="AURA" style="display:block !important;height:75px !important;min-height:75px !important;max-height:none !important;width:auto !important;max-width:200px !important;margin:0 auto !important;padding:0 !important;border:0 !important;background:none !important;box-shadow:none !important;filter:brightness(0) invert(1) !important;opacity:1 !important;">
      <div><small>Admin Panel</small></div>
    </div>
    <nav class="admin-nav">
      ${NAV.map(([href, label, svg, badgeId]) => {
        if (href === "__label") {
          return `<div class="nav-label">${label}</div>`;
        }
        return `
          <a href="${href}" class="${page === href ? "active" : ""}">
            ${ic(svg)}${label}
            ${badgeId ? `<span class="nav-count" id="navCount-${badgeId}" style="display:none">0</span>` : ""}
          </a>
        `;
      }).join("")}
    </nav>
    <div class="admin-side-foot">
      <div class="admin-me"><i id="adminAvatar">A</i><span><b>Signed in as</b><em id="adminMeEmail">Admin</em></span></div>
      <div>AURA Admin v1.0</div>
      <button class="admin-signout" id="signOutBtn" type="button">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/></svg>
        Sign out
      </button>
    </div>`;
}

/* ---------- MOBILE: hamburger + slide-in left menu (CSS is in admin.css section 6) ---------- */
const mainEl = document.querySelector(".admin-main");
if (side && mainEl && !document.querySelector(".m-bar")) {
  const bar = document.createElement("div");
  bar.className = "m-bar";
  bar.innerHTML = '<button class="m-burger" type="button" aria-label="Menu"><span></span><span></span><span></span></button><b>AURA Admin</b>';
  mainEl.prepend(bar);

  const backdrop = document.createElement("div");
  backdrop.className = "m-backdrop";
  document.body.appendChild(backdrop);

  const closeNav = () => document.body.classList.remove("nav-open");
  bar.querySelector(".m-burger").addEventListener("click", () => document.body.classList.toggle("nav-open"));
  backdrop.addEventListener("click", closeNav);
  side.querySelectorAll("a").forEach(a => a.addEventListener("click", closeNav));
  addEventListener("keydown", e => { if (e.key === "Escape") closeNav(); });
  matchMedia("(min-width: 901px)").addEventListener("change", closeNav);
}

/* ---------- THEME TOGGLE (top-right button) ---------- */
const SUN = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
const MOON = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>';

let themeBtn = document.getElementById("themeToggle");
if (!themeBtn) {
  themeBtn = document.createElement("button");
  themeBtn.id = "themeToggle";
  themeBtn.type = "button";
  themeBtn.setAttribute("aria-label", "Toggle theme");
  document.body.appendChild(themeBtn);
}
const applyTheme = t => {
  document.documentElement.setAttribute("data-theme", t);
  themeBtn.innerHTML = t === "dark" ? SUN : MOON;
  try { localStorage.setItem(THEME_KEY, t); } catch (e) { }
};
applyTheme(savedTheme);
themeBtn.addEventListener("click", () =>
  applyTheme(document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark"));

/* ---------- auth guard ---------- */
let leaving = false, resolved = false;
const setText = (id, t) => { const el = document.getElementById(id); if (el) el.textContent = t; };

function fill(user) {
  const email = user.email || "";
  const name = user.displayName || email.split("@")[0] || "Admin";
  setText("adminMeEmail", email);
  setText("adminAvatar", (name[0] || "A"));
  setText("adminEmail", email);
  setText("adminName", name);
  setText("dashName", name);
}

/* ---------- sidebar counts from Firestore ---------- */
async function fetchCounts() {
  try {
    const [prodSnap, orderSnap, returnsSnap] = await Promise.all([
      getDocs(collection(db, "products")),
      getDocs(collection(db, "orders")),
      getDocs(collection(db, "returns"))
    ]);
    const put = (id, n) => {
      const el = document.getElementById("navCount-" + id);
      if (el) { el.textContent = n; el.style.display = n > 0 ? "inline-block" : "none"; }
    };
    put("products", prodSnap.size);
    put("orders", orderSnap.size);
    put("returns", returnsSnap.size);
  } catch (e) {
    console.warn("Could not load sidebar counts:", e);
  }
}

if (trusted) { fill({ email: cached }); fetchCounts(); }

/* keep session across pages + wait until Firebase has restored it */
const authReady = (async () => {
  try { await setPersistence(auth, browserLocalPersistence); } catch (e) { console.warn("persistence:", e); }
  try { if (typeof auth.authStateReady === "function") await auth.authStateReady(); } catch (e) { }
})();

const goLogin = () => { forget(); if (!leaving) location.replace("login.html"); };

export const adminReady = new Promise(resolve => {
  authReady.then(() => {
    onAuthStateChanged(auth, user => {
      if (!user) {
        /* session may still be restoring: re-check after a short grace period */
        setTimeout(() => {
          const u = auth.currentUser;
          if (u && isAdminEmail(u.email)) return;   /* listener will fire again with the user */
          goLogin();
        }, 1200);
        return;
      }
      if (!isAdminEmail(user.email)) { goLogin(); return; }

      try { localStorage.setItem(HINT, user.email); } catch (e) { }
      fill(user);
      document.body.style.visibility = "";
      fetchCounts();
      if (!resolved) { resolved = true; resolve(user); }
    });
  });
});

/* ---------- sign out ---------- */
document.addEventListener("click", async e => {
  if (!e.target.closest("#signOutBtn")) return;
  leaving = true; forget();
  try { await signOut(auth); } catch (err) { console.error("Sign out:", err); }
  location.replace("login.html");
});

/* ---------- MOBILE: tables -> cards (labels from <th>) ---------- */
(function () {
  const main = document.querySelector(".admin-main");
  if (!main) return;

  const label = () => {
    main.querySelectorAll("table:not(.prod-table)").forEach(t => {
      t.classList.add("m-cards");
      const heads = [...t.querySelectorAll("thead th")].map(h => h.textContent.trim());
      t.querySelectorAll("tbody tr").forEach(tr => {
        [...tr.children].forEach((td, i) => {
          if (td.tagName === "TD" && !td.hasAttribute("colspan") && heads[i]) td.dataset.label = heads[i];
        });
      });
    });
  };

  let queued = false;
  new MutationObserver(() => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; label(); });
  }).observe(main, { childList: true, subtree: true });
  label();
})();