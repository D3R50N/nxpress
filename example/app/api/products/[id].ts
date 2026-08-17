import type { Request, Response } from 'express';
import { getProductById, updateProduct, deleteProduct } from '../../../data/products';

// GET /api/products/:id
export const GET = (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const product = getProductById(id);

  if (!product) {
    return res.status(404).json({ error: 'Product not found' });
  }

  res.json(product);
};

// PUT /api/products/:id
export const PUT = (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const updated = updateProduct(id, req.body || {});

  if (!updated) {
    return res.status(404).json({ error: 'Product not found' });
  }

  res.json(updated);
};

// DELETE /api/products/:id
export const DELETE = (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const deleted = deleteProduct(id);

  if (!deleted) {
    return res.status(404).json({ error: 'Product not found' });
  }

  res.status(200).json({ success: true, message: `Product ${id} deleted` });
};
