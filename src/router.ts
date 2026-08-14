import fs from "fs";
import path from "path";
import { globSync } from "glob";
import {
  Express,
  Router,
  Request,
  Response,
  RequestHandler,
  NextFunction,
} from "express";
import hbs from "hbs";
import { Eta } from "eta";
import nunjucks from "nunjucks";
import { Liquid } from "liquidjs";
import { createJiti } from "jiti";
import { logger } from "./logger";
import { injectTailwindCss } from "./tailwind";
import { injectLiveReloadScript } from "./liveReload";
import { injectClientScript } from "./client";
import { getInjection } from "./injections";
import { isDevMode } from "./env";
import {
  builtinHelpers,
  ejsToEta,
  registerBuiltinHelpers,
  registerLiquidFilters,
  registerNunjucksHelpers,
} from "./helpers";

const etaEngine = new Eta({
  useWith: true,
});
const liquidEngine = new Liquid();

registerLiquidFilters(liquidEngine);
try {
  registerNunjucksHelpers(nunjucks);
} catch (_e) {}

export function getJitiLoader(rootDir?: string): ReturnType<typeof createJiti> {
  const baseDir = rootDir || process.cwd();
  const tsconfigPath = path.join(baseDir, "tsconfig.json");
  const hasTsConfig = fs.existsSync(tsconfigPath);
  return createJiti(path.join(baseDir, "index.ts"), {
    cache: false,
    requireCache: false,
    tsconfigPaths: hasTsConfig ? tsconfigPath : true,
  });
}

export interface NxpressDataModule {
  props?: (
    req: Request,
    res: Response,
  ) => Promise<Record<string, any>> | Record<string, any>;
  default?: (
    req: Request,
    res: Response,
  ) => Promise<Record<string, any>> | Record<string, any>;
}

export type HttpMethod = "get" | "post" | "put" | "delete" | "patch";

export interface RouterOptions {
  rootDir?: string;
  pagesDir?: string;
  engine?: string;
  globals?: Record<string, any>;
  isDev?: boolean;
}

/**
 * Renders a single template file with given props for EJS (Eta), Nunjucks, Liquid, HBS, HTML.
 */
export function renderTemplateFile(
  filePath: string,
  props: Record<string, any>,
): string {
  const content = fs.readFileSync(filePath, "utf8");
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".ejs") {
    return etaEngine.renderString(ejsToEta(content), props);
  }

  if (ext === ".njk" || ext === ".nunjucks") {
    return nunjucks.renderString(content, props);
  }

  if (ext === ".liquid") {
    return liquidEngine.parseAndRenderSync(content, props);
  }

  // Handlebars default
  const template = hbs.handlebars.compile(content);
  return template(props);
}

/**
 * Discovers matching nested layout files for a route from inner to outer directory.
 */
export function findLayoutsForRoute(
  rootDir: string,
  appDir: string,
  templateRelPath: string,
  engine: string = "ejs",
): string[] {
  const fileExt = path.extname(templateRelPath).toLowerCase();
  const baseName = path.basename(templateRelPath, fileExt);

  // If rendering a layout file itself, return no layouts
  if (baseName === "layout") {
    return [];
  }

  // Determine target layout extensions based on engine & file extension
  let targetExts: string[] = [fileExt];
  if (engine === "ejs") {
    targetExts = [".ejs", ".html"];
  } else if (engine === "njk" || engine === "nunjucks") {
    targetExts = [".njk", ".nunjucks", ".html"];
  } else if (engine === "liquid") {
    targetExts = [".liquid", ".html"];
  } else if (engine === "hbs") {
    targetExts = [".hbs"];
  } else if (engine === "html") {
    targetExts = [".html", ".htm"];
  }

  const layouts: string[] = [];

  // Build candidate directories from innermost sub-folder up to rootDir
  const searchDirs: string[] = [];
  const dirParts = path
    .dirname(templateRelPath)
    .split(/[/\\]/)
    .filter((p) => p !== "." && p !== "");

  for (let i = dirParts.length; i >= 0; i--) {
    const subDir = dirParts.slice(0, i).join("/");
    searchDirs.push(path.join(appDir, subDir));
  }

  searchDirs.forEach((dir) => {
    if (!fs.existsSync(dir)) return;

    for (const extCandidate of targetExts) {
      const layoutFile = path.join(dir, `layout${extCandidate}`);
      if (fs.existsSync(layoutFile) && !layouts.includes(layoutFile)) {
        layouts.push(layoutFile);
        break;
      }
    }
  });

  return layouts;
}

