# h5p-cli (fork)

Herramienta para crear, editar y exportar actividades H5P. Este fork parte de h5p-cli 1.1.7 y cambia cómo se resuelven las librerías y cómo se guarda el paquete.

Hace falta [Git](https://git-scm.com/downloads), [Node.js](https://nodejs.org/en/download/current) y npm.

## Qué cambia

- En la vista, al guardar y al exportar entran la librería principal y las que nombra `content.json`, oficiales o propias. Las librerías opcionales de `semantics.json` solo se cargan en el editor.
- La actividad se guarda así:

```text
content/<nombre>/h5p.json
content/<nombre>/content/content.json
content/<nombre>/content/images/…
content/<nombre>/content/videos/…
content/<nombre>/content/audios/…
```

- El `.h5p` descargado lleva `h5p.json` en la raíz, la carpeta `content/` al lado y las librerías de reproductor usadas (principal + embeds de `content.json`), como el CLI base. `h5p.json` lista esas dependencias en `preloadedDependencies`.
- El nombre de la actividad conserva letras, números, guion y guion bajo. `prueba_1` no pasa a `prueba1`.
- No se crea la carpeta `sessions`.
- **Secciones y sub-secciones** (organización en el dashboard):
  - Sin sección: las actividades siguen en `content/<actividad>/` y se listan en `/dashboard` (como antes).
  - Sección: `content/<seccion>/…` → `/dashboard/<seccion>`.
  - Sub-sección (anidable): `content/<seccion>/<sub>/…` → `/dashboard/<seccion>/<sub>`.
  - En cada nivel, **New** e **Import** crean actividades ahí; el botón **Sección** / **Sub-sección** crea una carpeta hija.
  - Sección/sub-sección = carpeta sin `h5p.json`. Solo se puede borrar si no tiene hijas ni actividades.
  - **Mover**: desde el dashboard se puede mover una actividad o una sección/sub-sección a la raíz u a otra sección (botón →). No se puede mover una sección dentro de sí misma ni de una hija.
  - En URLs de editar/ver/exportar, las rutas anidadas usan `::` (por ejemplo `ingles::unidad-1::quiz`).
  - Las actividades que ya existían en la raíz no se mueven solas.

Las actividades creadas con el CLI anterior, con `content.json` junto a `h5p.json`, siguen abriendo.

## Tests

```bash
npm test
```

Cubre `contentPaths` (codificación URL, breadcrumbs, listado de secciones/actividades y detección de hijas) con el runner nativo de Node (`node --test`).

## Arranque en otro equipo

Hace falta Git, Node.js y npm. Los comandos se ejecutan dentro de esta carpeta, después de clonar el repositorio. `npx h5p` no usa este repositorio.

```bash
npm install
node h5p.js core
node h5p.js server
```

`npm install` baja las dependencias de Node. `core` se ejecuta una sola vez: clona `h5p-editor-php-library` y `h5p-php-library`, y prepara `h5p-math-display`. Hay que tener Git disponible y salida a internet.

El panel queda en `http://localhost:8080/dashboard`. Ejemplos de sección y sub-sección: `/dashboard/ingles`, `/dashboard/ingles/unidad-1`.

Para usar otro puerto:

```bash
node h5p.js server 8090
```

El servidor busca las librerías en la carpeta desde la que se lanzó. Para volver a levantarlo en ese equipo basta `node h5p.js server`; no hace falta repetir `core` si las librerías base ya están clonadas.

Para una librería concreta, por ejemplo Course Presentation:

```bash
node h5p.js setup h5p-course-presentation
```

El mismo patrón vale para el resto. `node h5p.js help` lista los comandos.
