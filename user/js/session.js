// AURA - shared customer session (login popup + account menu + logout)
// Include on every user page:  <script type="module" src="js/session.js"></script>
import { auth, onAuthStateChanged, signOut, isCustomerUser } from "./firebase.js";
import "./phone-auth.js";

const $ = (id) => document.getElementById(id);
const root = document.documentElement;

const overlay    = $("auraLoginOverlay");
const closeBtn   = overlay?.querySelector(".aura-login-x");
const phoneInput = $("auraPhone");
const account    = $("acct");
const avatarBtn  = $("avatarBtn");
const logoutBtn  = $("logoutBtn");
const userName   = $("userName");
const userEmail  = $("userEmail");

let lastFocus = null;
let signedIn = false;

function openLogin() {
  if (!overlay) return;
  lastFocus = document.activeElement;
  overlay.classList.add("show");
  overlay.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
  setTimeout(() => phoneInput?.focus(), 250);
}

function closeLogin() {
  if (!overlay) return;
  overlay.classList.remove("show");
  overlay.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
  if (lastFocus?.focus) lastFocus.focus();
}

function openMenu() {
  account?.classList.add("open");
  avatarBtn?.setAttribute("aria-expanded", "true");
}

function closeMenu() {
  account?.classList.remove("open");
  avatarBtn?.setAttribute("aria-expanded", "false");
}

/* Login buttons (navbar + mobile menu) */
document.querySelectorAll("#hmLogin, .js-open-login").forEach((btn) => {
  btn.addEventListener("click", (e) => {
    e.preventDefault();
    document.body.classList.remove("mmenu-open");
    if (signedIn) { closeLogin(); openMenu(); }
    else openLogin();
  });
});

avatarBtn?.addEventListener("click", (e) => {
  e.stopPropagation();
  account?.classList.contains("open") ? closeMenu() : openMenu();
});

document.addEventListener("click", (e) => {
  if (account && !account.contains(e.target)) closeMenu();
});

closeBtn?.addEventListener("click", closeLogin);
overlay?.addEventListener("click", (e) => { if (e.target === overlay) closeLogin(); });

document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  closeMenu();
  if (overlay?.classList.contains("show")) closeLogin();
});

/* Auth state: only phone + OTP customers count as logged in */
onAuthStateChanged(auth, (user) => {
  signedIn = isCustomerUser(user);

  if (signedIn) {
    try { localStorage.setItem("aura_auth_hint", "1"); } catch (e) { }
    root.classList.add("is-user");
    if (userName)  userName.textContent  = user.displayName || "AURA Customer";
    if (userEmail) userEmail.textContent = user.phoneNumber;
    closeLogin();
  } else {
    try { localStorage.setItem("aura_auth_hint", "0"); } catch (e) { }
    root.classList.remove("is-user");
    closeMenu();
  }
});

/* Logout (customer session only; admin is not touched) */
logoutBtn?.addEventListener("click", async () => {
  logoutBtn.disabled = true;
  try {
    await signOut(auth);
    try { localStorage.setItem("aura_auth_hint", "0"); } catch (e) { }
    location.reload();
  } catch (err) {
    console.error("Logout failed:", err);
    alert("Logout failed. Please try again.");
    logoutBtn.disabled = false;
  }
});