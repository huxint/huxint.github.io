import { existsSync, globSync } from 'node:fs';
import { copyFile } from 'node:fs/promises';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const contentRoot = 'src/content/life';
const videoFile = /\.(?:mp4|webm|mov)$/i;

// Videos in life records are served from /life/<id>/ next to the page: the
// dev server maps them back to the content directory, the build copies them
// for every record that was published.
export function lifeMedia() {
  return {
    name: 'life-media',
    hooks: {
      'astro:config:setup': ({ updateConfig }) => {
        updateConfig({
          vite: {
            plugins: [
              {
                name: 'life-media-dev',
                configureServer(server) {
                  server.middlewares.use((request, _response, next) => {
                    const match = /^\/life\/([^/?#]+)\/([^/?#]+)$/.exec(
                      request.url ?? '',
                    );
                    if (match && videoFile.test(match[2])) {
                      const file = join(
                        contentRoot,
                        decodeURIComponent(match[1]),
                        decodeURIComponent(match[2]),
                      );
                      if (existsSync(file))
                        request.url = `/${file.split(sep).join('/')}`;
                    }
                    next();
                  });
                },
              },
            ],
          },
        });
      },
      'astro:build:done': async ({ dir }) => {
        const outDir = fileURLToPath(dir);
        for (const file of globSync(`${contentRoot}/*/*`)) {
          if (!videoFile.test(file)) continue;
          const path = relative(contentRoot, file);
          const target = join(outDir, 'life', path);
          if (!existsSync(join(dirname(target), 'index.html'))) continue;
          await copyFile(file, target);
        }
      },
    },
  };
}
