import http from "http";
import assert from "assert";
import path from "path";
import { serve } from "../src/server";

const PORT_EJS = 4568;

const ejsDir = path.join(__dirname, "../example/ejs");

const ejsServer = serve({
  port: PORT_EJS,
  rootDir: ejsDir,
  engine: "ejs",
  tailwind: false,
  isDev: true,
  globals: {
    siteName: "Nexpress EJS Store",
    author: "Nexpress Team",
  },
});

function fetchUrl(
  port: number,
  urlPath: string,
): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    http
      .get(`http://localhost:${port}${urlPath}`, (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () =>
          resolve({ status: res.statusCode || 500, body: data }),
        );
      })
      .on("error", reject);
  });
}

function postRequest(
  port: number,
  urlPath: string,
  data: string,
  headers: Record<string, string> = {},
): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      `http://localhost:${port}${urlPath}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Content-Length": Buffer.byteLength(data),
          ...headers,
        },
      },
      (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => resolve({ status: res.statusCode || 500, body }));
      },
    );
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

async function runTests() {
  try {
    console.log("Running TS integration tests...");

    // 1. Test EJS Homepage
    const homeEjs = await fetchUrl(PORT_EJS, "/");
    assert.strictEqual(homeEjs.status, 200);
    assert.ok(homeEjs.body.includes("__nxpress_live_reload__"));
    console.log("✅ EJS Homepage & Live Reload Injection test passed!");

    // 2. Test 404 page & injection
    const notFound = await fetchUrl(PORT_EJS, "/non-existent-page-123");
    assert.strictEqual(notFound.status, 404);
    assert.ok(notFound.body.includes("404"));
    assert.ok(notFound.body.includes("__nxpress_live_reload__"));
    console.log("✅ Injected 404 Page test passed!");

    // 3. Test invalid engine error
    assert.throws(() => {
      serve({ port: 9999, engine: "pug" as any });
    }, /Unsupported template engine/);
    console.log("✅ Unsupported engine validation test passed!");

    console.log("\n🎉 ALL INTEGRATION TESTS PASSED SUCCESSFULLY!");
  } catch (err) {
    console.error("❌ Integration test failed:", err);
    process.exitCode = 1;
  } finally {
    ejsServer.close(() => {
      process.exit(0);
    });
  }
}

setTimeout(runTests, 500);
