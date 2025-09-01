import express from 'express';
import { createAIRoutes } from './src/ai-routes';

const app = express();
app.use(express.json());
app.use(createAIRoutes());

const port = Number(process.env.PORT ?? 4000);
app.listen(port, () => {
  console.log(`n8n-ai-hooks dev server listening on http://localhost:${port}`);
});

