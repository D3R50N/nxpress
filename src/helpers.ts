import hbs from 'hbs';
import * as lucideIcons from 'lucide';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merges Tailwind CSS class names efficiently resolving conflicts (clsx + tailwind-merge).
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

function toPascalCase(str: string): string {
  return String(str ?? '')
    .replace(/(?:^\w|[A-Z]|\b\w)/g, (word) => word.toUpperCase())
    .replace(/[-_\s]+/g, '');
}

/**
 * Renders a Lucide SVG icon string by icon name and optional CSS classes or extra attributes.
 */
function renderLucideIcon(
  name: string,
  className: string = '',
  extraAttrs: Record<string, string> = {}
): string {
  if (!name) return '';

  const pascalName = toPascalCase(name);
  const iconData = (lucideIcons as any)[pascalName] || (lucideIcons as any)[name];

  if (!iconData || !Array.isArray(iconData)) {
    return '';
  }

  const defaultAttrs: Record<string, string> = {
    xmlns: 'http://www.w3.org/2000/svg',
    width: '24',
    height: '24',
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    'stroke-width': '2',
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
  };

  if (className) {
    defaultAttrs['class'] = className;
  }

  const mergedAttrs = { ...defaultAttrs, ...extraAttrs };
  const attrString = Object.entries(mergedAttrs)
    .map(([key, val]) => `${key}="${String(val).replace(/"/g, '&quot;')}"`)
    .join(' ');

  const childrenHtml = iconData
    .map(([tag, attrs]: [string, Record<string, any>]) => {
      const childAttrs = Object.entries(attrs || {})
        .map(([k, v]) => `${k}="${String(v).replace(/"/g, '&quot;')}"`)
        .join(' ');
      return `<${tag} ${childAttrs}></${tag}>`;
    })
    .join('');

  return `<svg ${attrString}>${childrenHtml}</svg>`;
}

export interface NxpressMetadata {
  title?: string;
  description?: string;
  keywords?: string | string[];
  canonical?: string;
  robots?: string;
  openGraph?: {
    title?: string;
    description?: string;
    url?: string;
    type?: string;
    image?: string;
    siteName?: string;
  };
  twitter?: {
    card?: string;
    title?: string;
    description?: string;
    image?: string;
    creator?: string;
  };
  [key: string]: any;
}

/**
 * Renders HTML meta tags for SEO from a metadata object.
 */
export function renderMetaTags(metaObj?: NxpressMetadata | string): string {
  if (typeof metaObj === 'string') return metaObj;
  if (!metaObj || typeof metaObj !== 'object') return '';

  const tags: string[] = [];

  if (metaObj.title) {
    tags.push(`<title>${String(metaObj.title).replace(/</g, '&lt;').replace(/>/g, '&gt;')}</title>`);
  }

  if (metaObj.description) {
    tags.push(`<meta name="description" content="${String(metaObj.description).replace(/"/g, '&quot;')}">`);
  }

  if (metaObj.keywords) {
    const kw = Array.isArray(metaObj.keywords) ? metaObj.keywords.join(', ') : metaObj.keywords;
    tags.push(`<meta name="keywords" content="${String(kw).replace(/"/g, '&quot;')}">`);
  }

  if (metaObj.canonical) {
    tags.push(`<link rel="canonical" href="${String(metaObj.canonical).replace(/"/g, '&quot;')}">`);
  }

  if (metaObj.robots) {
    tags.push(`<meta name="robots" content="${String(metaObj.robots).replace(/"/g, '&quot;')}">`);
  }

  if (metaObj.openGraph && typeof metaObj.openGraph === 'object') {
    const og = metaObj.openGraph;
    if (og.title || metaObj.title) tags.push(`<meta property="og:title" content="${String(og.title || metaObj.title).replace(/"/g, '&quot;')}">`);
    if (og.description || metaObj.description) tags.push(`<meta property="og:description" content="${String(og.description || metaObj.description).replace(/"/g, '&quot;')}">`);
    if (og.url) tags.push(`<meta property="og:url" content="${String(og.url).replace(/"/g, '&quot;')}">`);
    if (og.type) tags.push(`<meta property="og:type" content="${String(og.type || 'website').replace(/"/g, '&quot;')}">`);
    if (og.image) tags.push(`<meta property="og:image" content="${String(og.image).replace(/"/g, '&quot;')}">`);
    if (og.siteName) tags.push(`<meta property="og:site_name" content="${String(og.siteName).replace(/"/g, '&quot;')}">`);
  }

  if (metaObj.twitter && typeof metaObj.twitter === 'object') {
    const tw = metaObj.twitter;
    if (tw.card) tags.push(`<meta name="twitter:card" content="${String(tw.card || 'summary_large_image').replace(/"/g, '&quot;')}">`);
    if (tw.title || metaObj.title) tags.push(`<meta name="twitter:title" content="${String(tw.title || metaObj.title).replace(/"/g, '&quot;')}">`);
    if (tw.description || metaObj.description) tags.push(`<meta name="twitter:description" content="${String(tw.description || metaObj.description).replace(/"/g, '&quot;')}">`);
    if (tw.image) tags.push(`<meta name="twitter:image" content="${String(tw.image).replace(/"/g, '&quot;')}">`);
    if (tw.creator) tags.push(`<meta name="twitter:creator" content="${String(tw.creator).replace(/"/g, '&quot;')}">`);
  }

  return tags.join('\n');
}

