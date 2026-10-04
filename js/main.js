/* La colmena que se apaga — V2 (versión concisa)
 * 100 colmenas. Cada trimestre muere el % que reportó el USDA.
 * Sin reposición: se apagan hasta quedar ~3.  Real: los apicultores las reponen.
 */
(function () {
  const D = window.DATA;
  const Q = D.periods;                         // 26 trimestres
  const N = Q.length;                          // puntos 0..26 = inicio de cada trimestre (+ final)
  const MES = ['ene', 'abr', 'jul', 'oct'];
  const pointLabel = t => t < N ? `${MES[Q[t].q - 1]} ${Q[t].year}` : 'jul 2021';
  const qLabel = q => Q[q].label;
  const fmt1 = v => d3.format('.1f')(v).replace('.', ',');
  const stressLabel = Object.fromEntries(D.stressors.map(s => [s.key, s.label]));
  const $ = id => document.getElementById(id);
  const tip = $('tip');

  const S = { abbr: 'US', t: 0, mode: 'sin', revealed: false, playing: false, series: null };

  // ---------- modelo ----------
  function build(abbr) {
    const rows = D.series[abbr];
    const sin = [100];
    rows.forEach((r, t) => sin.push(sin[t] * (1 - (r.missing || r.pct == null ? 0 : r.pct) / 100)));
    const n0 = rows.find(r => r.n)?.n;
    let real = rows.map(r => (r.n ? (r.n / n0) * 100 : null));
    real = real.map((v, i) => v ?? (((real[i - 1] ?? real[i + 1]) + (real[i + 1] ?? real[i - 1])) / 2));
    real.push(real[N - 1]);                       // el último punto repite el último conteo publicado
    const valid = rows.filter(r => !r.missing && r.pct != null);
    return { rows, sin, real, meanPct: d3.mean(valid, r => r.pct) };
  }

  // orden (reproducible) en que mueren las celdas
  const CELLS = 100;
  const rank = d3.shuffler(d3.randomLcg(0.42))(d3.range(CELLS));

  function cellState(i, t, mode) {
    const r = rank[i];
    const A = Math.round(S.series.sin[t]);
    if (mode === 'sin') return r < A ? 'viva' : 'muerta';
    const R = Math.min(CELLS, Math.round(S.series.real[t]));
    if (R <= A) return r < R ? 'viva' : 'muerta';
    if (r < A) return 'viva';
    return r >= CELLS - (R - A) ? 'repuesta' : 'muerta';
  }
  function deathQuarter(i) {
    const r = rank[i], s = S.series.sin;
    for (let q = 0; q < N; q++) if (Math.round(s[q]) > r && Math.round(s[q + 1]) <= r) return q;
    return null;
  }
  const aliveAt = (t, mode) => mode === 'sin' ? S.series.sin[t] : S.series.real[t];

  function topStress(r) {
    if (!r?.s) return null;
    const k = d3.greatest(Object.keys(r.s), k => r.s[k] ?? -1);
    return r.s[k] == null ? null : { k, v: r.s[k] };
  }

  // ---------- tooltip ----------
  function showTip(ev, html) {
    tip.innerHTML = html; tip.hidden = false;
    const w = tip.offsetWidth, h = tip.offsetHeight;
    let x = ev.clientX + 14, y = ev.clientY + 14;
    if (x + w > innerWidth - 8) x = ev.clientX - w - 14;
    if (y + h > innerHeight - 8) y = ev.clientY - h - 14;
    tip.style.left = x + 'px'; tip.style.top = y + 'px';
  }
  const hideTip = () => (tip.hidden = true);
  function quarterHtml(q) {
    const r = S.series.rows[q];
    if (r.missing || r.pct == null) return `<b>${qLabel(q)}</b><br>Sin dato: el USDA no hizo la encuesta.`;
    const ts = topStress(r);
    return `<b>${qLabel(q)}</b><br>Murió el <b>${fmt1(r.pct)} %</b> de las colonias` +
      (ts ? `<br>Mayor amenaza: ${stressLabel[ts.k].split(' (')[0]} (${fmt1(ts.v)} % afectadas)` : '');
  }

  // ======================================================
  // PANAL: 100 celdas
  // ======================================================
  let hexSel;
  function drawPanal() {
    const el = $('panal');
    const cols = 10, rows = 10, r = 24, w = Math.sqrt(3) * r;
    const W = cols * w + w / 2 + 4, H = rows * 1.5 * r + r / 2 + 4;
    const hex = d3.range(6).map(k => { const a = Math.PI / 180 * (60 * k - 30); return [(r - 1.5) * Math.cos(a), (r - 1.5) * Math.sin(a)]; });
    const path = 'M' + hex.join('L') + 'Z';
    el.innerHTML = '';
    const svg = d3.select(el).append('svg').attr('viewBox', `0 0 ${W} ${H}`).attr('role', 'img');
    hexSel = svg.selectAll('path').data(d3.range(CELLS)).join('path')
      .attr('d', path)
      .attr('transform', i => { const row = Math.floor(i / cols), col = i % cols; return `translate(${2 + w / 2 + col * w + (row % 2 ? w / 2 : 0)},${2 + r + row * 1.5 * r})`; })
      .attr('class', 'hex viva')
      .style('animation-delay', () => `${-Math.random() * 1.6}s`)
      .on('mouseenter mousemove', (ev, i) => {
        const st = cellState(i, S.t, S.mode), dq = deathQuarter(i);
        let html = `<b>Colmena ${i + 1}</b><br>`;
        if (st === 'viva') html += 'Sigue viva.';
        else if (st === 'repuesta') html += `Murió en ${qLabel(dq)}.<br>Un apicultor la reemplazó.`;
        else html += dq != null ? `Murió en ${qLabel(dq)}.` : 'Muerta.';
        if (dq != null && st !== 'viva') {
          const ts = topStress(S.series.rows[dq]);
          if (ts) html += `<br><span style="opacity:.75">Ese trimestre, la mayor amenaza fue ${stressLabel[ts.k].split(' (')[0].toLowerCase()}.</span>`;
        }
        showTip(ev, html);
      })
      .on('mouseleave', hideTip);
  }
  function paint(animate) {
    hexSel.attr('class', i => 'hex ' + cellState(i, S.t, S.mode));
  }

  // ======================================================
  // CURVA: colmenas vivas por trimestre (overview + control)
  // ======================================================
  let curve = {};
  function drawCurva() {
    const el = $('curva');
    const W = Math.max(320, el.clientWidth), H = 150;
    const m = { t: 14, r: 150, b: 22, l: 30 };
    const x = d3.scaleLinear([0, N], [m.l, W - m.r]);
    const ymax = Math.max(100, S.revealed ? d3.max(S.series.real) : 0) * 1.05;
    const y = d3.scaleLinear([0, ymax], [H - m.b, m.t]);
    el.innerHTML = '';
    const svg = d3.select(el).append('svg').attr('viewBox', `0 0 ${W} ${H}`);
    [0, 50, 100].forEach(v => {
      svg.append('line').attr('class', 'grid').attr('x1', m.l).attr('x2', W - m.r).attr('y1', y(v)).attr('y2', y(v));
      svg.append('text').attr('class', 'ax').attr('x', m.l - 6).attr('y', y(v)).attr('dy', '0.32em').attr('text-anchor', 'end').text(v);
    });
    d3.range(2015, 2022).forEach(yr => {
      const t = (yr - 2015) * 4;
      svg.append('text').attr('class', 'ax').attr('x', x(t)).attr('y', H - 6).attr('text-anchor', 'start').text(yr);
    });
    // trimestres sin dato
    S.series.rows.forEach((r, q) => { if (r.missing) svg.append('rect').attr('class', 'gap').attr('x', x(q)).attr('width', x(q + 1) - x(q)).attr('y', m.t).attr('height', H - m.b - m.t); });

    if (S.revealed) {
      const realPts = S.series.real.map((v, t) => [x(t), y(v)]);
      svg.append('path').attr('class', 'a-real').attr('d', d3.area().x(d => d[0]).y0(y(0)).y1(d => d[1])(realPts));
    }

    const sinPts = S.series.sin.map((v, t) => [x(t), y(v)]);
    svg.append('path').attr('class', 'a-sin').attr('d', d3.area().x(d => d[0]).y0(y(0)).y1(d => d[1])(sinPts));
    svg.append('path').attr('class', 'l-sin').attr('d', d3.line()(sinPts));
    const end = S.series.sin[N];
    svg.append('text').attr('class', 'lbl sin').attr('x', W - m.r + 8).attr('y', y(end)).attr('dy', '0.32em')
      .text(`Sin reposición: ${Math.round(end)}`);
    if (S.revealed) {
      const realPts = S.series.real.map((v, t) => [x(t), y(v)]);
      svg.append('path').attr('class', 'l-real').attr('d', d3.line()(realPts));
      svg.append('text').attr('class', 'lbl real').attr('x', W - m.r + 8).attr('y', y(S.series.real[N])).attr('dy', '0.32em')
        .text(`Real: ${Math.round(S.series.real[N])}`);
    }
    const head = svg.append('g');
    head.append('line').attr('class', 'head').attr('y1', m.t).attr('y2', H - m.b);
    head.append('circle').attr('class', 'head-dot').attr('r', 4.5);

    // interacción: pasar = detalle del trimestre; clic/arrastrar = mover el tiempo
    let dragging = false;
    const toT = ev => Math.max(0, Math.min(N, Math.round(x.invert(d3.pointer(ev)[0]))));
    svg.append('rect').attr('class', 'hit').attr('x', m.l).attr('y', 0).attr('width', W - m.r - m.l).attr('height', H)
      .on('pointerdown', ev => { dragging = true; ev.target.setPointerCapture(ev.pointerId); stopPlay(); setT(toT(ev)); })
      .on('pointermove', ev => {
        const q = Math.max(0, Math.min(N - 1, Math.floor(x.invert(d3.pointer(ev)[0]))));
        showTip(ev, quarterHtml(q));
        if (dragging) setT(toT(ev));
      })
      .on('pointerup pointercancel', () => (dragging = false))
      .on('pointerleave', () => { hideTip(); });
    curve = { x, y, head };
    moveHead();
  }
  function moveHead() {
    const { x, y, head } = curve;
    const v = aliveAt(S.t, S.mode);
    head.select('line').attr('x1', x(S.t)).attr('x2', x(S.t));
    head.select('circle').attr('cx', x(S.t)).attr('cy', y(v));
  }

  // ======================================================
  // indicador de mayor amenaza y descenso de población
  // ======================================================
  function updateAmenazaBanner(t) {
    const el = $('amenaza-banner');
    if (!el) return;
    if (t === 0) {
      el.innerHTML = '<span class="amenaza-muted">Inicio (100 colmenas). Avanza en la línea de tiempo o reproduce para ver las pérdidas y amenazas trimestrales.</span>';
      return;
    }
    const q = t - 1;
    const r = S.series.rows[q];
    if (!r || r.missing || r.pct == null) {
      el.innerHTML = `<b>${qLabel(q)}:</b> <span class="amenaza-muted">Sin datos registrados por el USDA en este trimestre.</span>`;
      return;
    }
    const prev = Math.round(aliveAt(t - 1, S.mode));
    const curr = Math.round(aliveAt(t, S.mode));
    const diff = prev - curr;

    const ts = topStress(r);
    const amenaza = ts ? (stressLabel[ts.k] || ts.k) : null;
    const amenazaTexto = ts
      ? `disminución causada principalmente por <span class="threat-tag">${amenaza}</span> (${fmt1(ts.v)} % de colmenas afectadas)`
      : '';

    if (diff > 0) {
      const colmStr = diff === 1 ? 'colmena' : 'colmenas';
      el.innerHTML = `<b>${qLabel(q)}:</b> La población disminuyó en <b>${diff} ${colmStr}</b>${amenazaTexto}.`;
    } else if (diff === 0) {
      el.innerHTML = `<b>${qLabel(q)}:</b> La población se mantuvo estable este trimestre${amenaza ? ` (mayor amenaza registrada: <span class="threat-tag">${amenaza}</span>)` : ''}.`;
    } else {
      const ganadas = Math.abs(diff);
      const colmStr = ganadas === 1 ? 'colmena' : 'colmenas';
      el.innerHTML = `<b>${qLabel(q)}:</b> La población aumentó en <b>${ganadas} ${colmStr}</b> gracias a la reposición de apicultores, ${amenazaTexto}.`;
    }
  }

  // ======================================================
  // estado -> pantalla
  // ======================================================
  function render() {
    const v = aliveAt(S.t, S.mode);
    $('num').textContent = Math.round(v);
    $('when').textContent = pointLabel(S.t) + (S.mode === 'real' ? ' · real' : ' · sin reposición');
    paint();
    moveHead();
    Zumbido.setAlive(v);
    updateAmenazaBanner(S.t);
  }
  function setT(t) { S.t = t; render(); if (t === N && S.mode === 'sin') showEnding(); }

  function storyText() {
    const s = S.series, endReal = s.real[N], endSin = Math.round(s.sin[N]);
    $('l0').innerHTML = `Cada trimestre muere cerca de <b>1 de cada ${Math.round(100 / s.meanPct)}</b> colmenas.<br>¿Qué pasaría si nadie las repusiera?`;
    $('l1-n').textContent = endSin;
    let a;
    if (endReal >= 90 && endReal <= 110) a = 'Pero en 2021 había casi las mismas colmenas que en 2015.';
    else if (endReal > 110) a = `Pero en 2021 había <b>más</b> colmenas que en 2015 (${Math.round(endReal)} por cada 100).`;
    else a = `Pero en 2021 seguía habiendo ${Math.round(endReal)} de cada 100, no ${endSin}.`;
    $('l2').innerHTML = a + ' Los apicultores <b>reemplazan</b> cada colmena que muere.';
    $('kicker').textContent = `Abejas melíferas · ${D.names[S.abbr]} · 2015–2021`;
  }
  function showEnding() { $('l1').hidden = false; $('l2').hidden = false; $('btn-real').hidden = false; }

  // ---------- reproducción ----------
  const STEP = 1000; // ms por trimestre
  let timer = null;
  function stopPlay() { clearTimeout(timer); timer = null; S.playing = false; $('btn-play').textContent = S.t >= N ? '↺ Otra vez' : '▶ Escuchar'; }
  async function play() {
    if (S.playing) return stopPlay();
    await ensureSound();
    if (S.t >= N) S.t = 0;
    S.playing = true; $('btn-play').textContent = '❚❚ Pausa';
    render();
    const step = () => {
      if (S.t >= N) { stopPlay(); return; }
      const t0 = S.t, t1 = t0 + 1;
      // celdas que cambian en este trimestre: animación + sonido en el mismo instante
      d3.range(CELLS).forEach(i => {
        const a = cellState(i, t0, S.mode), b = cellState(i, t1, S.mode);
        if (a === b) return;
        const delay = Math.random() * STEP * 0.85;
        if (b === 'muerta') {
          Zumbido.death(delay / 1000);
          setTimeout(() => {
            const n = hexSel.nodes()[i]; n.setAttribute('class', 'hex muriendo');
            setTimeout(() => n.setAttribute('class', 'hex ' + b), 180);
          }, delay);
        } else {
          Zumbido.birth(delay / 1000);
          setTimeout(() => hexSel.nodes()[i].setAttribute('class', 'hex ' + b), delay);
        }
      });
      timer = setTimeout(() => {
        S.t = t1;
        $('num').textContent = Math.round(aliveAt(S.t, S.mode));
        $('when').textContent = pointLabel(S.t) + (S.mode === 'real' ? ' · real' : ' · sin reposición');
        moveHead(); Zumbido.setAlive(aliveAt(S.t, S.mode), 0.9);
        updateAmenazaBanner(S.t);
        if (S.t === N) { paint(); stopPlay(); if (S.mode === 'sin') showEnding(); else $('l3').hidden = false; return; }
        step();
      }, STEP);
    };
    step();
  }

  // revelación: los apicultores reponen (a la fecha actual, con zumbidos que suben)
  async function reveal() {
    stopPlay();
    await ensureSound();
    if (S.mode === 'real') { // volver a ver sin reposición
      S.mode = 'sin'; $('btn-real').textContent = 'Ver lo que realmente pasó';
      document.querySelector('.key .rep').hidden = true;
      drawCurva(); render(); return;
    }
    S.mode = 'real'; S.revealed = true;
    $('btn-real').textContent = 'Ver sin reposición';
    document.querySelector('.key .rep').hidden = false;
    drawCurva();
    const nodes = hexSel.nodes();
    const changed = d3.range(CELLS).filter(i => cellState(i, S.t, 'sin') !== cellState(i, S.t, 'real'));
    d3.shuffle(changed).forEach((i, k) => {
      const delay = (k / Math.max(1, changed.length)) * 2600;
      Zumbido.birth(delay / 1000);
      setTimeout(() => nodes[i].setAttribute('class', 'hex ' + cellState(i, S.t, 'real')), delay);
    });
    const from = S.series.sin[S.t], to = S.series.real[S.t];
    d3.select($('num')).transition().duration(2600).tween('n', function () {
      const f = d3.interpolateNumber(from, to); return u => (this.textContent = Math.round(f(u)));
    });
    $('when').textContent = pointLabel(S.t) + ' · real';
    moveHead();
    updateAmenazaBanner(S.t);
    Zumbido.setAlive(to, 2.6);
    setTimeout(() => { $('l3').hidden = false; }, 2800);
  }

  // ---------- sonido ----------
  async function ensureSound() {
    if (!Zumbido.on) { await Zumbido.enable(); Zumbido.setAlive(aliveAt(S.t, S.mode)); }
    $('btn-sound').setAttribute('aria-pressed', 'true'); $('btn-sound').textContent = '🔊';
  }
  $('btn-sound').addEventListener('click', async () => {
    if (Zumbido.on) { Zumbido.disable(); $('btn-sound').setAttribute('aria-pressed', 'false'); $('btn-sound').textContent = '🔈'; }
    else await ensureSound();
  });
  $('btn-play').addEventListener('click', play);
  $('btn-real').addEventListener('click', reveal);
  addEventListener('keydown', ev => {
    if (ev.target.tagName === 'SELECT') return;
    if (ev.key === 'ArrowRight') { stopPlay(); setT(Math.min(N, S.t + 1)); }
    if (ev.key === 'ArrowLeft') { stopPlay(); setT(Math.max(0, S.t - 1)); }
  });

  // ---------- filtro por territorio ----------
  const sel = $('sel-estado');
  const opts = ['US', ...Object.keys(D.series).filter(k => k !== 'US' && k !== 'OT').sort((a, b) => D.names[a].localeCompare(D.names[b]))];
  sel.innerHTML = opts.map(k => `<option value="${k}">${D.names[k]}</option>`).join('');
  sel.addEventListener('change', () => {
    stopPlay();
    S.abbr = sel.value; S.series = build(S.abbr);
    storyText(); drawCurva(); render();
  });

  // ---------- inicio ----------
  S.series = build('US');
  drawPanal(); storyText(); drawCurva(); render();
  let rz; addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(drawCurva, 150); });
})();
