export interface Product {
  id: number;
  name: string;
  price: number;
  category: string;
  description: string;
  stock: number;
  rating: number;
}

export let products: Product[] = [
  {
    id: 1,
    name: "MacBook Pro M3 Max",
    price: 3499,
    category: "Laptops",
    description: "Unprecedented performance with Apple Silicon M3 Max, 36GB Unified Memory.",
    stock: 14,
    rating: 4.9,
  },
  {
    id: 2,
    name: "Mechanical Ergonomic Keyboard",
    price: 189,
    category: "Accessories",
    description: "Custom hot-swappable switches, PBT keycaps, and ergonomic split layout.",
    stock: 42,
    rating: 4.8,
  },
  {
    id: 3,
    name: "UltraWide 5K Studio Display",
    price: 1299,
    category: "Displays",
    description: "40-inch curved 5K2K display with Thunderbolt 4 96W power delivery.",
    stock: 8,
    rating: 4.7,
  },
  {
    id: 4,
    name: "Wireless Precision Mouse",
    price: 99,
    category: "Accessories",
    description: "Ergonomic thumb rest, dual connectivity Bluetooth + 2.4GHz, 4000 DPI sensor.",
    stock: 55,
    rating: 4.6,
  },
  {
    id: 5,
    name: "Noise-Cancelling Studio Headphones",
    price: 349,
    category: "Audio",
    description: "Active noise cancellation, lossless high-fidelity spatial audio, 30h battery.",
    stock: 23,
    rating: 4.9,
  },
  {
    id: 6,
    name: "Thunderbolt 4 Docking Station",
    price: 249,
    category: "Accessories",
    description: "12-in-1 ports expansion with dual 4K 60Hz display support and 100W PD.",
    stock: 19,
    rating: 4.5,
  },
];

export function getProducts(query?: { search?: string; category?: string }): Product[] {
  let result = [...products];
  if (query?.category) {
    result = result.filter(p => p.category.toLowerCase() === query.category?.toLowerCase());
  }
  if (query?.search) {
    const term = query.search.toLowerCase();
    result = result.filter(p => p.name.toLowerCase().includes(term) || p.description.toLowerCase().includes(term));
  }
  return result;
}

export function getProductById(id: number): Product | undefined {
  return products.find(p => p.id === id);
}

export function createProduct(data: Omit<Product, 'id'>): Product {
  const newProduct: Product = {
    id: products.length > 0 ? Math.max(...products.map(p => p.id)) + 1 : 1,
    ...data,
  };
  products.push(newProduct);
  return newProduct;
}

export function updateProduct(id: number, data: Partial<Omit<Product, 'id'>>): Product | null {
  const index = products.findIndex(p => p.id === id);
  if (index === -1) return null;
  products[index] = { ...products[index], ...data };
  return products[index];
}

export function deleteProduct(id: number): boolean {
  const index = products.findIndex(p => p.id === id);
  if (index === -1) return false;
  products.splice(index, 1);
  return true;
}
