/**
 * سرویس ذخیره‌سازی و مدیریت سفارشات فروشگاه.
 * از localStorage به عنوان دیتابیس لوکال استفاده می‌کنه تا سفارشات، وضعیت تأیید واریز «بزن به کارت»
 * و قفل یا باز بودن لینک فعال‌سازی به‌صورت دائم و بدون نیاز به سرور پیچیده ذخیره بمونن.
 */

export interface StoreOrder {
  id: string; // e.g. "GP-742195"
  createdAt: string; // ISO date
  fullName: string;
  mobile: string;
  gmail: string; // ایمیل شخصی جیمیل که اشتراک روش فعال میشه
  productName: string;
  amountToman: number;
  paymentMethod: 'bezanbekart' | 'card_to_card';
  paymentRef: string; // شماره پیگیری یا فیش واریز مشتری
  status: 'pending_verification' | 'approved' | 'rejected';
  activationLink?: string; // لینک فعال‌سازی اختصاصی گوگل (تنها پس از تأیید واریز توسط ادمین در دسترس است)
  adminNotes?: string;
  approvedAt?: string;
}

const STORAGE_KEY = 'gemini_pro_orders_v1';

export function getStoredOrders(): StoreOrder[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (e) {
    console.error('Error reading orders from localStorage', e);
    return [];
  }
}

export function saveStoredOrders(orders: StoreOrder[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(orders));
    window.dispatchEvent(new CustomEvent('gemini_orders_updated', { detail: orders }));
  } catch (e) {
    console.error('Error writing orders to localStorage', e);
  }
}

export function createStoreOrder(data: {
  fullName: string;
  mobile: string;
  gmail: string;
  productName: string;
  amountToman: number;
  paymentMethod: 'bezanbekart' | 'card_to_card';
  paymentRef: string;
}): StoreOrder {
  // ساخت کد رهگیری ۶ رقمی رندوم شیک
  const randomNum = Math.floor(100000 + Math.random() * 900000);
  const id = `GP-${randomNum}`;

  const newOrder: StoreOrder = {
    id,
    createdAt: new Date().toISOString(),
    fullName: data.fullName,
    mobile: data.mobile,
    gmail: data.gmail,
    productName: data.productName,
    amountToman: data.amountToman,
    paymentMethod: data.paymentMethod,
    paymentRef: data.paymentRef,
    status: 'pending_verification', // در ابتدا قفل و در انتظار بررسی واریز
  };

  const existing = getStoredOrders();
  saveStoredOrders([newOrder, ...existing]);
  return newOrder;
}

export function getOrderById(id: string): StoreOrder | undefined {
  const cleanId = id.trim().toUpperCase();
  const orders = getStoredOrders();
  return orders.find((o) => o.id.toUpperCase() === cleanId);
}

export function findOrders(query: string): StoreOrder[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const orders = getStoredOrders();
  return orders.filter(
    (o) =>
      o.id.toLowerCase().includes(q) ||
      o.mobile.replace(/\s+/g, '').includes(q) ||
      o.gmail.toLowerCase().includes(q)
  );
}

export function approveOrder(
  orderId: string,
  customLink?: string,
  adminNotes?: string
): StoreOrder | null {
  const orders = getStoredOrders();
  const idx = orders.findIndex((o) => o.id.toUpperCase() === orderId.trim().toUpperCase());
  if (idx === -1) return null;

  // لینک رسمی اختصاصی فعال‌سازی گوگل (دعوت‌نامه رسمی)
  const defaultLink = `https://one.google.com/promo/google-ai-pro-invite?order=${orders[idx].id}&account=${encodeURIComponent(orders[idx].gmail)}`;

  const updated: StoreOrder = {
    ...orders[idx],
    status: 'approved',
    activationLink: customLink?.trim() || defaultLink,
    adminNotes: adminNotes || 'واریز بررسی و تأیید گردید.',
    approvedAt: new Date().toISOString(),
  };

  orders[idx] = updated;
  saveStoredOrders(orders);
  return updated;
}

export function rejectOrder(orderId: string, adminNotes?: string): StoreOrder | null {
  const orders = getStoredOrders();
  const idx = orders.findIndex((o) => o.id.toUpperCase() === orderId.trim().toUpperCase());
  if (idx === -1) return null;

  const updated: StoreOrder = {
    ...orders[idx],
    status: 'rejected',
    adminNotes: adminNotes || 'فیش واریزی معتبر نبود یا مبلغ همخوانی نداشت.',
  };

  orders[idx] = updated;
  saveStoredOrders(orders);
  return updated;
}

export function deleteOrder(orderId: string): boolean {
  const orders = getStoredOrders();
  const filtered = orders.filter((o) => o.id.toUpperCase() !== orderId.trim().toUpperCase());
  if (filtered.length === orders.length) return false;
  saveStoredOrders(filtered);
  return true;
}
