/**
 * Тестовый сервер для e2e тестов
 * Запускается автоматически перед тестами
 */

import { server } from './server.js';

const PORT = process.env.TEST_PORT || process.env.PORT || 3000;

async function startTestServer() {
  try {
    await server.listen({ port: Number(PORT), host: '0.0.0.0' });
    // Test server started
    
    // Keep the server running
    await new Promise((resolve) => {
      // Graceful shutdown
      process.on('SIGTERM', async () => {
        // Shutting down test server
        await server.close();
        resolve(undefined);
        process.exit(0);
      });
      
      process.on('SIGINT', async () => {
        // Shutting down test server
        await server.close();
        resolve(undefined);
        process.exit(0);
      });
    });
  } catch (err) {
    process.exit(1);
  }
}

startTestServer();