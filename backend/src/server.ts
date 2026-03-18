import dotenv from 'dotenv';
dotenv.config({ override: true });
import express from 'express';
import cors from 'cors';
import routes from './api/routes.js';

const PORT = Number(process.env.PORT) || 3001;

const app = express();

app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:5174', 'http://127.0.0.1:5173'],
  methods: ['GET', 'POST'],
}));
app.use(express.json({ limit: '50mb' }));

app.use('/api', routes);

app.listen(PORT, () => {
  console.log(`\n╔══════════════════════════════════════════╗`);
  console.log(`║  Codebase Intelligence Engine            ║`);
  console.log(`║  Running on http://localhost:${PORT}        ║`);
  console.log(`╚══════════════════════════════════════════╝\n`);
});
