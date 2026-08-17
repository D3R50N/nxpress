import type { Request, Response } from 'express';
import type { NxpressMetadata } from '../../../src';
import { getProductById, products } from '../../data/products';

export function metadata(req: Request, res: Response): NxpressMetadata {
  const id = Number(req.params.id);
  const product = getProductById(id);

  if (!product) {
    return {
      title: 'Product Not Found - Nxpress Store',
      description: 'The requested product could not be found.',
    };
  }

  return {
    title: `${product.name} - Nxpress Store`,
    description: product.description,
    openGraph: {
      title: product.name,
      description: product.description,
    },
  };
}

export default async function props(req: Request, res: Response) {
  const id = Number(req.params.id);
  const product = getProductById(id) || null;

  const related = product
    ? products.filter(p => p.category === product.category && p.id !== product.id).slice(0, 3)
    : [];

  return {
    product,
    related,
  };
}
