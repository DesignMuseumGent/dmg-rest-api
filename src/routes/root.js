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

<!-- Favicon. The GIF works as a favicon in every current browser, and it
     animates in the tab in Firefox; Chrome and Safari show the first frame.
     A dedicated 32x32 PNG or an SVG would render more crisply at tab size —
     the pixel mark has fine detail that gets muddy when a large GIF is
     downscaled to 16px — so swap these if you export one. -->
<link rel="icon" href="/images/Pixel-Logo-41-frames-transparent.gif" type="image/gif">
<link rel="apple-touch-icon" href="/images/Pixel-Logo-41-frames-transparent.gif">

<!-- Link previews in Slack, Teams, Mastodon, iMessage. -->
<meta property="og:title" content="Design Museum Gent API">
<meta property="og:description" content="Since 1903 the museum has invited everyone to come and draw, study, copy and remake what is on display. The Collection API continues that invitation: over 8,400 objects as CIDOC-CRM JSON-LD, with IIIF images, colour data and linked designers. Open to everyone, no key required.">
<meta property="og:type" content="website">
<meta property="og:image" content="/images/Pixel-Logo-41-frames-transparent.gif">
<meta name="twitter:card" content="summary">
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
  @font-face { font-family:'Heins'; src:url('/fonts/ArmandHeins1-Regular.otf') format('opentype');
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
    /* Hairline rules under the nav links — kept light so they read as
       structure rather than as content. */
    --rule:   var(--shy-gray);
    /* Cropmarks in Reliable Black: the brandbook has the grid in black or
       white depending on the effect wanted (p.10), and black gives them the
       presence of a real registration mark rather than a faint guide. */
    --mark:   var(--reliable-black);

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
    /* No page padding: .page fills the viewport and each cell pads its own
       content, so the crosses can sit at the true corners. */
    padding: 0;
  }

  /* ─── GRID AND CROPMARKS (brandbook p.10-13) ────────────────────────
     The werkvlak is the whole viewport, divided into two cells: text left,
     logo right. The crosses mark the corners of that subdivision — six
     positions, because the two cells share a vertical edge.

     A single overlay draws all six. Per-element backgrounds cannot do this:
     each cell would draw its own cross a little way in from the shared
     edge, giving two crosses where the design wants one.

     Each cross is a positioned element centred on its intersection, so it
     is never clipped the way a background at a box corner would be.

     --col-split is used twice — once for the grid columns, once for the
     middle pair of crosses — so the marks always sit exactly on the
     boundary between the cells. */
  :root {
    --col-split: 42%;
    --pad: var(--margin);     /* how far the outer crosses sit from the edge */
  }

  /* Absolute, not fixed: the marks belong to the hero section and must
     scroll away with it, otherwise they float over the dashboard below. */
  .hero { position: relative; min-height: 100vh; }
  .marks { position: absolute; inset: 0; pointer-events: none; z-index: 1; }
  .marks i {
    position: absolute;
    width: var(--cross); height: var(--cross);
    transform: translate(-50%, -50%);
  }
  .marks i::before, .marks i::after {
    content: ''; position: absolute; background: var(--mark);
  }
  .marks i::before {                     /* horizontal arm */
    left: 0; top: 50%; width: 100%; height: var(--rule-w);
    transform: translateY(-50%);
  }
  .marks i::after {                      /* vertical arm */
    top: 0; left: 50%; height: 100%; width: var(--rule-w);
    transform: translateX(-50%);
  }
  .marks .tl { top: var(--pad);                left: var(--pad); }
  .marks .tm { top: var(--pad);                left: var(--col-split); }
  .marks .tr { top: var(--pad);                left: calc(100% - var(--pad)); }
  .marks .bl { top: calc(100% - var(--pad));   left: var(--pad); }
  .marks .bm { top: calc(100% - var(--pad));   left: var(--col-split); }
  .marks .br { top: calc(100% - var(--pad));   left: calc(100% - var(--pad)); }

  /* ─── LAYOUT ─────────────────────────────────────────────────────────
     Two cells filling the viewport. Content is inset from the cell edges
     so it clears the crosses. Single column below 720px, where the logo is
     dropped rather than stacked — it is decorative and the h1 already
     carries the name. */
  .page {
    position: relative; z-index: 2;
    display: grid;
    grid-template-columns: var(--col-split) 1fr;
    min-height: 100vh;
    align-items: center;
  }

  /* ─── DASHBOARD ──────────────────────────────────────────────────────
     Live counts from the API itself. Fetched client-side: this page is
     served by the same process as the API, so fetching server-side would
     have it calling itself and blocking the response.

     Its own cropmarks, drawn as eight gradients — a horizontal and a
     vertical band at each corner — because an element has only two
     pseudo-elements. The inset is half the arm length so each cross stays
     whole; backgrounds do not paint outside the padding box, so a cross
     centred on the corner would be clipped to a quarter.

     Padding must stay at least var(--pad) on every side or the arms sit on
     the content. */
  .stats {
    /* Full bleed, no horizontal margin: the crosses then sit var(--pad)
       from the viewport edge, exactly where the hero's outer crosses sit,
       so the two blocks read as one grid rather than two. */
    margin: 0;
    padding: calc(var(--pad) * 2.5) calc(var(--pad) * 1.5);
    background-image:
      linear-gradient(var(--mark), var(--mark)), linear-gradient(var(--mark), var(--mark)),
      linear-gradient(var(--mark), var(--mark)), linear-gradient(var(--mark), var(--mark)),
      linear-gradient(var(--mark), var(--mark)), linear-gradient(var(--mark), var(--mark)),
      linear-gradient(var(--mark), var(--mark)), linear-gradient(var(--mark), var(--mark));
    background-size:
      var(--cross) var(--rule-w), var(--rule-w) var(--cross),
      var(--cross) var(--rule-w), var(--rule-w) var(--cross),
      var(--cross) var(--rule-w), var(--rule-w) var(--cross),
      var(--cross) var(--rule-w), var(--rule-w) var(--cross);
    background-position:
      left  0 top    calc(var(--pad) - var(--rule-w) / 2),
      left  calc(var(--pad) - var(--rule-w) / 2) top 0,
      right 0 top    calc(var(--pad) - var(--rule-w) / 2),
      right calc(var(--pad) - var(--rule-w) / 2) top 0,
      left  0 bottom calc(var(--pad) - var(--rule-w) / 2),
      left  calc(var(--pad) - var(--rule-w) / 2) bottom 0,
      right 0 bottom calc(var(--pad) - var(--rule-w) / 2),
      right calc(var(--pad) - var(--rule-w) / 2) bottom 0;
    background-repeat: no-repeat;
  }

  .stats h2 {
    font-family: Heins;
    font-weight: 500;
    font-size: .8125rem;
    letter-spacing: .08em;
    text-transform: uppercase;
    color: var(--lawful-gray);
    margin: 0 0 calc(var(--pad) * 2.5);
  }

  .stats dl {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr));
    gap: calc(var(--pad) * 1.5) var(--pad);
    margin: 0;
  }

  .stats dt {
    font-family: Heins;
    font-weight: 400;
    font-size: .9375rem;
    color: var(--lawful-gray);
    order: 2;                      /* label below the figure */
  }

  .stats dd {
    margin: 0 0 .15rem;
    font-weight: 700;
    font-size: clamp(1.75rem, 4vw, 2.75rem);
    line-height: 1;
    font-variant-numeric: tabular-nums;
    order: 1;
  }

  .stats .pair { display: flex; flex-direction: column; }

  /* Placeholder until the fetch resolves, and the resting state if it
     fails — the page must never look broken because a count is missing. */
  .stats dd[data-pending] { color: var(--shy-gray); }

  main {
    padding: calc(var(--pad) * 2) calc(var(--pad) * 1.5);
    max-width: 34rem;
  }

  /* ─── PIXEL LOGO ─────────────────────────────────────────────────────
     The animated variable logo (brandbook p.5 — "een variabel logo"),
     served from public/images by express.static. Transparent GIF, so it
     sits on Snow White without a matte.

     Decorative: alt="" and aria-hidden, since the h1 already states the
     name. A screen reader announcing "pixel logo" here would add nothing.

     REDUCED MOTION: an animated GIF cannot be paused with CSS. The rule
     further down hides it for anyone who has asked for less motion, which
     is blunt but honest — the alternative is exporting a single static
     frame as a PNG and swapping the src. */
  .logo-cell {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: calc(var(--pad) * 2);
    height: 100%;
  }

  .mark-logo {
    display: block;
    width: 100%;
    height: auto;
    max-height: calc(100vh - var(--pad) * 5);
    object-fit: contain;
    /* The mark is deliberately pixelated — let it stay hard-edged when
       scaled up instead of being smoothed by the browser. */
    image-rendering: pixelated;
  }

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
    font-family: Heins;
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

    .pair a {
        text-decoration: none; color: inherit;
    }
    
    .pair a:hover, .pair a:focus-visible { color: var(--accent); }

  .note {
    font-weight: 300; font-size: .9375rem; line-height: 1.25;
    color: var(--lawful-gray); max-width: 30rem;
  }

  code {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: .875em; color: var(--accent);
  }

  @media (max-width: 720px) {
    .page { grid-template-columns: 1fr; }
    .logo-cell { display: none; }
    /* One cell now, so the middle pair of crosses has no boundary to mark. */
    .marks .tm, .marks .bm { display: none; }
    /* Too narrow for the marks to read as anything but clutter. */
    .stats { background-image: none; padding: 2rem 1.5rem; }
  }

  @media (prefers-reduced-motion: reduce) {
    nav a { transition: none; }
    /* See the note on .mark-logo: a GIF cannot be paused from CSS. */
    .logo-cell { display: none; }
  }
