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

<!-- Search snippet. Separate from og:description: engines prefer an explicit
     meta description and fall back to Open Graph only when it is absent. -->
<meta name="description" content="Open access to the Design Museum Gent collection as CIDOC-CRM JSON-LD — objects, designers, exhibitions and concepts. No authentication, open CORS, stable identifiers.">

<!-- Link previews in Slack, Teams, Discord, Mastodon, iMessage.
     Description kept near 155 characters: desktop cards show ~300, but
     mobile truncates around 125-160, so this fills the box without cutting. -->
<meta property="og:site_name" content="Design Museum Gent">
<meta property="og:title" content="Design Museum Gent API">
<meta property="og:description" content="Since 1903 the museum has invited everyone to draw, study and copy what is on display. The collection API continues that invitation — open to all, no key.">
<meta property="og:type" content="website">
<meta property="og:url" content="https://data.designmuseumgent.be/">
<meta property="og:locale" content="en_GB">

<!-- NOTE ON RATIO: this asset is square (1:1). Most platforms crop or
     letterbox to 1.91:1 (1200x630), so the sides will be trimmed. If that
     loses anything important, ask the Studio for a 1200x630 version with the
     title set in Museum Bold — a card carrying a headline is also markedly
     more clickable than a bare mark. Absolute URL: some crawlers do not
     resolve relative paths. -->
<meta property="og:image" content="https://data.designmuseumgent.be/images/SPLIT_CollectieAPI_Square.webp">
<meta property="og:image:type" content="image/webp">
<meta property="og:image:alt" content="Design Museum Gent API — the collection as CIDOC-CRM JSON-LD">

