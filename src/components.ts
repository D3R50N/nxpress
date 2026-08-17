import fs from "fs";
import path from "path";
import { globSync } from "glob";
import hbs from "hbs";
import { Eta } from "eta";
import nunjucks from "nunjucks";
import { Liquid } from "liquidjs";
import { logger } from "./logger";
import { getFilesPattern } from "./router";
import { builtinHelpers, ejsToEta } from "./helpers";
import { isDevMode } from "./env";

const etaEngine = new Eta({
  useWith: true,
});
const liquidEngine = new Liquid();

export interface ComponentOptions {
  engine?: string;
  isDev?: boolean;
}

export interface ComponentDefinition {
  name: string;
  extension: string;
  content: string;
  compile: (props: Record<string, any>) => string;
}

const componentRegistry = new Map<string, ComponentDefinition>();
let lastComponentsDir: string | null = null;
let lastComponentOptions: ComponentOptions = {};

/**
 * Renders a registered component template by name with provided props (case-insensitive).
 */
export function renderComponent(
  name: string,
  props: Record<string, any> = {},
  locals: Record<string, any> = {},
): string {
  // In development mode, auto re-register components to guarantee fresh content
  if (lastComponentsDir && isDevMode(lastComponentOptions)) {
    registerComponents(lastComponentsDir, lastComponentOptions);
  }

  const mergedProps = { ...builtinHelpers, ...locals, ...props };
  const lowerName = name.toLowerCase();
  const comp = componentRegistry.get(lowerName);

  if (comp) {
    try {
      return comp.compile(mergedProps);
    } catch (err) {
      logger.error(`Error rendering component "${name}":`, err);
      return `<div style="color:#f00">Error rendering component "${name}"</div>`;
    }
  }

  // Fallback check in Handlebars partials
  const partialKey = Object.keys(hbs.handlebars.partials).find(
    (k) => k.toLowerCase() === lowerName,
  );
  if (partialKey) {
    const partial = hbs.handlebars.partials[partialKey];
    const template =
      typeof partial === "function" ? partial : hbs.handlebars.compile(partial);
    return template(mergedProps);
  }

  logger.warn(`Component "${name}" not found.`);
  return `<div style="color:#f00">Component "${name}" not found</div>`;
}

// Universal Handlebars helper '$'
hbs.registerHelper("$", function (name: string, ...args: any[]) {
  const options = args[args.length - 1];
  let props: Record<string, any> = {};

  if (args.length > 1 && typeof args[0] === "object" && args[0] !== null) {
    props = { ...args[0] };
  }

  if (options && options.hash) {
    props = { ...props, ...options.hash };
  }

  const html = renderComponent(name, props);
  return new hbs.handlebars.SafeString(html);
});

/**
 * Automatically registers all templates in componentsDir for all supported extensions.
 */
export function registerComponents(
  componentsDir: string,
  options: ComponentOptions = {},
): void {
  lastComponentsDir = componentsDir;
  lastComponentOptions = options;

  if (!fs.existsSync(componentsDir)) {
    componentRegistry.clear();
    return;
  }

  // Clear existing registry to prevent stale components
  componentRegistry.clear();

  // Reset Handlebars partials
  for (const k of Object.keys(hbs.handlebars.partials)) {
    delete hbs.handlebars.partials[k];
  }

  // Reset Eta template cache
  if ((etaEngine as any).templatesSync && (etaEngine as any).templatesSync.cache) {
    (etaEngine as any).templatesSync.cache = {};
  }

  const files = globSync(getFilesPattern(options.engine), {
    cwd: componentsDir,
  });

  files.forEach((file) => {
    const fullPath = path.join(componentsDir, file);
    const ext = path.extname(file).toLowerCase();
    const componentName = file.replace(/\.[^.]+$/, "").replace(/\\/g, "/");
    const lowerKey = componentName.toLowerCase();
    const content = fs.readFileSync(fullPath, "utf8");

    let compileFn: (props: Record<string, any>) => string;

    if (ext === ".ejs") {
      const convertedContent = ejsToEta(content);
      compileFn = (props) => etaEngine.renderString(convertedContent, props);
    } else if (ext === ".njk" || ext === ".nunjucks") {
      compileFn = (props) => nunjucks.renderString(content, props);
    } else if (ext === ".liquid") {
      compileFn = (props) => liquidEngine.parseAndRenderSync(content, props);
    } else {
      // Default to Handlebars compilation
      const compiled = hbs.handlebars.compile(content);
      compileFn = (props) => compiled(props);
    }

    hbs.registerPartial(componentName, content);
    if (lowerKey !== componentName) {
      hbs.registerPartial(lowerKey, content);
    }

    componentRegistry.set(lowerKey, {
      name: componentName,
      extension: ext,
      content,
      compile: compileFn,
    });

    // Register direct Handlebars helper if name has no subfolder slashes
    if (!componentName.includes("/")) {
      hbs.registerHelper(componentName, function (options: any) {
        const props = options && options.hash ? options.hash : {};
        const html = renderComponent(componentName, props);
        return new hbs.handlebars.SafeString(html);
      });
      if (lowerKey !== componentName.toLowerCase()) {
        hbs.registerHelper(lowerKey, function (options: any) {
          const props = options && options.hash ? options.hash : {};
          const html = renderComponent(componentName, props);
          return new hbs.handlebars.SafeString(html);
        });
      }
    }
  });
}
