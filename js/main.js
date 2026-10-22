/* La colmena que se apaga — V4
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

  const S = { t: 0, mode: 'sin', revealed: false, playing: false, series: null };

  // ---------- modelo ----------
  function build() {
    const rows = D.series.US;
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
    $('panal-slot').style.aspectRatio = `${W} / ${H}`;   // el hueco conserva su tamaño mientras el panal cubre la pantalla
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
    if (S.mode === 'real' && t === N) {         // el USDA no publicó el conteo de jul 2021: la curva real repite el último
      el.innerHTML = `<b>${qLabel(q)}:</b> <span class="amenaza-muted">El USDA no publicó el conteo de cierre (jul 2021); la curva real repite el último dato.</span>`;
      return;
    }
    const prev = Math.round(aliveAt(t - 1, S.mode));
    const curr = Math.round(aliveAt(t, S.mode));
    const diff = prev - curr;

    const ts = topStress(r);
    const amenaza = ts ? `<span class="threat-tag">${stressLabel[ts.k] || ts.k}</span> (${fmt1(ts.v)} % de colmenas afectadas)` : null;
    const colmenas = n => `<b>${n} ${n === 1 ? 'colmena' : 'colmenas'}</b>`;

    let txt;
    if (diff > 0) txt = `La población disminuyó en ${colmenas(diff)}${amenaza ? `, sobre todo por ${amenaza}` : ''}.`;
    else if (diff === 0) txt = (S.mode === 'sin' ? `Quedan ${colmenas(curr)} de 100: murió menos de una este trimestre` : 'La población se mantuvo estable') +
      (amenaza ? `. Mayor amenaza registrada: ${amenaza}` : '') + '.';
    else txt = `La población aumentó en ${colmenas(-diff)}: los apicultores repusieron más de las que murieron${amenaza ? `. Mayor amenaza registrada: ${amenaza}` : ''}.`;
    el.innerHTML = `<b>${qLabel(q)}:</b> ${txt}`;
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
  function setT(t) { S.t = t; render(); }

  // el mensaje va arriba, desde el primer segundo: cuántas quedarían y por qué no se nota
  function storyText() {
    const s = S.series, endReal = Math.round(s.real[N]), endSin = Math.round(s.sin[N]);
    $('h-n').textContent = endSin;
    $('intro-n').textContent = endSin;
    let a;
    if (endReal >= 90 && endReal <= 110) a = 'Aun así, en 2021 había casi las mismas que en 2015:';
    else if (endReal > 110) a = `Aun así, en 2021 había <b>más</b> que en 2015 (${endReal} por cada 100):`;
    else a = `Aun así, en 2021 seguía habiendo ${endReal} de cada 100, no ${endSin}:`;
    const tops = s.rows.map(topStress).filter(Boolean);
    const nV = tops.filter(ts => ts.k === 'varroa').length;
    $('nota-varroa').innerHTML = `La <b>varroa</b>, un ácaro parásito, fue la mayor amenaza en <b>${nV} de ${tops.length}</b> trimestres con dato.`;
    $('sub').innerHTML = `Cada trimestre muere cerca de <b>1 de cada ${Math.round(100 / s.meanPct)}</b> colmenas. ${a} los apicultores <b>reponen</b> las que mueren.`;
  }

  // ---------- reproducción ----------
  const STEP = 400;  // ms por trimestre (~10 s en total)
  let timer = null;
  function stopPlay() { clearTimeout(timer); timer = null; S.playing = false; $('btn-play').textContent = S.t > 0 && S.t < N ? '▶ Continuar' : '▶ Reproducir 2015–2021'; }
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
            setTimeout(() => n.setAttribute('class', 'hex ' + b), 140);
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
        if (S.t === N) { paint(); stopPlay(); if (S.mode === 'real') $('l3').hidden = false; return; }
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

  // al terminar la intro empieza el zumbido. El navegador solo deja sonar audio después de un
  // gesto del usuario: si aún no lo hubo, arranca con el primer clic, toque o tecla en la página.
  function autoSound() {
    const evs = ['pointerdown', 'keydown'];
    const off = () => evs.forEach(e => removeEventListener(e, start, true));
    const start = ev => {
      if (ev?.target.closest?.('#btn-sound')) return off();   // el botón de sonido decide por sí mismo
      if (Zumbido.on) return off();
      ensureSound().then(off);                                 // si el navegador lo bloquea, queda pendiente hasta el próximo gesto
    };
    evs.forEach(e => addEventListener(e, start, true));
    start();
  }

  // abejas vistas desde arriba que caminan al azar sobre el panal, se detienen a ratos y esquivan la pregunta
  const BEE_SVG = `<svg viewBox="0 0 44 34" aria-hidden="true">
    <g stroke="#1a1208" stroke-width="1.4" stroke-linecap="round" fill="none">
      <g class="legs-a"><path d="M24 12 L21 4"/><path d="M28 22 L31 30"/><path d="M19 22 L14 30"/></g>
      <g class="legs-b"><path d="M24 22 L21 30"/><path d="M28 12 L31 4"/><path d="M19 12 L14 4"/></g>
      <g class="antenna"><path d="M38 15 Q42 11 44 8"/><path d="M38 19 Q42 23 44 26"/></g>
    </g>
    <clipPath id="walker-abd"><ellipse cx="15" cy="17" rx="12" ry="8"/></clipPath>
    <ellipse cx="15" cy="17" rx="12" ry="8" fill="#f5c518"/>
    <g clip-path="url(#walker-abd)" fill="#1a1208"><rect x="6" y="8" width="3" height="18"/><rect x="12" y="8" width="3" height="18"/><rect x="18" y="8" width="3" height="18"/></g>
    <path d="M3 17 L0 17" stroke="#1a1208" stroke-width="1.5"/>
    <ellipse cx="18" cy="12" rx="10" ry="4.5" transform="rotate(-14 18 12)" fill="rgba(255,255,255,.32)" stroke="rgba(255,255,255,.8)" stroke-width=".6"/>
    <ellipse cx="18" cy="22" rx="10" ry="4.5" transform="rotate(14 18 22)" fill="rgba(255,255,255,.32)" stroke="rgba(255,255,255,.8)" stroke-width=".6"/>
    <circle cx="29" cy="17" r="5" fill="#4a3412"/>
    <circle cx="36" cy="17" r="4" fill="#1a1208"/>
  </svg>`;
  function walkBees(intro) {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return null;
    const box = document.createElement('div');
    box.className = 'walkers';
    intro.prepend(box);
    const bubble = intro.querySelector('.intro-center');
    const bees = d3.range(4).map(() => {
      const el = document.createElement('div');
      el.className = 'walker'; el.innerHTML = BEE_SVG; box.appendChild(el);
      // empiezan en los bordes, lejos de la pregunta
      const side = Math.random() < 0.5;
      return { el, x: side ? innerWidth * (0.08 + Math.random() * 0.2) : innerWidth * (0.72 + Math.random() * 0.2),
        y: innerHeight * (0.12 + Math.random() * 0.76), a: Math.random() * Math.PI * 2,
        v: 34 + Math.random() * 22, pause: 0, turn: 0 };
    });
    let last = performance.now();
    function tick(now) {
      if (!intro.isConnected) return;
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      const W = innerWidth, H = innerHeight, m = 50;
      const r = bubble.getBoundingClientRect();
      bees.forEach(b => {
        if (b.gone) return;
        if (b.pause > 0) {
          b.pause -= dt;
          b.el.classList.toggle('stopped', b.pause > 0);
        } else {
          if (Math.random() < dt * 0.25) b.pause = 0.6 + Math.random() * 1.6;    // se detiene un momento
          b.turn += (Math.random() - 0.5) * 6 * dt;                               // deambula
          b.turn = Math.max(-1.6, Math.min(1.6, b.turn));
          let steer = b.turn;
          // fuera de los márgenes o sobre la pregunta: gira hacia afuera de ese obstáculo
          const avoid = (tx, ty) => {
            const want = Math.atan2(ty - b.y, tx - b.x);
            const d = Math.atan2(Math.sin(want - b.a), Math.cos(want - b.a));
            steer = d * 3;
          };
          if (b.x < m || b.x > W - m || b.y < m || b.y > H - m) avoid(W / 2, H / 2);
          const pad = 40, cx = (r.left + r.right) / 2, cy = (r.top + r.bottom) / 2;
          if (b.x > r.left - pad && b.x < r.right + pad && b.y > r.top - pad && b.y < r.bottom + pad + 40)
            avoid(b.x + (b.x - cx), b.y + (b.y - cy) * 3);
          // no encimarse con otra abeja
          bees.forEach(o => { if (o !== b && !o.gone && Math.hypot(o.x - b.x, o.y - b.y) < 70) avoid(2 * b.x - o.x, 2 * b.y - o.y); });
          b.a += steer * dt;
          b.x += Math.cos(b.a) * b.v * dt;
          b.y += Math.sin(b.a) * b.v * dt;
        }
        b.el.style.transform = `translate(${b.x}px, ${b.y}px) rotate(${b.a}rad)`;
      });
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
    // con menos colmenas, menos abejas (queda una)
    return {
      setAlive(v) {
        const keep = Math.max(1, Math.ceil(bees.length * v / 100));
        bees.forEach((b, i) => { b.gone = i >= keep; b.el.classList.toggle('gone', b.gone); });
      },
    };
  }

  // intro automática: el panal cubre la pantalla y se apaga solo (100 → 3 en ~3 s),
  // aparece el mensaje y el panal se encoge a su lugar. Un clic salta al final.
  function startIntro() {
    const panal = $('panal'), svg = panal.querySelector('svg'), intro = $('intro');
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const STEP_I = 125, WAIT = 900;          // ms por trimestre, pausa inicial con todo vivo
    panal.classList.add('full');
    svg.setAttribute('preserveAspectRatio', 'xMidYMid slice');
    const bees = walkBees(intro);
    let timers = [], finished = false, leaving = false;
    const later = (f, ms) => timers.push(setTimeout(f, ms));
    const showCount = t => {
      $('intro-num').textContent = Math.round(S.series.sin[t]);
      $('intro-when').textContent = pointLabel(t);
      bees?.setAlive(S.series.sin[t]);
    };

    function finish() {
      if (finished) return;
      finished = true;
      timers.forEach(clearTimeout); timers = [];
      setT(N); showCount(N);
      $('intro-msg').hidden = false;
      $('intro-hint').textContent = 'Clic para continuar 🔊';
      intro.classList.add('done');
      later(leave, reduce ? 4000 : 2800);
    }
    function leave() {
      if (leaving) return;
      leaving = true;
      timers.forEach(clearTimeout); timers = [];
      intro.classList.add('leaving');
      hideTip();
      autoSound();
      // de pantalla completa al rectángulo del hueco (FLIP con top/left/width/height)
      const r = $('panal-slot').getBoundingClientRect();
      Object.assign(panal.style, { top: '0px', left: '0px', width: innerWidth + 'px', height: innerHeight + 'px' });
      panal.offsetWidth;
      panal.classList.add('moving');
      Object.assign(panal.style, { top: r.top + 'px', left: r.left + 'px', width: r.width + 'px', height: r.height + 'px' });
      setTimeout(() => {
        panal.classList.remove('full', 'moving');
        panal.removeAttribute('style');
        svg.removeAttribute('preserveAspectRatio');
        document.body.classList.remove('intro-open');
        intro.remove();
        $('btn-real').focus({ preventScroll: true });
      }, 950);
    }
    const next = () => (finished ? leave() : finish());

    if (reduce) finish();
    else {
      const nodes = hexSel.nodes();
      d3.range(1, N + 1).forEach(t => later(() => {
        d3.range(CELLS).forEach(i => {
          if (cellState(i, t - 1, 'sin') === 'viva' && cellState(i, t, 'sin') === 'muerta') {
            nodes[i].setAttribute('class', 'hex muriendo');
            later(() => nodes[i].setAttribute('class', 'hex muerta'), 160);
          }
        });
        S.t = t; showCount(t);
      }, WAIT + (t - 1) * STEP_I));
      later(finish, WAIT + N * STEP_I + 300);
    }
    intro.addEventListener('click', next);
    intro.addEventListener('keydown', ev => { if (ev.key === 'Enter' || ev.key === ' ' || ev.key === 'Escape') { ev.preventDefault(); next(); } });
    intro.focus();
  }
  $('btn-real').addEventListener('click', reveal);
  addEventListener('keydown', ev => {
    if ($('intro')) return;
    if (ev.key === 'ArrowRight') { stopPlay(); setT(Math.min(N, S.t + 1)); }
    if (ev.key === 'ArrowLeft') { stopPlay(); setT(Math.max(0, S.t - 1)); }
  });

  // ---------- inicio ----------
  S.series = build();
  drawPanal(); storyText(); drawCurva(); render();
  startIntro();
  let rz; addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(drawCurva, 150); });
})();
