# Technical Reference Documentation - @nxpress/core

This document details all features, configuration options, template objects, helpers, and conventions of the `@nxpress/core` package. It serves as an exhaustive reference for generating final documentation.

---

## 1. Overview and CLI

`@nxpress/core` is an Express.js-based framework for Node.js providing file-based routing, template components, cascading middlewares, automatic response handling, and built-in template helpers.

### Project Scaffolding (`create-nxpress-app`)

Quickly scaffold a new Nxpress project interactively or with flags:

```bash
# Interactive setup
npx create-nxpress-app my-app
# or
pnpm create nxpress-app my-app

# Automatic setup with defaults (-y / --yes)
pnpm create nxpress-app my-app -y

# Scaffold API-only project without template views (--api)
pnpm create nxpress-app my-api -y --api
```

#### CLI Options

| Flag | Description | Default |
| :--- | :--- | :--- |
| `-y, --yes` | Skip prompts and use default configuration | `false` |
| `--api` | Create an API-only project (no views/components, preconfigures `users` & `health` APIs) | `false` |
| `-e, --engine <engine>` | Template engine (`ejs`, `handlebars`, `nunjucks`, `liquid`, `html`) | `"ejs"` |
| `-p, --port <number>` | Server port number | `3000` |
| `--tailwind` | Include Tailwind CSS support | `true` |
| `-m, --minimal` | Create a minimal project without views or components | `false` |
| `--app-dir <dir>` | Custom routes directory name | `"app"` |
| `--components-dir <dir>` | Custom components directory name | `"components"` |
| `--public-dir <dir>` | Custom public assets directory name | `"public"` |
| `--pkg-manager <pm>` | Package manager (`pnpm`, `npm`, `yarn`, `bun`, `deno`) | `"pnpm"` |

### Starting the Server

You can start your Nxpress application in two ways:

1. **Via Nxpress CLI (`nxpress dev` / `nxp dev` / `nxpress export`)**:
   - `nxpress dev`: Starts the development server with Hot Reload, live route re-scanning, and Tailwind compilation.
   - `nxpress start`: Starts the production server.
   - `nxpress export`: Generates a static HTML export (SSG) of all routes and assets to `out/`.

2. **Via custom `server.ts` file (`npx tsx --watch server.ts` / `pnpm serve`)**:
   - Executes `server.ts` directly using `tsx`, instantiating the app via `nxpress(options)` / `serve(options)`.

---

## 2. Server Options and Configuration

Server options can be configured via `nxpress.config.json` (or `.js`, `.ts`, `.mjs`, `.cjs`) in the project root, or passed directly to `nxpress(options)` / `serve(options)`.

### Configuration Schema Options

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `rootDir` | `string` | `process.cwd()` | Absolute path to the project root directory. |
| `appDir` | `string` | `app` (or `pages`) | Directory containing view templates and route files. |
| `componentsDir` | `string` | `components` | Directory containing reusable template components. |
| `publicDir` | `string` | `public` | Directory for serving static assets via Express static middleware. |
| `engine` | `string` | `"ejs"` | Template engine choice (`"ejs"`, `"hbs"`, `"html"`, `"nunjucks"`, `"liquid"`). |
| `port` | `number` | `3000` | HTTP server port number (can also be set via `process.env.PORT`). |
| `tailwind` | `boolean \| object` | `true` | Automatic Tailwind CSS compilation (`true`, `false`, or custom input/output path object). |
| `globals` | `object` | `{}` | Application-wide default global variables automatically injected into all template views. |
| `secureEnv` | `boolean` | `true` | Security flag filtering environment variables exposed to templates via `E` / `env`. |
| `isDev` | `boolean` | Auto-detected | Development mode flag enabling Hot Reload and live route re-scanning. |
| `i18n` | `object` | `undefined` | Internationalization options (`locales`, `defaultLocale`, `prefixDefault`, `localesDir`). |

### Configuration Example (`nxpress.config.json`)

