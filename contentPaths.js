const fs = require('fs');
const path = require('path');

const CONTENT_ROOT = 'content';
const URL_SEP = '::';

/**
 * Fase 0 — contrato:
 * - Actividad: carpeta con h5p.json
 * - Espacio (fase 1): carpeta bajo content/ sin h5p.json (un solo nivel)
 * - Raíz: actividades y espacios en content/
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

/** Disk path relative to cwd, e.g. content/ingles/act */
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

/** URL param ↔ disk relative path (ingles/act ↔ ingles::act) */
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

/** parent space (one segment or '') + activity name → relative path */
const joinParent = (parent, name) => {
  const segment = sanitizeSegment(name);
  if (!segment) {
    throw new Error('folder name is empty');
  }
  const parentClean = parent ? sanitizeSegment(parent) : '';
  if (parent && parentClean !== parent) {
    throw new Error('invalid space name');
  }
  if (parentClean) {
    return `${parentClean}/${segment}`;
  }
  return segment;
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

/** List direct child activity folders under parent ('' = root). */
const listActivities = (parent = '') => {
  const base = contentDir(parent);
  if (!fs.existsSync(base)) {
    return [];
  }
  const items = [];
  for (const name of fs.readdirSync(base)) {
    const full = path.join(base, name);
    if (!fs.statSync(full).isDirectory()) {
      continue;
    }
    if (!isActivityDir(full)) {
      continue;
    }
    const relative = parent ? `${sanitizeSegment(parent)}/${name}` : name;
    items.push(relative);
  }
  return items;
};

/** List spaces at content root (phase 1: only root). */
const listSpaces = () => {
  const base = CONTENT_ROOT;
  if (!fs.existsSync(base)) {
    fs.mkdirSync(base, { recursive: true });
    return [];
  }
  const spaces = [];
  for (const name of fs.readdirSync(base)) {
    const full = path.join(base, name);
    if (!fs.statSync(full).isDirectory()) {
      continue;
    }
    if (!isSpaceDir(full)) {
      continue;
    }
    spaces.push({
      name,
      folder: name
    });
  }
  spaces.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
  return spaces;
};

const spaceHasActivities = (spaceName) => {
  const relative = sanitizeSegment(spaceName);
  if (!relative) {
    return false;
  }
  return listActivities(relative).length > 0;
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
  joinParent,
  parentOf,
  basenameOf,
  listActivities,
  listSpaces,
  spaceHasActivities
};