/**
 * Converts a page file relative path into an Express route pattern.
 */
export function fileToRoutePath(relPath: string): string {
  let routePath = relPath.replace(
    /\.(hbs|ejs|html|eta|liquid|nunjucks|njk|pug|mustache|js|ts)$/i,
    "",
  );

  if (routePath === "index" || routePath.endsWith("/index")) {
    routePath = routePath.replace(/\/index$/, "").replace(/^index$/, "");
  }

  routePath = routePath.replace(/\[\.\.\.([^\]]+)\]/g, "*$1");
  routePath = routePath.replace(/\[([^\]]+)\]/g, ":$1");

  if (!routePath.startsWith("/")) {
    routePath = "/" + routePath;
  }

  return routePath;
}

/**
 * Helper to check if a route path matches an array of ignore patterns (exact or wildcard *).
 */
export function isRouteIgnored(
  routePath: string,
  ignorePatterns?: string[],
): boolean {
  if (
    !ignorePatterns ||
    !Array.isArray(ignorePatterns) ||
    ignorePatterns.length === 0
  ) {
    return false;
  }

  const cleanRoute = routePath.startsWith("/") ? routePath : "/" + routePath;

  return ignorePatterns.some((pattern) => {
    if (!pattern) return false;
    const cleanPattern = pattern.startsWith("/") ? pattern : "/" + pattern;
    if (cleanPattern === cleanRoute) return true;

    // Convert wildcard pattern like /admin/* to regex ^\/admin\/.*$
    const regexString =
      "^" +
      cleanPattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") +
      "$";
    const regex = new RegExp(regexString);
    return regex.test(cleanRoute);
  });
}

/**
 * Executes a single middleware function or list of middlewares:
 * - Auto-invokes next() if not explicitly called and no response was returned/sent.
 * - Auto-responds with res.json/res.send if a string, object, array, number, or boolean is returned.
 */
export async function executeMiddlewareList(
  mw: any,
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  if (!mw) return next();

  const mwList = Array.isArray(mw) ? mw : [mw];
  let index = 0;

  const runStep = async (err?: any): Promise<void> => {
    if (err) return next(err);
    if (
      index >= mwList.length ||
      res.headersSent ||
      (res as any).writableEnded
    ) {
      return next();
    }

    const fn = mwList[index++];
    if (typeof fn !== "function") {
      return runStep();
    }

    let calledNext = false;
    const stepNext = (stepErr?: any) => {
      if (calledNext) return;
      calledNext = true;
      if (stepErr) {
        return next(stepErr);
      }
      runStep();
    };

    try {
      const result = fn.length >= 3 ? fn(req, res, stepNext) : fn(req, res);
      const resolved = result instanceof Promise ? await result : result;

      if (calledNext || res.headersSent || (res as any).writableEnded) {
        return;
      }

      if (resolved !== undefined && resolved !== null) {
        if (typeof resolved === "string" || Buffer.isBuffer(resolved)) {
          res.send(resolved);
        } else if (
          typeof resolved === "object" ||
          typeof resolved === "number" ||
          typeof resolved === "boolean"
        ) {
          res.json(resolved);
        }
        return;
      }

      if (!calledNext) {
        stepNext();
      }
    } catch (e) {
      if (!calledNext) {
        stepNext(e);
      }
    }
  };

  await runStep();
}

function toRelPath(filePath: string): string {
  if (!filePath) return "";
  const rel = path.relative(process.cwd(), filePath);
  return rel || filePath;
}

/**
 * Creates a dynamic RequestHandler wrapper for a folder-level middleware file.
 * Clears require cache and reloads the file on each request to support instant dev updates.
 */
