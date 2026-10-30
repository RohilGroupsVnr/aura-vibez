// AURA - Firebase Configuration (USER / CUSTOMER side)
// Named app "aura-customer" -> its login session is separate from the admin panel.
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";

import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  updateProfile,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";

import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  onSnapshot,
  writeBatch,
  runTransaction
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

import { getStorage } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyDv425kiGK02A5r9HggmKK-o6vjxYHhkKM",
  authDomain: "aura-8a9b5.firebaseapp.com",
  projectId: "aura-8a9b5",
  storageBucket: "aura-8a9b5.firebasestorage.app",
  messagingSenderId: "661416561997",
  appId: "1:661416561997:web:a1fb59fa32f816a8b73b04",
  measurementId: "G-ZCSHSQY3EY"
};

// Second argument = app name -> customer session is stored separately from admin
export const app = initializeApp(firebaseConfig, "aura-customer");
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// Keep the OTP login saved even after the browser is closed
setPersistence(auth, browserLocalPersistence).catch((e) => console.warn("Persistence:", e));

export {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  updateProfile,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,

  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  onSnapshot,
  writeBatch,
  runTransaction
};

/* ============================================================
   ADMIN EMAILS (kept so older imports keep working)
   ============================================================ */
export const ADMIN_EMAILS = [
  "auraclothing.vnr@gmail.com",
  "auraclothingvnr@gmail.com",
  "admin@aura.com"
];

export function isAdminEmail(email) {
  if (!email) return false;
  const e = String(email).toLowerCase().trim();
  return ADMIN_EMAILS.map((x) => x.toLowerCase()).includes(e);
}

/* Real customer = phone + OTP login, never an admin email */
export function isCustomerUser(user) {
  return !!user &&
    !!user.phoneNumber &&
    user.providerData.some((p) => p.providerId === "phone") &&
    !isAdminEmail(user.email);
}

/* Waits until Firebase restores the saved session, then returns the customer or null.
   Use this instead of reading auth.currentUser right at page load. */
export async function getCustomer() {
  await auth.authStateReady();
  return isCustomerUser(auth.currentUser) ? auth.currentUser : null;
}