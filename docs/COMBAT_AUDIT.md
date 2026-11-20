# AUDITORÍA REPRODUCIBLE DEL SISTEMA DE COMBATE — FIRMADO EN SANGRE

**Orden de Trabajo:** OT-01 v1.0  
**Fecha de línea base:** 2026-11-20  
**Alcance:** Auditoría estática (`[CÓDIGO]`) y verificación exploratoria en navegador (`[NAVEGADOR]`) sin modificar código de producción ni instalar dependencias.

---

## 1. Resumen Ejecutivo

El sistema de combate de **FIRMADO EN SANGRE** opera sobre un bucle fijo de simulación a **60 Hz** (`NoFirmoEngine` en `src/game/engine.ts`) con reglas puras desacopladas en `src/game/rules.ts`, datos declarativos en `src/game/data.ts`, animación por hojas 4x4 en `src/game/sprites.ts`, renderizado Canvas 2D con ordenamiento Z en `src/game/renderer.ts` y audio Web Audio API en `src/game/audio.ts`.

La compilación TypeScript (`npm run lint`), el bundle de producción (`npm run build`) y las 22 pruebas unitarias vía `tsx` pasan sin errores. En navegador (`http://localhost:3000`) el flujo jugable responde en escritorio (`1365x768`) y móvil (`390x844`) sin errores de consola ni fallos de red.

No obstante, la auditoría identificó **problemas estructurales verificables** que afectan directamente el tacto y la justicia del combate:
1. **Hitboxes activas desde el frame 0 del golpe** (antes de que termine la anticipación visual del sprite) y **corte prematuro de animación** al enlazar combos desde los `40 ms` (`stateTimer < 0.14` sobre `0.18 s`).
2. **Caja de depuración (`F1`) desincronizada** respecto de la colisión real (`62x60` fija en `renderer.ts` frente a ancho dinámico `54..86` x `96` de alto en `engine.ts`).
3. **Especiales multi-golpe declarados pero resueltos en un solo impacto instantáneo** en el frame 1 (`Marcianeke` `[7,7]` y `Cris MJ` `[5,5,4]` aplican `-14` en bloque).
4. **Enemigos a distancia (`domestico`, `manager`) y drenadores (`zombie`, `chupetona`) omiten asignar `attackCooldown` tras disparar o soltar**, permitiendo ráfagas más frecuentes que los atacantes cuerpo a cuerpo.
5. **Discrepancia documental/UI de identidad comercial**: `README.md` y `metadata.json` aún muestran `PACTO EN SANGRE` frente al nombre oficial `FIRMADO EN SANGRE`; y solapamiento del botón de silencio con el logo en móvil `390x844`.

---

## 2. Resultados de Comandos Base (Evidencia Literal)

| Comando | Estado | Salida / Observación literal |
| :--- | :--- | :--- |
| `npm run lint` | `PASA` | `> tsc --noEmit` — salida `0`, sin errores ni advertencias. |
| `npm run build` | `PASA` | `vite v8.3.8 building client environment for production... ✓ 27 modules transformed... ✓ built in 527ms` (salida en `dist/`). |
| `node --test` | `FALLA` | Salida `1`: `Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/app/applet/src/game/rules' imported from /app/applet/src/game/rules.test.ts` (Node v22.23.2 requiere extensión `.ts`/loader para imports sin extensión). |
| `./node_modules/.bin/tsx --test src/game/rules.test.ts` | `PASA` | `1..22 # tests 22 # pass 22 # fail 0` (`duration_ms 497.972092`). |

---

## 3. Inventario Real del Sistema de Combate (`[CÓDIGO]`)

Todos los valores siguientes provienen directamente de los archivos fuente indicados. Cuando un parámetro o mecánica no existe en el código se indica **`NO ENCONTRADO`**.

### 3.1 Parámetros Globales de Simulación y Entradas
- **Frecuencia de simulación:** `60 Hz` (`fixedStep = 1 / 60`, `src/game/engine.ts:892`), con `dt` de frame acotado a `<= 0.05 s` (`engine.ts:433`).
- **Dimensiones lógicas y banda caminable 2.5D (`src/game/data.ts:11-17`):** `LOGICAL_WIDTH = 960`, `LOGICAL_HEIGHT = 540`, `WALK_MIN_Y = 436`, `WALK_MAX_Y = 528`, `DEPTH_TOLERANCE_Y = 22 px`, `GRAVITY = 1800 px/s²`, `BASE_JUMP_IMPULSE = 620 px/s`. *(Nota: `RUN_SPEED = 260` en `data.ts:18` no es consumida en combate; se usa `stats.runSpeedX` por personaje).*
- **Buffer de ataque y salto (`engine.ts:1309-1316`):** `0.11 s` (`110 ms`) para `attackBufferTimer` y `jumpBufferTimer`.
- **Ventana de especial simultáneo `J+K` / `A+B` (`engine.ts:1046-1062`):** `<= 0.08 s` (`80 ms`) entre marcas de tiempo o pulsación en el mismo tick.
- **Ventana de doble toque para correr (`engine.ts:3662, 3865, 3871`):** `<= 0.28 s` (`280 ms`) en dirección horizontal.
- **Hitstop (`src/game/rules.ts:1177-1192`, `engine.ts:3200-3204`):**
  - Golpe normal: `0.055 s`.
  - Golpe pesado (`knockdown` o `special`): `0.085 s`.
  - Cooldown global anti-congelamiento en multitudes (`resolveHitstopBudget`): `0.22 s`.
