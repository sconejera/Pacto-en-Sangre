# PACTO EN SANGRE

**Beat 'Em Up 2D Urbano Chileno** — Juego arcade de acción lateral en perspectiva 2.5D ambientado en Santiago de Chile, construido con React, TypeScript, HTML5 Canvas, Web Audio API y Vite. Funciona 100% del lado del cliente como aplicación web estática, sin dependencias de servidor ni claves de API.

---

## Historia

El malvado **Devil Gonzalez** intenta someter a los cantantes chilenos a firmar el contrato, con el fin de obtener su alma y el permiso para convertirlos en androides sin mente y producir contenido barato basado en sexo y morbo.

Desde las poblaciones hasta la torre corporativa, las calles fueron tomadas por su ejército de androides y hordas de **Papis Mickys**, **Tíos Renes** y **Troncos Bizarros**. **Bayron Fire**, **Marcianeke** y **Cris MJ** se niegan a vender su música y salen a destruir cada laboratorio de cera, cada set de transmisión y el trono mismo de Devil Gonzalez.

**¡LA BATALLA COMIENZA!!!**

---

## Personajes Jugables y Ataques

| Personaje | Arquetipo | Combo Principal (`J · J · J`) | Cadena de 3 Golpes | Ataque Especial (`J + K` / `Y` / `RB`) |
| :--- | :--- | :--- | :--- | :--- |
| **BAYRON FIRE** | El Tanque del Barrio *(Pesado)* | **Me Pongo Bonito** *(7 → 7 → 11)* | Derechazo de Bloque → Cruzado Rompe-Circuitos → Patada Sísmica | **Tuu Maldito** *(Onda expansiva de bajo, 14 de daño)* |
| **MARCIANEKE** | El Todoterreno *(Equilibrado)* | **MARCIANEKEE** *(6 → 6 → 10)* | Jab Galáctico → Gancho Urbano → Patada Sónica | **Que saben de Corte** *(Rayos cian, 2 impactos de 7)* |
| **CRIS MJ** | El Más Que Suena *(Veloz)* | **Flow Gata Only** *(5 → 5 → 9)* | Puño Relámpago → Codazo Callejero → Patada Giratoria VIP | **Que Viva el Money** *(Ráfaga dorada, 3 impactos 5 + 5 + 4)* |

> **Nota:** El ataque especial consume `8 HP` únicamente si impacta al menos a un enemigo y nunca deja al jugador por debajo de `1 HP`.

---

## Niveles, Escenarios y Jefes

1. **Nivel 1 — Población de Noche**
   - **Jefe:** **EL TRONCO** *(El Licenciado Máximo del Codo)*
2. **Nivel 2 — Feria Libre y Mercado**
   - **Jefe:** **CARLITOS RUN** *(La Guagua)*
3. **Nivel 3 — Metro Subterráneo**
   - **Jefe:** **IVAN MARTINEZ** *(El Hombre de Cera)*
4. **Nivel 4 — Disco Nocturna**
   - **Jefe:** **EL JC QUE LE DICEN** *(El Patrón del Morbo)*
5. **Nivel 5 — Torre de Devil Gonzalez**
   - **Jefe Final:** **DEVIL GONZALEZ** *(El Amo del Contrato y los Androides)*
- **Etapa Bonus (tras Nivel 2 y Nivel 4) — Cancha de la Pobla:** Rompe cajones, barriles y parlantes en una multicancha nocturna de población chilena para recuperar energía y sumar puntos.

### Hordas Enemigas
- **Papis Mickys** (`Papi Micky Zombie`)
- **Tíos Renes** (`Tío Rene Zombie`)
- **Troncos Bizarros** (`Tronco Renacentista`, `Tronco Oficinista`, `Tronco Manager`)
- **Zombies del Pantano** y **Cachorros**

---

## Controles

### Teclado
- **Moverse:** `Flechas` o `W A S D` *(doble toque izquierda/derecha para correr)*
- **Golpe / Combo / Recoger ítem:** `J`
- **Combo rápido:** `J · J · J`
- **Golpe pesado con derribo:** `J · J · pausa · J`
- **Remate que lanza:** `J · J · K`
- **Salto y ataque descendente:** `K` y luego `J` en el aire
- **Ataque Especial:** `J + K`
- **Agarre cuerpo a cuerpo (caminar pegado al enemigo):** `J` rodillazo · `K` suplex · dirección opuesta para lanzar
- **Pausa / Silenciar audio:** `P` / `M` *(o botón de bocina en pantalla)*

### Mando Xbox / Gamepad (Detección Automática)
Al conectar un mando Xbox (USB o Bluetooth) se auto-asignan los botones y aparece el aviso de conexión en pantalla:
- **Moverse:** Stick izquierdo o **Cruceta (D-Pad)** *(compatible con botones estándar, ejes y POV hat; doble toque horizontal = correr)*
- **Golpe / Combo / Confirmar:** `A` o `X`
- **Salto / Volver en menús:** `B`
- **Ataque Especial:** `Y`, `LB`, `RB` o `A + B`
- **Correr rápido:** `LT` o `RT` + dirección
- **Pausa / Silenciar:** `Menu` *(Start)* / `View` *(Back)*

### Móvil / Táctil
- Joystick virtual y botones táctiles (`A`, `B`, `ESP`) disponibles automáticamente durante el combate en dispositivos móviles o pantallas táctiles.
- El joystick y cada botón usan captura de puntero para liberar correctamente la entrada aunque el dedo salga del control antes de levantarlo.
- Los controles respetan `safe-area-inset` para teléfonos con notch o barra de gestos.

---


### PASESITO