/**
 * Automatically injects rendered metadata HTML before </head> if missing.
 */
export function injectMetadata(html: string, metadataHtml?: string): string {
  if (!metadataHtml || !metadataHtml.trim()) return html;
  if (html.includes(metadataHtml.trim())) {
    return html;
  }

  if (html.includes("</head>")) {
    return html.replace("</head>", `  ${metadataHtml}\n</head>`);
  }

  if (html.includes("<head>")) {
    return html.replace("<head>", `<head>\n  ${metadataHtml}\n`);
  }

  return `${metadataHtml}\n${html}`;
}

export const builtinHelpers = {
  /**
   * Merges class names and resolves Tailwind CSS class conflicts.
   */
  cn(...inputs: any[]): string {
    return cn(...inputs);
  },

  /**
   * Translation helper fallback.
   */
  tr(key: string, params: Record<string, any> = {}): string {
    return key;
  },

  /**
   * Renders a Lucide SVG icon by name (e.g. icon('user', 'w-5 h-5')).
   */
  icon(name: string, className: string = '', extraAttrs: Record<string, string> = {}): string {
    return renderLucideIcon(name, className, extraAttrs);
  },

  /**
   * Alias for icon helper (e.g. I('user', 'w-5 h-5')).
   */
  I(name: string, className: string = '', extraAttrs: Record<string, string> = {}): string {
    return renderLucideIcon(name, className, extraAttrs);
  },

  /**
   * Converts a value or object to string (JSON.stringify for objects).
   */
  str(val: any): string {
    if (val === null || val === undefined) return '';
    if (typeof val === 'object') return JSON.stringify(val);
    return String(val);
  },

  /**
   * Parses a JSON string into an object.
   */
  json(val: any): any {
    if (typeof val === 'string') {
      try {
        return JSON.parse(val);
      } catch (err) {
        return null;
      }
    }
    return val;
  },

  /**
   * Converts value to lowercase string.
   */
  lower(val: any): string {
    return String(val ?? '').toLowerCase();
  },

  /**
   * Converts value to uppercase string.
   */
  upper(val: any): string {
    return String(val ?? '').toUpperCase();
  },

  /**
   * Capitalizes first character of string.
   */
  capitalize(val: any): string {
    const s = String(val ?? '');
    return s.charAt(0).toUpperCase() + s.slice(1);
  },

  /**
   * Truncates string to specified length.
   */
  truncate(val: any, len: number = 50): string {
    const s = String(val ?? '');
    return s.length > len ? s.slice(0, len) + '...' : s;
  },

  /**
   * Equality check helper (a === b).
   */
  eq(a: any, b: any): boolean {
    return a === b;
  },

  /**
   * Inequality check helper (a !== b).
   */
  ne(a: any, b: any): boolean {
    return a !== b;
  },

  /**
   * Greater than check helper (a > b).
   */
  gt(a: any, b: any): boolean {
    return a > b;
  },

  /**
   * Greater than or equal check helper (a >= b).
   */
  gte(a: any, b: any): boolean {
    return a >= b;
  },

  /**
   * Less than check helper (a < b).
   */
  lt(a: any, b: any): boolean {
    return a < b;
  },

  /**
   * Less than or equal check helper (a <= b).
   */
  lte(a: any, b: any): boolean {
    return a <= b;
  },

  /**
   * Logical AND for all arguments.
   */
  and(...args: any[]): boolean {
    return args.every(Boolean);
  },

  /**
   * Logical OR for arguments.
   */
  or(...args: any[]): boolean {
    return args.some(Boolean);
  },

  /**
   * Logical NOT.
   */
  not(val: any): boolean {
    return !val;
  },

  /**
   * Returns length of array, string, or object keys.
   */
  len(val: any): number {
    if (!val) return 0;
    if (Array.isArray(val) || typeof val === 'string') return val.length;
    if (typeof val === 'object') return Object.keys(val).length;
    return 0;
  },

  /**
   * Checks if array or string contains target value.
   */
  contains(arr: any, val: any): boolean {
    if (!arr) return false;
    if (Array.isArray(arr) || typeof arr === 'string') return arr.includes(val);
    return false;
  },

  includes(arr: any, val: any): boolean {
    if (!arr) return false;
    if (Array.isArray(arr) || typeof arr === 'string') return arr.includes(val);
    return false;
  },

  /**
   * Joins array elements into string.
   */
  join(arr: any[], sep: string = ', '): string {
    return Array.isArray(arr) ? arr.join(sep) : String(arr ?? '');
  },

  /**
   * Addition helper.
   */
  add(a: number, b: number): number {
    return Number(a) + Number(b);
  },

  /**
   * Subtraction helper.
   */
  sub(a: number, b: number): number {
    return Number(a) - Number(b);
  },

  /**
   * Ternary condition helper (cond ? trueVal : falseVal).
   */
  ternary(cond: any, trueVal: any, falseVal: any): any {
    return cond ? trueVal : falseVal;
  },
};