```json
{
  "$schema": "https://unpkg.com/@nxpress/core@latest/schema.json",
  "port": 3000,
  "engine": "ejs",
  "appDir": "app",
  "componentsDir": "components",
  "publicDir": "public",
  "secureEnv": true,
  "i18n": {
    "locales": ["fr", "en", "es"],
    "defaultLocale": "fr",
    "prefixDefault": false
  },
  "globals": {
    "siteName": "My Store",
    "author": "Nxpress Team",
    "currency": "$"
  }
}
```

---

## 3. File-Based Routing Architecture (`app/`)

The directory structure inside `app/` defines the application routes.

### Supported File Types

- View templates: `.ejs`, `.njk`, `.nunjucks`, `.hbs`, `.liquid`, `.html`
- Page companion files: `.ts` or `.js` files sharing the same base name as the view (e.g. `index.ts` for `index.ejs`)
- API route files: Any `.ts` or `.js` file located under `app/api/`
- Folder middleware files: `middleware.ts` or `middleware.js`

### Dynamic Route Syntax and Slugs

- Single Parameter (`app/products/[id].ejs`): Matches `/products/:id`. Accessible in companion via `req.params.id` and in views via `R.params.id`.
- Catch-All Wildcard Slug (`app/docs/[...slug].ejs`): Matches `/docs/*`. Accessible in companion via `req.params.slug` or `req.params[0]` and in views via `R.params.slug` or `R.params[0]`.
- Index Route (`app/index.ejs`): Matches `/`.
- Route Groups (`app/(auth)/login.ejs`): Parenthesized folders organize routes and nested layouts without affecting URL pathnames (e.g. `app/(auth)/login.ejs` -> `/login`, `app/(dashboard)/settings.ejs` -> `/settings`).

### Reserved Filenames

- `layout.ejs` (or view engine extension): Nested layout template.
- `middleware.ts` / `middleware.js`: Directory-level middleware (never routed as a page).
- `404.ejs`, `500.ejs`, `not-found.ejs`, `error.ejs`: Custom error pages.

---

## 4. Page Companion Files (`app/**/*.ts`)

Every view template page can be paired with a TypeScript/JavaScript companion file to fetch data and define metadata before rendering.

### Props Export

Companion files can return page data via a default function, named `props` function, or direct export (objects, arrays, primitives):

```ts
import type { Request, Response } from '@nxpress/core';

// 1. Default or named function (async or sync)
export default async function props(req: Request, res: Response) {
  return {
    title: 'Store',
    products: [{ id: 1, name: 'Laptop', price: 999 }]
  };
}
```

#### Supported Export Formats
- **Async/Sync Function (`default` or `export function props`)**: Returns an object, array, or primitive.
- **Direct Object Export (`export default { ... }` or `export const props = { ... }`)**: Static data objects.
- **Direct Array / Primitive Export (`export default [1, 2, 3]` or `export default "Hello"`)**: Direct static lists or values.

#### Template Access
- **Plain Objects**: Properties are destructured directly into template locals (`<%= title %>`, `<%= products %>`) and also accessible through `props` (`<%= props.title %>`).
- **Arrays / Primitives**: Accessible directly through `props` (`<%= props %>`, `<% props.forEach(...) %>`).
- **No companion / No export**: `props` is always defined and defaults to `null`.

### Metadata and SEO Export (`metadata`)

Companion files can export page-level metadata (as an object or an async function):

```ts
import type { NxpressMetadata, Request, Response } from '@nxpress/core';

export const metadata: NxpressMetadata = {
  title: 'Store Products - Nxpress',
  description: 'Explore our wide selection of electronics.',
  keywords: ['shop', 'store', 'electronics'],
  openGraph: {
    title: 'Store Products',
    description: 'Explore our wide selection of electronics.',
    image: '/og-image.png'
  },
  twitter: {
    card: 'summary_large_image',
    creator: '@nxpress'
  }
};
```

Dynamic metadata function receives `req` and `res`:

```ts
export async function metadata(req: Request, res: Response): Promise<NxpressMetadata> {
  return {
    title: `Product #${req.params.id}`,
    description: `Dynamic product details page.`
  };
}
```

To use global configurations or constants in `metadata`, import them directly:

```ts
import config from '@/nxpress.config.json';

