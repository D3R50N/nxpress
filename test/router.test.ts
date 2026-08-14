import assert from 'assert';
import path from 'path';
import fs from 'fs';
import { fileToRoutePath, findLayoutsForRoute, getRouteMiddlewares } from '../src/router';
import { builtinHelpers, renderMetaTags, injectMetadata } from '../src/helpers';
import { renderComponent, registerComponents } from '../src/components';
import { getFilteredEnv } from '../src/env';

console.log('Testing fileToRoutePath (TypeScript)...');

assert.strictEqual(fileToRoutePath('index.hbs'), '/');
assert.strictEqual(fileToRoutePath('about.hbs'), '/about');
assert.strictEqual(fileToRoutePath('users/index.hbs'), '/users');
assert.strictEqual(fileToRoutePath('users/[id].hbs'), '/users/:id');
assert.strictEqual(fileToRoutePath('blog/[...slug].hbs'), '/blog/*slug');
assert.strictEqual(fileToRoutePath('api/health.ts'), '/api/health');
assert.strictEqual(fileToRoutePath('(auth)/login.ejs'), '/login');
assert.strictEqual(fileToRoutePath('(auth)/register/index.ejs'), '/register');
assert.strictEqual(fileToRoutePath('admin/(dashboard)/analytics/[id].ejs'), '/admin/analytics/:id');
assert.strictEqual(fileToRoutePath('(marketing)/(public)/about.njk'), '/about');

console.log('Testing findLayoutsForRoute...');
const exampleEjsDir = path.resolve('./example/ejs/app');
const layouts = findLayoutsForRoute(path.resolve('./example/ejs'), exampleEjsDir, 'index.ejs', 'ejs');
assert.strictEqual(layouts.length > 0, true);

console.log('Testing builtinHelpers...');
assert.strictEqual(builtinHelpers.cn('px-2 py-1', false && 'hidden', 'px-4'), 'py-1 px-4');
assert.ok(builtinHelpers.icon('user', 'w-5 h-5').includes('<svg'));
assert.ok(builtinHelpers.I('sun', 'w-4 h-4').includes('<path'));
assert.strictEqual(builtinHelpers.str({ a: 1 }), '{"a":1}');
assert.strictEqual(builtinHelpers.str(42), '42');
assert.deepStrictEqual(builtinHelpers.json('{"x":10}'), { x: 10 });
assert.strictEqual(builtinHelpers.lower('HELLO'), 'hello');
assert.strictEqual(builtinHelpers.upper('hello'), 'HELLO');
assert.strictEqual(builtinHelpers.capitalize('hello'), 'Hello');
assert.strictEqual(builtinHelpers.len([1, 2, 3]), 3);
assert.strictEqual(builtinHelpers.add(5, 3), 8);
assert.strictEqual(builtinHelpers.ternary(true, 'yes', 'no'), 'yes');
assert.strictEqual(builtinHelpers.eq(5, 5), true);
assert.strictEqual(builtinHelpers.ne(5, 10), true);
const metaHtml = renderMetaTags({
  title: 'My Title',
  description: 'My Description',
  openGraph: { title: 'OG Title', image: '/og.png' }
});
assert.ok(metaHtml.includes('<title>My Title</title>'));
assert.ok(metaHtml.includes('content="My Description"'));
assert.ok(metaHtml.includes('property="og:title" content="OG Title"'));
assert.ok(metaHtml.includes('property="og:image" content="/og.png"'));
assert.strictEqual(renderMetaTags(metaHtml), metaHtml);
assert.strictEqual(renderMetaTags(undefined), '');
const injectedHtml = injectMetadata('<html><head></head><body></body></html>', metaHtml);
assert.ok(injectedHtml.includes('<title>My Title</title>'));
assert.ok(injectedHtml.includes('</head>'));
// No duplicate injection if already present
const doubleInjected = injectMetadata(injectedHtml, metaHtml);
assert.strictEqual(doubleInjected, injectedHtml);

console.log('Testing case-insensitive renderComponent...');
const exampleComponentsDir = path.resolve('./example/ejs/components');
registerComponents(exampleComponentsDir);
const compUpper = renderComponent('ProductCard', { G: { currency: '€' }, product: { name: 'Test', price: 100, category: 'Cat', description: 'Desc', id: 1 } });
const compLower = renderComponent('productcard', { G: { currency: '€' }, product: { name: 'Test', price: 100, category: 'Cat', description: 'Desc', id: 1 } });
assert.strictEqual(compUpper, compLower);

