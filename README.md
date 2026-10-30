# AURA — HTML · CSS · JS + Firebase

Pages: index.html (home) · shop.html · login.html (Customer + Admin tabs) · user.html (User panel) · admin.html (Admin panel)

## 1. Firebase setup (project aura-8a9b5) — one time
1. Authentication → Sign-in method → enable **Email/Password**.
2. Firestore Database → Create database → then Rules tab → paste `firestore.rules` → Publish.
3. Create your ADMIN login:
   - Authentication → Users → **Add user** (e.g. admin@aura.in + a strong password). Copy its **User UID**.
   - Firestore → Start collection `users` → Document ID = that UID → fields:
     `name` (string) = AURA Admin, `email` (string) = admin@aura.in, `role` (string) = **admin**
4. Open the site → Login page → **Admin** tab → sign in → Admin panel.
   (Customers sign up themselves from the Customer tab; they always get role `user`.)

## 2. Run it
ES modules need http (not file://). Use any static server:
`npx serve .`  or VS Code "Live Server".  localhost is already an authorised domain in Firebase.

## 3. Deploy (optional)
`npm i -g firebase-tools` → `firebase login` → `firebase init` (reuse this folder) → `firebase deploy`

## 4. Good to know
- Until you add products, the store shows 12 sample products. In Admin → Products you can add real ones, or press "Load sample products".
- Spark plan: Firebase Storage needs Blaze now, so product photos use an **Image URL** field. 
- Optional hero video: put a short muted loop at `assets/hero.mp4` — it fades in behind the hero automatically.
- Colours live at the top of css/style.css (--pink logo, --ivory background, --rose buttons).
