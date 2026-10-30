
//INDEX JS Code
/* ==========================================================
   AURA — home.js
   Section interactions + side login panel (Firebase placeholder)
   ========================================================== */

/* ===== Firebase — placeholder (offline mode) ===== */
const auth = null, db = null;
const onAuthStateChanged = (a, cb) => { try { cb(null); } catch (e) { } };
const signInWithEmailAndPassword = () => Promise.reject({ code: 'auth/operation-not-allowed' });
const createUserWithEmailAndPassword = () => Promise.reject({ code: 'auth/operation-not-allowed' });
const updateProfile = () => Promise.resolve();
const signInWithPopup = () => Promise.reject({ code: 'auth/operation-not-allowed' });
const GoogleAuthProvider = class { };
const sendPasswordResetEmail = () => Promise.reject({ code: 'auth/operation-not-allowed' });
const setPersistence = () => Promise.resolve();
const browserLocalPersistence = null;
const browserSessionPersistence = null;
const doc = () => ({});
const getDoc = () => Promise.resolve({ exists: () => false });
const setDoc = () => Promise.resolve();
const serverTimestamp = () => new Date();

/* ---------- tiny helpers ---------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const hasIO = 'IntersectionObserver' in window;
const body = document.body;
/* ==========================================================
   0 · SCROLL REVEAL  (refresh-safe)
   ========================================================== */
(() => {
  const root = document.documentElement;
  window.__revealReady = true;

  if (reduced) {
    root.classList.add('reveal-all');
    $$('.reveal').forEach(el => el.classList.add('in'));
    return;
  }

  let pending = $$('.reveal:not(.in)');
  let ticking = false;

  // instant=true -> animation illama udane kaattum (refresh / already visible / mela scroll aanadhu)
  function sweep(instant) {
    const limit = innerHeight * 0.92;
    pending = pending.filter(el => {
      if (el.classList.contains('in')) return false;
      if (el.getBoundingClientRect().top < limit) {
        if (instant) el.classList.add('instant');
        el.classList.add('in');
        return false;
      }
      return true;
    });
  }

  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => { sweep(false); ticking = false; });
  }

  // first paint: screen-la irukkradhu udane theriyum
  sweep(true);
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', onScroll);
  addEventListener('load', () => sweep(true));
  addEventListener('pageshow', () => sweep(true));
  // refresh-la browser scroll position restore panna aprom, mela irukkradhu ellam show aagum
  setTimeout(() => sweep(true), 150);
  setTimeout(() => sweep(true), 500);

  // Firebase / JS-la late-aa add aagura .reveal elements-kum work aagum
  new MutationObserver(muts => {
    let added = false;
    muts.forEach(m => m.addedNodes.forEach(n => {
      if (n.nodeType !== 1) return;
      if (n.matches?.('.reveal')) { pending.push(n); added = true; }
      n.querySelectorAll?.('.reveal').forEach(x => { pending.push(x); added = true; });
    }));
    if (added) sweep(false);
  }).observe(document.body, { childList: true, subtree: true });
})();
/* ==========================================================
   1 · SECTION INTERACTIONS
   ========================================================== */

/* ---------- NAV SEARCH ---------- */
$('#hmSearch')?.addEventListener('submit', e => {
  e.preventDefault();
  const q = e.currentTarget.q.value.trim();
  location.href = 'shop.html' + (q ? '?q=' + encodeURIComponent(q) : '');
});

/* ---------- DRAG-TO-SCROLL (generic for [data-drag]) ---------- */
$$('[data-drag]').forEach(el => {
  let down = false, moved = false, startX = 0, startScroll = 0, pid = null;

  el.addEventListener('pointerdown', e => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    down = true; moved = false;
    startX = e.clientX; startScroll = el.scrollLeft;
    pid = e.pointerId;
    el.setPointerCapture?.(pid);
    el.classList.add('drag');
  });

  el.addEventListener('pointermove', e => {
    if (!down) return;
    const dx = e.clientX - startX;
    if (!moved && Math.abs(dx) > 6) moved = true;
    if (moved) {
      el.scrollLeft = startScroll - dx;
      e.preventDefault();
    }
  });

  const end = () => {
    if (!down) return;
    down = false;
    if (pid !== null) { el.releasePointerCapture?.(pid); pid = null; }
    el.classList.remove('drag');
    if (moved) setTimeout(() => { moved = false; }, 0);
  };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);

  el.addEventListener('click', e => {
    if (moved) { e.preventDefault(); e.stopPropagation(); moved = false; }
  }, true);
});

