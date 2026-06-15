# Handoff — Modo nuevo: "País en el mapa" (online)

> **Para quién:** el que arma el frontend.
> **Qué es:** un modo de juego **solo online** donde se muestra el mapa mundial, cada ronda se
> prende un país en verde, y el jugador **escribe** el nombre del país (en inglés, exacto).
> El backend ya está hecho. Acá tenés **todo**: setup, base de datos, dependencias y qué construir.

---

## PARTE 1 — Poner el proyecto al día (hacelo una vez)

### 1.1 Traer el código
```bash
git pull
```

### 1.2 Backend — dependencias
```bash
cd backend
npm install
```
(Trae deps nuevas que se agregaron, como `nodemailer`. No hay deps nuevas específicas del modo mapa.)

### 1.3 Base de datos (pgAdmin)

**a)** Agregá la columna nueva a tu base local (Query Tool):
```sql
ALTER TABLE paises ADD COLUMN IF NOT EXISTS iso_code VARCHAR(3);
```

**b)** Re-corré el seed para repoblar los países con el `iso_code` (y banderas + siluetas + fotos):
```bash
cd backend
node seed/seedPaises.js
```

Qué hace el seed:
- Baja los países de un dataset estático (mledoze en GitHub — restcountries se deprecó).
- Llena `iso_code` con el código ISO numérico (`ccn3`) → es lo que usa el mapa para prender el país correcto.
- Pone banderas (flagcdn) como `imagen_pais`, actualiza siluetas, y **re-engancha tus fotos locales** de `frontend/public/images/paises` (las que tengan archivo).
- Necesita **internet**. Reemplaza la tabla `paises` (NO toca usuarios, amigos, partidas ni torneos).

Al final tenés que ver algo como `Actualizados: 197` (tus fotos locales volviendo a engancharse).

### 1.4 Frontend — dependencias
```bash
cd frontEnd
npm install
npm install react-simple-maps
```

---

## PARTE 2 — Qué es el modo (y cómo funciona)

- **Solo online.** Se juega como una partida 1v1 normal (mismas vidas, racha, freeze, timer, chat).
- Cada ronda el server elige un país y le manda al cliente **solo el código ISO** (`iso`) para prender ese país en verde — **nunca el nombre** (anti-trampa).
- El jugador **escribe** el nombre (en **inglés**, como está en la base). Validación **exacta** (solo se perdonan mayúsculas y tildes, no errores de tipeo).
- **100 países al azar** por partida.
- El **50/50 no aplica** en este modo (no hay opciones).

---

## PARTE 3 — Qué tenés que construir (la pantalla del mapa)

Una pantalla para el modo `"country-by-map"` que:

1. Renderiza el **mapa mundial** con `react-simple-maps` (todos los países oscuros).
2. **Prende en verde** el país cuyo `geo.id` coincide con `question.iso`.
3. Tiene un **input de texto** + botón para responder (en vez de los 4 botones de opción).
4. Manda la respuesta con el **mismo evento de siempre**: `game:answer { index, option: textoEscrito }`.
5. **Oculta el botón de 50/50** (no aplica). El resto (vidas, racha, freeze, timer, chat) va igual.

### Ejemplo de referencia (ajustá estilos a gusto)

```jsx
import { ComposableMap, Geographies, Geography } from "react-simple-maps";

const GEO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

function MapaPregunta({ isoObjetivo }) {
    return (
        <ComposableMap projection="geoMercator">
            <Geographies geography={GEO_URL}>
                {({ geographies }) =>
                    geographies.map((geo) => {
                        // OJO: comparar con Number() por los ceros a la izquierda ("032")
                        const esObjetivo = Number(geo.id) === Number(isoObjetivo);
                        return (
                            <Geography
                                key={geo.rsmKey}
                                geography={geo}
                                style={{
                                    default: {
                                        fill: esObjetivo ? "#22c55e" : "#1e293b",
                                        stroke: "#0f172a",
                                        strokeWidth: 0.3,
                                        outline: "none",
                                    },
                                    hover: {
                                        fill: esObjetivo ? "#22c55e" : "#1e293b",
                                        outline: "none",
                                    },
                                    pressed: { outline: "none" },
                                }}
                            />
                        );
                    })
                }
            </Geographies>
        </ComposableMap>
    );
}
```

Y el input:

```jsx
// al enviar:
socket.emit("game:answer", { index: question.index, option: texto.trim() }, (res) => {
    if (res.error) { /* mostrar error (ej. "Estás congelado") */ return; }
    // res.correct (bool), res.correctValue (nombre correcto, para mostrarlo),
    // res.lives, res.correctCount, res.correctStreak, res.nextQuestion, etc.
});
```

---

## PARTE 4 — Contrato de eventos (lo que cambia vs. los otros modos)

- **Crear/jugar la sala** con `mode: "country-by-map"` (igual que los otros modos online, vía `room:create { mode: "country-by-map" }`).
- **`game:started`** → `{ totalQuestions: 100, question: { index, iso }, matchEndsAt }`.
- **La pregunta** en este modo es `{ index, iso }` — **sin `options` ni nombre**. El `iso` es el código numérico para prender el país.
- **Responder**: `game:answer { index, option: <texto escrito> }`. El callback trae `correct`, `correctValue` (el nombre correcto, se revela después de responder), `lives`, `correctCount`, `wrongCount`, `correctStreak`, `nextQuestion`, etc.
- **Todo lo demás igual**: `game:progress`, `powerup:awarded`, `player:frozen`, `game:over`, `game:abandoned`, chat. Reusás la misma lógica de partida online que ya tenés.

---

## PARTE 5 — Detalles del mapa

- **TopoJSON**: `https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json`.
- `geo.id` es el **ISO 3166-1 numérico** (ej. `"032"` = Argentina). Compará con `Number(geo.id) === Number(question.iso)` para evitar líos con ceros a la izquierda.
- El `110m` no incluye algunos **micro-países** (muy chicos para dibujar) → esos no se prenderían. Si querés más cobertura, usá `countries-50m.json` (mismo formato, más detalle).
- Los nombres a escribir están en **inglés** (ej. "United States", "Germany").

---

## Resumen de tu checklist

1. `git pull`
2. `cd backend && npm install`
3. pgAdmin: `ALTER TABLE paises ADD COLUMN IF NOT EXISTS iso_code VARCHAR(3);`
4. `cd backend && node seed/seedPaises.js` (con internet)
5. `cd frontEnd && npm install && npm install react-simple-maps`
6. Construir la pantalla del modo `"country-by-map"`: mapa + país en verde por `iso` + input de texto, ocultando el 50/50.

Cualquier duda del contrato (qué manda el server, qué esperar), está todo en las Partes 4 y 5.
