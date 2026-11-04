# F1 Explorer — Proyecto Fase 2

Aplicación web para consultar información de Fórmula 1 (pilotos, carreras, circuitos y
resultados) usando **HTML, CSS, Bootstrap 5 y JavaScript**, consumiendo la **Jolpica F1 API**.

## Cómo ejecutar
1. Abre `index.html` en un navegador moderno, **o**
2. Sírvelo con un servidor local: `python3 -m http.server 8000` y abre http://localhost:8000
3. Requiere conexión a internet (API en vivo + Bootstrap por CDN).

## Estructura
- `index.html` — estructura y las 5 vistas (Home, Búsqueda, Resultados, Detalle, Calendario).
- `css/styles.css` — estilos propios + media queries (responsividad).
- `js/app.js` — lógica, consumo de la API (fetch) y renderizado dinámico.