- **Mecánicas defensivas del jugador (`bloqueo`, `esquive/dash defensivo`, `agacharse`):** `NO ENCONTRADO`.
- **Tecla dedicada de especial en teclado:** `NO ENCONTRADO` (solo acorde `J + K` en `engine.ts:1046-1062`; `Y/LB/RB` en gamepad y botón `ESP` en táctil).

### 3.2 Personajes Jugables (`src/game/data.ts:32-111`, `engine.ts:1189-1672`)

| Parámetro | Bayron Fire | Marcianeke | Cris MJ |
| :--- | :--- | :--- | :--- |
| **Arquetipo** | Pesado (`El Tanque del Barrio`) | Equilibrado (`El Todoterreno`) | Veloz (`El Más Que Suena`) |
| **Nombre de Combo** | `ME PONGO BONITO` | `MARCIANEKEE` | `FLOW GATA ONLY` |
| **Daño Combo `[1, 2, 3]`** | `[7, 7, 11]` (total `25`) | `[6, 6, 10]` (total `22`) | `[5, 5, 9]` (total `19`) |
| **Duración `attack1 / attack2 / attack3`** | `0.18 s / 0.18 s / 0.24 s` | `0.18 s / 0.18 s / 0.24 s` | `0.18 s / 0.18 s / 0.24 s` |
| **Impulso horizontal `vx` del combo** | `24 / 48 / 115 px/s` | `24 / 48 / 115 px/s` | `24 / 48 / 115 px/s` |
| **Umbral de enlace anticipado en animación** | `stateTimer < 0.14 s` (desde `40 ms` de `attack1/2`) | `stateTimer < 0.14 s` | `stateTimer < 0.14 s` |
| **Ventana post-golpe (`comboWindow`)** | `0.35 s` | `0.35 s` | `0.40 s` |
| **Velocidad caminar `X / Y` (`px/s`)** | `150 / 100` | `170 / 110` | `195 / 125` |
| **Velocidad correr `runSpeedX`** | `235 px/s` | `260 px/s` | `285 px/s` |
| **Impulso de salto (`px/s`)** | `588` (`90%` altura) | `620` (`100%` altura) | `650` (`110%` altura) |
| **Patada aérea (`airKick`)** | `0.35 s`, daño `10`, alcance `56 px` | `0.35 s`, daño `10`, alcance `56 px` | `0.35 s`, daño `10`, alcance `66 px` (`+10`) |
| **Ataque en carrera (`shoulder`)** | `0.40 s`, `vx = 293.75`, daño `10`, alcance `58 px`, rompe guardia + derriba | `0.40 s`, `vx = 325`, daño `8`, alcance `58 px`, rompe guardia + derriba | `0.40 s`, `vx = 356.25`, daño `7`, alcance `58 px`, rompe guardia + derriba |
| **Recuperación post-`shoulder` (`recover`)** | `0.30 s` | `0.30 s` | `0.00 s` (inmediatamente accionable) |
| **Nombre del Especial** | `TUU MALDITO` | `QUE SABEN DE CORTE` | `QUE VIVA EL MONEY` |
| **Especial: duración / invulnerabilidad / cooldown** | `0.60 s / 0.60 s / 0.80 s` | `0.60 s / 0.60 s / 0.80 s` | `0.60 s / 0.60 s / 0.80 s` |
| **Especial: alcance (`radio x prof. Y`)** | `160 px x ±60 px` | `140 px x ±60 px` | `130 px x ±70 px` |
| **Especial: daño declarado vs real** | `[14]` → `14` instantáneo | `[7, 7]` → `14` instantáneo (1 hit) | `[5, 5, 4]` → `14` instantáneo (1 hit) |
| **Especial: requisito y coste HP** | `HP > 8` y `cooldown <= 0`; resta `8 HP` (mínimo `1 HP`) **solo si golpea `>= 1` objetivo** | Igual | Igual |

- **Recuperación de golpes de combo:** `0 s` de estado `recover`; al agotar `0.18 s` / `0.24 s` pasa directo a `idle` con `comboWindowTimer = stats.comboWindow`.
- **Estados defensivos del jugador al recibir impacto (`engine.ts:1167-1174, 2710-2740`):** `hurt = 0.36 s` (`invulnTimer = 0.80 s`), `knockdown = 0.80 s`, `getup = 0.25 s` (`invulnTimer = 1.00 s`), `ko = 0.70 s`.