export function createFolderMiddlewareWrapper(
  mwFile: string,
  rootDir?: string,
): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      try {
        delete require.cache[require.resolve(mwFile)];
      } catch (e) {}

      let mwModule: any;
      const loader = getJitiLoader(rootDir);
      try {
        mwModule = loader(mwFile);
      } catch (e) {
        mwModule = require(mwFile);
      }

      const ignoreList =
        mwModule.ignore || (mwModule.default && mwModule.default.ignore);
      if (isRouteIgnored(req.path, ignoreList)) {
        return next();
      }

      const rawMwList: any[] = [];
      // Collect all exported functions or arrays of functions (except ignore)
      for (const key of Object.keys(mwModule)) {
        if (key === "ignore") continue;
        const val = mwModule[key];
        if (Array.isArray(val)) {
          val.forEach((item) => {
            if (typeof item === "function") rawMwList.push(item);
          });
        } else if (typeof val === "function") {
          rawMwList.push(val);
        }
      }

      await executeMiddlewareList(rawMwList, req, res, next);
    } catch (err) {
      logger.error(
        `Error executing dynamic middleware at ${toRelPath(mwFile)}:`,
        err,
      );
      next(err);
    }
  };
}

/**
 * Creates a dynamic RequestHandler wrapper for route-level middlewares.
 * Strictly checks `middleware` (must be function) and `middlewares` (must be array) exports and merges them.
 */
export function createRouteMiddlewareWrapper(
  filePath: string,
  rootDir?: string,
): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    const relFile = toRelPath(filePath);
    try {
      try {
        delete require.cache[require.resolve(filePath)];
      } catch (e) {}

      let routeModule: any;
      const loader = getJitiLoader(rootDir);
      try {
        routeModule = loader(filePath);
      } catch (e) {
        routeModule = require(filePath);
      }

      const rawMwList: any[] = [];

      if (routeModule.middleware !== undefined) {
        if (Array.isArray(routeModule.middleware)) {
          const msg = `Export 'middleware' in "${relFile}" cannot be an Array. Use a single function for 'middleware' or export an Array as 'middlewares'.`;
          throw new Error(msg);
        } else if (typeof routeModule.middleware === "function") {
          rawMwList.push(routeModule.middleware);
        } else {
          const msg = `Export 'middleware' in "${relFile}" must be a function.`;
          throw new Error(msg);
        }
      }

      if (routeModule.middlewares !== undefined) {
        if (typeof routeModule.middlewares === "function") {
          const msg = `Export 'middlewares' in "${relFile}" cannot be a single function. Use an Array for 'middlewares' or export a single function as 'middleware'.`;
          throw new Error(msg);
        } else if (Array.isArray(routeModule.middlewares)) {
          routeModule.middlewares.forEach((item: any) => {
            if (typeof item === "function") rawMwList.push(item);
          });
        } else {
          const msg = `Export 'middlewares' in "${relFile}" must be an Array of functions.`;
          throw new Error(msg);
        }
      }

      await executeMiddlewareList(rawMwList, req, res, next);
    } catch (err) {
      logger.error(
        `Error executing route middleware at ${toRelPath(filePath)}:`,
        err,
      );
      next(err);
    }
  };
}

/**
 * Resolves folder-level middleware files (middleware.ts / middleware.js) from appDir down to target relative path.
 */
export function getFolderMiddlewares(
  appDir: string,
  relPath: string,
  routePath: string,
  rootDir?: string,
): RequestHandler[] {
  const middlewares: RequestHandler[] = [];
  const dirParts = path
    .dirname(relPath)
    .split(/[/\\]/)
    .filter((p) => p !== "." && p !== "");

  const searchDirs: string[] = [appDir];
  let cur = appDir;
  for (const part of dirParts) {
    cur = path.join(cur, part);
    searchDirs.push(cur);
  }

  for (const dir of searchDirs) {
    if (!fs.existsSync(dir)) continue;

    const tsFile = path.resolve(dir, "middleware.ts");
    const jsFile = path.resolve(dir, "middleware.js");
    let mwFile: string | null = null;
    if (fs.existsSync(tsFile)) {
      mwFile = tsFile;
    } else if (fs.existsSync(jsFile)) {
      mwFile = jsFile;
    }

    if (mwFile) {
      middlewares.push(createFolderMiddlewareWrapper(mwFile, rootDir));
    }
  }

  return middlewares;
}