export async function metadata(req: Request, res: Response): Promise<NxpressMetadata> {
  const siteTitle = config.globals?.title || 'My Store';
  return {
    title: `${siteTitle} - Product #${req.params.id}`,
    description: `Dynamic details for product #${req.params.id}.`
  };
}
```

---

## 5. Injected Template Variables and Objects

Nxpress automatically injects standard helper objects and variables into every view template rendering context.

### 1. `R` / `req` (Request Object)

A sanitized representation of the current HTTP request:

- `R.url`: Full requested URL path (e.g. `/products/123?sort=asc`)
- `R.path`: Pathname without query string (e.g. `/products/123`)
- `R.full`: Full URL string with protocol and host (e.g. `http://localhost:3000/products/123`)
- `R.base`: Base URL with protocol and host (e.g. `http://localhost:3000`)
- `R.method`: HTTP method in uppercase (`GET`, `POST`, etc.)
- `R.query`: Query parameters object (e.g. `{ sort: 'asc' }`)
- `R.params`: Dynamic route path parameters object (e.g. `{ id: '123' }` or `{ '0': 'guide/setup' }`)
- `R.headers`: HTTP request headers object
- `R.cookies`: Request cookies object
- `R.ip`: Client IP address
- `R.protocol`: Protocol (`http` or `https`)
- `R.host`: Host header value

### 2. `E` / `env` (Environment Variables)

Exposes environment variables to templates.

- **When `secureEnv: true` (default)**: Filters `process.env` to only include `NODE_ENV` and variables starting with `PUBLIC_`.
- **When `secureEnv: false`**: Exposes all variables in `process.env`.

```html
<!-- Accessing environment variables in template -->
<p>Environment: <%= E.NODE_ENV %></p>
<p>Public API Key: <%= E.PUBLIC_API_KEY %></p>
```

### 3. `G` / `global` (Global Context)

Merged object containing custom `globals` from configuration, all built-in helpers, and the component renderer `$`.

### 4. `$` (Component Renderer)

Function used inside templates to include reusable components from `componentsDir`:

```html
<%- $("Navbar", { activePage: "home" }) %>
```

#### 5. Date and Time Variables

- `year`: Current 4-digit year (`2026`).
- `now`: Current JavaScript `Date` object instance.

---

## 6. Built-in Template Helpers

Nxpress registers built-in helper functions accessible in all supported template engines (`ejs`, `hbs`, `nunjucks`, `liquid`).

### Formatting and String Helpers

- `str(val)`: Converts value or object to string (`JSON.stringify` for objects).
- `json(val)`: Parses a JSON string into an object.
- `lower(val)`: Converts string to lowercase.
- `upper(val)`: Converts string to uppercase.
- `capitalize(val)`: Capitalizes the first letter of string.
- `truncate(val, len)`: Truncates string to specified length (default `50`) with `...`.
- `join(arr, sep)`: Joins array elements into a string using separator (default `", "`).

### Zero-Config Head Injections (SEO Metadata & Tailwind CSS)

Nxpress automatically compiles Tailwind CSS and renders companion file metadata (`title`, `description`, OpenGraph, Twitter), and **injects them directly before `</head>`** into your layout files.

No template variables or manual tags (`<%- tailwind %>` or `<%- metadata %>`) are needed in your templates:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <!-- Tailwind stylesheet and SEO meta tags are injected here automatically before </head> -->
</head>
<body>
  <%- body %>