Las armas fueron reemplazadas por un único power-up: **PASESITO**. Al tocar la bolsa magenta, esta desaparece del escenario y el personaje hace una acción breve de fuerza con destello, impacto y texto flotante. Durante 12 segundos, todos sus golpes causan 75% más daño; el jugador no sostiene ningún objeto.

El sprite utilizado es `src/assets/images/powerup_dano_magenta.png` y el sonido de recogida es `src/assets/audio/pasesito_bing_bing.mp3`. La alerta de aparición se reproduce para los cinco jefes mediante `src/assets/audio/jefe_peligro.mp3`.

### Carga y presentación

- La música del título mantiene la selección aleatoria actual, pero la primera pista comienza a precargarse desde la pantalla `CARGANDO...`, antes de terminar la carga de los assets visuales.
- La pista ya precargada se conserva al mostrar el título y se reintenta automáticamente cuando el navegador permite reproducir audio después del primer gesto del usuario.
- El fondo de selección está optimizado en `public/assets/aistudio/seleccion_personajes_960.webp`.
- El fondo y el logo del título utilizan versiones WebP optimizadas para reducir el tiempo de carga.
- La pantalla de título permanece opaca con `CARGANDO...` hasta que las fuentes, el logo y el elenco decorativo están listos, evitando un flash de tipografía.

## Actualización de combate y comunicación visual

La actualización de combate incorpora una estructura de combos más legible y con funciones distintas según el ritmo de entrada:

- `J · J · J` encadena tres golpes rápidos.
- `J · J · pausa · J` ejecuta un golpe pesado que derriba.
- `J · J · K` termina la cadena con un golpe que lanza al enemigo.
- `K` seguido de `J` durante el salto convierte el salto en un ataque descendente con utilidad ofensiva y capacidad de derribo.

Los enemigos ahora pueden quedar en estado **ATURDIDO**, con una pose, texto cyan y una breve ventana de vulnerabilidad claramente visibles.

Los jefes comunican sus ataques mediante telegráficos diferenciados:

- `↔` magenta: ataque horizontal.
- `◎` amarillo: ataque de área.
- `✦` cyan: proyectil o lluvia de proyectiles.
- `¡IMBLOQUEABLE!`: señal especial para ataques que no deben bloquearse.
- `VULNERABLE`: aparece durante las ventanas de recuperación o daño del jefe.
- La barra de vida muestra marcadores de **FASE 1**, **FASE 2** y **FASE 3**.

### Archivos principales actualizados

- `src/game/engine.ts`: lógica del ataque descendente y estado `stunned`.
- `src/game/types.ts`: nuevo estado de enemigo `stunned`.
- `src/game/rules.ts`: pose de aturdimiento para hojas de sprites.
- `src/game/renderer.ts`: aturdimiento, telegráficos, hazards y vulnerabilidad.
- `src/components/GameShell.tsx`: controles, leyenda visual y fases del jefe.
- `vite.config.ts`: acceso del servidor local al dominio temporal de Preview.

Validación realizada: `27` tests aprobados, `npm run lint` sin errores y `npm run build` exitoso.

---

## Estructura del Proyecto

```text
├── index.html                  # Entrada HTML y metadatos
├── package.json                # Scripts y dependencias
├── vite.config.ts              # Configuración Vite y copia de assets estáticos
├── public/                     # Sprites, audios, efectos y fuentes estáticas
└── src/
    ├── App.tsx                 # Contenedor raíz React
    ├── main.tsx                # Punto de entrada React
    ├── index.css               # Estilos globales Tailwind CSS y estética arcade
    ├── assets/images/          # Fondos pixel art, objetos y retratos
    ├── components/
    │   ├── GameShell.tsx       # UI arcade, menús, HUD, modales y viñetas
    │   ├── SpritePreview.tsx   # Vista previa de personajes en selección y victoria
    │   ├── TitleCastBackdrop.tsx # Composición animada del elenco en portada
    │   └── TouchControls.tsx   # Controles táctiles en pantalla
    └── game/
        ├── types.ts            # Tipos e interfaces del motor y entidades
        ├── data.ts             # Personajes, combos, especiales, jefes, historia y niveles
        ├── rules.ts            # Reglas puras 2.5D, hitboxes, IA, mando y físicas
        ├── rules.test.ts       # Pruebas unitarias (node:test)
        ├── sprites.ts          # Hojas de sprites 4x4 y animaciones de héroes
        ├── worldSprites.ts     # Carga, recorte y limpieza de fondos y sprites
        ├── renderer.ts         # Renderizador Canvas 2D con ordenamiento Z y efectos
        ├── audio.ts            # Motor Web Audio API (música dinámica + SFX)
        └── engine.ts           # Bucle principal a paso fijo (60 Hz) e inputs
```

---

## Requisitos y Comandos

Requisitos: **Node.js 20+** y **npm**.

```bash
# 1. Instalar dependencias
npm install

# 2. Ejecutar servidor de desarrollo (puerto 3000)
npm run dev

# 3. Verificar tipado TypeScript
npm run lint

# 4. Ejecutar pruebas unitarias de reglas, sprites y controles
npx tsx --test src/game/rules.test.ts

# 5. Compilar sitio estático para producción (salida en dist/)
npm run build

# 6. Previsualizar compilación de producción localmente
npm run preview
```

---

## Despliegue Estático (Cloudflare Pages)

El proyecto genera un sitio 100% estático en la carpeta `dist/` sin requerir variables de entorno ni backend:

- **Build command:** `npm run build`
- **Build output directory:** `dist`

---

## Créditos

Ideado y desarrollado por **Scone L@bs**.
