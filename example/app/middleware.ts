import type { Request, Response, NextFunction } from 'express';

// Routes ignored by this directory middleware
export const ignore = ['/public'];

export function requestTimingMiddleware(req: Request, res: Response, next: NextFunction) {
  res.setHeader('X-Nxpress-Framework', 'Active');
  res.setHeader('X-Custom-Global-Mw', 'example-app');
  next();
}

export function authContextMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const cookieUser = req.headers.cookie?.match(/nxpress_user=([^;]+)/)?.[1];

  if (cookieUser) {
    try {
      (req as any).user = JSON.parse(decodeURIComponent(cookieUser));
    } catch {
      (req as any).user = null;
    }
  } else if (authHeader?.startsWith('Bearer ')) {
    (req as any).user = { email: 'admin@nxpress.dev', name: 'API User', role: 'admin' };
  } else {
    (req as any).user = null;
  }

  next();
}
