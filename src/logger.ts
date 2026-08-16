import chalk from "chalk";
import { isDevMode, DevCheckOptions } from "./env";

const PREFIX = chalk.cyan.bold("[Nxpress]");

let lastLogKey = "";

function logDeduplicated(key: string, printNew: () => void) {
  if (key === lastLogKey) {
    return;
  }
  lastLogKey = key;
  printNew();
}

export function formatMethod(method: string): string {
  switch (method.toUpperCase()) {
    case "GET":
      return chalk.cyan.bold("GET");
    case "POST":
      return chalk.green.bold("POST");
    case "PUT":
      return chalk.yellow.bold("PUT");
    case "DELETE":
      return chalk.red.bold("DELETE");
    case "PATCH":
      return chalk.magenta.bold("PATCH");
    case "HEAD":
      return chalk.blue.bold("HEAD");
    case "OPTIONS":
      return chalk.gray.bold("OPTIONS");
    default:
      return chalk.bold(method.toUpperCase());
  }
}

export function formatStatus(status: number): string {
  if (status >= 200 && status < 300) return chalk.green.bold(status);
  if (status >= 300 && status < 400) return chalk.cyan.bold(status);
  if (status >= 400 && status < 500) return chalk.yellow.bold(status);
  if (status >= 500) return chalk.red.bold(status);
  return chalk.bold(String(status));
}

export function formatDuration(duration: number): string {
  if (duration > 1000) return chalk.red.bold(`${duration}ms`);
  if (duration > 300) return chalk.yellow(`${duration}ms`);
  return chalk.dim(`${duration}ms`);
}

export function createDevHttpLogger() {
  return (req: any, res: any, next: any) => {
    if (req.path === "/nxpress/live-reload" || req.url === "/nxpress/live-reload") {
      return next();
    }
    const start = Date.now();
    res.on("finish", () => {
      const duration = Date.now() - start;
      const method = chalk.magenta.bold(`[${(req.method || "GET").toUpperCase()}]`);
      const route = req.originalUrl || req.url;
      const status = formatStatus(res.statusCode || 200);
      const time = chalk.blue(`${duration}ms`);
      console.log(`${method} ${route} ${status} in ${time}`);
    });
    next();
  };
}

export const logger = {
  prefix: PREFIX,

  info(...args: any[]): void {
    const message = args.join(" ");
    const key = `info:${message}`;
    logDeduplicated(key, () => console.log(PREFIX, chalk.cyan(message)));
  },

  success(...args: any[]): void {
    const message = args.join(" ");
    const key = `success:${message}`;
    logDeduplicated(key, () => console.log(PREFIX, chalk.green(message)));
  },

  warn(...args: any[]): void {
    const message = args.join(" ");
    const key = `warn:${message}`;
    logDeduplicated(key, () => console.warn(PREFIX, chalk.yellow(message)));
  },

  error(...args: any[]): void {
    const message = args.join(" ");
    const key = `error:${message}`;
    logDeduplicated(key, () => console.error(PREFIX, chalk.red(message)));
  },

  log(...args: any[]): void {
    const message = args.join(" ");
    const key = `log:${message}`;
    logDeduplicated(key, () => console.log(PREFIX, ...args));
  },

  serverRunning(port: number, options?: DevCheckOptions): void {
    lastLogKey = "";
    if (!isDevMode(options)) {
      console.log(`${PREFIX} ${chalk.green("Server running")}`);
      return;
    }
    console.log(
      `${PREFIX} ${chalk.green("Server running at")} ${chalk.underline(`http://localhost:${port}`)}`,
    );
    console.log(
      `${PREFIX} ${chalk.dim("Press 'r' to restart server manually")}`,
    );
  },
};
