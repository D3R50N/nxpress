#!/usr/bin/env node

import { Command } from "commander";
import path from "path";
import fs from "fs";
import { serve, NxpressServerOptions } from "../server";
import { logger } from "../logger";

function getNxpressVersion(): string {
  try {
    const candidates = [
      path.resolve(__dirname, "../package.json"),
      path.resolve(__dirname, "../../package.json"),
    ];
    for (const file of candidates) {
      if (fs.existsSync(file)) {
        const pkg = JSON.parse(fs.readFileSync(file, "utf8"));
        if (pkg.version) {
          return pkg.version;
        }
      }
    }
  } catch (e) {}
  return "1.0.0";
}

const program = new Command();

program
  .name("nxpress")
  .description(
    "Next.js-like Express framework with file routing & template components",
  )
  .version(getNxpressVersion(), "-v, --version");

import { loadConfigFile } from "../config";

function resolveServerOptions(
  cmdOptions: Record<string, any>,
): NxpressServerOptions {
  const rootDir = cmdOptions.rootDir
    ? path.resolve(cmdOptions.rootDir)
    : process.cwd();
  const fileConfig = loadConfigFile(rootDir);

  const engine = cmdOptions.engine || fileConfig.engine || "ejs";
  const port = cmdOptions.port
    ? parseInt(cmdOptions.port, 10)
    : fileConfig.port || 3000;

  return {
    rootDir,
    port,
    engine,
    appDir: cmdOptions.appDir
      ? path.resolve(rootDir, cmdOptions.appDir)
      : fileConfig.appDir,
    componentsDir: cmdOptions.componentsDir
      ? path.resolve(rootDir, cmdOptions.componentsDir)
      : fileConfig.componentsDir,
    publicDir: cmdOptions.publicDir
      ? path.resolve(rootDir, cmdOptions.publicDir)
      : fileConfig.publicDir,
    tailwind: cmdOptions.tailwind ?? fileConfig.tailwind ?? true,
    globals: fileConfig.globals || {},
  };
}

program
  .command("dev")
  .description("Start the development server with live reloader")
  .option("-p, --port <number>", "Port number")
  .option("-e, --engine <engine>", "Template engine (hbs, ejs, html)")
  .option("-a, --app-dir <dir>", "Custom app directory")
  .option("-c, --components-dir <dir>", "Custom components directory")
  .option("--public-dir <dir>", "Custom public directory")
  .option("-r, --root-dir <dir>", "Custom root directory")
  .option("-t, --tailwind", "Enable automatic Tailwind CSS compilation")
  .action((cmdOptions) => {
    const options = resolveServerOptions(cmdOptions);
    options.isDev = true;
    serve(options);
  });

program
  .command("start")
  .description("Start the production server")
  .option("-p, --port <number>", "Port number")
  .option("-e, --engine <engine>", "Template engine (hbs, ejs, html)")
  .option("-a, --app-dir <dir>", "Custom app directory")
  .option("-c, --components-dir <dir>", "Custom components directory")
  .option("--public-dir <dir>", "Custom public directory")
  .option("-r, --root-dir <dir>", "Custom root directory")
  .action((cmdOptions) => {
    const options = resolveServerOptions(cmdOptions);
    options.isDev = false;
    serve(options);
  });

import { exportStatic } from "../export";
import { printRoutes } from "../routes";

program
  .command("export")
  .description("Export the application to static HTML and assets (SSG)")
  .option("-o, --out-dir <dir>", "Output directory (default: out)")
  .option("-e, --engine <engine>", "Template engine (hbs, ejs, html, nunjucks, liquid)")
  .option("-a, --app-dir <dir>", "Custom app directory")
  .option("-c, --components-dir <dir>", "Custom components directory")
  .option("--public-dir <dir>", "Custom public directory")
  .option("-r, --root-dir <dir>", "Custom root directory")
  .option("--no-tailwind", "Disable Tailwind CSS compilation")
  .action(async (cmdOptions) => {
    const rootDir = cmdOptions.rootDir
      ? path.resolve(cmdOptions.rootDir)
      : process.cwd();
    await exportStatic({
      rootDir,
      outDir: cmdOptions.outDir,
      engine: cmdOptions.engine,
      appDir: cmdOptions.appDir,
      componentsDir: cmdOptions.componentsDir,
      publicDir: cmdOptions.publicDir,
      tailwind: cmdOptions.tailwind,
    });
  });

program
  .command("routes")
  .description("Display all generated application and API routes")
  .option("-a, --app-dir <dir>", "Custom app directory")
  .option("-r, --root-dir <dir>", "Custom root directory")
  .option("-e, --engine <engine>", "Template engine (hbs, ejs, html, nunjucks, liquid)")
  .action((cmdOptions) => {
    const rootDir = cmdOptions.rootDir
      ? path.resolve(cmdOptions.rootDir)
      : process.cwd();
    printRoutes({
      rootDir,
      appDir: cmdOptions.appDir,
      engine: cmdOptions.engine,
    });
  });

program.parse(process.argv);