### 3.3 Hitboxes, Profundidad 2.5D y Sincronización Sprite-Hitbox (`engine.ts:1341-1347, 1738-1806`, `rules.ts:55-73`, `sprites.ts:55-68`)
- **Fórmula de alcance en combo:** `reach = 54 + (step === 3 ? stats.kickExtraReach : 0) + (weapon ? WEAPON_STATS[weapon].reachBonus : 0)`.
- **Geometría de colisión 2.5D (`overlapsHitbox25D`):**
  - Centro horizontal atacante: `atkX = p.x + p.facing * (reach * 0.55)`.
  - Solapamiento `Y`: `|atkY - bY| <= 22 px`.
  - Solapamiento `X`: `|atkX - bX| <= (reach + bw) * 0.5`.
  - Solapamiento `Z`: `atkZ < bZ + bh && bZ < atkZ + 96`.
  - Dimensiones de hurtbox objetivo: enemigo `42 x 92`, jefe `56 x 120`, rompible `44 x 52`.
- **Ventana activa de hitbox:** Se evalúa en **todos los frames** del estado `attack1/2/3`, `airKick` y `shoulder` (`attackHitSet` impide repetir daño al mismo objetivo en un mismo swing).
- **Animación (`sprites.ts:55-68`):** `attack1` tiene `[7, 8, 8, 0]` a `18 fps` (`0.222 s` totales, mayor que `stateTimer = 0.18 s`); el frame 7 (preparación) ocurre entre `0..55 ms`, pero la hitbox ya está activa desde `0 ms`. En `attack3` (`[11, 12, 12, 0]` a `15 fps` = `0.266 s` vs `stateTimer = 0.24 s`), el último frame tampoco completa su ciclo si vuelve a `idle`.
- **Hitbox de depuración (`renderer.ts:1274-1288`):** Dibuja un rectángulo fijo `62 x 60` (`sx + (facing>0 ? 10 : -72), sy - iz - 90`), desincronizado del `reach` real (`54..86 px`) y de la altura real (`96 px`).

### 3.4 Armas y Objetos Rompibles (`data.ts:221-229`, `engine.ts:1792-1806, 2839-2890`)

| Arma | Daño | Usos | `reachBonus` | Alcance efectivo combo (`base 54`) | Desgaste |
| :--- | :---: | :---: | :---: | :---: | :--- |
| `tubo` | `14` | `12` | `+14 px` | `68 px` (Cris MJ paso 3: `78 px`) | `-1` por swing que impacta enemigo o jefe |
| `bate` | `16` | `10` | `+18 px` | `72 px` (Cris MJ paso 3: `82 px`) | Igual |
| `botella` | `8` | `3` | `+8 px` | `62 px` (Cris MJ paso 3: `72 px`) | Igual |
| `cadena` | `12` | `14` | `+32 px` | `86 px` (Cris MJ paso 3: `96 px`) | Igual |

- **Recogida:** Al presionar Ataque (`J`) dentro de `|Δx| < 48` y `|Δy| < 26` de un arma en el suelo, la recogida **tiene prioridad y cancela el ataque** (`engine.ts:1430-1432`).
- **Rompibles:** `hp = 2` (`engine.ts:692`); cada impacto resta `1 HP`, no otorga puntos ni desgasta durabilidad del arma equipada. Al romperse (`hp <= 0`), suelta `guaranteedDrop` o `60%` de probabilidad de drop aleatorio (`empanada`, `billete`, `sandwich`, `tubo`, `energia`).
- **Patada aérea con arma:** Ignora completamente daño, alcance y desgaste del arma equipada (`engine.ts:1331`).

### 3.5 Agarres del Jugador (`engine.ts:1222-1306, 1496-1554`)
- **Inicio (`walk-in grab`):** `grabCooldown <= 0`, `mx !== 0`, `my === 0`, `!isRunning`, enemigo en `approach|circle|hurt|recover`, `|Δx| <= 38`, `|Δy| <= 18`, `sign(e.x - p.x) === facing` mantenido `>= 0.18 s`.
- **Duración `grabHold`:** `2.4 s` iniciales (reinicia a `1.8 s` tras rodillazo).
- **Rodillazo (`grabKnee`):** `0.20 s`, `5` de daño, máximo `2` rodillazos antes de forzar lanzamiento en el 3er toque.
- **Lanzamiento (`grabThrow`):** `0.28 s`, `12` de daño hacia adelante (o con dirección opuesta + `J`), `14` de daño hacia atrás (`K` overhead); el cuerpo lanzado impacta a otros enemigos (`|Δx| < 42, |Δy| < 22`) por `8` de daño y derribo.
- **Escape / liberación:** Mantener dirección opuesta o vertical `>= 0.16 s` (`shouldReleaseCrowdGrabHold`), o timeout, aplica `grabCooldown = 0.60 s`.

### 3.6 Enemigos, Límite de Atacantes y Drenaje (`data.ts:126-220`, `engine.ts:2027-2363`)

