# BLACKSITE: VECTOR · Resumen de desarrollo

> Resumen vivo para retomar el trabajo sin releer las conversaciones. Se actualiza al terminar cada trabajo.
> **Última actualización:** 9 de noviembre de 2026 · **Versión publicada:** 5.20.0

## Enlaces

- Jugar: https://ossama450298-commits.github.io/BLACKSITEVECTOR/
- Descarga para PC: https://ossama450298-commits.github.io/BLACKSITEVECTOR/docs/download/
- Repositorio: `ossama450298-commits/BLACKSITEVECTOR` (público, GitHub Pages desde `main`)
- Email de informes: ossama450298@gmail.com

## Qué es

FPS táctico web original, inspirado en la sensación de Counter-Strike sin copiar nada protegido. Three.js r128. Dos equipos: **Vanguard** (policías, defienden) y **Raven** (terroristas, atacan). Bots con IA. Partidas a 30 rondas, primero a 16; 15-15 → ronda de desempate con $10000 mínimo. Sin cambio de lado.

## Mapas

| Mapa | Tipo | Modo |
|---|---|---|
| SECTOR-17 | Almacén industrial, crepúsculo | Bomba |
| HARBOR-9 | Puerto de contenedores, noche | Bomba |
| DUSTLINE | Pueblo del desierto, mediodía | Bomba |
| MERIDIAN | Planta de oficinas | Rescate de rehenes |

Rotación: sector17 → harbor9 → dustline → meridian.

## Reglas importantes

- **Modo bomba (v5.17.0):** eliminar a todos los policías NO da la victoria. Los terroristas deben plantar antes de que acabe el tiempo; si no, ganan los policías aunque estén muertos. Plantada y sin policías vivos → ganan los terroristas al momento.
- **Explosión (v5.9.0):** muerte segura a menos de 20 m (con o sin chaleco, aunque haya paredes); daño decreciente hasta 32 m. En los últimos 8 s los terroristas bots huyen a más de 30 m; los policías bots también si ya no les da tiempo a desactivar.
- **Turno de la bomba (v5.11.0):** se reparte entre todos los terroristas (jugador incluido) en turno barajado sin repetir hasta que la han llevado todos. Aviso al empezar la ronda.
- **Portador de la bomba (v5.19.0):** va directo a plantar disparando sin pararse (estado RUSH en `bot.js`, función `carrierGo`); el equipo sale con él. Planta en su punto o, si no lo alcanza en 2 s dentro del sitio, donde esté (un punto del sitio A de SECTOR-17 está elevado). Sigue siendo mortal.
- **Tienda por equipo (v5.5.0):** cada equipo solo ve lo que puede comprar.
- **Espectador (v5.7.0):** al morir se ve a todos los vivos, primero compañeros y luego enemigos.

## Armas actuales

| Categoría | Armas |
|---|---|
| Pistolas | Viper-9, Falcon-45, Warden .45 SD (Colt M1911, silenciador desmontable), Talon .44 (revólver DJMaesen) |
| Subfusiles | Specter-9 (DJMaesen), **Twin MAC-10** (user77, dos MAC-10) |
| Escopetas | Hammer-12 (corredera, $1900), **R870** (user77, más pesada y de más alcance, $2400) |
| Fusiles | ARX-17 (Raven), **AKM** (exclusivo Raven, user77), Halberd-4, **M16A2 SD** (exclusivo Vanguard, user77, silenciador), Kestrel-5, Bastion-60 |
| Precisión | Lynx-7 (DJMaesen original), **Titan-50** (L96A1 de user77, CC BY-NC; mata de un tiro, no sale de la mira) |
| Equipo | Chaleco, casco, kit de desactivación (Vanguard), escudo balístico (Vanguard), granadas: fragmentación, cegadora, humo |

Retiradas (v5.20.0, se veían peor por ir montadas sobre animaciones de otra arma): AK-12, MP5, Breaker-8 y BT SPR 300. Antes: Gauss M13 (arma especial futurista; el código del rayo y la perforación se conserva), Vector-MP (duplicaba al Specter-9), AK-47S, M4 SOPMOD, AK-484, AWM, DKS-501, AR-15.

## Personajes

| Equipo | Personajes |
|---|---|
| Vanguard | Operator (camuflaje azul), **SWAT** = FREE Military Soldier RIGGED de BAMEN (colores planos, azul marino, brazos a 49°), **Night Ops** = S.W.A.T. Operator de Mateusz Woliński |
| Raven | Operator (camuflaje tierra), Mercenario (SomeDude) |

