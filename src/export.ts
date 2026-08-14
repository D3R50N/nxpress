import fs from "fs";
import path from "path";
import { globSync } from "glob";
import hbs from "hbs";
import nunjucks from "nunjucks";
import { Liquid } from "liquidjs";
import { registerComponents, renderComponent } from "./components";
import {
  builtinHelpers,
  registerBuiltinHelpers,
  registerLiquidFilters,
  registerNunjucksHelpers,
} from "./helpers";
import {
  findLayoutsForRoute,
  renderTemplateFile,
  fileToRoutePath,
  getFilesPattern,
  getJitiLoader,
} from "./router";
import { injectTailwindCss, compileTailwindCss, TailwindOptions } from "./tailwind";
import { injectClientScript } from "./client";
import { getInjection } from "./injections";
import { getFilteredEnv } from "./env";
import { logger } from "./logger";
import { loadConfigFile } from "./config";
import { TemplateEngine } from "./server";
import { I18nConfig, loadTranslations, translate } from "./i18n";

export interface NxpressExportOptions {
  rootDir?: string;
  appDir?: string;
  pagesDir?: string;
  componentsDir?: string;
  publicDir?: string;
  outDir?: string;
  engine?: TemplateEngine;
  tailwind?: boolean | TailwindOptions;
  globals?: Record<string, any>;
  secureEnv?: boolean;
  clean?: boolean;
  i18n?: I18nConfig;
}

export interface ExportResult {
  outDir: string;
  exportedFiles: string[];
  durationMs: number;
}

function copyDirRecursive(src: string, dest: string) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

/**
 * Exports an Nxpress application into static HTML and assets (SSG).
 */