</body>
</html>
```

### Comparisons and Logic Helpers

- `eq(a, b)`: Returns `true` if `a === b`.
- `ne(a, b)`: Returns `true` if `a !== b`.
- `gt(a, b)`: Returns `true` if `a > b`.
- `gte(a, b)`: Returns `true` if `a >= b`.
- `lt(a, b)`: Returns `true` if `a < b`.
- `lte(a, b)`: Returns `true` if `a <= b`.
- `and(...args)`: Returns `true` if all arguments are truthy.
- `or(...args)`: Returns `true` if any argument is truthy.
- `not(val)`: Returns logical NOT (`!val`).
- `ternary(cond, trueVal, falseVal)`: Returns `trueVal` if `cond` is truthy, otherwise `falseVal`.

### Lucide Icon Helpers (`icon` / `I`)

- `icon(name, [className], [extraAttrs])` / `I(name, [className], [extraAttrs])`: Renders a zero-dependency server-side Lucide SVG icon by name. Supports kebab-case (`"shopping-cart"`), camelCase (`"shoppingCart"`), or PascalCase (`"ShoppingCart"`).

```html
<!-- Rendering icons with Tailwind CSS classes in EJS -->
<%- icon('user', 'w-5 h-5 text-sky-500') %>
<%- I('moon', 'w-5 h-5 dark:hidden') %>
<%- I('sun', 'w-5 h-5 hidden dark:block') %>
```

### SEO and Metadata (`metadata`)

Nxpress automatically renders companion file metadata into SEO and social HTML tags and **injects them automatically before `</head>`** (just like Tailwind CSS).

If you want explicit control over placement in your layout or head template, you can still use `<%- metadata %>`:

```html
<!-- Explicit placement in head (optional, automatic injection is enabled by default) -->
<head>
  <%- metadata %>
  <%- tailwind %>
</head>
```

- `metadata`: Injected string containing rendered `<title>`, `<meta name="description">`, `<link rel="canonical">`, OpenGraph (`og:*`), and Twitter (`twitter:*`) tags. Automatically injected into `<head>` if omitted.

### Collections and Utility Helpers

- `cn(...classes)`: Merges class names and resolves Tailwind CSS class conflicts using `clsx` and `tailwind-merge` (e.g. `<%= cn('px-2 py-1', isActive && 'bg-blue-500', 'px-4') %>` -> `'py-1 bg-blue-500 px-4'`).
- `tr(key, [params])`: Returns translated text dictionary string with variable interpolation.
- `len(val)`: Returns length of array, string, or object keys count.
- `contains(arr, val)` / `includes(arr, val)`: Checks if array or string contains value.
- `add(a, b)`: Adds two numbers.
- `sub(a, b)`: Subtracts `b` from `a`.

### Helper Examples in EJS

```html
<p>Total Items: <%= len(products) %></p>
<p>User Icon: <%- I('user', 'w-4 h-4 inline') %></p>
<p>Copyright <%= year %></p>
<p>Status: <%= ternary(eq(user.role, 'admin'), 'Admin User', 'Standard User') %></p>
```

---

## 7. Component System (`components/`)

Components stored in `componentsDir` (e.g. `components/Navbar.ejs`, `components/Footer.ejs`) can be rendered inside any view template or inside other components using `$`.

```html
<%- $("Navbar", { title: G.siteName }) %>
<main>
  <%- $("ProductCard", { product: p }) %>
</main>
<%- $("Footer") %>
```

---

## 8. API Routes (`app/api/**/*.ts`)

Any file under `app/api/` is registered as an API route handler.

### HTTP Method Handlers (Case-Insensitive)

Each HTTP method is defined by an exported named function. Exported method names are **case-insensitive** (`GET`, `get`, `POST`, `post`, `PUT`, `put`, `DELETE`, `delete`, `PATCH`, `patch`, `HEAD`, `head`, `OPTIONS`, `options`).

```ts
// app/api/users/index.ts
import type { Request, Response } from '@nxpress/core';

export const mockUsers = [
  { id: 1, name: 'Alice', email: 'alice@example.com' },
  { id: 2, name: 'Bob', email: 'bob@example.com' }
];

// GET /api/users -> Returns 200 OK + JSON
export async function GET(req: Request, res: Response) {
  const search = req.query.search as string;
  if (search) {
    return mockUsers.filter(u => u.name.toLowerCase().includes(search.toLowerCase()));
  }
  return mockUsers;
}

// POST /api/users -> Creates record with 201 Created
export async function POST(req: Request, res: Response) {
  const { name, email } = req.body;
  if (!name || !email) {
    res.status(400);
    return { error: 'Name and email are required' };
  }

  const newUser = { id: Date.now(), name, email };
  mockUsers.push(newUser);
  res.status(201);
  return newUser;
}
```

```ts
// app/api/users/[id].ts
import type { Request, Response } from '@nxpress/core';
import { mockUsers } from '.';