Rehenes (MERIDIAN): Businessman (SPP) y oficinista (BELAZ). Stalker retirado (botas deformadas).

Plantar y desactivar (v5.12.0): postura nueva para todos (agachado, inclinado, manos con IK sobre la carga: teclear o trabajar los cables).

## Estructura del código (`/home/claude/bv/`)

- `game/` → el juego (lo que se publica). `js/`: config, game, bot, player, hud, main, realassets, charmodels, viewmodel, map, props, audio...
- `game/js/real_data.js` → todos los modelos incrustados en base64 (~25 MB). `char_thumbs.js` → retratos del selector.
- `lab/` → herramientas de laboratorio: `reskin.py`/`reskin.html` (transferir esqueleto; opciones `bind=1`, `arm=<rad>`, `skip=`), `bounds2.py`, `packparts*.py`, renders de prueba.
- `tools/` → compresión: `shrink_one.mjs` (meshopt + WebP), `recompress.mjs` (texturas por categoría), `slim.mjs` (simplificación + meshopt high).
- `test/` → pruebas automáticas: `single.py`, `simquick2.py`, `charsheet.py` (panel de personajes), `audit.py`, etc.
- `desktop/` → versión de escritorio con Neutralinojs.

## Sistemas clave

- **Armas animadas:** paquetes de DJMaesen/user77 (`fp_*` en `real_data.js`) con tramos de fotogramas (`clips` en `PACKS` de `realassets.js`).
- **`swapOnto(inner, model, cfg)`** monta cualquier arma sobre un paquete animado: `s` escala, `rot`/`rotZ`/`basis` giros, `src`→`dst` anclaje, `muzzle`, `rules` [regex, hueso], `split` (cortar una malla por zona, p. ej. el cargador), `tweak` (deformar una pieza).
- **Personajes:** todos comparten el esqueleto del soldado (Mixamo), transferido con `reskin`. Claves: modelos en T → `arm=0`; con brazos bajados → `bind=1` y ángulo de brazos (Night Ops 1.13, SWAT 0.85). Correcciones al cargar: `unmetal` (tela no metálica) y `fixHandWeights` (guantes).
- **Tinte policía:** azul marino oscuro (`policeBlueTex`, también para materiales sin textura).
- **Diagnóstico:** F9 con la tienda abierta graba 5 s y muestra un informe (sirvió para el parpadeo de la tienda).

## Cómo publicar

1. Cambiar `BV.VERSION` en `js/config.js` y añadir línea en `README.md`.
2. Generar el HTML de un solo archivo (`blacksite-vector.html`) y comprobar con `test/single.py`.
3. `git add -A && git commit` y `git push` a `main` con el token.
4. Esperar el build de GitHub Pages (API `pages/builds/latest`); si se atasca, relanzarlo con un POST a `pages/builds`.
5. Enviar email de informe con diseño de marca y capturas (preferencia del usuario).

**Repositorio pequeño:** el 6 nov 2026 se reinició el historial (pesaba 1,6 GB y Pages fallaba). Los **paquetes de escritorio solo se actualizan en cambios importantes o si el usuario lo pide**. Las Releases de GitHub no son accesibles desde el sandbox (uploads.github.com bloqueado).

**Token de GitHub:** está en los transcripts de `/mnt/transcripts`. Debe revocarse y nunca escribirse en el repositorio.

## Lecciones aprendidas

- **Preferir armas que vengan animadas con los brazos de DJMaesen (DJMaesen o user77)**: las montadas con `swapOnto` sobre la animación de otra arma nunca encajan del todo (manos, tamaño, acabado).

- Comprobar la orientación de un modelo con un **render lateral**, no deducirla de medidas (fallo del MP5).
- Probar los controles reales (ratón) y no solo llamadas internas (fallo del Gauss y del Titan-50).
- `classList.toggle(clase, undefined)` alterna la clase: siempre pasar un booleano (parpadeo de la tienda).
- En ediciones con Python, un comentario añadido a mitad de línea puede comentar el resto de la línea.
- Los modelos de Sketchfab envuelven las piezas en nodos `Object_N`: identificar piezas por su nombre completo.

## Pendientes

- Arma especial: fuera de momento (posible recuperar el Gauss o buscar otra).
- Stalker: retirado por deformación de botas.
- Paquetes de escritorio desactualizados desde la 5.15.0 (actualizar cuando el usuario lo pida).
- Revocar el token de GitHub.