</style></head>
<body>
<section class="hero">
<div class="marks" aria-hidden="true"><i class="tl"></i><i class="tm"></i><i class="tr"></i><i class="bl"></i><i class="bm"></i><i class="br"></i></div>

<div class="page">
  <main>
    <h1>Design Museum Gent API</h1>
    <p class="lede">The museum was founded in 1903 to be open to anyone who
    wanted to draw, study, copy and remake what it held. This API is that
    invitation in a digital form.</p>

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

  <div class="logo-cell">
    <img class="mark-logo" src="/images/Pixel-Logo-41-frames-transparent.gif"
         alt="" aria-hidden="true" loading="lazy" decoding="async">
  </div>
</div>
</section>

<section class="stats" aria-labelledby="stats-heading">
  <h1 id="stats-heading">The API in numbers</h1>
  <dl>
    <div class="pair">
        <a href="/v2/id/objects?itemsPerPage=1">
            <dd data-stat="objects"    data-pending>—</dd>
        </a>
        <dt>Objects</dt>
    </div>
    <div class="pair">
        <a href="/v2/id/objects?itemsPerPage=10&hasImages=true">
            <dd data-stat="images"     data-pending>—</dd>
        </a>
        <dt>With images</dt>
    </div>
    <div class="pair">
        <a href="/v2/id/objects?itemsPerPage=10&onDisplay=true">
            <dd data-stat="onDisplay"  data-pending>—</dd>
        </a>
        <dt>On display</dt>
    </div>
    <div class="pair">
        <a href="/v2/id/agents?itemsPerPage=10">
            <dd data-stat="agents"     data-pending>—</dd>
        </a>
        <dt>Designers &amp; makers</dt>
    </div>
    <div class="pair">
        <a href="/v2/id/exhibitions?itemsPerPage=10">
            <dd data-stat="exhibitions" data-pending>—</dd>
        </a>
        <dt>Exhibitions</dt>
    </div>
    <div class="pair">
        <a href="/v2/id/concepts?itemsPerPage=10">
            <dd data-stat="concepts"   data-pending>—</dd>
        </a>
        <dt>Concepts</dt></div>
  </dl>