// GET /api/users/:id
export async function GET(req: Request, res: Response) {
  const userId = Number(req.params.id);
  const user = mockUsers.find(u => u.id === userId);

  if (!user) {
    res.status(404);
    return { error: 'User not found' };
  }
  return user;
}

// PUT /api/users/:id
export async function PUT(req: Request, res: Response) {
  const userId = Number(req.params.id);
  const { name, email } = req.body;
  const user = mockUsers.find(u => u.id === userId);

  if (!user) {
    res.status(404);
    return { error: 'User not found' };
  }
  user.name = name ?? user.name;
  user.email = email ?? user.email;
  return { ...user, updatedAt: new Date().toISOString() };
}

// DELETE /api/users/:id
export async function DELETE(req: Request, res: Response) {
  const userId = Number(req.params.id);
  const index = mockUsers.findIndex(u => u.id === userId);

  if (index !== -1) {
    mockUsers.splice(index, 1);
  }
  return res.status(204).send();
}
```

### Default Fallback Handler

If no matching named HTTP method function is exported, `export default function(req, res)` catches all HTTP requests for that route.

### Automatic Response (Auto-Return)

If an API handler function returns a value:

- An Object or Array is automatically sent via `res.json(...)`.
- A String or Buffer is automatically sent via `res.send(...)`.
- If `res.status(...)` was called prior to returning, the configured status code is preserved.
- If the handler does not call `res.send`/`res.json` and returns nothing, `next()` is automatically called.

---

## 9. Folder-Level Middlewares (`middleware.ts` / `middleware.js`)

The filename `middleware.ts` (or `.js`) is reserved and is never routed as a page or matched as a view companion.

### Directory Cascading

A `middleware.ts` file applies to the directory it resides in and all its subdirectories and child routes.

- `app/middleware.ts` -> Applies to all application routes (global).
- `app/admin/middleware.ts` -> Applies strictly to `/admin/*`.

### Auto-Collection of Exports

Inside `middleware.ts`, all exported functions (named exports, default export, or exported arrays of functions) are automatically collected and executed in declaration order.

```ts
import type { Request, Response } from '@nxpress/core';

// Route exclusions
export const ignore = ['/api/health', '/public/*'];

export function logger(req: Request, res: Response) {
  console.log(`[LOG] ${req.method} ${req.path}`);
}

export function setSecurityHeader(req: Request, res: Response) {
  res.setHeader('X-Frame-Options', 'DENY');
}
```

### Route Exclusions (`ignore`)

The `ignore` export accepts an array of route paths or wildcard patterns (`*`). Matching routes skip execution of the directory middleware.

---

## 10. Route-Level Middlewares (Companion & API Files)

To attach middlewares to a specific route, two strict exports are available in companion (`app/**/*.ts`) and API (`app/api/**/*.ts`) files.

### 1. `middleware` Export (Singular)

Must be a single function. If `middleware` is an Array, Nxpress throws an error.

```ts
import type { Handler } from '@nxpress/core';

export const middleware: Handler = (req, res) => {
  res.setHeader('X-Route-Scope', 'single');
};
```

### 2. `middlewares` Export (Plural)

Must be an Array of functions. If `middlewares` is a single function, Nxpress throws an error.

```ts
import type { Handler } from '@nxpress/core';

