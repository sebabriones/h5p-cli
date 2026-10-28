const fs = require('fs');
const path = require('path');
const he = require('he');
const { imageSize } = require('image-size');
const logic = require('./logic.js');
const config = require('./configLoader.js');
const contentPaths = require('./contentPaths.js');
const l10n = require('./assets/l10n.json');
const supportedLanguages = require(`${require.main.path}/${config.folders.assets}/languageCatcher.js`);
let session = {
  name: 'main-session',
  language: 'en',
  status: ''
}
module.exports = {
  // load favicon.ico file
  favicon: (request, response, next) => {
    try {
      const icon = fs.readFileSync(`${require.main.path}/favicon.ico`);
      response.set('Content-Type', 'image/x-icon');
      response.end(icon);
    }
    catch (error) {
      handleError(error, response);
    }
  },
  // renders dashboard (root or /dashboard/seccion[/sub-seccion...])
  dashboard: async (request, response, next) => {
    try {
      manageSession(null, {
        language: request.query?.language,
        name: request.query?.session
      });
      let space = '';
      const rawPath = request.params.spacePath || request.params.space || request.params[0] || '';
      if (rawPath) {
        space = contentPaths.fromDashboardPath(rawPath);
        const spaceDir = contentPaths.contentDir(space);
        if (!fs.existsSync(spaceDir) || !contentPaths.isSpaceDir(spaceDir)) {
          throw new Error(`sección "${space}" no encontrada`);
        }
      }
      const html = fs.readFileSync(`${require.main.path}/${config.folders.assets}/templates/dashboard.html`, 'utf-8');
      const labels = await getLangLabels();
      const languageFiles = logic.getFileList(`${config.folders.libraries}/h5p-editor-php-library/language`);
      const languages = {};
      for (let item of languageFiles) {
        const key = item.match(/language\/(.*?)\.js/)?.[1];
        languages[key] = supportedLanguages[key];
      }
      let input = {
        assets: config.folders.assets,
        api: config.api,
        status: session.status,
        language: session.language,
        languages: JSON.stringify(languages),
        space,
        spaceJson: JSON.stringify(space),
        spaceLabel: space ? contentPaths.basenameOf(space) : '',
        sectionButtonLabel: space ? 'Sub-sección' : 'Sección',
        sectionsTitle: space ? 'Sub-secciones' : 'Secciones',
        breadcrumbRootLabel: labels.lang_dashboard || 'Dashboard'
      }
      input = {...input, ...labels};
      response.set('Content-Type', 'text/html');
      response.end(logic.fromTemplate(html, input));
      session.status = '';
    }
    catch (error) {
      handleError(error, response);
    }
  },
  // lists runnable libraries
  contentTypes: async (request, response, next) => {
    try {
      const registry = await logic.getRegistry();
      const libraryDirs = await logic.parseLibraryFolders();
      if (!registry.runnable) {
        registry.runnable = {};
        const list = [];
        for (let item in registry.regular) {
          if (registry.regular[item].runnable && libraryDirs[registry.regular[item].id]) {
            list.push(item);
          }
        }
        list.sort((a, b) => {
          const first = a.toLowerCase();
          const second = b.toLowerCase();
          if (first < second) {
            return -1;
          }
          if (first > second) {
            return 1;
          }
          return 0;
        });
        for (let item of list) {
          registry.runnable[item] = registry.regular[item];
        }
      }
      response.set('Content-Type', 'application/json');
      response.end(JSON.stringify(registry.runnable));
    }
    catch (error) {
      handleError(error, response);
    }
  },
  // updates session file used for resume functionality
  setUserData: (request, response, next) => {
    try {
      normalizeFolderParam(request);
      manageSession(request.params.folder, {
        language: request.query?.language,
        name: request.query?.session
      });
      if (session.name == 'null') {
        response.set('Content-Type', 'application/json');
        response.end(JSON.stringify({success: true}));
        return;
      }
      response.set('Content-Type', 'application/json');
      response.end(JSON.stringify({success: true}));
    }
    catch (error) {
      handleError(error, response);
    }
  },
  // deletes the session file used for resume functionality
  resetUserData: (request, response, next) => {
    try {
      normalizeFolderParam(request);
      const dataFile = `content/${request.params.folder}/sessions/${session.name}.json`;
      response.set('Content-Type', 'application/json');
      if (fs.existsSync(dataFile)) {
        fs.unlinkSync(dataFile);
        response.end(JSON.stringify({success: true}));
      }
      else {
        response.end(JSON.stringify({success: true, message: 'no_file'}));
      }
    }
    catch (error) {
      handleError(error, response);
    }
  },
  // retrieves session data for resume functionality
  getUserData: (request, response, next) => {
    try {
      normalizeFolderParam(request);
      manageSession(request.params.folder, {
        language: request.query?.language,
        name: request.query?.session
      });
      const data = getSession(request.params.folder);
      response.set('Content-Type', 'application/json');
      response.end(JSON.stringify(data?.[0] || {}));
    }
    catch (error) {
      handleError(error, response);
    }
  },
  // import zipped archive of content type
  import: (request, response, next) => {
    try {
      const parent = resolveParentQuery(request);
      const name = contentPaths.sanitizeSegment(request.params.folder);
      const relative = contentPaths.joinParent(parent, name);
      const imported = logic.import(relative, request.file.path);
      fs.rmSync(request.file.path);
      response.set('Content-Type', 'application/json');
      response.end(JSON.stringify({ path: imported }));
    }
    catch (error) {
      handleError(error, response);
    }
  },
  // download zipped archive of content type
  export: async (request, response, next) => {
    try {
      normalizeFolderParam(request);
      const file = await logic.export(request.params.library, request.params.folder);
      response.download(file);
    }
    catch (error) {
      handleError(error, response);
    }
  },
  // create empty content type
  create: async (request, response, next) => {
    try {
      const parent = resolveParentQuery(request);
      const name = contentPaths.sanitizeSegment(request.params.folder);
      const relative = contentPaths.joinParent(parent, name);
      const target = contentPaths.contentDir(relative);
      if (fs.existsSync(target)) {
        response.set('Content-Type', 'application/json');
        response.end(JSON.stringify({
          error: `la carpeta "${target}" ya existe`
        }));
        return;
      }
      if (parent) {
        const spaceDir = contentPaths.contentDir(parent);
        if (!fs.existsSync(spaceDir) || !contentPaths.isSpaceDir(spaceDir)) {
          throw new Error(`sección "${parent}" no encontrada`);
        }
      }
      fs.mkdirSync(`${target}/content`, { recursive: true });
      fs.writeFileSync(`${target}/content/content.json`, JSON.stringify({}));
      await logic.generateInfo(relative, request.params.type);
      response.set('Content-Type', 'application/json');
      response.end(JSON.stringify({
        result: contentPaths.toUrlFolder(relative)
      }));
    }
    catch (error) {
      handleError(error, response);
    }
  },
  // copies a content folder and sets its title to the new folder name
  copy: (request, response, next) => {
    try {
      const source = contentPaths.fromUrlFolder(request.params.folder);
      const parent = contentPaths.parentOf(source);
      const requestedName = request.body?.folder || `${contentPaths.basenameOf(source)}-copia`;
      const target = contentPaths.joinParent(parent, requestedName);
      if (source === target) {
        throw new Error('elige otro nombre de carpeta');
      }
      const sourcePath = contentPaths.contentDir(source);
      const targetPath = contentPaths.contentDir(target);
      if (!contentPaths.isActivityDir(sourcePath)) {
        throw new Error(`actividad "content/${source}" no encontrada`);
      }
      if (fs.existsSync(targetPath)) {
        throw new Error(`la carpeta "content/${target}" ya existe`);
      }
      fs.cpSync(sourcePath, targetPath, { recursive: true });
      writeContentTitle(target, contentPaths.basenameOf(target));
      response.set('Content-Type', 'application/json');
      response.end(JSON.stringify({ result: contentPaths.toUrlFolder(target) }));
    }
    catch (error) {
      handleError(error, response);
    }
  },
  // renames a content folder and its displayed title
  rename: (request, response, next) => {
    try {
      const source = contentPaths.fromUrlFolder(request.params.folder);
      const parent = contentPaths.parentOf(source);
      const target = contentPaths.joinParent(parent, request.body?.folder || '');
      if (source === target) {
        response.set('Content-Type', 'application/json');
        response.end(JSON.stringify({ result: contentPaths.toUrlFolder(target) }));
        return;
      }
      const sourcePath = contentPaths.contentDir(source);
      const targetPath = contentPaths.contentDir(target);
      if (!contentPaths.isActivityDir(sourcePath)) {
        throw new Error(`actividad "content/${source}" no encontrada`);
      }
      if (fs.existsSync(targetPath)) {
        throw new Error(`la carpeta "content/${target}" ya existe`);
      }
      fs.renameSync(sourcePath, targetPath);
      writeContentTitle(target, contentPaths.basenameOf(target));
      response.set('Content-Type', 'application/json');
      response.end(JSON.stringify({ result: contentPaths.toUrlFolder(target) }));
    }
    catch (error) {
      handleError(error, response);
    }
  },
  // deletes a content folder
  remove: (request, response, next) => {
    try {
      const relative = contentPaths.fromUrlFolder(request.params.folder);
      const target = contentPaths.contentDir(relative);
      if (!contentPaths.isActivityDir(target)) {
        throw new Error(`actividad "content/${relative}" no encontrada`);
      }
      fs.rmSync(target, { recursive: true, force: true });
      response.set('Content-Type', 'application/json');
      response.end(JSON.stringify({result: `eliminada "content/${relative}"`}));
    }
    catch (error) {
      handleError(error, response);
    }
  },
  // move activity to another section (parent '' = root)
  move: (request, response, next) => {
    try {
      const source = contentPaths.fromUrlFolder(request.params.folder);
      const sourcePath = contentPaths.contentDir(source);
      if (!contentPaths.isActivityDir(sourcePath)) {
        throw new Error(`actividad "content/${source}" no encontrada`);
      }
      const parentRaw = request.body?.parent;
      const parent = (parentRaw === undefined || parentRaw === null || parentRaw === '')
        ? ''
        : contentPaths.assertSafeRelative(String(parentRaw));
      if (parent) {
        const parentDir = contentPaths.contentDir(parent);
        if (!fs.existsSync(parentDir) || !contentPaths.isSpaceDir(parentDir)) {
          throw new Error(`sección destino "${parent}" no encontrada`);
        }
      }
      const baseName = request.body?.folder
        ? contentPaths.sanitizeSegment(request.body.folder)
        : contentPaths.basenameOf(source);
      const target = contentPaths.joinParent(parent, baseName);
      if (source === target) {
        response.set('Content-Type', 'application/json');
        response.end(JSON.stringify({
          result: contentPaths.toUrlFolder(target),
          parent,
          href: contentPaths.toDashboardHref(parent)
        }));
        return;
      }
      const targetPath = contentPaths.contentDir(target);
      if (fs.existsSync(targetPath)) {
        throw new Error(`la carpeta "content/${target}" ya existe`);
      }
      fs.renameSync(sourcePath, targetPath);
      response.set('Content-Type', 'application/json');
      response.end(JSON.stringify({
        result: contentPaths.toUrlFolder(target),
        parent,
        href: contentPaths.toDashboardHref(parent)
      }));
    }
    catch (error) {
      handleError(error, response);
    }
  },
  // list possible section destinations (including root)
  destinations: (request, response, next) => {
    try {
      const paths = contentPaths.listAllSpacePaths();
      const list = [
        { path: '', label: 'Dashboard (raíz)', href: '/dashboard' }
      ];
      for (const item of paths) {
        list.push({
          path: item,
          label: item.split('/').join(' / '),
          href: contentPaths.toDashboardHref(item)
        });
      }
      response.set('Content-Type', 'application/json');
      response.end(JSON.stringify({ list }));
    }
    catch (error) {
      handleError(error, response);
    }
  },
  // create space or subsection under optional parent
  createSpace: (request, response, next) => {
    try {
      const parentRaw = request.body?.parent || '';
      const parent = parentRaw ? contentPaths.assertSafeRelative(String(parentRaw)) : '';
      if (parent) {
        const parentDir = contentPaths.contentDir(parent);
        if (!fs.existsSync(parentDir) || !contentPaths.isSpaceDir(parentDir)) {
          throw new Error(`sección "${parent}" no encontrada`);
        }
      }
      const name = contentPaths.sanitizeSegment(request.body?.name || request.body?.folder || '');
      const relative = contentPaths.joinParent(parent, name);
      const target = contentPaths.contentDir(relative);
      if (fs.existsSync(target)) {
        throw new Error(`la carpeta "content/${relative}" ya existe`);
      }
      fs.mkdirSync(target, { recursive: true });
      response.set('Content-Type', 'application/json');
      response.end(JSON.stringify({ result: relative, href: contentPaths.toDashboardHref(relative) }));
    }
    catch (error) {
      handleError(error, response);
    }
  },
  // rename space/section (keeps parent path)
  renameSpace: (request, response, next) => {
    try {
      const source = contentPaths.fromUrlFolder(request.params.space);
      const parent = contentPaths.parentOf(source);
      const target = contentPaths.joinParent(parent, request.body?.name || request.body?.folder || '');
      const sourcePath = contentPaths.contentDir(source);
      const targetPath = contentPaths.contentDir(target);
      if (!contentPaths.isSpaceDir(sourcePath)) {
        throw new Error(`sección "${source}" no encontrada`);
      }
      if (source === target) {
        response.set('Content-Type', 'application/json');
        response.end(JSON.stringify({ result: target, href: contentPaths.toDashboardHref(target) }));
        return;
      }
      if (fs.existsSync(targetPath)) {
        throw new Error(`la carpeta "content/${target}" ya existe`);
      }
      fs.renameSync(sourcePath, targetPath);
      response.set('Content-Type', 'application/json');
      response.end(JSON.stringify({ result: target, href: contentPaths.toDashboardHref(target) }));
    }
    catch (error) {
      handleError(error, response);
    }
  },
  // delete empty space/section (no activities or child sections)
  removeSpace: (request, response, next) => {
    try {
      const name = contentPaths.fromUrlFolder(request.params.space);
      const target = contentPaths.contentDir(name);
      if (!contentPaths.isSpaceDir(target)) {
        throw new Error(`sección "${name}" no encontrada`);
      }
      if (contentPaths.spaceHasChildren(name)) {
        throw new Error('la sección aún tiene sub-secciones o actividades; elimínalas primero');
      }
      fs.rmSync(target, { recursive: true, force: true });
      response.set('Content-Type', 'application/json');
      response.end(JSON.stringify({ result: `eliminada la sección "content/${name}"` }));
    }
    catch (error) {
      handleError(error, response);
    }
  },
  // move section/sub-section under another parent ('' = root)
  moveSpace: (request, response, next) => {
    try {
      const source = contentPaths.fromUrlFolder(request.params.space);
      const sourcePath = contentPaths.contentDir(source);
      if (!contentPaths.isSpaceDir(sourcePath)) {
        throw new Error(`sección "${source}" no encontrada`);
      }
      const parentRaw = request.body?.parent;
      const parent = (parentRaw === undefined || parentRaw === null || parentRaw === '')
        ? ''
        : contentPaths.assertSafeRelative(String(parentRaw));
      if (parent) {
        if (contentPaths.isUnderPath(parent, source)) {
          throw new Error('no se puede mover una sección dentro de sí misma o de una hija');
        }
        const parentDir = contentPaths.contentDir(parent);
        if (!fs.existsSync(parentDir) || !contentPaths.isSpaceDir(parentDir)) {
          throw new Error(`sección destino "${parent}" no encontrada`);
        }
      }
      const target = contentPaths.joinParent(parent, contentPaths.basenameOf(source));
      if (source === target) {
        response.set('Content-Type', 'application/json');
        response.end(JSON.stringify({
          result: target,
          href: contentPaths.toDashboardHref(target)
        }));
        return;
      }
      const targetPath = contentPaths.contentDir(target);
      if (fs.existsSync(targetPath)) {
        throw new Error(`la carpeta "content/${target}" ya existe`);
      }
      fs.renameSync(sourcePath, targetPath);
      response.set('Content-Type', 'application/json');
      response.end(JSON.stringify({
        result: target,
        href: contentPaths.toDashboardHref(target)
      }));
    }
    catch (error) {
      handleError(error, response);
    }
  },
  // lists content folders and child spaces/sections for current parent
  projects: async (request, response, next) => {
    try {
      const registry = await logic.getRegistry();
      const limit = parseInt(request.query.limit) || 10;
      const page = parseInt(request.query.page) || 0;
      const start = page * limit;
      const end = start + limit;
      const parent = resolveParentQuery(request);
      if (parent) {
        const spaceDir = contentPaths.contentDir(parent);
        if (!fs.existsSync(spaceDir) || !contentPaths.isSpaceDir(spaceDir)) {
          throw new Error(`sección "${parent}" no encontrada`);
        }
      }
      const libraryDirs = await logic.parseLibraryFolders();
      const output = {
        list: [],
        spaces: contentPaths.listSpaces(parent),
        parent,
        breadcrumbs: contentPaths.breadcrumbParts(parent),
        total: 0
      }
      if (!fs.existsSync(contentPaths.CONTENT_ROOT)) {
        fs.mkdirSync(contentPaths.CONTENT_ROOT, { recursive: true });
      }
      const list = [];
      for (let item of contentPaths.listActivities(parent)) {
        const infoFile = `${contentPaths.contentDir(item)}/h5p.json`;
        const info = JSON.parse(fs.readFileSync(infoFile, 'utf-8'));
        if (!registry.reversed[info.mainLibrary]) {
          continue;
        }
        list.push({
          id: info.mainLibrary,
          title: info.title,
          folder: item,
          folderUrl: contentPaths.toUrlFolder(item)
        });
      }
      list.sort((a, b) => a.title.localeCompare(b.title, undefined, {
        numeric: true,
        sensitivity: 'base'
      }));
      output.total = list.length;
      for (let i = start; i < Math.min(end, list.length); i++) {
        let entry = registry.reversed?.[list[i].id];
        const library = entry.shortName;
        entry = (await logic.computeDependencies(library, 'view', null, libraryDirs[registry.regular[library].id]))[library];
        let icon = '/assets/icon.svg';
        if (entry.version) {
          const libraryFolder = `${config.folders.libraries}/${libraryDirs[list[i].id]}`;
          const iconFile = `${libraryFolder}/icon.svg`;
          if (fs.existsSync(libraryFolder)) {
            if (fs.existsSync(iconFile)) {
              icon = iconFile;
            }
            else {
              const files = fs.readdirSync(libraryFolder);
              for (let item of files) {
                if (item.split('.')?.[1] == 'svg') {
                  icon = `${libraryFolder}/${item}`;
                  break;
                }
              }
            }
          }
        }
        list[i].library = library;
        list[i].icon = icon;
        output.list.push(list[i]);
      }
      response.set('Content-Type', 'application/json');
      response.end(JSON.stringify(output));
    }
    catch (error) {
      handleError(error, response);
    }
  },
  // renders view & edit modes on the same page
  splitView: async (request, response, next) => {
    try {
      normalizeFolderParam(request);
      const folderUrl = contentPaths.toUrlFolder(request.params.folder);
      const splitView_html = fs.readFileSync(`${require.main.path}/${config.folders.assets}/templates/splitView.html`, 'utf-8');
      const labels = await getLangLabels();
      let input = {
        assets: config.folders.assets,
        viewFrameSRC: `/view/${request.params.library}/${folderUrl}?simple=1`,
        editFrameSRC: `/edit/${request.params.library}/${folderUrl}?simple=1`
      }
      input = {...input, ...labels};
      response.set('Content-Type', 'text/html');
      response.end(logic.fromTemplate(splitView_html, input));
    }
    catch (error) {
     handleError(error, response);
    }
  },
  // editor file upload
  uploadFile: (request, response, next) => {
    try {
      normalizeFolderParam(request);
      const form = JSON.parse(request.body.field);
      const targetFolder = `${logic.contentRoot(request.params.folder)}/${form.type}s`;
      if (!fs.existsSync(targetFolder)) {
        fs.mkdirSync(targetFolder);
      }

      const ext =
        (request.file.originalname.split('.')?.pop() || '').toLowerCase();

      const valid =
        validateFileForUpload(form.type, request.file.mimetype, ext);

      if (valid !== 'OK') {
        throw new Error(valid);
      }

      const path = `${form.type}s/${request.file.filename}.${ext}`;
      const targetFile = `${targetFolder}/${request.file.filename}.${ext}`;
      fs.renameSync(`${request.file.path}`, targetFile);
      const output = {
        mime: request.file.mimetype,
        path
      }
      if (form.type == 'image') {
        const info = imageSize(fs.readFileSync(targetFile));
        if (info.width && info.height) {
          output.width = info.width;
          output.height = info.height;
        }
      }
      response.set('Content-Type', 'application/json');
      response.end(JSON.stringify(output));
    }
    catch (error) {
      handleError(error, response);
    }
  },
  // updates content.json file with data from content type editor form
  saveContent: async (request, response, next) => {
    try {
      normalizeFolderParam(request);
      const folderUrl = contentPaths.toUrlFolder(request.params.folder);
      const input = JSON.parse(request.body.parameters);
      const contentFile = logic.contentJsonPath(request.params.folder);
      const currentParams = fs.readFileSync(contentFile, 'utf-8');
      const newParams = JSON.stringify(input.params);
      fs.writeFileSync(contentFile, newParams);
      const infoFile = `content/${request.params.folder}/h5p.json`;
      let info = JSON.parse(fs.readFileSync(infoFile, 'utf-8'));
      info = {...info, ...input.metadata};
      if (info.authors && !info.authors.length) {
        delete info.authors;
      }
      if (info.changes && !info.changes.length) {
        delete info.changes;
      }
      fs.writeFileSync(infoFile, JSON.stringify(info));
      try {
        await logic.generateInfo(request.params.folder, request.params.library);
        info = JSON.parse(fs.readFileSync(infoFile, 'utf-8'));
        info = {...info, ...input.metadata};
        if (info.authors && !info.authors.length) {
          delete info.authors;
        }
        if (info.changes && !info.changes.length) {
          delete info.changes;
        }
        fs.writeFileSync(infoFile, JSON.stringify(info));
      }
      catch (depsError) {
        console.error('> failed to refresh player dependencies', depsError.message || depsError);
      }
      const contentFiles = parseContentFiles([input.params]);
      const list = [];
      for (let item in contentFiles) {
        const parts = item.split('/');
        list.push(parts[parts.length - 1]);
      }
      for (let type of config.mediaTypes) {// delete unused media files
        const targetFolder = `${logic.contentRoot(request.params.folder)}/${type}`;
        if (!fs.existsSync(targetFolder)) {
          continue;
        }
        const files = fs.readdirSync(targetFolder);
        for (let item of files) {
          if (!list.includes(item)) {
            fs.unlinkSync(`${targetFolder}/${item}`);
          }
        }
      }
      const simple = request.query.simple;
      if (currentParams !== '{}' && currentParams !== newParams) {
        resetContentUserData(request.params.folder); // content changed; reset user data
      }
      response.redirect(`/${simple ? 'edit' : 'view'}/${request.params.library}/${folderUrl}${simple ? '?simple=1' : ''}`);
    }
    catch (error) {
      handleError(error, response);
    }
  },
  // return translations entries for library and dependencies
  ajaxTranslations: async (request, response, next) => {
    try {
      const library = request.params.library;
      const registry = await logic.getRegistry();
      const libraryDirs = await logic.parseLibraryFolders();
      const libFolder = libraryDirs[registry.regular[library].id];
      const libs = await logic.computeDependencies(library, 'view', null, libFolder);
      const translations = {};
      for (let item of request.body.libraries) {
        const entry = libs[registry.reversed[item.split(' ')[0]].shortName];
        const folder = libraryDirs[entry.id];
        const idx = `${entry.id} ${entry.version.major}.${entry.version.minor}`;
        const languageFolder = `${config.folders.libraries}/${folder}/language`;
        const langFile = `${languageFolder}/${request.query.language}.json`;
        if (fs.existsSync(langFile)) {
          translations[idx] = fs.readFileSync(langFile, 'utf-8');
        }
      }
      response.set('Content-Type', 'application/json');
      response.end(JSON.stringify({ success: true, data: translations }));
    }
    catch (error) {
      handleError(error, response);
    }
  },
  // endpoint that lists library data; used as ajax request by the content type editors;
  ajaxLibraries: async (request, response, next) => {
    try {
      const output = await ajaxLibraries({
        library: request.params.library,
        libraries: request.body.libraries,
        machineName: request.query.machineName
      });
      response.set('Content-Type', 'application/json');
      response.end(JSON.stringify(output));
    }
    catch (error) {
      handleError(error, response);
    }
  },
  // html page that initializes and renders h5p content type editors
  edit: async (request, response, next) => {
    try {
      normalizeFolderParam(request);
      const baseUrl = config.api;
      const library = request.params.library;
      const folder = request.params.folder;
      const folderUrl = contentPaths.toUrlFolder(folder);
      const dashboardHref = contentPaths.parentOf(folder)
        ? `/dashboard/${contentPaths.parentOf(folder)}`
        : '/dashboard';
      const registry = await logic.getRegistry();
      const libraryDirs = await logic.parseLibraryFolders();
      if (!await verifySetup(library, response)) {
        return;
      }
      const metadataSemantics = fs.readFileSync(`${require.main.path}/${config.folders.assets}/metadataSemantics.json`, 'utf-8');
      const copyrightSemantics = fs.readFileSync(`${require.main.path}/${config.folders.assets}/copyrightSemantics.json`, 'utf-8');
      const libs = await logic.computeDependencies(library, 'edit', null, libraryDirs[registry.regular[library].id]);
      const jsonContent = fs.readFileSync(logic.contentJsonPath(folder), 'utf8');
      let preloadedJs = [];
      let preloadedCss = [];
      for (let item in libs) {
        if (item == library) {
          continue;
        }
        const entry = libs[item];
        if (!entry.id) {
          continue;
        }
        const libFolder = libraryDirs[entry.id];
        if (!libFolder) {
          continue;
        }
        for (let jsItem of entry.preloadedJs) {
          preloadedJs.push(`"/${config.folders.libraries}/${libFolder}/${jsItem.path}"`);
        }
        for (let cssItem of entry.preloadedCss) {
          preloadedCss.push(`"/${config.folders.libraries}/${libFolder}/${cssItem.path}"`);
        }
      }
      const mathDisplay = (await logic.computeDependencies('h5p-math-display', 'view', null, libraryDirs[registry.regular['h5p-math-display'].id]))['h5p-math-display'];
      const mathDisplayLabel = libraryDirs[mathDisplay.id];
      preloadedJs.push(`"/${config.folders.libraries}/${mathDisplayLabel}/dist/h5p-math-display.js"`);
      const libraryConfig = JSON.parse(logic.fromTemplate(fs.readFileSync(`${require.main.path}/${config.folders.assets}/libraryConfig.json`, 'utf-8'), {
        baseUrl,
        mathDisplayLabel
      }));
      const html = fs.readFileSync(`${require.main.path}/${config.folders.assets}/templates/edit.html`, 'utf-8');
      const info = JSON.parse(fs.readFileSync(`content/${folder}/h5p.json`, 'utf-8'));
      info.language = session.language;
      const id = libs[library].id;
      let mainLibrary = {};
      for (let item of info.preloadedDependencies) {
        if (item.machineName == id) {
          mainLibrary = item;
          break;
        }
      }
      manageSession(folder, {
        language: request.query?.language,
        name: request.query?.session
      }, true);
      const formParams = {
        params: JSON.parse(jsonContent),
        metadata: info
      }
      const labels = await getLangLabels();
      const machineName = `${libs[library].id} ${libs[library].version.major}.${libs[library].version.minor}`;
      const libraryDirectories = JSON.stringify((await ajaxLibraries({ machineName: id })).directories);
      let input = {
        assets: config.folders.assets,
        libraries: config.folders.libraries,
        title: info.title,
        baseUrl,
        ajaxPath: `${baseUrl}/edit/${library}/${folderUrl}/`,
        filesPath: `${baseUrl}/${logic.contentRoot(folder)}`,
        copyrightSemantics,
        metadataSemantics,
        library,
        folder: folderUrl,
        dashboardHref,
        preloadedCss: preloadedCss.join(',\n'),
        preloadedJs: preloadedJs.join(',\n'),
        l10n: JSON.stringify(l10n),
        machineName,
        version: `${libs[library].version.major}.${libs[library].version.minor}`,
        contentVersion: `${mainLibrary.majorVersion}.${mainLibrary.minorVersion}`,
        id,
        libraryDirectories,
        parameters: he.encode(JSON.stringify(formParams)),
        libraryConfig: JSON.stringify(libraryConfig),
        language: session.language,
        watcher: config.files.watch,
        simple: request.query.simple ? 'hidden' : ''
      }
      input = {...input, ...labels};
      response.set('Content-Type', 'text/html');
      response.end(logic.fromTemplate(html, input));
    }
    catch (error) {
      handleError(error, response);
    }
  },
  // html page that initializes and renders h5p content types
  view: async (request, response, next) => {
    try {
      normalizeFolderParam(request);
      const baseUrl = config.api;
      const library = request.params.library;
      const folder = request.params.folder;
      const folderUrl = contentPaths.toUrlFolder(folder);
      const dashboardHref = contentPaths.parentOf(folder)
        ? `/dashboard/${contentPaths.parentOf(folder)}`
        : '/dashboard';
      const registry = await logic.getRegistry();
      const libraryDirs = await logic.parseLibraryFolders();
      if (!await verifySetup(library, response)) {
        return;
      }
      await logic.upgrade(folder, library);
      const libs = await logic.computePlayerDependencies(
        library,
        folder,
        libraryDirs[registry.regular[library].id]
      );
      const jsonContent = fs.readFileSync(logic.contentJsonPath(folder), 'utf8');
      const sessions = manageSession(request.params.folder, {
        language: request.query?.language,
        name: request.query?.session
      }, true);
      const userData = getSession(request.params.folder);
      let metadata = await logic.getFile(`content/${folder}/h5p.json`, true);
      metadata.language = session.language;
      metadata = JSON.stringify(metadata);
      let preloadedJs = [];
      let preloadedCss = [];
      for (let item in libs) {
        const entry = libs[item];
        if (!entry.id) {
          continue;
        }
        const libFolder = libraryDirs[entry.id];
        if (!libFolder) {
          continue;
        }
        for (let jsItem of entry.preloadedJs) {
          preloadedJs.push(`/${config.folders.libraries}/${libFolder}/${jsItem.path}`);
        }
        for (let cssItem of entry.preloadedCss) {
          preloadedCss.push(`/${config.folders.libraries}/${libFolder}/${cssItem.path}`);
        }
      }
      const mathDisplay = (await logic.computeDependencies('h5p-math-display', 'view', null, libraryDirs[registry.regular['h5p-math-display'].id]))['h5p-math-display'];
      const mathDisplayLabel = libraryDirs[mathDisplay.id];
      preloadedJs.push(`/${config.folders.libraries}/${mathDisplayLabel}/dist/h5p-math-display.js`);
      const libraryConfig = JSON.parse(logic.fromTemplate(fs.readFileSync(`${require.main.path}/${config.folders.assets}/libraryConfig.json`, 'utf-8'), {
        baseUrl,
        mathDisplayLabel
      }));
      const html = fs.readFileSync(`${require.main.path}/${config.folders.assets}/templates/view.html`, 'utf-8');
      const info = JSON.parse(fs.readFileSync(`content/${folder}/h5p.json`, 'utf-8'));
      const id = libs[library].id;
      let mainLibrary = {};
      for (let item of info.preloadedDependencies) {
        if (item.machineName == id) {
          mainLibrary = item;
          break;
        }
      }
      const machineName = `${id} ${libs[library].version.major}.${libs[library].version.minor}`;
      const labels = await getLangLabels();
      const libraryDirectories = JSON.stringify((await ajaxLibraries({ machineName: id })).directories);
      let input = {
        assets: config.folders.assets,
        libraries: config.folders.libraries,
        title: JSON.stringify(info.title),
        baseUrl,
        contentBase: `${baseUrl}/${logic.contentRoot(folder)}`,
        library,
        folder: folderUrl,
        dashboardHref,
        session: session.name,
        sessions: JSON.stringify(sessions),
        machineName,
        version: `${libs[library].version.major}.${libs[library].version.minor}`,
        contentVersion: `${mainLibrary.majorVersion}.${mainLibrary.minorVersion}`,
        id,
        fullscreen: libs[library].fullscreen,
        libraryDirectories,
        jsonContent: JSON.stringify(jsonContent),
        preloadedCss: JSON.stringify(preloadedCss),
        preloadedJs: JSON.stringify(preloadedJs),
        l10n: JSON.stringify(l10n),
        libraryConfig: JSON.stringify(libraryConfig),
        language: session.language,
        metadata,
        contentUserData: JSON.stringify(userData.resume),
        watcher: config.files.watch,
        themeControls: config.themeControls ?? false,
        simple: request.query.simple ? 'hidden' : '',
        saveFreq: config.saveFreq
      }
      input = {...input, ...labels};
      response.set('Content-Type', 'text/html');
      response.end(logic.fromTemplate(html, input));
    }
    catch (error) {
      handleError(error, response);
    }
  }
}

