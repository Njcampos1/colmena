/* Enlace computador -> teléfono (PeerJS, WebRTC).
 *
 * El computador muestra un código de 4 dígitos; el teléfono (vibra.html) lo escribe y se conecta.
 * El código queda guardado: al recargar se reabre solo y el teléfono se reconecta.
 * No se toca main.js: se envuelve Zumbido, que ya recibe todo lo que pasa en la visualización
 *   setAlive(n) -> fuerza del zumbido en el teléfono
 *   death(s)    -> golpe en el teléfono (muere una colmena)
 *   birth(s)    -> toques cortos (un apicultor la repone)
 * Debe cargarse después de js/zumbido.js y antes de js/main.js.
 */
(function () {
  const Z = window.Zumbido;
  let peer = null, conns = [], last = 100;

  const send = msg => conns.forEach(c => c.open && c.send(msg));
  const { setAlive, death, birth } = Z;
  Z.setAlive = (n, fade) => { last = n; send({ k: 'alive', v: n }); return setAlive.call(Z, n, fade); };
  Z.death = s => { send({ k: 'death', at: s || 0 }); return death.call(Z, s); };
  Z.birth = s => { send({ k: 'birth', at: s || 0 }); return birth.call(Z, s); };

  function addUi() {
    const actions = document.querySelector('.actions');
    if (!actions) return;
    const btn = document.createElement('button');
    btn.className = 'btn ghost'; btn.id = 'btn-phone'; btn.title = 'Conectar el teléfono del panal';
    btn.textContent = '📱';
    actions.appendChild(btn);
    const info = document.createElement('p');
    info.className = 'nota'; info.id = 'phone-info'; info.hidden = true;
    actions.after(info);

    const show = html => { info.hidden = false; info.innerHTML = html; };

    // el código se guarda: al recargar la página se reabre el mismo y el teléfono se reconecta solo
    const KEY = 'colmena-panal-codigo';
    const saved = (() => { try { return localStorage.getItem(KEY); } catch (e) { return null; } })();
    function open(code) {
      if (!window.Peer) { show('No se pudo cargar PeerJS (¿sin internet?).'); return; }
      try { localStorage.setItem(KEY, code); } catch (e) {}
      peer = new Peer('colmena-panal-' + code);
      show('Conectando…');
      peer.on('open', () => show(`📱 En el teléfono abre <b>${location.origin}${location.pathname.replace(/[^/]*$/, '')}vibra.html</b>, elige “Seguir al computador” y escribe <b style="color:var(--honey)">${code}</b>.`));
      peer.on('connection', c => {
        c.on('open', () => {
          conns.push(c);
          c.send({ k: 'alive', v: last });
          show(`📱 Teléfono conectado (código ${code}). Vibra con lo que muestra la pantalla.`);
        });
        c.on('close', () => {
          conns = conns.filter(x => x !== c);
          show(conns.length ? info.innerHTML : `📱 Teléfono desconectado. Código <b style="color:var(--honey)">${code}</b> sigue abierto.`);
        });
      });
      peer.on('disconnected', () => { if (!peer.destroyed) peer.reconnect(); });
      peer.on('error', e => {
        if (e.type === 'unavailable-id') {          // recién recargada: el servidor aún no suelta el código anterior
          show(`Recuperando el código <b style="color:var(--honey)">${code}</b>…`);
          peer.destroy(); setTimeout(() => open(code), 2000);
          return;
        }
        show(`No se pudo enlazar (${e.type}). Prueben con el computador y el teléfono en la misma red, por ejemplo el hotspot del teléfono.`);
      });
    }
    btn.addEventListener('click', () => {
      if (peer) { show(info.innerHTML); return; }
      open(String(Math.floor(1000 + Math.random() * 9000)));
    });
    if (saved) open(saved);
  }
  addUi();
})();
