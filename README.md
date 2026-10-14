# BLACKSITE: VECTOR

Shooter táctico en primera persona por rondas que se juega directamente en el navegador. Está inspirado en la *sensación* de los FPS tácticos de PC de finales de los 90 y principios de los 2000 (modelos low-poly, iluminación precalculada, armas hitscan con retroceso real, economía y una vida por ronda), pero con un universo, un mapa, un arsenal y un aspecto **completamente originales**.

Dos fuerzas privadas ficticias se enfrentan en **SECTOR-17**, un recinto ferroviario abandonado a las afueras de una ciudad portuaria:

- **RAVEN** — ataca. Lleva la *Vector Charge* y debe armarla en el sitio A o en el sitio B.
- **VANGUARD** — defiende. Debe impedirlo, eliminar a los atacantes o desactivar la carga.

> Todos los modelos, texturas, sonidos y la música se generan por código en tiempo de ejecución. El proyecto no contiene ningún asset de otros juegos.

## Cómo jugar

**Online:** abre la URL de GitHub Pages del repositorio.

**En local:** descarga el repositorio y abre `index.html` en Chrome, Edge o Firefox. También puedes servir la carpeta con cualquier servidor estático:

```bash
python -m http.server 8000
# y abre http://localhost:8000
```

Three.js va incluido en `js/lib/`, así que el juego funciona sin conexión (solo las fuentes tipográficas se cargan desde Google Fonts y tienen alternativa local).

## Controles

| Tecla | Acción | Tecla | Acción |
|---|---|---|---|
| W A S D | Moverse | Shift | Correr |
| Ctrl / C | Agacharse | Espacio | Saltar |
| Ratón | Mirar | Clic izquierdo | Disparar |
| Clic derecho | Mira (Kestrel-5, Lynx-7) | R | Recargar |
| 1 2 3 4 / rueda / Q | Cambiar arma / arma anterior | E (mantener) | Armar / desactivar la carga |
| B | Menú de compra | Tab | Marcador |
| Esc | Menú de pausa | | |

## Características

- **Modo Operación / Asalto** por rondas: fase de compra, 1:55 de ronda, 40 s de cuenta atrás con la carga armada. La ronda termina al completar el objetivo, al eliminar a un equipo o al agotarse el tiempo. Marcador, pantalla de victoria/derrota, reinicio automático y **cambio de lado en el descanso**.
- **Economía**: dinero por victoria, derrota (con racha), bajas y plante; menú de compra en la zona de spawn.
- **Modo Training**: campo de tiro con objetivos que reaparecen, munición infinita y estadísticas de precisión.
- **Mapa SECTOR-17** (124 × 88 m): plaza de Raven, North Street, dos callejones, Mid, Market, túnel sur, patio A con plataforma elevada, nave B cubierta y puerta de Vanguard. Rutas largas y cortas a cada sitio, combates a corta y media distancia, coberturas y puntos de emboscada.
- **Arsenal original**: Blade-X, Viper-9, Falcon .45, Specter-9, Vector-MP, Hammer-12, ARX-17, Halberd-4, Kestrel-5, Lynx-7, granada Shard-G y armadura.
- **Mecánicas FPS**: aceleración clásica en suelo y control en el aire, sprint, agacharse (con comprobación de techo), salto, subida de escalones, colisiones AABB, headshots, daño por zonas, caída del daño con la distancia, penetración de armadura, retroceso acumulativo y dispersión según movimiento, salto, agachado y ráfaga.
- **IA por estados** — IDLE, PATROL, SEARCH, ATTACK, DEFEND, RETREAT, OBJECTIVE, DEAD — con tres dificultades (EASY, NORMAL, HARD).
- **HUD**: vida, armadura, dinero, munición, arma, ranuras, temporizador, rondas, jugadores vivos, objetivo, radar giratorio, killfeed, hitmarkers, indicador de dirección del daño, barra de plante/desactivación, mira con dispersión dinámica y mira telescópica.
- **Sonido procedural** (Web Audio): disparos distintos por arma con eco a distancia, recargas, pasos, impactos, explosiones, pitidos de la carga, ambiente, interfaz y música del menú.
- **Efectos**: fogonazo, trazadoras, chispas, humo, agujeros de bala, casquillos, sangre estilizada, explosiones con onda de choque y destello de daño en pantalla.

## IA de los bots

- **Percepción** a 10 Hz: cono de visión y alcance por dificultad, línea de visión a cabeza y pecho, oído (disparos, pasos, aterrizajes, balas que pasan cerca) y reacción al recibir daño.
- **Navegación**: A* sobre un grafo de 99 waypoints conectado automáticamente con pruebas de visibilidad, atajos cuando el siguiente nodo es visible, separación entre compañeros y recuperación cuando se atascan.
- **Combate**: tiempo de reacción, error de apuntado, ráfagas, strafe, agacharse a larga distancia, contra-strafe en HARD, recarga y cambio de arma, granadas a la última posición conocida.
- **Táctica**: los atacantes eligen sitio y ruta, se agrupan en un punto de reunión y entran juntos; el portador planta y el resto cubre. Los defensores se reparten entre A, B y Mid, mantienen ángulos, rotan cuando un compañero ve enemigos en un sitio y van a desactivar la carga cuando se arma.
- **Compras** según su dinero y equipo.

## Rendimiento

- Geometría estática fusionada por material (~45 draw calls en total) con iluminación horneada en colores de vértice: no hay luces dinámicas en el mundo.
- Texturas procedurales de 128 px, partículas en *pools* preasignados, decals reciclados.
- Percepción de la IA escalonada, rechazo rápido en el trazado de balas y sub-pasos de física solo cuando baja el framerate.
- Calidad de render (Low / Medium / High), niebla y distancia de dibujado ajustables; contador de FPS opcional en *Settings → Graphics*.

## Tecnologías

HTML5, CSS3, JavaScript (sin bundler ni dependencias de compilación), WebGL mediante [Three.js r128](https://threejs.org) (licencia MIT) y Web Audio API.

## Estructura del proyecto

```
index.html          Estructura del HUD y los menús, carga de scripts
css/style.css       Estilos de interfaz
assets/favicon.svg  Icono
js/lib/three.min.js Three.js r128
js/config.js        Equipos, armas, dificultades, economía y ajustes
js/util.js          Utilidades matemáticas
js/audio.js         Síntesis de sonido y música
js/textures.js      Texturas procedurales en canvas
js/physics.js       Colisiones AABB, movimiento y raycasts
js/map.js           SECTOR-17: geometría, iluminación horneada, waypoints y A*
js/models.js        Soldados y armas low-poly
js/effects.js       Partículas, trazadoras, decals y explosiones
js/combatant.js     Estado compartido de jugador y bots
js/bot.js           IA por estados
js/game.js          Rondas, objetivo, combate, economía
js/viewmodel.js     Arma en primera persona y animaciones
js/input.js         Teclado, ratón y pointer lock
js/player.js        Control del jugador y espectador
js/hud.js           HUD, radar, marcador y menú de compra
js/menu.js          Menú principal, ajustes y pausa
js/main.js          Renderizador, bucle principal y estados de la interfaz
```

## Licencia

Código del juego bajo licencia MIT. Three.js © sus autores, licencia MIT.
