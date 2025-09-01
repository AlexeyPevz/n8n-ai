/**
 * Тестовый сервер для e2e тестов
 * Запускается автоматически перед тестами
 */

import { server } from './server.js';

const PORT = process.env.TEST_PORT || process.env.PORT || 3000;

async function startTestServer() {
  try {
    await server.listen({ port: Number(PORT), host: '0.0.0.0' });
    console.log(`Test server running on port ${PORT}`);
    
    // Keep the server running
    await new Promise((resolve) => {
      // Graceful shutdown
      process.on('SIGTERM', async () => {
        console.log('Shutting down test server...');
        await server.close();
        resolve(undefined);
        process.exit(0);
      });
      
      process.on('SIGINT', async () => {
        console.log('Shutting down test server...');
        await server.close();
        resolve(undefined);
        process.exit(0);
      });
    });
  } catch (err) {
    console.error('Failed to start test server:', err);
    process.exit(1);
  }
}

startTestServer();