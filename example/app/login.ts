import type { Request, Response } from 'express';
import type { NxpressMetadata } from '../../src';

export function metadata(req: Request, res: Response): NxpressMetadata {
  return {
    title: 'Login - Nxpress Store',
    description: 'Sign in to test authentication and protected routes.',
  };
}

export default async function props(req: Request, res: Response) {
  const redirectUrl = (req.query.redirect as string) || '/dashboard';
  const hasError = req.query.error === 'auth_required';

  return {
    redirectUrl,
    hasError,
    currentUser: (req as any).user || null,
  };
}