/**
 * Validate file for upload by mime type and extension.
 * @param {string} uploadFieldType Upload field type.
 * @param {string} mimeType File's mime type.
 * @param {string} extension File's extension.
 * @returns {string} Error message or 'OK'.
 */
const validateFileForUpload = (uploadFieldType, mimeType, extension) => {
  let allowed;

  // Set allowed extensions per mime type depending on upload field type
  switch (uploadFieldType) {
    // Image upload field
    case 'image':
      allowed = {
        'image/png': ['png'],
        'image/jpeg': ['jpg', 'jpeg'],
        'image/gif': ['gif'],
      };
      break;

    // Audio upload field
    case 'audio':
      allowed = {
        'audio/mpeg': ['mp3'],
        'audio/mp3': ['mp3'],
        'audio/mp4': ['m4a'],
        'audio/x-wav': ['wav'],
        'audio/wav': ['wav'],
        'audio/ogg': ['ogg'],
      };
      break;

    // Video upload field
    case 'video':
      allowed = {
        'video/mp4': ['mp4'],
        'video/webm': ['webm'],
        'video/ogg': ['ogv'],
      };
      break;

    // File upload field
    case 'file':
      const allowedExtensions = config.files.patterns.allowed.toString()
        .replace(/[^a-zA-Z0-9|]/g, '')
        .split('|');
      allowed = { '*': allowedExtensions }; // Allow allowedExtensions for all mime types
      break;

    default:
      allowed = {};
  }

  const isExtensionAllowed = (allowed[mimeType] ?? allowed['*'] ?? []).includes(extension);
  const message = isExtensionAllowed ? 'OK' : `Invalid ${uploadFieldType} file format.`;
  const extensionsToUse = isExtensionAllowed ? '' : listExtensions(Object.values(allowed).flat());

  return [message, extensionsToUse].filter(Boolean).join(' ');
}

