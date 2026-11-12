# La colmena que se apaga (IIC2026)

**Mensaje:** cada trimestre muere cerca de 1 de cada 7 colmenas en EE.UU. Sin apicultores que las repongan, de 100 colmenas en 2015 quedarían **3** en 2021. El zumbido sigue porque alguien lo sostiene; las abejas silvestres no tienen quién las reponga.

## Versiones

- **V1:** entrega inicial. Tag `v1`.
- **V2:** indicador de mayor amenaza trimestral sobre la curva y sombreado de reposición bajo la curva real. Tag `v2`.
- **V3:** mensaje primero. La intro se apaga sola (100 → 3 en ~4 s, sin clic) y termina en la frase; la vista principal abre con el titular, el panal ya apagado y la reposición a un clic. La animación lenta queda como “Ver cómo pasó”. Tag `v3`.
- **V4 (versión final):** solo el total de EE.UU. (se quitó el filtro por estado), indicador trimestral corregido, síntesis de la varroa, leyenda del sonido, celdas muertas con más contraste y botón “Reproducir 2015–2021”. Tag `v4`.

## Maqueta física (panal de cartón)

- **`vibra.html`** (teléfono dentro del panal): vibra y zumba con las colmenas vivas. Puede ir solo o seguir a otra pantalla con un código de 4 dígitos.
- **`maqueta.html`** (tablet sobre el hexágono de cartón): 100 celdas en forma de hexágono, con el mismo modelo y el mismo orden de muerte que la visualización.
  - *La tablet dirige*: reproduce 2015–2021 sin computador y muestra un código 📱; el teléfono lo escribe en “seguir al computador”.
  - *Seguir al computador*: escribe el código del 📱 del computador; apaga las mismas celdas que la pantalla.
  - *Calzar con el cartón*: tamaño y orientación del panal, guardados en la tablet.
- El enlace (`js/enlace.js`, PeerJS) manda `alive`, `death` y `birth`; un Arduino podría seguir el mismo protocolo.

Sitio: [njcampos1.github.io/colmena](https://njcampos1.github.io/colmena/) · Evaluación con usuarios sobre V3: [docs/thinking_aloud_v3.md](docs/thinking_aloud_v3.md) · Documento de entrega: [docs/entrega1.pdf](docs/entrega1.pdf)

1. Fuente: USDA NASS *Honey Bee Colonies*, trimestral por estado, 2015 T1–2021 T2 (vía TidyTuesday 2022-01-11).
