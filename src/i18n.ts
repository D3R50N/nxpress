import fs from "fs";
import path from "path";
import { Request, Response, NextFunction, RequestHandler } from "express";
import { logger } from "./logger";
import { getJitiLoader } from "./router";

export interface I18nConfig {
  locales: string[];
  defaultLocale: string;
  prefixDefault?: boolean;
  localesDir?: string;
  translations?: Record<string, Record<string, any>>;
}

const activeI18nReloaders = new Set<() => void>();

/**
 * Triggers a reload of translations across all registered i18n middleware instances.
 */
export function reloadAllTranslations(): void {
  for (const reloadFn of activeI18nReloaders) {
    try {
      reloadFn();
    } catch (err) {
      logger.warn("Failed reloading translations:", err);
    }
  }
}

/**
 * Loads translations dictionary for all configured locales.
 */
export function loadTranslations(
  rootDir: string,
  config: I18nConfig,
): Record<string, Record<string, any>> {
  const translations: Record<string, Record<string, any>> = {
    ...(config.translations || {}),
  };
  const localesDir = path.resolve(
    rootDir,
    config.localesDir || "locales",
  );

  if (!fs.existsSync(localesDir)) {
    return translations;
  }

  const loader = getJitiLoader(rootDir);

  const discoveredLocales = fs
    .readdirSync(localesDir)
    .filter((f) => f.match(/\.(json|ts|js|mjs)$/))
    .map((f) => f.replace(/\.(json|ts|js|mjs)$/, ""));

  const targetLocales = Array.from(
    new Set([...(config.locales || []), ...discoveredLocales]),
  );

  for (const loc of targetLocales) {
    const candidates = [
      path.join(localesDir, `${loc}.json`),
      path.join(localesDir, `${loc}.ts`),
      path.join(localesDir, `${loc}.js`),
      path.join(localesDir, `${loc}.mjs`),
    ];

    for (const file of candidates) {
      if (fs.existsSync(file)) {
        try {
          try {
            delete require.cache[file];
            delete require.cache[require.resolve(file)];
          } catch (_e) {}

          if (file.endsWith(".json")) {
            const raw = fs.readFileSync(file, "utf8");
            translations[loc] = JSON.parse(raw);
          } else {
            const mod = loader(file);
            translations[loc] = mod.default || mod;
          }
          break;
        } catch (err) {
          logger.warn(`Failed loading translations for locale "${loc}":`, err);
        }
      }
    }

    if (!translations[loc]) {
      translations[loc] = {};
    }
  }

  return translations;
}

/**
 * Resolves translation string for a dot-notated key with variable replacements.
 */
export function translate(
  translations: Record<string, Record<string, any>>,
  locale: string,
  defaultLocale: string,
  key: string,
  params: Record<string, any> = {},
): string {
  if (!key) return "";

  const lookup = (dict: Record<string, any>, pathKey: string): any => {
    if (!dict) return undefined;
    const parts = pathKey.split(".");
    let curr: any = dict;
    for (const part of parts) {
      if (curr && typeof curr === "object" && part in curr) {
        curr = curr[part];
      } else {
        return undefined;
      }
    }
    return curr;
  };

  const locDict = translations[locale] || {};
  let val = lookup(locDict, key);

  if (val === undefined && locale !== defaultLocale) {
    const defDict = translations[defaultLocale] || {};
    val = lookup(defDict, key);
  }

  if (val === undefined) {
    return key;
  }

  let text = String(val);
  for (const [k, v] of Object.entries(params)) {
    text = text.replace(new RegExp(`{{\\s*${k}\\s*}}`, "g"), String(v));
    text = text.replace(new RegExp(`{\\s*${k}\\s*}`, "g"), String(v));
    text = text.replace(new RegExp(`:${k}\\b`, "g"), String(v));
  }

  return text;
}

function parseCookies(cookieHeader?: string): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!cookieHeader) return cookies;
  const pairs = cookieHeader.split(";");
  for (const pair of pairs) {
    const idx = pair.indexOf("=");
    if (idx > 0) {
      const key = pair.substring(0, idx).trim();
      const val = pair.substring(idx + 1).trim();
      cookies[key] = decodeURIComponent(val);
    }
  }
  return cookies;
}

/**
 * Detects the best matching locale from request query (?lang=), cookies, path, or headers.
 */
