(function () {
  const side = document.querySelector('.admin-side');
  const main = document.querySelector('.admin-main');
  if (!side || !main) return;

  const bar = document.createElement('div');
  bar.className = 'm-bar';
  bar.innerHTML = '<button class="m-burger" aria-label="Menu"><span></span><span></span><span></span></button><b>AURA Admin</b>';
  main.prepend(bar);

  const backdrop = document.createElement('div');
  backdrop.className = 'm-backdrop';
  document.body.appendChild(backdrop);

  const close = () => document.body.classList.remove('nav-open');
  bar.querySelector('.m-burger').addEventListener('click', () => document.body.classList.toggle('nav-open'));
  backdrop.addEventListener('click', close);
  side.querySelectorAll('a').forEach(a => a.addEventListener('click', close));
  addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
  matchMedia('(min-width: 901px)').addEventListener('change', close);
})();