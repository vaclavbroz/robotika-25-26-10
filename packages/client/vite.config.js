import path from "node:path";
import { defineConfig } from "vite";

const clientReloadDebounceMs = 1400;

export default defineConfig({
  plugins: [debouncedClientReloadPlugin()],
});

function debouncedClientReloadPlugin() {
  let reloadTimer = null;
  let lastAnnouncementAtMs = 0;
  const clientRoot = `${path.sep}packages${path.sep}client${path.sep}`;

  return {
    name: "debounced-client-reload",
    handleHotUpdate(context) {
      const isClientSource =
        context.file.includes(`${path.sep}src${path.sep}`) ||
        context.file.endsWith(`${path.sep}index.html`) ||
        (context.file.includes(clientRoot) &&
          !context.file.includes(`${path.sep}node_modules${path.sep}`) &&
          !context.file.endsWith(`${path.sep}vite.config.js`));
      if (!isClientSource) {
        return;
      }

      const now = Date.now();
      if (now - lastAnnouncementAtMs > 250) {
        context.server.ws.send({
          type: "custom",
          event: "dev:client-update-pending",
          data: {
            delayMs: clientReloadDebounceMs,
          },
        });
        lastAnnouncementAtMs = now;
      }

      clearTimeout(reloadTimer);
      reloadTimer = setTimeout(() => {
        reloadTimer = null;
        context.server.ws.send({
          type: "full-reload",
          path: "*",
        });
      }, clientReloadDebounceMs);

      return [];
    },
  };
}
