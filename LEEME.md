# Liga del Movimiento - Kanto (versión Netlify, 4º de primaria)

## Cómo publicarla

> ⚠️ **No sirve arrastrar la carpeta a "Netlify Drop"**: esa opción no ejecuta el servidor (las *functions*) y la web no guardaría nada. Usa uno de estos dos caminos.

**Opción A (recomendada): GitHub**
1. Crea un repositorio en GitHub y sube **todo el contenido de esta carpeta** (`public/`, `netlify/`, `netlify.toml`, `package.json`).
2. En Netlify: *Add new site → Import an existing project* → elige el repositorio. No cambies nada de la configuración (ya la trae `netlify.toml`).

**Opción B: Netlify CLI** (desde la carpeta del proyecto)
```
npm install -g netlify-cli
netlify login
netlify init
netlify deploy --prod
```
Para probarla antes en tu ordenador: crea un archivo `.env` con `TEACHER_PASSWORD=prueba1234` y ejecuta `netlify dev` (se abre en http://localhost:8888).

## Variables de entorno (obligatorio antes de usarla)
En Netlify: *Site configuration → Environment variables*:

| Variable | Para qué | ¿Obligatoria? |
|---|---|---|
| `TEACHER_PASSWORD` | Contraseña del panel del profesor. Elige una larga. | **Sí** |
| `CLASS_CODE` | Código que los alumnos escriben al registrarse (evita que cualquiera con el enlace cree cuentas). | **Obligatoria** (sin ella nadie puede registrarse) |
| `SESSION_SECRET` | Clave para firmar sesiones. Si no la pones, se genera sola. | No |

Después de crearlas o cambiarlas: *Deploys → Trigger deploy → Deploy site*.

## Datos
Se guardan en **Netlify Blobs** (incluido en tu cuenta, sin configurar nada). No necesitas Firebase.

## Novedades pensadas para 4º de primaria

**Privacidad**
- Peso, altura, envergadura y pulso **ya no aparecen al alumno** (ni en el diploma). Solo los ve y edita el profesor, en *Alumnos*. Pide el consentimiento de las familias antes de registrarlos.
- La pantalla de entrada muestra solo **nombre de pila e inicial** ("Lucía M.").
- Nota privada por alumno (📝), visible solo para el profesor.

**Entrar sin frustración**
- El alumno elige **3 emojis** en vez de una contraseña. Se guardan cifrados. Si lo olvida, en *Alumnos* (abre la ficha del alumno) → "🎲 Código nuevo de emojis" (te lo muestra una sola vez).
- **🖨️ Tarjetas de código** (en ⚙️ Gestión): genera un código nuevo para toda la clase y abre una hoja imprimible para recortar. Los códigos anteriores dejan de valer.
- Las sesiones de alumno duran 3 horas como máximo y se cierran solas tras 5 minutos sin tocar la pantalla.
- **🔚 Fin de clase** (botón de la cabecera del panel): cierra de golpe las sesiones de todos los alumnos.

**Lectura y diseño**
- Letra Nunito, más grande (18 px) y botones de 48 px mínimo. La letra pixelada queda solo en el título principal.
- Pantalla principal del alumno con **"Tu misión de hoy"**: la sesión del día en grande, botón 🔊 para que se la lea en voz alta, estado "¡Te espera!" o "¡Misión cumplida!", medallas, fichas y progreso del escuadrón. Lunes y jueves anuncia la próxima misión; fin de semana, descanso.
- **Sonidos desactivados por defecto** (botón 🔔/🔕 visible); la música ya empezaba apagada.
- "Tokens" pasa a "Fichas" y "Pendiente" a "¡Te espera!".
- Avisos y confirmaciones dentro de la propia página (no cuadros del navegador).

**Para ti, en el aula (panel del profesor)**
El panel del profesor tiene cuatro pestañas, ordenadas por uso:
- **🏫 Clase** (la de cada día): elige semana y día y trabaja con toda la clase en una pantalla. Dos modos:
  - **📋 Pasar lista**: toca a un alumno para alternar ✅ presente → ❌ falta → ⏰ retraso. Por defecto todos están presentes, así que solo marcas las excepciones; ✅ *Todos presentes* limpia el día y 🔒 *Lista pasada* la da por cerrada (se puede reabrir).
  - **⚡ Misión cumplida**: toca para marcar la misión (+1 ficha, aviso y medalla automáticos). Los que faltan salen atenuados y no se marcan; *Marcar a los presentes* lo hace de golpe.
  - Contadores siempre visibles (presentes, faltan, retrasos, misión), filtro por escuadrón, 🤝 +1 / −1 ficha (fair play), 📝 nota privada y los canjes pendientes de usar (✓ Usado). Se actualiza sola cada 30 segundos.
- **🖥️ Pizarra**: ver más abajo. **La lista de clase también está aquí** (solo en tu pantalla; al pulsar Presentar desaparece del proyector), con los mismos modos, y los sorteos y equipos solo cuentan con los alumnos que no faltan hoy.
- **👥 Alumnos**: directorio con búsqueda, filtro por escuadrón y orden (nombre, fichas, progreso, faltas). Cada fila resume fichas, medallas, misiones y faltas; al abrirla editas al alumno (datos físicos, nota, código nuevo, borrar).
- **⚙️ Gestión**: semana y plan de la sesión, cerrar unidad (cofres), tarjetas de código para toda la clase, exportar **📊 Progreso (CSV)** y **📋 Asistencia (CSV)** (una fila por alumno y una columna por día, ✅ por defecto en los días con lista cerrada) y ayuda rápida de atajos.
- La asistencia es **solo del profesor**: el alumno no ve sus faltas ni las fechas y no puede modificarla. Solo ve su **🔥 racha** en Mi Base («Llevas 4 clases seguidas participando»): cuenta las listas pasadas seguidas sin falta (el retraso cuenta como venir) y vuelve a 0 si falta.
- **🖥️ Modo pizarra** (pestaña propia). Pensado para usar **dos dispositivos**: en el ordenador del proyector abres la pestaña y pulsas **📽️ Presentar** (pantalla completa, sin botones, la pantalla no se apaga); desde tu tablet o móvil abres la misma pestaña y lo manejas todo. Los cambios llegan al proyector en unos 4 segundos. Incluye:
  - **Misión de hoy y fases** (🔥 calentamiento, 🎯 parte principal, 🧘 vuelta a la calma) con el texto y el material de cada fase. Escribes el plan de cada sesión en **✏️ Plan de la sesión**; si no hay plan, muestra textos por defecto.
  - **Cronómetro y temporizador**: cuenta atrás (3, 5, 10 min o a medida), cronómetro y circuitos trabajo/descanso (30/15 ×6, tabata 20/10 ×8 o a medida) con colores verde/rojo y pitidos (se activan al presentar; botón 🔔 para silenciar).
  - **🌡️ Clima de la clase**: semáforo de **ruido** (verde, amarillo, rojo) y medidores de **comportamiento** y **esfuerzo** de 10 estrellas; al llenar uno, celebración con confeti para toda la clase.
  - **🎁 Roles de hoy**: los canjes activos en grande (DJ del calentamiento, encargado de material...).
  - **🛡️ Escuadrones**: media de pantallas de cada escuadrón en la unidad, con el mapa de pantallas y el aviso del cofre.
  - **🎲 Sorteo**: alumno al azar (sin repetir hasta que salgan todos), parejas y equipos mixtos equilibrados por escuadrón. Marca antes quién falta hoy. Solo muestra nombre de pila e inicial.
  - **Atajos de teclado** (sirven con un mando de presentaciones): Espacio o → fase siguiente, ← anterior, T cronómetro, R reiniciar, 1/2/3 semáforo, B/E comportamiento/esfuerzo (con Mayús resta), P presentar, F pantalla completa.
  - Aviso si se pierde la conexión, mostrando los últimos datos.

**Técnica**
- **Instalable** en tablets y móviles (icono en la pantalla de inicio) y con caché de las librerías para que cargue más rápido con el wifi del colegio. La API nunca se guarda en caché.
- Cabeceras de seguridad en `netlify.toml`.

## Seguridad (heredada de la versión anterior)
- La contraseña del profesor vive en `TEACHER_PASSWORD`, no en el código.
- Los alumnos no pueden darse fichas, medallas ni sesiones; el servidor comprueba que cada canje se paga. Si cambias el catálogo de premios en `public/index.html` (`rewardsCatalog`), actualiza también `REWARD_COST` en `netlify/functions/api.mjs`.
- Bloqueo de 5 minutos tras 5 intentos fallidos (alumnos y profesor). Con 12 emojis y 3 posiciones hay 1.728 combinaciones: es suficiente para una web de clase con ese bloqueo, no para datos de alto riesgo.

## Límites que conviene saber
- Los alumnos solo ven los cambios del profesor (fichas, medallas) al volver a entrar.
- Las celebraciones de nivel y medalla solo se disparan en el dispositivo que tenga abierta la pestaña Pizarra (el proyector) y tardan hasta 20 segundos en detectar cambios hechos desde otro dispositivo.
- El temporizador, el semáforo, los medidores y los sorteos se guardan en el servidor y se comparten entre dispositivos; los pitidos suenan solo en el dispositivo donde estén activados.
- El panel de edición de un alumno guarda los valores que tenía cargados: si lo dejas abierto mucho rato, pulsa Actualizar antes de guardar. Para el día a día usa Clase o Pizarra, que no tienen ese problema.
- Los Pokémon que compra un alumno se comprueban en su navegador; un alumno muy técnico podría añadirse alguno sin pagar.
- **Tailwind sigue cargándose desde su CDN** (no he podido compilarlo en local sin conexión). El modo instalable lo cachea tras la primera carga, pero la primera visita con wifi lenta puede tardar.
- Los Pokémon son marcas registradas: para uso interno en clase suele tolerarse; no la publiques abierta a todo internet sin pensarlo.


## Revisión de seguridad y fiabilidad (v5)
- **Intentos de login**: contados de forma atómica, antes de comprobar el código. Máx. 8 fallos por perfil cada 5 min (da igual desde qué red) y tope por red; profesor: 5 por IP + tope global. Efecto secundario: si alguien machaca el perfil de un compañero, queda bloqueado 5 min.
- **Fichas**: las calcula el servidor. El alumno ya no puede enviarse fichas, ni Pokémon ni premios sin pagar (tablas de precios en `api.mjs`: `POKE_COST` y `REWARD_COST`; si cambias precios en `index.html`, cámbialos también ahí).
- **Escrituras simultáneas** (varios móviles + pizarra): lectura-modificación-escritura condicional con reintentos (`onlyIfMatch`). Requiere `@netlify/blobs` ≥ 10 (`npm install` lo hace Netlify al desplegar).
- **Service worker**: ya no cachea scripts de CDN (rompía la 2ª visita con la CSP). Si usaste la v anterior, la caché se renueva sola (`liga-kanto-v2`).
- **Ficha del profesor** envía solo los campos que edita, para no pisar fichas/medallas recién cambiadas.
- CSV: se neutralizan nombres que empiezan por `= + - @`.
- Si falla la conexión, el alumno ve «Reintentar» y los guardados fallidos avisan.

## Revisión con 5 agentes (v6)
- Corregido: las sesiones/medallas marcadas desde la ficha del alumno no se guardaban en el servidor (ahora van por su ruta y suman fichas).
- Guardado del alumno en cola (no se pisan compras seguidas), avisos del profesor ya no se borran sin verse, asistencia en cola, la pizarra no revierte cambios recientes, reloj del proyector compensa la latencia, doble clic en sorteos.
- Servidor: nombres duplicados bloqueados de forma atómica (incluso con tildes), login sin crear basura para ids falsos, bloqueo por perfil más corto (10 fallos / 3 min), el profesor ya no queda fuera por un tope global, Giovanni limita 10 golpes por alumno cada 10 min, fechas inexistentes rechazadas, 503 si hay mucha actividad.
- Pequeños de diseño: movimiento reducido para quien lo pide, semáforo de ruido con etiquetas, imágenes de la Pokédex con carga diferida.
- Pendiente (ver informes): Tailwind compilado, caché en servidor, pestañas inferiores del profesor, modo de letra fácil, y la parte legal/RGPD (consentimiento de familias, ubicación de datos, purga de fin de curso).

## Lista de clase simplificada (v7)
Una fila por alumno con tres botones grandes ✅ presente / ⏰ tarde / ❌ falta (un toque, sin ciclos). Bonus, nota y fichas quedan detrás de «⋯». Al marcar cualquier alumno la lista del día se da por pasada sola (ya no hay botón «Cerrar lista»).

## Mapa, unidades y cofres (v9)
- **Giovanni eliminado.** Ya no hay golpes ni barra de vida.
- **Mapas en canvas estilo GBA (v9)**, dibujo propio sin imágenes de ningún juego:
  - **Mapa de la región**: las 8 ciudades unidas por rutas, cada una con el icono de su contenido (cantera, agua, espalderas, pista de atletismo, escenario, red, volcán, brújula). Verde = unidad terminada, rojo parpadeante = unidad en curso. El alumno puede pulsar una ciudad para ver sus casas; el botón «Volver a mi ciudad» deshace la selección.
  - **Mapa de ciudad**: un camino con **una casa por sesión** y el gimnasio al final. Las casas hechas llevan un visto verde, la siguiente parpadea en dorado y el entrenador (sprite del alumno) camina hasta ella.
  - Sale en Aventura (progreso del alumno) y en la Pizarra (media del mejor escuadrón).
  - El motor es `window.KantoMap` (`city`, `region`, `spin`, `trainer`), un bloque `<script>` dentro de `index.html`. Respeta «reducir movimiento» y solo dibuja los canvas visibles.
- **Cerrar unidad** (Gestión): gana el escuadrón con mejor **media de sesiones por alumno** (empate = ambos). El servidor sortea y reparte:
  - Ganador: un legendario (Articuno, Zapdos, Moltres, Dragonite, Mewtwo, Mew) en versión **shiny** para todo el escuadrón, aunque ya lo tuvieran. Sin repetir a un escuadrón. Cuando ha recibido los 6: premio extraordinario al azar, «Elige tu Pokémon shiny» (hasta coste 4) o «Día del escuadrón».
  - Resto de escuadrones: un Pokémon de coste 2-3 que no tengan (si no queda ninguno, +2 fichas) y un sello de unidad.
  - La Pizarra muestra el aviso del cofre durante 10 min (se puede quitar).
  - **El profe solo atribuye el cofre**: al cerrar la unidad se reparten los premios y cada alumno ve una **tragaperras de tres rodillos** con su premio al entrar en su perfil (los tres rodillos paran uno detrás de otro y enseñan el mismo Pokémon) (se guarda en `pendingChests`, se marca visto con `POST /me/chest-seen` y si hay varios se abren uno detrás de otro). Los rodillos paran siempre en el premio real y el cofre se puede cerrar o saltar en cualquier momento.
  - Un legendario **solo se entrega una vez en toda la liga**. En la consolación, si el Pokémon que toca ya lo tenía, recibe su valor en fichas (2 o 3).
  - **El profe valida desde el mapa**: en la lista de clase, el botón 🗺️ Mapa de cada alumno abre su ciudad en la unidad del día. Tocar una casa valida esa sesión y volver a tocarla la quita; hay flechas y selector para cambiar de unidad, leyenda de colores y el personaje que camina es el entrenador de ese alumno.
  - El alumno ve el aviso **🎰 Abrir mi cofre** en Mi Base siempre que tenga cofres sin abrir, además de la apertura automática al entrar.
- **El brillo shiny solo se consigue con cofres.** Los alumnos que ya lo tenían activado lo conservan.
- Si cambias el listado de Pokémon o sus precios en `index.html`, actualiza `POKE_COST` en `netlify/functions/api.mjs` (y `LEGENDS` / `CONSOLATION`).

## Pokédex como álbum de cromos (v10)
- La Colección es un álbum: los Pokémon que tienes salen a color (con ✓); los que te faltan, en silueta gris con su precio y el botón Reclutar (o «Te faltan N» si no llegan las fichas).
- Filtros Todos / Mis cromos / Me faltan y contador «Tu álbum: N de 151 cromos».
- Los 6 legendarios (Articuno, Zapdos, Moltres, Dragonite, Mewtwo, Mew) ya **no se pueden comprar**: salen como «Legendario sorpresa» y solo llegan en cofres. El servidor rechaza su compra; quien ya tenía alguno lo conserva.