export const middlewares: Handler[] = [
  (req, res) => {
    console.log('Middleware 1');
  },
  (req, res) => {
    console.log('Middleware 2');
  }
];
```

### Route Middleware Merging

If both `middleware` AND `middlewares` are exported in the same file, they are merged and executed in order: `middleware` first, followed by elements in `middlewares`.

---

## 11. Middleware Execution Model

### Optional `next()` Calling

Middlewares are not required to call `next()`. If a function completes execution without calling `next()` and without sending a response, Nxpress automatically advances to the next step.

### Express Package Compatibility

Traditional Express middlewares expecting 3 parameters `(req, res, next)` and calling `next()` manually (e.g. `cors()`, `helmet()`) remain 100% compatible without double execution.

### Hot Reloading & Swappable Router

In development mode (`nxpress dev`), routes and middlewares use a swappable Express router. Any changes to `middleware.ts`, route files, or `nxpress.config.json` immediately re-register routes and reload configuration options without restarting the Node.js server.

### Error Formatting

All middleware and route configuration errors display file paths relative to the project root (e.g. `app/index.ts`).

---

## 12. Package Exports and Types

The `@nxpress/core` module re-exports core utilities and types:

```ts
import {
  nxpress,
  serve,
  NxpressServerOptions,
  TemplateEngine,
  HttpMethod,
  NxpressMetadata,
  logger,
  Request,
  Response,
  Express,
  NextFunction,
  RequestHandler,
  Handler,
} from '@nxpress/core';
```

- `NxpressMetadata`: Type definition for page SEO and social metadata objects.
- `TemplateEngine`: Type alias for supported view engine identifiers (`"hbs" | "handlebars" | "ejs" | "html" | "njk" | "nunjucks" | "liquid"`).
- `HttpMethod`: Supported HTTP request methods (`"get" | "post" | "put" | "patch" | "delete" | "options" | "head" | "all"`).
- `Handler` / `RequestHandler`: Standard Express handler and middleware type re-exported from Express.
- `Request`, `Response`, `Express`, `NextFunction`: Re-exported Express types.

---

## 13. Framework Injections & Client API (`window.__nxpress__`)

Nxpress includes an automated injection engine for live reloading, error pages, and client-side utilities.

### Global Client Namespace (`window.__nxpress__`)

All framework-injected client utilities share a single reserved global object: `window.__nxpress__`.

### Theme Management API (`window.__nxpress__.theme`)

Nxpress automatically injects a flicker-free Tailwind CSS dark mode script (`dark` class toggle on `document.documentElement`).

The client-side API is accessible anywhere in the browser DOM:

| Method | Return Type | Description |
| :--- | :--- | :--- |
| `window.__nxpress__.theme.get()` | `'dark' \| 'light'` | Returns the currently active theme (checks `localStorage` and system preference). |
| `window.__nxpress__.theme.set(mode)` | `void` | Sets theme to `'dark'`, `'light'`, or `'system'`. Persists preference in `localStorage`. |
| `window.__nxpress__.theme.toggle()` | `'dark' \| 'light'` | Toggles between `'dark'` and `'light'` mode and returns the new theme. |

#### Usage Example in View Templates

```html
<!-- Toggle button in EJS/Handlebars/HTML -->
<button onclick="__nxpress__.theme.toggle()">
  🌓 Toggle Dark Mode
</button>
```

---

## 14. Static Site Generation (SSG)

Nxpress allows you to pre-render your entire application into static HTML files and copy assets for zero-Node.js hosting (e.g. GitHub Pages, Netlify, Vercel Static, S3).

### CLI Command (`nxpress export`)

```bash
nxpress export
# or with custom options
nxpress export --out-dir dist/static --engine ejs
```

| Flag | Description | Default |
| :--- | :--- | :--- |
| `-o, --out-dir <dir>` | Destination output directory | `out` |
| `-e, --engine <engine>` | Template engine to use | From config or `ejs` |
| `-a, --app-dir <dir>` | Custom app/pages directory | From config |
| `-c, --components-dir <dir>` | Custom components directory | From config |
| `--public-dir <dir>` | Custom public static directory | `public` |
| `--no-tailwind` | Disable automatic Tailwind CSS build | `false` |

### Dynamic Routes with `generateStaticParams`

For dynamic routes (e.g. `app/products/[id].ejs`), export `generateStaticParams()` in the companion file (`app/products/[id].ts`):

```ts
import type { Request, Response } from '@nxpress/core';

// 1. Generate static route parameters at build time
export async function generateStaticParams() {
  const products = await fetchProducts();
  return products.map((p) => ({ id: String(p.id) }));
}

