/* Admin Settings -> User side (footer contact + social links auto update)
   Reads Firestore: settings/public  (written by admin/settings.html) */

import * as FB from "./firebase.js";

const CACHE_KEY = "aura_site_settings";

const digits = v => String(v || "").replace(/\D/g, "");

function hrefFor(key, val) {
    val = String(val || "").trim();
    if (!val) return "";
    if (key === "supportEmail") return "mailto:" + val;
    if (key === "supportPhone") return "tel:" + val.replace(/[^\d+]/g, "");
    if (key === "whatsappNumber") {
        let d = digits(val);
        if (d.length === 10) d = "91" + d;
        return d ? "https://wa.me/" + d : "";
    }
    return /^https?:\/\//i.test(val) ? val : "https://" + val;
}

function handleOf(url) {
    try {
        const u = new URL(hrefFor("x", url));
        const seg = u.pathname.split("/").filter(Boolean).pop() || "";
        return seg ? (seg.startsWith("@") ? seg : "@" + seg) : u.hostname;
    } catch (e) { return url; }
}

// show / hide while keeping the element's original display (flex, grid...)
function setVisible(el, show) {
    if (!("d" in el.dataset)) el.dataset.d = el.style.display === "none" ? "" : el.style.display;
    el.style.display = show ? el.dataset.d : "none";
}

function apply(s) {
    if (!s) return;

    // plain text (email, phone, address, store name, description...)
    document.querySelectorAll("[data-site-text]").forEach(el => {
        const v = String(s[el.dataset.siteText] || "").trim();
        if (v) el.textContent = v;
        const item = el.closest("[data-site-item]");
        if (item && item !== el) setVisible(item, !!v);
    });

    // links (mailto / tel / whatsapp / social)
    document.querySelectorAll("[data-site-link]").forEach(el => {
        const h = hrefFor(el.dataset.siteLink, s[el.dataset.siteLink]);
        setVisible(el, !!h);
        if (!h) return;
        el.href = h;
        if (/^https?:/.test(h)) { el.target = "_blank"; el.rel = "noopener"; }
    });

    // @handle text under social buttons
    document.querySelectorAll("[data-site-handle]").forEach(el => {
        const v = String(s[el.dataset.siteHandle] || "").trim();
        if (v) el.textContent = handleOf(v);
    });
}

// 1) instant render from cache (no flicker)
try { apply(JSON.parse(localStorage.getItem(CACHE_KEY))); } catch (e) { }

// 2) fetch latest from Firestore
(async function () {
    try {
        const fs = (FB.getDoc && FB.doc)
            ? FB
            : await import("https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js");
        const snap = await fs.getDoc(fs.doc(FB.db, "settings", "public"));
        if (!snap.exists()) return;
        const s = snap.data();
        localStorage.setItem(CACHE_KEY, JSON.stringify(s));
        apply(s);
    } catch (e) { console.warn("Site settings not loaded:", e); }
})();