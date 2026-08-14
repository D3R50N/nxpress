import path from "path";
import fs from "fs";
import { createJiti } from "jiti";
import { logger } from "./logger";

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

export function loadConfigFile(rootDir: string): Record<string, any> {
  const jitiLoader = getJitiLoader(rootDir);
  const jsonConfig = path.join(rootDir, "nxpress.config.json");
  if (fs.existsSync(jsonConfig)) {
    try {
      delete require.cache[jsonConfig];
      return JSON.parse(fs.readFileSync(jsonConfig, "utf8"));
    } catch (e) {
      logger.warn("Failed to parse nxpress.config.json");
    }
  }

  const jsConfigCandidates = [
    path.join(rootDir, "nxpress.config.js"),
    path.join(rootDir, "nxpress.config.ts"),
    path.join(rootDir, "nxpress.config.mjs"),
    path.join(rootDir, "nxpress.config.cjs"),
  ];

  for (const jsConfig of jsConfigCandidates) {
    if (fs.existsSync(jsConfig)) {
      try {
        try {
          delete require.cache[require.resolve(jsConfig)];
        } catch (e) {}
        try {
          delete require.cache[jsConfig];
        } catch (e) {}
        try {
          delete require.cache[fs.realpathSync(jsConfig)];
        } catch (e) {}

        const loaded = jitiLoader(jsConfig);
        return loaded.default || loaded;
      } catch (e) {
        logger.warn(`Failed to load ${path.basename(jsConfig)}`);
      }
    }
  }

  return {};
}