// 2. Fetch page props for each param instance
export default async function props(req: Request, res: Response) {
  const product = await getProductById(req.params.id);
  return { product };
}
```

Nxpress will generate:
- `out/products/1/index.html`
- `out/products/2/index.html`
- etc.

> **Note**: Dynamic routes without `generateStaticParams()` are skipped during export.

### Catch-All Routes (`[...slug]`)

```ts
export async function generateStaticParams() {
  return [
    { slug: 'getting-started' },
    { slug: 'installation/manual' }
  ];
}
```

Generates:
- `out/docs/getting-started/index.html`
- `out/docs/installation/manual/index.html`

---

## 15. Internationalization (i18n)

Nxpress includes built-in multi-language routing, automatic locale detection (URL prefix, cookies, `Accept-Language`), and translation helpers.

### 1. Translation Files (`locales/`)

Store translation dictionaries as JSON or TS/JS files in the `locales/` folder:

```json
// locales/fr.json
{
  "welcome": "Bienvenue {{name}} !",
  "nav": {
    "home": "Accueil",
    "about": "À propos"
  }
}
```

```json
// locales/en.json
{
  "welcome": "Welcome {{name}}!",
  "nav": {
    "home": "Home",
    "about": "About"
  }
}
```

### 2. Translation Helper (`tr`)

- `tr(key, [params])`: Returns translated text with variable replacements (falls back to `defaultLocale` then raw key).

```html
<!-- In EJS / Handlebars / Nunjucks / Liquid -->
<nav>
  <a href="/products"><%= tr('products_title') %></a>
  <a href="?lang=en">English</a>
  <a href="?lang=fr">Français</a>
</nav>

<h1><%= tr('welcome', { name: 'Alex' }) %></h1>
```

### 3. Template & Request Injections (`lang`, `R.locale`)

- `lang`: Direct current language code in templates (e.g. `<html lang="<%= lang %>">`).
- `R.locale`: Currently active locale string (e.g. `'en'`).
- `R.locales`: Array of all available locales (e.g. `['en', 'fr']`).
- `R.defaultLocale`: Configured default locale.

### 4. Language Resolution Priority

In SSR (Express), the language is determined in the following strict order:

1. **URL Path Prefix** (`/fr/...`) -> Highest priority.
2. **Query Parameter** (`?lang=fr` or `?locale=fr`) -> Automatically sets `Set-Cookie: lang=fr`.
3. **Cookie** (`lang=fr`, `locale=fr`) -> Persisted user preference.
4. **Accept-Language Header** (`Accept-Language: fr-FR`) -> Browser default.
5. **Configured `defaultLocale`** -> Fallback.

### 5. Static Site Generation (SSG) with i18n

When running `nxpress export`, Nxpress compiles every page for each configured locale:

- **Default locale** (`en`):
  - `out/index.html`
  - `out/products/index.html`
- **Additional locales** (`fr`, `es`, ...):
  - `out/fr/index.html`
  - `out/fr/products/index.html`

Each static HTML file is pre-rendered with the corresponding translated strings (`tr()`), so multi-language websites work out of the box on static hosts (Vercel, Netlify, GitHub Pages, S3/CloudFront) without requiring a Node.js server.

---

## 17. Practical Recipes & Use Cases

### 1. E-Commerce Product Catalog (Dynamic Routes, Props, SEO & Components)

**Project Structure:**
```bash
app/
├── layout.ejs              # Global root layout with <head> and navbar
├── index.ejs               # Store home page
├── index.ts                # Featured products loader
└── products/
    ├── [id].ejs            # Product details view
    └── [id].ts             # Product companion loader & metadata
components/
├── Navbar.ejs              # Reusable navigation bar
└── ProductCard.ejs         # Reusable product card component
nxpress.config.json         # Engine and global configuration
```

**Companion File (`app/products/[id].ts`):**
```ts
import type { Request, Response, NxpressMetadata } from '@nxpress/core';
import config from '@/nxpress.config.json';

// Dynamic SEO Metadata
export async function metadata(req: Request, res: Response): Promise<NxpressMetadata> {
  const siteName = config.globals?.title || 'Nxpress Store';
  return {
    title: `${siteName} - Product #${req.params.id}`,
    description: `Buy product #${req.params.id} at the best price.`,
    openGraph: {
      title: `Product #${req.params.id}`,
      image: `/images/product-${req.params.id}.jpg`
    }
  };
}

