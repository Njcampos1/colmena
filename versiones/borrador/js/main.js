/* La colmena que se apaga — BORRADOR
 * Overview: panal del tiempo · Zoom/filtro: mapa hexagonal de estados
 * Detalle: amenazas por trimestre + fichas · Cierre: abejas silvestres
 */
(function () {
  const D = window.DATA;
  const P = D.periods;
  const YEARS = [...new Set(P.map(p => p.year))];
  const tip = document.getElementById('tip');
  const state = { abbr: 'US', t: P.length - 1, playing: false };

  const LOSS_STOPS = ['#fbefcc', '#f6d47f', '#eeb13f', '#d98a1c', '#b3620f', '#833f0b', '#57240a'];
  const LOSS_MAX = 30;
  const lossColor = d3.scaleSequential(d3.interpolateRgbBasis(LOSS_STOPS)).domain([0, LOSS_MAX]).clamp(true);
  const STRESS_STOPS = ['#e3eefc', '#b7d3f6', '#86b6ef', '#5598e7', '#2a78d6', '#1c5cab', '#104281'];
  const STRESS_MAX = 60;
  const stressColor = d3.scaleSequential(d3.interpolateRgbBasis(STRESS_STOPS)).domain([0, STRESS_MAX]).clamp(true);
  const inkOn = c => (d3.hcl(c).l > 60 ? '#1d1a14' : '#ffffff');

  const fmtInt = d3.format(',.0f');
  const fmtK = v => v == null ? '—' : v >= 1e6 ? d3.format('.2f')(v / 1e6).replace('.', ',') + ' M' : fmtInt(v).replace(/,/g, '.');
  const fmtPct = v => v == null ? '—' : d3.format('.1f')(v).replace('.', ',') + ' %';
  const rec = (abbr, t) => (D.series[abbr] || [])[t];
  const stressLabel = Object.fromEntries(D.stressors.map(s => [s.key, s.label]));

  const SHORT = { varroa: 'Varroa', plagas: 'Plagas', enfermedades: 'Enfermed.', pesticidas: 'Pesticidas', otros: 'Otros', desconocido: 'Descon.' };
  const STRESS_ORDER = D.stressors.map(s => s.key).sort((a, b) =>
    d3.mean(D.series.US, r => r.s?.[b]) - d3.mean(D.series.US, r => r.s?.[a]));

  function hexPath(r) {
    const pts = d3.range(6).map(i => {
      const a = (Math.PI / 180) * (60 * i - 30);
      return [r * Math.cos(a), r * Math.sin(a)];
    });
    return 'M' + pts.map(p => p.join(',')).join('L') + 'Z';
  }
  function addHatch(svg, id) {
    const p = svg.append('defs').append('pattern').attr('id', id).attr('patternUnits', 'userSpaceOnUse')
      .attr('width', 6).attr('height', 6).attr('patternTransform', 'rotate(45)');
    p.append('rect').attr('width', 6).attr('height', 6).attr('fill', 'var(--missing)');
    p.append('line').attr('x1', 0).attr('y1', 0).attr('x2', 0).attr('y2', 6).attr('stroke', 'var(--hatch)').attr('stroke-width', 2);
  }
  function showTip(ev, html) {
    tip.innerHTML = html; tip.hidden = false;
    const pad = 14, w = tip.offsetWidth, h = tip.offsetHeight;
    let x = ev.clientX + pad, y = ev.clientY + pad;
    if (x + w > innerWidth - 8) x = ev.clientX - w - pad;
    if (y + h > innerHeight - 8) y = ev.clientY - h - pad;
    tip.style.left = x + 'px'; tip.style.top = y + 'px';
  }
  const hideTip = () => { tip.hidden = true; };
  function topStressor(r) {
    if (!r?.s) return null;
    const k = d3.greatest(Object.keys(r.s), k => r.s[k] ?? -1);
    return r.s[k] == null ? null : { key: k, v: r.s[k] };
  }
  function tipHtml(abbr, t) {
    const r = rec(abbr, t), p = P[t];
    if (!r || r.missing) return `<b>${D.names[abbr]} · ${p.label}</b><br>Sin dato (el USDA no publicó este trimestre).`;
    const ts = topStressor(r);
    return `<b>${D.names[abbr]} · ${p.label}</b><br>
      Colonias perdidas: <b>${fmtPct(r.pct)}</b> (${fmtK(r.lost)})<br>
      Colonias añadidas: ${fmtK(r.added)}<br>
      ${ts ? `Mayor amenaza: ${stressLabel[ts.key]} (${fmtPct(ts.v)})` : ''}`;
  }

  function soundFor(abbr, t) {
    if (!Sonido.on || Sonido._coda) return;
    const r = rec(abbr, t);
    Sonido.update(r && !r.missing ? { pct: r.pct, varroa: r.s?.varroa, pesticidas: r.s?.pesticidas } : { missing: true });
  }

  // 1) PANAL DEL TIEMPO
  function drawPanal() {
    const el = document.getElementById('panal');
    const W = el.clientWidth || 520;
    const left = 62, top = 26;
    const r = Math.min(34, (W - left - 8) / ((YEARS.length + 0.5) * Math.sqrt(3)));
    const hw = Math.sqrt(3) * r;
    const H = top + 4 * 1.5 * r + r * 0.6 + 6;
    el.innerHTML = '';
    const svg = d3.select(el).append('svg').attr('viewBox', `0 0 ${W} ${H}`);
    addHatch(svg, 'hatch-panal');
    const g = svg.append('g').attr('transform', `translate(${left},${top + r})`);
    const pos = p => {
      const row = p.q - 1, col = YEARS.indexOf(p.year);
      return [col * hw + (row % 2 ? hw / 2 : 0) + hw / 2, row * 1.5 * r];
    };
    YEARS.forEach((y, i) => svg.append('text').attr('class', 'axis-t strong').attr('x', left + i * hw + hw * 0.75)
      .attr('y', 14).attr('text-anchor', 'middle').text(y));
    ['Ene–Mar', 'Abr–Jun', 'Jul–Sep', 'Oct–Dic'].forEach((l, i) => svg.append('text').attr('class', 'axis-t')
      .attr('x', left - 8).attr('y', top + r + i * 1.5 * r).attr('text-anchor', 'end').attr('dominant-baseline', 'central').text(l));
    [[2021, 3], [2021, 4]].forEach(([y, q]) => {
      const [x, yy] = pos({ year: y, q });
      g.append('path').attr('d', hexPath(r - 1)).attr('transform', `translate(${x},${yy})`)
        .attr('fill', 'none').attr('stroke', 'var(--line)').attr('stroke-dasharray', '3 3');
    });
    const path = hexPath(r - 1);
    const cells = g.selectAll('g.c').data(P).join('g').attr('class', 'c')
      .attr('transform', p => `translate(${pos(p)})`);
    cells.append('path').attr('d', path)
      .attr('class', p => 'cell' + (p.t === state.t ? ' sel' : ''))
      .attr('fill', p => { const d = rec(state.abbr, p.t); return !d || d.missing ? 'url(#hatch-panal)' : lossColor(d.pct); })
      .attr('tabindex', 0).attr('role', 'button')
      .attr('aria-label', p => { const d = rec(state.abbr, p.t); return `${p.label}: ${d && !d.missing ? fmtPct(d.pct) + ' perdidas' : 'sin dato'}`; })
      .on('mouseenter', (ev, p) => { showTip(ev, tipHtml(state.abbr, p.t)); soundFor(state.abbr, p.t); })
      .on('mousemove', (ev, p) => showTip(ev, tipHtml(state.abbr, p.t)))
      .on('mouseleave', () => { hideTip(); soundFor(state.abbr, state.t); })
      .on('click', (ev, p) => select({ t: p.t }))
      .on('keydown', (ev, p) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); select({ t: p.t }); } });
    const vals = P.map(p => rec(state.abbr, p.t)).filter(d => d && !d.missing);
    const maxT = vals.length ? d3.greatest(vals, d => d.pct).t : -1;
    cells.filter(p => p.t === state.t || p.t === maxT).append('text').attr('class', 'hex-lbl')
      .attr('fill', p => { const d = rec(state.abbr, p.t); return !d || d.missing ? 'var(--ink-2)' : inkOn(lossColor(d.pct)); })
      .text(p => { const d = rec(state.abbr, p.t); return !d || d.missing ? 's/d' : Math.round(d.pct) + '%'; });
    document.getElementById('scope-name').textContent = D.names[state.abbr];
  }

  // 2) MAPA HEXAGONAL DE ESTADOS
  const GRID = {
    AK: [0, 0], ME: [0, 11],
    WI: [1, 6], VT: [1, 10], NH: [1, 11],
    WA: [2, 1], ID: [2, 2], MT: [2, 3], ND: [2, 4], MN: [2, 5], IL: [2, 6], MI: [2, 7], NY: [2, 9], MA: [2, 10],
    OR: [3, 1], NV: [3, 2], WY: [3, 3], SD: [3, 4], IA: [3, 5], IN: [3, 6], OH: [3, 7], PA: [3, 8], NJ: [3, 9], CT: [3, 10], RI: [3, 11],
    CA: [4, 1], UT: [4, 2], CO: [4, 3], NE: [4, 4], MO: [4, 5], KY: [4, 6], WV: [4, 7], VA: [4, 8], MD: [4, 9], DE: [4, 10],
    AZ: [5, 2], NM: [5, 3], KS: [5, 4], AR: [5, 5], TN: [5, 6], NC: [5, 7], SC: [5, 8],
    OK: [6, 4], LA: [6, 5], MS: [6, 6], AL: [6, 7], GA: [6, 8],
    HI: [7, 0], TX: [7, 4], FL: [7, 9],
  };
  function drawMapa() {
    const el = document.getElementById('mapa');
    const W = el.clientWidth || 520;
    const cols = 12.5;
    const r = Math.min(26, W / (cols * Math.sqrt(3)));
    const hw = Math.sqrt(3) * r;
    const H = 8 * 1.5 * r + r;
    el.innerHTML = '';
    const svg = d3.select(el).append('svg').attr('viewBox', `0 0 ${W} ${H}`);
    addHatch(svg, 'hatch-map');
    const g = svg.append('g').attr('transform', `translate(${(W - cols * hw) / 2 + hw / 2},${r + 2})`);
    const data = Object.entries(GRID).map(([abbr, [row, col]]) => ({ abbr, row, col, has: !!D.series[abbr] }));
    const path = hexPath(r - 1);
    const cells = g.selectAll('g.s').data(data).join('g').attr('class', 's')
      .attr('transform', d => `translate(${d.col * hw + (d.row % 2 ? hw / 2 : 0)},${d.row * 1.5 * r})`);
    const fillOf = d => { const x = d.has && rec(d.abbr, state.t); return !x || x.missing ? 'url(#hatch-map)' : lossColor(x.pct); };
    cells.append('path').attr('d', path)
      .attr('class', d => 'cell' + (d.abbr === state.abbr ? ' sel' : ''))
      .attr('fill', fillOf)
      .style('cursor', d => d.has ? 'pointer' : 'default')
      .attr('tabindex', d => d.has ? 0 : null)
      .attr('aria-label', d => d.abbr)
      .on('mouseenter mousemove', (ev, d) => {
        showTip(ev, d.has ? tipHtml(d.abbr, state.t) : `<b>${d.abbr}</b><br>Sin serie propia: el USDA lo incluye en “Otros estados”.`);
        if (d.has) soundFor(d.abbr, state.t);
      })
      .on('mouseleave', () => { hideTip(); soundFor(state.abbr, state.t); })
      .on('click', (ev, d) => d.has && select({ abbr: d.abbr === state.abbr ? 'US' : d.abbr }))
      .on('keydown', (ev, d) => { if (d.has && (ev.key === 'Enter' || ev.key === ' ')) { ev.preventDefault(); select({ abbr: d.abbr }); } });
    cells.append('text').attr('class', 'hex-lbl')
      .attr('fill', d => { const x = d.has && rec(d.abbr, state.t); return !x || x.missing ? 'var(--ink-3)' : inkOn(lossColor(x.pct)); })
      .style('font-size', Math.max(8, r * 0.42) + 'px')
      .text(d => d.abbr);
    document.getElementById('map-period').textContent = P[state.t].label;
  }

  // 3) DETALLE
  function drawTiles() {
    const r = rec(state.abbr, state.t);
    const el = document.getElementById('tiles');
    document.getElementById('det-title').textContent = `· ${D.names[state.abbr]}, ${P[state.t].label}`;
    if (!r || r.missing) {
      el.innerHTML = `<div class="tile wide"><div class="v">Sin dato</div><div class="l">El USDA no publicó este trimestre (T2 2019 fue suspendido).</div></div>`;
      return;
    }
    const ts = topStressor(r);
    el.innerHTML = `
      <div class="tile wide hero"><div class="v">${fmtPct(r.pct)}</div><div class="l">de las colonias se perdió este trimestre <span class="muted">(sobre el máximo de colonias que hubo en el trimestre, como calcula el USDA)</span></div></div>
      <div class="tile"><div class="v">${fmtK(r.n)}</div><div class="l">colonias al inicio</div></div>
      <div class="tile"><div class="v">${fmtK(r.lost)}</div><div class="l">colonias perdidas</div></div>
      <div class="tile"><div class="v">${fmtK(r.added)}</div><div class="l">colonias añadidas (repuestas)</div></div>
      <div class="tile"><div class="v">${ts ? stressLabel[ts.key].split(' ')[0] : '—'}</div><div class="l">mayor amenaza${ts ? ` (${fmtPct(ts.v)})` : ''}</div></div>`;
  }

  function drawEstres() {
    const el = document.getElementById('estres');
    const W = el.clientWidth || 700;
    const narrow = W < 520;
    const labW = narrow ? 104 : 170, valW = 56, rowH = 26, top = 4, bottom = 22;
    const cw = (W - labW - valW) / P.length;
    const H = top + STRESS_ORDER.length * rowH + bottom;
    el.innerHTML = '';
    const svg = d3.select(el).append('svg').attr('viewBox', `0 0 ${W} ${H}`);
    addHatch(svg, 'hatch-st');
    const g = svg.append('g').attr('transform', `translate(${labW},${top})`);
    const series = D.series[state.abbr];
    STRESS_ORDER.forEach((k, i) => {
      const y = i * rowH;
      svg.append('text').attr('class', 'row-l').attr('x', labW - 8).attr('y', top + y + rowH / 2)
        .attr('text-anchor', 'end').attr('dominant-baseline', 'central')
        .text(narrow ? SHORT[k] : stressLabel[k]);
      g.selectAll(null).data(series).join('rect')
        .attr('class', 'cell')
        .attr('x', d => d.t * cw).attr('y', y + 1).attr('width', Math.max(1, cw)).attr('height', rowH - 2).attr('rx', 3)
        .attr('fill', d => d.s?.[k] == null ? 'url(#hatch-st)' : stressColor(d.s[k]))
        .on('mouseenter mousemove', (ev, d) => showTip(ev, `<b>${stressLabel[k]}</b> · ${P[d.t].label}<br>${d.s?.[k] == null ? 'Sin dato' : fmtPct(d.s[k]) + ' de las colonias afectadas'}`))
        .on('mouseleave', hideTip)
        .on('click', (ev, d) => select({ t: d.t }));
      const v = series[state.t]?.s?.[k];
      svg.append('text').attr('class', 'row-v').attr('x', W - 4).attr('y', top + y + rowH / 2)
        .attr('text-anchor', 'end').attr('dominant-baseline', 'central').text(v == null ? 's/d' : fmtPct(v));
    });
    g.append('rect').attr('class', 'col-sel').attr('x', state.t * cw - 1).attr('y', -1)
      .attr('width', cw + 2).attr('height', STRESS_ORDER.length * rowH + 2);
    YEARS.forEach(y => {
      const t = P.findIndex(p => p.year === y);
      g.append('text').attr('class', 'axis-t').attr('x', t * cw + 1).attr('y', STRESS_ORDER.length * rowH + 15).text(narrow ? "'" + String(y).slice(2) : y);
    });
  }

  function legend(id, stops, max, label) {
    const el = document.getElementById(id);
    el.innerHTML = `<span>${label}</span><span>0 %</span><span class="ramp">${stops.map(c => `<i style="background:${c}"></i>`).join('')}</span><span>${max} %+</span>
      <span style="margin-left:8px"><span class="swatch hatch"></span>sin dato</span>`;
  }

  function select(ch) {
    Object.assign(state, ch);
    drawPanal(); drawMapa(); drawTiles(); drawEstres();
    soundFor(state.abbr, state.t);
  }

  const btnSound = document.getElementById('btn-sound');
  btnSound.addEventListener('click', async () => {
    if (Sonido.on) { Sonido.disable(); btnSound.setAttribute('aria-pressed', 'false'); btnSound.querySelector('.lbl').textContent = 'Activar sonido'; }
    else {
      await Sonido.enable(); soundFor(state.abbr, state.t);
      btnSound.setAttribute('aria-pressed', 'true'); btnSound.querySelector('.lbl').textContent = 'Silenciar';
    }
  });

  let playTimer = null;
  const btnPlay = document.getElementById('btn-play');
  function stopPlay() { clearInterval(playTimer); playTimer = null; state.playing = false; btnPlay.textContent = '▶ Recorrer 2015–2021'; btnPlay.setAttribute('aria-pressed', 'false'); }
  btnPlay.addEventListener('click', async () => {
    if (playTimer) return stopPlay();
    if (!Sonido.on) btnSound.click();
    state.playing = true; btnPlay.textContent = '❚❚ Pausar'; btnPlay.setAttribute('aria-pressed', 'true');
    let t = state.t >= P.length - 1 ? 0 : state.t;
    select({ t });
    playTimer = setInterval(() => {
      t++;
      if (t >= P.length) return stopPlay();
      select({ t });
    }, 1300);
  });

  document.getElementById('btn-us').addEventListener('click', () => select({ abbr: 'US' }));

  const btnCoda = document.getElementById('btn-coda');
  const mHive = document.getElementById('m-hive'), mWild = document.getElementById('m-wild');
  btnCoda.addEventListener('click', async () => {
    if (Sonido._coda) { Sonido.stopCoda(); return; }
    stopPlay();
    if (!Sonido.on) btnSound.click();
    const us = D.series.US.filter(r => !r.missing);
    const hive = { pct: d3.mean(us, r => r.pct), varroa: d3.mean(us, r => r.s?.varroa), pesticidas: d3.mean(us, r => r.s?.pesticidas) };
    btnCoda.textContent = '■ Detener';
    await Sonido.coda(hive,
      f => { mHive.style.width = f.hive * 100 + '%'; mWild.style.width = f.wild * 100 + '%'; },
      () => { btnCoda.textContent = '▶ Escuchar el contraste'; soundFor(state.abbr, state.t); });
  });

  legend('legend-loss', LOSS_STOPS, LOSS_MAX, 'Colonias perdidas:');
  legend('legend-stress', STRESS_STOPS, STRESS_MAX, 'Colonias afectadas:');
  select({});
  let rz; addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => select({}), 150); });
})();
