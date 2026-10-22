import { resolve } from 'node:path';
import { createPvpServer } from './server';
const origins = (
  process.env.PVP_ORIGINS ??
  'http://127.0.0.1:5173,http://127.0.0.1:5205,http://127.0.0.1:5227,http://127.0.0.1:8080,http://localhost:8080'
)
  .split(',')
  .map((s) => s.trim());
if (
  origins.some((s) => {
    try {
      const u = new URL(s);
      return u.origin !== s || !['http:', 'https:'].includes(u.protocol);
    } catch {
      return true;
    }
  })
)
  throw Error('PVP_ORIGINS must contain exact HTTP(S) origins');
const app = createPvpServer({
  databasePath: process.env.PVP_DATABASE ?? resolve('.local-online/pvp.sqlite'),
  origins,
});
app.server.listen(Number(process.env.PVP_PORT ?? 8787), process.env.PVP_HOST ?? '127.0.0.1', () =>
  console.log('MUGONG PvP server ready'),
);
for (const signal of ['SIGINT', 'SIGTERM'] as const)
  process.on(signal, () => {
    void app.close().then(() => process.exit(0));
  });