/**
 * Resolves route-level middlewares exported by an API route module or companion page module.
 */
export function getRouteMiddlewares(
  routeModule: any,
  filePath?: string,
): RequestHandler[] {
  if (!routeModule) return [];
  const list: RequestHandler[] = [];
  const relFile = filePath ? toRelPath(filePath) : "route";

  if (routeModule.middleware !== undefined) {
    if (Array.isArray(routeModule.middleware)) {
      const msg = `[Nxpress Error] Export 'middleware' in "${relFile}" cannot be an Array. Use 'middlewares' for an Array.`;
      logger.error(msg);
      throw new Error(msg);
    } else if (typeof routeModule.middleware === "function") {
      list.push(routeModule.middleware);
    }
  }

  if (routeModule.middlewares !== undefined) {
    if (typeof routeModule.middlewares === "function") {
      const msg = `[Nxpress Error] Export 'middlewares' in "${relFile}" cannot be a function. Use 'middleware' for a single function.`;
      logger.error(msg);
      throw new Error(msg);
    } else if (Array.isArray(routeModule.middlewares)) {
      routeModule.middlewares.forEach((item: any) => {
        if (typeof item === "function") list.push(item);
      });
    }
  }

  return list;
}

/**
 * Renders a page view with its companion file, layout, and props.
 */
export async function renderPageView(
  req: Request,
  res: Response,
  templateFile: string,
  statusCode: number = 200,
  extraProps: Record<string, any> = {},
  options: RouterOptions = {},
  appDir: string = "",
): Promise<void> {
  res.status(statusCode);

  const rootDir = options.rootDir || process.cwd();
  const engine = options.engine || "ejs";
  let pageProps: Record<string, any> = { ...extraProps };

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

  if (companionPath) {
    try {
      let dataModule: any;
      const loader = getJitiLoader(rootDir);
      try {
        dataModule = await loader.import(companionPath);
      } catch (importErr) {
        dataModule = loader(companionPath);
      }

      let propsFn: any = null;
      if (typeof dataModule.props === "function") {
        propsFn = dataModule.props;
      } else if (
        dataModule.default &&
        typeof dataModule.default.props === "function"
      ) {
        propsFn = dataModule.default.props;
      } else if (typeof dataModule.default === "function") {
        propsFn = dataModule.default;
      } else if (typeof dataModule === "function") {
        propsFn = dataModule;
      }

      if (propsFn) {
        const result = await propsFn(req, res);
        pageProps = { ...pageProps, ...result };
      }
    } catch (err) {
      logger.error(`Error executing companion file for ${templateFile}:`, err);
    }
  }

  if (res.headersSent) return;

  if (res.locals.R && typeof res.locals.R === "object") {
    res.locals.R.params = req.params || {};
  }

  const tailwindCssUrl = res.locals.tailwindCssUrl || "/tailwind.css";

  const mergedProps = { ...options.globals, ...res.locals, ...pageProps };
  const systemReservedKeys = [
    "G",
    "global",
    "R",
    "req",
    "E",
    "env",
    "$",
    "tailwind",
    "I",
    "cn",
  ];
  for (const key of systemReservedKeys) {
    if (key in pageProps) {
      logger.warn(`Reserved key "${key}" in props() was overridden by system.`);
    }
    mergedProps[key] = res.locals[key];
  }

  const templateFullPath = path.resolve(appDir, templateFile);
  const layouts = findLayoutsForRoute(rootDir, appDir, templateFile, engine);

  const viewPath = templateFile.replace(/\.[^.]+$/, "");
  if (layouts.length === 0) {
    return res.render(viewPath, mergedProps);
  }

  try {
    let renderedHtml = renderTemplateFile(templateFullPath, mergedProps);
    for (const layoutPath of layouts) {
      renderedHtml = renderTemplateFile(layoutPath, {
        ...mergedProps,
        body: renderedHtml,
      });
    }

    let finalHtml = injectTailwindCss(renderedHtml, tailwindCssUrl);
    finalHtml = injectClientScript(finalHtml);
    if (isDevMode(options)) {
      finalHtml = injectLiveReloadScript(finalHtml);
    }
    res.send(finalHtml);
  } catch (err: any) {
    logger.error(`Error rendering page/layout for ${templateFile}:`, err);
    if (!res.headersSent) {
      if (isDevMode(options)) {
        res.status(500).send(formatDev500ErrorHtml(err));
      } else {
         let html500 = getInjection("500.html");
          res.status(500).send(html500);
      }
    }
  }
}

