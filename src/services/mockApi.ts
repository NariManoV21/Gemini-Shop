/**
 * پیاده‌سازی نمایشی StoreApi.
 * فقط داده‌ی config رو برمی‌گردونه و سفارش واقعی نمی‌سازه، پرداختی انجام نمی‌ده و اشتراکی فعال نمی‌کنه.
 */
import { PRODUCT } from '../config/site';
import type { OrderInput, OrderResult, StoreApi } from './types';

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const mockApi: StoreApi = {
  async getProduct() {
    await wait(120);
    return { ...PRODUCT };
  },
  async createOrder(input: OrderInput): Promise<OrderResult> {
    await wait(700);
    if (input.productId !== PRODUCT.id) throw new Error('محصول معتبر نیست.');
    const reference = `DEMO-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    return { reference, status: 'demo_created', isDemo: true };
  },
};