/**
 * List extension options as human language string.
 * @param {string[]} extensions List of extensions.
 * @returns {string} Human language string.
 */
const listExtensions = (extensions = []) => {
  if (!Array.isArray(extensions) || !extensions.length) {
    return '';
  }
  else if (extensions.length === 1) {
    return `Use ${extensions[0]}.`;
  }
  else {
    return `Use ${extensions.slice(0, -1).join(', ')} or ${extensions.slice(-1)}.`;
  }
};

// parses content.json objects for entries of file type
const parseContentFiles = (entries) => {
  let toDo = [];
  let list = [];
  const output = {};
  const valid = ['path', 'mime'];
  const parseList = () => {
    toDo = [];
    for (let obj of list) {
      for (let attr in obj) {
        if (valid.includes(attr) && typeof attr == 'string') {
          output[obj.path] = obj;
          continue;
        }
        if (typeof obj[attr] == 'object' && !Array.isArray(obj[attr])) {
          toDo.push(obj[attr]);
        }
        if (Array.isArray(obj[attr])) {
          toDo = toDo.concat(obj[attr]);
        }
      }
    }
    list = toDo;
  }
  list = entries;
  while (list.length) {
    parseList();
  }
  return output;
}
/* generates lists of JavaScript & CSS files to load
as well as translations and directories entries for use in content types */
const computePreloaded = async (library, baseUrl) => {
  const registry = await logic.getRegistry();
  const libraryDirs = await logic.parseLibraryFolders();
  const libs = await logic.computeDependencies(library, 'edit', null, libraryDirs[registry.regular[library].id]);
  const directories = {};
  const translations = {};
  const languages = [];
  let preloadedJs = [];
  let preloadedCss = [];
  for (let item in libs) {
    const entry = libs[item];
    if (!entry.id) {
      continue;
    }
    const folder = libraryDirs[entry.id];
    if (!folder) {
      continue;
    }
    const label = `${entry.id}-${entry.version.major}.${entry.version.minor}.${entry.version.patch}`;
    const languageFolder = `${config.folders.libraries}/${folder}/language`;
    const langFile = `${languageFolder}/${session.language}.json`;
    if (fs.existsSync(langFile)) {
      translations[entry.id] = JSON.parse(fs.readFileSync(langFile, 'utf-8'));
    }
    if (!languages.length && fs.existsSync(languageFolder)) {
      const langFiles = fs.readdirSync(languageFolder);
      for (let item of langFiles) {
        const id = (item.replace(/^\./, "")).split('.')[0];
        languages.push(id);
      }
    }
    if (item == library && entry.requiredBy.length == 1) {
      let required = false;
      for (let obj of entry.editorDependencies) {
        if (obj.machineName == entry.id) {
          required = true;
        }
      }
      if (!required) {
        continue;
      }
    }
    for (let jsItem of entry.preloadedJs) {
      preloadedJs.push(`${baseUrl}/${config.folders.libraries}/${folder}/${jsItem.path}`);
    }
    for (let cssItem of entry.preloadedCss) {
      preloadedCss.push(`${baseUrl}/${config.folders.libraries}/${folder}/${cssItem.path}`);
    }
    directories[folder] = label;
  }
  return { library, preloadedJs, preloadedCss, languages, translations, directories };
}
const ajaxLibraries = async (options) => {
  const baseUrl = config.api;
  const registry = await logic.getRegistry();
  const libraryDirs = await logic.parseLibraryFolders();
  let libraries = [options.library];
  if (Array.isArray(options.libraries)) {
    libraries = [];
    for (let item of options.libraries) {
      item = item.split(' ')[0];
      if (!registry.reversed[item] || !libraryDirs[item]) {
        continue;
      }
      libraries.push(registry.reversed[item].shortName);
    }
  }
  if (options.machineName) {
    libraries = [];
    libraries.push(registry.reversed[options.machineName].shortName);
  }
  const toDo = [];
  for (let item of libraries) {
    toDo.push(computePreloaded(item, baseUrl));
  }
  const preloaded = await Promise.all(toDo);
  let output;
  if (options.machineName) {
    const library = libraries[0];
    const libs = await logic.computeDependencies(library, 'edit', null, libraryDirs[registry.regular[library].id]);
    const version = libs[library].version;
    const folder = libraryDirs[libs[library].id];
    output = {
      name: libs[library].id,
      version,
      title: libs[library].title,
      upgradesScript: `${baseUrl}/${config.folders.libraries}/${folder}/upgrades.js`,
      semantics: JSON.parse(fs.readFileSync(`${config.folders.libraries}/${folder}/semantics.json`, 'utf-8')),
      language: null,
      defaultLanguage: null,
      languages: preloaded[0].languages,
      javascript: preloaded[0].preloadedJs,
      css: preloaded[0].preloadedCss,
      translations: preloaded[0].translations,
      directories: preloaded[0].directories
    }
  }
  else {
    output = [];
    for (let item of preloaded) {
      const library = item.library;
      const libs = await logic.computeDependencies(library, 'edit', null, libraryDirs[registry.regular[library].id]);
      output.push({
        uberName: `${libs[library].id} ${libs[library].version.major}.${libs[library].version.minor}`,
        name: libs[library].id,
        majorVersion: libs[library].version.major,
        minorVersion: libs[library].version.minor,
        title: libs[library].title,
        runnable: libs[library].runnable,
        restricted: false,
        metadataSettings: libs[library].metadataSettings
      });
    }
  }
  return output;
}
const normalizeFolderParam = (request) => {
  if (request.params?.folder) {
    request.params.folder = contentPaths.fromUrlFolder(request.params.folder);
  }
};

