# BLACKSITE: VECTOR

Shooter táctico en primera persona por rondas que se juega directamente en el navegador. Está inspirado en la *sensación* de los FPS tácticos de PC de finales de los 90 y principios de los 2000 (modelos low-poly, iluminación precalculada, armas hitscan con retroceso real, economía y una vida por ronda), pero con un universo, un mapa, un arsenal y un aspecto **completamente originales**.

Dos fuerzas privadas ficticias se enfrentan en **SECTOR-17**, un recinto ferroviario abandonado a las afueras de una ciudad portuaria:

- **RAVEN** — ataca. Lleva la *Vector Charge* y debe armarla en el sitio A o en el sitio B.
- **VANGUARD** — defiende. Debe impedirlo, eliminar a los atacantes o desactivar la carga.

> Todos los modelos, texturas, sonidos y la música se generan por código en tiempo de ejecución. El proyecto no contiene ningún asset de otros juegos.

## Cómo jugar

**Online:** https://ossama450298-commits.github.io/BLACKSITEVECTOR/

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
| Esc | Menú de pausa | F | Inspeccionar arma |

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
- **Gráficos (v1.1)**: iluminación de atardecer con sombras suaves en tiempo real, materiales PBR con mapas de normales generados por código, reflejos por *image-based lighting*, tone mapping ACES con gestión de color sRGB y antialiasing. Soldados con extremidades redondeadas, camuflaje texturizado, cascos, capuchas, chalecos y equipo; armas modeladas con perfiles biselados y metal desgastado; coches, sacos terreros y charcos reflectantes.
- **Postprocesado (v1.2)**: cadena propia sin librerías extra — render MSAA en HDR, *bloom* a dos escalas, gradación de color con sombras frías y luces cálidas, aberración cromática sutil, viñeta y grano de película.
- **Escenario (v1.2)**: horizonte industrial con ventanas iluminadas y grúas portuarias, cornisas, zócalos, marcos y alféizares de ventana, bajantes, equipos de azotea y depósitos de agua, cables colgantes, barandillas, hierba seca y gravilla instanciadas, tragaluces con haces de luz volumétricos en la nave B y polvo en suspensión. Los disparos y explosiones iluminan el entorno.
- **Armas y animaciones (v1.8)**: nuevas mallas de armas basadas en el Ultimate Guns Pack de Quaternius (CC0), con nuestros materiales de metal, polímero y madera, desgaste en los bordes y el cargador como pieza aparte, para que se vea salir y entrar en la recarga. Los soldados sujetan los fusiles con las dos manos gracias a una IK de dos huesos que lleva la mano izquierda al guardamanos, y la pistola a dos manos. Además, retroceden en cada disparo y su recarga se ve: la mano va al cinturón y el arma se inclina.
- **Operadores animados (v1.7)**: los soldados usan una malla con esqueleto real y animaciones (apuntado, carrera, disparo, impacto y muerte) basadas en el modelo «Swat» de Quaternius (CC0), con un mezclador de animaciones según velocidad y estado. Encima van capas procedurales: agachado, inclinación al apuntar y torso al esprintar. Cada equipo tiene su propio aspecto: Vanguard con casco y visor, y Raven con pasamontañas, capucha y gafas. Llevan equipo propio en el pecho (portacargadores, radio, correaje) y el arma sigue la mano mientras apunta hacia donde mira el soldado. Créditos en [CREDITS.md](CREDITS.md).
- **Soldados anatómicos (v1.6)**: cuerpos low-poly modelados como volúmenes de revolución con perfil muscular (muslo, gemelo, deltoides, antebrazo), torso que se estrecha del pecho a la cintura, cabeza con mandíbula, nariz y orejas, y equipo con esquinas redondeadas (chaleco, portacargadores, funda, botas con cordones). Pieles pintadas al estilo de los modelos de jugador de los 2000: pliegues, costuras, bolsillos, cintas MOLLE y caras con rasgos.
- **Acabado de mapa clásico (v1.5)**: texturas diseñadas en lugar de ruido (chapa lagrimada, zócalo pintado con desconchones y rozaduras, líneas viales, bordes de sitio, tapas de alcantarilla, rejillas de desagüe), desfase de UV por caja para que no se note la repetición, manchas de suelo instanciadas, zócalos pintados en oficinas y nave B, marcos de acero en todas las puertas, postes con franjas de peligro, marcas viales en North Street y plazas en la zona de spawn, e interiores más luminosos para mejorar la visibilidad.
- **Estilo Clásico (v1.4, predeterminado)**: aspecto de shooter de PC de principios de los 2000 al estilo GoldSrc. Iluminación horneada tipo *lightmap* en los vértices, con sombras del sol calculadas por raycast, oclusión de contacto y lámparas. Sombreado Lambert/Gouraud sin PBR, texturas pintadas de 128 px con paleta apagada, modelos low-poly angulares, sin postprocesado y con niebla lineal. Los modelos toman la luz del suelo que pisan (sol o sombra). HUD de numerales ámbar translúcidos y menú de paneles planos. El estilo **Moderno** (PBR, sombras en tiempo real, bloom) sigue disponible en *Settings → Graphics → Visual style*.
- **Remasterización (v1.3)**:
  - *Armas*: kit mecánico en todas (pasadores, tornillos, selector con marcas, ventana de expulsión con cerrojo visible, palanca de carga, base y nervios del cargador, cantonera de goma, linterna táctica). Materiales por pieza —acero pavonado, acero gastado, aluminio, polímero punteado, goma, madera, latón— con **desgaste de bordes** real (atributo por vértice + parche de shader), suciedad y rugosidad con arañazos.
  - *Texturas*: hasta 512 px con capas de desgaste por material (grietas, humedad, óxido, pintura desconchada, aceite, marcas de neumático, nudos, rodadas) y mapas de rugosidad.
  - *Luz y sombras*: luces puntuales reales en interiores (4/8/12 según calidad), niebla de altura, mapa de sombras que sigue a la cámara con ajuste a texel.
  - *Escenario*: cientos de objetos instanciados (palés, armarios eléctricos con LEDs, rejillas, tuberías, bandeja de cables, conos, neumáticos, bidones, extintores, bombonas, basura, escombros, carteles y números estarcidos, manchas de suciedad).
  - *Primera persona*: animación por muelles (peso, balanceo en ocho, respiración, inercia, inclinación lateral, aterrizaje), recargas coreografiadas, bombeo de escopeta e inspección (**F**).
  - *Disparos e impactos*: fogonazo volumétrico distinto por arma, humo, luz dinámica; impactos por material (chispas, astillas, polvo, fragmentos) con marcas propias; casquillos físicos que rebotan y suenan.
  - *Personajes*: más equipo, reacción a impactos, postura de sprint, recarga, tres variantes de muerte.
  - *Cámara, mira e interfaz*: balanceo, hundimiento al aterrizar, inclinación lateral, retroceso; retículas propias con lente y animación; HUD translúcido y menú animado; nivel de calidad **ULTRA**.
