const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const cp = require('../contentPaths');

describe('contentPaths — rutas y URL', () => {
  it('sanitizeSegment limpia caracteres y espacios', () => {
    assert.equal(cp.sanitizeSegment('Unidad 1!'), 'Unidad-1');
    assert.equal(cp.sanitizeSegment('prueba_1'), 'prueba_1');
    assert.equal(cp.sanitizeSegment('../x'), 'x');
  });

  it('toUrlFolder / fromUrlFolder usan ::', () => {
    assert.equal(cp.toUrlFolder('ingles/unidad-1'), 'ingles::unidad-1');
    assert.equal(cp.fromUrlFolder('ingles::unidad-1'), 'ingles/unidad-1');
  });

  it('fromUrlFolder rechaza barras literales', () => {
    assert.throws(() => cp.fromUrlFolder('ingles/unidad-1'), /codificación/);
  });

  it('joinParent / parentOf / basenameOf', () => {
    assert.equal(cp.joinParent('', 'a'), 'a');
    assert.equal(cp.joinParent('ingles', 'u1'), 'ingles/u1');
    assert.equal(cp.parentOf('ingles/u1/act'), 'ingles/u1');
    assert.equal(cp.parentOf('ingles'), '');
    assert.equal(cp.basenameOf('ingles/u1'), 'u1');
  });

  it('joinParent rechaza nombre vacío', () => {
    assert.throws(() => cp.joinParent('', '!!!'), /vacío/);
  });

  it('toDashboardHref y breadcrumbParts', () => {
    assert.equal(cp.toDashboardHref(''), '/dashboard');
    assert.equal(cp.toDashboardHref('ingles/u1'), '/dashboard/ingles/u1');
    const crumbs = cp.breadcrumbParts('ingles/u1');
    assert.equal(crumbs.length, 2);
    assert.equal(crumbs[0].href, '/dashboard/ingles');
    assert.equal(crumbs[1].path, 'ingles/u1');
  });

  it('isUnderPath detecta anidamiento', () => {
    assert.equal(cp.isUnderPath('ingles/u1', 'ingles'), true);
    assert.equal(cp.isUnderPath('ingles', 'ingles'), true);
    assert.equal(cp.isUnderPath('frances', 'ingles'), false);
    assert.equal(cp.isUnderPath('ingles', ''), false);
  });

  it('assertSafeRelative rechaza path traversal', () => {
    assert.throws(() => cp.assertSafeRelative('../x'), /no válida/);
    assert.throws(() => cp.assertSafeRelative(''), /vacía/);
  });
});

describe('contentPaths — árbol en disco', () => {
  let tmp;

  before(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'h5p-cli-cp-'));
    cp.setContentRoot(tmp);
  });

  after(() => {
    cp.setContentRoot('content');
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  beforeEach(() => {
    for (const name of fs.readdirSync(tmp)) {
      fs.rmSync(path.join(tmp, name), { recursive: true, force: true });
    }
  });

  const mkdir = (...parts) => {
    const dir = path.join(tmp, ...parts);
    fs.mkdirSync(dir, { recursive: true });
    return dir;
  };

  const writeActivity = (...parts) => {
    const dir = mkdir(...parts);
    fs.writeFileSync(path.join(dir, 'h5p.json'), JSON.stringify({ title: parts.at(-1) }));
    fs.mkdirSync(path.join(dir, 'content'), { recursive: true });
    return dir;
  };

  it('distingue sección (sin h5p.json) de actividad', () => {
    const space = mkdir('ingles');
    writeActivity('root-act');
    assert.equal(cp.isSpaceDir(space), true);
    assert.equal(cp.isActivityDir(path.join(tmp, 'root-act')), true);
    assert.equal(cp.isSpaceDir(path.join(tmp, 'root-act')), false);
  });

  it('listSpaces y listActivities en raíz y anidados', () => {
    mkdir('ingles');
    mkdir('ingles', 'unidad-1');
    writeActivity('solo-raiz');
    writeActivity('ingles', 'quiz-a');
    writeActivity('ingles', 'unidad-1', 'quiz-b');

    const rootSpaces = cp.listSpaces('');
    assert.deepEqual(rootSpaces.map((s) => s.folder), ['ingles']);

    const rootActs = cp.listActivities('');
    assert.deepEqual(rootActs, ['solo-raiz']);

    assert.deepEqual(cp.listSpaces('ingles').map((s) => s.folder), ['ingles/unidad-1']);
    assert.deepEqual(cp.listActivities('ingles'), ['ingles/quiz-a']);
    assert.deepEqual(cp.listActivities('ingles/unidad-1'), ['ingles/unidad-1/quiz-b']);
  });

  it('listAllSpacePaths recorre en profundidad', () => {
    mkdir('a');
    mkdir('a', 'b');
    mkdir('c');
    assert.deepEqual(cp.listAllSpacePaths(), ['a', 'a/b', 'c']);
  });

  it('spaceHasChildren refleja hijas y actividades', () => {
    mkdir('vacia');
    mkdir('con-sub');
    mkdir('con-sub', 'hija');
    mkdir('con-act');
    writeActivity('con-act', 'x');

    assert.equal(cp.spaceHasChildren('vacia'), false);
    assert.equal(cp.spaceHasChildren('con-sub'), true);
    assert.equal(cp.spaceHasChildren('con-act'), true);
  });

  it('contentDir usa el root temporal', () => {
    assert.equal(cp.contentDir(''), tmp);
    assert.equal(cp.contentDir('ingles/u1'), path.posix.join(tmp, 'ingles/u1'));
  });
});
