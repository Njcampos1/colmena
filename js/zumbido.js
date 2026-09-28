/* Zumbido de enjambre (Web Audio API).
 *
 * Cada "voz" es una abeja: aleteo de ~190–260 Hz con armónicos, un temblor de alas,
 * una afinación que deriva sola y pasadas cerca del oído (cambio de paneo y de tono, como el efecto Doppler).
 * Si <body data-sample="audio/abeja.mp3"> apunta a una grabación real, las voces usan esa grabación.
 *
 * Mapeos:
 *   colmenas vivas      -> CUÁNTAS abejas se oyen (densidad/textura: de enjambre a una abeja sola)
 *   colmenas que mueren -> RITMO: un zumbido que cae y se apaga por cada colmena muerta
 *   colmenas repuestas  -> un zumbido que sube (una colmena nueva)
 * El volumen maestro es fijo.
 */
(function () {
  const MAX_VOICES = 16;
  const rand = (a, b) => a + Math.random() * (b - a);
  let ctx, bus, sample = null, voices = [], wander = null, on = false, target = 0;

  async function loadSample() {
    const url = document.body.dataset.sample;   // p.ej. <body data-sample="audio/abeja.mp3">
    if (!url) return;
    try {
      const r = await fetch(url);
      if (!r.ok) return;
      sample = await ctx.decodeAudioData(await r.arrayBuffer());
    } catch (e) { sample = null; }
  }

  function makePan() {
    return ctx.createStereoPanner ? ctx.createStereoPanner() : ctx.createGain();
  }

  // --- una abeja sostenida ---
  function makeVoice(i) {
    const out = ctx.createGain(); out.gain.value = 0;
    const pan = makePan();
    const trem = ctx.createGain(); trem.gain.value = 0.8;           // temblor de alas
    const lfo = ctx.createOscillator(); lfo.frequency.value = rand(18, 34);
    const lfoAmt = ctx.createGain(); lfoAmt.gain.value = 0.2;
    lfo.connect(lfoAmt).connect(trem.gain); lfo.start();
    const base = rand(195, 255);
    let src, setRate;
    if (sample) {
      src = ctx.createBufferSource(); src.buffer = sample; src.loop = true;
      src.playbackRate.value = base / 225;
      src.start(0, rand(0, sample.duration));
      src.connect(trem);
      setRate = (f, t, tc) => src.playbackRate.setTargetAtTime(f / 225, t, tc);
    } else {
      // aleteo: sierra + cuadrada suave, filtradas como el cuerpo de una abeja
      const o1 = ctx.createOscillator(); o1.type = 'sawtooth'; o1.frequency.value = base;
      const o2 = ctx.createOscillator(); o2.type = 'square'; o2.frequency.value = base * 1.003;
      const g2 = ctx.createGain(); g2.gain.value = 0.25;
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = base * 2.3; bp.Q.value = 0.9;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2600;
      const body = ctx.createGain(); body.gain.value = 0.9;
      o1.connect(bp); o2.connect(g2).connect(bp); bp.connect(lp).connect(body).connect(trem);
      o1.start(); o2.start();
      setRate = (f, t, tc) => { o1.frequency.setTargetAtTime(f, t, tc); o2.frequency.setTargetAtTime(f * 1.003, t, tc); bp.frequency.setTargetAtTime(f * 2.3, t, tc); };
    }
    trem.connect(out).connect(pan).connect(bus);
    if (pan.pan) pan.pan.value = rand(-0.8, 0.8);
    return { out, pan, base, f: base, setRate, active: false, fly: 0 };
  }

  // deriva natural: cada abeja cambia un poco de tono y a veces "pasa volando"
  function wanderTick() {
    const t = ctx.currentTime;
    for (const v of voices) {
      if (!v.active) continue;
      if (v.fly <= 0 && Math.random() < 0.03) {                   // pasada cerca del oído
        v.fly = 6;
        const up = rand(1.06, 1.14);
        v.setRate(v.base * up, t, 0.12);
        v.setRate(v.base * rand(0.88, 0.95), t + 0.35, 0.18);
        if (v.pan.pan) v.pan.pan.setTargetAtTime(rand(-1, 1), t, 0.25);
      } else if (v.fly > 0) {
        v.fly--;
      } else {
        v.f = Math.max(v.base * 0.93, Math.min(v.base * 1.07, v.f * rand(0.985, 1.015)));
        v.setRate(v.f, t, 0.1);
        if (v.pan.pan) v.pan.pan.setTargetAtTime(Math.max(-1, Math.min(1, v.pan.pan.value + rand(-0.1, 0.1))), t, 0.3);
      }
    }
  }

  function applyCount(fade = 0.6) {
    const t = ctx.currentTime;
    voices.forEach((v, i) => {
      const want = i < target;
      if (want !== v.active) {
        v.active = want;
        v.out.gain.cancelScheduledValues(t);
        v.out.gain.setTargetAtTime(want ? rand(0.1, 0.14) : 0, t, fade / 3);
      }
    });
  }

  // --- eventos breves: una colmena muere / nace ---
  function glide(when, f0, f1, dur, peak) {
    const t = Math.max(when, ctx.currentTime);
    const g = ctx.createGain(); g.gain.value = 0;
    const pan = makePan(); if (pan.pan) pan.pan.value = rand(-0.9, 0.9);
    let node;
    if (sample) {
      node = ctx.createBufferSource(); node.buffer = sample;
      node.playbackRate.setValueAtTime(f0 / 225, t);
      node.playbackRate.exponentialRampToValueAtTime(f1 / 225, t + dur);
      node.start(t, rand(0, Math.max(0, sample.duration - dur)));
      node.connect(g);
    } else {
      node = ctx.createOscillator(); node.type = 'sawtooth';
      node.frequency.setValueAtTime(f0, t);
      node.frequency.exponentialRampToValueAtTime(f1, t + dur);
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 520; bp.Q.value = 0.8;
      const am = ctx.createGain(); am.gain.value = 0.8;
      const lfo = ctx.createOscillator(); lfo.frequency.value = 26;
      const la = ctx.createGain(); la.gain.value = 0.25; lfo.connect(la).connect(am.gain);
      lfo.start(t); lfo.stop(t + dur + 0.05);
      node.connect(bp).connect(am).connect(g);
      node.start(t);
    }
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    g.connect(pan).connect(bus);
    node.stop(t + dur + 0.05);
  }

  const Zumbido = {
    get on() { return on; },
    async enable() {
      if (!ctx) {
        ctx = new (window.AudioContext || window.webkitAudioContext)();
        const master = ctx.createGain(); master.gain.value = 0.7;
        const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 4;
        bus = ctx.createGain(); bus.gain.value = 1;
        bus.connect(master).connect(comp).connect(ctx.destination);
        await loadSample();
        for (let i = 0; i < MAX_VOICES; i++) voices.push(makeVoice(i));
      }
      await ctx.resume();
      on = true;
      bus.gain.setTargetAtTime(1, ctx.currentTime, 0.2);
      clearInterval(wander); wander = setInterval(wanderTick, 120);
      applyCount(1.2);
    },
    disable() {
      on = false;
      if (!ctx) return;
      bus.gain.setTargetAtTime(0, ctx.currentTime, 0.15);
      clearInterval(wander);
    },
    /** colmenas vivas (0–100+) -> número de abejas audibles */
    setAlive(n, fade) {
      target = n <= 0 ? 0 : Math.max(1, Math.min(MAX_VOICES, Math.round((n / 100) * MAX_VOICES)));
      if (on) applyCount(fade);
    },
    /** una colmena muere dentro de `inSec` segundos */
    death(inSec) { if (on) glide(ctx.currentTime + inSec, rand(230, 270), rand(70, 95), rand(0.7, 1.1), 0.22); },
    /** una colmena es repuesta */
    birth(inSec) { if (on) glide(ctx.currentTime + inSec, rand(150, 170), rand(240, 270), 0.45, 0.12); },
  };
  window.Zumbido = Zumbido;
})();
