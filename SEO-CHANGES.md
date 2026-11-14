# AURA — SEO update log (no functional code changed)

Only <head> metadata, visually-hidden semantic text, and new files were added.
All existing HTML/CSS/JS/Firebase/Razorpay/cart/checkout logic is untouched.

## New files
- robots.txt, sitemap.xml            (site root)
- user/js/seo-product.js             (adds Product schema + canonical + OG on product pages; read-only DOM helper)
- user/js/seo-shop.js                (per-category canonical; noindex for ?q= search pages)

## Pages updated
- index.html (root): real title/description, H1, ~300 words of intro text, 23 internal links, canonical,
  favicon + apple-touch-icon, Open Graph/Twitter, Organization/WebSite JSON-LD, <noscript> fallback. Redirect to splash is unchanged.
- user/index.html: description, keywords, hidden H1, canonical, OG/Twitter, Organization + WebSite(SearchAction) + FAQPage JSON-LD.
- shop, newcollections, contact, size-guide, shipping, returns, privacy-policy, terms, trackorder, product:
  keyword-rich title + description, keywords, canonical, OG/Twitter, BreadcrumbList/WebPage JSON-LD, apple-touch-icon.
- noindex: admin/*.html, user/seed.html, user/wishlist.html, user/order-history.html, user/splash.html
- Fixed broken favicon path (assets/favicon.png -> ../assets/favicon.png) in splash/order-history/trackorder.
