import fs from "fs";
import path from "path";
import { globSync } from "glob";
import chalk from "chalk";
import {
  fileToRoutePath,
  getFilesPattern,
  getJitiLoader,
  findMethodHandler,
} from "./router";
import { formatMethod } from "./logger";
import { loadConfigFile } from "./config";

export interface ApiRouteInfo {
  path: string;
  methods: string[];
  file: string;
}

export interface PageRouteInfo {
  path: string;
  method: string;
  file: string;
}

export interface ScannedRoutes {
  apiRoutes: ApiRouteInfo[];
  pageRoutes: PageRouteInfo[];
}

export interface ScanRoutesOptions {
  rootDir?: string;
  appDir?: string;
  engine?: string;
}

export function scanRoutes(options: ScanRoutesOptions = {}): ScannedRoutes {
  const rootDir = options.rootDir || process.cwd();
  const fileConfig = loadConfigFile(rootDir);

  const rawAppDir =
    options.appDir ||
    fileConfig.appDir ||
    (fs.existsSync(path.join(rootDir, "app"))
      ? path.join(rootDir, "app")
      : path.join(rootDir, "pages"));

  const appDir = path.isAbsolute(rawAppDir)
    ? rawAppDir
    : path.resolve(rootDir, rawAppDir);

  if (!fs.existsSync(appDir)) {
    return { apiRoutes: [], pageRoutes: [] };
  }

  const engine = options.engine || fileConfig.engine || "ejs";
  const globPattern = getFilesPattern(engine);

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

  const appDirBase = path.basename(appDir);
  const loader = getJitiLoader(rootDir);

  // 1. Scan API Routes
  const standardMethods = [
    "GET",
    "POST",
    "PUT",
    "DELETE",
    "PATCH",
    "HEAD",
    "OPTIONS",
  ];
  const apiRoutes: ApiRouteInfo[] = [];

  for (const file of apiFiles) {
    if (!file.endsWith(".js") && !file.endsWith(".ts")) continue;
    const fullPath = path.resolve(appDir, file);
    const routePath = fileToRoutePath(file);

    let routeModule: any;
    try {
      delete require.cache[require.resolve(fullPath)];
      routeModule = loader(fullPath);
    } catch (_e) {
      try {
        routeModule = require(fullPath);
      } catch (_e2) {
        routeModule = {};
      }
    }

    const detectedMethods: string[] = [];
    for (const m of standardMethods) {
      if (findMethodHandler(routeModule, m)) {
        detectedMethods.push(m);
      }
    }

    if (detectedMethods.length === 0) {
      if (
        routeModule.default &&
        typeof routeModule.default === "function"
      ) {
        detectedMethods.push("ALL");
      } else {
        detectedMethods.push("GET");
      }
    }

    apiRoutes.push({
      path: routePath,
      methods: detectedMethods,
      file: path.join(appDirBase, file),
    });
  }

  // 2. Scan Page Routes
  const pageRoutes: PageRouteInfo[] = [];
  for (const file of pageFiles) {
    const routePath = fileToRoutePath(file);
    pageRoutes.push({
      path: routePath,
      method: "GET",
      file: path.join(appDirBase, file),
    });
  }

  // Sort by route path
  apiRoutes.sort((a, b) => a.path.localeCompare(b.path));
  pageRoutes.sort((a, b) => a.path.localeCompare(b.path));

  return { apiRoutes, pageRoutes };
}

export function printRoutes(options: ScanRoutesOptions = {}): void {
  const { apiRoutes, pageRoutes } = scanRoutes(options);
  const total = apiRoutes.length + pageRoutes.length;

  console.log();
  console.log(chalk.cyan.bold("  Nxpress Routes"));
  console.log();

  if (total === 0) {
    console.log(chalk.yellow("  No routes found in the application directory."));
    console.log();
    return;
  }

  if (apiRoutes.length > 0) {
    console.log(chalk.bold.underline(`  API Routes (${apiRoutes.length})`));
    console.log();
    for (const r of apiRoutes) {
      const rawMethods = r.methods.join(" ");
      const formattedMethods = r.methods.map((m) => formatMethod(m)).join(" ");
      const pathCol =
        chalk.bold(r.path) + " ".repeat(Math.max(1, 30 - r.path.length));
      const methodCol =
        formattedMethods + " ".repeat(Math.max(1, 26 - rawMethods.length));
      console.log(`    ${pathCol} ${methodCol} ${chalk.dim(r.file)}`);
    }
    console.log();
  }

  if (pageRoutes.length > 0) {
    console.log(chalk.bold.underline(`  Page Routes (${pageRoutes.length})`));
    console.log();
    for (const r of pageRoutes) {
      const rawMethod = r.method;
      const formattedMethod = formatMethod(r.method);
      const pathCol =
        chalk.bold(r.path) + " ".repeat(Math.max(1, 30 - r.path.length));
      const methodCol =
        formattedMethod + " ".repeat(Math.max(1, 26 - rawMethod.length));
      console.log(`    ${pathCol} ${methodCol} ${chalk.dim(r.file)}`);
    }
    console.log();
  }
}