- **Efectos**: fogonazo, trazadoras, chispas, humo, agujeros de bala, casquillos, sangre estilizada, explosiones con onda de choque y destello de daño en pantalla.

## IA de los bots

- **Percepción** a 10 Hz: cono de visión y alcance por dificultad, línea de visión a cabeza y pecho, oído (disparos, pasos, aterrizajes, balas que pasan cerca) y reacción al recibir daño.
- **Navegación**: A* sobre un grafo de 99 waypoints conectado automáticamente con pruebas de visibilidad, atajos cuando el siguiente nodo es visible, separación entre compañeros y recuperación cuando se atascan.
- **Combate**: tiempo de reacción, error de apuntado, ráfagas, strafe, agacharse a larga distancia, contra-strafe en HARD, recarga y cambio de arma, granadas a la última posición conocida.
- **Táctica**: los atacantes eligen sitio y ruta, se agrupan en un punto de reunión y entran juntos; el portador planta y el resto cubre. Los defensores se reparten entre A, B y Mid, mantienen ángulos, rotan cuando un compañero ve enemigos en un sitio y van a desactivar la carga cuando se arma.
- **Compras** según su dinero y equipo.

## Rendimiento

- Geometría estática fusionada por material; oclusión ambiental y lámparas horneadas en colores de vértice, con una única luz dinámica (el sol) que proyecta sombras.
- Las piezas de cada soldado y de cada arma se fusionan por material para reducir las llamadas de dibujo; todas las lámparas se dibujan en una sola llamada.
- Calidad Low desactiva sombras y postprocesado; Medium usa un mapa de sombras de 2048 px y High de 4096 px.
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
js/charmodels.js    Operadores con esqueleto y animaciones (mezclador, capas procedurales)
js/char_data.js     Modelo del operador embebido (CC0, Quaternius)
js/gun_data.js      Mallas de armas convertidas (CC0, Quaternius)
js/lib/GLTFLoader.js, js/lib/SkeletonUtils.js  Cargador glTF y clonado de esqueletos (Three.js, MIT)
js/models.js        Soldados y armas (perfiles biselados, kit mecánico, desgaste de bordes)
js/props.js         Atrezo industrial instanciado
js/effects.js       Partículas, trazadoras, decals y explosiones
js/combatant.js     Estado compartido de jugador y bots
js/bot.js           IA por estados
js/game.js          Rondas, objetivo, combate, economía
js/viewmodel.js     Arma en primera persona y animaciones
js/input.js         Teclado, ratón y pointer lock
js/player.js        Control del jugador y espectador
js/hud.js           HUD, radar, marcador y menú de compra
js/menu.js          Menú principal, ajustes y pausa
js/postfx.js        Postprocesado: bloom, gradación de color, viñeta y grano
js/main.js          Renderizador, bucle principal y estados de la interfaz
```

## Licencia

Código del juego bajo licencia MIT. Three.js © sus autores, licencia MIT.
