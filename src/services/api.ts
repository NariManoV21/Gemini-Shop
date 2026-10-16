/**
 * نقطه‌ی ورود لایه‌ی سرویس.
 * کامپوننت‌ها فقط از `api` استفاده می‌کنن؛ برای اتصال بک‌اند کافیه یک پیاده‌سازی HTTP از StoreApi
 * بنویسید و اینجا جایگزین mockApi کنید. بقیه‌ی UI تغییر نمی‌کنه.
 */
import { mockApi } from './mockApi';
import type { StoreApi } from './types';

export const api: StoreApi = mockApi;
export type { OrderInput, OrderResult } from './types';
