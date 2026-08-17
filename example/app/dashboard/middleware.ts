import type { Request, Response, NextFunction } from 'express';

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user;
  
  if (!user) {
    return res.redirect('/login?redirect=/dashboard&error=auth_required');
  }

  res.setHeader('X-Dashboard-Access', 'Granted');
  next();
}
