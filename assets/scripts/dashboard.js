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
  let modal;
  let modalTitle;
  let modalHint;
  let modalBody;
  let modalCancel;
  let modalOk;
  let modalResolver = null;
  let modalKeyHandler = null;
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
      modal = document.getElementById(options.ids.modal);
      modalTitle = document.getElementById(options.ids.modalTitle);
      modalHint = document.getElementById(options.ids.modalHint);
      modalBody = document.getElementById(options.ids.modalBody);
      modalCancel = document.getElementById(options.ids.modalCancel);
      modalOk = document.getElementById(options.ids.modalOk);
      entry = document.getElementById(options.ids.contentItemTemplate).innerHTML;
      spaceEntry = document.getElementById(options.ids.spaceItemTemplate).innerHTML;
      link = document.getElementById(options.ids.paginationLinkTemplate).innerHTML;
      option = contentTypes.innerHTML;
      if (newSpaceButtonLabel) {
        newSpaceButtonLabel.innerText = options.sectionButtonLabel || (options.space ? 'Sub-sección' : 'Sección');
      }
      if (sectionsTitle) {
        sectionsTitle.innerText = options.sectionsTitle || (options.space ? 'Sub-secciones' : 'Secciones');
      }
      this.bindModalChrome();
      this.getPage();
      this.getContentTypes();
      this.setLanguages();
      if (status.innerText) {
        this.showStatus();
      }
    });
  }
  this.bindModalChrome = () => {
    if (!modal) {
      return;
    }
    modalCancel.addEventListener('click', () => this.closeModal(null));
    modal.querySelector('[data-modal-dismiss]')?.addEventListener('click', () => this.closeModal(null));
  }
  this.closeModal = (value) => {
    if (!modal || !modalResolver) {
      return;
    }
    const resolve = modalResolver;
    modalResolver = null;
    if (modalKeyHandler) {
      window.removeEventListener('keydown', modalKeyHandler);
      modalKeyHandler = null;
    }
    modal.classList.add(options.classes.hidden);
    modal.setAttribute('aria-hidden', 'true');
    modalOk.classList.remove('dash-modal-danger');
    resolve(value);
  }
  this.openModal = ({ title, hint = '', bodyHtml = '', okLabel = 'Aceptar', cancelLabel = 'Cancelar', danger = false, onReady, getValue }) => {
    return new Promise((resolve) => {
      if (!modal) {
        resolve(null);
        return;
      }
      if (modalResolver) {
        this.closeModal(null);
      }
      modalResolver = resolve;
      modalTitle.textContent = title || '';
      if (hint) {
        modalHint.textContent = hint;
        modalHint.classList.remove(options.classes.hidden);
      }
      else {
        modalHint.textContent = '';
        modalHint.classList.add(options.classes.hidden);
      }
      modalBody.innerHTML = bodyHtml;
      modalCancel.textContent = cancelLabel;
      modalOk.textContent = okLabel;
      modalOk.classList.toggle('dash-modal-danger', Boolean(danger));
      modalOk.onclick = () => {
        const value = typeof getValue === 'function' ? getValue() : true;
        this.closeModal(value);
      };
      modal.classList.remove(options.classes.hidden);
      modal.setAttribute('aria-hidden', 'false');
      modalKeyHandler = (event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          this.closeModal(null);
        }
        else if (event.key === 'Enter' && event.target?.tagName === 'INPUT') {
          event.preventDefault();
          modalOk.click();
        }
      };
      window.addEventListener('keydown', modalKeyHandler);
      if (typeof onReady === 'function') {
        onReady();
      }
    });
  }
  this.promptName = ({ title, hint, defaultValue = '', okLabel = 'Aceptar' }) => {
    const escaped = String(defaultValue || '')
      .replaceAll('&', '&amp;')
      .replaceAll('"', '&quot;')
      .replaceAll('<', '&lt;');
    return this.openModal({
      title,
      hint,
      okLabel,
      bodyHtml: `<input type="text" class="dash-modal-input" id="dashModalInput" value="${escaped}" autocomplete="off" spellcheck="false">`,
      onReady: () => {
        const input = document.getElementById('dashModalInput');
        if (!input) {
          return;
        }
        input.focus();
        input.select();
      },
      getValue: () => {
        const input = document.getElementById('dashModalInput');
        return input ? input.value.trim() : '';
      }
    });
  }
  this.confirmAction = ({ title, message, okLabel = 'Eliminar' }) => {
    return this.openModal({
      title,
      hint: message,
      okLabel,
      danger: true,
      bodyHtml: '',
      getValue: () => true
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
        ? 'No hay sub-secciones en este nivel.'
        : 'No hay secciones. Crea una para organizar actividades.';
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
      const current = displayName || this.basename(spaceUrl);
      const name = await this.promptName({
        title: 'Renombrar sección',
        hint: 'Los espacios pasan a guiones. Solo cambia el nombre en este nivel.',
        defaultValue: current,
        okLabel: 'Renombrar'
      });
      if (name === null || !name || name === current) {
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
      const confirmed = await this.confirmAction({
        title: 'Eliminar sección',
        message: `¿Eliminar "${label}"? Debe estar vacío (sin sub-secciones ni actividades).`,
        okLabel: 'Eliminar'
      });
      if (!confirmed) {
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
  this.escapeHtml = (value) => {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;');
  }
  this.pickDestination = async (currentParent, excludePath) => {
    const result = await (await fetch(`${options.api}/destinations`)).json();
    if (result.error) {
      throw new Error(result.error);
    }
    const optionsList = (result.list || []).filter((item) => {
      if (!excludePath) {
        return true;
      }
      if (item.path === excludePath) {
        return false;
      }
      return !(item.path && (item.path === excludePath || item.path.startsWith(`${excludePath}/`)));
    });
    if (!optionsList.length) {
      throw new Error('no hay destinos disponibles');
    }
    const currentHint = currentParent === '' ? 'Dashboard (raíz)' : currentParent.split('/').join(' / ');
    const hasCurrent = optionsList.some((item) => item.path === (currentParent || ''));
    const bodyHtml = [
      '<div class="dash-modal-destinations" role="radiogroup" aria-label="Destino">'
    ];
    optionsList.forEach((item, index) => {
      const checked = (hasCurrent ? item.path === (currentParent || '') : index === 0) ? ' checked' : '';
      const id = `dest-${this.escapeHtml(item.path || 'root').replaceAll(/[^a-zA-Z0-9_-]/g, '_')}`;
      bodyHtml.push(
        `<label class="dash-modal-dest-option" for="${id}">` +
        `<input type="radio" name="dashModalDest" id="${id}" value="${this.escapeHtml(item.path)}"${checked}>` +
        `<span>${this.escapeHtml(item.label)}</span>` +
        `</label>`
      );
    });
    bodyHtml.push('</div>');
    const selected = await this.openModal({
      title: 'Mover a…',
      hint: `Ubicación actual: ${currentHint}`,
      okLabel: 'Mover',
      bodyHtml: bodyHtml.join(''),
      onReady: () => {
        const checked = modalBody.querySelector('input[name="dashModalDest"]:checked');
        (checked || modalBody.querySelector('input[name="dashModalDest"]'))?.focus();
      },
      getValue: () => {
        const checked = modalBody.querySelector('input[name="dashModalDest"]:checked');
        if (!checked) {
          return null;
        }
        return checked.value;
      }
    });
    return selected;
  }
  this.parentOfUrl = (folderUrl) => {
    const parts = String(folderUrl || '').split('::').filter(Boolean);
    if (parts.length < 2) {
      return '';
    }
    return parts.slice(0, -1).join('/');
  }
  this.move = async (project) => {
    try {
      const currentParent = this.parentOfUrl(project);
      const parent = await this.pickDestination(currentParent);
      if (parent === null) {
        return;
      }
      this.showStatus('...');
      const output = await (await fetch(`${options.api}/move/${encodeURIComponent(project)}`, {
        method: 'post',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parent })
      })).json();
      if (output.error) {
        throw new Error(output.error);
      }
      this.showStatus(`movida a content/${String(output.result).split('::').join('/')}`);
      this.getPage(currentPage);
    }
    catch (error) {
      this.handleError(error);
    }
  }
  this.moveSpace = async (spaceUrl, displayName) => {
    try {
      const currentParent = this.parentOfUrl(spaceUrl);
      const diskPath = String(spaceUrl).split('::').join('/');
      const parent = await this.pickDestination(currentParent, diskPath);
      if (parent === null) {
        return;
      }
      this.showStatus('...');
      const output = await (await fetch(`${options.api}/spaces/${encodeURIComponent(spaceUrl)}/move`, {
        method: 'post',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parent })
      })).json();
      if (output.error) {
        throw new Error(output.error);
      }
      this.showStatus(`sección movida a content/${output.result}`);
      this.getPage(currentPage);
    }
    catch (error) {
      this.handleError(error);
    }
  }
  this.copy = async (project) => {
    try {
      const base = this.basename(project);
      const name = await this.promptName({
        title: 'Copiar actividad',
        hint: 'Nombre de la carpeta de la copia. Los espacios pasan a guiones.',
        defaultValue: `${base}-copia`,
        okLabel: 'Copiar'
      });
      if (name === null || !name) {
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
      const current = baseName || this.basename(project);
      const name = await this.promptName({
        title: 'Renombrar actividad',
        hint: 'Nuevo nombre de la carpeta. Los espacios pasan a guiones.',
        defaultValue: current,
        okLabel: 'Renombrar'
      });
      if (name === null || !name || name === current) {
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
      const pathLabel = String(project).split('::').join('/');
      const confirmed = await this.confirmAction({
        title: 'Eliminar actividad',
        message: `¿Eliminar "content/${pathLabel}"? Esta acción no se puede deshacer.`,
        okLabel: 'Eliminar'
      });
      if (!confirmed) {
        return;
      }
      this.showStatus('...');
      const output = await (await fetch(`${options.api}/remove/${encodeURIComponent(project)}`, {method: 'post'})).json();
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
