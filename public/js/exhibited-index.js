// public/js/exhibited-index.js — the Exhibited index on the landing page.
//
//   DMGExhibited.mount(container, { api: '/v2/', pageSize: 25, onFail: fn })
//
// Left: objects ranked by how many exhibitions list them. Right: the chosen
// object's history as a row of circles, one per year in which it was on
// view (larger when it was in several exhibitions that year), above a row of
// small grey dots marking every year the museum registered exhibitions at
// all. Same axis for every object, so histories can be compared and the
// years an object was NOT shown stay visible.
//
// Data: /v2/id/exhibited (one call per page; the first also carries the
// museum-wide timeline). Styles: public/css/exhibited-index.css. Plain ES5.
(function () {
  var SVGNS = 'http://www.w3.org/2000/svg';
  var NOW = new Date().getFullYear();
  // The museum dates from 1903; anything earlier, or more than ten years
  // ahead, is a typo in the source and is treated as undated.
  var MIN_YEAR = 1900, MAX_YEAR = NOW + 10;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function pidOf(uri) { return String(uri || '').split('/').pop(); }
  function yearOf(d) { return d ? Number(String(d).slice(0, 4)) : null; }
  function plausible(d) {
    var y = yearOf(d);
    return y != null && !isNaN(y) && y >= MIN_YEAR && y <= MAX_YEAR;
  }
  function spanOf(x) {
    var s = x['crm:P4_has_time-span'] || {};
    var a = s['crm:P82a_begin_of_the_begin'], b = s['crm:P82b_end_of_the_end'];
    return { start: a && a['@value'], end: b && b['@value'] };
  }
  // Every calendar year an exhibition was open: a show from Nov 1997 to
  // Feb 1998 was on view in both years.
  function yearsOf(start, end) {
    var a = yearOf(start), b = plausible(end) ? yearOf(end) : a;
    if (b < a) b = a;
    var out = [];
    for (var y = a; y <= b; y++) out.push(y);
    return out;
  }

  function mount(container, opts) {
    opts = opts || {};
    var API = opts.api || '/v2/';
    var PAGE_SIZE = opts.pageSize || 25;

    container.innerHTML =
        '<div class="ex-wrap">' +
        '<div class="ex-list-col">' +
        '<ol class="ex-list" aria-label="Objects ranked by number of exhibitions"></ol>' +
        '<button type="button" class="ex-more" hidden>Show more</button>' +
        '</div>' +
        '<div class="ex-detail" aria-live="polite"></div>' +
        '</div>';

    var list = container.querySelector('.ex-list');
    var more = container.querySelector('.ex-more');
    var detail = container.querySelector('.ex-detail');

    var timeline = [];        // every dated exhibition the museum registered
    var museumYears = {};     // year -> number of exhibitions open that year
    var maxCount = 1;
    var page = 0, totalPages = 1;
    var selected = null;

    function imageOf(m) {
      var img = m.image;
      return img && (img.thumbnail || img['@id']);
    }

    // ── ranked list ───────────────────────────────────────────────
    function listItem(m) {
      var li = document.createElement('li');
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'ex-item';
      b.setAttribute('aria-pressed', 'false');
      var src = imageOf(m);
      b.innerHTML =
          '<span class="ex-rank">' + m.rank + '</span>' +
          '<span class="ex-thumb">' + (src ? '<img alt="" loading="lazy" src="' + esc(src) + '">' : '') + '</span>' +
          '<span class="ex-name"><span class="ex-t">' + esc(m['rdfs:label']) + '</span>' +
          // The number tells identical titles apart (two "Monnaie du Pape").
          '<span class="ex-pid">' + esc(pidOf(m['@id'])) + '</span>' +
          '<span class="ex-bar" style="width:' + (m.exhibitionCount / maxCount * 100) + '%"></span></span>' +
          '<span class="ex-count" aria-label="' + m.exhibitionCount + ' exhibitions">' + m.exhibitionCount + '</span>';
      b.title = m['rdfs:label'] + ' (' + pidOf(m['@id']) + ') — ' + m.exhibitionCount + ' exhibitions';
      b.addEventListener('click', function () {
        select(m, b);
        // Single column (phones): the timeline is below the list, so bring it
        // into view — otherwise a tap appears to do nothing.
        if (window.matchMedia && window.matchMedia('(max-width: 720px)').matches) {
          var calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
          detail.scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: 'start' });
        }
      });
      li.appendChild(b);
      return li;
    }

    function select(m, btn) {
      selected = m;
      Array.prototype.forEach.call(list.querySelectorAll('.ex-item'), function (x) {
        x.setAttribute('aria-pressed', String(x === btn));
      });
      renderDetail();
    }

    // ── detail ────────────────────────────────────────────────────
    function renderDetail() {
      var m = selected;
      if (!m) return;

      var shows = (m['crm:P12i_was_present_at'] || []).map(function (x) {
        var s = spanOf(x);
        var start = plausible(s.start) ? s.start : null;
        return { id: x['@id'], title: x['rdfs:label'], start: start, end: start ? s.end : null };
      });
      shows.sort(function (a, b) {               // date order, undated last
        if (!a.start) return 1;
        if (!b.start) return -1;
        return a.start < b.start ? -1 : a.start > b.start ? 1 : 0;
      });

      // year -> the exhibitions open that year
      var byYear = {};
      shows.forEach(function (s, i) {
        if (!s.start) return;
        yearsOf(s.start, s.end).forEach(function (y) {
          (byYear[y] = byYear[y] || []).push(i);
        });
      });
      var years = Object.keys(byYear).map(Number).sort(function (a, b) { return a - b; });
      var undated = shows.filter(function (s) { return !s.start; }).length;

      var sum = '<b>Shown in ' + m.exhibitionCount + ' exhibition' + (m.exhibitionCount === 1 ? '' : 's') + '</b>';
      if (years.length) {
        sum += ', on view in ' + years.length + ' different year' + (years.length === 1 ? '' : 's');
        sum += years.length === 1 ? ' (' + years[0] + ').' : ' between ' + years[0] + ' and ' + years[years.length - 1] + '.';
      } else {
        sum += '.';
      }
      if (undated) sum += ' ' + undated + ' of them carr' + (undated === 1 ? 'ies' : 'y') + ' no usable date and ' + (undated === 1 ? 'is' : 'are') + ' not on the line.';

      var src = imageOf(m);
      detail.innerHTML =
          '<div class="ex-head">' +
          '<div class="ex-shot">' + (src ? '<img alt="" src="' + esc(src) + '">' : '') + '</div>' +
          '<div><h3><a href="' + esc(m['@id']) + '">' + esc(m['rdfs:label']) + '</a></h3>' +
          '<p class="ex-num">' + esc(pidOf(m['@id'])) + ' · rank ' + m.rank + '</p>' +
          '<p class="ex-sum">' + sum + '</p></div>' +
          '</div>' +
          '<svg class="ex-chart" role="img"></svg>' +
          '<ul class="ex-shows">' + shows.map(function (s, i) {
            return '<li data-i="' + i + '"><span class="ex-year">' + (yearOf(s.start) || '—') + '</span>' +
                '<a href="' + esc(s.id) + '">' + esc(s.title) + '</a></li>';
          }).join('') + '</ul>';

      drawChart(detail.querySelector('.ex-chart'), shows, byYear, years, m['rdfs:label']);
    }

    // One fixed axis for every object: from the first year the museum
    // registered an exhibition (by decade) to now, or to the last announced
    // end date if that lies ahead.
    function domain() {
      var ys = Object.keys(museumYears).map(Number);
      var lo = ys.length ? Math.min.apply(null, ys) : 1950;
      var hi = ys.length ? Math.max(NOW, Math.max.apply(null, ys)) : NOW;
      return { lo: Math.floor(lo / 10) * 10, hi: hi + 1 };
    }

    function tickStep(span, width) {
      var steps = [5, 10, 20, 25, 50];
      for (var i = 0; i < steps.length; i++) {
        if (width / (span / steps[i]) >= 64) return steps[i];
      }
      return 50;
    }

    function highlight(indices) {
      Array.prototype.forEach.call(detail.querySelectorAll('.ex-shows li'), function (li) {
        li.classList.toggle('ex-hit', indices.indexOf(Number(li.getAttribute('data-i'))) !== -1);
      });
    }

    function drawChart(svg, shows, byYear, years, label) {
      var W = svg.getBoundingClientRect().width || svg.parentNode.clientWidth || 600;
      if (!W) return;
      var d = domain();
      var PADX = 12;
      var x = function (y) { return PADX + (y + 0.5 - d.lo) / (d.hi - d.lo) * (W - 2 * PADX); };
      var perYear = (W - 2 * PADX) / (d.hi - d.lo);

      // Rows top to bottom: museum dots, this object's circles, its year
      // labels (below, clear of the lane titles), then the axis.
      var MUSEUM_Y = 26, OBJECT_Y = 70, LABEL_Y = OBJECT_Y + 26, AXIS_Y = OBJECT_Y + 40, H = AXIS_Y + 18;
      // Circle size: one exhibition is the base; more in the same year is
      // larger. Capped so neighbouring years stay apart where there is room.
      var base = Math.max(4, Math.min(7, perYear * 0.42));
      var radius = function (n) { return Math.min(base + (n - 1) * 2, 12); };

      svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
      svg.setAttribute('height', H);
      svg.setAttribute('aria-label', label + ': on view in ' + years.length + ' years' +
          (years.length ? ' — ' + years.join(', ') : '') + '.');
      svg.innerHTML = '';
      function el(name, attrs, parent) {
        var n = document.createElementNS(SVGNS, name);
        for (var k in attrs) n.setAttribute(k, attrs[k]);
        (parent || svg).appendChild(n);
        return n;
      }

      // grid and axis on one adaptive step
      var step = tickStep(d.hi - d.lo, W);
      for (var y = Math.ceil(d.lo / step) * step; y < d.hi; y += step) {
        var gx = PADX + (y - d.lo) / (d.hi - d.lo) * (W - 2 * PADX);
        el('line', { 'class': 'ex-grid', x1: gx, y1: MUSEUM_Y - 10, x2: gx, y2: AXIS_Y });
        el('text', { 'class': 'ex-tick', x: gx + 3, y: H - 4 }).textContent = y;
      }
      el('line', { 'class': 'ex-base', x1: PADX, y1: AXIS_Y, x2: W - PADX, y2: AXIS_Y });

      // row 1: every year the museum registered exhibitions
      el('text', { 'class': 'ex-lane', x: PADX, y: MUSEUM_Y - 14 }).textContent = 'Museum';
      el('line', { 'class': 'ex-rowline', x1: PADX, y1: MUSEUM_Y, x2: W - PADX, y2: MUSEUM_Y });
      Object.keys(museumYears).forEach(function (k) {
        var yr = Number(k), n = museumYears[k];
        var c = el('circle', { 'class': 'ex-museum', cx: x(yr), cy: MUSEUM_Y,
          r: Math.min(1.5 + Math.sqrt(n) * 0.6, 4) });
        el('title', {}, c).textContent = yr + ' — ' + n + ' exhibition' + (n === 1 ? '' : 's') + ' registered';
      });

      // row 2: the years this object was on view
      el('text', { 'class': 'ex-lane', x: PADX, y: OBJECT_Y - 22 }).textContent = 'This object';
      el('line', { 'class': 'ex-rowline', x1: PADX, y1: OBJECT_Y, x2: W - PADX, y2: OBJECT_Y });

      // Year labels above the circles, skipping any that would collide.
      var lastLabelX = -Infinity;
      years.forEach(function (yr) {
        var idx = byYear[yr], n = idx.length, cx = x(yr), r = radius(n);
        var g = el('g', { 'class': 'ex-year-dot', tabindex: '0', role: 'button',
          'aria-label': yr + ': ' + idx.map(function (i) { return shows[i].title; }).join('; ') });
        el('circle', { 'class': 'ex-mine', cx: cx, cy: OBJECT_Y, r: r }, g);
        if (n > 1 && r >= 7) {
          el('text', { 'class': 'ex-n', x: cx, y: OBJECT_Y + 3.5 }, g).textContent = n;
        }
        el('title', {}, g).textContent = yr + ' — ' + idx.map(function (i) { return shows[i].title; }).join(' · ');
        var pick = function () { highlight(idx); };
        g.addEventListener('mouseenter', pick);
        g.addEventListener('focus', pick);
        g.addEventListener('click', pick);
        g.addEventListener('mouseleave', function () { highlight([]); });

        if (cx - lastLabelX >= 30) {
          el('text', { 'class': 'ex-ylabel', x: cx, y: LABEL_Y }).textContent = yr;
          lastLabelX = cx;
        }
      });
    }

    // ── data ──────────────────────────────────────────────────────
    function indexMuseum() {
      museumYears = {};
      timeline.forEach(function (t) {
        if (!plausible(t.start)) return;
        yearsOf(t.start, t.end).forEach(function (y) {
          museumYears[y] = (museumYears[y] || 0) + 1;
        });
      });
    }

    function load() {
      page++;
      more.disabled = true;
      var url = API + 'id/exhibited?itemsPerPage=' + PAGE_SIZE + '&page=' + page + (page === 1 ? '&timeline=true' : '');
      return fetch(url, { headers: { Accept: 'application/ld+json' } })
          .then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
          .then(function (d) {
            var batch = d['hydra:member'] || [];
            if (page === 1) {
              if (!batch.length) return Promise.reject('empty');
              timeline = d.exhibitionTimeline || [];
              indexMuseum();
              maxCount = batch[0].exhibitionCount || 1;
              var total = d['hydra:totalItems'] || batch.length;
              totalPages = Math.ceil(total / PAGE_SIZE);
            }
            batch.forEach(function (m) { list.appendChild(listItem(m)); });
            more.hidden = page >= totalPages;
            more.disabled = false;
            if (page === 1) select(batch[0], list.querySelector('.ex-item'));
          })
          .catch(function () {
            if (page === 1) { if (opts.onFail) opts.onFail(); }
            else { page--; more.disabled = false; }
          });
    }

    more.addEventListener('click', load);

    // Redraw on width changes only: redrawing changes the panel's height,
    // and reacting to that would loop.
    var t, lastW = 0;
    if (window.ResizeObserver) {
      new ResizeObserver(function (entries) {
        var w = Math.round(entries[0].contentRect.width);
        if (w === lastW) return;
        lastW = w;
        clearTimeout(t); t = setTimeout(renderDetail, 120);
      }).observe(detail);
    }

    load();
    return { reload: renderDetail };
  }

  window.DMGExhibited = { mount: mount };
})();