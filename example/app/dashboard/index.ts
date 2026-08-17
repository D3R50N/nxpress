import type { Request, Response } from 'express';
import type { NxpressMetadata } from '../../../src';
import { products } from '../../data/products';
import { users } from '../../data/users';

export function metadata(req: Request, res: Response): NxpressMetadata {
  return {
    title: 'Admin Dashboard - Nxpress',
    description: 'Protected administration panel showcasing cascading middleware in Nxpress.',
  };
}

export default async function props(req: Request, res: Response) {
  const user = (req as any).user || { email: 'admin@nxpress.dev', name: 'Admin Developer', role: 'admin' };

  const totalRevenue = products.reduce((acc, p) => acc + p.price * p.stock, 0);
  const totalStock = products.reduce((acc, p) => acc + p.stock, 0);

  return {
    user,
    stats: {
      totalProducts: products.length,
      totalUsers: users.length,
      totalStock,
      totalRevenue,
    },
    products,
    systemInfo: {
      nodeVersion: process.version,
      platform: process.platform,
      uptime: Math.floor(process.uptime()),
      memory: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)} MB`,
    },
  };
}
