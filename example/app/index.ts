import type { Request, Response } from 'express';
import type { NxpressMetadata } from '../../../src';
import { getProducts } from '../data/products';

export function metadata(req: Request, res: Response): NxpressMetadata {
  return {
    title: 'Nxpress - Modern Express Framework',
    description: 'Next-generation file-based routing and SSR for Node.js Express.',
    openGraph: {
      title: 'Nxpress Store Showcase',
      description: 'Explore full SSR with file-based routing, API routes, and middlewares.',
    },
  };
}

export default async function props(req: Request, res: Response) {
  const featured = getProducts().slice(0, 3);
  
  return {
    featured,
    totalProducts: getProducts().length,
  };
}
