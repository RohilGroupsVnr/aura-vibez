import { db, auth, onAuthStateChanged } from './firebase.js';
import { doc, getDoc, setDoc, updateDoc, collection, getDocs } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const grid = document.getElementById('wishGrid');
let user = null;
let wishItems = []; // {id, addedAt}

onAuthStateChanged(auth, async u => {
    user = u;
    if (!u) {
        grid.innerHTML = `<div style="grid-column:1/-1" class="empty-state">
      <h3 class="serif">Please login</h3><p>Sign in to view your wishlist</p>
      <a href="login.html" class="btn btn-primary">Login</a></div>`;
        return;
    }
    const snap = await getDoc(doc(db, 'wishlists', u.uid));
    wishItems = snap.exists() ? snap.data().items || [] : [];
    await render();
    updateBadge(wishItems.length);
});

async function render() {
    if (!wishItems.length) {
        grid.innerHTML = `<div style="grid-column:1/-1" class="empty-state">
      <h3 class="serif">Your wishlist is empty</h3>
      <p>Save your favourite items here</p>
      <a href="shop.html" class="btn btn-primary">Explore Products</a>
    </div>`;
        return;
    }
    // Fetch products by ID
    const ids = wishItems.map(w => w.id);
    const products = [];
    for (const id of ids) {
        const s = await getDoc(doc(db, 'products', id));
        if (s.exists()) products.push({ id: s.id, ...s.data() });
    }

    grid.innerHTML = products.map(p => {
        const off = p.mrp ? Math.round((1 - p.price / p.mrp) * 100) : 0;
        return `
      <article class="pcard">
        <a href="product.html?id=${p.id}" class="pmedia">
          <div class="art art-${p.category || 'fashion'}">
            <img src="${p.image}" alt="${p.name}" onerror="this.style.display='none'">
          </div>
          ${off > 0 ? `<span class="ptag">-${off}%</span>` : ''}
          <button class="pheart on" data-id="${p.id}" style="color:#fff;background:var(--rose)">♥</button>
        </a>
        <div class="pinfo">
          <small>${p.category || 'AURA'}</small>
          <h3><a href="product.html?id=${p.id}">${p.name}</a></h3>
          <div class="pprice"><b>₹${p.price}</b>${p.mrp ? `<s>₹${p.mrp}</s>` : ''}</div>
          <button class="btn btn-primary btn-sm block" style="margin-top:12px" data-add="${p.id}">Add to Cart</button>
        </div>
      </article>`;
    }).join('');

    // Heart = remove
    grid.querySelectorAll('.pheart').forEach(b => {
        b.onclick = async e => {
            e.preventDefault(); e.stopPropagation();
            wishItems = wishItems.filter(w => w.id !== b.dataset.id);
            await updateDoc(doc(db, 'wishlists', user.uid), { items: wishItems });
            toast('Removed from wishlist');
            render(); updateBadge(wishItems.length);
        };
    });

    // Add to cart
    grid.querySelectorAll('[data-add]').forEach(b => {
        b.onclick = async () => {
            const p = products.find(x => x.id === b.dataset.add);
            const ref = doc(db, 'carts', user.uid);
            const s = await getDoc(ref);
            let cartItems = s.exists() ? s.data().items || [] : [];
            const ex = cartItems.find(i => i.id === p.id);
            if (ex) ex.qty++; else cartItems.push({ ...p, qty: 1 });
            if (s.exists()) await updateDoc(ref, { items: cartItems });
            else await setDoc(ref, { items: cartItems });
            const count = cartItems.reduce((sum, i) => sum + i.qty, 0);
            updateBadge(wishItems.length, count);
            toast('Added to cart ✓');
        };
    });
}

function updateBadge(w, c) {
    const wb = document.getElementById('wishBadge');
    const cb = document.getElementById('cartBadge');
    if (wb) { wb.textContent = w; wb.classList.toggle('on', w > 0); }
    if (cb && c != null) { cb.textContent = c; cb.classList.toggle('on', c > 0); }
    localStorage.setItem('wishCount', w);
}

window.toast = (msg, type = 'ok') => {
    const box = document.getElementById('toasts');
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    t.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg><span>${msg}</span>`;
    box.appendChild(t);
    requestAnimationFrame(() => t.classList.add('show'));
    setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 500); }, 2600);
};