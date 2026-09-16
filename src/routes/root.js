// src/routes/root.js
//
// Content negotiation on the bare domain.
//
//   Accept: text/html          → landing page
//   Accept: application/ld+json, application/rdf+xml, text/turtle, …
//                              → 303 See Other to the DCAT catalog
//   Accept: */* or absent      → landing page (safe default; RDF clients that
//                                want RDF send a specific type)
//
// The catalog keeps ONE canonical URI. Root is a convenience entry point that
// points at it, not a second place the catalog lives — so harvesters that
// already hold the /v2/ URI keep working and nothing acquires two identities.
//
// The landing page follows DMG25_Huisstijlhandboek_Essentials (2025):
// grid with cropmark crosses (p.10-13), Museum typeface (p.6-8),
// palette and contrast rules (p.14-16).

import { Router } from 'express'
import fs from 'fs'
import path from 'path'

const rootRouter = Router()

// Where the DCAT catalog actually lives. Must match the path registered by
// requestDCAT() — check with: grep -n "\.get(" src/routes/v2/dcat.js
const DCAT_PATH = '/v2/'

// Types that mean "give me the data". Order matters only within this list.
const RDF_TYPES = [
    'application/ld+json',
    'application/rdf+xml',
    'text/turtle',
    'application/n-triples',
    'application/trig',
    'text/n3',
]