<meta name="twitter:card" content="summary_large_image">

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
  /* Declared at 400 — the file is a single regular weight. Declaring it as
     700 while asking for 300 or 400 elsewhere makes the browser synthesise
     those weights, which distorts the letterforms. */
  @font-face { font-family:'Heins'; src:url('/fonts/ArmandHeins1-Regular.otf') format('opentype');
               font-weight:400; font-style:normal; font-display:swap; }

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

  /* ─── .framed — CROPMARKS ON ANY BLOCK (brandbook p.10-13) ───────────
     HOW TO USE: put class="framed" on a section. That is all.

     HOW IT WORKS: an element has only two pseudo-elements, so four crosses
     cannot be drawn that way. Instead eight linear-gradient layers sit in
     one background-image — a horizontal and a vertical band per corner.
     background-size gives each layer its dimensions (arm x 1px, or
     1px x arm) and background-position places it, inset from the corner by
     half the arm so the cross stays whole: backgrounds do not paint outside
     the padding box, so a cross centred exactly on a corner is clipped to a
     quarter.

     TWO RULES, both easy to break by accident:

       1. Pad the element on ALL FOUR SIDES by at least var(--pad). This
          class sets that padding itself; if you override it, do not go
          below var(--pad) or the arms land on the text. "padding: X 0" is
          the classic mistake — vertical room, none horizontally, so the
          side arms sit on the content.

       2. Never set the "background" SHORTHAND on a framed element. It
          resets background-image and the crosses disappear without any
          error. Use background-color.

     DO NOT USE IT ON: anything that scrolls sideways (overflow-x: auto) or
     positions children absolutely. Backgrounds paint against the scrollable
     content box, so the right-hand marks end up off-screen; and absolutely
     positioned children ignore the padding the marks need. Code blocks do
     both, which is why they are left unframed elsewhere. */
  .framed {
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
  /* Marks come from .framed on the element. Full bleed, no horizontal
     margin, so the crosses sit var(--pad) from the viewport edge — exactly
     where the hero's outer crosses sit, and the blocks read as one grid. */
  .stats { margin: 0; }

  .stats h2 {
    font-family: 'Heins', 'Museum', Arial, sans-serif;
    font-weight: 400;
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
    font-family: 'Heins', 'Museum', Arial, sans-serif;
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

  /* The anchor sits INSIDE the dd. A <dd> must be a direct child of <dl>
     or of a <div> within it — wrapping it in an <a> is invalid and the
     browser hoists the anchor out, breaking both the link and the layout. */
  .stats dd a {
    text-decoration: none;
    color: inherit;
    transition: color .15s ease;
  }
  .stats dd a:hover, .stats dd a:focus-visible { color: var(--accent); }

  /* Placeholder until the fetch resolves, and the resting state if it
     fails — the page must never look broken because a count is missing. */
  .stats [data-stat][data-pending] { color: var(--shy-gray); }

  /* ─── INDEXES ────────────────────────────────────────────────────────
     The section that frames every index below it. Its heading is set large
     — this is a division of the page, not a label on a block, so it does
     not take the small uppercase treatment used on .stats and inside the
     index sections themselves. */
  /* Marks come from .framed. Padding is overridden for a taller top —
     still well above var(--pad) on every side, which is the only constraint
     .framed imposes. */
  .indexes {
    margin: 0;
    padding: calc(var(--pad) * 3) calc(var(--pad) * 1.5);
  }

  .indexes h2 {
    font-weight: 700;
    font-size: clamp(1.75rem, 5vw, 2.75rem);
    line-height: 1.05;
    letter-spacing: 0;
    margin: 0 0 calc(var(--pad) * 1.5);
    max-width: 20ch;
  }

  /* Text on the left, contents on the right. The intro keeps its own two
     columns inside its share, so the page reads as three columns without
     the list being swept into the text flow. */
  .indexes-body {
    display: grid;
    grid-template-columns: minmax(0, 2.2fr) minmax(0, 1fr);
    gap: calc(var(--pad) * 2);
    align-items: start;
  }

  /* Two columns via CSS multi-column: the text is one continuous argument,
     so it should flow between the columns rather than be split into two
     independent blocks. column-fill: balance keeps them level. */
  .index-intro {
    columns: 2;
    column-gap: calc(var(--pad) * 2);
    column-fill: balance;
    /* Reading leading, not the brandbook's 9pt folder spec — see the note
       on body above. */
    line-height: 1.5;
  }

  .index-intro p {
    margin: 0 0 1em;
    /* Stops a paragraph breaking one line before a column edge. */
    break-inside: avoid-column;
  }
  .index-intro p:last-child { margin-bottom: 0; }

  /* Each index announces its number before its name, so the series reads as
     a series rather than as unrelated sections. */
  .index-number {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: .8125rem;
    letter-spacing: .06em;
    color: var(--neutral-gray);
    margin: 0 0 .35rem;
  }

  .index-title {
    font-weight: 700;
    font-size: clamp(1.5rem, 4vw, 2.25rem);
    line-height: 1.05;
    letter-spacing: 0;
    margin: 0 0 calc(var(--pad) * 1.5);
  }

  /* ─── INDEX LIST ─────────────────────────────────────────────────────
     Generated from the index sections present on the page, so adding an
     index means adding a section — not remembering to edit a list. */
  .index-list {
    list-style: none;
    padding: 0;
    /* No top margin: it sits beside the text now, not beneath it. The
       first rule should line up with the first line of the intro. */
    margin: 0;
  }

  .index-list li { border-top: var(--rule-w) solid var(--rule); }
  .index-list li:last-child { border-bottom: var(--rule-w) solid var(--rule); }

  .index-list a {
    display: flex;
    align-items: baseline;
    gap: 1rem;
    padding: .85rem 0;
    text-decoration: none;
    color: inherit;
    font-weight: 500;
    transition: color .15s ease, padding-left .15s ease;
  }
  .index-list a:hover, .index-list a:focus-visible {
    color: var(--accent);
    padding-left: .4rem;
  }

  .index-list .num {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: .8125rem;
    font-weight: 400;
    color: var(--neutral-gray);
    flex: 0 0 auto;
  }
  .index-list a:hover .num, .index-list a:focus-visible .num { color: var(--accent); }

  .index-list .count {
    margin-left: auto;
    font-size: .8125rem;
    font-weight: 400;
    color: var(--neutral-gray);
  }

  .index-lead {
    max-width: 44rem;
    line-height: 1.5;
    margin: 0 0 calc(var(--pad) * 2);
    color: var(--lawful-gray);
  }

  /* ─── PALETTE BAND ───────────────────────────────────────────────────
     Two levels. The top band is the twelve base colours, each sized by
     collection_share_pct — coarse enough to read at a glance. Clicking one
     opens a second band beneath it holding the named tones that make up
     that base, sized by their weight within it.

     The tones come from base_colors[].swatches rather than css_colors,
     because css_colors carries no base and so cannot be grouped. That means
     the drill-down shows as many tones as swatchesPerBase returns, not
     every tone in the bucket.

     Expect a largely neutral top band. Greys alone are about half the
     palette — shadow, highlight and reflection pixels are near-neutral
     whatever the object is made of, and grey collects through far more
     named tones than any other base. That is the honest picture and worth
     leaving visible rather than tuning away. */
  /* Marks come from .framed. */
  .palette { margin: 0; }

  /* Sub-labels within an index (the band, the tone list). The index's own
     name is .index-title above. */
  .palette h3, .palette h4 {
    font-family: 'Heins', 'Museum', Arial, sans-serif;
    font-weight: 400;
    font-size: .8125rem;
    letter-spacing: .08em;
    text-transform: uppercase;
    color: var(--lawful-gray);
    margin: 0 0 calc(var(--pad) * 1.5);
  }
  .palette h4 { margin-top: 0; }

  /* ─── NESTING A FRAMED BLOCK ─────────────────────────────────────────
     THE RULE, every time: a framed block inside another framed block must
     cancel its parent's horizontal padding with negative margins of the
     same size. Otherwise its edges sit inside the parent's, and its crosses
     land inside the parent's crosses instead of on the same vertical line.

     .palette has padding: ... calc(var(--pad) * 1.5), so these groups pull
     back by exactly that and pad by the same amount again. Net effect: the
     content stays where it was, the block's edges reach the section's edges,
     and every cross on the page shares one margin. */
  .band-group {
    margin-left:  calc(var(--pad) * -1.5);
    margin-right: calc(var(--pad) * -1.5);
    padding: calc(var(--pad) * 1.5);
  }
  .band-group + .band-group { margin-top: calc(var(--pad) * 2); }

  /* The short explanation under each band's heading. Heins, like the other
     annotating voices on the page. */
  .band-note {
    font-family: 'Heins', 'Museum', Arial, sans-serif;
    font-weight: 400;
    font-size: .9375rem;
    line-height: 1.4;
    color: var(--lawful-gray);
    max-width: 46rem;
    margin: 0 0 calc(var(--pad) * 1.5);
  }
  .band-note b { font-weight: 400; color: var(--ink); }

  /* Three notes of explanation stacked at full measure runs to most of a
     screen before the chart appears. Two columns halve that, and the notes
     are short enough that a narrow measure still reads. */
  .note-columns {
    columns: 2;
    column-gap: calc(var(--pad) * 2);
    column-fill: balance;
    margin: 0 0 calc(var(--pad) * 2);
  }
  .note-columns .band-note {
    max-width: none;
    margin: 0 0 1em;
    /* Keeps a note from breaking one line before the column edge. */
    break-inside: avoid-column;
  }
  .note-columns .band-note:last-child { margin-bottom: 0; }

  /* ─── SEARCH ─────────────────────────────────────────────────────────
     Narrows the palette to a subset of the collection. */
  .palette-search {
    display: flex;
    gap: .5rem;
    align-items: stretch;
    margin: 0 0 calc(var(--pad) * 1.5);
    max-width: 30rem;
  }

  .palette-search input {
    flex: 1 1 auto;
    min-width: 0;
    font: inherit;
    font-size: .9375rem;
    color: var(--ink);
    background: none;
    border: 0;
    border-bottom: var(--rule-w) solid var(--mark);
    padding: .4rem .2rem;
    border-radius: 0;
  }
  .palette-search input::placeholder { color: var(--neutral-gray); }
  .palette-search input:focus { outline: 0; border-bottom-width: 2px; }

  .palette-search button {
    flex: 0 0 auto;
    font: inherit;
    font-size: .8125rem;
    font-weight: 500;
    color: var(--ink);
    background: none;
    border: 0;
    border-bottom: var(--rule-w) solid var(--mark);
    padding: .4rem .5rem;
    cursor: pointer;
  }
  .palette-search button:hover,
  .palette-search button:focus-visible { color: var(--accent); }

  .scope-note {
    font-size: .8125rem;
    color: var(--lawful-gray);
    margin: 0 0 calc(var(--pad) * 1.5);
  }
  .scope-note[hidden] { display: none; }

  .band {
    display: flex;
    width: 100%;
    height: clamp(3rem, 7vw, 5rem);
    /* A hairline outline so white and near-white segments stay visible
       against Snow White — without it they vanish into the page. */
    outline: var(--rule-w) solid var(--rule);
  }

  .band > * {
    display: block;
    /* flex-grow carries the share; basis 0 so the growth factor alone
       decides the width. */
    flex: 0 0 auto;
    padding: 0;
    border: 0;
    cursor: pointer;
    transition: transform .15s ease;
    transform-origin: center bottom;
  }
  .band > *:hover, .band > *:focus-visible {
    transform: scaleY(1.12);
    outline: var(--rule-w) solid var(--mark);
    z-index: 1;
    position: relative;
  }
  .band > [aria-expanded="true"] {
    outline: 2px solid var(--mark);
    z-index: 1;
    position: relative;
  }

  /* The drill-down band. Hidden until a base colour is chosen; the tie line
     shows which segment it belongs to. */
  .band-detail {
    margin-top: calc(var(--pad) / 2);
    height: clamp(2rem, 4.5vw, 3rem);
  }
  .detail-wrap[hidden] { display: none; }

  .detail-label {
    font-size: .8125rem;
    color: var(--lawful-gray);
    margin: calc(var(--pad) / 2) 0 0;
  }

  /* Closing has to be visible. Clicking the open segment again also works,
     as does Escape, but neither is discoverable on its own. */
  .detail-head {
    display: flex;
    align-items: baseline;
    gap: 1rem;
    margin: calc(var(--pad) / 2) 0 0;
  }
  .detail-head .detail-label { margin: 0; }

  .clear-btn {
    margin-left: auto;
    flex: 0 0 auto;
    background: none;
    border: 0;
    padding: .15rem .4rem;
    font: inherit;
    font-size: .8125rem;
    font-weight: 500;
    color: var(--ink);
    cursor: pointer;
    border-bottom: var(--rule-w) solid var(--mark);
  }
  .clear-btn:hover, .clear-btn:focus-visible { color: var(--accent); }

  .legend {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(8rem, 1fr));
    gap: var(--pad) calc(var(--pad) / 2);
    margin: calc(var(--pad) * 1.5) 0 0;
    padding: 0;
    list-style: none;
  }

  .legend li { display: flex; align-items: baseline; gap: .5rem; }

  .legend .chip {
    flex: 0 0 auto;
    width: .75rem; height: .75rem;
    outline: var(--rule-w) solid var(--rule);
    transform: translateY(.05rem);
  }

  .legend .name { font-size: .9375rem; font-weight: 500; }

  .legend .share {
    font-size: .8125rem;
    color: var(--lawful-gray);
    font-variant-numeric: tabular-nums;
    margin-left: auto;
  }

  .legend a { text-decoration: none; color: inherit; display: contents; }
  .legend a:hover .name, .legend a:focus-visible .name { color: var(--accent); }

  .legend-note {
    grid-column: 1 / -1;
    font-size: .8125rem;
    color: var(--lawful-gray);
  }

  .visually-hidden {
    position: absolute; width: 1px; height: 1px;
    margin: -1px; padding: 0; overflow: hidden;
    clip: rect(0 0 0 0); white-space: nowrap; border: 0;
  }

  /* ─── EVERY NAMED TONE ───────────────────────────────────────────────
     The same palette at full resolution: several hundred css tones, each
     at its own measured hex and sized by collection_share_pct. No
     min-width on the segments — with this many tones a minimum would
     inflate the long tail and misstate the proportions, so tones below a
     fraction of a percent round to sub-pixel and effectively disappear.
     That is the truthful rendering of their share. */
  .band-fine { height: clamp(2.5rem, 5.5vw, 4rem); }

  /* ─── VIEW SWITCH ────────────────────────────────────────────────────
     The two readings of the palette are the same data at two resolutions,
     so they belong in one block with a switch rather than as two stacked
     sections with the object panel stranded between them. */
  .view-head {
    display: flex;
    align-items: baseline;
    flex-wrap: wrap;
    gap: .5rem 1.5rem;
    margin: 0 0 calc(var(--pad) * 1.5);
  }
  .view-head h3 { margin: 0; }

  .view-switch {
    display: flex;
    gap: 1rem;
    margin-left: auto;
  }

  .view-switch button {
    background: none;
    border: 0;
    padding: .2rem 0;
    font: inherit;
    font-size: .8125rem;
    font-weight: 500;
    color: var(--neutral-gray);
    cursor: pointer;
    /* Reserved from the start so the label does not shift when selected. */
    border-bottom: 2px solid transparent;
  }
  .view-switch button:hover { color: var(--ink); }
  .view-switch button[aria-selected="true"] {
    color: var(--ink);
    border-bottom-color: var(--mark);
  }

  .view-panel[hidden] { display: none; }

  /* ─── OBJECT PANEL ───────────────────────────────────────────────────
     Opens under the bands when a colour is chosen, showing the objects
     that colour dominates. A disclosure rather than a navigation: the
     link to the full filtered collection stays available inside it. */
  .objects-panel[hidden] { display: none; }

  /* The page scrolls to this panel when a colour is chosen. scroll-margin
     keeps its top cropmarks off the viewport edge on arrival — without it
     the marks sit flush against the top and read as clipped. */
  .objects-panel { scroll-margin-top: calc(var(--pad) * 2); }

  .objects-panel .panel-head {
    display: flex;
    align-items: baseline;
    flex-wrap: wrap;
    gap: .5rem 1rem;
    margin: 0 0 calc(var(--pad) * 1.5);
  }

  .objects-panel h4 {
    margin: 0;
    font-family: 'Heins', 'Museum', Arial, sans-serif;
    font-weight: 400;
    font-size: .8125rem;
    letter-spacing: .08em;
    text-transform: uppercase;
    color: var(--lawful-gray);
  }

  .panel-swatch {
    width: .85rem; height: .85rem;
    outline: var(--rule-w) solid var(--rule);
    transform: translateY(.1rem);
  }

  .object-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(11rem, 1fr));
    gap: var(--pad);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .object-grid li { margin: 0; }

  .object-grid a {
    display: block;
    text-decoration: none;
    color: inherit;
  }

  /* Fixed aspect box so a grid of portrait and landscape photographs still
     lines up. The image is contained, not cropped — a cropped object is a
     misrepresented object. */
  .object-grid .shot {
    position: relative;
    aspect-ratio: 1 / 1;
    background-color: #f4f4f4;
    outline: var(--rule-w) solid var(--rule);
    overflow: hidden;
  }
  .object-grid img {
    width: 100%; height: 100%;
    object-fit: contain;
    display: block;
  }

  /* The measured share, printed over the corner of the image. */
  .object-grid .pct {
    position: absolute;
    right: 0; bottom: 0;
    padding: .15rem .35rem;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: .6875rem;
    color: var(--snow-white);
    background-color: var(--reliable-black);
  }

  .object-grid .caption {
    display: block;
    margin-top: .4rem;
    font-size: .8125rem;
    line-height: 1.25;
  }
  .object-grid a:hover .caption,
  .object-grid a:focus-visible .caption { color: var(--accent); }

  /* The object's own palette, under its thumbnail: ten small squares on one
     row, ordered by share.

     NOTE: equal squares deliberately discard the proportion. The bands
     higher up the page encode share as width, and these do not — so a
     colour covering 60% of the object looks the same as one covering 3%.
     The share is in each square's tooltip instead. To make them
     proportional, give .swatches "display: flex" and set each square's
     flex-grow to its percentage. */
  .object-grid .swatches {
    display: flex;
    /* space-between rather than a fixed gap: the cubes keep a fixed size and
       the spacing absorbs the difference, so the row still spans the card
       width without the cubes stretching into rectangles. */
    justify-content: space-between;
    width: 100%;
    margin-top: .35rem;
  }

  .object-grid .swatches span {
    /* Fixed size, no growing — growing is what turned these into rectangles:
       flex-grow sets the width while max-height capped the height, so they
       could never stay square. */
    flex: 0 0 auto;
    width: .6rem;
    height: .6rem;
    outline: var(--rule-w) solid var(--rule);
    outline-offset: -1px;
  }

  .object-grid .credit {
    display: block;
    margin-top: .2rem;
    font-size: .6875rem;
    line-height: 1.3;
    color: var(--neutral-gray);
  }

  /* "More like this" — a second row inside the object panel, opened from a
     thumbnail. Same grid, so the two read as one family. */
  .similar-wrap[hidden] { display: none; }

  .similar-wrap {
    margin-top: calc(var(--pad) * 2);
    padding-top: calc(var(--pad) * 1.5);
    border-top: var(--rule-w) solid var(--rule);
  }

  .object-grid .sim {
    position: absolute;
    left: 0; bottom: 0;
    padding: .15rem .35rem;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: .6875rem;
    color: var(--reliable-black);
    background-color: var(--dimmed-yellow);
  }

  /* ─── RESEMBLANCE ────────────────────────────────────────────────────
     The seed object, shown apart from its neighbours so it is clear which
     one the thread is currently anchored to. */
  .seed {
    display: flex;
    align-items: flex-start;
    gap: var(--pad);
    margin: 0 0 calc(var(--pad) * 1.5);
    padding-bottom: calc(var(--pad) * 1.5);
    border-bottom: var(--rule-w) solid var(--rule);
  }

  .seed .shot {
    position: relative;
    flex: 0 0 auto;
    width: 9rem;
    aspect-ratio: 1 / 1;
    background-color: #f4f4f4;
    outline: 2px solid var(--mark);
    overflow: hidden;
  }
  .seed .shot img {
    width: 100%; height: 100%;
    object-fit: contain;
    display: block;
  }

  .seed-meta { min-width: 0; }
  .seed-meta .label {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: .75rem;
    letter-spacing: .06em;
    text-transform: uppercase;
    color: var(--neutral-gray);
    margin: 0 0 .3rem;
  }
  .seed-meta h4 {
    margin: 0 0 .4rem;
    font-size: 1.125rem;
    font-weight: 700;
    line-height: 1.15;
  }
  .seed-meta a { color: inherit; }

  .panel-more {
    margin: calc(var(--pad) * 1.5) 0 0;
    font-size: .8125rem;
  }
  .panel-more a { color: inherit; font-weight: 500; }

  /* ─── TIME CHART ─────────────────────────────────────────────────────
     An area for the weighted density, with the exactly-dated subset as a
     darker band on the same baseline. One shape, two readings: how much of
     the collection sits in each period, and how much of that is precisely
     dated rather than inferred from a span. */
  .chart { width: 100%; height: auto; display: block; }
  /* Production above the centre line, acquisition below. Mirrored rather
     than overlaid: the two series cross repeatedly, and stacked fills would
     muddy exactly where the relationship is most interesting. */
  .chart .area       { fill: var(--shy-gray); }
  .chart .area-exact { fill: var(--mark); }
  .chart .area-acq   { fill: var(--accent); fill-opacity: .55; }
  .chart .centre     { stroke: var(--mark); stroke-width: 1; }
  .chart .axis      { stroke: var(--mark); stroke-width: 1; }
  .chart .tick      { stroke: var(--rule); stroke-width: 1; }
  .chart .tick-label {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 10px;
    fill: var(--neutral-gray);
  }
  .chart .hit { fill: transparent; cursor: pointer; }
  .chart .hit:hover, .chart .hit:focus-visible { fill: rgba(147, 38, 143, .12); }

  .chart-legend {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem 1.5rem;
    margin: calc(var(--pad) / 2) 0 0;
    padding: 0;
    list-style: none;
    font-size: .8125rem;
    color: var(--lawful-gray);
  }
  .chart-legend li { display: flex; align-items: center; gap: .4rem; }
  .chart-legend .key {
    width: .75rem; height: .75rem;
    outline: var(--rule-w) solid var(--rule);
  }
  .chart-legend .key-area  { background: var(--shy-gray); }
  .chart-legend .key-exact { background: var(--mark); }
  .chart-legend .key-acq   { background: var(--accent); opacity: .55; }

  /* ─── LAG BARS ───────────────────────────────────────────────────────
     One bar per acquisition decade, split into age bands. Bar HEIGHT carries
     the object count: the 1930s and 1940s rest on 15 and 9 objects against
     the 1980s' 2,403, and equal-height bars would give nine objects the same
     authority as two thousand. */
  /* align-items: stretch, not flex-end — the columns must fill the row's
     height or their percentage-height children have nothing to resolve
     against. With flex-end each column sizes to its content, the stack's
     height: X% resolves to auto, and every bar collapses to a hairline. */
  .lag { display: flex; align-items: stretch; gap: 2px; width: 100%;
         height: clamp(7rem, 16vw, 11rem); }

  /* Definite height, so the stack's percentage resolves. The column is a
     bottom-aligned flex box: the stack grows up from the baseline and the
     uncertainty rule sits under it. */
  .lag-col { flex: 1 1 0; min-width: 0; height: 100%;
             display: flex; flex-direction: column; justify-content: flex-end; }

  /* flex-shrink: 0 on the stack, or a tall stack in a short row gets
     squashed back down by the flex algorithm and the heights lie again. */
  .lag-col .stack { flex: 0 0 auto; display: flex; flex-direction: column;
                    width: 100%;
                    outline: var(--rule-w) solid var(--rule); outline-offset: -1px; }
  .lag-col .stack span { display: block; width: 100%; flex: 0 0 auto; }

  .lag-contemporary { background-color: var(--reliable-black); }
  .lag-recent       { background-color: var(--lawful-gray); }
  .lag-historical   { background-color: var(--shy-gray); }
  .lag-distant      { background-color: var(--snow-white); }

  /* Objects whose production span is too wide to band confidently. Drawn as
     a rule under the bar rather than as a fifth colour, because uncertainty
     is not a category — it cuts across all four. */
  .lag-col .doubt { height: 3px; margin-top: 2px; background-color: var(--accent); }

  .lag-axis { display: flex; gap: 2px; width: 100%; margin-top: .3rem; }
  .lag-axis span {
    flex: 1 1 0; min-width: 0;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: .625rem;
    color: var(--neutral-gray);
    text-align: center;
  }

  /* ─── BACKGROUND REMOVAL EXAMPLE ─────────────────────────────────────
     Two columns: the photograph on the left, the two palettes derived from
     it on the right. The divider between them carries a vertical rule and a
     cross at each end, so the split is marked the way the page's other
     subdivisions are. */
  .background-info[hidden] { display: none; }

  /* The boundary marks use the same .marks overlay the hero uses —
     positioned <i> elements rather than background layers, so they are never
     clipped and never depend on layer order. --col-split is overridden here
     to match where .bg-example divides. */
  .background-info { position: relative; --col-split: 50%; }
  .background-info > *:not(.marks) { position: relative; z-index: 2; }

  .background-info h3 {
    font-weight: 700;
    font-size: clamp(1.25rem, 3vw, 1.75rem);
    line-height: 1.1;
    margin: 0 0 calc(var(--pad) / 2);
  }

  .bg-intro {
    max-width: 44rem;
    line-height: 1.5;
    color: var(--lawful-gray);
    margin: 0 0 calc(var(--pad) * 2);
  }

  /* The column widths and --split on the section have to agree, or the
     marks at the top and bottom of the split miss the divider. */
  .bg-example {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    gap: calc(var(--pad) * 1.5);
    align-items: start;
  }

  /* No rule: the two marks at the top and bottom of the section already
     state the division. This column only holds the gap open. */
  .bg-divider { width: 0; }

  .bg-example figure { margin: 0; }

  .bg-example img {
    display: block;
    width: 100%;
    height: auto;
    outline: var(--rule-w) solid var(--rule);
  }

  .bg-palettes { display: grid; gap: calc(var(--pad) * 1.5); }

  /* Captions in Heins — the annotating voice, distinct from the data. */
  .bg-example figcaption {
    font-family: 'Heins', 'Museum', Arial, sans-serif;
    font-weight: 400;
    font-size: .875rem;
    line-height: 1.35;
    color: var(--lawful-gray);
    margin-top: .6rem;
    max-width: 34rem;
  }
  .bg-example figcaption b { font-weight: 400; color: var(--ink); }

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
    font-family: 'Heins', 'Museum', Arial, sans-serif;
    font-weight: 400;
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

  @media (max-width: 720px) {
    .page { grid-template-columns: 1fr; }
    .logo-cell { display: none; }
    /* One cell now, so the middle pair of crosses has no boundary to mark. */
    .marks .tm, .marks .bm { display: none; }
    /* Too narrow for the marks to read as anything but clutter, and the
       padding they need costs width the text cannot spare. One rule covers
       every framed block. */
    .framed { background-image: none; padding: 2rem 1.5rem; }
    /* No marks to align, so the negative margins have nothing to cancel. */
    .band-group { margin-left: 0; margin-right: 0; padding: 0; }
    /* One column: two on a phone gives about four words a line, and the
       contents list drops below the text rather than beside it. */
    .indexes-body { grid-template-columns: 1fr; gap: 2rem; }
    .index-intro { columns: 1; }
    /* Two columns on a phone gives about four words a line. */
    .note-columns { columns: 1; }
    /* Several hundred segments in a phone-width bar is noise, not data, so
       the tone view is not offered at all — the switch hides with it. */
    .view-switch { display: none; }
    .object-grid { grid-template-columns: repeat(auto-fill, minmax(8rem, 1fr)); }
    /* Stack the example; the divider has no two columns left to split, and
       the split marks have no boundary to mark. */
    .bg-example { grid-template-columns: 1fr; }
    .bg-divider { display: none; }
    /* One column now, so the boundary marks have nothing to mark. */
    .background-info .marks { display: none; }
  }

  @media (prefers-reduced-motion: reduce) {
    nav a { transition: none; }
    .stats dd a { transition: none; }
    .band > * { transition: none; }
    .band > *:hover, .band > *:focus-visible { transform: none; }
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

<!-- h2, not h1: the page already has one in the hero, and a second would
     flatten the document outline for screen readers and search engines. -->
<section class="stats framed" aria-labelledby="stats-heading">
  <h2 id="stats-heading">The API in numbers</h2>
  <dl>
    <div class="pair">
      <dd><a data-stat="objects" data-pending href="/v2/id/objects?itemsPerPage=10">—</a></dd>
      <dt>Objects</dt>
    </div>
    <div class="pair">
      <dd><a data-stat="images" data-pending href="/v2/id/objects?itemsPerPage=10&amp;hasImages=true">—</a></dd>
      <dt>With images</dt>
    </div>
    <div class="pair">
      <dd><a data-stat="onDisplay" data-pending href="/v2/id/objects?itemsPerPage=10&amp;onDisplay=true">—</a></dd>
      <dt>On display</dt>
    </div>
    <div class="pair">
      <dd><a data-stat="agents" data-pending href="/v2/id/agents?itemsPerPage=10">—</a></dd>
      <dt>Designers &amp; makers</dt>
    </div>
    <div class="pair">
      <dd><a data-stat="exhibitions" data-pending href="/v2/id/exhibitions?itemsPerPage=10">—</a></dd>
      <dt>Exhibitions</dt>
    </div>
    <div class="pair">
      <dd><a data-stat="concepts" data-pending href="/v2/id/concepts?itemsPerPage=10">—</a></dd>
      <dt>Concepts</dt>
    </div>
  </dl>
</section>

<!-- DRAFT TEXT. Written to be replaced: the argument is curatorial, and
     the register should be the museum's rather than a developer's. -->
<section class="indexes framed" aria-labelledby="index-heading">
  <h2 id="index-heading">Indexes</h2>

  <div class="indexes-body">
  <div class="index-intro">
    <p>An index is not the collection. It is a way in — a list of handles
    that lets you reach for one thing among many without looking at
    everything first. Every index is a decision about what is worth finding,
    and that decision is made long before anyone searches.</p>

    <p>Museums have always indexed. The card catalogue, the register, the
    thesaurus: each one fixes a small set of properties — maker, material,
    date, type — and makes those properties findable at the cost of
    everything it leaves out. What a period chose to record tells you what
    that period thought a collection was for. The gaps are as legible as the
    entries.</p>

    <p>Those indexes were made by hand, so they had to be economical. A
    cataloguer could not record the colour of ten thousand objects, or how
    much of each object that colour covered, and no one asked them to. The
    limit was labour, and the categories grew around it.</p>

    <p>Machines lift that limit, and in doing so they make new kinds of
    index possible: properties nobody catalogued because cataloguing them
    was never practical. This is not a better index, and it does not replace
    the ones made by hand. It measures something different, with its own
    blind spots — a colour index describes photographs as much as it
    describes objects, and it knows nothing of what any of these things
    mean. What it offers is another way in, and a set of questions the
    existing categories were not shaped to ask.</p>

    <p>What follows are indexes of that second kind, built from the
    collection data and open for anyone to query, reuse or disagree
    with.</p>

    <p><b>One caveat throughout.</b> These indexes describe the objects
    published through this API — around ten thousand of the twenty-four
    thousand the museum holds. Which objects have been published, and in what
    order, is itself a decision made by people, and it shapes every figure
    below. This is a view of the catalogue, not of the collection.</p>
  </div>

  <!-- Populated from the .index sections on the page; empty and hidden if
       there are none, so it never renders as a promise with nothing behind
       it. -->
  <nav aria-label="Indexes">
    <ol class="index-list" id="index-list" hidden></ol>
  </nav>
  </div>
</section>

<!-- class="index" is what puts this in the generated list. The number is
     written by the script from document order, so inserting an index above
     this one renumbers everything without any hand editing. -->
<section class="palette framed index" id="index-colour"
         aria-labelledby="palette-heading">
  <p class="index-number"></p>
  <h2 class="index-title" id="palette-heading">Colour</h2>
  <p class="index-lead">Colours are extracted from the digital images: the
  <a href="#background-info" id="background-toggle" aria-expanded="false">background
  is removed</a>, the remaining pixels are clustered, and each cluster is
  matched to a named tone and a broad base colour. What you see below is how
  much of the collection's visible surface each colour accounts for.</p>

  <!-- onsubmit="return false" is a guard, not the handler: if the script
       block ever throws before its listener attaches, the form would
       otherwise navigate to ?q=... and the page would appear to reload and
       lose the search. -->
  <form class="palette-search" id="palette-search" role="search" onsubmit="return false">
    <label class="visually-hidden" for="palette-q">Narrow the palette to a search</label>
    <input type="search" id="palette-q" name="q"
           placeholder="Narrow the palette — a category, a designer, a title"
           autocomplete="off">
    <button type="submit">Apply</button>
    <button type="button" id="palette-reset" hidden>Whole collection</button>
  </form>

  <p class="scope-note" id="scope-note" hidden></p>

  <div class="band-group framed">
    <div class="view-head">
      <h3 id="palette-view-heading">The collection's palette</h3>
      <div class="view-switch" role="tablist" aria-labelledby="palette-view-heading">
        <button type="button" role="tab" id="tab-base"
                aria-selected="true" aria-controls="view-base"
                data-view="base">Twelve categories</button>
        <button type="button" role="tab" id="tab-tones"
                aria-selected="false" aria-controls="view-tones"
                data-view="tones">Every named tone</button>
      </div>
    </div>

    <div class="view-panel" id="view-base" role="tabpanel" aria-labelledby="tab-base">
      <p class="band-note"><b>Twelve broad categories.</b> Every colour the
      tagger finds is assigned to one of twelve base names — red, orange,
      brown, grey and so on — and the band shows how much of the collection's
      visible surface each accounts for. It is deliberately coarse: it answers
      "how much of this collection is blue" without pretending the answer is
      precise. Click a segment to see the tones it is made of, and the objects
      it dominates.</p>

      <div class="band" id="band"
           aria-label="Base colours of the collection, sized by their share of the extracted palette"></div>

      <div class="detail-wrap" id="detail-wrap" hidden>
        <div class="band band-detail" id="band-detail"></div>
        <div class="detail-head">
          <p class="detail-label" id="detail-label"></p>
          <button type="button" class="clear-btn" id="clear-btn">Show all colours</button>
        </div>
      </div>

      <ul class="legend" id="legend"></ul>
    </div>

    <div class="view-panel" id="view-tones" role="tabpanel"
         aria-labelledby="tab-tones" hidden>
      <p class="band-note"><b>The same measurements, ungrouped.</b> Each
      colour cluster is matched to the nearest name from an extended colour
      list — several hundred of them, from Davy's grey to Fuzzy Wuzzy — and
      kept separate rather than folded into a base. This is the finer
      reading: it distinguishes tones the twelve categories flatten together,
      at the cost of a long tail where most names sit on only a handful of
      objects. The twelve categories are these tones, grouped.</p>

      <div class="band band-fine" id="band-fine"
           aria-labelledby="tab-tones"></div>
      <p class="detail-label" id="fine-label"></p>
    </div>
  </div>

  <!-- Below both views, not between them: whichever band you are reading,
       the objects appear in the same place. -->
  <div class="band-group framed objects-panel" id="objects-panel" hidden
       aria-live="polite">
    <div class="panel-head">
      <span class="panel-swatch" id="panel-swatch" aria-hidden="true"></span>
      <h4 id="panel-heading">Objects</h4>
      <button type="button" class="clear-btn" id="panel-close"
              style="margin-left:auto">Close</button>
    </div>
    <p class="band-note" id="panel-note"></p>
    <ul class="object-grid" id="object-grid"></ul>
    <p class="panel-more" id="panel-more"></p>

    <div class="similar-wrap" id="similar-wrap" hidden>
      <p class="band-note" id="similar-note"></p>
      <ul class="object-grid" id="similar-grid"></ul>
    </div>
  </div>
</section>

<section class="palette framed index" id="index-time"
         aria-labelledby="time-heading">
  <p class="index-number"></p>
  <h2 class="index-title" id="time-heading">Time</h2>
  <p class="index-lead">Two different times run through a collection. There is
  when each object was made, and there is when the museum took it in. They are
  rarely the same, and the distance between them is collecting policy made
  visible.</p>

  <div class="band-group framed">
    <div class="view-head">
      <h3 id="time-view-heading">Two readings of time</h3>
      <div class="view-switch" role="tablist" aria-labelledby="time-view-heading">
        <button type="button" role="tab" id="tab-made"
                aria-selected="true" aria-controls="view-made"
                data-view="made">Made, and collected</button>
        <button type="button" role="tab" id="tab-lag"
                aria-selected="false" aria-controls="view-lag"
                data-view="lag">How old, when it arrived</button>
      </div>
    </div>

    <div class="view-panel" id="view-made" role="tabpanel" aria-labelledby="tab-made">
      <div class="note-columns">
        <p class="band-note"><b>Above the line: when the objects were made.</b>
        Nearly every published object carries a production date, but only a
        quarter carry an exact year — the rest are spans, some a century wide.
        Rather than pinning those to their first year, each object spreads a
        single unit of weight evenly across the years it might have been made
        in. An object dated 1937 puts its whole weight on one year; one dated
        1900/2000 puts a hundredth on each of a hundred. So height is share,
        not certainty, and vague dating shows as flatness rather than as a
        false spike. The darker band is the objects dated to a single year,
        which says as much about when record-keeping became precise as about
        the objects themselves.</p>

        <p class="band-note"><b>Below the line: when they entered the
        collection.</b> An acquisition date is a point, not a span — the
        museum took the object on one day — so this is a plain count with no
        weighting. It is deliberately spiky: collections grow in events, and a
        single bequest or purchase can bring in hundreds of objects on one
        date. Note that the line begins only in 1904, a year after the museum
        was founded, and that around a quarter of published objects carry no
        acquisition date at all.</p>

        <p class="band-note"><b>Reading the gap.</b> Where the upper shape
        runs ahead of the lower one, the museum was collecting objects made
        long before — the 1980s took in more objects than any other decade,
        most of them decades old already. After 2010 the relationship
        inverts. And both shapes thin sharply through the 1930s and 1940s:
        the collection neither acquired much then nor holds much made then.</p>
      </div>

      <div id="time-chart"></div>
      <ul class="chart-legend">
        <li><span class="key key-area"></span> Made — all dated objects, weighted by span</li>
        <li><span class="key key-exact"></span> Made — dated to an exact year</li>
        <li><span class="key key-acq"></span> Acquired — objects entering the collection</li>
      </ul>
      <p class="detail-label" id="time-label"></p>
    </div>

    <div class="view-panel" id="view-lag" role="tabpanel"
         aria-labelledby="tab-lag" hidden>
      <div class="note-columns">
        <p class="band-note"><b>Each bar is a decade of acquiring.</b> It is
        divided by how old the objects were when the museum took them in, and
        its height is the number of objects — so the decades that collected
        little are visibly slight, rather than given the same authority as the
        ones that collected thousands.</p>

        <p class="band-note"><b>The age is a range, not a number.</b> An
        object recorded as made between 1900 and 1950 and acquired in 1907 was
        somewhere between nought and seven years old — the 1950 was an
        open-ended note, and the purchase itself is evidence. Each object is
        banded on the midpoint of its possible range, which is an estimate.
        The purple rule under a bar is the share whose dating is too loose to
        band confidently, and it is widest exactly where the collection is
        largest.</p>

        <p class="band-note"><b>It changes direction more than once.</b> The
        museum opened buying antiques, turned to the design of its own moment
        within twenty years, swung back to the historical, and reached its
        most contemporary in the 1990s — when half of everything acquired had
        been made that same year. Since 2010 it has been turning again.</p>
      </div>

      <div class="lag" id="lag-chart"></div>
      <div class="lag-axis" id="lag-axis"></div>
      <ul class="chart-legend">
        <li><span class="key lag-contemporary"></span> 5 years old or less</li>
        <li><span class="key lag-recent"></span> 6–25</li>
        <li><span class="key lag-historical"></span> 26–100</li>
        <li><span class="key lag-distant"></span> Over a century</li>
        <li><span class="key key-acq"></span> Too loosely dated to band</li>
      </ul>
      <p class="detail-label" id="lag-label"></p>
    </div>
  </div>
</section>

<section class="palette framed index" id="index-resemblance"
         aria-labelledby="resemblance-heading">
  <p class="index-number"></p>
  <h2 class="index-title" id="resemblance-heading">Resemblance</h2>
  <p class="index-lead">The other two indexes sort the collection into
  categories. This one does not sort it at all. It measures how close any two
  photographs sit in a space built by a machine that has looked at several
  hundred million captioned images — and lets you walk from one object to its
  nearest neighbours, and on from there.</p>

  <div class="band-group framed">
    <div class="view-head">
      <h3>Following a thread</h3>
      <button type="button" class="clear-btn" id="reseed"
              style="margin-left:auto">Start somewhere else</button>
    </div>

    <div class="note-columns">
      <p class="band-note"><b>There is no overview here, and that is the
      point.</b> Colour and time can be summarised in a single band, because
      every object has a colour and a date. Resemblance is relational: it only
      exists between things. So there is no picture of the whole — only a
      starting object and what sits nearest to it, and then whatever sits
      nearest to that.</p>

      <p class="band-note"><b>What the machine is doing.</b> Each photograph
      is turned into a list of 768 numbers by CLIP, a model trained on images
      paired with the text found near them online. Images described in similar
      ways end up close together. Nothing here was catalogued: the model was
      never shown this collection, never told what a decorative tile is, and
      has no access to any record. It compares pictures.</p>

      <p class="band-note"><b>What it therefore cannot know.</b> It brings the
      internet's associations with it, including its blind spots and its
      clichés, and it will happily group objects for reasons that have nothing
      to do with design history — a shared backdrop, a similar crop, a
      photographic convention. It is not a judgement about the objects. It is
      a measurement of their pictures, and it is worth disagreeing with.</p>
    </div>

    <div class="seed" id="seed"></div>
    <p class="band-note" id="thread-note"></p>
    <ul class="object-grid" id="thread-grid"></ul>
  </div>
</section>

<section id="background-info" class="background-info framed" hidden
         aria-labelledby="bg-heading">
  <!-- Two marks on the column boundary, top and bottom. Same overlay the
       hero uses; --col-split on the section sets where they sit. -->
  <div class="marks" aria-hidden="true"><i class="tm"></i><i class="bm"></i></div>
  <h3 id="bg-heading">Removing the background</h3>
  <p class="bg-intro">A photograph is mostly not the object. Studio backdrops,
  shadow and floor can take up more of the frame than the thing being
  photographed, and a colour reading from the whole image describes the
  photography as much as the collection. The background is removed before the
  pixels are clustered.</p>

  <!-- CHECK THE CAPTIONS AGAINST THE IMAGES before this goes public. They
       describe the method rather than asserting particular proportions, but
       what these two palettes actually show should be verified. -->
  <div class="bg-example">
    <figure>
      <img src="/images/1975-0061-1-raw.png"
           alt="Object 1975-0061 as photographed, object and backdrop together.">
      <figcaption><b>1975-0061, as photographed.</b> The frame the colour
      tagger receives: the object, and everything around it.</figcaption>
    </figure>

    <div class="bg-divider" aria-hidden="true"></div>

    <div class="bg-palettes">
      <figure>
        <img src="/images/1975-0061-3-palette-with-bg.png"
             alt="Colour palette extracted from the whole photograph, backdrop included.">
        <figcaption><b>Read from the whole frame.</b> Each band is one colour
        cluster, its width the share of pixels it covers. Backdrop and shadow
        count as part of the object.</figcaption>
      </figure>

      <figure>
        <img src="/images/1975-0061-4-palette-without-bg.png"
             alt="Colour palette extracted after the background has been removed.">
        <figcaption><b>Read from the object alone.</b> The same clustering
        after the background is masked out. This is what the index is built
        from.</figcaption>
      </figure>
    </div>
  </div>
</section>

<script>
// ── Time chart ────────────────────────────────────────────────────────
// Two series mirrored about a centre line: production density above,
// acquisitions below.
//
// Mirrored rather than overlaid because the two cross repeatedly — the
// 1980s acquire far more than they produce, the 1990s the reverse — and
// stacked fills would muddy exactly where the relationship is most
// interesting.
//
// THE TWO SERIES SHARE A SCALE BUT NOT A UNIT. Production weight is a
// distributed measure summing to the number of dated objects; acquisition is
// a plain object count. One unit of weight is one object, which is what makes
// a shared axis defensible — but they answer different questions and the
// legend has to say so.
//
// SVG built here rather than shipped as markup, because the shape depends
// entirely on the data. Removes its own section if the endpoint fails.
(function () {
  var host = document.getElementById('time-chart');
  var label = document.getElementById('time-label');
  if (!host) return;

  var W = 1000, H = 340;
  var PAD = 8;              // breathing room top and bottom
  var AXIS_H = 22;          // room for the year labels on the centre line
  var NS = 'http://www.w3.org/2000/svg';

  function el(name, attrs) {
    var n = document.createElementNS(NS, name);
    Object.keys(attrs || {}).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    return n;
  }

  // A step outline rather than a smooth curve: the data is bucketed by
  // decade, and a spline would imply a continuity between decades that is
  // not measured.
  function stepPath(buckets, valueOf, x, yScale, baseY) {
    var d = 'M ' + x(0) + ' ' + baseY;
    buckets.forEach(function (b, i) {
      var y = yScale(valueOf(b));
      d += ' L ' + x(i) + ' ' + y + ' L ' + x(i + 1) + ' ' + y;
    });
    return d + ' L ' + x(buckets.length) + ' ' + baseY + ' Z';
  }

  // ── View switch ──────────────────────────────────────────────────────
  // Two readings of the same two columns: when objects were made and
  // acquired, or how old they were on arrival. Tabs rather than stacked
  // blocks, so the section stays one screen rather than three.
  function setTimeView(name) {
    ['made', 'lag'].forEach(function (v) {
      var p = document.getElementById('view-' + v);
      var t = document.getElementById('tab-' + v);
      if (p) p.hidden = (v !== name);
      if (t) t.setAttribute('aria-selected', String(v === name));
    });
  }

  ['made', 'lag'].forEach(function (v) {
    var t = document.getElementById('tab-' + v);
    if (t) t.addEventListener('click', function () { setTimeView(v); });
  });

  fetch('/v2/id/production?bucket=10&yearFrom=1600',
        { headers: { Accept: 'application/ld+json' } })
    .then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
    .then(function (d) {
      var buckets = d.buckets || [];
      if (!buckets.length) return Promise.reject('no buckets');

      var maxUp = 0, maxDown = 0;
      buckets.forEach(function (b) {
        if (b.weight > maxUp) maxUp = b.weight;
        if (b.acquired > maxDown) maxDown = b.acquired;
      });
      if (!maxUp && !maxDown) return Promise.reject('no data');

      // Both halves share one scale, so the areas stay comparable: an
      // acquisition of 800 objects reads the same height as 800 units of
      // production weight. Independent scales would make the two look
      // proportional to each other when they are not.
      var scale = Math.max(maxUp, maxDown) || 1;

      var half = (H - AXIS_H - PAD * 2) / 2;
      var centreY = PAD + half;
      var step = W / buckets.length;
      var x = function (i) { return i * step; };
      var up   = function (v) { return centreY - (v / scale) * half; };
      var down = function (v) { return centreY + (v / scale) * half; };

      var svg = el('svg', {
        'class': 'chart',
        viewBox: '0 0 ' + W + ' ' + H,
        preserveAspectRatio: 'none',
        role: 'img',
        'aria-label':
          'Two series from ' + buckets[0].year + ' to ' +
          (buckets[buckets.length - 1].year + d.bucket_size - 1) +
          '. Above the centre line, how much of the collection was being made ' +
          'in each decade. Below it, how many objects entered the collection.'
      });

      svg.appendChild(el('path', {
        'class': 'area',
        d: stepPath(buckets, function (b) { return b.weight; }, x, up, centreY)
      }));

      // Shares the baseline rather than stacking, so it reads as a subset of
      // the area above it and not an addition to it.
      svg.appendChild(el('path', {
        'class': 'area-exact',
        d: stepPath(buckets, function (b) { return b.exact_count; }, x, up, centreY)
      }));

      svg.appendChild(el('path', {
        'class': 'area-acq',
        d: stepPath(buckets, function (b) { return b.acquired; }, x, down, centreY)
      }));

      svg.appendChild(el('line', {
        'class': 'centre', x1: 0, y1: centreY, x2: W, y2: centreY
      }));

      buckets.forEach(function (b, i) {
        // Every fifth decade — every one would collide at this width.
        if (b.year % 50 === 0) {
          var t = el('text', {
            'class': 'tick-label', x: x(i) + 3, y: H - 6
          });
          t.textContent = b.year;
          svg.appendChild(t);
          svg.appendChild(el('line', {
            'class': 'tick', x1: x(i), y1: PAD, x2: x(i), y2: H - AXIS_H + 4
          }));
        }

        var a = el('a', { href: b.filter || '#' });
        var hit = el('rect', {
          'class': 'hit', x: x(i), y: PAD, width: step, height: H - AXIS_H - PAD
        });
        var title = el('title');
        title.textContent =
          b.year + '–' + (b.year + d.bucket_size - 1) + '  ·  made: ' +
          b.share_pct + '% of dated objects (' +
          b.exact_count.toLocaleString('en-GB') + ' dated exactly)  ·  acquired: ' +
          b.acquired.toLocaleString('en-GB') + ' objects';
        a.appendChild(hit);
        a.appendChild(title);
        svg.appendChild(a);
      });

      host.appendChild(svg);

      // ── Lag bars ──────────────────────────────────────────────────────
      // One bar per ACQUISITION decade — a different axis from the chart
      // above, which is keyed by production decade. The two are deliberately
      // separate blocks so they cannot be read against each other.
      (function () {
        var lagHost = document.getElementById('lag-chart');
        var lagAxis = document.getElementById('lag-axis');
        var lagLabel = document.getElementById('lag-label');
        var lagTab = document.getElementById('tab-lag');
        var lag = d.lag_by_acquisition_decade || [];

        // No data means the tab has nothing behind it — hide the tab rather
        // than letting someone switch to an empty panel. Happens when
        // migration 015 has not been applied.
        if (!lagHost || !lag.length) {
          if (lagTab) lagTab.hidden = true;
          return;
        }

        var maxObjects = 0;
        lag.forEach(function (b) { if (b.objects > maxObjects) maxObjects = b.objects; });
        if (!maxObjects) return;

        var BANDS = [
          { key: 'contemporary', cls: 'lag-contemporary', name: '5 years or less' },
          { key: 'recent',       cls: 'lag-recent',       name: '6 to 25 years' },
          { key: 'historical',   cls: 'lag-historical',   name: '26 to 100 years' },
          { key: 'distant',      cls: 'lag-distant',      name: 'over a century' }
        ];

        lag.forEach(function (b) {
          var col = document.createElement('div');
          col.className = 'lag-col';

          // Square root rather than linear: 2,403 against 9 is a ratio of
          // 267, and a linear scale would render every thin decade as a
          // hairline. sqrt keeps them visible while still ranking honestly.
          var heightPct = Math.sqrt(b.objects / maxObjects) * 100;

          var stack = document.createElement('div');
          stack.className = 'stack';
          stack.style.height = heightPct + '%';

          BANDS.forEach(function (band) {
            var n = b[band.key] || 0;
            if (!n) return;
            var seg = document.createElement('span');
            seg.className = band.cls;
            seg.style.height = (n / b.objects * 100) + '%';
            seg.title = b.year + 's — ' + n.toLocaleString('en-GB') +
                        ' objects ' + band.name + ' when acquired';
            stack.appendChild(seg);
          });

          col.appendChild(stack);

          // Uncertainty as a rule under the bar, not a fifth colour: it cuts
          // across all four bands rather than sitting beside them.
          if (b.uncertain_pct > 0) {
            var doubt = document.createElement('div');
            doubt.className = 'doubt';
            doubt.style.opacity = Math.min(b.uncertain_pct / 50, 1);
            doubt.title = b.uncertain_pct + '% of this decade is too loosely ' +
                          'dated to band confidently';
            col.appendChild(doubt);
          }

          col.title = b.year + 's: ' + b.objects.toLocaleString('en-GB') +
                      ' objects acquired, typically between ' +
                      Math.round(b.median_min_lag) + ' and ' +
                      Math.round(b.median_max_lag) + ' years old';

          lagHost.appendChild(col);

          if (lagAxis) {
            var t = document.createElement('span');
            // Every other label — thirteen decades collide at this width.
            t.textContent = (b.year % 20 === 0) ? String(b.year).slice(2) : '';
            lagAxis.appendChild(t);
          }
        });

        if (lagLabel) {
          var total = lag.reduce(function (sum, b) { return sum + b.objects; }, 0);
          lagLabel.textContent = total.toLocaleString('en-GB') +
            ' objects carry both a production and an acquisition date. ' +
            'Bar height is the number acquired that decade, on a square-root ' +
            'scale so the thin decades stay visible.';
        }

      })();

      if (label) {
        label.textContent =
          Math.round(d.total_weight).toLocaleString('en-GB') +
          ' objects with a production date, ' +
          (d.total_acquired || 0).toLocaleString('en-GB') +
          ' with an acquisition date, across ' + d.year_from + '–' + d.year_to +
          '. Click a decade to see its objects.';
      }
    })
    .catch(function () {
      var section = document.getElementById('index-time');
      if (section) section.remove();
    });
})();
</script>

<script>
// ── Resemblance ───────────────────────────────────────────────────────
// A thread rather than an overview: one seed object and its nearest
// neighbours in CLIP embedding space, where clicking a neighbour makes it
// the new seed.
//
// There is no summary view because similarity is relational — it exists
// between objects, not as a property of one. Any picture of "the whole"
// would be a projection, and a projection invents axes that mean nothing.
//
// Removes its own section if the endpoint fails, so the page never shows a
// heading over an empty frame.
(function () {
  var seedBox = document.getElementById('seed');
  var grid = document.getElementById('thread-grid');
  var note = document.getElementById('thread-note');
  var reseed = document.getElementById('reseed');
  if (!seedBox || !grid) return;

  // Curated starting points rather than a random object: a random pick lands
  // on an unphotographed or uninteresting record most of the time, and gives
  // a different page to every visitor — awkward if you want to show someone
  // what you found. Add more here as you find good ones.
  var SEEDS = [
    '1975-0061',   // decorated tile — neighbours are other sea-creature tiles
    '1999-0068',   // Philishave — neighbours are other moulded plastic goods
    '2016-0017'    // 3D-printed porcelain in a wooden case
  ];
  var seedIndex = 0;

  function card(o, onPick) {
    var img = o.image;
    var li = document.createElement('li');
    var a = document.createElement('a');
    a.href = o['@id'];

    var shot = document.createElement('div');
    shot.className = 'shot';
    if (img && img.thumbnail) {
      var im = document.createElement('img');
      im.src = img.thumbnail;
      im.loading = 'lazy';
      im.decoding = 'async';
      im.alt = o['rdfs:label'] || 'Untitled object';
      shot.appendChild(im);
    }
    if (typeof o.similarity === 'number') {
      var b = document.createElement('span');
      b.className = 'pct';
      b.textContent = Math.round(o.similarity * 100) + '';
      b.title = 'Similarity ' + o.similarity;
      shot.appendChild(b);
    }
    a.appendChild(shot);

    var cap = document.createElement('span');
    cap.className = 'caption';
    cap.textContent = o['rdfs:label'] || 'Untitled';
    a.appendChild(cap);

    // Plain click follows the thread; the href stays real so ctrl-click
    // still opens the object record.
    a.addEventListener('click', function (e) {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
      e.preventDefault();
      onPick(String(o['@id'] || '').split('/').pop());
    });

    li.appendChild(a);
    return li;
  }

  function renderSeed(pid, obj) {
    seedBox.innerHTML = '';

    var shot = document.createElement('div');
    shot.className = 'shot';
    var img = obj && obj.image;
    if (img && img.thumbnail) {
      var im = document.createElement('img');
      im.src = img.thumbnail;
      im.alt = (obj && obj['rdfs:label']) || pid;
      shot.appendChild(im);
    }

    var meta = document.createElement('div');
    meta.className = 'seed-meta';

    var lab = document.createElement('p');
    lab.className = 'label';
    lab.textContent = 'Starting from';

    var h = document.createElement('h4');
    var link = document.createElement('a');
    link.href = '/v2/id/object/' + encodeURIComponent(pid);
    link.textContent = (obj && obj['rdfs:label']) || pid;
    h.appendChild(link);

    var num = document.createElement('p');
    num.className = 'label';
    num.textContent = pid;

    meta.appendChild(lab);
    meta.appendChild(h);
    meta.appendChild(num);

    seedBox.appendChild(shot);
    seedBox.appendChild(meta);
  }

  function load(pid) {
    if (note) note.textContent = 'Finding neighbours …';
    grid.innerHTML = '';

    // The seed's own record and its neighbours in parallel: the similar
    // endpoint deliberately excludes the object asked about, so its title
    // and image have to come from the object endpoint.
    Promise.all([
      fetch('/v2/id/object/' + encodeURIComponent(pid),
            { headers: { Accept: 'application/ld+json' } })
        .then(function (r) { return r.ok ? r.json() : null; })
        .catch(function () { return null; }),
      fetch('/v2/id/object/' + encodeURIComponent(pid) + '/similar?limit=12',
            { headers: { Accept: 'application/ld+json' } })
        .then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
    ])
      .then(function (res) {
        renderSeed(pid, res[0]);

        var members = (res[1] && res[1]['hydra:member']) || [];
        if (!members.length) {
          if (note) {
            note.textContent = 'This object has no image embedding, so it has ' +
              'no neighbours to show. About three in ten published objects are ' +
              'in that position. Try another starting point.';
          }
          return;
        }

        members.forEach(function (m) { grid.appendChild(card(m, load)); });

        if (note) {
          note.innerHTML = '';
          var b = document.createElement('b');
          b.textContent = 'Its twelve nearest neighbours.';
          note.appendChild(b);
          note.appendChild(document.createTextNode(
            ' The figure on each is how close it sits, out of a hundred. ' +
            'Click any of them to make it the new starting point and keep ' +
            'going — the thread can run a long way.'
          ));
        }
      })
      .catch(function () {
        var section = document.getElementById('index-resemblance');
        if (section) section.remove();
      });
  }

  if (reseed) reseed.addEventListener('click', function () {
    seedIndex = (seedIndex + 1) % SEEDS.length;
    load(SEEDS[seedIndex]);
    var section = document.getElementById('index-resemblance');
    if (section) {
      section.scrollIntoView({
        behavior: (window.matchMedia &&
                   window.matchMedia('(prefers-reduced-motion: reduce)').matches)
                    ? 'auto' : 'smooth',
        block: 'start'
      });
    }
  });

  load(SEEDS[0]);
})();
</script>

<script>
// ── Index list ────────────────────────────────────────────────────────
// Builds the contents list from whatever <section class="index"> elements
// exist, in document order, and writes each one's number back into its own
// .index-number. Adding an index is therefore a matter of adding a section
// with class="index", an id, and an .index-title — nothing here or in the
// list markup needs touching, and inserting one in the middle renumbers the
// rest automatically.
//
// Optional per-section hooks:
//   data-index-label  overrides the title used in the list
//   data-index-note   a short right-aligned note (e.g. "12 base colours")
(function () {
  var list = document.getElementById('index-list');
  if (!list) return;

  var sections = document.querySelectorAll('section.index');
  if (!sections.length) return;   // stays hidden rather than empty

  Array.prototype.forEach.call(sections, function (section, i) {
    var num = String(i + 1).padStart(2, '0');

    // Write the number into the section itself, so the heading and the list
    // cannot disagree about which index this is.
    var numEl = section.querySelector('.index-number');
    if (numEl) numEl.textContent = 'Index ' + num;

    var titleEl = section.querySelector('.index-title');
    var label = section.getAttribute('data-index-label') ||
                (titleEl && titleEl.textContent.trim()) ||
                'Index ' + num;

    // Anchor to the section's own id; fall back to the heading's if the
    // section has none, and skip the link entirely rather than emit href="#".
    var target = section.id || (titleEl && titleEl.id);

    var li = document.createElement('li');
    var a = document.createElement(target ? 'a' : 'span');
    if (target) a.href = '#' + target;

    var n = document.createElement('span');
    n.className = 'num';
    n.textContent = num;

    var t = document.createElement('span');
    t.className = 'label';
    t.textContent = label;

    a.appendChild(n);
    a.appendChild(t);

    var note = section.getAttribute('data-index-note');
    if (note) {
      var c = document.createElement('span');
      c.className = 'count';
      c.textContent = note;
      a.appendChild(c);
    }

    li.appendChild(a);
    list.appendChild(li);
  });

  list.hidden = false;
})();
</script>

<script>
// Discloses the background-removal example. aria-expanded on the link keeps
// the state announced; hidden on the section keeps it out of the accessibility
// tree entirely while closed.
(function () {
  var toggle = document.getElementById('background-toggle');
  var info = document.getElementById('background-info');
  if (!toggle || !info) return;

  toggle.addEventListener('click', function (e) {
    e.preventDefault();
    info.hidden = !info.hidden;
    toggle.setAttribute('aria-expanded', String(!info.hidden));
    if (!info.hidden) {
      info.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
})();
</script>

<script>
// Live counts, read from hydra:totalItems. itemsPerPage=1 keeps each
// response to a single member — we only want the total, not the data.
// (The links themselves use itemsPerPage=10, which is what a human
// clicking through wants to see.)
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

// ── Palette band ──────────────────────────────────────────────────────
// Two levels, read from /v2/id/colors.
//
// Top band: the base colours, each sized by collection_share_pct. Clicking
// one opens a second band beneath holding the named tones that make up that
// base, sized by their weight within it, each linking to the collection
// filtered by that tone.
//
// The tones come from base_colors[].swatches, not css_colors: css_colors
// carries no base field, so it cannot be grouped. swatchesPerBase asks the
// endpoint for more than its default six so the detail band has something
// to show.
//
// Fails silently and completely: if the endpoint is down the whole section
// is removed rather than leaving a heading over an empty strip.
(function () {
  var band = document.getElementById('band');
  var detailWrap = document.getElementById('detail-wrap');
  var detail = document.getElementById('band-detail');
  var detailLabel = document.getElementById('detail-label');
  var legend = document.getElementById('legend');
  var clearBtn = document.getElementById('clear-btn');
  if (!band || !detail || !legend) return;

  // ── Configuration ────────────────────────────────────────────────────
  // DEFAULT_QUERY loads the palette already narrowed, instead of showing the
  // whole collection. Set it to '' for the whole collection.
  //
  // No single parameter can answer an open search box, because the three
  // that exist cover disjoint ground:
  //
  //   conceptSearch  the thesaurus — object categories, styles, techniques,
  //                  matched in NL/EN/FR and expanded to narrower concepts
  //   agent          designers and makers, by PID — agent names are NOT in
  //                  the objects search vector, so nothing else finds them
  //   q              titles, descriptions and object numbers
  //
  // "stoel" is a concept. "Mendini" is an agent. A word from a title is
  // neither. Picking one parameter means the other two kinds of search
  // silently return nothing, which is what happened when this was fixed to
  // conceptSearch for the art nouveau default.
  //
  // So each is tried in turn until one returns objects, and the note under
  // the box says which kind of match was found.
  var DEFAULT_QUERY = '';

  var open = null;    // the currently expanded base segment, if any
  var allBases = [];  // kept so the legend can be rebuilt on close
  var whole = null;   // last whole-collection payload, for reset and fallback

  // One row builder for both legend states, so a base and a tone are read
  // the same way.
  function legendRow(opts) {
    var li = document.createElement('li');
    var a = document.createElement('a');
    a.href = opts.href;

    var chip = document.createElement('span');
    chip.className = 'chip';
    chip.style.backgroundColor = opts.hex || '#c7c8ca';

    var name = document.createElement('span');
    name.className = 'name';
    name.textContent = opts.name;

    var share = document.createElement('span');
    share.className = 'share';
    share.textContent = opts.share;
    if (opts.shareTitle) share.title = opts.shareTitle;

    a.appendChild(chip); a.appendChild(name); a.appendChild(share);
    li.appendChild(a);
    return li;
  }

  function renderBaseLegend() {
    legend.innerHTML = '';
    allBases.forEach(function (c) {
      legend.appendChild(legendRow({
        href: c.filter || ('/v2/id/objects?color=' + encodeURIComponent(c.value)),
        hex: c.hex || (c.swatches && c.swatches[0] && c.swatches[0].hex),
        name: c.value,
        share: Number(c.collection_share_pct).toFixed(1) + '%',
        shareTitle: 'Share of the whole collection palette'
      }));
    });
  }

  // When a base is open the legend shows that base's segmentation instead.
  // Percentages are shares WITHIN the base, which is what the detail band's
  // widths represent — mixing in collection-wide shares here would make the
  // numbers disagree with the bar directly above them.
  function renderToneLegend(color) {
    var swatches = color.swatches || [];
    legend.innerHTML = '';

    if (!swatches.length) {
      var note = document.createElement('li');
      note.className = 'legend-note';
      note.textContent = 'No named tones recorded for ' + color.value + ' yet.';
      legend.appendChild(note);
      return;
    }

    var total = swatches.reduce(function (sum, sw) {
      return sum + Number(sw.weight || 0);
    }, 0) || 1;

    swatches.forEach(function (sw) {
      var within = Number(sw.weight || 0) / total * 100;
      legend.appendChild(legendRow({
        href: '/v2/id/objects?cssColor=' + encodeURIComponent(sw.label),
        hex: sw.hex,
        name: sw.label,
        share: within.toFixed(1) + '%',
        shareTitle: 'Share of ' + color.value + ' — ' +
                    Number(sw.object_count).toLocaleString('en-GB') + ' objects'
      }));
    });

    var head = document.createElement('li');
    head.className = 'legend-note';
    head.textContent = 'Percentages are shares within ' + color.value +
      ', which is ' + Number(color.collection_share_pct).toFixed(1) +
      '% of the whole palette.';
    legend.appendChild(head);
  }

  function clearDetail() {
    detail.innerHTML = '';
    detailWrap.hidden = true;
    closePanel();
    if (open) open.setAttribute('aria-expanded', 'false');
    open = null;
    renderBaseLegend();
  }

  if (clearBtn) clearBtn.addEventListener('click', function () {
    var wasOpen = open;
    clearDetail();
    if (wasOpen) wasOpen.focus();   // don't strand keyboard focus
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && open) {
      var wasOpen = open;
      clearDetail();
      wasOpen.focus();
    }
  });

  function showDetail(color, btn) {
    var swatches = color.swatches || [];

    // A base with no swatches is a real case: purple currently returns
    // none, because no purple tone clears the swatch floor. Say so rather
    // than opening an empty bar.
    if (!swatches.length) {
      detail.innerHTML = '';
      detailLabel.textContent =
        'No named tones recorded for ' + color.value + ' yet.';
      detailWrap.hidden = false;
      renderToneLegend(color);
      return;
    }

    var total = swatches.reduce(function (sum, sw) {
      return sum + Number(sw.weight || 0);
    }, 0) || 1;

    detail.innerHTML = '';
    swatches.forEach(function (sw) {
      var w = Number(sw.weight || 0);
      var a = document.createElement('a');
      // href kept real so middle-click and ctrl-click still open the
      // filtered collection; a plain click opens the panel instead.
      a.href = '/v2/id/objects?cssColor=' + encodeURIComponent(sw.label);
      a.addEventListener('click', function (e) {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        showObjects({ label: sw.label, hex: sw.hex,
                      param: 'cssColor', value: sw.label });
      });
      a.style.backgroundColor = sw.hex;
      a.style.flexGrow = String(w);
      a.style.flexBasis = '0';
      a.title = sw.label + ' ' + sw.hex + ' — ' +
                (w / total * 100).toFixed(1) + '% of ' + color.value + ', ' +
                Number(sw.object_count).toLocaleString('en-GB') + ' objects';
      a.setAttribute('aria-label', a.title);
      detail.appendChild(a);
    });

    detail.setAttribute('aria-label', 'Named tones within ' + color.value);
    detailLabel.textContent =
      swatches.length + ' named tones within ' + color.value +
      ' — click one to filter the collection by it.';
    detailWrap.hidden = false;
    renderToneLegend(color);
  }

  // ── View switch ──────────────────────────────────────────────────────
  // Two readings of the same data — twelve categories, or several hundred
  // named tones. A switch rather than two stacked blocks, so the object
  // panel below always appears in the same place whichever you are reading.
  function setView(name) {
    ['base', 'tones'].forEach(function (v) {
      var panel = document.getElementById('view-' + v);
      var tab = document.getElementById('tab-' + v);
      if (panel) panel.hidden = (v !== name);
      if (tab) tab.setAttribute('aria-selected', String(v === name));
    });
  }

  ['base', 'tones'].forEach(function (v) {
    var tab = document.getElementById('tab-' + v);
    if (tab) tab.addEventListener('click', function () { setView(v); });
  });

  // ── Object panel ─────────────────────────────────────────────────────
  // Shows the objects a chosen colour dominates, from /id/colors/dominant.
  // A disclosure rather than a navigation: the link through to the full
  // filtered collection stays inside the panel.
  //
  // ATTRIBUTION: the usage policy asks for the maker and the licence. This
  // endpoint returns the licence and a credit note but NOT the maker, so the
  // panel shows what it has and links each object to its own record, which
  // does carry the maker. Do not present these thumbnails as a complete
  // credit line.
  //
  // SCOPE CAVEAT: /id/colors/dominant takes no search filter, so while a
  // palette search is active these objects are drawn from the whole
  // collection, not from the search. The note says so rather than letting
  // the mismatch pass silently.
  var panel = document.getElementById('objects-panel');
  var panelSwatch = document.getElementById('panel-swatch');
  var panelHeading = document.getElementById('panel-heading');
  var panelNote = document.getElementById('panel-note');
  var objectGrid = document.getElementById('object-grid');
  var panelMore = document.getElementById('panel-more');
  var panelClose = document.getElementById('panel-close');
  var PANEL_LIMIT = 12;
  var SWATCHES_PER_OBJECT = 10;   // two rows of five
  var activeQuery = null;   // set by runSearch, read here for the caveat

  function closePanel() {
    if (!panel) return;
    panel.hidden = true;
    if (objectGrid) objectGrid.innerHTML = '';
  }

  if (panelClose) panelClose.addEventListener('click', closePanel);

  // One card builder for both grids, so an object looks the same whether it
  // arrived by colour or by similarity. The badge is the figure printed on the
  // image corner — a dominance share in one grid, a similarity in the other.
  function objectCard(o, badge, onSimilar) {
    var img = o.image;
    var li = document.createElement('li');
    var a = document.createElement('a');
    a.href = o['@id'];

    var shot = document.createElement('div');
    shot.className = 'shot';

    if (img && img.thumbnail) {
      var im = document.createElement('img');
      im.src = img.thumbnail;
      im.loading = 'lazy';
      im.decoding = 'async';
      im.alt = o['rdfs:label'] || 'Untitled object';
      shot.appendChild(im);
    }

    if (badge) {
      var b = document.createElement('span');
      b.className = badge.className;
      b.textContent = badge.text;
      b.title = badge.title || '';
      shot.appendChild(b);
    }

    a.appendChild(shot);

    var cap = document.createElement('span');
    cap.className = 'caption';
    cap.textContent = o['rdfs:label'] || 'Untitled';
    a.appendChild(cap);

    if (img && (img['crm:P3_has_note'] || img['crm:P104_is_subject_to'])) {
      var credit = document.createElement('span');
      credit.className = 'credit';
      var parts = [];
      if (img['crm:P3_has_note']) parts.push(img['crm:P3_has_note']);
      if (img['crm:P104_is_subject_to'] && img['crm:P104_is_subject_to']['@id']) {
        var rights = img['crm:P104_is_subject_to']['@id'];
        var sep = rights.indexOf('://');
        var shown = sep > -1 ? rights.slice(sep + 3) : rights;
        if (shown.slice(-1) === '/') shown = shown.slice(0, -1);
        parts.push(shown);
      }
      credit.textContent = parts.join(' · ');
      a.appendChild(credit);
    }

    // A plain click asks for this object's neighbours rather than navigating;
    // the href stays real so ctrl-click still opens the record.
    if (onSimilar) {
      a.addEventListener('click', function (e) {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        onSimilar(o);
      });
    }

    li.appendChild(a);
    return li;
  }

  // ── More like this ───────────────────────────────────────────────────
  // Nearest neighbours in CLIP embedding space. Not a category and not a
  // filter: nobody recorded these groupings, they fall out of the
  // photographs. About three in ten objects have no embedding, so an empty
  // result is a normal outcome and says so.
  var similarWrap = document.getElementById('similar-wrap');
  var similarGrid = document.getElementById('similar-grid');
  var similarNote = document.getElementById('similar-note');

  function showSimilar(o) {
    if (!similarWrap || !similarGrid) return;
    var pid = String(o['@id'] || '').split('/').pop();
    if (!pid) return;

    similarWrap.hidden = false;
    similarGrid.innerHTML = '';
    if (similarNote) {
      similarNote.textContent = 'Looking for objects like “' +
        (o['rdfs:label'] || pid) + '” …';
    }

    fetch('/v2/id/object/' + encodeURIComponent(pid) + '/similar?limit=12',
          { headers: { Accept: 'application/ld+json' } })
      .then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
      .then(function (d) {
        var members = d['hydra:member'] || [];
        if (!members.length) {
          if (similarNote) {
            similarNote.textContent =
              'No visual neighbours for “' + (o['rdfs:label'] || pid) +
              '”. About three in ten published objects have no image embedding.';
          }
          return;
        }

        members.forEach(function (m) {
          similarGrid.appendChild(objectCard(m, {
            className: 'sim',
            text: Math.round(m.similarity * 100) + '',
            title: 'Similarity ' + m.similarity
          }, showSimilar));
        });

        if (similarNote) {
          similarNote.innerHTML = '';
          var b = document.createElement('b');
          b.textContent = 'Objects like “' + (o['rdfs:label'] || pid) + '”.';
          similarNote.appendChild(b);
          similarNote.appendChild(document.createTextNode(
            ' Nearest neighbours in image-embedding space — grouped by what ' +
            'the photographs show, not by any catalogued category. The figure ' +
            'on each is how close it sits. Click one to follow the thread.'
          ));
        }

        similarWrap.scrollIntoView({
          behavior: (window.matchMedia &&
                     window.matchMedia('(prefers-reduced-motion: reduce)').matches)
                      ? 'auto' : 'smooth',
          block: 'nearest'
        });
      })
      .catch(function () {
        if (similarNote) {
          similarNote.textContent = 'Could not load similar objects.';
        }
      });
  }

  function showObjects(opts) {
    // opts: { label, hex, param ('color'|'cssColor'), value }
    if (!panel || !objectGrid) return;

    // Scroll only when the panel is not already in view. Re-clicking while
    // it is open and visible should swap the contents in place, not yank the
    // page — the jump is what tells you something appeared, and repeating it
    // when nothing moved is just motion.
    var wasHidden = panel.hidden;
    panel.hidden = false;

    var box = panel.getBoundingClientRect();
    var offscreen = box.top < 0 || box.top > window.innerHeight * 0.8;

    if (wasHidden || offscreen) {
      // Honour a reduced-motion preference: still go there, just without the
      // glide. matchMedia rather than CSS because scrollIntoView's behaviour
      // is set in script, not in a stylesheet.
      var calm = window.matchMedia &&
                 window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      panel.scrollIntoView({
        behavior: calm ? 'auto' : 'smooth',
        block: 'start'
      });
    }

    objectGrid.innerHTML = '';
    if (panelSwatch) panelSwatch.style.backgroundColor = opts.hex || '#c7c8ca';
    if (panelHeading) panelHeading.textContent = 'Most ' + opts.label + ' objects';
    if (panelNote) panelNote.textContent = 'Loading…';
    if (panelMore) panelMore.textContent = '';

    var q = '/v2/id/colors/dominant?' + opts.param + '=' +
            encodeURIComponent(opts.value) + '&limit=' + PANEL_LIMIT;

    fetch(q, { headers: { Accept: 'application/ld+json' } })
      .then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
      .then(function (d) {
        var members = d['hydra:member'] || [];
        if (!members.length) {
          if (panelNote) {
            panelNote.textContent =
              'No objects with validated images are dominated by ' + opts.label + '.';
          }
          return;
        }

        members.forEach(function (o) {
          objectGrid.appendChild(objectCard(o, {
            className: 'pct',
            text: Math.round(o.dominance_pct) + '%',
            title: opts.label + ' covers ' + o.dominance_pct + '% of this image'
          }, showSimilar));
        });

        // A new colour means the similar row below is about a different
        // object — close it rather than leaving a stale set.
        if (similarWrap) similarWrap.hidden = true;

        if (panelNote) {
          panelNote.textContent =
            'The ' + members.length + ' objects where ' + opts.label +
            ' covers the largest share of the image. The figure on each is that share. ' +
            (activeQuery
              ? 'Note that these are drawn from the whole collection — this ranking takes no account of the current search.'
              : '');
        }

        if (panelMore) {
          panelMore.innerHTML = '';
          var more = document.createElement('a');
          more.href = '/v2/id/objects?' + opts.param + '=' +
                      encodeURIComponent(opts.value) + '&hasImages=true';
          more.textContent = 'See every object containing ' + opts.label + ' →';
          panelMore.appendChild(more);
        }
      })
      .catch(function () {
        if (panelNote) {
          panelNote.textContent = 'Could not load objects for ' + opts.label + '.';
        }
      });
  }

  // ── Rendering ────────────────────────────────────────────────────────
  // Both data sources produce the same shape, so one renderer serves both:
  //   bases: [{ value, hex, collection_share_pct, object_count, swatches[] }]
  //   tones: [{ value, hex, collection_share_pct, object_count, filter }]
  function render(bases, tones) {
    band.innerHTML = '';
    clearDetail();

    bases = bases.filter(function (c) { return Number(c.collection_share_pct) > 0; });
    bases.sort(function (a, b) {
      return Number(b.collection_share_pct) - Number(a.collection_share_pct);
    });

    bases.forEach(function (c) {
      var pct = Number(c.collection_share_pct);
      var btn = document.createElement('button');
      btn.type = 'button';
      // A base with no computable hex still gets a segment — it has objects
      // and a filter link. Fall back to its heaviest swatch, then a neutral.
      btn.style.backgroundColor =
        c.hex || (c.swatches && c.swatches[0] && c.swatches[0].hex) || '#c7c8ca';
      btn.style.flexGrow = String(pct);
      btn.style.flexBasis = '0';
      btn.setAttribute('aria-expanded', 'false');
      btn.setAttribute('aria-controls', 'band-detail');
      btn.title = c.value + ' — ' + pct.toFixed(1) + '% of the palette, ' +
                  Number(c.object_count).toLocaleString('en-GB') + ' objects';
      btn.setAttribute('aria-label', btn.title + '. Show its named tones.');
      btn.addEventListener('click', function () {
        if (open === btn) { clearDetail(); closePanel(); return; }
        if (open) open.setAttribute('aria-expanded', 'false');
        open = btn;
        btn.setAttribute('aria-expanded', 'true');
        showDetail(c, btn);
        showObjects({
          label: c.value,
          hex: c.hex || (c.swatches && c.swatches[0] && c.swatches[0].hex),
          param: 'color',
          value: c.value
        });
      });
      band.appendChild(btn);
    });

    var fine = document.getElementById('band-fine');
    var fineLabel = document.getElementById('fine-label');
    if (fine) {
      fine.innerHTML = '';
      tones = (tones || []).filter(function (c) {
        return c.hex && Number(c.collection_share_pct) > 0;
      });
      tones.sort(function (a, b) {
        return Number(b.collection_share_pct) - Number(a.collection_share_pct);
      });

      // With no tones to draw, the view has nothing to offer — hide its tab
      // rather than letting someone switch to an empty band.
      var show = tones.length > 0;
      var tonesTab = document.getElementById('tab-tones');
      if (tonesTab) tonesTab.hidden = !show;
      if (!show) setView('base');

      tones.forEach(function (c) {
        var pct = Number(c.collection_share_pct);
        var a = document.createElement('a');
        a.href = c.filter ||
          ('/v2/id/objects?cssColor=' + encodeURIComponent(c.value));
        a.style.backgroundColor = c.hex;
        a.style.flexGrow = String(pct);
        a.style.flexBasis = '0';
        a.title = c.value + ' ' + c.hex + ' — ' + pct.toFixed(2) +
                  '% of the palette, ' +
                  Number(c.object_count).toLocaleString('en-GB') + ' objects';
        a.setAttribute('aria-label', a.title);
        a.addEventListener('click', function (e) {
          if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
          e.preventDefault();
          showObjects({ label: c.value, hex: c.hex,
                        param: 'cssColor', value: c.value });
        });
        fine.appendChild(a);
      });

      if (fineLabel && show) {
        fineLabel.textContent = tones.length.toLocaleString('en-GB') +
          ' named tones, each sized by its share of the palette. ' +
          'The narrowest are a hundredth of a percent and round to nothing.';
      }
    }

    allBases = bases;
    renderBaseLegend();
  }

  // ── Whole collection ─────────────────────────────────────────────────
  // Precomputed by the API. swatchesPerBase asks for more than the default
  // six so the drill-down has something to open.
  var toneBase = {};   // css tone name -> base, learnt here and reused below

  fetch('/v2/id/colors?swatchesPerBase=40',
        { headers: { Accept: 'application/ld+json' } })
    .then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
    .then(function (d) {
      // toneBase must be learnt from the whole-collection call even when a
      // default query is set: /id/objects carries no base<->tone mapping, so
      // without this the drill-down would be dead.
      (d.base_colors || []).forEach(function (b) {
        (b.swatches || []).forEach(function (sw) { toneBase[sw.label] = b.value; });
      });
      if (!(d.base_colors || []).length) return Promise.reject('no colours');
      whole = d;

      if (DEFAULT_QUERY) {
        var box = document.getElementById('palette-q');
        if (box) box.value = DEFAULT_QUERY;
        return runSearch(DEFAULT_QUERY);
      }
      render(d.base_colors, d.css_colors || []);
    })
    .catch(function () {
      var section = document.querySelector('.palette');
      if (section) section.remove();
    });

  // ── Narrowed to a search ─────────────────────────────────────────────
  // /id/colors aggregates the whole collection and takes no filters, so a
  // search is aggregated here instead, from the colour data already present
  // in /id/objects?fullRecord=true&colors=true.
  //
  // Three consequences worth knowing:
  //
  //  • fullRecord payloads are heavy — the docs advise itemsPerPage <= 50.
  //    MAX_PAGES caps how much of a large result set is sampled, and the
  //    note under the search box says how much was actually read rather
  //    than implying the whole set.
  //
  //  • the base<->tone mapping is NOT in this response: the /colors/base
  //    feature aggregates by base and the /colors/hex feature lists tones,
  //    with nothing linking them. toneBase, learnt from /id/colors above,
  //    supplies it. A tone the whole-collection call never returned falls
  //    back to its own name as its base rather than being dropped.
  //
  //  • percentages here are already multiplied by 100, unlike the raw
  //    stored values.
  var scopeNote = document.getElementById('scope-note');
  var PER_PAGE = 50;
  var MAX_PAGES = 6;      // 300 objects — enough to be representative, light enough to load

  function noteText(t) {
    if (!scopeNote) return;
    scopeNote.textContent = t;
    scopeNote.hidden = !t;
  }

  function readColors(obj, acc) {
    var vis = obj['crm:P65_shows_visual_item'];
    if (!vis) return false;
    if (!Array.isArray(vis)) vis = [vis];
    var found = false;

    vis.forEach(function (v) {
      var feats = v['crm:P56_bears_feature'];
      if (!feats) return;
      if (!Array.isArray(feats)) feats = [feats];

      feats.forEach(function (f) {
        var isBase = String(f['@id'] || '').indexOf('/colors/base') !== -1;
        var notes = f['crm:P3_has_note'];
        if (!notes) return;
        if (!Array.isArray(notes)) notes = [notes];

        notes.forEach(function (n) {
          var dim = n['crm:P43_has_dimension'];
          var val = dim && dim['crm:P90_has_value'];
          var pct = val && Number(val['@value']);
          if (!pct) return;
          found = true;

          if (isBase) {
            var base = n['rdf:value'];
            if (!base) return;
            acc.bases[base] = acc.bases[base] || { weight: 0, objects: {} };
            acc.bases[base].weight += pct;
            acc.bases[base].objects[obj['@id']] = 1;
          } else {
            var css = n['rdfs:label'];
            var hex = n['rdf:value'];
            if (!css || !hex) return;
            acc.tones[css] = acc.tones[css] ||
              { hex: hex, weight: 0, objects: {}, base: toneBase[css] || null };
            acc.tones[css].weight += pct;
            acc.tones[css].objects[obj['@id']] = 1;
          }
        });
      });
    });
    return found;
  }

  function aggregate(acc) {
    var baseTotal = 0, toneTotal = 0;
    Object.keys(acc.bases).forEach(function (k) { baseTotal += acc.bases[k].weight; });
    Object.keys(acc.tones).forEach(function (k) { toneTotal += acc.tones[k].weight; });

    var tones = Object.keys(acc.tones).map(function (k) {
      var t = acc.tones[k];
      return {
        value: k,
        hex: t.hex,
        base: t.base,
        object_count: Object.keys(t.objects).length,
        collection_share_pct: toneTotal ? t.weight / toneTotal * 100 : 0,
        weight: t.weight
      };
    });

    var bases = Object.keys(acc.bases).map(function (k) {
      var b = acc.bases[k];
      // Swatches are the tones that map to this base, so the drill-down
      // works on a search the same way it does on the whole collection.
      var mine = tones.filter(function (t) { return t.base === k; })
                      .sort(function (x, y) { return y.weight - x.weight; })
                      .map(function (t) {
                        return { label: t.value, hex: t.hex,
                                 object_count: t.object_count, weight: t.weight };
                      });
      return {
        value: k,
        hex: mine.length ? mine[0].hex : null,
        swatches: mine,
        object_count: Object.keys(b.objects).length,
        collection_share_pct: baseTotal ? b.weight / baseTotal * 100 : 0,
        filter: '/v2/id/objects?color=' + encodeURIComponent(k)
      };
    });

    return { bases: bases, tones: tones };
  }

  // Harvest colour data for one parameter/value pair. Resolves with the
  // accumulated counts, or null when nothing matched.
  function collect(param, value) {
    var acc = { bases: {}, tones: {} };
    var total = null, read = 0, page = 1;

    function next() {
      var url = '/v2/id/objects?fullRecord=true&colors=true&hasColors=true' +
                '&itemsPerPage=' + PER_PAGE + '&page=' + page +
                '&' + param + '=' + encodeURIComponent(value);

      return fetch(url, { headers: { Accept: 'application/ld+json' } })
        .then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
        .then(function (d) {
          if (total === null) total = d['hydra:totalItems'] || 0;
          (d['hydra:member'] || []).forEach(function (o) {
            if (readColors(o, acc)) read++;
          });
          var more = d['hydra:view'] && d['hydra:view']['hydra:next'];
          if (more && page < MAX_PAGES) { page++; return next(); }
        });
    }

    return next()
      .then(function () { return read ? { acc: acc, read: read, total: total } : null; })
      .catch(function () { return null; });
  }

  // Agent names live in the agents index, not in the objects search vector,
  // so a designer has to be resolved to a PID before objects can be filtered
  // by them. Resolves to a PID, or null.
  function resolveAgent(q) {
    return fetch('/v2/id/agents?q=' + encodeURIComponent(q) + '&itemsPerPage=1',
                 { headers: { Accept: 'application/ld+json' } })
      .then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
      .then(function (d) {
        var first = (d['hydra:member'] || [])[0];
        if (!first || !first['@id']) return null;
        return {
          pid: first['@id'].split('/').pop(),
          label: first['rdfs:label'] || q
        };
      })
      .catch(function () { return null; });
  }

  function runSearch(q) {
    activeQuery = q;
    noteText('Reading colours for “' + q + '” …');

    // Concepts first: a category is the most likely reading of a bare word,
    // and it expands through the thesaurus hierarchy. Then agents, then free
    // text — each only reached when the one before it found nothing.
    return collect('conceptSearch', q)
      .then(function (hit) {
        if (hit) return { hit: hit, how: 'concept', label: q };
        return resolveAgent(q).then(function (agent) {
          if (!agent) return null;
          return collect('agent', agent.pid).then(function (h) {
            return h ? { hit: h, how: 'agent', label: agent.label } : null;
          });
        });
      })
      .then(function (found) {
        if (found) return found;
        return collect('q', q).then(function (h) {
          return h ? { hit: h, how: 'text', label: q } : null;
        });
      })
      .then(function (found) {
        if (!found) {
          noteText('Nothing with colour data matches “' + q + '”. ' +
                   'Tried the thesaurus, designer and maker names, and ' +
                   'titles and descriptions.');
          // Never leave the bands empty: restore the whole collection rather
          // than showing nothing at all.
          if (whole) render(whole.base_colors || [], whole.css_colors || []);
          return false;
        }

        var agg = aggregate(found.hit.acc);
        render(agg.bases, agg.tones);

        var read = found.hit.read, total = found.hit.total;
        var sampled = (total && read < total)
          ? read.toLocaleString('en-GB') + ' of ' + total.toLocaleString('en-GB') +
            ' objects sampled'
          : read.toLocaleString('en-GB') + ' objects';

        // Say which kind of match this was. "mendini" matching as a designer
        // and "stoel" matching as a category are different answers, and the
        // reader should not have to guess which they got.
        var how = found.how === 'agent'
          ? 'Palette of work by ' + found.label
          : found.how === 'concept'
            ? 'Palette of “' + q + '” as a category'
            : 'Palette of “' + q + '” in titles and descriptions';

        noteText(how + ' — ' + sampled + '.');
        var rb = document.getElementById('palette-reset');
        if (rb) rb.hidden = false;
        return true;
      })
      .catch(function () {
        noteText('Could not read colours for “' + q + '”.');
        if (whole) render(whole.base_colors || [], whole.css_colors || []);
        return false;
      });
  }

  function resetToCollection() {
    activeQuery = null;
    var box = document.getElementById('palette-q');
    var rb = document.getElementById('palette-reset');
    if (box) box.value = '';
    if (rb) rb.hidden = true;
    noteText('');
    // The whole-collection payload is already in hand from first load.
    if (whole) { render(whole.base_colors || [], whole.css_colors || []); return; }
    fetch('/v2/id/colors?swatchesPerBase=40',
          { headers: { Accept: 'application/ld+json' } })
      .then(function (r) { return r.json(); })
      .then(function (d) { whole = d; render(d.base_colors || [], d.css_colors || []); })
      .catch(function () { /* leave the current view in place */ });
  }

  // Delegated on document rather than bound to the elements. A direct
  // binding silently does nothing when the lookup returns null — and a form
  // with no submit handler navigates, which is indistinguishable from the
  // page reloading and throwing the search away.
  document.addEventListener('submit', function (e) {
    if (!e.target || e.target.id !== 'palette-search') return;
    e.preventDefault();
    var box = document.getElementById('palette-q');
    var q = ((box && box.value) || '').trim();
    if (q) runSearch(q);
  });

  document.addEventListener('click', function (e) {
    if (!e.target || e.target.id !== 'palette-reset') return;
    e.preventDefault();
    resetToCollection();
  });
})();
</script>
</body></html>`)
})

export default rootRouter