const resolveParentQuery = (request) => {
  const raw = request.query?.parent;
  if (raw === undefined || raw === null || raw === '') {
    return '';
  }
  const value = String(raw);
  if (value.includes(contentPaths.URL_SEP)) {
    return contentPaths.fromUrlFolder(value);
  }
  return contentPaths.assertSafeRelative(value.replaceAll('\\', '/'));
};

const writeContentTitle = (folder, title) => {
  const infoFile = `${contentPaths.contentDir(folder)}/h5p.json`;
  const info = JSON.parse(fs.readFileSync(infoFile, 'utf-8'));
  info.title = title;
  fs.writeFileSync(infoFile, JSON.stringify(info));
}

const handleError = (error, response) => {
  console.log(error);
  response.set('Content-Type', 'application/json');
  response.end(JSON.stringify({ error: error.toString() }));
}
const verifySetup = async (library, response) => {
  const setupStatus = await logic.verifySetup(library);
  if (!setupStatus.ok) {
    session.status = `"${library}" is not properly set up. Please run "h5p setup ${library}" for setup.
For a setup status report run "h5p verify ${library}".`;
    response.redirect(`/dashboard`);
    return false;
  }
  else {
    return true;
  }
}
const manageSession = (folder, options, getSessions) => {
  for (let key in options) {
    if (typeof options[key] !== 'undefined') {
      session[key] = options[key];
    }
  }
  return [];
}
const getSession = (folder) => {
  return { resume: [] };
}
const getLangLabels = async () => {
  let langFile = `${require.main.path}/${config.folders.assets}/languages/${session.language}.json`;
  if (!fs.existsSync(langFile)) {
    langFile = `${config.folders.assets}/languages/en.json`;
  }
  return await logic.getFile(langFile, true);
}

 /* Reset content user data.
 * @param {string} folder Folder name (contentId) if content to reset user data for.
 */
const resetContentUserData = (folder) => {
  return;
};
