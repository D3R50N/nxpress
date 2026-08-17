import type { Request, Response } from 'express';
import type { NxpressMetadata } from '../../../src';
import { getProducts, products } from '../../data/products';

export function metadata(req: Request, res: Response): NxpressMetadata {
  return {
    title: 'Products Catalog - Nxpress Store',
    description: 'Browse our high-performance developer hardware and accessories.',
  };
}

export default async function props(req: Request, res: Response) {
  const search = req.query.search as string | undefined;
  const category = req.query.category as string | undefined;

  const filteredProducts = getProducts({ search, category });
  const categories = Array.from(new Set(products.map(p => p.category)));

  return {
    products: filteredProducts,
    categories,
    selectedCategory: category || 'all',
    searchQuery: search || '',
    totalCount: filteredProducts.length,
  };
}
