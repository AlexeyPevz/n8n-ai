/**
 * Тестовый сервер для e2e тестов
 * Запускается автоматически перед тестами
 */

import { server } from './server.js';

const PORT = process.env.TEST_PORT || 3000;

async function start() {
  try {
    await server.listen({ port: Number(PORT), host: '0.0.0.0' });
    console.log(`Test server running on port ${PORT}`);
    
    // Graceful shutdown
    process.on('SIGTERM', async () => {
      await server.close();
      process.exit(0);
    });
    
    process.on('SIGINT', async () => {
      await server.close();
      process.exit(0);
    });
  } catch (err) {
    console.error('Failed to start test server:', err);
    process.exit(1);
  }
}

start();