/**
 * Registers all file-based routes from the app directory onto an Express app.
 */
export function registerRoutes(
  app: Express | Router | any,
  appDir: string,
  options: RouterOptions = {},
): string[] {
  if (!fs.existsSync(appDir)) {
    logger.warn(`Directory "${appDir}" does not exist.`);
    return [];
  }

  const rootDir = options.rootDir || process.cwd();

  // Build targeted glob pattern matching only engine extensions & API/companion JS/TS files
  let globPattern = getFilesPattern(options.engine);

  const files = globSync(globPattern, {
    cwd: appDir,
    nodir: true,
  });

  const apiFiles: string[] = [];
  const pageFiles: string[] = [];

  files.forEach((file) => {
    const ext = path.extname(file).toLowerCase();
    const baseName = path.basename(file, ext);
    if (baseName === "middleware" || baseName === "layout") return;

    if (file.startsWith("api/") || file.startsWith("api\\")) {
      apiFiles.push(file);
    } else {
      if (ext !== ".js" && ext !== ".ts") {
        pageFiles.push(file);
      }
    }
  });

  // 1. Register API Routes
  apiFiles.forEach((file) => {
    if (!file.endsWith(".js") && !file.endsWith(".ts")) return;

    const fullPath = path.resolve(appDir, file);
    const routePath = fileToRoutePath(file);
    const loader = getJitiLoader(options.rootDir);

    delete require.cache[require.resolve(fullPath)];
    let routeModule: any;
    try {
      routeModule = loader(fullPath);
    } catch (e) {
      routeModule = require(fullPath);
    }

    const folderMws = getFolderMiddlewares(appDir, file, routePath, options.rootDir);
    const routeMwWrapper = createRouteMiddlewareWrapper(fullPath, options.rootDir);
    const allMiddlewares = [...folderMws, routeMwWrapper];

    const methods: HttpMethod[] = ["get", "post", "put", "delete", "patch"];
    let registered = false;

    methods.forEach((method) => {
      if (typeof routeModule[method] === "function") {
        app[method](
          routePath,
          ...allMiddlewares,
          async (req: Request, res: Response, next: NextFunction) => {
            try {
              try {
                delete require.cache[require.resolve(fullPath)];
              } catch (e) {}
              const freshModule = loader(fullPath);
              const handler =
                typeof freshModule[method] === "function"
                  ? freshModule[method]
                  : routeModule[method];
              const result = await handler(req, res, next);
              if (
                result !== undefined &&
                result !== null &&
                !res.headersSent &&
                !(res as any).writableEnded
              ) {
                if (typeof result === "string" || Buffer.isBuffer(result)) {
                  res.send(result);
                } else {
                  res.json(result);
                }
              }
            } catch (e) {
              next(e);
            }
          },
        );
        registered = true;
      }
    });

    if (!registered) {
      app.all(
        routePath,
        ...allMiddlewares,
        async (req: Request, res: Response, next: NextFunction) => {
          try {
            try {
              delete require.cache[require.resolve(fullPath)];
            } catch (e) {}
            const freshModule = loader(fullPath);
            const defaultHandler = freshModule.default || freshModule;
            const handler =
              typeof defaultHandler === "function"
                ? defaultHandler
                : routeModule.default || routeModule;
            if (typeof handler === "function") {
              const result = await handler(req, res, next);
              if (
                result !== undefined &&
                result !== null &&
                !res.headersSent &&
                !(res as any).writableEnded
              ) {
                if (typeof result === "string" || Buffer.isBuffer(result)) {
                  res.send(result);
                } else {
                  res.json(result);
                }
              }
            }
          } catch (e) {
            next(e);
          }
        },
      );
    }
  });

  // 2. Register Page View Routes
  const templateFiles = pageFiles.filter((f) => {
    if (f.endsWith(".js") || f.endsWith(".ts")) return false;
    const base = path.basename(f, path.extname(f));
    return (
      base !== "404" &&
      base !== "500" &&
      base !== "not-found" &&
      base !== "error"
    );
  });

  templateFiles.forEach((templateFile) => {
    const routePath = fileToRoutePath(templateFile);

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

    const folderMws = getFolderMiddlewares(appDir, templateFile, routePath, options.rootDir);
    const allMiddlewares = [...folderMws];
    if (companionPath) {
      allMiddlewares.push(createRouteMiddlewareWrapper(companionPath, options.rootDir));
    }

    const handler: RequestHandler = async (req: Request, res: Response) => {
      try {
        await renderPageView(req, res, templateFile, 200, {}, options, appDir);
      } catch (err) {
        logger.error(`Error handling route ${routePath}:`, err);
        if (!res.headersSent) {
          let html500 = getInjection("500.html");
          res.status(500).send(html500);
        }
      }
    };

    app.get(routePath, ...allMiddlewares, handler);
  });

  return pageFiles;
}

