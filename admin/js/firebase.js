// AURA - Firebase Configuration (ADMIN side)
// Named app "aura-admin" -> admin session never touches the customer session.
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";

import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  updateProfile,
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

const firebaseConfig = {
  apiKey: "AIzaSyDv425kiGK02A5r9HggmKK-o6vjxYHhkKM",
  authDomain: "aura-8a9b5.firebaseapp.com",
  projectId: "aura-8a9b5",
  storageBucket: "aura-8a9b5.firebasestorage.app",
  messagingSenderId: "661416561997",
  appId: "1:661416561997:web:a1fb59fa32f816a8b73b04",
  measurementId: "G-ZCSHSQY3EY"
};

export const app = initializeApp(firebaseConfig, "aura-admin");
export const auth = getAuth(app);
export const db = getFirestore(app);

setPersistence(auth, browserLocalPersistence).catch((e) => console.warn("Persistence:", e));

export {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  updateProfile,
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