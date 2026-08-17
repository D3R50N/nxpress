import type { Request, Response } from 'express';
import { getProducts, createProduct } from '../../data/products';

// GET /api/products?search=...&category=...
export const GET = (req: Request, res: Response) => {
  const search = req.query.search as string | undefined;
  const category = req.query.category as string | undefined;

  const results = getProducts({ search, category });
  res.json({
    count: results.length,
    products: results,
  });
};

// POST /api/products
export const POST = (req: Request, res: Response) => {
  const { name, price, category, description, stock, rating } = req.body || {};

  if (!name || price === undefined) {
    return res.status(400).json({ error: 'Name and price are required' });
  }

  const newProduct = createProduct({
    name,
    price: Number(price),
    category: category || 'General',
    description: description || '',
    stock: Number(stock) || 0,
    rating: Number(rating) || 5.0,
  });

  res.status(201).json(newProduct);
};