// Page Data Loader
export default async function props(req: Request, res: Response) {
  const { id } = req.params;
  const product = {
    id,
    name: `Premium Wireless Headset ${id}`,
    price: 199.99,
    features: ['Active Noise Cancelling', '40h Battery', 'Bluetooth 5.3']
  };

  const related = [
    { id: '101', name: 'Protective Case', price: 29.99 },
    { id: '102', name: 'Audio Cable', price: 14.99 }
  ];

  return { product, related };
}
```

**View Template (`app/products/[id].ejs`):**
```html
<div class="container">
  <h1><%= product.name %></h1>
  <p class="price">$<%= product.price.toFixed(2) %></p>

  <h3>Key Features:</h3>
  <ul>
    <% product.features.forEach(function(feat) { %>
      <li><%= feat %></li>
    <% }); %>
  </ul>

  <h2>Related Accessories</h2>
  <div class="related-grid">
    <% related.forEach(function(item) { %>
      <ProductCard id="<%= item.id %>" name="<%= item.name %>" price="<%= item.price %>" />
    <% }); %>
  </div>
</div>
```

---

### 2. Multi-Language Blog with Static Export (SSG)

**Project Structure:**
```bash
app/
├── layout.ejs
└── blog/
    ├── [slug].ejs          # Blog post template with tr() helpers
    └── [slug].ts           # generateStaticParams, props & metadata
locales/
├── en.json                 # English dictionary
└── fr.json                 # French dictionary
nxpress.config.json
```

**Static Generation & Loader (`app/blog/[slug].ts`):**
```ts
import type { Request, Response, NxpressMetadata } from '@nxpress/core';

// List of slugs for static generation (nxpress export)
export async function generateStaticParams() {
  return [
    { slug: 'announcing-nxpress-v1' },
    { slug: 'file-based-routing-in-depth' }
  ];
}

// SEO Metadata
export async function metadata(req: Request, res: Response): Promise<NxpressMetadata> {
  return {
    title: `Blog - ${req.params.slug}`,
    description: `Read the full article on our blog.`
  };
}

// Post Content
export default async function props(req: Request, res: Response) {
  const { slug } = req.params;
  return {
    slug,
    title: slug.replace(/-/g, ' ').toUpperCase(),
    readMinutes: 5,
    authorName: 'Alex Rivers',
    content: 'Nxpress provides an intuitive developer experience...'
  };
}
```

---

### 3. Protected Admin Dashboard (Route Groups & Middleware Cascades)

**Project Structure:**
```bash
app/
├── (auth)/                 # URL: /login (parentheses omitted from URL)
│   ├── login.ejs
│   └── login.ts
└── (dashboard)/            # URL: /overview, /analytics
    ├── middleware.ts       # Runs on every route inside (dashboard)/
    ├── layout.ejs          # Dashboard shell with sidebar
    ├── overview.ejs
    └── overview.ts
```

**Directory Middleware Guard (`app/(dashboard)/middleware.ts`):**
```ts
import type { Request, Response, NextFunction } from '@nxpress/core';

export default function authGuard(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.session_token || req.headers['authorization'];

  if (!token) {
    return res.redirect('/login');
  }

  res.locals.user = { id: 1, name: 'Admin', role: 'admin' };
  next();
}
```

---

### 4. Full REST API with Auto-Responses

**Project Structure:**
```bash
app/
└── api/
    ├── middleware.ts       # Global API middleware
    └── users/
        ├── index.ts        # GET /api/users, POST /api/users
        └── [id].ts         # GET /api/users/:id, PUT /api/users/:id, DELETE /api/users/:id
```

**Handlers (`app/api/users/index.ts`):**
```ts
import type { Request, Response } from '@nxpress/core';

const users = [{ id: 1, name: 'Alice' }];

// Automatic 200 OK JSON response
export async function GET(req: Request, res: Response) {
  return users;
}

// Explicit status response
export async function POST(req: Request, res: Response) {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });
  const newUser = { id: Date.now(), name };
  users.push(newUser);
  return res.status(201).json(newUser);
}
```







