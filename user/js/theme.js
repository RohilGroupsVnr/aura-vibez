/* AURA — Light / Dark Theme
   Sun icon only.
   Saves theme preference and prevents duplicate toggle buttons.
*/

(function () {
  var KEY = 'aura-theme';
  var root = document.documentElement;

  function read() {
    try {
      return localStorage.getItem(KEY);
    } catch (e) {
      return null;
    }
  }

  function write(value) {
    try {
      localStorage.setItem(KEY, value);
    } catch (e) {}
  }

  function current() {
    return root.getAttribute('data-theme') === 'dark'
      ? 'dark'
      : 'light';
  }

  // Apply the selected theme
  function paint(theme) {
    root.setAttribute('data-theme', theme);

    var button = document.getElementById('themeBtn');

    if (button) {
      button.setAttribute('aria-pressed', theme === 'dark');
      button.setAttribute(
        'aria-label',
        theme === 'dark'
          ? 'Switch to light theme'
          : 'Switch to dark theme'
      );

      button.title = theme === 'dark'
        ? 'Light theme'
        : 'Dark theme';
    }
  }

  // Default theme: Light
  paint(read() === 'dark' ? 'dark' : 'light');

  // Change theme
  function setTheme(theme) {
    root.classList.add('theme-anim');

    paint(theme);
    write(theme);

    setTimeout(function () {
      root.classList.remove('theme-anim');
    }, 450);
  }

  // Sun icon only
  var SUN =
    '<svg class="t-sun" width="21" height="21" ' +
    'viewBox="0 0 24 24" fill="none" ' +
    'stroke="currentColor" stroke-width="1.7" ' +
    'stroke-linecap="round" stroke-linejoin="round" ' +
    'aria-hidden="true">' +
    '<circle cx="12" cy="12" r="4.2"/>' +
    '<path d="M12 2.5v2.2M12 19.3v2.2' +
    'M2.5 12h2.2M19.3 12h2.2' +
    'M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6' +
    'M18.7 5.3l-1.6 1.6M6.9 17.1l-1.6 1.6"/>' +
    '</svg>';

  // Create the theme button
  function make(floating) {
    var button = document.createElement('button');

    button.type = 'button';
    button.id = 'themeBtn';
    button.className =
      'icon-btn theme-btn' +
      (floating ? ' theme-fab' : '');

    button.innerHTML = SUN;

    button.addEventListener('click', function () {
      setTheme(current() === 'dark' ? 'light' : 'dark');
    });

    return button;
  }

  // Add one button beside Login
  function mount() {
    var box = document.querySelector('.nav-actions');

    if (!box) {
      return false;
    }

    // Remove any duplicate button created by this script
    var buttons = document.querySelectorAll('#themeBtn');

    buttons.forEach(function (button, index) {
      if (index > 0) {
        button.remove();
      }
    });

    var button = document.getElementById('themeBtn');

    if (!button) {
      button = make(false);
    }

    // Ensure only the sun icon is displayed
    button.innerHTML = SUN;
    button.classList.remove('theme-fab');

    var login = document.getElementById('hmLogin');

    if (login && login.parentElement === box) {
      // Position immediately after Login
      if (login.nextElementSibling !== button) {
        box.insertBefore(button, login.nextSibling);
      }
    } else if (button.parentElement !== box) {
      box.insertBefore(button, box.firstChild);
    }

    paint(current());

    return true;
  }

  function start() {
    if (mount()) {
      return;
    }

    // Wait if the navbar is created dynamically
    var observer = new MutationObserver(function () {
      if (mount()) {
        observer.disconnect();
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    // If this page has no navbar, use a floating button
    setTimeout(function () {
      observer.disconnect();

      if (!document.querySelector('.nav-actions')) {
        if (!document.getElementById('themeBtn')) {
          document.body.appendChild(make(true));
        }

        paint(current());
      }
    }, 900);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }

  // Synchronize theme across open tabs
  window.addEventListener('storage', function (event) {
    if (event.key === KEY) {
      paint(event.newValue === 'dark' ? 'dark' : 'light');
    }
  });

})();