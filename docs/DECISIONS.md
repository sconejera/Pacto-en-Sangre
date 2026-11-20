# DECISIONES CERRADAS DE ARQUITECTURA Y PRODUCTO — FIRMADO EN SANGRE

Fecha de actualización: **2026-11-20**  
Origen: **OT-01 v1.0** y **OT-02 v1.2**

---

## 1. Decisiones Cerradas

| Área | Decisión oficial | Alcance / Implicancia |
| :--- | :--- | :--- |
| **Naturaleza del proyecto** | Proyecto de fans **no comercial y sin difusión masiva**. | No requiere publicación comercial ni infraestructura multijugador externa. |
| **Modo de juego** | **Un solo jugador** (1P activo; arquitectura limpia centrada en la experiencia individual). | El combate y el balance se diseñan y verifican exclusivamente para un jugador. |
| **Motor de simulación y render** | Mantener el motor **Canvas 2D** propio existente (`NoFirmoEngine` + `renderWorld` en `src/game/`). **No migrar a Phaser ni reconstruir el juego.** | Toda mejora se aplica incrementalmente sobre `engine.ts`, `rules.ts`, `data.ts` y `renderer.ts`. |
| **Identidad comercial oficial** | **FIRMADO EN SANGRE** | Toda documentación oficial, código, UI y builds convergen a `FIRMADO EN SANGRE`. |
| **Prioridad de ingeniería** | **Combate** como prioridad absoluta. | Fases de ataque medibles (`startup / active / recovery`) a `60 Hz` definidas en `ATTACK_FRAME_DATA` (`data.ts`) con funciones puras en `rules.ts`, hitbox sincronizada con depuración `F1` y preservación de personajes, enemigos, jefes y recursos existentes. |

---

## 2. Registro de Implementación OT-02 (Fases de Ataque del Jugador)

- **Simulación por ticks a 60 Hz (`attackTick`):** Los ataques `combo1`, `combo2`, `combo3` y `airKick` evalúan impacto exclusivamente durante la fase `active` (`startupTicks <= attackTick < startupTicks + activeTicks`).
- **Ventana de encadenamiento:** El enlace `combo1 → combo2 → combo3` (`canChainFromTick`) se habilita únicamente al concluir la fase `active` (`attackTick >= startupTicks + activeTicks`), incluso al fallar el golpe, manteniendo el buffer de entrada de `0.11 s`.
- **Sincronización pose-hitbox:** `renderer.ts` selecciona el slot `[0..3]` con `getAttackFrameSlot` y dibuja en `F1` la hitbox exacta construida con `buildAttackHitboxInto` solo durante la fase `active`, eliminando el solapamiento frontal por detrás de la espalda del jugador (`hitStartX = 12 px`).
- **Pendiente de OT posterior (fuera de alcance OT-02):** Alinear `README.md` y `metadata.json` si conservan títulos previos, y resolver especiales multi-tick y `attackCooldown` de disparos/drenajes enemigos.
- **Registro OT-03 (Reacción al daño del jugador):** Al entrar en `hurt`, `knockdown`, `ko`, `getup` o `grabbedByEnemy` se reinicia `p.animTime = 0`, `hurt` dura 3 frames en pose `12` y 1 en `4` (`[12, 12, 12, 4]`, 10 fps), `grabbedByEnemy` fija la pose `12`, y el gancho DEV usa `import.meta.env.MODE !== 'production'`.
