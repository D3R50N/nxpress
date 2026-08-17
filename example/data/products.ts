export interface Product {
  id: number;
  name: string;
  price: number;
  category: string;
  badge?: string;
  image: string;
  colors?: string[];
  description: string;
  stock: number;
  rating: number;
}

export let products: Product[] = [
  {
    id: 1,
    name: "Reusable drinkware for a greener lifestyle",
    price: 43.85,
    category: "Drinkware",
    badge: "Promotion",
    image: "https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=800&auto=format&fit=crop&q=80",
    colors: ["#6fa89c", "#9dbcb5", "#3a574f"],
    description: "Insulated stainless steel and bamboo bottle designed for lasting everyday zero-waste hydration.",
    stock: 28,
    rating: 4.9,
  },
  {
    id: 2,
    name: "Non-toxic cookware for sustainable cooking",
    price: 78.35,
    category: "Cookware",
    badge: "New",
    image: "https://images.unsplash.com/photo-1584990347449-35c824c9657f?w=800&auto=format&fit=crop&q=80",
    colors: ["#9ab346", "#d98236", "#5a6e35"],
    description: "Naturally non-stick mineral ceramic pots and pans without PTFE, PFOA, or heavy metals.",
    stock: 14,
    rating: 4.8,
  },
  {
    id: 3,
    name: "Kettle & Toaster eco-friendly meals",
    price: 143.65,
    category: "Appliances",
    badge: "Customer Favorite",
    image: "https://images.unsplash.com/photo-1544233726-9f1d2b27be8b?w=800&auto=format&fit=crop&q=80",
    colors: ["#a8997c", "#475c4b", "#c7bba7"],
    description: "Energy-efficient electric kettle with precision temperature presets and organic wooden base.",
    stock: 19,
    rating: 4.9,
  },
  {
    id: 4,
    name: "Bamboo Made Utensil Holder",
    price: 26.27,
    category: "Tableware",
    badge: "New",
    image: "https://images.unsplash.com/photo-1590794056226-79ef3a8147e1?w=800&auto=format&fit=crop&q=80",
    colors: ["#5b6b47", "#8fa176", "#d1a827"],
    description: "Handcrafted 100% organic Moso bamboo utensil carousel with drainage ventilation holes.",
    stock: 45,
    rating: 4.7,
  },
  {
    id: 5,
    name: "Ceramic Glazed Artisan Fresh Pitcher",
    price: 52.00,
    category: "Drinkware",
    badge: "Bestseller",
    image: "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=800&auto=format&fit=crop&q=80",
    colors: ["#3b5c52", "#84a99d", "#e3d8c8"],
    description: "Stone-washed handcrafted ceramic water and juice pitcher with ergonomic pouring spout.",
    stock: 16,
    rating: 4.9,
  },
  {
    id: 6,
    name: "Smart Eco Rice Cooker & Steamer",
    price: 189.50,
    category: "Appliances",
    badge: "New Arrival",
    image: "https://images.unsplash.com/photo-1574269909862-7e1d70bb8078?w=800&auto=format&fit=crop&q=80",
    colors: ["#2d443c", "#d19a4e", "#e8e1d5"],
    description: "Ceramic inner pot multi-cooker with low-energy inductive heating and zero-waste presets.",
    stock: 11,
    rating: 4.9,
  },
];

export function getProducts(query?: { search?: string; category?: string }): Product[] {
  let result = [...products];
  if (query?.category && query.category !== 'all') {
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