| Tipo | Etiqueta | HP base | Daño base | Vel. | Telegráfico | Alcance | Puntaje | Conducta especial |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| `zombie` | `ZOMBIE DEL PANTANO` | `30` | `5` | `50` | `0.40 s` | `52` | `200` | Agarre/drenaje `2.0 s` (`4` daño inicial + `5/s`) |
| `cachorro` | `CACHORRO` | `24` | `4` | `150` | `0.25 s` | `62` | `150` | Embiste `vx = 330`; ataque `0.35 s`; recup. `1.8 s`; cooldown `3.0 s` |
| `canero` | `PAPI MICKY ZOMBIE` | `50` | `8` | `80` | `0.40 s` | `90` | `400` | Melee largo alcance |
| `domestico` | `TRONCO RENACENTISTA` | `70` | `10` | `90` | `0.40 s` | `58` | `600` | Guardia frontal (`50%` daño) + dispara `pan` (`dmg 7`) si `absDx > 110` |
| `chupetona` | `TRONCO OFICINISTA` | `60` | `3` | `110` | `0.40 s` | `50` | `700` | Agarre/drenaje `3.0 s` (`2` daño inicial + `3/s` + se cura) |
| `fan` | `TIO RENE ZOMBIE` | `90` | `9` | `140` | `0.40 s` | `56` | `900` | Ataque derriba al jugador (`knockdown = true`) |
| `manager` | `TRONCO MANAGER` | `140` | `12` | `100` | `0.40 s` | `64` | `1500` | Dispara `contract` (`dmg 8`) si `absDx > 115`; melee roba hasta `500 PTS` y huye |

- **Escalado por nivel (`LEVEL_SCALING`):** N1 (`1.0 / 1.0`), N2 (`1.15 / 1.1`), N3 (`1.3 / 1.2`), N4 (`1.5 / 1.3`), N5 (`1.7 / 1.4`).
- **Condición de derribo de enemigo (`rules.ts:805-824`):** Golpe con `knockdown = true` (combo 3, shoulder, especial, lanzamiento) **o** acumular `>= 3` impactos en ventana de `2.0 s` (reinicia timestamps tras derribo).
- **Duraciones comunes de estado enemigo (`engine.ts:1857-1906, 2046-2314`):** `hurt = 0.40 s`, `knockdown = 0.80 s` (`0.60 s` al caer de lanzamiento), `getup = 0.25 s`, `thrown = 0.55 s`, `ko = 0.45 s`, `recover = 0.65 s` (`0.70 s` tras disparo, `1.80 s` cachorro, `0.60 s` tras drenaje), `attack = 0.28 s` (`0.35 s` cachorro), `attackCooldown = 1.40 s` (`3.00 s` cachorro). *(Defecto: ramas de disparo en `engine.ts:2232-2240` y fin de drenaje en `engine.ts:2180-2181` no asignan `attackCooldown`).*
- **Límite de atacantes simultáneos (`maxAttackTokens`):** N1 = `2`, N2 = `2`, N3 = `3`, N4 = `3`, N5 = `3` (máximo simultáneo en pantalla: `4, 4, 5, 5, 6`). Discrepancia: `rules.ts` cuenta `'telegraph' | 'attack'`, mientras `engine.ts:2031` cuenta `'telegraph' | 'attack' | 'draining'`.
- **Escape de `grabbedByEnemy` (`rules.ts:1029-1061`, `engine.ts:1100-1138`):** Machacar Ataque `>= 4` veces (`mashBreakCount >= 4`), activar Especial, expirar temporizador (`2.0 s` / `3.0 s` / `1.8 s`), o desaparecer el drenador activo.

### 3.7 Los Cinco Jefes (`data.ts:243-324`, `engine.ts:1914-2025, 2365-2677`)

| Jefe | Nivel | HP | Daño base | Vel. | Patrones / Ataques | Cambios de fase y refuerzos |
| :--- | :---: | :---: | :---: | :---: | :--- | :--- |
| **1. El Tronco** (`El Licenciado Máximo del Codo`) | 1 | `250` | `12` | `98` | `doublePunch` (`0.42s`), `shoulderCharge` (`0.55s`, tel. `0.50s`), `stompWave` (`0.40s`, onda `r=135`, saltable con `z>24`) | Derribo cada `25%` HP (`62.5`). A `<= 50%` HP (`125`) invoca `2` enemigos (`cachorro`). |
| **2. Carlitos Run** (`La Guagua`) | 2 | `350` | `11` | `145` | `radioDash` (`0.55s`, `vx=420`), `flyingKick` (`0.55s`), `doublePunch`, `stompWave`, `jingleBuff` (`+20%` vel. aliados `5s`). Recup. `0.90s`. | Derribo cada `25%` HP. A `<= 50%` HP invoca `2` `canero`. |
| **3. Ivan Martinez** (`El Hombre de Cera`) | 3 | `450` | `13` | `118` | Teletransporte cada `8.0 s`; `doublePunch`, `shoulderCharge`, `flyingKick`, `stompWave`, `throwPhone` (`dmg 8`), `enVivoMark` (`1.0s`, `r=68`, `dmg 12`). | Derribo cada `25%` HP. A `<= 50%` HP invoca `2` `chupetona`. |
| **4. El JC Que Le Dicen** (`El Patrón del Morbo`) | 4 | `600` | `14` | `105` | `noteFan` (3 notas `vy=[-70,0,70]`), `soundPush` (AoE `<160px`), `doublePunch`, `shoulderCharge`, `flyingKick`, `stompWave`. | Derribo cada `25%` HP. `<= 66%` invoca `2` `chupetona`; `<= 33%` invoca `2` `fan`. |
| **5. Devil Gonzalez** (`El Amo del Contrato`) | 5 | `1000` | `15` | `115` | **F1:** `briefcaseSwing`, `contractSweep`. **F2:** `fireWave`, `signatureGrab` (drena `1.8s`, `8` dmg), `shoulderCharge`. **F3:** `contractRain` (3 zonas `r=54`, `dmg 13`), `fireWave`, `briefcaseSwing`. | **3 Fases** (`<=650` HP F2, `<=300` HP F3; transición `1.75s` + `empanada`). Refuerzos: `<=800` (`2 manager`), `<=150` (`3 fan`), `<=50` (`3 domestico`). Solo se tambalea (`0.16s`) con golpe pesado en `recover`. |

