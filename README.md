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
- **Elige tu personaje (v4.5.0)**: en Start Game, la fila Operator muestra los personajes del equipo elegido con su retrato; tu soldado usa el elegido. Nueva vista en tercera persona (tecla V), con la cámara sobre el hombro que se acerca si hay una pared detrás. Corregido el fallo de las piernas al andar: la transferencia de pesos solo toma huesos del mismo lado del cuerpo y las botas siguen rígidas al pie. El «stalker» queda retirado hasta que su calzado deforme bien.
- **La carga en la mano (v4.4.0)**: la carga es seleccionable en la ranura 5 (tecla 5 o rueda), se lleva en las dos manos en primera persona y en las manos del personaje en tercera; se planta manteniendo el clic izquierdo (o E) dentro del sitio y G la suelta. Plante más tolerante: admite algo de movimiento y un instante sin contacto con el suelo.
- **Variedad de personajes (v4.3.0)**: Vanguard alterna el operador azul y un SWAT; Raven alterna el operador, un mercenario y un «stalker» con máscara de gas. Los personajes nuevos (CC BY) se han pasado al esqueleto del operador por transferencia de pesos (el operador se coloca en la postura de cada personaje y cada vértice toma los huesos de los 4 puntos más cercanos), así que comparten todas las animaciones, el agarre del arma y la animación de arrodillarse.
- **Manos realistas al plantar y desactivar (v4.2.0)**: en primera persona se usan los brazos de DJMaesen (sin arma) posados en tiempo real: cinemática inversa de dos segmentos para cada brazo (codo hacia fuera y abajo), giro y flexión de muñeca para que las palmas miren a la bomba, y dedos doblados por articulaciones (la izquierda agarra la bomba, la derecha pulsa el teclado con el índice, tecla a tecla).
- **Plantar y desactivar animados (v4.1.0)**: en tercera persona, el soldado se arrodilla y trabaja con las manos en el suelo (animación «Dig And Plant Seeds» de Mixamo, readaptada al esqueleto del operador en el espacio del mundo); el arma se oculta y la cinemática inversa de las manos se atenúa. En primera persona, el arma baja y aparece la bomba en las manos: al plantar se teclea el código; al desactivar, la bomba está en el suelo y las manos trabajan sobre ella.
- **VERSIÓN 4.0 — tres mapas (v4.0.0)**: nuevo mapa DUSTLINE, un pueblo del desierto a mediodía (calle principal con arcos, callejones entre casas de adobe, sitio A en el mercado, sitio B en un puesto militar; suelo Ground054 de ambientCG, muros con «Sand 01» de Poly Haven y cielo «Goegap», todo CC0). Con SECTOR-17 y HARBOR-9 el juego tiene tres mapas, que se eligen en Start Game → Map.
- **Bomba de relojería (v3.12.3)**: la carga usa el modelo «Time bomb» de Shailesh gowda (CC BY): cartuchos de dinamita bajo una placa con teclado, baterías y temporizador; su pantalla muestra la cuenta atrás real y sus LED parpadean con cada pitido.
- **Carga detallada (v3.12.2)**: la carga de demolición tiene cuatro bloques con envoltorio impreso, cinta americana, unidad de control con teclado, pantalla LCD con la cuenta atrás real, LED que parpadea con cada pitido, cables de colores, detonadores y antena.
- **HARBOR-9 (v3.12.0)**: segundo mapa, un puerto de contenedores de noche (muelle con dos grúas pórtico, patio de contenedores a uno y dos niveles, almacén como sitio B, agua animada, cielo «Blue Lagoon Night» de Poly Haven, CC0). Selector de mapa en el menú de partida (cambiar recarga el juego con el mapa elegido). Rutas de los bots generadas en cuadrícula.
- **Bastion-60 y Muy fácil (v3.11.0)**: nueva ametralladora ligera Bastion-60 (cajas de 100, unos 800 disparos/min, recarga abriendo la tapa; brazos y animaciones de «lmg animated», DJMaesen, CC BY; los bots también la compran). Nueva dificultad Muy fácil: los bots tardan en reaccionar, fallan mucho, no apuntan a la cabeza, apenas se mueven y hacen un 40 % menos de daño.
- **Icono de la carga (v3.10.3)**: como en Counter-Strike, al llevar la carga aparece su icono a la izquierda, encima del dinero; dentro de un sitio de plante parpadea en verde e indica «IN SITE A/B».
- **Plantar más claro (v3.10.2)**: jugando con Raven, el jugador lleva siempre la carga. Al pulsar E sin poder plantar, un aviso explica por qué (quién lleva la carga, fuera del sitio, en movimiento o en la preparación de la ronda).
- **Cuchillo animado (v3.10.1)**: la Blade-X usa los brazos y el cuchillo animados de DJMaesen (CC BY), colocados en el espacio de la vista; alterna tres cortes distintos.
- **Juego más ligero (v3.10.0)**: los modelos incrustados se guardan comprimidos con meshoptimizer y texturas WebP (27,4 MB → 11,1 MB); al cargarlos, la geometría se convierte de nuevo a números reales para que todo funcione igual. El HTML único pasa de 40,5 MB a 17,4 MB y la versión de escritorio de 22 MB a 11 MB. Se elimina la G19, que ya no usaba ninguna arma.
- **Armas animadas en estilo 2000 (v3.9.1)**: las armas y brazos animados también se usan en el estilo Clásico, con texturas de 128 px posterizadas sobre materiales Lambert para mantener el aspecto retro.
- **Todas las armas animadas (v3.9.0)**: las pistolas, subfusiles, escopeta, carabinas y francotirador usan brazos y armas con animaciones hechas a mano (DJMaesen, CC BY): desenfundar, reposo, disparo, recarga y recarga en vacío. Sistema genérico: cada paquete se escala desde su geometría, la empuñadura y la boca del cañón se miden automáticamente y cada arma tiene su tabla de tramos.
- **Recarga animada (v3.8.0)**: la ARX-17 en primera persona usa brazos y un AK74 con animaciones hechas a mano (fps AK animated, DJMaesen, CC BY): desenfundar, reposo, disparo, recarga y recarga en vacío con tirón de cerrojo. La línea de tiempo original se ha cortado en acciones midiendo el cerrojo y el cargador, y la recarga se ajusta a la duración del juego.
- **Agarre de fusiles (v3.7.1)**: en primera persona, la mano derecha rodea la empuñadura y se ve en pantalla, la izquierda va bajo el guardamanos por delante del cargador (en la escopeta, en el corredero) y los fusiles quedan algo más alejados.
- **Armas en el suelo (v3.7.0)**: al morir, cada soldado suelta su arma principal (o una pistola que no sea la básica) con la munición que le quedaba. Si tienes esa ranura vacía, la recoges pasando por encima; si no, **E** la cambia por la tuya, y **G** suelta el arma en la mano. Los bots también recogen armas. Se limpian al empezar cada ronda.
- **Vanguard de azul policía (v3.6.5)**: los guardias de Vanguard llevan chaqueta, pantalón y casco en azul policía (se conserva la luminosidad y el detalle de la tela), en el estilo moderno y en el de los 2000, también en las mangas en primera persona.
- **Granada realista (v3.6.4)**: la Shard-G es una granada de fragmentación CC0 con la anilla como pieza aparte: al lanzarla se quita la anilla y la granada vuela girando sobre sí misma.
- **Makarov (v3.6.3)**: la Viper-9 y la Falcon .45 usan una Makarov realista CC0 con sus piezas separadas: la corredera retrocede en cada disparo y queda abierta durante la recarga, y el cargador sale de la empuñadura.
- **Recarga y retroceso (v3.6.2)**: las armas realistas tienen el cargador como pieza separada (cortado de su geometría con una caja calibrada por arma), así que la recarga lo saca, la mano va al chaleco y vuelve con uno nuevo. Al recargar, el arma gira para mostrar su lateral. El retroceso combina muelles más fuertes, un golpe seco atrás y arriba (≈70 ms) y una vibración que crece en ráfaga.
- **Pistolas provisionales (v3.6.1)**: la Viper-9 y la Falcon .45 usan las pistolas montadas del Ultimate Guns Pack (CC0) con acero pavonado y polímero desgastados, en lugar de la G19 (escena de exposición con piezas sueltas). Además, los soldados nunca se muestran en pose de T al aparecer.
- **Puesto militar y almacén (v3.6)**: coberturas del Military Outpost Kit (CC0) en los dos spawns, con colisión real para balas, jugador y visión de los bots, colocadas solo donde no bloquean rutas (a más de 1,8 m de los puntos de ruta y 1,1 m de sus tramos, lejos de los puntos de aparición y pegadas a muros). El Abandoned Warehouse (CC BY) se alza al sur del recinto como edificio exterior.
- **Rendimiento y armas (v3.5)**: se elimina la espiral de fotogramas lentos (por debajo de 45 FPS el mundo entero se simulaba dos veces; ahora solo la física se subdivide por debajo de 30 FPS y animación, sincronización y radar van una vez por fotograma), la IA de los bots se desincroniza (cada bot piensa en un momento distinto), el mapa de sombras se recalcula cada dos fotogramas en Low/Medium, la calidad automática baja y recupera con histéresis (sin pasar del nivel elegido) y desaparecen las asignaciones de memoria del disparo. Métricas internas en la consola con `BV.stats()`. Armas en primera persona con colocación geométrica (empuñadura en un punto por tipo de arma y cañón apuntando a un punto lejano del centro de la pantalla), campo de visión propio del arma de 50°, mano de apoyo en el guardamanos real y puntos de disparo calculados desde la geometría (todos a 5 mm de la boca del cañón).
- **Fluidez y pistola (v3.4)**: calidad adaptativa (si el juego baja de unos 45 FPS durante varios segundos, baja un nivel de calidad y lo avisa), preset Medium más ligero (sin postprocesado, menos luces) y Medium por defecto. La pistola se ve a escala, sin restos de la escena de exposición del modelo original.
- **Correcciones (v3.3)**: los soldados ya no aparecen hundidos (la posición de la cadera de las animaciones adaptadas se guardaba saturada), los brazos en primera persona son guantes tácticos detallados fijados al arma (más estables que el cuerpo completo con IK), y el rendimiento mejora: soldado simplificado (−37 % de triángulos), animación por distancia, sombras de soldados solo en High/Ultra, precompilación de sombreadores y ciudad, atrezo y brazos fusionados por material.
- **Brazos realistas en primera persona (v3.2)**: el arma la sujetan los brazos del propio soldado (mangas de camuflaje y guantes). Se usa una copia del modelo con la cabeza y las piernas contraídas, colocada bajo la cámara; IK de dos huesos lleva cada muñeca a la empuñadura y al guardamanos, y la orientación completa de la mano (dedos y palma) se calcula a partir de la pose en T. Las animaciones de recarga existentes mueven la mano de apoyo.
- **Ciudad y atrezo realistas (v3.1)**: el horizonte es una ciudad realista (City, CC BY) colocada en cuatro copias giradas alrededor del recinto, y junto a los muros hay atrezo del Abandoned Factory Modular Kit (CC BY), sin colisión para no afectar a la jugabilidad.
- **Personajes y armas realistas (v3.0)**: los operadores usan un soldado realista con uniforme, chaleco y casco texturizados (Sketchfab, CC BY-SA), con nuestras 15 animaciones adaptadas a su esqueleto Mixamo. Las nueve armas de fuego usan seis modelos realistas de Sketchfab (CC BY), calibrados para que la empuñadura quede en el origen, el cañón hacia −Z y todo a escala real. El cielo es panorámico (Poly Haven, CC0) y el estilo Moderno (PBR y sombras) es el predeterminado; el Clásico sigue disponible en Ajustes. Créditos completos en [CREDITS.md](CREDITS.md).
- **Soldados realistas (v2.3)**: los operadores usan ahora un cuerpo humano de proporciones realistas (Universal Base Characters, CC0), «vestido» por zonas con chaqueta, pantalón, guantes y botas. Las zonas se calculan a partir de la pose en T y la tela se proyecta en el espacio de enlace mediante un shader, de modo que sigue al cuerpo cuando se anima. Llevan 15 animaciones de la Universal Animation Library (CC0) en capas: las piernas andan, trotan, esprintan o se agachan, y el torso apunta, mezclando arriba, al frente y abajo según hacia dónde mira, dispara y recarga. También hay animación de impacto y de muerte. Los fusiles van al hombro, con las dos manos colocadas por IK.
- **Menos juguete, más táctico (v2.2)**: los operadores llevan pieles pintadas con camuflaje, pliegues, costuras y suciedad en el uniforme y nailon táctico con cintas en el equipo. Como el modelo original no trae coordenadas de textura útiles, se proyectan desde la pose de enlace. Además, las gafas de Raven son oscuras (antes brillaban en rojo), los colores de equipo son más sobrios, las armas importadas tienen más desgaste, el cuchillo es de acero oscuro, los nombres sobre los compañeros son más pequeños, las grietas son más sutiles y el horizonte lejano tiene bruma.
- **Acabado de época (v2.1)**: el estilo Clásico aplica reglas medidas en conjuntos de texturas de la época, usando solo estadísticas agregadas y sin reutilizar ninguna imagen. Cada textura mide 128 o 256 px según su tamaño real (unos 64 texels por metro) y se ajusta en brillo, contraste interno y saturación hacia los valores de su categoría. Después se reduce a su propia paleta de 256 colores, sin tramado. La luz se hornea en celdas de 0,6 m en suelos y 0,9 m en paredes, con la rampa de gamma clásica. El campo de visión por defecto es de 74° en vertical (90° horizontales a 4:3), con el arma más grande, a la derecha y con un despliegue más seco.
- **Ladrillo, asfalto y madera reales (v2.0)**: dos ladrillos fotográficos distintos (el industrial en el almacén norte y el bloque SE, y el de fábrica en el taller sur), asfalto de calle real en North Street, asfalto agrietado en el Market y el spawn de Vanguard, y tablas con clavos en las cajas de madera (ambientCG, CC0).
- **Superficies reales (v1.9)**: el hormigón, el yeso de las fachadas, la chapa de la plataforma A y las baldosas de la nave B combinan nuestro diseño (juntas de encofrado, grietas, manchas) con una capa de detalle fotográfico de ambientCG (CC0). Las fotos están ajustadas en brillo y color a la paleta del juego y el damero original se ha desaturado para que encaje en la nave industrial.
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
js/tex_data.js      Texturas fotográficas embebidas (CC0, ambientCG)
js/textures.js      Texturas procedurales en canvas
js/physics.js       Colisiones AABB, movimiento y raycasts
js/map.js           SECTOR-17: geometría, iluminación horneada, waypoints y A*
js/charmodels.js    Operadores con esqueleto y animaciones (mezclador, capas procedurales)
js/real_data.js     Soldado, armas, animaciones adaptadas y cielo (CC BY / CC BY-SA / CC0)
js/realassets.js    Carga y calibración de los recursos realistas
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
