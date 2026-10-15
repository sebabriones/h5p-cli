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

- El `.h5p` descargado lleva `h5p.json` en la raíz y la carpeta `content/` al lado. No incluye librerías: el visor las toma de su repositorio. `h5p.json` lista esas dependencias en `preloadedDependencies`.
- El nombre de la actividad conserva letras, números, guion y guion bajo. `prueba_1` no pasa a `prueba1`.
- No se crea la carpeta `sessions`.

Las actividades creadas con el CLI anterior, con `content.json` junto a `h5p.json`, siguen abriendo.

## Arranque

Los comandos se ejecutan dentro de esta carpeta. `npx h5p` no usa este repositorio.

```bash
npm install
node h5p.js core
node h5p.js server
```

El panel queda en `http://localhost:8080/dashboard`.

`core` clona `h5p-editor-php-library` y `h5p-php-library`, y prepara `h5p-math-display`. Hay que tener Git disponible.

Para una librería concreta, por ejemplo Course Presentation:

```bash
node h5p.js setup h5p-course-presentation
```

El mismo patrón vale para el resto. `node h5p.js help` lista los comandos. El servidor busca las librerías en la carpeta desde la que se lanzó.