rootRouter.get('/', (req, res, next) => {
    // Without this, a cache stores whichever representation was served first
    // and hands it to every subsequent client regardless of their Accept.
    res.setHeader('Vary', 'Accept')

    // HTML listed first: a bare */* or a missing Accept resolves to the
    // landing page rather than to RDF.
    const wanted = req.accepts(['text/html', ...RDF_TYPES])

    if (wanted && wanted !== 'text/html') {
        // 303 rather than 301/302: this says "the thing you asked for is over
        // there", without asserting that the root URI permanently *is* the
        // catalog. Keeps the option of putting something else here later.
        return res.redirect(303, DCAT_PATH)
    }

    // Hand off to express.static if a landing page exists.
    const landing = path.join(process.cwd(), 'public', 'index.html')
    if (fs.existsSync(landing)) return next()

    // Minimal fallback so the root is never a bare 404 for humans.
    // Fonts are served from public/fonts by express.static — this router only
    // claims '/', so /fonts/* falls through to it.
    res.type('html').send(`<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>Design Museum Gent — Linked Open Data</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="alternate" type="application/ld+json" href="${DCAT_PATH}">
<link rel="preload" href="/fonts/Museum-Regular.otf" as="font" type="font/otf" crossorigin>
<link rel="preload" href="/fonts/Museum-Bold.otf" as="font" type="font/otf" crossorigin>
<style>
  /* ─── TYPEFACE (brandbook p.6-8) ────────────────────────────────────
     Museum, by Bruno Jacoby and Moritz Appich. Arial is the prescribed
     digital fallback (p.8). font-display: swap so text is readable while
     the OTFs download — these are ~150-250KB each, far heavier than WOFF2. */
  @font-face { font-family:'Museum'; src:url('/fonts/Museum-Light.otf') format('opentype');
               font-weight:300; font-style:normal; font-display:swap; }
  @font-face { font-family:'Museum'; src:url('/fonts/Museum-Regular.otf') format('opentype');
               font-weight:400; font-style:normal; font-display:swap; }
  @font-face { font-family:'Museum'; src:url('/fonts/Museum-Medium.otf') format('opentype');
               font-weight:500; font-style:normal; font-display:swap; }
  @font-face { font-family:'Museum'; src:url('/fonts/Museum-Bold.otf') format('opentype');
               font-weight:700; font-style:normal; font-display:swap; }

  :root {
    color-scheme: light;

    /* ─── PALETTE (brandbook p.14) ─────────────────────────────────── */
    --magic-purple:  #93268f;
    --deep-green:    #00a774;
    --mindful-blue:  #0094d9;
    --extra-red:     #e52529;
    --burning-orange:#ea5827;
    --dimmed-yellow: #ffcc00;
    --fresh-pink:    #ff99cc;
    --shy-gray:      #c7c8ca;
    --neutral-gray:  #949699;
    --lawful-gray:   #636466;
    --reliable-black:#000000;
    --snow-white:    #ffffff;

    /* Max three colours per design (p.14): black, white and Magic Purple.
       Light only — no dark-mode variant. Magic Purple is the only primary
       reaching WCAG AA on white (7.21:1); Deep Green (3.10), Mindful Blue
       (3.37) and Burning Orange (3.55) all fall below 4.5:1 and are not
       used for text. */
    --ink:    var(--reliable-black);
    --paper:  var(--snow-white);
    --accent: var(--magic-purple);
    --rule:   var(--shy-gray);

    /* ─── GRID (brandbook p.10) ────────────────────────────────────────
       Margin is the short side of the sheet times a factor; the cross arm
       is double the margin.

       NOTE: p.10 gives the factor as 0,5. Read literally that puts the
       margin at half the short side and the cross at the full short side,
       which does not match the templates on p.11-13. Using 0.05 as the
       working value — confirm the intended factor with the Studio. */
    --grid-factor: 0.05;
    --margin: calc(min(100vw, 100vh) * var(--grid-factor));
    --cross:  calc(var(--margin) * 2);   /* arm length, p.10 "dubbele" */
    --rule-w: 1px;                       /* 1pt standard, p.10 */
  }

  * { box-sizing: border-box; }

  body {
    margin: 0;
    background: var(--paper);
    color: var(--ink);
    font-family: 'Museum', Arial, system-ui, sans-serif;
    font-weight: 400;
    font-size: 1rem;
    /* p.8: body leading is text size + 1pt. At 16px (12pt) that is 13pt. */
    line-height: 1.0833;
    padding: calc(var(--margin) * 2.5) var(--margin);
  }

  /* ─── CROPMARK CROSSES (brandbook p.10-13) ──────────────────────────
     Four crosses minimum for digital (p.12), marking the corners of the
     subdivision. Fixed to the viewport so they frame the page the way
     they frame a sheet. Purely decorative — hidden from assistive tech. */
  .marks { position: fixed; inset: 0; pointer-events: none; z-index: 1; }
  .marks i {
    position: absolute;
    width: var(--cross); height: var(--cross);
    margin: calc(var(--cross) / -2);
  }
  .marks i::before, .marks i::after {
    content: ''; position: absolute; background: var(--rule);
  }
  .marks i::before {                     /* horizontal arm */
    left: 0; top: 50%; width: 100%; height: var(--rule-w);
    transform: translateY(-50%);
  }
  .marks i::after {                      /* vertical arm */
    top: 0; left: 50%; height: 100%; width: var(--rule-w);
    transform: translateX(-50%);
  }
  .marks .tl { top: var(--margin); left: var(--margin); }
  .marks .tr { top: var(--margin); left: calc(100% - var(--margin)); }
  .marks .bl { top: calc(100% - var(--margin)); left: var(--margin); }
  .marks .br { top: calc(100% - var(--margin)); left: calc(100% - var(--margin)); }

  main { position: relative; z-index: 2; max-width: 34rem; }

  h1 {
    font-weight: 700;
    /* Stays under the 70pt threshold where p.8 calls for 90% leading. */
    font-size: clamp(2rem, 7vw, 3.25rem);
    line-height: 1;
    letter-spacing: 0;          /* p.8: no extreme tracking adjustments */
    margin: 0 0 .75rem;
  }

  /* p.8: keep lines under ~11 words — hence the narrow measure on main. */
  .lede {
    font-weight: 300;
    font-size: 1.125rem;
    line-height: 1.15;
    margin: 0 0 calc(var(--margin) * 2);
    max-width: 28rem;
  }

  nav ul { list-style: none; padding: 0; margin: 0 0 calc(var(--margin) * 2); }
  nav li { border-top: var(--rule-w) solid var(--rule); }
  nav li:last-child { border-bottom: var(--rule-w) solid var(--rule); }
  nav a {
    display: flex; justify-content: space-between; align-items: baseline;
    gap: 1rem; padding: .85rem 0;
    font-weight: 500; text-decoration: none; color: inherit;
    transition: color .15s ease, padding-left .15s ease;
  }
  nav a:hover, nav a:focus-visible { color: var(--accent); padding-left: .4rem; }
  nav a .path {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: .8125rem; font-weight: 400; color: var(--neutral-gray);
  }
  nav a:hover .path, nav a:focus-visible .path { color: var(--accent); }

  .note {
    font-weight: 300; font-size: .9375rem; line-height: 1.25;
    color: var(--lawful-gray); max-width: 30rem;
  }

  code {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: .875em; color: var(--accent);
  }

  @media (prefers-reduced-motion: reduce) {
    nav a { transition: none; }
  }
</style></head>
<body>
<div class="marks" aria-hidden="true"><i class="tl"></i><i class="tr"></i><i class="bl"></i><i class="br"></i></div>

<main>
  <h1>Design Museum Gent</h1>
  <p class="lede">Linked Open Data — the collection as CIDOC-CRM JSON-LD.</p>

  <nav><ul>
    <li><a href="${DCAT_PATH}">DCAT catalog <span class="path">${DCAT_PATH}</span></a></li>
    <li><a href="https://api.designmuseumgent.be">Documentation <span class="path">api.designmuseumgent.be</span></a></li>
    <li><a href="https://github.com/DesignMuseumGent/dmg-rest-api">GitHub documentation</a></li>
    <li><a href="/v2/api-docs">Swagger <span class="path">/v2/api-docs</span></a></li>
    <li><a href="/v2/id/objects">Objects <span class="path">/v2/id/objects</span></a></li>
  </ul></nav>

  <p class="note">This URI content-negotiates: request it with
  <code>Accept: application/ld+json</code> to be redirected to the catalog.</p>
</main>
</body></html>`)
})

export default rootRouter