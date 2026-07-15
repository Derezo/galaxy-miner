import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(__filename), '../../..');

describe('browser static entry contracts', () => {
  it('serves every shared module referenced by the browser entry point', () => {
    const html = fs.readFileSync(path.join(projectRoot, 'client/index.html'), 'utf8');
    const serverSource = fs.readFileSync(path.join(projectRoot, 'server/index.js'), 'utf8');
    const sharedSources = [...html.matchAll(/<script[^>]+src="(\/shared\/[^"?]+\.js)(?:\?[^\"]*)?"/g)]
      .map(match => match[1]);

    expect(sharedSources.length).toBeGreaterThan(0);
    for (const source of sharedSources) {
      expect(
        serverSource,
        `${source} is referenced by client/index.html but is not served by server/index.js`
      ).toContain(`app.get('${source}'`);

      expect(
        fs.existsSync(path.join(projectRoot, source.slice(1))),
        `${source} does not exist on disk`
      ).toBe(true);
    }
  });

  it('keeps every local script and stylesheet reference backed by a file', () => {
    const html = fs.readFileSync(path.join(projectRoot, 'client/index.html'), 'utf8');
    const references = [...html.matchAll(/<(?:script[^>]+src|link[^>]+href)="([^"?]+)(?:\?[^\"]*)?"/g)]
      .map(match => match[1])
      .filter(reference => !reference.startsWith('/socket.io/'));

    for (const reference of references) {
      const absolutePath = reference.startsWith('/shared/')
        ? path.join(projectRoot, reference.slice(1))
        : path.join(projectRoot, 'client', reference.replace(/^\//, ''));
      expect(fs.existsSync(absolutePath), `${reference} does not exist on disk`).toBe(true);
    }
  });

  it('loads and renders the Void Leviathan spawn cinematic', () => {
    const html = fs.readFileSync(path.join(projectRoot, 'client/index.html'), 'utf8');
    const renderer = fs.readFileSync(path.join(projectRoot, 'client/js/renderer.js'), 'utf8');
    const effectsLayer = fs.readFileSync(
      path.join(projectRoot, 'client/js/renderer/layers/EffectsLayer.js'),
      'utf8'
    );
    const cinematicSource = 'js/graphics/leviathan-spawn.js';

    expect(html).toContain(`<script src="${cinematicSource}"></script>`);
    expect(html.indexOf(cinematicSource)).toBeLessThan(html.indexOf('js/renderer.js'));
    expect(renderer).toContain('LeviathanSpawn.update(dt)');
    expect(renderer).toContain('LeviathanSpawn.draw(ctx, this.camera)');
    expect(effectsLayer).toContain('LeviathanSpawn.draw(ctx, camera)');
  });
});
