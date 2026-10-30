//Authentication Code USER's

// AURA — Shared authentication session

import {
  auth,
  db,
  onAuthStateChanged,
  signOut,
  doc,
  getDoc
} from "./firebase.js";

export const state = {
  user: null,
  profile: null
};

const subscribers = [];

let initialized = false;

export const ready = new Promise((resolve) => {
  onAuthStateChanged(auth, async (user) => {
    state.user = user;
    state.profile = null;

    if (user) {
      try {
        const snapshot = await getDoc(
          doc(db, "users", user.uid)
        );

        state.profile = snapshot.exists()
          ? snapshot.data()
          : null;
      } catch (error) {
        console.error("Profile loading failed:", error);
      }
    }

    subscribers.forEach((callback) => {
      callback(state);
    });

    if (!initialized) {
      initialized = true;
      resolve(state);
    }
  });
});

export function onAuthChange(callback) {
  subscribers.push(callback);

  if (initialized) {
    callback(state);
  }

  return () => {
    const index = subscribers.indexOf(callback);

    if (index !== -1) {
      subscribers.splice(index, 1);
    }
  };
}

export const isAdmin = () =>
  state.profile?.role === "admin";

export async function logout() {
  await signOut(auth);
  window.location.href = "index.html";
}

export function displayName() {
  return (
    state.profile?.name ||
    state.user?.displayName ||
    state.user?.phoneNumber ||
    state.user?.email?.split("@")[0] ||
    "Guest"
  );
}