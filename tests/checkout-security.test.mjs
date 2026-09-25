import assert from 'node:assert/strict';
import { test } from 'node:test';
import { File } from 'node:buffer';
globalThis.File ??= File;
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';

const require = createRequire(import.meta.url);
// Execute the real TypeScript routes with isolated in-memory external services.
function loader(stubs = {}) {
  const cache = new Map();
  function load(name) {
    if (name in stubs) return stubs[name].default ? { __esModule: true, ...stubs[name] } : stubs[name];
    if (!name.startsWith('@/')) return require(name);
    if (cache.has(name)) return cache.get(name).exports;
    const source = readFileSync(`src/${name.slice(2)}.ts`, 'utf8');
    const code = ts.transpileModule(source, { compilerOptions: { esModuleInterop: true, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
    const loadedModule = { exports: {} };
    cache.set(name, loadedModule);
    vm.runInThisContext(`(function(require, module, exports) {${code}\n})`)(load, loadedModule, loadedModule.exports);
    return loadedModule.exports;
  }
  return load;
}

const quantities = loader()('@/lib/checkoutItems');
test('reject malformed items, nonpositive/fractional quantities and overflow', () => {
  for (const input of [null, {}, [], [null], [{ productId: '1', quantity: 1 }], ...[0, -1, 1.5, '2', Infinity, 2147483648].map(quantity => [{ productId: 1, quantity }])]) {
    assert.throws(() => quantities.normalizeCheckoutItems(input), quantities.InvalidCheckoutError);
  }
});
test('combine duplicate quantities and discard browser price/name', () => {
  const result = quantities.priceCheckoutItems([{ productId: 1, quantity: 2, price: 0, name: 'fake' }, { productId: 1, quantity: 3 }], [{ id: 1, name: 'Real', list_price: 100 }]);
  assert.deepEqual(result, [{ productId: 1, quantity: 5, name: 'Real', price: 100 }]);
  assert.throws(() => quantities.priceCheckoutItems([{ productId: 9, quantity: 1 }], []));
});

function fixture(provider, options = {}) {
  const events = [];
  let saved = null;
  const config = { id: 'config', enabled: true, discountPct: 10, categoryDiscounts: [], mpAccessToken: 'test', paywayPrivateKey: 'test', paywaySandbox: true };
  const db = {
    paymentMethodConfig: { findUnique: async () => config },
    user: { findUnique: async () => ({ role: options.role ?? 'admin' }) },
    order: {
      findUnique: async () => saved,
      create: async ({ data }) => {
        if (saved) throw new Error('duplicate');
        saved = { ...data, id: data.id ?? 'direct-order', status: data.status ?? 'pending' };
        events.push(['created', saved]);
        return saved;
      },
      update: async ({ data }) => {
        if (data.status === 'confirmed' && options.failConfirm) throw new Error('db unavailable');
        saved = { ...saved, ...data };
        events.push(['updated', data]);
        return saved;
      },
    },
    orderItem: { groupBy: async () => [] },
    $executeRaw: async () => {},
  };
  db.$transaction = async callback => callback(db);
  const createPayment = async args => {
    events.push(['charge', args]);
    assert.equal(saved.status, 'pending', 'must persist reservation before charge');
    return options.charge ?? { ok: true, id: 77, status: 'approved' };
  };
  const refund = async () => { events.push(['refund']); return { ok: !options.failRefund }; };
  const load = loader({
    'node:fs/promises': { mkdir: async () => {}, writeFile: async () => events.push(['proof']) },
    'next/cache': { revalidatePath: () => {} },
    '@/lib/adminLog': { logAdminAction: async () => {} },
    'next/server': { NextResponse: { json: (data, init) => Response.json(data, init) } },
    '@/lib/prisma': { prisma: db },
    '@/lib/auth': { auth: async () => ({ user: { id: 'user', role: 'admin' } }) },
    '@/lib/odoo': { executeKw: async (_model, _method, [ids]) => ids.map(id => ({ id, name: 'Real', list_price: 100, qty_available: options.stock ?? 10 })) },
    '@/lib/settings': {},
    '@/lib/shipping': { getShippingMethodsForPayment: async () => [{ id: 'shipping', name: 'Retiro', cost: 20, requiresAddress: false }] },
    '@/lib/categories': { resolveItemCategoryChains: async () => new Map() },
    '@/lib/coupons': { validateCoupon: async () => ({ ok: true, couponId: 'coupon', discountAmount: 5 }), registerCouponUse: async () => events.push(['coupon']) },
    '@/lib/orders': { resolvePartnerId: async () => { events.push(['partner']); if (options.failPartner) throw new Error('Odoo unavailable'); return 12; } },
    '@/lib/telegram': { notifyNewOrder: async args => events.push(['telegram', args]) },
    '@/lib/orderEmails': { sendOrderConfirmation: async args => events.push(['email', args]) },
    '@/lib/odooPicking': { createPickingForOrder: async id => events.push(['picking', id]) },
    '@/lib/mercadopago': { createMercadoPagoPayment: createPayment, refundMercadoPagoPayment: refund },
    '@/lib/payway': { createPaywayPayment: createPayment, refundPaywayPayment: refund },
  });
  const route = load(provider === 'direct' ? '@/app/api/orders/route' : `@/app/api/orders/${provider}/route`);
  const body = {
    checkoutId: '00000000-0000-4000-8000-000000000001',
    items: [{ productId: 1, quantity: 2, price: 0.01, name: 'fake' }],
    customer: { name: 'Cliente', email: 'test@example.com', phone: '123' },
    shippingMethodId: 'shipping', couponCode: 'TEST',
    mpToken: 'token', mpPaymentMethodId: 'visa', mpIdentification: { type: 'DNI', number: '123' },
    paywayToken: 'token', paywayBin: '123456', paywayPaymentMethodId: 1,
    paywayBillTo: { firstName: 'Cliente', street1: 'Calle', city: 'Ciudad', postalCode: '1234' },
  };
  return { events, db, load, body, route, saved: () => saved, post: () => route.POST(new Request('http://localhost/api/orders', { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } })) };
}

for (const provider of ['mercadopago', 'payway']) {
  test(`${provider}: authoritative price, reserve before charge, Odoo and notifications once`, async () => {
    const f = fixture(provider);
    assert.equal((await f.post()).status, 201);
    assert.equal(f.saved().total, 195); // 200 - 10% - coupon 5 + shipping 20
    assert.equal(f.saved().items.create[0].name, 'Real');
    assert.equal(f.events.find(([name]) => name === 'charge')[1].amount, 195);
    assert.equal(f.saved().status, 'confirmed');
    assert.equal((await f.post()).status, 201);
    for (const event of ['charge', 'picking', 'telegram', 'email']) assert.equal(f.events.filter(([name]) => name === event).length, 1, event);
  });
  test(`${provider}: Odoo partner failure never charges`, async () => {
    const f = fixture(provider, { failPartner: true });
    assert.equal((await f.post()).status, 502);
    assert.equal(f.events.some(([name]) => name === 'charge'), false);
  });
  test(`${provider}: repeated lines exceed stock and never charge`, async () => {
    const f = fixture(provider, { stock: 5 });
    f.body.items = [{ productId: 1, quantity: 4 }, { productId: 1, quantity: 4 }];
    assert.equal((await f.post()).status, 409);
    assert.equal(f.events.some(([name]) => name === 'charge'), false);
  });
  test(`${provider}: negative quantity rejected before charge`, async () => {
    const f = fixture(provider);
    f.body.items[0].quantity = -1;
    assert.equal((await f.post()).status, 400);
    assert.equal(f.events.some(([name]) => name === 'charge'), false);
  });
  test(`${provider}: uncertain payment retains reservation, blocks retry and sends no notices`, async () => {
    const f = fixture(provider, { charge: { ok: false, error: 'timeout', detail: 'timeout' } });
    const response = await f.post();
    assert.equal((await response.json()).requiresReview, true);
    assert.equal(f.saved().status, 'pending');
    assert.equal((await f.post()).status, 409);
    assert.equal(f.events.filter(([name]) => name === 'charge').length, 1);
    assert.equal(f.events.some(([name]) => ['picking', 'email', 'telegram'].includes(name)), false);
  });
  test(`${provider}: definitive rejection releases stock`, async () => {
    const f = fixture(provider, { charge: { ok: false, rejected: true, error: 'rechazado', detail: 'rejected' } });
    assert.equal((await f.post()).status, 402);
    assert.equal(f.saved().status, 'cancelled');
  });
  for (const failRefund of [true, false]) test(`${provider}: confirmation failure, refund ${failRefund ? 'pending' : 'successful'}`, async () => {
    const f = fixture(provider, { failConfirm: true, failRefund });
    const response = await f.post();
    const data = await response.json();
    assert.equal(response.status, 409);
    assert.equal(f.saved().status, failRefund ? 'pending' : 'cancelled');
    assert.equal(Boolean(data.requiresReview), failRefund);
    assert.equal(f.events.filter(([name]) => name === 'refund').length, 1);
    assert.equal(f.events.some(([name]) => name === 'picking'), false);
  });
}

test('stock transaction checks sum of repeated product lines independently of route', async () => {
  const f = fixture('payway', { stock: 5 });
  const { createOrderWithStockGuard, InsufficientStockError } = f.load('@/lib/reservations');
  await assert.rejects(createOrderWithStockGuard([{ productId: 1, quantity: 4, name: 'A' }, { productId: 1, quantity: 4, name: 'A' }], async () => { throw new Error('must not create'); }), InsufficientStockError);
});

test('demoted/deleted admin cannot mutate even with an old admin session', async () => {
  for (const user of [null, { role: 'customer' }]) {
    const load = loader({ '@/lib/auth': { auth: async () => ({ user: { id: 'old-admin', role: 'admin' } }) }, '@/lib/prisma': { prisma: { user: { findUnique: async () => user } } } });
    await assert.rejects(load('@/lib/adminAuth').requireAdmin(), /No autorizado/);
  }
});

for (const provider of ['mercadopago', 'payway']) {
  test(`${provider}: concurrent retries create one charge and one set of notices`, async () => {
    const f = fixture(provider);
    const responses = await Promise.all([f.post(), f.post()]);
    assert.ok(responses.some(response => response.status === 201));
    for (const event of ['charge', 'picking', 'telegram', 'email']) assert.equal(f.events.filter(([name]) => name === event).length, 1);
  });
}

test('cash delivery remains pending, sends notices and does not create an Odoo picking', async () => {
  const f = fixture('direct');
  const form = new FormData();
  form.set('items', JSON.stringify(f.body.items));
  form.set('customer', JSON.stringify(f.body.customer));
  form.set('paymentMethod', 'contra_entrega');
  form.set('shippingMethodId', 'shipping');
  const response = await f.route.POST(new Request('http://localhost/api/orders', { method: 'POST', body: form }));
  assert.equal(response.status, 201);
  assert.equal(f.saved().status, 'pending');
  assert.equal(f.saved().total, 200);
  assert.equal(f.events.some(([name]) => ['picking', 'charge'].includes(name)), false);
  for (const event of ['telegram', 'email']) assert.equal(f.events.filter(([name]) => name === event).length, 1);
});

test('malformed direct checkout returns 400', async () => {
  const f = fixture('direct');
  const form = new FormData();
  form.set('items', '{');
  const response = await f.route.POST(new Request('http://localhost/api/orders', { method: 'POST', body: form }));
  assert.equal(response.status, 400);
});

test('existing JWTs refresh roles and deleted accounts lose the session', async () => {
  for (const user of [null, { role: 'customer' }, { role: 'admin' }]) {
    let config;
    const load = loader({
      'next-auth': { default: value => { config = value; return {}; } },
      'next-auth/providers/credentials': { default: value => value },
      'next-auth/providers/google': { default: value => value },
      'bcryptjs': { default: {} },
      '@/lib/prisma': { prisma: { user: { findUnique: async () => user } } },
    });
    load('@/lib/auth');
    const token = await config.callbacks.jwt({ token: { id: 'user', role: 'admin' } });
    assert.deepEqual(token, user ? { id: 'user', role: user.role } : null);
  }
});

test('bank transfer keeps proof, stays pending and generates Odoo picking only on admin confirmation', async () => {
  const f = fixture('direct');
  const form = new FormData();
  form.set('items', JSON.stringify(f.body.items));
  form.set('customer', JSON.stringify(f.body.customer));
  form.set('paymentMethod', 'transferencia');
  form.set('shippingMethodId', 'shipping');
  form.set('comprobante', new File(['proof'], 'receipt.pdf', { type: 'application/pdf' }));
  const response = await f.route.POST(new Request('http://localhost/api/orders', { method: 'POST', body: form }));
  assert.equal(response.status, 201);
  assert.equal(f.saved().status, 'pending');
  assert.match(f.saved().transferProofUrl, /^\/api\/uploads\/comprobantes\/.+\.pdf$/);
  assert.equal(f.events.some(([name]) => name === 'picking'), false);
  await f.load('@/app/admin/(dashboard)/ventas/actions').changeOrderStatus(f.saved().id, 'confirmed');
  assert.equal(f.saved().status, 'confirmed');
  for (const event of ['picking', 'telegram', 'email', 'proof']) assert.equal(f.events.filter(([name]) => name === event).length, 1);
});
