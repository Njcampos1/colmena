/* Sonificación de la colmena (Web Audio API, sin librerías) — BORRADOR
 *
 * Mapeos (el volumen maestro es fijo):
 *  - % de colonias perdidas  -> TONO (más pérdida = zumbido más grave)
 *                            -> RITMO (más pérdida = pulsos más lentos, irregulares y con huecos)
 *  - % afectadas por varroa  -> TIMBRE (más varroa = zumbido más áspero)
 *  - % afectadas por pesticidas -> BATIDO (dos voces desafinadas)
 *  - trimestre sin dato      -> silencio
 */
(function () {
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const lerp = (a, b, t) => a + (b - a) * t;

  let ctx = null, master, filter, shaper, pulse, o1, o2, o3, sub;
  let on = false, timer = null, nextPulse = 0;
  let params = { loss: 0.3, varroa: 0.3, pest: 0.2, missing: false };
  let lastShaperAmt = -1;

  function makeCurve(k) {
    const n = 1024, c = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = (i * 2) / n - 1;
      c[i] = ((1 + k) * x) / (1 + k * Math.abs(x));
    }
    return c;
  }

  function build() {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = 0;
    const comp = ctx.createDynamicsCompressor();
    master.connect(comp).connect(ctx.destination);
    filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 1400; filter.Q.value = 3;
    shaper = ctx.createWaveShaper(); shaper.curve = makeCurve(1); shaper.oversample = '2x';
    pulse = ctx.createGain(); pulse.gain.value = 0;
    const mix = ctx.createGain(); mix.gain.value = 0.22;
    o1 = ctx.createOscillator(); o1.type = 'sawtooth';
    o2 = ctx.createOscillator(); o2.type = 'sawtooth';
    o3 = ctx.createOscillator(); o3.type = 'triangle';
    sub = ctx.createOscillator(); sub.type = 'sine';
    const g3 = ctx.createGain(); g3.gain.value = 0.5;
    const gs = ctx.createGain(); gs.gain.value = 0.8;
    o1.connect(mix); o2.connect(mix); o3.connect(g3).connect(mix); sub.connect(gs).connect(mix);
    mix.connect(shaper).connect(filter).connect(pulse).connect(master);
    [o1, o2, o3, sub].forEach(o => o.start());
    apply(true);
  }

  function apply(immediate) {
    if (!ctx) return;
    const t = ctx.currentTime, tc = immediate ? 0.01 : 0.25;
    const L = clamp(params.loss, 0, 1), V = clamp(params.varroa, 0, 1), P = clamp(params.pest, 0, 1);
    const f0 = 200 * Math.pow(115 / 200, L);
    const beat = lerp(0.4, 7, P);
    o1.frequency.setTargetAtTime(f0, t, tc);
    o2.frequency.setTargetAtTime(f0 + beat, t, tc);
    o3.frequency.setTargetAtTime(f0 * 2, t, tc);
    sub.frequency.setTargetAtTime(f0 / 2, t, tc);
    filter.frequency.setTargetAtTime(lerp(900, 3200, V), t, tc);
    filter.Q.setTargetAtTime(lerp(2, 9, V), t, tc);
    const amt = Math.round(lerp(0.5, 40, V * V) * 2) / 2;
    if (amt !== lastShaperAmt) { shaper.curve = makeCurve(amt); lastShaperAmt = amt; }
  }

  function schedule() {
    if (!ctx) return;
    const ahead = ctx.currentTime + 0.15;
    while (nextPulse < ahead) {
      const L = clamp(params.loss, 0, 1);
      const base = lerp(0.12, 0.95, L);
      const jitter = lerp(0.03, 0.55, L);
      const interval = base * (1 + (Math.random() * 2 - 1) * jitter);
      const floor = lerp(0.55, 0.02, L);
      const gap = Math.random() < lerp(0, 0.35, L);
      const t = Math.max(nextPulse, ctx.currentTime);
      const g = pulse.gain;
      if (params.missing) {
        g.cancelScheduledValues(t); g.setTargetAtTime(0, t, 0.05);
      } else if (!gap) {
        g.cancelScheduledValues(t);
        g.setTargetAtTime(1, t, 0.015);
        g.setTargetAtTime(floor, t + 0.05, interval * 0.35);
      }
      nextPulse = t + interval;
    }
  }

  const Sonido = {
    get on() { return on; },
    async enable() {
      if (!ctx) build();
      await ctx.resume();
      on = true;
      master.gain.setTargetAtTime(0.55, ctx.currentTime, 0.2);
      nextPulse = ctx.currentTime;
      clearInterval(timer); timer = setInterval(schedule, 50);
    },
    disable() {
      on = false;
      if (!ctx) return;
      master.gain.setTargetAtTime(0, ctx.currentTime, 0.15);
      clearInterval(timer); timer = null;
      Sonido.stopCoda();
    },
    update(d) {
      params = {
        missing: !!d.missing || d.pct == null,
        loss: (d.pct ?? 0) / 30,
        varroa: (d.varroa ?? 0) / 60,
        pest: (d.pesticidas ?? 0) / 30,
      };
      apply(false);
    },
    _coda: null,
    async coda(hiveParams, onFrame, onEnd) {
      if (!on) await Sonido.enable();
      Sonido.stopCoda();
      Sonido.update(hiveParams);
      const t0 = ctx.currentTime, dur = 10;
      const wild = ctx.createGain(); wild.gain.value = 0;
      const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : ctx.createGain();
      if (pan.pan) pan.pan.value = 0.35;
      const a = ctx.createOscillator(); a.type = 'triangle'; a.frequency.value = 330;
      const b = ctx.createOscillator(); b.type = 'sine'; b.frequency.value = 495;
      const lfo = ctx.createOscillator(); lfo.frequency.value = 9;
      const lfoG = ctx.createGain(); lfoG.gain.value = 0.5;
      const am = ctx.createGain(); am.gain.value = 0.5;
      lfo.connect(lfoG).connect(am.gain);
      a.connect(am); b.connect(am); am.connect(wild).connect(pan).connect(master);
      wild.gain.setValueAtTime(0, t0);
      wild.gain.linearRampToValueAtTime(0.35, t0 + 1.2);
      wild.gain.setValueAtTime(0.35, t0 + 2.5);
      wild.gain.linearRampToValueAtTime(0.0001, t0 + dur);
      lfo.frequency.setValueAtTime(9, t0 + 2.5);
      lfo.frequency.linearRampToValueAtTime(1.2, t0 + dur);
      a.frequency.setValueAtTime(330, t0 + 2.5); a.frequency.exponentialRampToValueAtTime(250, t0 + dur);
      b.frequency.setValueAtTime(495, t0 + 2.5); b.frequency.exponentialRampToValueAtTime(375, t0 + dur);
      [a, b, lfo].forEach(o => { o.start(t0); o.stop(t0 + dur + 0.2); });
      let raf;
      const tick = () => {
        const e = ctx.currentTime - t0;
        const w = e < 1.2 ? e / 1.2 : e < 2.5 ? 1 : Math.max(0, 1 - (e - 2.5) / (dur - 2.5));
        onFrame && onFrame({ hive: 1, wild: w, t: e / dur });
        if (e < dur + 0.2) raf = requestAnimationFrame(tick);
        else { Sonido._coda = null; onEnd && onEnd(); }
      };
      raf = requestAnimationFrame(tick);
      Sonido._coda = { stop() { cancelAnimationFrame(raf); try { [a, b, lfo].forEach(o => o.stop()); } catch (e) {} wild.disconnect(); onEnd && onEnd(); } };
    },
    stopCoda() { if (Sonido._coda) { const c = Sonido._coda; Sonido._coda = null; c.stop(); } },
  };
  window.Sonido = Sonido;
})();