- **Reglas comunes a jefes:** Intro `2.2 s`, alcance de activación `absDx < 165` (J1–J2) o `< 320` (J3–J5) y `absDy < 38`; telegráfico `0.45 s` (`0.50 s` `shoulderCharge`), super armadura en `telegraph`, `attack` y `phaseTransition`; recuperación `1.05 s` (excepto J2 `0.90 s` y J5 F2–F3 `0.85 s`).

---

## 4. Matriz de Pruebas de Combate del Jugador

| Caso | Bayron Fire | Marcianeke | Cris MJ | Evidencia / Detalle observado |
| :--- | :--- | :--- | :--- | :--- |
| **1. Ataque básico (`J`)** | `PASA` (`[CÓDIGO]` + `[NAVEGADOR]`) | `PASA` (`[CÓDIGO]` + `[NAVEGADOR]`) | `PASA` (`[CÓDIGO]` + `[NAVEGADOR]`) | Responde al instante en el tick fijo; aplica `7 / 6 / 5` de daño con hitflash y retroceso. |
| **2. Secuencia de 3 golpes** | `PASA` (`[CÓDIGO]` + `[NAVEGADOR]`) | `PASA` (`[CÓDIGO]` + `[NAVEGADOR]`) | `PASA` (`[CÓDIGO]` + `[NAVEGADOR]`) | En `10-boss1-combat.png` Marcianeke redujo a `EL TRONCO` `250→228→206` (`-22` por combo completo) y sumó `+30 PTS` por secuencia. |
| **3. Enlace en distintos momentos** | `PASA` con defecto (`[CÓDIGO]`) | `PASA` con defecto (`[CÓDIGO]`) | `PASA` con defecto (`[CÓDIGO]`) | `stateTimer < 0.14` permite encadenar desde los `40 ms` de iniciada la animación (`0.18 s`), cancelando los frames de extensión visual aunque la hitbox ya evaluó impacto en el frame 0. |
| **4. Ataque justo antes de recuperación** | `PASA` (`[CÓDIGO]` + `[NAVEGADOR]`) | `PASA` (`[CÓDIGO]`) | `PASA` (`[CÓDIGO]`) | Buffer de `110 ms` (`attackBufferTimer`) captura pulsaciones previas a volver a `idle` y dispara al primer frame libre. |
| **5. Especial contra uno/varios (`J+K`)** | `PASA` (`[NAVEGADOR]`) | `FALLA` parcial (`[NAVEGADOR]`/`[CÓDIGO]`) | `FALLA` parcial (`[NAVEGADOR]`/`[CÓDIGO]`) | `05-bayron-special.png`: `¡TUU MALDITO!` (`84/100 HP`, `-8 HP` aplicado). `07-marcianeke-combat.png` y `08-crismj-combat.png`: `¡QUE SABEN DE CORTE!` y `¡QUE VIVA EL MONEY!` muestran un único `-14` instantáneo en lugar de `[7,7]` y `[5,5,4]`. |
| **6. Salto y patada aérea (`K` → `J`)** | `PASA` (`[NAVEGADOR]`) | `PASA` (`[NAVEGADOR]`) | `PASA` (`[CÓDIGO]`) | `06-bayron-airkick.png` muestra a Bayron ejecutando patada aérea limpia en el aire; en código usa daño fijo `10` (ignora arma y no derriba). |
| **7. Ataque en carrera (doble toque → + `J`)** | `PASA` (`[CÓDIGO]` + `[NAVEGADOR]`) | `PASA` (`[CÓDIGO]`) | `PASA` (`[CÓDIGO]`) | Dispara `shoulder` (`0.40 s`) rompiendo guardia y derribando; en código Cris MJ tiene `shoulderRecovery = 0` frente a `0.30 s` de Bayron/Marcianeke. |
| **8. Pérdida de entradas / transiciones** | `PASA` con observación | `PASA` con observación | `PASA` con observación | Si el jugador presiona `J` cerca de un arma (`<48 px`), recoge el arma en lugar de golpear. Con `< 80 ms` entre `J` y `K` se activa Especial en vez de ataque/salto individual. |

