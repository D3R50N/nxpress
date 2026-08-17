import type { Request, Response } from 'express';
import { findUserByEmail } from '../../../data/users';

export const POST = async (req: Request, res: Response) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ success: false, error: 'Email and password required' });
  }

  const user = findUserByEmail(email);

  if (!user) {
    return res.status(401).json({ success: false, error: 'Invalid credentials' });
  }

  return res.json({
    success: true,
    user,
    token: 'jwt_mock_token_' + Date.now(),
  });
};