/* ---------- HERO: caption + scene rotation ---------- */
(() => {
  const scenes = $$('.hm-scene'), caps = $$('.hm-cap span');
  const n = Math.max(scenes.length, caps.length);
  if (n < 2 || reduced) return;
  let i = 0;
  setInterval(() => {
    if (document.hidden) return;
    i = (i + 1) % n;
    scenes.forEach((s, k) => s.classList.toggle('on', k === i % scenes.length));
    caps.forEach((c, k) => c.classList.toggle('on', k === i % caps.length));
  }, 5200);
})();

/* ==========================================================
   2 · ACCORDION — Style that moves with you
   DRAG + HOVER + AUTOPLAY (fixed)
   ========================================================== */
(() => {
  const box = document.getElementById('motion');
  if (!box) return;

  const panes = box.querySelectorAll('.hm-pane');
  if (!panes.length) return;

  // find initial active pane
  let idx = 0;
  panes.forEach((p, i) => { if (p.classList.contains('on')) idx = i; });

  function setActive(k) {
    idx = (k + panes.length) % panes.length;
    panes.forEach((p, i) => p.classList.toggle('on', i === idx));
  }

  // ensure exactly one active
  setActive(idx);

  // disable native link/image drag
  box.querySelectorAll('a, img').forEach(el => el.setAttribute('draggable', 'false'));
  box.addEventListener('dragstart', e => e.preventDefault());

  // whether layout is row (desktop) or column (mobile)
  function isRow() {
    return getComputedStyle(box).flexDirection === 'row';
  }

  const SWIPE_STEP = 60; // px per pane on mobile
  let down = false;
  let moved = false;
  let startX = 0;
  let lastX = 0;
  let pid = null;
  let hoverLock = 0;

  box.addEventListener('pointerdown', e => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    down = true;
    moved = false;
    startX = lastX = e.clientX;
    pid = e.pointerId;
  });

  box.addEventListener('pointermove', e => {
    if (!down) return;

    if (!moved) {
      if (Math.abs(e.clientX - startX) < 6) return;
      moved = true;
      box.setPointerCapture?.(pid);
      box.classList.add('dragging');
    }

    if (isRow()) {
      // desktop: cursor position -> pane index
      const r = box.getBoundingClientRect();
      const ratio = Math.min(0.999, Math.max(0, (e.clientX - r.left) / r.width));
      const k = Math.floor(ratio * panes.length);
      if (k !== idx) setActive(k);
    } else {
      // mobile: swipe left = next, right = prev
      const dx = e.clientX - lastX;
      if (Math.abs(dx) >= SWIPE_STEP) {
        setActive(idx + (dx < 0 ? 1 : -1));
        lastX = e.clientX;
      }
    }
  });

  function endDrag() {
    if (!down) return;
    down = false;
    hoverLock = Date.now() + 700;
    if (pid !== null) {
      try { box.releasePointerCapture(pid); } catch (e) { }
      pid = null;
    }
    box.classList.remove('dragging');
    setTimeout(() => { moved = false; }, 0);
  }
  box.addEventListener('pointerup', endDrag);
  box.addEventListener('pointercancel', endDrag);
  box.addEventListener('lostpointercapture', endDrag);

  // block link open while dragging
  box.addEventListener('click', e => {
    if (moved) { e.preventDefault(); e.stopPropagation(); }
  }, true);

  // hover (desktop) + tap (mobile)
  const canHover = matchMedia('(hover: hover)').matches;
  panes.forEach((pane, j) => {
    if (canHover) {
      pane.addEventListener('mouseenter', () => {
        if (!down && Date.now() > hoverLock) setActive(j);
      });
    }
    pane.addEventListener('focusin', () => setActive(j));
    pane.addEventListener('click', e => {
      if (!pane.classList.contains('on')) { e.preventDefault(); setActive(j); }
    });
  });

  // autoplay — pause on hover / drag / offscreen
  let paused = false;
  box.addEventListener('mouseenter', () => { paused = true; });
  box.addEventListener('mouseleave', () => { paused = false; });
  box.addEventListener('touchstart', () => { paused = true; }, { passive: true });
  box.addEventListener('touchend', () => { setTimeout(() => { paused = false; }, 2500); });

  setInterval(() => {
    if (paused || down || document.hidden) return;
    setActive(idx + 1);
  }, 4000);
})();

