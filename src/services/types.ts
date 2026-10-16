/** قراردادهای داده‌ی بین فرانت‌اند و (بک‌اند آینده). */
import type { Product } from '../config/site';

export interface OrderInput {
  productId: string;
  fullName: string;
  /** شماره موبایل یا ایمیل: حداقل یکی لازم است */
  contact: string;
}

export interface OrderResult {
  /** شماره‌ی پیگیری؛ در حالت نمایشی با پیشوند DEMO ساخته می‌شود */
  reference: string;
  status: 'demo_created';
  /** true یعنی هیچ پرداخت یا فعال‌سازی واقعی انجام نشده */
  isDemo: boolean;
}

export interface StoreApi {
  getProduct(): Promise<Product>;
  createOrder(input: OrderInput): Promise<OrderResult>;
}
