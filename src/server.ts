import chokidar from "chokidar";
import dotenv from "dotenv";
import express, { Express } from "express";
import fs from "fs";
import { Server } from "http";
import path from "path";
import { registerComponents, renderComponent } from "./components";
import { builtinHelpers, registerBuiltinHelpers } from "./helpers";
import { registerRoutes, registerErrorHandlers } from "./router";
import { loadConfigFile } from "./config";

import { logger } from "./logger";
import {
  compileTailwindCss,
  getTailwindOutputInfo,
  TailwindOptions,
} from "./tailwind";
import {
  handleLiveReloadRoute,
  notifyLiveReload,
  LIVE_RELOAD_SCRIPT,
} from "./liveReload";
import { getFilteredEnv, isDevMode } from "./env";
import { I18nConfig, createI18nMiddleware } from "./i18n";

export type TemplateEngine = "ejs" | "hbs" | "html" | "nunjucks" | "liquid";

export interface NxpressServerOptions {
  rootDir?: string;
  appDir?: string;
  pagesDir?: string;
  componentsDir?: string;
  publicDir?: string;
  engine?: TemplateEngine;
  port?: number;
  tailwind?: boolean | TailwindOptions;
  globals?: Record<string, any>;
  isDev?: boolean;
  secureEnv?: boolean;
  i18n?: I18nConfig;
}

/**
 * Creates and configures the Nxpress Express app.
 */
export function nxpress(options: NxpressServerOptions = {}): Express {
  const app = express();
  const rootDir = options.rootDir || process.cwd();
  const fileConfig = loadConfigFile(rootDir);

  // Load .env file from rootDir if available
  const envPath = path.join(rootDir, ".env");
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath, quiet: true, override: true });
  }
  const publicDir = options.publicDir || path.join(rootDir, "public");

  // Enable Tailwind by default unless explicitly set to false
  let tailwindCssUrl = "/tailwind.css";
  const hasTailwindConfig = options.tailwind !== false;

  if (hasTailwindConfig) {
    const twOpts = typeof options.tailwind === "object" ? options.tailwind : {};
    tailwindCssUrl = compileTailwindCss(rootDir, publicDir, twOpts);
  }

  const appDir =
    options.appDir ||
    options.pagesDir ||
    (fs.existsSync(path.join(rootDir, "app"))
      ? path.join(rootDir, "app")
      : path.join(rootDir, "pages"));
  const componentsDir =
    options.componentsDir || path.join(rootDir, "components");

  const rawEngine = options.engine || "ejs";
  const engine = rawEngine.toLowerCase() as TemplateEngine;
  const allowedEngines: TemplateEngine[] = [
    "ejs",
    "hbs",
    "html",
    "nunjucks",
    "liquid",
  ];

  if (!allowedEngines.includes(engine)) {
    throw new Error(
      `[nxpress] Unsupported template engine: "${rawEngine}". Allowed engines are: ejs, hbs, html, nunjucks, liquid`,
    );
  }

  app.set("view engine", engine);
  app.set("views", [appDir, componentsDir, rootDir]);

  if (engine === "hbs") {
    registerBuiltinHelpers();
  } else if (engine === "html") {
    const htmlRenderer = (filePath: string, _opts: any, callback: any) => {
      try {
        const content = fs.readFileSync(filePath, "utf8");
        callback(null, content);
      } catch (err) {
        callback(err);
      }
    };
    app.engine("html", htmlRenderer);
    app.engine("htm", htmlRenderer);
  }

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // i18n localization middleware
  const i18nConfig = options.i18n || fileConfig.i18n;
  if (i18nConfig && Array.isArray(i18nConfig.locales) && i18nConfig.locales.length > 0) {
    app.use(createI18nMiddleware(rootDir, i18nConfig));
  }

  // Middleware injecting automatic global template variables
  app.use((req, res, next) => {
    const now = new Date();
    const globalObj = {
      $: renderComponent,
      ...builtinHelpers,
      ...(options.globals || {}),
    };

    const protocol = req.protocol || "http";
    const host = req.get("host") || "";
    const fullBaseUrl = host ? `${protocol}://${host}` : "";
    const full = host
      ? `${protocol}://${host}${req.originalUrl || req.url}`
      : req.originalUrl || req.url;

    const requestObj: Record<string, any> = {
      url: req.originalUrl || req.url,
      path: req.path,
      full,
      base: fullBaseUrl,
      method: req.method,
      query: req.query || {},
      params: req.params || {},
      headers: req.headers || {},
      cookies: (req as any).cookies || {},
      ip: req.ip,
      protocol,
      host,
      locale: res.locals.lang || (i18nConfig ? i18nConfig.defaultLocale : "en"),
      locales: i18nConfig ? i18nConfig.locales : [],
      defaultLocale: i18nConfig ? i18nConfig.defaultLocale : "en",
    };

    res.locals._tailwindCssUrl = tailwindCssUrl;
    res.locals.tailwind = `<link rel="stylesheet" href="${tailwindCssUrl}"/>`;
    res.locals.year = now.getFullYear();
    res.locals.now = now;
    const envObj = getFilteredEnv(options.secureEnv);
    res.locals.E = envObj;
    res.locals.env = envObj;
    res.locals.G = globalObj;
    res.locals.global = globalObj;
    res.locals.R = requestObj;
    res.locals.req = requestObj;
    res.locals.$ = (name: string, props: Record<string, any> = {}) =>
      renderComponent(name, props, res.locals);
    for (const [k, v] of Object.entries(builtinHelpers)) {
      if (res.locals[k] === undefined) {
        res.locals[k] = v;
      }
    }

    next();
  });

  app.get("/nxpress/live-reload", handleLiveReloadRoute);

  if (fs.existsSync(publicDir)) {
    app.use(express.static(publicDir));
  }

  let activeRouter = express.Router();

  const reloadRoutes = () => {
    try {
      registerComponents(componentsDir, options);
      const newRouter = express.Router();
      const pageFiles = registerRoutes(newRouter, appDir, {
        engine,
        globals: options.globals,
        rootDir,
        isDev: options.isDev,
      });
      registerErrorHandlers(
        newRouter,
        pageFiles,
        {
          engine,
          globals: options.globals,
          rootDir,
          isDev: options.isDev,
        },
        appDir,
      );
      activeRouter = newRouter;
      return pageFiles;
    } catch (err) {
      logger.error("Error reloading routes:", err);
    }
  };

  const originalListen = app.listen.bind(app);
  let isListenSetup = false;

  app.listen = function (...args: any[]) {
    if (!isListenSetup) {
      isListenSetup = true;

      reloadRoutes();

      app.use((req, res, next) => {
        activeRouter(req, res, next);
      });

      if (isDevMode(options)) {
        setupDevWatcher(options, reloadRoutes);
      }
    }
    return originalListen(...args);
  } as any;

  return app;
}