---

## 5. Matriz de Pruebas de Colisión y Objetos

| Escenario de colisión | Estado | Evidencia (`[CÓDIGO]` / `[NAVEGADOR]`) |
| :--- | :--- | :--- |
| **Enemigos delante del jugador** | `PASA` | Impacto consistente en `N1Z1` y contra `EL TRONCO` en `10-boss1-combat.png` y `13-boss1-phase2.png`. |
| **Enemigos detrás del jugador** | `FALLA` potencial (`[CÓDIGO]` + `[NAVEGADOR]`) | En `overlapsHitbox25D`, `atkX = p.x + facing * reach * 0.55` deja el borde trasero en `p.x + 0.05 * reach`; contra un enemigo de `halfBw = 21 px` pegado por detrás (`|Δx| <= ~18 px`), el golpe frontal sigue solapando su hurtbox (`09-debug-hitboxes.png`). |
| **Enemigos en profundidad `Y` diferente** | `PASA` | `[NAVEGADOR]` Al mover al jugador hacia arriba (`WALK_MIN_Y`), el puntaje permaneció en `0 PTS` sin conectar (`ptsBeforeOffDepth: "0", ptsAfterOffDepth: "0"`). `[CÓDIGO]` Tolerancia estricta `<= 22 px`. |
| **Golpes mientras el jugador salta** | `PASA` | `airKick` verifica colisión 3D (`Z`) en cada tick hasta aterrizar (`06-bayron-airkick.png`). |
| **Golpes contra enemigos derribados** | `PASA` | `[CÓDIGO]` `checkPlayerMeleeHits` ignora explícitamente `e.state === 'knockdown'` y `b.state === 'knockdown'` (`engine.ts:1754, 1768`); confirmado en `13-boss1-phase2.png` cuando `EL TRONCO` cae tras el impacto. |
| **Golpes con armas** | `NO VERIFICADO` en navegador (`PASA` en `[CÓDIGO]`) | No se forzó dropeo/recogida de arma (`tubo` está en `N1Z3` x=3250). En código suman `damage` y `reachBonus` en combo terrestre, pero no en `airKick`. |
| **Golpes contra objetos rompibles** | `PASA` | `[NAVEGADOR]` En `08-crismj-combat.png` se observa el cajón iluminado en blanco tras recibir impacto (`hitFlashTimer`), y en `engine.ts:2874` requiere 2 golpes (`hp=2`). |

---

## 6. Matriz de Enemigos, Director de Atacantes y Jefe 1

- **Progresión normal observada (`N1Z1`):** Verificados `ZOMBIE DEL PANTANO` y `CACHORRO` en combate real con Bayron, Marcianeke y Cris MJ (desplazamiento, ataque, drenaje/daño de cachorro `-12` / zombie, `KO` y puntuación `+150/+200`).
- **Enemigos no alcanzados en progresión normal durante la ventana exploratoria (`canero`, `domestico`, `chupetona`, `fan`, `manager`):** `NO VERIFICADO` en navegador (documentados íntegramente en §3.6 desde `[CÓDIGO]`).
- **Agarre del jugador (`grabHold`, `grabKnee`, `grabThrow`):** `NO VERIFICADO` en navegador durante la sesión exploratoria; lógica verificada en `[CÓDIGO]` y pruebas unitarias (`rules.test.ts` test 22).
- **Jefe 1 (`EL TRONCO`) — Verificado mediante `?debug=1` (`F3`/`F4`, claramente separado de progresión normal):**
  - `PASA`: Intro y diálogo (`bossStart`), barra de jefe (`250/250`), ataque `stompWave` con anillo expansivo amarillo en `10-boss1-combat.png`, reducción de HP por combos (`250 → 228 → 206 → ... → 121/250`), derribo por umbral de 25% y llegada a Fase 2 (`<= 50%` HP) con aparición de refuerzo `cachorro` a la izquierda en `13-boss1-phase2.png`.
- **Jefes 2, 3, 4 y 5:** `NO VERIFICADO` en navegador (documentados en §3.7 desde `[CÓDIGO]`).

---

## 7. Controles, Escritorio (`1365x768`) vs Móvil (`390x844`) y Consola/Red