/* ==========================================================
   3 · STORIES
   ========================================================== */
(() => {
  const st = $('#story');
  if (!st) return;
  const sc = $$('.hm-sc', st), th = $$('.hm-th', st);
  const box = $('#stTitleBox'), title = $('#stTitle'), kick = $('#stKick');
  const num = $('#stNum'), bar = $('#stBar'), shop = $('#stShop');
  let n = 0, timer = null, visible = false;

  function flash(el) { if (!el) return; el.classList.remove('swap'); void el.offsetWidth; el.classList.add('swap'); }
  function go(k, byUser) {
    n = (k + sc.length) % sc.length;
    sc.forEach((s, j) => s.classList.toggle('on', j === n));
    th.forEach((t, j) => { t.classList.toggle('on', j === n); t.setAttribute('aria-selected', j === n); });
    const d = sc[n].dataset;
    if (title) title.textContent = d.title;
    if (kick) kick.textContent = d.kick;
    if (shop) shop.href = d.href;
    if (num) num.textContent = '0' + (n + 1);
    if (bar) bar.style.setProperty('--p', ((n + 1) / sc.length).toFixed(3));
    if (!reduced) { flash(box); flash(kick); }
    if (byUser) play();
  }
  function play() {
    clearInterval(timer);
    if (reduced) return;
    timer = setInterval(() => { if (visible && !document.hidden) go(n + 1); }, 6500);
  }
  th.forEach((t, j) => t.addEventListener('click', () => go(j, true)));
  document.addEventListener('keydown', e => {
    if (!visible || /input|textarea|select/i.test(document.activeElement?.tagName || '')) return;
    if (e.key === 'ArrowRight') go(n + 1, true);
    if (e.key === 'ArrowLeft') go(n - 1, true);
  });
  if (hasIO) new IntersectionObserver(es => { visible = es[0].isIntersecting; }, { threshold: .5 }).observe(st);
  else visible = true;
  go(0); play();
})();

/* ==========================================================
   4 · LATEST TRENDS: photo stack
   ========================================================== */
(() => {
  const stack = $('#trStack');
  if (!stack) return;
  const cards = $$('.hm-tc', stack), num = $('#trNum'), len = cards.length;
  let n = 0;
  const show = k => {
    n = (k + len) % len;
    cards.forEach((c, j) => c.dataset.pos = (j - n + len) % len);
    if (num) num.textContent = (n + 1) + ' / ' + len;
  };
  $('#trNext')?.addEventListener('click', () => show(n + 1));
  $('#trPrev')?.addEventListener('click', () => show(n - 1));
  cards.forEach(c => c.addEventListener('click', () => { if (c.dataset.pos !== '0') show(n + 1); }));
  if (!reduced) setInterval(() => { if (!document.hidden && stack.getBoundingClientRect().top < innerHeight) show(n + 1); }, 5000);
})();

/* ==========================================================
   6 · SMOOTH SCROLL for #story, #moods, #trends
   ========================================================== */
$$('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    const id = a.getAttribute('href');
    if (id.length < 2) return;
    const target = document.querySelector(id);
    if (!target) return;
    e.preventDefault();
    const top = target.getBoundingClientRect().top + window.scrollY - 80;
    window.scrollTo({ top, behavior: reduced ? 'auto' : 'smooth' });
  });
});


// Mobile Dropdown Toggle Logic
document.addEventListener('DOMContentLoaded', function () {
  var dropdownToggles = document.querySelectorAll('.m-dropdown-toggle');

  dropdownToggles.forEach(function (toggle) {
    toggle.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();

      var parent = this.parentElement;
      var isOpen = parent.classList.contains('open');

      // (Optional) Matha ellathayum close pannanum na intha line use pannunga:
      // document.querySelectorAll('.m-dropdown').forEach(function(d) { d.classList.remove('open'); });

      if (isOpen) {
        parent.classList.remove('open');
      } else {
        parent.classList.add('open');
      }
    });
  });
});