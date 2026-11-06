// public/js/paths.js — the path explorer component.
//
// Used in two places, with the same code:
//   • the landing page, as the second view of the Resemblance index
//   • /paths/, the shareable standalone page (syncUrl: true)
//
//   var paths = DMGPaths.mount(container, {
//     api: '/v2/',            // same origin
//     syncUrl: false,         // true on /paths/: read and write ?from=&to=&mode=&steps=
//     openHref: '/paths/',    // when set, offers "Open this path as its own page"
//     initial: { from: '0001_1-2', to: '1982-0064', fallbackRandom: true }
//   });
//   paths.setFrom('1975-0061'); paths.run(); paths.random(); paths.relayout();
//
// Styles in public/css/paths.css (dp- prefixed). Plain ES5 on purpose:
// no build step, and safe to read alongside the inline scripts in root.js.
(function () {
  var SVGNS = 'http://www.w3.org/2000/svg';
  var NEIGHBOURS_PER_NODE = 3;
  var uid = 0;

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  // Accepts a bare object number or a full object URI.
  function normalizeRef(v) {
    v = String(v || '').trim();
    var i = v.indexOf('/object/');
    if (i === -1) return v;
    return decodeURIComponent(v.slice(i + 8).split(/[/?#]/)[0]);
  }
  function refOf(m) { return normalizeRef(m['@id']); }

  function mount(container, opts) {
    opts = opts || {};
    var API = opts.api || '/v2/';
    var id = 'dp' + (++uid);

    container.innerHTML =
      '<form class="dp-controls">' +
        '<div class="dp-field"><label class="dp-label" for="' + id + '-from">From</label>' +
          '<input type="text" id="' + id + '-from" placeholder="0001_1-2" autocomplete="off" spellcheck="false"></div>' +
        '<div class="dp-field"><label class="dp-label" for="' + id + '-to">To</label>' +
          '<input type="text" id="' + id + '-to" placeholder="1982-0064" autocomplete="off" spellcheck="false"></div>' +
        '<div class="dp-field"><span class="dp-label" id="' + id + '-mode">Path</span>' +
          '<div class="dp-tabs" role="tablist" aria-labelledby="' + id + '-mode">' +
            '<button type="button" role="tab" data-mode="graph" aria-selected="true">Resemblances</button>' +
            '<button type="button" role="tab" data-mode="line" aria-selected="false">Straight line</button>' +
          '</div></div>' +
        '<div class="dp-field dp-steps" hidden><label class="dp-label" for="' + id + '-steps">In between: <output>5</output></label>' +
          '<input type="range" id="' + id + '-steps" min="1" max="20" value="5"></div>' +
        '<div class="dp-field dp-check"><input type="checkbox" id="' + id + '-br" checked>' +
          '<label for="' + id + '-br">Show nearby objects</label></div>' +
        '<div class="dp-actions"><button type="submit" class="dp-primary">Find path</button>' +
          '<button type="button" class="dp-random">Random pair</button></div>' +
      '</form>' +
      '<div class="dp-result" aria-live="polite">' +
        '<div class="dp-heading"></div>' +
        '<div class="dp-stage" hidden><svg aria-hidden="true"></svg><div class="dp-nodes"></div></div>' +
        '<p class="dp-legend" hidden></p>' +
        '<p class="dp-open" hidden><a href="#">Open this path as its own page →</a></p>' +
      '</div>';

    var q = function (sel) { return container.querySelector(sel); };
    var els = {
      form: q('.dp-controls'), from: q('#' + id + '-from'), to: q('#' + id + '-to'),
      steps: q('#' + id + '-steps'), stepsOut: q('.dp-steps output'), stepsField: q('.dp-steps'),
      branches: q('#' + id + '-br'), go: q('.dp-primary'), random: q('.dp-random'),
      heading: q('.dp-heading'), stage: q('.dp-stage'), svg: q('.dp-stage svg'),
      nodes: q('.dp-nodes'), legend: q('.dp-legend'), open: q('.dp-open'), openA: q('.dp-open a')
    };
    var tabs = container.querySelectorAll('.dp-tabs [data-mode]');
    var current = null;   // { data, neighbours }

    function mode() {
      var sel = container.querySelector('.dp-tabs [aria-selected="true"]');
      return sel ? sel.getAttribute('data-mode') : 'graph';
    }
    function setMode(m) {
      Array.prototype.forEach.call(tabs, function (t) {
        t.setAttribute('aria-selected', String(t.getAttribute('data-mode') === m));
      });
      els.stepsField.hidden = m !== 'line';
    }
    function params() {
      var p = new URLSearchParams({ from: normalizeRef(els.from.value), to: normalizeRef(els.to.value), mode: mode() });
      if (mode() === 'line') p.set('steps', els.steps.value);
      return p;
    }
    function writeUrl() {
      if (!opts.syncUrl) return;
      try { history.replaceState(null, '', location.pathname + '?' + params()); } catch (e) {}
    }
    function readUrl() {
      var p = new URLSearchParams(location.search);
      if (p.get('from')) els.from.value = p.get('from');
      if (p.get('to')) els.to.value = p.get('to');
      if (p.get('steps')) els.steps.value = p.get('steps');
      setMode(p.get('mode') === 'line' ? 'line' : 'graph');
      els.stepsOut.textContent = els.steps.value;
      return !!(p.get('from') && p.get('to'));
    }

    function setBusy(b) {
      els.go.disabled = els.random.disabled = b;
      els.go.textContent = b ? 'Finding path …' : 'Find path';
    }
    function showMessage(title, text, action) {
      current = null;
      els.stage.hidden = true; els.legend.hidden = true; els.open.hidden = true;
      els.heading.innerHTML = '<h3>' + esc(title) + '</h3><p class="dp-note dp-error">' + esc(text) + '</p>';
      if (action) {
        var b = document.createElement('button');
        b.type = 'button'; b.textContent = action.label;
        b.addEventListener('click', action.run);
        els.heading.querySelector('.dp-note').appendChild(b);
      }
    }

    // ── images ──────────────────────────────────────────────────────
    function shotHtml(member, badge) {
      var img = member.image, srcs = [];
      if (img && img.thumbnail) srcs.push(img.thumbnail);
      if (img && img['@id']) srcs.push(img['@id']);
      var inner = srcs.length
        ? '<img alt="" src="' + esc(srcs[0]) + '" data-fallbacks="' + esc(JSON.stringify(srcs.slice(1))) + '">'
        : '<span class="dp-noimg">no image</span>';
      return '<div class="dp-shot">' + inner + (badge || '') + '</div>';
    }
    function wireFallbacks(root) {
      root.querySelectorAll('img[data-fallbacks]').forEach(function (img) {
        img.addEventListener('error', function () {
          var rest = JSON.parse(img.dataset.fallbacks || '[]');
          if (rest.length) { img.dataset.fallbacks = JSON.stringify(rest.slice(1)); img.src = rest[0]; }
          else { var s = document.createElement('span'); s.className = 'dp-noimg'; s.textContent = 'no image'; img.replaceWith(s); }
        });
      });
    }

    // ── layout: path nodes placed exactly, branches relaxed around them ─
    function layout(data, neighbours, W, H) {
      var members = data['hydra:member'].slice().sort(function (a, b) { return a.position - b.position; });
      var isLine = data.mode === 'line', n = members.length, capH = 46;
      var size = clamp(Math.min((W / n) * 0.72, (H - capH) * 0.3), 34, 150);
      var showCaptions = size >= 84;
      var margin = size / 2 + 4, xs;

      if (isLine) {
        xs = members.map(function (m) { return margin + (m.t || 0) * (W - 2 * margin); });
      } else {
        // horizontal gaps proportional to dissimilarity, never touching
        var d = members.slice(1).map(function (m) { return Math.max(0.005, 1 - (m.similarity == null ? 0.9 : m.similarity)); });
        var minGap = size * 1.08, extra = (W - 2 * margin) - (n - 1) * minGap;
        if (extra < 0) {
          size = clamp((W - 8) / (n * 1.1), 24, size); margin = size / 2 + 4;
          minGap = size * 1.08; extra = Math.max(0, (W - 2 * margin) - (n - 1) * minGap);
        }
        var total = d.reduce(function (a, b) { return a + b; }, 0);
        xs = [margin];
        d.forEach(function (di) { xs.push(xs[xs.length - 1] + minGap + extra * (di / total)); });
      }

      var axisY = isLine ? Math.max(size / 2 + 8, H * 0.2) : H * 0.46;
      var maxDrop = H - axisY - size / 2 - (showCaptions ? capH : 8);
      var ys = members.map(function (m, i) {
        if (!isLine || i === 0 || i === n - 1 || m.similarity == null) return axisY;
        return axisY + clamp((1 - m.similarity) * 4, 0, 1) * maxDrop;
      });

      var nodes = members.map(function (m, i) {
        return { ref: refOf(m), member: m, x: xs[i], y: ys[i], size: size, fixed: true,
                 kind: (i === 0 || i === n - 1) ? 'end' : 'path', index: i };
      });
      var byRef = {}; nodes.forEach(function (nd) { byRef[nd.ref] = nd; });
      var edges = [];
      for (var i = 1; i < n; i++) edges.push({ a: nodes[i - 1], b: nodes[i], kind: 'path' });

      if (neighbours) {
        var bsize = clamp(size * 0.42, 22, 64);
        var UP = -Math.PI / 2, DOWN = Math.PI / 2;
        var fanAbove = [UP - 0.6, UP + 0.6, DOWN, UP, DOWN - 0.6, DOWN + 0.6];
        var fanBelow = [DOWN - 0.6, DOWN + 0.6, UP, DOWN, UP - 0.6, UP + 0.6];
        nodes.filter(function (nd) { return nd.kind !== 'branch'; }).forEach(function (parent) {
          var list = (neighbours[parent.ref] || []).slice(0, NEIGHBOURS_PER_NODE), k = 0;
          list.forEach(function (nb) {
            var ref = refOf(nb), sim = nb.similarity == null ? 0.85 : nb.similarity;
            var existing = byRef[ref];
            if (existing) {
              var consecutive = existing.kind !== 'branch' && Math.abs(existing.index - parent.index) === 1;
              var dup = edges.some(function (e) { return (e.a === parent && e.b === existing) || (e.b === parent && e.a === existing); });
              if (!consecutive && !dup) {
                edges.push({ a: parent, b: existing, kind: existing.kind === 'branch' ? 'branch' : 'cross' });
                if (existing.kind === 'branch') existing.parents.push(parent);
              }
              return;
            }
            var fan = parent.index % 2 ? fanBelow : fanAbove;
            var ang = fan[k++ % fan.length];
            var dist = size * 0.62 + bsize * 0.6 + (1 - sim) * size * 2.2;
            var node = { ref: ref, member: nb, size: bsize, fixed: false, kind: 'branch', parents: [parent],
                         x: parent.x + Math.cos(ang) * dist, y: parent.y + Math.sin(ang) * dist, rest: dist };
            nodes.push(node); byRef[ref] = node;
            edges.push({ a: parent, b: node, kind: 'branch' });
          });
        });
        relax(nodes, W, H, showCaptions ? capH : 0);
      }
      return { nodes: nodes, edges: edges, size: size, showCaptions: showCaptions, isLine: isLine, axisY: axisY, xs: xs };
    }

    function relax(nodes, W, H, capH) {
      var movable = nodes.filter(function (n) { return !n.fixed; }), obstacles = [];
      nodes.filter(function (n) { return n.fixed; }).forEach(function (n) {
        obstacles.push({ x: n.x, y: n.y, r: n.size * 0.6 });
        if (capH) obstacles.push({ x: n.x, y: n.y + n.size / 2 + capH / 2, r: Math.max(capH * 0.75, 60) });
      });
      for (var it = 0; it < 240; it++) {
        movable.forEach(function (n) {
          var r = n.size * 0.62;
          n.parents.forEach(function (p) {
            var dx = n.x - p.x, dy = n.y - p.y, d = Math.hypot(dx, dy) || 1, f = (d - n.rest) / d * 0.08;
            n.x -= dx * f; n.y -= dy * f;
          });
          obstacles.forEach(function (o) {
            var dx = n.x - o.x, dy = n.y - o.y, d = Math.hypot(dx, dy) || 0.01, min = r + o.r + 4;
            if (d < min) { var k = (min - d) / d; n.x += dx * k; n.y += dy * k; }
          });
          movable.forEach(function (o) {
            if (o === n) return;
            var dx = n.x - o.x, dy = n.y - o.y, d = Math.hypot(dx, dy) || 0.01, min = r + o.size * 0.62 + 4;
            if (d < min) { var k = (min - d) / d * 0.5; n.x += dx * k; n.y += dy * k; }
          });
          n.x = clamp(n.x, n.size / 2 + 2, W - n.size / 2 - 2);
          n.y = clamp(n.y, n.size / 2 + 2, H - n.size / 2 - 2);
        });
      }
    }

    // ── render ──────────────────────────────────────────────────────
    function render() {
      if (!current) return;
      els.stage.hidden = false;
      var W = els.stage.clientWidth, H = els.stage.clientHeight;
      // Inside a hidden tab the stage has no size yet. The ResizeObserver
      // below calls render again the moment the tab is shown.
      if (!W || !H) return;

      var L = layout(current.data, els.branches.checked ? current.neighbours : null, W, H);
      var svg = els.svg;
      svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
      svg.innerHTML = '';
      function line(x1, y1, x2, y2, cls) {
        var l = document.createElementNS(SVGNS, 'line');
        l.setAttribute('x1', x1); l.setAttribute('y1', y1); l.setAttribute('x2', x2); l.setAttribute('y2', y2);
        l.setAttribute('class', cls); svg.appendChild(l);
      }
      if (L.isLine) {
        line(L.xs[0], L.axisY, L.xs[L.xs.length - 1], L.axisY, 'dp-axis');
        L.nodes.filter(function (n) { return n.kind === 'path'; }).forEach(function (n) {
          line(n.x, L.axisY, n.x, n.y - n.size / 2, 'dp-drop');
          var t = document.createElementNS(SVGNS, 'text');
          t.setAttribute('x', n.x + 4); t.setAttribute('y', L.axisY + 12);
          t.setAttribute('class', 'dp-t'); t.textContent = n.member.t;
          svg.appendChild(t);
        });
      }
      var order = { branch: 0, cross: 1, path: 2 };
      L.edges.slice().sort(function (a, b) { return order[a.kind] - order[b.kind]; }).forEach(function (e) {
        if (L.isLine && e.kind === 'path') return;
        line(e.a.x, e.a.y, e.b.x, e.b.y, 'dp-edge-' + e.kind);
      });

      els.nodes.innerHTML = L.nodes.slice()
        .sort(function (a, b) { return (b.kind === 'branch') - (a.kind === 'branch'); })
        .map(function (n) {
          var m = n.member, label = m['rdfs:label'] || n.ref, sim = m.similarity;
          var badge = (n.kind !== 'end' && sim != null && n.size >= 60)
            ? '<span class="dp-sim">' + Math.round(sim * 100) + '</span>' : '';
          var simTxt = (sim != null && n.kind !== 'end')
            ? (n.kind === 'branch' ? ', similarity ' : L.isLine ? ', similarity to its point on the line ' : ', similarity to the previous step ') + Math.round(sim * 100)
            : '';
          var caption = (n.kind !== 'branch' && L.showCaptions)
            ? '<figcaption><span class="dp-t-title">' + esc(label) + '</span><span class="dp-num">' + esc(n.ref) + '</span></figcaption>' : '';
          var title = label + ' — ' + n.ref + simTxt;
          return '<figure class="dp-node dp-' + n.kind + '" style="left:' + n.x + 'px;top:' + n.y + 'px;--s:' + n.size + 'px">' +
                 '<a href="' + esc(m['@id']) + '" title="' + esc(title) + '" aria-label="' + esc(title) + '">' +
                 shotHtml(m, badge) + caption + '</a></figure>';
        }).join('');
      wireFallbacks(els.nodes);

      els.legend.hidden = false;
      els.legend.textContent = (L.isLine
        ? 'The dashed line runs straight from the first object to the last; each object in between hangs below its point on it, lower the further it sits from that point.'
        : 'Left to right, the space between two objects grows as they look less alike.') +
        ' The figure on each image is its similarity, out of a hundred.' +
        (els.branches.checked && current.neighbours
          ? ' Small faded images are look-alikes the path did not take; a dashed line means two objects on the path also resemble each other directly.'
          : '');

      if (opts.openHref) {
        els.openA.href = opts.openHref + '?' + params();
        els.open.hidden = false;
      }
    }

    function renderHeading(data) {
      var members = data['hydra:member'].slice().sort(function (a, b) { return a.position - b.position; });
      var first = members[0], last = members[members.length - 1], between = members.length - 2;
      els.heading.innerHTML = '<h3>' + esc(first['rdfs:label']) + ' <span class="dp-via">to</span> ' + esc(last['rdfs:label']) + '</h3>' +
        '<p class="dp-note">' + (data.mode === 'line'
          ? between + ' object' + (between === 1 ? '' : 's') + ' nearest the straight line between them.'
          : between + ' step' + (between === 1 ? '' : 's') + ' of resemblance between them.') + '</p>';
    }

    // ── data ────────────────────────────────────────────────────────
    function getJSON(url) {
      return fetch(url, { headers: { Accept: 'application/ld+json' } });
    }
    function fetchNeighbours(refs) {
      var out = new Array(refs.length), i = 0;
      function worker() {
        if (i >= refs.length) return Promise.resolve();
        var k = i++;
        return getJSON(API + 'id/object/' + encodeURIComponent(refs[k]) + '/similar?limit=' + (NEIGHBOURS_PER_NODE + 2))
          .then(function (r) { return r.ok ? r.json() : null; })
          .then(function (b) { out[k] = (b && b['hydra:member']) || []; })
          .catch(function () { out[k] = []; })
          .then(worker);
      }
      var ws = []; for (var w = 0; w < Math.min(5, refs.length); w++) ws.push(worker());
      return Promise.all(ws).then(function () {
        var map = {}; refs.forEach(function (r, j) { map[r] = out[j]; }); return map;
      });
    }

    function run() {
      var from = normalizeRef(els.from.value), to = normalizeRef(els.to.value);
      if (!from || !to) { showMessage('Two objects needed', 'Enter an object number in both fields, or try a random pair.'); return Promise.resolve(false); }
      if (from === to) { showMessage('Pick two different objects', 'A path needs a start and an end that are not the same object.'); return Promise.resolve(false); }
      writeUrl(); setBusy(true);
      var p = params();

      return getJSON(API + 'id/path?' + p)
        .then(function (res) {
          return res.json().catch(function () { return {}; }).then(function (body) { return { res: res, body: body }; });
        })
        .then(function (r) {
          if (!r.res.ok) {
            var canTryLine = mode() === 'graph' && /mode=line/.test(r.body.hint || '');
            showMessage('No path found', r.body.error || ('The API answered with status ' + r.res.status + '.'),
              canTryLine ? { label: 'Try the straight line', run: function () { setMode('line'); run(); } } : null);
            return false;
          }
          renderHeading(r.body);
          current = { data: r.body, neighbours: null };
          els.stage.classList.remove('dp-reveal'); render();
          requestAnimationFrame(function () { els.stage.classList.add('dp-reveal'); });
          if (els.branches.checked) loadNeighbours();
          return true;
        })
        .catch(function () {
          showMessage('Could not reach the API', 'The path service did not respond. Try again in a moment.');
          return false;
        })
        .then(function (ok) { setBusy(false); return ok; });
    }

    function loadNeighbours() {
      var data = current && current.data;
      if (!data) return;
      fetchNeighbours(data['hydra:member'].map(refOf)).then(function (nb) {
        if (current && current.data === data) { current.neighbours = nb; render(); }
      });
    }

    var totalWithImages = null;
    function randomRef() {
      var url = function (page) { return API + 'id/objects?hasImages=true&itemsPerPage=1&page=' + page; };
      var ready = totalWithImages === null
        ? getJSON(url(1)).then(function (r) { return r.json(); }).then(function (d) { totalWithImages = d['hydra:totalItems'] || 1; })
        : Promise.resolve();
      return ready
        .then(function () { return getJSON(url(1 + Math.floor(Math.random() * totalWithImages))); })
        .then(function (r) { return r.json(); })
        .then(function (d) { return refOf(d['hydra:member'][0]); });
    }
    // Retries a few times: not every object with an image has an embedding yet.
    function randomPair(attempt) {
      attempt = attempt || 0;
      if (attempt >= 4) return;
      setBusy(true);
      Promise.all([randomRef(), randomRef()]).then(function (ab) {
        if (ab[0] === ab[1]) return randomPair(attempt + 1);
        els.from.value = ab[0]; els.to.value = ab[1];
        return run().then(function (ok) { if (!ok) return randomPair(attempt + 1); });
      }).catch(function () {
        setBusy(false);
        showMessage('Could not reach the API', 'The collection did not respond. Try again in a moment.');
      });
    }

    // ── events ──────────────────────────────────────────────────────
    els.form.addEventListener('submit', function (e) { e.preventDefault(); run(); });
    els.random.addEventListener('click', function () { randomPair(0); });
    Array.prototype.forEach.call(tabs, function (t) {
      t.addEventListener('click', function () { setMode(t.getAttribute('data-mode')); });
    });
    els.steps.addEventListener('input', function () { els.stepsOut.textContent = els.steps.value; });
    els.branches.addEventListener('change', function () {
      if (!current) return;
      if (els.branches.checked && !current.neighbours) loadNeighbours();
      render();
    });
    var resizeTimer;
    if (window.ResizeObserver) {
      new ResizeObserver(function () { clearTimeout(resizeTimer); resizeTimer = setTimeout(render, 120); }).observe(els.stage);
    }

    // Starting state. On /paths/ the URL wins; otherwise opts.initial sets a
    // curated pair so every visitor opens on the same path, and a random pair
    // stands in only if that one cannot be drawn (e.g. an object lost its
    // embedding). opts.initial: { from, to, mode, steps, fallbackRandom }
    if (opts.syncUrl && readUrl()) {
      run();
    } else if (opts.initial) {
      var ini = opts.initial;
      if (ini.from) els.from.value = ini.from;
      if (ini.to) els.to.value = ini.to;
      if (ini.steps) { els.steps.value = ini.steps; els.stepsOut.textContent = ini.steps; }
      setMode(ini.mode === 'line' ? 'line' : 'graph');
      if (ini.from && ini.to) {
        run().then(function (ok) { if (!ok && ini.fallbackRandom) randomPair(0); });
      } else if (ini.fallbackRandom) {
        randomPair(0);
      }
    }

    return {
      setFrom: function (pid) { els.from.value = pid || ''; },
      setTo: function (pid) { els.to.value = pid || ''; },
      getFrom: function () { return normalizeRef(els.from.value); },
      run: run,
      random: function () { randomPair(0); },
      relayout: render,
      focusTo: function () { els.to.focus(); }
    };
  }

  window.DMGPaths = { mount: mount };
})();