export function detectLocale(
  req: Request | any,
  config: I18nConfig,
): { locale: string; pathname: string; isPrefixed: boolean; hasQueryLocale: boolean } {
  const pathname = req.path || (req.url ? req.url.split("?")[0] : "/");
  const segments = pathname.split("/").filter(Boolean);
  const firstSegment = segments[0]?.toLowerCase();

  // 1. Check if first path segment matches a configured locale (highest priority)
  if (firstSegment && config.locales.map((l) => l.toLowerCase()).includes(firstSegment)) {
    const matchedLocale =
      config.locales.find((l) => l.toLowerCase() === firstSegment) ||
      config.defaultLocale;
    const strippedPath = "/" + segments.slice(1).join("/");
    return {
      locale: matchedLocale,
      pathname: strippedPath === "" ? "/" : strippedPath,
      isPrefixed: true,
      hasQueryLocale: false,
    };
  }

  // 2. Check query parameter (?lang= or ?locale=)
  const rawQueryLang = (req.query?.lang || req.query?.locale) as
    | string
    | undefined;
  if (rawQueryLang && typeof rawQueryLang === "string") {
    const clean = rawQueryLang.trim().toLowerCase();
    const matched = config.locales.find((l) => l.toLowerCase() === clean);
    if (matched) {
      return { locale: matched, pathname, isPrefixed: false, hasQueryLocale: true };
    }
  }

  // 3. Check cookies (lang, locale, nxpress_locale, NEXT_LOCALE)
  const parsedCookies = parseCookies(req.headers?.cookie);
  const cookies = { ...parsedCookies, ...((req as any).cookies || {}) };
  const cookieLocale =
    cookies.lang || cookies.locale || cookies.nxpress_locale || cookies.NEXT_LOCALE;

  if (
    cookieLocale &&
    config.locales.map((l) => l.toLowerCase()).includes(cookieLocale.toLowerCase())
  ) {
    const matched = config.locales.find(
      (l) => l.toLowerCase() === cookieLocale.toLowerCase(),
    );
    if (matched) {
      return { locale: matched, pathname, isPrefixed: false, hasQueryLocale: false };
    }
  }

  // 4. Check Accept-Language header
  const acceptLang = req.headers?.["accept-language"];

  if (acceptLang) {
    const preferred = acceptLang
      .split(",")
      .map((part: string) => {
        const [lang, qVal] = part.trim().split(";q=");
        return {
          lang: lang.trim().toLowerCase().split("-")[0],
          q: qVal ? parseFloat(qVal) : 1.0,
        };
      })
      .sort((a: { q: number }, b: { q: number }) => b.q - a.q);

    for (const pref of preferred) {
      const match = config.locales.find(
        (l) => l.toLowerCase() === pref.lang,
      );
      if (match) {
        return { locale: match, pathname, isPrefixed: false, hasQueryLocale: false };
      }
    }
  }

  return {
    locale: config.defaultLocale,
    pathname,
    isPrefixed: false,
    hasQueryLocale: false,
  };
}

/**
 * Creates Express middleware handling i18n routing, detection, and translation helpers.
 */
export function createI18nMiddleware(
  rootDir: string,
  config: I18nConfig,
): RequestHandler {
  let translations = loadTranslations(rootDir, config);

  const reload = () => {
    translations = loadTranslations(rootDir, config);
    return translations;
  };

  (config as any)._reloadTranslations = reload;
  (config as any)._getTranslations = () => translations;
  activeI18nReloaders.add(reload);

  return (req: Request, res: Response, next: NextFunction) => {
    const { locale, pathname, isPrefixed, hasQueryLocale } = detectLocale(
      req,
      config,
    );

    // Persist language in cookie when specified via query param ?lang= or path prefix /en
    if (hasQueryLocale || isPrefixed) {
      try {
        res.setHeader(
          "Set-Cookie",
          `lang=${locale}; Path=/; Max-Age=31536000; SameSite=Lax`,
        );
      } catch (_e) {}
    }

    const currentTranslations = (config as any)._getTranslations
      ? (config as any)._getTranslations()
      : translations;

    const tr = (key: string, params: Record<string, any> = {}) =>
      translate(currentTranslations, locale, config.defaultLocale, key, params);

    const localeUrl = (targetPath: string = "/", targetLocale?: string) => {
      const loc = targetLocale || locale;
      const cleanPath = targetPath.startsWith("/") ? targetPath : "/" + targetPath;
      if (!config.prefixDefault && loc === config.defaultLocale) {
        if (targetLocale) {
          const sep = cleanPath.includes("?") ? "&" : "?";
          return `${cleanPath}${sep}lang=${loc}`;
        }
        return cleanPath;
      }
      return `/${loc}${cleanPath === "/" ? "" : cleanPath}`;
    };

    res.locals.lang = locale;
    res.locals.tr = tr;
    res.locals.localeUrl = localeUrl;

    if (res.locals.R && typeof res.locals.R === "object") {
      res.locals.R.locale = locale;
      res.locals.R.locales = config.locales;
      res.locals.R.defaultLocale = config.defaultLocale;
    }

    if (isPrefixed) {
      req.url = pathname + (req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : "");
    }

    next();
  };
}