/**
 * Sets up background file watching for live reload and cache clearing in development mode.
 */
function setupDevWatcher(
  options: NxpressServerOptions,
  reloadRoutes: () => any,
): void {
  const rootDir = options.rootDir || process.cwd();
  const appDir = options.appDir || path.join(rootDir, "app");
  const componentsDir =
    options.componentsDir || path.join(rootDir, "components");
  const publicDir = options.publicDir || path.join(rootDir, "public");

  const tailwindOptions =
    typeof options.tailwind === "object" ? options.tailwind : {};
  const tailwindInput = tailwindOptions.input
    ? path.resolve(rootDir, tailwindOptions.input)
    : path.join(rootDir, "app.css");

  const { outputCss: tailwindOutput } = getTailwindOutputInfo(
    rootDir,
    publicDir,
    tailwindOptions,
  );

  const watchTargets = [
    appDir,
    componentsDir,
    publicDir,
    tailwindInput,
    path.join(rootDir, ".env"),
    path.join(rootDir, "nxpress.config.json"),
    path.join(rootDir, "nxpress.config.js"),
    path.join(rootDir, "nxpress.config.ts"),
  ].filter((target) => fs.existsSync(target));

  const watcher = chokidar.watch(watchTargets, {
    ignored: [tailwindOutput, "**/*.map"],
    ignoreInitial: true,
    awaitWriteFinish: {
      stabilityThreshold: 30,
    },
  });

  watcher.on("all", (event, filePath) => {
    const filename = path.basename(filePath);

    if (
      filePath === tailwindOutput ||
      path.resolve(filePath) === path.resolve(tailwindOutput) ||
      filename === "tailwind.css"
    ) {
      return;
    }

    const relPath = path.relative(rootDir, filePath);

    try {
      const resolved = require.resolve(filePath);
      delete require.cache[resolved];
    } catch (e) {}
    try {
      delete require.cache[filePath];
    } catch (e) {}
    try {
      if (fs.existsSync(filePath)) {
        delete require.cache[fs.realpathSync(filePath)];
      }
    } catch (e) {}

    if (filename.startsWith("nxpress.config") || filename === ".env") {
      const fileConfig = loadConfigFile(rootDir);
      options.globals = fileConfig.globals || {};
      logger.info(`Configuration updated from \`${relPath}\``);
      reloadRoutes();
      notifyLiveReload();
      return;
    }

    if (filePath.startsWith(componentsDir)) {
      registerComponents(componentsDir, options);
    }

    if (
      event === "add" ||
      event === "unlink" ||
      event === "addDir" ||
      event === "unlinkDir"
    ) {
      logger.info(`Structure changed (${event}) \`${relPath}\``);
      reloadRoutes();
    } else {
      logger.info(`File changed \`${relPath}\``);
    }

    if (options.tailwind !== false) {
      compileTailwindCss(rootDir, publicDir, tailwindOptions);
    }

    notifyLiveReload();
  });
}

/**
 * Starts the Nxpress server on specified port.
 */
export function serve(
  options: NxpressServerOptions = {},
  log: boolean = true,
): Server {
  const isDev = isDevMode(options);
  options.isDev = isDev;

  const port = options.port || Number(process.env.PORT) || 3000;
  const app = nxpress(options);

  const server = app.listen(port, (err) => {
    if (err) {
      throw err;
    }
    if (log) {
      logger.serverRunning(port);
    }
  });

  if (isDev && process.stdin.isTTY) {
    try {
      process.stdin.setRawMode(true);
      process.stdin.resume();
      process.stdin.setEncoding("utf8");
      process.stdin.on("data", (key: string) => {
        if (key === "\u0003" || key === "\u0004") {
          process.exit(0);
        }
        if (key.toLowerCase() === "r" || key.trim().toLowerCase() === "rs") {
          logger.warn("Manual reload triggered");
          notifyLiveReload();
        }
      });
    } catch (e) {}
  }

  return server;
}
