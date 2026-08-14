import type { Request, Response, NextFunction, Handler } from "express";

export const middlewares: Handler[] = [
  (req, res, n) => {
    res.setHeader("X-Custom-Route-Middleware", "index-page");
    console.log("index middleware");
  },
];

export const middleware: Handler = (r, res) => {
  res.setHeader("X-Custom-Route-Middleware", "index-page");
  console.log("index middleware2");
};

export default async function props(req: Request, res: Response) {
  let joke = null;
  try {
    // const resApi = await fetch('https://v2.jokeapi.dev/joke/Any?lang=fr');
    // joke = await resApi.json();
  } catch (err) {
    joke = null;
  }

  const products = [
    {
      id: 1,
      name: "MacBook Pro M3",
      price: 1999,
      category: "Hardware",
      description: "Puissance et autonomie exceptionnelles.",
    },
    {
      id: 2,
      name: "Clavier Mécanique RGB",
      price: 129,
      category: "Accessoires",
      description: "Switches tactiles pour développeurs.",
    },
    {
      id: 3,
      name: "Écran 4K Ergonomique",
      price: 499,
      category: "Écrans",
      description: "32 pouces avec hub USB-C.",
    },
    {
      id: 4,
      name: "Souris Sans Fil MX",
      price: 99,
      category: "Accessoires",
      description: "Défilement rapide et ergonomie.",
    },
  ];

  return {
    title: "Accueil EJS",
    joke,
    products,
  };
}

