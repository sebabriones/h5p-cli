const fs = require('fs');
const path = require('path');

const CONTENT_ROOT = 'content';
const URL_SEP = '::';

/**
 * Contrato:
 * - Actividad: carpeta con h5p.json
 * - Sección / sub-sección: carpeta sin h5p.json (anidable)
 * - Raíz: content/
 */

const sanitizeSegment = (name) => {
  return String(name ?? '')
    .replaceAll(/[^a-zA-Z0-9 _-]/g, '')
    .replaceAll(' ', '-')
    .replaceAll(/\.+/g, '')
    .replaceAll(/^[.-]+|[.-]+$/g, '');
};

const assertSafeRelative = (relative) => {
  const normalized = String(relative ?? '').replaceAll('\\', '/').replaceAll(/^\/+|\/+$/g, '');
  if (!normalized) {
    throw new Error('path is empty');
  }
  const parts = normalized.split('/').filter(Boolean);
  if (parts.some((part) => part === '.' || part === '..' || part.includes('\0'))) {
    throw new Error('invalid path');
  }
  for (const part of parts) {
    if (sanitizeSegment(part) !== part) {
      throw new Error(`invalid path segment: ${part}`);
    }
  }
  return parts.join('/');
};

/** Disk path relative to cwd, e.g. content/ingles/unidad-1 */
const contentDir = (relative = '') => {
  if (!relative) {
    return CONTENT_ROOT;
  }
  return path.posix.join(CONTENT_ROOT, assertSafeRelative(relative));
};

const isActivityDir = (absoluteOrRelativeFsPath) => {
  return fs.existsSync(path.join(absoluteOrRelativeFsPath, 'h5p.json'));
};

const isSpaceDir = (absoluteOrRelativeFsPath) => {
  if (!fs.existsSync(absoluteOrRelativeFsPath) || !fs.statSync(absoluteOrRelativeFsPath).isDirectory()) {
    return false;
  }
  return !isActivityDir(absoluteOrRelativeFsPath);
};

/** URL param ↔ disk relative path (ingles/u1 ↔ ingles::u1) */
const toUrlFolder = (relativePath) => {
  if (!relativePath) {
    return '';
  }
  return assertSafeRelative(relativePath).split('/').join(URL_SEP);
};

const fromUrlFolder = (urlFolder) => {
  const raw = String(urlFolder ?? '');
  if (!raw) {
    return '';
  }
  if (raw.includes('/') || raw.includes('\\')) {
    throw new Error('invalid folder encoding');
  }
  const relative = raw.split(URL_SEP).filter(Boolean).join('/');
  return assertSafeRelative(relative);
};

/** Dashboard path with slashes ↔ relative disk path */
const fromDashboardPath = (dashboardPath) => {
  const raw = String(dashboardPath ?? '').replaceAll('\\', '/').replaceAll(/^\/+|\/+$/g, '');
  if (!raw) {
    return '';
  }
  return assertSafeRelative(raw);
};

const toDashboardHref = (relativePath) => {
  if (!relativePath) {
    return '/dashboard';
  }
  return `/dashboard/${assertSafeRelative(relativePath)}`;
};

/** parent ('' or multi-segment) + name → relative path */
const joinParent = (parent, name) => {
  const segment = sanitizeSegment(name);
  if (!segment) {
    throw new Error('folder name is empty');
  }
  if (!parent) {
    return segment;
  }
  const parentClean = assertSafeRelative(parent);
  return `${parentClean}/${segment}`;
};

const parentOf = (relativePath) => {
  const parts = assertSafeRelative(relativePath).split('/');
  if (parts.length < 2) {
    return '';
  }
  return parts.slice(0, -1).join('/');
};

const basenameOf = (relativePath) => {
  const parts = assertSafeRelative(relativePath).split('/');
  return parts[parts.length - 1];
};

const breadcrumbParts = (relativePath) => {
  if (!relativePath) {
    return [];
  }
  const parts = assertSafeRelative(relativePath).split('/');
  const crumbs = [];
  let acc = '';
  for (const part of parts) {
    acc = acc ? `${acc}/${part}` : part;
    crumbs.push({ name: part, path: acc, href: toDashboardHref(acc) });
  }
  return crumbs;
};

/** List direct child activity folders under parent ('' = root). */
const listActivities = (parent = '') => {
  const base = contentDir(parent);
  if (!fs.existsSync(base)) {
    return [];
  }
  const parentClean = parent ? assertSafeRelative(parent) : '';
  const items = [];
  for (const name of fs.readdirSync(base)) {
    const full = path.join(base, name);
    if (!fs.statSync(full).isDirectory()) {
      continue;
    }
    if (!isActivityDir(full)) {
      continue;
    }
    items.push(parentClean ? `${parentClean}/${name}` : name);
  }
  return items;
};

/** List child spaces/sections under parent ('' = root). */
const listSpaces = (parent = '') => {
  const base = contentDir(parent);
  if (!fs.existsSync(base)) {
    if (!parent) {
      fs.mkdirSync(base, { recursive: true });
    }
    return [];
  }
  const parentClean = parent ? assertSafeRelative(parent) : '';
  const spaces = [];
  for (const name of fs.readdirSync(base)) {
    const full = path.join(base, name);
    if (!fs.statSync(full).isDirectory()) {
      continue;
    }
    if (!isSpaceDir(full)) {
      continue;
    }
    const folder = parentClean ? `${parentClean}/${name}` : name;
    spaces.push({
      name,
      folder,
      folderUrl: toUrlFolder(folder),
      href: toDashboardHref(folder)
    });
  }
  spaces.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
  return spaces;
};

/** True if the folder has direct child activities or nested spaces with content. */
const spaceHasChildren = (relativePath) => {
  const relative = assertSafeRelative(relativePath);
  if (listActivities(relative).length > 0) {
    return true;
  }
  return listSpaces(relative).length > 0;
};

/** @deprecated use spaceHasChildren */
const spaceHasActivities = (spaceName) => {
  return listActivities(assertSafeRelative(spaceName)).length > 0;
};

module.exports = {
  CONTENT_ROOT,
  URL_SEP,
  sanitizeSegment,
  assertSafeRelative,
  contentDir,
  isActivityDir,
  isSpaceDir,
  toUrlFolder,
  fromUrlFolder,
  fromDashboardPath,
  toDashboardHref,
  joinParent,
  parentOf,
  basenameOf,
  breadcrumbParts,
  listActivities,
  listSpaces,
  spaceHasChildren,
  spaceHasActivities
};
