export interface User {
  id: number;
  email: string;
  name: string;
  role: 'admin' | 'user';
  avatar: string;
}

export const users: User[] = [
  {
    id: 1,
    email: 'admin@nxpress.dev',
    name: 'Admin Developer',
    role: 'admin',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
  },
  {
    id: 2,
    email: 'user@nxpress.dev',
    name: 'Demo User',
    role: 'user',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
  },
];

export function findUserByEmail(email: string): User | undefined {
  return users.find(u => u.email.toLowerCase() === email.toLowerCase());
}
