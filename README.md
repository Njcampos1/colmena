# La colmena que se apaga (IIC2026)

**Mensaje:** cada trimestre muere cerca de 1 de cada 7 colmenas en EE.UU. Sin apicultores que las repongan, de 100 colmenas en 2015 quedarían **3** en 2021. El zumbido sigue porque alguien lo sostiene; las abejas silvestres no tienen quién las reponga.

## Versiones

- **V1:** entrega inicial. Tag `v1`.
- **V2:** indicador de mayor amenaza trimestral sobre la curva y sombreado de reposición bajo la curva real. Tag `v2`.
- **V3:** mensaje primero. La intro se apaga sola (100 → 3 en ~4 s, sin clic) y termina en la frase; la vista principal abre con el titular, el panal ya apagado y la reposición a un clic. La animación lenta queda como “Ver cómo pasó”. Tag `v3`.
- **V4 (versión final):** solo el total de EE.UU. (se quitó el filtro por estado), indicador trimestral corregido, síntesis de la varroa, leyenda del sonido, celdas muertas con más contraste y botón “Reproducir 2015–2021”. Tag `v4`.

## Entrega 2: el panal físico

- **E2 V1:** una caja de cartón cuadrada con un teléfono dentro que vibra y zumba con las colmenas vivas (`vibra.html`). Tag `e2-v1`.
- **E2 V2:** una tablet con el panal de 100 celdas en forma de hexágono, que dirige o sigue al computador (`maqueta.html`). Tag `e2-v2`.
- **E2 V3:** la caja pasa a ser un hexágono de cartón, con un Arduino que refuerza la vibración junto al teléfono. Cambio físico: el código es el mismo de V2. Tag `e2-v3`.
- **E2 V4 (versión final):** la tablet controla la visualización con un deslizador, a pantalla completa y con zumbido propio (`tablet.html`). Tag `e2-v4`.

## Maqueta física (panal de cartón)

- **`vibra.html`** (teléfono dentro del panal): vibra y zumba con las colmenas vivas. Puede ir solo o seguir a otra pantalla con un código de 4 dígitos.
- **`maqueta.html`** (tablet sobre el hexágono de cartón): 100 celdas en forma de hexágono, con el mismo modelo y el mismo orden de muerte que la visualización.
  - *La tablet dirige*: reproduce 2015–2021 sin computador y muestra un código 📱; el teléfono lo escribe en “seguir al computador”.
  - *Seguir al computador*: escribe el código del 📱 del computador; apaga las mismas celdas que la pantalla.
  - *Calzar con el cartón*: tamaño y orientación del panal, guardados en la tablet.
- **`tablet.html`** (control): se conecta con el código 📱 del computador; el deslizador mueve el tiempo de la visualización y el panal vibra con cada colmena que muere. Zumbido opcional por el parlante de la tablet.
- El enlace (`js/enlace.js`, PeerJS) manda `alive`, `death` y `birth`; un Arduino podría seguir el mismo protocolo.

Sitio: [njcampos1.github.io/colmena](https://njcampos1.github.io/colmena/) · Evaluación con usuarios sobre V3: [docs/thinking_aloud_v3.md](docs/thinking_aloud_v3.md) · Documento de entrega: [docs/entrega1.pdf](docs/entrega1.pdf)

1. Fuente: USDA NASS *Honey Bee Colonies*, trimestral por estado, 2015 T1–2021 T2 (vía TidyTuesday 2022-01-11).
