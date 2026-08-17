import type { Request, Response } from 'express';

export const GET = (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    engine: 'ejs',
    framework: 'Nxpress',
    node: process.version,
  });
};