export async function exportStatic(
  options: NxpressExportOptions = {},
): Promise<ExportResult> {
  const startTime = Date.now();
  const rootDir = options.rootDir || process.cwd();
  const fileConfig = loadConfigFile(rootDir);

  const rawEngine =
    options.engine || fileConfig.engine || "ejs";
  const engine = rawEngine.toLowerCase() as TemplateEngine;

  const rawAppDir =
    options.appDir ||
    options.pagesDir ||
    fileConfig.appDir ||
    fileConfig.pagesDir ||
    (fs.existsSync(path.join(rootDir, "app"))
      ? "app"
      : "pages");
  const appDir = path.isAbsolute(rawAppDir)
    ? rawAppDir
    : path.resolve(rootDir, rawAppDir);

  const rawComponentsDir =
    options.componentsDir ||
    fileConfig.componentsDir ||
    "components";
  const componentsDir = path.isAbsolute(rawComponentsDir)
    ? rawComponentsDir
    : path.resolve(rootDir, rawComponentsDir);

  const rawPublicDir =
    options.publicDir ||
    fileConfig.publicDir ||
    "public";
  const publicDir = path.isAbsolute(rawPublicDir)
    ? rawPublicDir
    : path.resolve(rootDir, rawPublicDir);

  const outDir = path.resolve(
    rootDir,
    options.outDir || fileConfig.outDir || "out",
  );

  const clean = options.clean ?? fileConfig.clean ?? true;
  if (clean && fs.existsSync(outDir)) {
    fs.rmSync(outDir, { recursive: true, force: true });
  }
  fs.mkdirSync(outDir, { recursive: true });

  // 1. Setup engine and register helpers/components
  if (engine === "hbs") {
    registerBuiltinHelpers();
  }
  registerComponents(componentsDir, { engine, isDev: false });

  // 2. Compile and copy Tailwind CSS
  let tailwindCssUrl = "/tailwind.css";
  const hasTailwind =
    options.tailwind !== false && fileConfig.tailwind !== false;
  if (hasTailwind) {
    const twOpts =
      typeof options.tailwind === "object"
        ? options.tailwind
        : typeof fileConfig.tailwind === "object"
          ? fileConfig.tailwind
          : {};
    tailwindCssUrl = compileTailwindCss(rootDir, publicDir, twOpts);
  }

  // 3. Copy public directory assets to outDir
  if (fs.existsSync(publicDir)) {
    copyDirRecursive(publicDir, outDir);
  }

  // 4. Scan page templates
  const pattern = getFilesPattern(engine);
  const allFiles = globSync(pattern, { cwd: appDir }).sort();
  const pageFiles = allFiles.filter((f) => {
    const base = path.basename(f, path.extname(f));
    return (
      base !== "layout" &&
      !f.endsWith(".js") &&
      !f.endsWith(".ts")
    );
  });

  const i18nConfig: I18nConfig | undefined = options.i18n || fileConfig.i18n;
  const translations = i18nConfig ? loadTranslations(rootDir, i18nConfig) : {};
  const targetLocales =
    i18nConfig?.locales && i18nConfig.locales.length > 0
      ? i18nConfig.locales
      : [undefined];

  const exportedFiles: string[] = [];
  const loader = getJitiLoader(rootDir);

  for (const templateFile of pageFiles) {
    const base = path.basename(templateFile, path.extname(templateFile));
    const isErrorPage =
      base === "404" ||
      base === "500" ||
      base === "not-found" ||
      base === "error";

    const companionTsFile = path.resolve(
      appDir,
      templateFile.replace(/\.[^.]+$/, ".ts"),
    );
    const companionJsFile = path.resolve(
      appDir,
      templateFile.replace(/\.[^.]+$/, ".js"),
    );
    let companionPath: string | null = null;
    if (fs.existsSync(companionTsFile)) {
      companionPath = companionTsFile;
    } else if (fs.existsSync(companionJsFile)) {
      companionPath = companionJsFile;
    }

    let companionModule: any = null;
    if (companionPath) {
      try {
        companionModule = loader(companionPath);
      } catch (err) {
        logger.warn(`Failed loading companion module for ${templateFile}`);
      }
    }

    // Check if dynamic route has static params generator
    let paramSets: Array<Record<string, string>> = [{}];
    if (companionModule) {
      if (typeof companionModule.generateStaticParams === "function") {
        const generated = await companionModule.generateStaticParams();
        if (Array.isArray(generated)) {
          paramSets = generated;
        }
      } else if (typeof companionModule.paths === "function") {
        const generated = await companionModule.paths();
        if (Array.isArray(generated)) {
          paramSets = generated;
        }
      }
    }

    for (const params of paramSets) {
      let routePath = fileToRoutePath(templateFile);
      for (const [k, v] of Object.entries(params)) {
        routePath = routePath
          .replace(`:${k}`, encodeURIComponent(String(v)))
          .replace(`*${k}`, String(v));
      }

      // If route still has unresolved params, skip static export
      if (routePath.includes(":") || routePath.includes("*")) {
        logger.warn(
          `Skipping unresolved dynamic route "${routePath}" (${templateFile}). Export generateStaticParams() to render it.`,
        );
        continue;
      }

      for (const targetLocale of targetLocales) {
        const reqMock: any = {
          url: routePath,
          path: routePath,
          params,
          query: targetLocale ? { lang: targetLocale } : {},
          headers: {},
          cookies: targetLocale ? { lang: targetLocale } : {},
          protocol: "https",
          get: () => "localhost",
        };

        const resMock: any = {
          locals: {},
          headersSent: false,
          status: () => resMock,
          send: () => resMock,
          json: () => resMock,
        };

        let pageProps: Record<string, any> = {};

        if (companionModule) {
          try {
            let propsFn: any = null;
            if (typeof companionModule.props === "function") {
              propsFn = companionModule.props;
            } else if (
              companionModule.default &&
              typeof companionModule.default.props === "function"
            ) {
              propsFn = companionModule.default.props;
            } else if (typeof companionModule.default === "function") {
              propsFn = companionModule.default;
            } else if (typeof companionModule === "function") {
              propsFn = companionModule;
            }

            if (propsFn) {
              const result = await propsFn(reqMock, resMock);
              pageProps = { ...pageProps, ...result };
            }

            // Metadata export
            let metaFn: any = null;
            if (typeof companionModule.metadata === "function") {
              metaFn = companionModule.metadata;
            } else if (
              companionModule.default &&
              typeof companionModule.default.metadata === "function"
            ) {
              metaFn = companionModule.default.metadata;
            } else if (
              companionModule.metadata &&
              typeof companionModule.metadata === "object"
            ) {
              pageProps.metadata = {
                ...(pageProps.metadata || {}),
                ...companionModule.metadata,
              };
            } else if (
              companionModule.default?.metadata &&
              typeof companionModule.default.metadata === "object"
            ) {
              pageProps.metadata = {
                ...(pageProps.metadata || {}),
                ...companionModule.default.metadata,
              };
            }

            if (metaFn) {
              const metaRes = await metaFn(reqMock, resMock);
              if (metaRes && typeof metaRes === "object") {
                pageProps.metadata = {
                  ...(pageProps.metadata || {}),
                  ...metaRes,
                };
              }
            }
          } catch (err) {
            logger.error(`Error in companion props for ${templateFile}:`, err);
          }
        }

        const now = new Date();
        const tr = (key: string, trParams: Record<string, any> = {}) =>
          targetLocale && i18nConfig
            ? translate(
                translations,
                targetLocale,
                i18nConfig.defaultLocale,
                key,
                trParams,
              )
            : builtinHelpers.tr(key, trParams);

        const localeUrl = (targetPath: string = "/", destLocale?: string) => {
          const loc = destLocale || targetLocale || i18nConfig?.defaultLocale || "en";
          const cleanPath = targetPath.startsWith("/") ? targetPath : "/" + targetPath;
          if (!i18nConfig?.prefixDefault && loc === (i18nConfig?.defaultLocale || "en")) {
            if (destLocale) {
              const sep = cleanPath.includes("?") ? "&" : "?";
              return `${cleanPath}${sep}lang=${loc}`;
            }
            return cleanPath;
          }
          return `/${loc}${cleanPath === "/" ? "" : cleanPath}`;
        };

        const systemLocals: Record<string, any> = {
          year: now.getFullYear(),
          now,
          tailwindCssUrl,
          tailwind: `<link rel="stylesheet" href="${tailwindCssUrl}"/>`,
          E: getFilteredEnv(options.secureEnv ?? fileConfig.secureEnv ?? true),
          env: getFilteredEnv(options.secureEnv ?? fileConfig.secureEnv ?? true),
          ...builtinHelpers,
          tr,
          localeUrl,
          lang: targetLocale || i18nConfig?.defaultLocale || "en",
        };

        const globalObj = {
          $: (name: string, props: Record<string, any> = {}) =>
            renderComponent(name, props, systemLocals),
          ...builtinHelpers,
          tr,
          localeUrl,
          ...(options.globals || fileConfig.globals || {}),
        };

        systemLocals.G = globalObj;
        systemLocals.global = globalObj;
        systemLocals.R = {
          url: routePath,
          path: routePath,
          full: `https://localhost${routePath}`,
          base: "https://localhost",
          method: "GET",
          query: targetLocale ? { lang: targetLocale } : {},
          params,
          headers: {},
          cookies: targetLocale ? { lang: targetLocale } : {},
          ip: "127.0.0.1",
          protocol: "https",
          host: "localhost",
          locale: targetLocale || i18nConfig?.defaultLocale || "en",
          locales: i18nConfig?.locales || [],
          defaultLocale: i18nConfig?.defaultLocale || "en",
        };
        systemLocals.req = reqMock;
        systemLocals.$ = (name: string, props: Record<string, any> = {}) =>
          renderComponent(name, props, systemLocals);

        const mergedProps = {
          ...options.globals,
          ...fileConfig.globals,
          ...systemLocals,
          ...pageProps,
        };

        const templateFullPath = path.resolve(appDir, templateFile);
        const layouts = findLayoutsForRoute(
          rootDir,
          appDir,
          templateFile,
          engine,
        );

        let renderedHtml = renderTemplateFile(templateFullPath, mergedProps);
        for (const layoutPath of layouts) {
          renderedHtml = renderTemplateFile(layoutPath, {
            ...mergedProps,
            body: renderedHtml,
          });
        }

        let finalHtml = injectTailwindCss(renderedHtml, tailwindCssUrl);
        finalHtml = injectClientScript(finalHtml);

        // Determine output HTML filepath with i18n subdirectories
        let targetHtmlPath: string;
        const isDefault =
          !targetLocale ||
          !i18nConfig ||
          (!i18nConfig.prefixDefault &&
            targetLocale === i18nConfig.defaultLocale);

        if (isErrorPage) {
          const errorName =
            base === "not-found" ? "404" : base === "error" ? "500" : base;
          targetHtmlPath = isDefault
            ? path.join(outDir, `${errorName}.html`)
            : path.join(outDir, targetLocale!, `${errorName}.html`);
        } else if (routePath === "/" || routePath === "") {
          targetHtmlPath = isDefault
            ? path.join(outDir, "index.html")
            : path.join(outDir, targetLocale!, "index.html");
        } else {
          const cleanPath = routePath.replace(/^\/+/, "");
          targetHtmlPath = isDefault
            ? path.join(outDir, cleanPath, "index.html")
            : path.join(outDir, targetLocale!, cleanPath, "index.html");
        }

        fs.mkdirSync(path.dirname(targetHtmlPath), { recursive: true });
        fs.writeFileSync(targetHtmlPath, finalHtml, "utf8");
        exportedFiles.push(targetHtmlPath);
      }
    }
  }

  const durationMs = Date.now() - startTime;
  logger.success(
    `Exported ${exportedFiles.length} pages to "${path.relative(rootDir, outDir)}" in ${durationMs}ms`,
  );

  return {
    outDir,
    exportedFiles,
    durationMs,
  };
}
