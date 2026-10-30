/* =====================================================================
   AURA — subscribe-popup.js (FULL)
   Subscribe popup + Login popup (both handled here)
   Also handles #hmLogin button + mobile .js-open-login link
   ===================================================================== */
(function () {
  'use strict';

  /* ============================================================
     1. SUBSCRIBE POPUP
     ============================================================ */
  var subOverlay = document.getElementById('auraSubscribePopup');
  if (!subOverlay) return;

  var K_DONE = 'aura_sub_done';
  var K_SKIP = 'aura_sub_skip';
  var K_PEND = 'aura_sub_pending';
  var DELAY_MS = 1000;
  var SKIP_DAYS = 2;

  var form      = document.getElementById('auraSubscribeForm');
  var phoneEl   = document.getElementById('auraPhone');
  var consentEl = document.getElementById('auraConsent');
  var msgEl     = document.getElementById('auraPopupMessage');
  var stepForm  = document.getElementById('auraStepForm');
  var stepDone  = document.getElementById('auraStepDone');
  var doneText  = document.getElementById('auraDoneText');
  var doneLogin = document.getElementById('auraDoneLogin');
  var submitBtn = form.querySelector('.aura-popup-submit');
  var phoneWrap = form.querySelector('.aura-phone-field');

  var user = null, authKnown = false, lastFocus = null;
  var firePromise = null;

  /* ---------- localStorage ---------- */
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function lsDel(k) { try { localStorage.removeItem(k); } catch (e) {} }
  function isDone() { return lsGet(K_DONE) === '1'; }
  function isSkipped() {
    var t = +lsGet(K_SKIP) || 0;
    return t && (Date.now() - t) < SKIP_DAYS * 864e5;
  }

  /* ---------- Firebase lazy loader ---------- */
  function getFire() {
    if (!firePromise) {
      firePromise = Promise.all([
        import('./firebase.js'),
        import('https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js')
      ]).then(function (m) {
        return Object.assign({}, m[0], m[1]);
      }).catch(function (e) {
        console.warn('[AURA popup] Firebase not available:', e);
        return null;
      });
    }
    return firePromise;
  }

  function persist(phone, u) {
    return getFire().then(function (f) {
      if (!f || !f.db) throw new Error('firebase-unavailable');
      var full = '+91' + phone;
      var lead = {
        phone: full, consent: true, source: 'popup',
        uid: u ? u.uid : null,
        updatedAt: f.serverTimestamp()
      };
      var jobs = [f.setDoc(f.doc(f.db, 'subscribers', '91' + phone), lead, { merge: true })];
      if (u) {
        jobs.push(f.setDoc(f.doc(f.db, 'users', u.uid), {
          phone: full, subscribed: true, email: u.email || null,
          subscribedAt: f.serverTimestamp()
        }, { merge: true }));
      }
      return Promise.all(jobs);
    });
  }

  function flushPending(u) {
    var phone = lsGet(K_PEND);
    if (!phone || !u) return;
    persist(phone, u).then(function () {
      lsDel(K_PEND);
      lsSet(K_DONE, '1');
    }).catch(function () {});
  }

  function watchAuth() {
    getFire().then(function (f) {
      if (!f || !f.auth || !f.onAuthStateChanged) { authKnown = true; return; }
      f.onAuthStateChanged(f.auth, function (u) {
        user = u || null;
        authKnown = true;
        if (user) {
          closeSubPopup(false);
          flushPending(user);
        }
      });
    });
  }

  /* ---------- subscribe popup open/close ---------- */
  function openSubPopup() {
    if (user || subOverlay.classList.contains('show')) return;
    lastFocus = document.activeElement;
    showStep(isDone() ? 'done' : 'form');
    subOverlay.classList.add('show');
    subOverlay.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    setTimeout(function () { if (!stepForm.hidden) phoneEl.focus(); }, 380);
  }

  function closeSubPopup(remember) {
    if (!subOverlay.classList.contains('show')) return;
    subOverlay.classList.remove('show');
    subOverlay.setAttribute('aria-hidden', 'true');
    if (!document.body.classList.contains('aura-login-open')) {
      document.body.style.overflow = '';
    }
    if (remember !== false && !isDone()) lsSet(K_SKIP, String(Date.now()));
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  function showStep(which) {
    stepForm.hidden = which !== 'form';
    stepDone.hidden = which !== 'done';
    if (which === 'done') {
      var loggedIn = !!user;
      doneLogin.hidden = loggedIn;
      doneText.textContent = loggedIn
        ? 'Your 10% OFF is saved to your account.'
        : 'Login to claim your 10% OFF on your first order.';
    }
  }

  /* ---------- subscribe popup events ---------- */
  subOverlay.addEventListener('click', function (e) {
    if (e.target === subOverlay || e.target.closest('.aura-popup-close') || e.target.closest('[data-popup-close]')) {
      closeSubPopup(true); return;
    }
    if (e.target.closest('[data-open-login]')) {
      e.preventDefault();
      closeSubPopup(false);
      openLoginPopup();
    }
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && subOverlay.classList.contains('show')) closeSubPopup(true);
  });

  phoneEl.addEventListener('input', function () {
    phoneEl.value = phoneEl.value.replace(/\D/g, '').slice(0, 10);
    phoneWrap.classList.remove('invalid');
    subSay('');
  });

  function subSay(text, kind) {
    msgEl.textContent = text || '';
    msgEl.className = 'aura-popup-message' + (kind ? ' ' + kind : '');
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var phone = phoneEl.value.trim();

    if (!/^[6-9]\d{9}$/.test(phone)) {
      phoneWrap.classList.add('invalid');
      subSay('Enter a valid 10-digit mobile number.', 'err');
      phoneEl.focus();
      return;
    }
    if (!consentEl.checked) { subSay('Please tick the box to continue.', 'err'); return; }

    submitBtn.disabled = true;
    subSay('Saving…');

    persist(phone, user).then(function () {
      if (!user) lsSet(K_PEND, phone);
      else lsDel(K_PEND);
      lsSet(K_DONE, '1');
    }).catch(function () {
      lsSet(K_PEND, phone);
    }).then(function () {
      submitBtn.disabled = false;
      subSay('');
      showStep('done');
    });
  });

  /* ---------- schedule ---------- */
  function waitForAuth(cb) {
    var tries = 0;
    (function poll() {
      if (authKnown || tries++ > 10) return cb();
      setTimeout(poll, 250);
    })();
  }

  function schedule() {
    if (isDone() || isSkipped()) return;
    setTimeout(function () {
      waitForAuth(function () {
        if (user || isDone() || isSkipped()) return;
        if (document.body.classList.contains('aura-login-open')) return;
        openSubPopup();
      });
    }, DELAY_MS);
  }

  window.openSubscribePopup = function () { lsDel(K_SKIP); openSubPopup(); };

  /* ============================================================
     2. LOGIN POPUP
     ============================================================ */
  var loginOverlay = document.getElementById('auraLoginOverlay');
  var loginBound = false;

  function openLoginPopup() {
    if (!loginOverlay) {
      location.href = 'login.html';
      return;
    }
    loginOverlay.classList.add('show');
    loginOverlay.setAttribute('aria-hidden', 'false');
    document.body.classList.add('aura-login-open');
    document.body.style.overflow = 'hidden';
    if (!loginBound) bindLoginPopup();
    setTimeout(function () {
      var em = document.getElementById('auraLoginEmail');
      if (em) em.focus();
    }, 380);
  }

  function closeLoginPopup() {
    if (!loginOverlay) return;
    loginOverlay.classList.remove('show');
    loginOverlay.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('aura-login-open');
    if (!document.body.classList.contains('au-open') &&
        !subOverlay.classList.contains('show')) {
      document.body.style.overflow = '';
    }
  }

  function bindLoginPopup() {
    if (loginBound || !loginOverlay) return;
    loginBound = true;

    var lForm      = document.getElementById('auraLoginForm');
    var lEmail     = document.getElementById('auraLoginEmail');
    var lPass      = document.getElementById('auraLoginPass');
    var lRemember  = document.getElementById('auraLoginRemember');
    var lSubmit    = document.getElementById('auraLoginSubmit');
    var lMsg       = document.getElementById('auraLoginMsg');
    var lForgot    = document.getElementById('auraLoginForgot');
    var lEye       = loginOverlay.querySelector('.aura-login-eye');
    var lClose     = loginOverlay.querySelector('.aura-login-x');

    function lSay(text, kind) {
      if (!lMsg) return;
      lMsg.textContent = text || '';
      lMsg.className = 'aura-login-msg' + (kind === 'ok' ? ' ok' : '');
    }

    function lFriendly(err) {
      switch (err && err.code) {
        case 'auth/invalid-credential':
        case 'auth/wrong-password':
        case 'auth/user-not-found': return 'Email or password is incorrect.';
        case 'auth/invalid-email': return 'Please enter a valid email address.';
        case 'auth/too-many-requests': return 'Too many attempts. Try again later.';
        case 'auth/network-request-failed': return 'Network error. Check connection.';
        default: return 'Sign-in failed. Please try again.';
      }
    }

    lClose && lClose.addEventListener('click', closeLoginPopup);
    loginOverlay.addEventListener('click', function (e) {
      if (e.target === loginOverlay) closeLoginPopup();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && loginOverlay.classList.contains('show')) closeLoginPopup();
    });

    lEye && lEye.addEventListener('click', function () {
      var showing = lPass.type === 'text';
      lPass.type = showing ? 'password' : 'text';
      var i = lEye.querySelector('i');
      if (i) i.className = showing ? 'fa-regular fa-eye' : 'fa-regular fa-eye-slash';
    });

    lForm && lForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var email = (lEmail.value || '').trim().toLowerCase();
      var pass = lPass.value || '';
      var remember = lRemember ? lRemember.checked : true;

      if (!email) { lSay('Please enter your email.'); lEmail.focus(); return; }
      if (pass.length < 6) { lSay('Password must be at least 6 characters.'); lPass.focus(); return; }

      lSubmit.disabled = true;
      lSay('Signing in…');

      getFire().then(function (f) {
        if (!f || !f.auth) throw new Error('firebase-unavailable');
        return import('https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js').then(function (authMod) {
          return authMod.setPersistence(
            f.auth,
            remember ? authMod.browserLocalPersistence : authMod.browserSessionPersistence
          ).then(function () {
            return authMod.signInWithEmailAndPassword(f.auth, email, pass);
          });
        });
      }).then(function () {
        lSay('Signed in ✓', 'ok');
        setTimeout(function () {
          closeLoginPopup();
          location.reload();
        }, 700);
      }).catch(function (err) {
        console.error(err);
        lSay(lFriendly(err));
      }).finally(function () {
        lSubmit.disabled = false;
      });
    });

    lForgot && lForgot.addEventListener('click', function (e) {
      e.preventDefault();
      var email = (lEmail.value || '').trim().toLowerCase();
      if (!email) { lSay('Enter your email first.'); lEmail.focus(); return; }

      getFire().then(function (f) {
        if (!f || !f.auth) throw new Error('firebase-unavailable');
        return import('https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js').then(function (authMod) {
          return authMod.sendPasswordResetEmail(f.auth, email);
        });
      }).then(function () {
        lSay('Reset link sent. Check inbox.', 'ok');
      }).catch(function (err) {
        console.error(err);
        lSay('Could not send reset email.');
      });
    });
  }

  /* ============================================================
     3. BIND LOGIN BUTTONS
     #hmLogin (desktop) + .js-open-login (mobile) → LOGIN POPUP
     ============================================================ */
  function bindLoginButtons() {
    var btns = document.querySelectorAll('#hmLogin, .js-open-login');
    btns.forEach(function (btn) {
      if (btn.dataset.auraBound) return;
      btn.dataset.auraBound = '1';
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();

        /* If already logged in → go to account page */
        if (user) { location.href = 'user.html'; return; }

        /* Close mobile menu if open */
        var mclose = document.getElementById('mclose');
        if (mclose && document.body.classList.contains('mmenu-open')) mclose.click();

        openLoginPopup();
      }, true);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindLoginButtons);
  } else {
    bindLoginButtons();
  }

  /* ============================================================
     4. AUTO-CLOSE login popup if user logs in
     ============================================================ */
  getFire().then(function (f) {
    if (!f || !f.onAuthStateChanged) return;
    f.onAuthStateChanged(f.auth, function (u) {
      if (u && loginOverlay && loginOverlay.classList.contains('show')) {
        closeLoginPopup();
      }
    });
  });

  /* ============================================================
     5. INIT
     ============================================================ */
  watchAuth();
  schedule();
})();