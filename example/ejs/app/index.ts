import type { Request, Response, NextFunction, Handler, NxpressMetadata } from "../../../dist";

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

export function metadata(
  req: Request,
  res: Response,
  globals: Record<string, any>,
): NxpressMetadata {
  return {
    title: `Nxpress - ${globals.siteName}`,
    description:
      "Modern web framework with file-based routing, SSR and static site generation.",
    openGraph: {
      title: "Nxpress Framework",
      description: "Build fast with file-based routing and SSR.",
    },
  };
}

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



