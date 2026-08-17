import type { Request, Response } from 'express';
import type { NxpressMetadata } from '../../src';
import { getProducts, products } from '../data/products';

export function metadata(req: Request, res: Response): NxpressMetadata {
  return {
    title: 'Homedine — Eco-Friendly Kitchenware for a Greener Home',
    description: 'Discover non-toxic cookware, natural bamboo tableware, and sustainable kitchen essentials.',
    openGraph: {
      title: 'Homedine Kitchenware',
      description: 'Handcrafted sustainable kitchenware made from natural and non-toxic materials.',
    },
  };
}

export default async function props(req: Request, res: Response) {
  const bestsellers = getProducts().slice(0, 4);

  const stories = [
    { title: 'CupEco', subtitle: 'Explore', image: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=400&auto=format&fit=crop&q=80', url: '/products?category=drinkware' },
    { title: 'EcoSpoonery', subtitle: 'Explore', image: 'https://images.unsplash.com/photo-1584990347449-35c824c9657f?w=400&auto=format&fit=crop&q=80', url: '/products?category=tableware' },
    { title: 'NatureSip', subtitle: 'Explore', image: 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=400&auto=format&fit=crop&q=80', url: '/products?category=drinkware' },
    { title: 'FreshPitcher', subtitle: 'Explore', image: 'https://images.unsplash.com/photo-1590794056226-79ef3a8147e1?w=400&auto=format&fit=crop&q=80', url: '/products?category=drinkware' },
  ];

  const gallery = [
    { title: 'Sustainable Stone Pot', image: 'https://images.unsplash.com/photo-1584990347449-35c824c9657f?w=500&auto=format&fit=crop&q=80' },
    { title: 'Grain Slice Round Tray', image: 'https://images.unsplash.com/photo-1590794056226-79ef3a8147e1?w=500&auto=format&fit=crop&q=80' },
    { title: 'Raw-Edge Utensil Set', image: 'https://images.unsplash.com/photo-1544233726-9f1d2b27be8b?w=500&auto=format&fit=crop&q=80' },
    { title: 'Olive Pot Ceramic', image: 'https://images.unsplash.com/photo-1574269909862-7e1d70bb8078?w=500&auto=format&fit=crop&q=80' },
    { title: 'Handcrafted Ceramic Cup', image: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=500&auto=format&fit=crop&q=80' },
  ];

  const reviews = [
    {
      author: 'Jane Cooper',
      role: 'Nutritionist',
      text: 'Homedine’s glass jars are awesome for storage, and the bamboo utensils are perfect for daily use!',
    },
    {
      author: 'Darlene Robertson',
      role: 'Culinary Enthusiast',
      text: 'Fantastic products and fast delivery. My kitchen feels so much greener and non-toxic!',
    },
    {
      author: 'Jerome Jones',
      role: 'Food Blogger',
      text: 'Love Homedine’s eco-style! Glass jars keep things fresh, and bamboo utensils are so chic.',
    },
  ];

  return {
    bestsellers,
    stories,
    gallery,
    reviews,
    totalProducts: products.length,
  };
}