- **Controles de Teclado (`[CÓDIGO]` vs UI):** El modal `CONTROLES DE CALLE` (`02-controls-modal.png`) coincide con `engine.ts` (`Flechas/WASD`, `J`, `K`, `J+K`, `P/Enter/M`). `Space` solo avanza menús/prólogo/victoria; no salta ni ataca en combate.
- **Mando Xbox:** Lógica y cruceta (`buttons` + `axes[6/7]` + `axes[9]` POV hat) cubiertas por pruebas unitarias en `rules.test.ts` test 19 (`PASA`), pero **`NO VERIFICADO` en navegador con hardware físico conectado**.
- **Escritorio `1365x768` (`01..10, 13`):** Renderizado limpio sin desbordes. Único detalle menor: en la barra de último objetivo (`w-44`), `ZOMBIE DEL PANTANO` se trunca como `ZOMBIE DEL PANT… 16` (`08-crismj-combat.png`, `09-debug-hitboxes.png`).
- **Móvil `390x844` (`11-mobile-menu-390x844.png`, `12-mobile-combat-390x844.png`):**
  - `FALLA` visual en portada (`11-mobile-menu-390x844.png`): El botón flotante de sonido (esquina superior derecha) **se superpone sobre la letra final del logo `FIRMADO EN SANGRE`**.
  - `PASA` funcional en combate (`12-mobile-combat-390x844.png`): `Joystick táctil`, `ESP`, `B` y `A` visibles bajo el canvas sin tapar la arena; los eventos pointer sobre `ESP` dispararon `¡TUU MALDITO!`. El nombre `BAYRON FIRE` en HUD superior izquierdo se trunca a `BAYRON F_`.
- **Consola y Red:** **0 errores y 0 advertencias** en consola (`Total messages: 3 (Errors: 0, Warnings: 0)`). Todos los assets de sprites, audio y fuentes respondieron `200 OK` / `206 Partial Content`.

---

## 8. Discrepancias Código vs Navegador y Lista Priorizada de Problemas Verificables

### Severidad Alta (P0 — Afecta sensación y justicia del combate)
1. **Hitboxes activas en frame 0 y corte prematuro de animación al enlazar combo (`engine.ts:1347, 1356, sprites.ts:55-68`):** El golpe conecta antes de extender el puño y `step < 3 && p.stateTimer < 0.14` permite saltar al siguiente paso a los `40 ms` de `attack1/2` (`0.18 s`).
2. **Especiales multi-golpe resueltos en un único tick (`data.ts:65-96, engine.ts:1633-1645`):** `Marcianeke` (`[7,7]`) y `Cris MJ` (`[5,5,4]`) aplican `14` de golpe instantáneo en el frame 1 (`07-marcianeke-combat.png`, `08-crismj-combat.png`), contradiciendo su diseño y descripción.
3. **Ausencia de `attackCooldown` en disparos y drenajes enemigos (`engine.ts:2180-2181, 2232-2240`):** `domestico`, `manager`, `zombie` y `chupetona` solo asignan `recover` (`0.60–0.70 s`) sin asignar `attackCooldown` (`1.40 s`), lo que permite re-telegrafiar apenas terminan de recuperarse.

### Severidad Media (P1 — Afecta legibilidad, balance y depuración)
4. **Hitbox de depuración `F1` no representa la colisión real (`renderer.ts:1278` vs `engine.ts:1745`):** Dibuja `62x60` fija sin reflejar `reach` (`54..96 px`) ni altura `96 px` (`09-debug-hitboxes.png`).
5. **Solapamiento por detrás en golpes frontales (`engine.ts:1745`):** Con `atkX = p.x + facing * reach * 0.55` y hurtbox enemiga de `42 px`, enemigos pegados por la espalda pueden ser golpeados por ataques hacia adelante (`09-debug-hitboxes.png`).
6. **`airKick` ignora arma equipada y `Cris MJ` carece de recuperación en `shoulder` (`engine.ts:1331, data.ts:107`):** Patada aérea siempre hace `10` de daño sin `reachBonus` y `shoulderRecovery = 0` elimina riesgo en la embestida de Cris MJ.
7. **Recogida de arma intercepta el ataque (`engine.ts:1430`):** En combate cuerpo a cuerpo sobre un arma caída, presionar `J` obliga a recogerla en vez de golpear.
8. **Discrepancia `countActiveAttackers` (`rules.ts` vs `engine.ts:2031`):** `rules.ts` no incluye `'draining'`, mientras `engine.ts` sí lo contabiliza como token activo.
9. **Solapamiento UI en móvil `390x844` (`11-mobile-menu-390x844.png`):** Botón de sonido tapa el borde derecho del logo en el menú principal.

### Severidad Baja (P2 — Deuda técnica y coherencia)
10. **`node --test` falla sin `tsx` por imports sin extensión en `rules.test.ts` (`package.json` carece de script `"test"`).**
11. **Identidad comercial desalineada en `README.md` y `metadata.json` (`PACTO EN SANGRE` vs `FIRMADO EN SANGRE`).**
12. **Constante muerta `RUN_SPEED` (`data.ts:18`) y truncamiento menor de etiquetas en HUD (`ZOMBIE DEL PANT…`, `BAYRON F_`).**

---

## 9. Propuestas de Mejora (NO Implementadas en OT-01)

