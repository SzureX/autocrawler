/// <reference types="node" />
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';

/** The layouts file the room builder reads and writes (the game bundles it as game data). */
const FILE = fileURLToPath(
  new URL('../../packages/data/src/json/roomLayouts.json', import.meta.url),
);
const MAX_BODY = 5_000_000;

/**
 * Development-only endpoint for the room builder: GET returns the saved layouts, PUT replaces
 * them. It never exists in a production build (`apply: 'serve'`).
 */
export function roomLayoutsDev(): Plugin {
  return {
    name: 'room-layouts-dev',
    apply: 'serve',
    // The builder rewrites the file itself: refresh the module for the next page load, but do not
    // reload the open page (that would throw away the work in the builder).
    handleHotUpdate({ file }) {
      if (file.endsWith('roomLayouts.json')) return [];
      return undefined;
    },
    configureServer(server) {
      server.middlewares.use('/__dev/room-layouts', (req, res) => {
        res.setHeader('Content-Type', 'application/json');
        if (req.method === 'GET') {
          res.end(readFileSync(FILE, 'utf8'));
          return;
        }
        if (req.method !== 'PUT') {
          res.statusCode = 405;
          res.end(JSON.stringify({ error: 'Method not allowed' }));
          return;
        }
        let body = '';
        req.on('data', (chunk: Buffer) => {
          body += chunk.toString('utf8');
          if (body.length > MAX_BODY) req.destroy();
        });
        req.on('end', () => {
          try {
            const list: unknown = JSON.parse(body);
            const ok =
              Array.isArray(list) &&
              list.every(
                (l) =>
                  typeof l === 'object' &&
                  l !== null &&
                  typeof (l as { id?: unknown }).id === 'string',
              );
            if (!ok) throw new Error('Expected an array of layouts');
            writeFileSync(FILE, `${JSON.stringify(list, null, 2)}\n`, 'utf8');
            res.end(JSON.stringify({ saved: list.length }));
          } catch (error) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: String(error) }));
          }
        });
      });
    },
  };
}