console.log('Testing getFilteredEnv...');
process.env.SECRET_KEY = 'secret123';
process.env.PUBLIC_API_URL = 'https://api.example.com';
const fullEnv = getFilteredEnv(false);
const secureEnv = getFilteredEnv();
assert.strictEqual(fullEnv.SECRET_KEY, 'secret123');
assert.strictEqual(secureEnv.SECRET_KEY, undefined);
assert.strictEqual(secureEnv.PUBLIC_API_URL, 'https://api.example.com');
assert.strictEqual(secureEnv.NODE_ENV, process.env.NODE_ENV);

console.log('Testing executeMiddlewareList (auto next & auto response)...');
import { executeMiddlewareList } from '../src/router';

async function testExecuteMw() {
  let step = 0;
  const req: any = { path: '/test' };
  const res: any = { headersSent: false };

  // 1. Auto next when no next() called
  await executeMiddlewareList([
    () => { step += 1; },
    () => { step += 10; }
  ], req, res, (() => {}) as any);
  assert.strictEqual(step, 11);

  // 2. Auto return object as res.json
  let sentJson: any = null;
  const resJson: any = {
    headersSent: false,
    json(data: any) { sentJson = data; this.headersSent = true; }
  };
  await executeMiddlewareList([
    () => ({ ok: true })
  ], req, resJson, (() => {}) as any);
  assert.deepStrictEqual(sentJson, { ok: true });

  // 3. Strict middleware & middlewares validation
  assert.throws(() => {
    getRouteMiddlewares({ middleware: [() => {}] });
  }, /cannot be an Array/);

  assert.throws(() => {
    getRouteMiddlewares({ middlewares: () => {} });
  }, /cannot be a function/);

  // 4. Test getJitiLoader with tsconfig path aliases
  const { getJitiLoader } = await import('../src/router');
  const loader = getJitiLoader(path.resolve('.'));
  assert.ok(loader);

  // 5. Test exportStatic (SSG)
  const { exportStatic } = await import('../src/export');
  const outDir = path.resolve('./example/ejs/out');
  const exportRes = await exportStatic({
    rootDir: path.resolve('./example/ejs'),
    outDir,
    tailwind: false,
  });
  assert.ok(exportRes.exportedFiles.length > 0);
  assert.ok(fs.existsSync(path.join(outDir, 'index.html')));
  // 6. Test i18n translation & detection
  const { translate, detectLocale } = await import('../src/i18n');
  const translations = {
    fr: { welcome: 'Bienvenue {{name}} !', auth: { login: 'Connexion' } },
    en: { welcome: 'Welcome {{name}}!', auth: { login: 'Log in' } },
  };
  const tFr = translate(translations, 'fr', 'fr', 'welcome', { name: 'Alice' });
  assert.strictEqual(tFr, 'Bienvenue Alice !');
  const tEnNested = translate(translations, 'en', 'fr', 'auth.login');
  assert.strictEqual(tEnNested, 'Log in');
  const tFallback = translate(translations, 'en', 'fr', 'missing.key');
  assert.strictEqual(tFallback, 'missing.key');

  assert.strictEqual(builtinHelpers.tr('test.key'), 'test.key');

  const detQuery = detectLocale({ query: { lang: 'en' }, path: '/about', headers: {}, cookies: {} } as any, {
    locales: ['fr', 'en'],
    defaultLocale: 'fr',
  });
  assert.strictEqual(detQuery.locale, 'en');

  // Test cookie detection without query param
  const detCookie = detectLocale({ path: '/about', headers: { cookie: 'lang=en; other=123' }, cookies: {} } as any, {
    locales: ['fr', 'en'],
    defaultLocale: 'fr',
  });
  assert.strictEqual(detCookie.locale, 'en');

  // Test URL path prefix taking priority over cookie
  const detPrefix = detectLocale({ path: '/en', headers: { cookie: 'lang=fr' }, cookies: {} } as any, {
    locales: ['fr', 'en'],
    defaultLocale: 'fr',
  });
  assert.strictEqual(detPrefix.locale, 'en');
  assert.strictEqual(detPrefix.isPrefixed, true);
  assert.strictEqual(detPrefix.pathname, '/');

  const detPrefixSub = detectLocale({ path: '/en/products', headers: { cookie: 'lang=fr' }, cookies: {} } as any, {
    locales: ['fr', 'en'],
    defaultLocale: 'fr',
  });
  assert.strictEqual(detPrefixSub.locale, 'en');
  assert.strictEqual(detPrefixSub.isPrefixed, true);
  assert.strictEqual(detPrefixSub.pathname, '/products');

}

testExecuteMw().then(() => {
  console.log('✅ All TS router path, export, i18n and helper tests passed!');
});


