# Kamaldeen Akinade / Portfolio

A static, hand-built portfolio. No framework, no build step needed to edit content.

## Structure

- `index.html` : all page content
- `style.css` : all styles (design tokens live in `:root` at the top)
- `js/main.js` : menu, scroll reveals, card tilt, Lagos clock, copy-email, and lazy loading of the 3D hero
- `src/hero-scene.js` : source for the Three.js particle palm
- `js/hero-scene.js` : bundled, minified output of the above (generated, do not edit by hand)
- `images/` : optimized hero images (WebP at 480/720/960 plus a JPEG fallback) and `og.jpg` for link previews

## Editing the 3D hero

```bash
npm install
npm run build   # rebuilds js/hero-scene.js from src/hero-scene.js
```

## Performance notes

- The page is usable before any 3D code downloads. The Three.js bundle is fetched only after the
  `load` event, when the browser is idle.
- The 3D scene is skipped entirely for visitors with reduced motion or data saver enabled, or without
  WebGL. They see the optimized photo instead.
- The render loop pauses when the hero is off screen or the tab is hidden, and it lowers its own
  resolution and particle count on devices that struggle.

## Preview locally

```bash
python3 -m http.server 8000   # then open http://localhost:8000
```
