import { pathToFileURL } from 'node:url';
import { getBackendConfig } from './env.mjs';
import { createBackendApp } from './app.mjs';

export async function startEcoTrackBackend(overrides = {}) {
  const config = getBackendConfig(overrides);
  const app = createBackendApp(config);
  const running = await app.startServer(config.port, config.host);

  const geminiStatus = config.getGeminiApiKey()
    ? `configured (model: ${config.geminiModel})`
    : 'not set (AI coach returns 503 until GEMINI_API_KEY is configured)';

  console.log(
    `[EcoTrack Node Backend] Listening on http://${config.host}:${running.port}`
  );
  console.log(`[EcoTrack Node Backend] SQLite database: ${config.dbPath}`);
  console.log(`[EcoTrack Node Backend] Gemini AI status: ${geminiStatus}`);

  return running;
}

const isDirectRun =
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  let runningServer = null;
  startEcoTrackBackend()
    .then((running) => {
      runningServer = running;
    })
    .catch((err) => {
      console.error('[EcoTrack Node Backend] Failed to start:', err);
      process.exit(1);
    });

  const shutdown = async () => {
    if (runningServer) {
      await runningServer.close();
    }
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}
