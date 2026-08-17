import path from 'path';
import { serve } from '../src';

const PORT = Number(process.env.PORT) || 3001;

serve({
  port: PORT,
  rootDir: __dirname,
  engine: 'ejs',
  globals: {
    siteName: 'Nxpress Store',
    author: 'Nxpress Team',
    version: '1.0.0',
    currency: '€',
  },
});