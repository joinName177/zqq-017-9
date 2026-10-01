import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDatabaseConnection } from './adapters/db/sqlite-connection.js';
import { SqliteEntryRepository } from './adapters/db/sqlite-entry-repository.js';
import { DailyEntryService } from './app/services/daily-entry.service.js';
import { createHttpServer } from './adapters/http/server.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function bootstrap(): Promise<void> {
  const port = parseInt(process.env['PORT'] || '3000', 10);
  const host = process.env['HOST'] || '0.0.0.0';

  // Resolve database path
  const defaultDbPath = path.resolve(__dirname, '../data/anxiety-entropy.db');
  const dbPath = process.env['DB_PATH'] || defaultDbPath;

  console.log(`[Bootstrap] Initializing SQLite database at: ${dbPath}`);
  const db = createDatabaseConnection(dbPath);
  const repository = new SqliteEntryRepository(db);
  const dailyEntryService = new DailyEntryService(repository);

  // Auto-seed demo data if database is completely empty
  const count = await repository.count();
  if (count === 0) {
    console.log('[Bootstrap] Database is empty. Seeding initial 14-day thermodynamic demonstration data...');
    await dailyEntryService.seedDemoData();
    console.log('[Bootstrap] Seeding completed.');
  }

  // Create HTTP server
  const server = createHttpServer(dailyEntryService);

  try {
    const address = await server.listen({ port, host });
    console.log(`🚀 [Backend] Anxiety Entropy Server running at ${address}`);
    console.log(`📊 [Backend] Healthcheck available at ${address}/health`);
    console.log(`📈 [Backend] Dashboard API available at ${address}/api/dashboard`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }

  // Graceful shutdown
  const shutdown = async () => {
    console.log('[Shutdown] Closing server and database...');
    await server.close();
    db.close();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

bootstrap().catch((err) => {
  console.error('[Bootstrap] Fatal error during startup:', err);
  process.exit(1);
});