1. **OT-02 (Frame data real):** Separar fases `startup / active / recovery` por movimiento en `data.ts` y restringir la ventana de cancelación (`comboCancelStart`) después de los frames activos para sincronizar golpe visual y hitbox.
2. **OT-03 (Especiales multi-tick y depuración fiel):** Emitir los impactos de `specialHits` con temporizadores reales y alimentar el overlay `F1` directamente con los valores de `overlapsHitbox25D`.
3. **OT-04 (Saneamiento de IA enemiga):** Homologar `attackCooldown` al finalizar disparos a distancia y drenajes, y unificar `countActiveAttackers` entre `rules.ts` y `engine.ts`.
4. **OT-05 (UI móvil y comandos):** Ajustar el ancho/margen del logo en `<640 px`, añadir script `"test": "tsx --test src/game/rules.test.ts"` y unificar `README.md` y `metadata.json` a `FIRMADO EN SANGRE`.

---

## 10. Evidencia de Artefactos (`artifacts/qa/combat-baseline/`)

- `01-menu-desktop-1365x768.png` — Menú principal escritorio.
- `02-controls-modal.png` — Modal `CONTROLES DE CALLE`.
- `03-char-select-desktop.png` — Selección de personajes (`Bayron Fire`, `Marcianeke`, `Cris MJ`).
- `04-bayron-combo.png` — Escenario Nivel 1 con Bayron Fire.
- `05-bayron-special.png` — Especial `¡TUU MALDITO!` (`-8 HP`).
- `06-bayron-airkick.png` — Patada aérea de Bayron Fire.
- `07-marcianeke-combat.png` — Especial `¡QUE SABEN DE CORTE!` (`-14` único hit + `-8 HP`).
- `08-crismj-combat.png` — Especial `¡QUE VIVA EL MONEY!` (`-14` único hit + `-8 HP` + impacto a cajón).
- `09-debug-hitboxes.png` — Cajas `F1` visibles (jugador, enemigos y hitbox fija `62x60`).
- `10-boss1-combat.png` — Combate contra Jefe 1 `EL TRONCO` (`206/250 HP`, `stompWave` activo, `-10`).
- `11-mobile-menu-390x844.png` — Menú en móvil `390x844` (solapamiento botón sonido/logo).
- `12-mobile-combat-390x844.png` — Combate en móvil con joystick virtual + `A`, `B`, `ESP`.
- `13-boss1-phase2.png` — Jefe 1 en `121/250 HP` derribado (`-11`) con refuerzo `cachorro` en Fase 2.
- `combat-desktop.webm` — Grabación de combate multi-personaje y cajas `F1`.
- `boss1-combat-desktop.webm` — Grabación de combate contra Jefe 1.

---

## 11. Matriz de Criterios de Aceptación (CA-01 .. CA-11)

| ID | Criterio | Estado | Nota |
| :--- | :--- | :--- | :--- |
| **CA-01** | Código de producción intacto y cero dependencias nuevas | `PASA` | Ningún archivo en `src/`, `public/`, `package.json` ni `README.md` fue modificado. |
| **CA-02** | Inventario completo del combate con valores reales del código | `PASA` | §3 documenta todos los valores con archivo y línea exactos (`NO ENCONTRADO` donde aplica). |
| **CA-03** | Pruebas de combate ejecutadas para los 3 personajes jugables | `PASA` | Probados Bayron Fire, Marcianeke y Cris MJ en navegador y código (§4). |
| **CA-04** | Pruebas de colisión 2.5D y objetos documentadas | `PASA` con excepciones | Frente, espalda, profundidad Y, aire, derribo y rompible verificados; armas en navegador `NO VERIFICADO` (§5). |
| **CA-05** | Revisión de enemigos, tokens de ataque y drenaje | `PASA` parcial | Inventario completo en código; en navegador solo `zombie` y `cachorro` en N1Z1 (resto `NO VERIFICADO`). |
| **CA-06** | Revisión del combate contra el primer jefe (`El Tronco`) | `PASA` (asistido por `?debug`) | Verificado con `F4` hasta Fase 2 (`121/250 HP`) y spawn de refuerzo; los 5 jefes documentados en código. |
| **CA-07** | Ejecución de lint, build y tests unitarios con salida literal | `PASA` | `lint` OK, `build` OK, `node --test` falla por imports `.ts`, `tsx --test` pasa `22/22`. |
| **CA-08** | Pruebas exploratorias desktop (`1365x768`) y móvil (`390x844`) | `PASA` | Ejecutadas vía `playwright-cli`; 0 errores consola/red; hallazgo UI móvil documentado. |
| **CA-09** | Evidencia visual (capturas + `.webm`) guardada en `artifacts/qa/combat-baseline/` | `PASA` | 13 capturas PNG y 2 grabaciones `.webm` inspeccionadas visualmente. |
| **CA-10** | Documentos `docs/COMBAT_AUDIT.md` y `docs/DECISIONS.md` creados | `PASA` | Creados con separación estricta `[CÓDIGO]` vs `[NAVEGADOR]`. |
| **CA-11** | Commit de auditoría y tag `audit-combat-baseline-2026-11-20` en Git | `FALLA` / `NO APLICABLE` | El entorno `/app/applet` no contiene repositorio `.git` (`fatal: not a git repository`). No se inicializó repositorio para no alterar la estructura base del proyecto. |
