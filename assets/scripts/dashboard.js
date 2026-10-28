function dashboard(options) {
  let newContentButton;
  let newContent;
  let importContentButton;
  let importContent;
  let newSpaceButton;
  let newSpaceButtonLabel;
  let newSpace;
  let spaceName;
  let sectionsTitle;
  let contentTypes;
  let createFolder;
  let importFolder;
  let archive;
  let status;
  let breadcrumb;
  let spaces;
  let spacesSection;
  let content;
  let pagination;
  let languages;
  let entry;
  let spaceEntry;
  let link;
  let currentPage = 0;
  this.init = () => {
    options.limit = options.limit || 10;
    options.space = options.space || '';
    window.addEventListener('load', () => {
      console.log('> page loaded');
      newContentButton = document.getElementById(options.ids.newContentButton);
      newContent = document.getElementById(options.ids.newContent);
      importContentButton = document.getElementById(options.ids.importContentButton);
      importContent = document.getElementById(options.ids.importContent);
      newSpaceButton = document.getElementById(options.ids.newSpaceButton);
      newSpaceButtonLabel = document.getElementById(options.ids.newSpaceButtonLabel);
      newSpace = document.getElementById(options.ids.newSpace);
      spaceName = document.getElementById(options.ids.spaceName);
      sectionsTitle = document.getElementById(options.ids.sectionsTitle);
      contentTypes = document.getElementById(options.ids.contentTypes);
      createFolder = document.getElementById(options.ids.createFolder);
      importFolder = document.getElementById(options.ids.importFolder);
      archive = document.getElementById(options.ids.archive);
      status = document.getElementById(options.ids.status);
      breadcrumb = document.getElementById(options.ids.breadcrumb);
      spaces = document.getElementById(options.ids.spaces);
      spacesSection = document.getElementById(options.ids.spacesSection);
      content = document.getElementById(options.ids.content);
      pagination = document.getElementById(options.ids.pagination);
      languages = document.getElementById(options.ids.languages);
      entry = content.innerHTML;
      spaceEntry = spaces.innerHTML;
      link = pagination.innerHTML;
      option = contentTypes.innerHTML;
      if (newSpaceButtonLabel) {
        newSpaceButtonLabel.innerText = options.sectionButtonLabel || (options.space ? 'Sección' : 'Espacio');
      }
      if (sectionsTitle) {
        sectionsTitle.innerText = options.sectionsTitle || (options.space ? 'Secciones' : 'Espacios');
      }
      this.getPage();
      this.getContentTypes();
      this.setLanguages();
      if (status.innerText) {
        this.showStatus();
      }
    });
  }
  this.parentQuery = () => {
    return options.space ? `parent=${encodeURIComponent(options.space)}` : '';
  }
  this.withParent = (url) => {
    const query = this.parentQuery();
    if (!query) {
      return url;
    }
    return url.includes('?') ? `${url}&${query}` : `${url}?${query}`;
  }
  this.renderBreadcrumb = (crumbs = []) => {
    if (!breadcrumb) {
      return;
    }
    let html = `<a href="/dashboard">Dashboard</a>`;
    for (let i = 0; i < crumbs.length; i++) {
      const crumb = crumbs[i];
      html += ` <span class="breadcrumb-sep">/</span> `;
      if (i === crumbs.length - 1) {
        html += `<span class="breadcrumb-current">${crumb.name}</span>`;
      }
      else {
        html += `<a href="${crumb.href}">${crumb.name}</a>`;
      }
    }
    breadcrumb.innerHTML = html;
  }
  this.basename = (folderUrl) => {
    const parts = String(folderUrl || '').split('::');
    return parts[parts.length - 1] || folderUrl;
  }
  this.getPage = async (page = 0, limit = options.limit) => {
    try {
      currentPage = page;
      const query = [`page=${page}`, `limit=${limit}`];
      if (options.space) {
        query.push(`parent=${encodeURIComponent(options.space)}`);
      }
      let result = await (await fetch(`${options.api}/projects?${query.join('&')}`)).json();
      if (result.error) {
        throw new Error(result.error);
      }
      this.renderBreadcrumb(result.breadcrumbs || []);
      let contentHTML = '';
      let spacesHTML = '';
      let paginationHTML = '';
      for (let item of (result.spaces || [])) {
        spacesHTML += this.fromTemplate(spaceEntry, {
          name: item.name,
          folder: item.folder,
          folderUrl: item.folderUrl || item.folder,
          href: item.href || `/dashboard/${item.folder}`
        });
      }
      const emptySpaces = options.space
        ? 'No hay secciones en este nivel.'
        : 'No hay espacios. Crea uno para organizar actividades.';
      spaces.innerHTML = spacesHTML || `<p class="empty-hint">${emptySpaces}</p>`;
      for (let item of result.list) {
        contentHTML += this.fromTemplate(entry, {
          title: item.title,
          library: item.library,
          folderUrl: item.folderUrl || item.folder,
          folderBase: this.basename(item.folderUrl || item.folder),
          icon: item.icon
        });
      }
      const pageCount = Math.ceil(result.total / limit);
      if (pageCount > 1) {
        for (let i = 0; i < pageCount; i++) {
          paginationHTML += this.fromTemplate(link, {
            selected: i == page ? ' selected' : '',
            page: i,
            onclick: `${options.self}.getPage(${i}, ${limit})`
          });
        }
        pagination.innerHTML = paginationHTML;
      }
      else {
        pagination.innerHTML = '';
      }
      content.innerHTML = contentHTML || '<p class="empty-hint">No hay actividades en este nivel.</p>';
    }
    catch (error) {
      this.handleError(error);
    }
  }
  this.getContentTypes = async () => {
    try {
      let html = '';
      let result = await (await fetch(`${options.api}/runnable`)).json();
      for (let item in result) {
        html += this.fromTemplate(option, {
          value: item,
          name: item
        });
      }
      contentTypes.innerHTML = html;
    }
    catch (error) {
      this.handleError(error);
    }
  }
  this.create = async () => {
    try {
      if (!createFolder.value) {
        throw new Error("enter title");
      }
      this.showStatus('...');
      const type = contentTypes.value;
      const output = await (await fetch(this.withParent(`${options.api}/create/${type}/${encodeURIComponent(createFolder.value)}`), {method: 'post'})).json();
      if (output.result) {
        window.location.href = `/edit/${type}/${output?.result}`;
        return;
      }
      this.toggleNewContent();
      this.getPage(currentPage);
      this.showStatus(output?.result || output?.error || output);
    }
    catch (error) {
      this.handleError(error);
    }
  }
  this.import = async () => {
    try {
      if (!importFolder.value) {
        throw new Error("enter title");
      }
      this.showStatus('...');
      const body = new FormData();
      body.append('file', archive.files[0]);
      const output = await (await fetch(this.withParent(`${options.api}/import/${encodeURIComponent(importFolder.value)}`), { method: 'post', body })).json();
      this.toggleImportContent();
      this.getPage(currentPage);
      this.showStatus(output?.path ? `imported into "content/${output.path}"` : 0 || output?.error || output);
    }
    catch (error) {
      this.handleError(error);
    }
  }
  this.createSpace = async () => {
    try {
      if (!spaceName.value) {
        throw new Error('introduce el nombre');
      }
      this.showStatus('...');
      const output = await (await fetch(`${options.api}/spaces`, {
        method: 'post',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: spaceName.value, parent: options.space || '' })
      })).json();
      if (output.error) {
        throw new Error(output.error);
      }
      window.location.href = output.href || `/dashboard/${output.result}`;
    }
    catch (error) {
      this.handleError(error);
    }
  }
  this.renameSpace = async (spaceUrl, displayName) => {
    try {
      const name = window.prompt('Nuevo nombre. Los espacios pasan a guiones.', displayName || this.basename(spaceUrl));
      if (!name || name === (displayName || this.basename(spaceUrl))) {
        return;
      }
      this.showStatus('...');
      const output = await (await fetch(`${options.api}/spaces/${encodeURIComponent(spaceUrl)}/rename`, {
        method: 'post',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      })).json();
      if (output.error) {
        throw new Error(output.error);
      }
      this.showStatus(`renombrado a content/${output.result}`);
      this.getPage(currentPage);
    }
    catch (error) {
      this.handleError(error);
    }
  }
  this.removeSpace = async (spaceUrl, displayName) => {
    try {
      const label = displayName || this.basename(spaceUrl);
      if (!window.confirm(`¿Eliminar "${label}"? Debe estar vacío (sin secciones ni actividades).`)) {
        return;
      }
      this.showStatus('...');
      const output = await (await fetch(`${options.api}/spaces/${encodeURIComponent(spaceUrl)}/remove`, { method: 'post' })).json();
      if (output.error) {
        throw new Error(output.error);
      }
      this.showStatus(output.result);
      this.getPage(currentPage);
    }
    catch (error) {
      this.handleError(error);
    }
  }
  this.copy = async (project) => {
    try {
      const base = this.basename(project);
      const name = window.prompt('Nombre de la carpeta de la copia. Los espacios pasan a guiones.', `${base}-copia`);
      if (!name) {
        return;
      }
      this.showStatus('...');
      const output = await (await fetch(`${options.api}/copy/${encodeURIComponent(project)}`, {
        method: 'post',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folder: name })
      })).json();
      if (output.error) {
        throw new Error(output.error);
      }
      this.showStatus(`copiada en content/${String(output.result).split('::').join('/')}`);
      this.getPage(currentPage);
    }
    catch (error) {
      this.handleError(error);
    }
  }
  this.rename = async (project, baseName) => {
    try {
      const name = window.prompt('Nuevo nombre de la carpeta. Los espacios pasan a guiones.', baseName || this.basename(project));
      if (!name || name === (baseName || this.basename(project))) {
        return;
      }
      this.showStatus('...');
      const output = await (await fetch(`${options.api}/rename/${encodeURIComponent(project)}`, {
        method: 'post',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folder: name })
      })).json();
      if (output.error) {
        throw new Error(output.error);
      }
      this.showStatus(`carpeta renombrada a content/${String(output.result).split('::').join('/')}`);
      this.getPage(currentPage);
    }
    catch (error) {
      this.handleError(error);
    }
  }
  this.remove = async (project) => {
    try {
      if (window.confirm(`¿Eliminar "content/${String(project).split('::').join('/')}"?`)) {
        this.showStatus('...');
        const output = await (await fetch(`${options.api}/remove/${encodeURIComponent(project)}`, {method: 'post'})).json();
        if (output.error) {
          throw new Error(output.error);
        }
        this.showStatus(output.result);
        this.getPage(currentPage);
      }
    }
    catch (error) {
      this.handleError(error);
    }
  }
  this.handleError = (error) => {
    this.showStatus(error.toString());
    console.log('> error');
    console.log(error);
  }
  this.toggleNewContent = (ignoreStatus) => {
    if (!ignoreStatus) {
      this.hideStatus();
    }
    newContent.classList.toggle(options.classes.hidden);
    importContent.classList.add(options.classes.hidden);
    newSpace.classList.add(options.classes.hidden);
  }
  this.toggleImportContent = (ignoreStatus) => {
    if (!ignoreStatus) {
      this.hideStatus();
    }
    newContent.classList.add(options.classes.hidden);
    importContent.classList.toggle(options.classes.hidden);
    newSpace.classList.add(options.classes.hidden);
  }
  this.toggleNewSpace = (ignoreStatus) => {
    if (!ignoreStatus) {
      this.hideStatus();
    }
    newSpace.classList.toggle(options.classes.hidden);
    newContent.classList.add(options.classes.hidden);
    importContent.classList.add(options.classes.hidden);
  }
  this.fromTemplate = (template, input) => {
    for (let item in input) {
      template = template.replaceAll(`{${item}}`, input[item]);
    }
    return template;
  }
  this.showStatus = (msg) => {
    status.innerText = msg || status.innerText;
    status.classList.remove(options.classes.hidden);
    newContent.classList.add(options.classes.hidden);
    importContent.classList.add(options.classes.hidden);
    newSpace.classList.add(options.classes.hidden);
  }
  this.hideStatus = () => {
    status.innerText = '';
    status.classList.add(options.classes.hidden);
  }
  this.setLanguages = () => {
    const option = languages.innerHTML;
    let html = '';
    for (let item in options.languages) {
      html += this.fromTemplate(option, {
        value: item,
        name: options.languages[item],
        selected: options.language === item ? ' selected' : ''
      });
    }
    languages.innerHTML = html;
  }
  this.changeLanguage = () => {
    const base = options.space ? `/dashboard/${options.space}` : '/dashboard';
    window.location.href = `${base}?language=${languages.options[languages.selectedIndex].value}`;
  }
}
