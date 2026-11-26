/* Enlace computador -> teléfono y tablet (PeerJS, WebRTC).
 *
 * El computador muestra un código de 4 dígitos; el teléfono (vibra.html) y la tablet (tablet.html)
 * lo escriben y se conectan.
 * El código queda guardado: al recargar se reabre solo y el teléfono se reconecta.
 * No se toca main.js: se envuelve Zumbido, que ya recibe todo lo que pasa en la visualización
 *   setAlive(n) -> fuerza del zumbido en el teléfono
 *   death(s)    -> golpe en el teléfono (muere una colmena)
 *   birth(s)    -> toques cortos (un apicultor la repone)
 * Además, con la tablet:
 *   computador -> tablet:  { k: 'state', t, mode, playing }  (main.js lo avisa con el evento colmena:estado)
 *   tablet -> computador:  { k: 'seek', t } · { k: 'mode', mode } · { k: 'play' }  (main.js las recibe como colmena:orden)
 * El teléfono ignora 'state'.
 * Debe cargarse después de js/zumbido.js y antes de js/main.js.
 */
(function () {
  const Z = window.Zumbido;
  let peer = null, conns = [], last = 100, state = null;

  const send = msg => conns.forEach(c => c.open && c.send(msg));
  const { setAlive, death, birth } = Z;
  Z.setAlive = (n, fade) => { last = n; send({ k: 'alive', v: n }); return setAlive.call(Z, n, fade); };
  Z.death = s => { send({ k: 'death', at: s || 0 }); return death.call(Z, s); };
  Z.birth = s => { send({ k: 'birth', at: s || 0 }); return birth.call(Z, s); };
  document.addEventListener('colmena:estado', ev => { state = { k: 'state', ...ev.detail }; send(state); });

  // arriba a la derecha, discreto: "📱 9750 ●". El detalle aparece solo al hacer clic.
  function addUi() {
    const bar = document.querySelector('.bar');
    if (!bar) return;
    const box = document.createElement('div');
    box.className = 'enlace';
    box.innerHTML = `<button class="enlace-btn" id="btn-phone" aria-expanded="false" title="Teléfono del panal">📱<span class="enlace-code"></span><i class="enlace-dot"></i></button>
      <div class="enlace-pop" id="phone-info" hidden></div>`;
    bar.appendChild(box);
    const btn = box.querySelector('.enlace-btn'), info = box.querySelector('.enlace-pop');
    const toggle = open => { info.hidden = !open; btn.setAttribute('aria-expanded', open); };
    document.addEventListener('click', ev => { if (!box.contains(ev.target)) toggle(false); });
    document.addEventListener('keydown', ev => { if (ev.key === 'Escape') toggle(false); });

    // estado: espera (ámbar) · ok (lleno) · error (rojo)
    const show = (html, state = 'espera') => { info.innerHTML = html; box.dataset.state = state; };

    // el código se guarda: al recargar la página se reabre el mismo y el teléfono se reconecta solo
    const KEY = 'colmena-panal-codigo';
    const saved = (() => { try { return localStorage.getItem(KEY); } catch (e) { return null; } })();
    function open(code) {
      if (!window.Peer) { show('No se pudo cargar PeerJS (¿sin internet?).', 'error'); return; }
      try { localStorage.setItem(KEY, code); } catch (e) {}
      box.querySelector('.enlace-code').textContent = code;
      const url = `${location.origin}${location.pathname.replace(/[^/]*$/, '')}vibra.html`;
      const base = `${location.origin}${location.pathname.replace(/[^/]*$/, '')}`;
      const howTo = `En el teléfono abre <b>${url}</b> y en la tablet <b>${base}tablet.html</b>; escribe <b class="enlace-num">${code}</b> y toca “Conectar”.`;
      const estado = () => {
        const nT = conns.filter(c => c.metadata?.rol === 'tablet').length, nP = conns.length - nT;
        return [nP && `Teléfono conectado: vibra con lo que muestra la pantalla.`, nT && `Tablet conectada: su deslizador mueve esta pantalla.`]
          .filter(Boolean).join('<br>');
      };
      peer = new Peer('colmena-panal-' + code);
      show('Conectando…');
      peer.on('open', () => show(`Esperando al teléfono.<br>${howTo}`));
      peer.on('connection', c => {
        const quien = c.metadata?.rol === 'tablet' ? 'tablet' : 'teléfono';
        show(`Un${quien === 'tablet' ? 'a' : ''} ${quien} se está conectando…`);
        setTimeout(() => {
          if (!c.open) show(`El teléfono encontró este computador, pero la red bloquea la conexión directa. Pongan ambos en el mismo wifi o en el hotspot del teléfono.`, 'error');
        }, 12000);
        c.on('open', () => {
          conns.push(c);
          c.send({ k: 'alive', v: last });
          if (state) c.send(state);
          show(estado(), 'ok');
        });
        c.on('data', msg => {
          if (msg && (msg.k === 'seek' || msg.k === 'mode' || msg.k === 'play' || msg.k === 'estado'))
            document.dispatchEvent(new CustomEvent('colmena:orden', { detail: msg }));
        });
        c.on('close', () => {
          conns = conns.filter(x => x !== c);
          if (!conns.length) show(`Se desconectaron. El código sigue abierto.<br>${howTo}`);
          else show(estado(), 'ok');
        });
      });
      peer.on('disconnected', () => { if (!peer.destroyed) peer.reconnect(); });
      peer.on('error', e => {
        if (e.type === 'unavailable-id') {          // recién recargada: el servidor aún no suelta el código anterior
          show(`Recuperando el código…`);
          peer.destroy(); setTimeout(() => open(code), 2000);
          return;
        }
        show(`No se pudo enlazar (${e.type}). Prueben con el computador y el teléfono en la misma red, por ejemplo el hotspot del teléfono.`, 'error');
      });
    }
    btn.addEventListener('click', () => {
      if (!peer) open(String(Math.floor(1000 + Math.random() * 9000)));
      toggle(info.hidden);
    });
    if (saved) open(saved);
  }
  addUi();
})();