/**
 * Registers catch-all 404 and global 500 error handlers at the end of the Express stack.
 */
export function registerErrorHandlers(
  app: Express | Router | any,
  pageFiles: string[],
  options: RouterOptions = {},
  appDir: string = "",
): void {
  // 3. Catch-all 404 Handler
  app.use(async (req: Request, res: Response) => {
    const custom404 = pageFiles.find((f) => {
      if (f.endsWith(".js") || f.endsWith(".ts")) return false;
      const base = path.basename(f, path.extname(f));
      return base === "404" || base === "not-found";
    });

    if (custom404) {
      return renderPageView(
        req,
        res,
        custom404,
        404,
        { title: "404" },
        options,
        appDir,
      );
    }

    let html404 = getInjection("404.html");
    if (isDevMode(options)) {
      html404 = injectLiveReloadScript(html404);
    }
    res.status(404).send(html404);
  });

  // 4. Global 500 Error Handler
  app.use(async (err: any, req: Request, res: Response, next: any) => {
    logger.error("Server Error:", err);

    const custom500 = pageFiles.find((f) => {
      if (f.endsWith(".js") || f.endsWith(".ts")) return false;
      const base = path.basename(f, path.extname(f));
      return base === "500" || base === "error";
    });

    if (custom500) {
      return renderPageView(
        req,
        res,
        custom500,
        500,
        { title: "500", error: err?.message || String(err) },
        options,
        appDir,
      );
    }

    if (isDevMode(options)) {
      return res.status(500).send(formatDev500ErrorHtml(err));
    }

    let html500 = getInjection("500.html");
    res.status(500).send(html500);
  });
}

export function getFilesPattern(optionsEngine?: string) {
  if (!optionsEngine) {
    return "**/*.{hbs,html,ejs,pug,mustache,njk,nunjucks,liquid,js,ts}";
  }
  const engine = optionsEngine.toLowerCase();

  let globPattern = `**/*.{${engine},js,ts}`;
  if (engine === "ejs") {
    globPattern = "**/*.{ejs,js,ts}";
  } else if (engine === "hbs") {
    globPattern = "**/*.{hbs,js,ts}";
  } else if (engine === "njk" || engine === "nunjucks") {
    globPattern = "**/*.{njk,nunjucks,js,ts}";
  } else if (engine === "liquid") {
    globPattern = "**/*.{liquid,js,ts}";
  } else if (engine === "html") {
    globPattern = "**/*.{html,htm,js,ts}";
  }
  return globPattern;
}

function escapeHtml(str: string): string {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatDev500ErrorHtml(err: any): string {
  const message = err?.message || String(err || "Unknown Error");
  const stack = err?.stack || String(err || "");
  const name = err?.name || "Runtime Error";

  let template = getInjection("500-dev.html");
  let html = template
    .replace(/\{\{NAME\}\}/g, escapeHtml(name))
    .replace(/\{\{MESSAGE\}\}/g, escapeHtml(message))
    .replace(/\{\{STACK\}\}/g, escapeHtml(stack));

  return injectLiveReloadScript(html);
}