</section>

<script>
// Live counts, read from hydra:totalItems. itemsPerPage=1 keeps each
// response to a single member — we only want the total, not the data.
//
// Every count is fetched independently and failures are swallowed per
// stat: one endpoint being slow or down leaves an em dash in that slot
// rather than emptying the whole dashboard.
(function () {
  var stats = {
    objects:     '/v2/id/objects?itemsPerPage=1',
    images:      '/v2/id/objects?itemsPerPage=1&hasImages=true',
    onDisplay:   '/v2/id/objects?itemsPerPage=1&onDisplay=true',
    agents:      '/v2/id/agents?itemsPerPage=1',
    exhibitions: '/v2/id/exhibitions?itemsPerPage=1',
    concepts:    '/v2/id/concepts?itemsPerPage=1'
  };

  Object.keys(stats).forEach(function (key) {
    var el = document.querySelector('[data-stat="' + key + '"]');
    if (!el) return;

    fetch(stats[key], { headers: { Accept: 'application/ld+json' } })
      .then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
      .then(function (d) {
        var n = d['hydra:totalItems'];
        if (typeof n !== 'number') return Promise.reject('no total');
        el.textContent = n.toLocaleString('en-GB');
        el.removeAttribute('data-pending');
      })
      .catch(function () { /* leave the em dash in place */ });
  });
})();
</script>
</body></html>`)
})

export default rootRouter