export const icon = builtinHelpers.icon;
export const I = builtinHelpers.I;

/**
 * Registers all built-in helpers with Handlebars.
 */
export function registerBuiltinHelpers(): void {
  Object.entries(builtinHelpers).forEach(([name, fn]) => {
    hbs.registerHelper(name, function (...args: any[]) {
      const cleanArgs = args.slice(0, -1);
      return (fn as Function)(...cleanArgs);
    });
  });
}

/**
 * Registers all built-in helpers as filters on a LiquidJS instance.
 */
export function registerLiquidFilters(liquid: any): void {
  Object.entries(builtinHelpers).forEach(([name, fn]) => {
    liquid.registerFilter(name, (...args: any[]) => {
      return (fn as Function)(...args);
    });
  });
}

/**
 * Registers all built-in helpers as filters and globals on Nunjucks environment.
 */
export function registerNunjucksHelpers(env: any): void {
  Object.entries(builtinHelpers).forEach(([name, fn]) => {
    try {
      env.addFilter(name, (...args: any[]) => (fn as Function)(...args));
      env.addGlobal(name, fn);
    } catch (_err) {}
  });
}

/**
 * Converts EJS template syntax to Eta template syntax.
 */
export function ejsToEta(content: string): string {
  if (!content) return content;
  return content
    .replace(/<%#([\s\S]*?)%>/g, '<%/*$1*/%>')
    .replace(/<%-/g, '<%~')
    .replace(/<%_/g, '<%-')
    .replace(/_%>/g, '-%>');
}
