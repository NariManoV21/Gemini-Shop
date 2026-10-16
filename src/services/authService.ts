/**
 * سرویس مدیریت پروفایل و احراز هویت خریداران فروشگاه Gemini Shop
 * ارتباط با وب‌سرویس جهت ارسال و اعتبارسنجی کد ۵ رقمی تأیید یکبارمصرف ایمیل (Gmail OTP)
 */

import { sanitizeInput, sanitizeMobile, sanitizeEmail } from '../lib/sanitize';
import { getStoredOrders, type StoreOrder } from './orderStorage';

export interface UserProfile {
  id: string;
  fullName: string;
  mobile: string;
  gmail: string;
  createdAt: string;
}

const AUTH_STORAGE_KEY = 'gemini_customer_profile_v1';
const API_BASE = window.location.hostname === 'localhost' ? 'http://localhost:3001/api' : '/api';

/**
 * دریافت مشخصات مشتری جاری از حافظه محلی
 */
export function getCurrentUser(): UserProfile | null {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error loading user profile:', err);
    return null;
  }
}

/**
 * ذخیره مشخصات کاربر در حافظه محلی و انتشار تغییرات در سراسر کامپوننت‌ها
 */
export function saveCurrentUser(user: UserProfile) {
  try {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
    window.dispatchEvent(new CustomEvent('gemini_auth_changed', { detail: user }));
  } catch (err) {
    console.error('Error saving user profile:', err);
  }
}

/**
 * درخواست ارسال کد تأیید یکبار مصرف ایمیلی (Email / Gmail OTP)
 */
export async function requestEmailOtp(
  email: string,
  fullName?: string,
  mobile?: string
): Promise<{
  success: boolean;
  message: string;
  cooldownSeconds?: number;
  simulationCode?: string;
  error?: string;
}> {
  const cleanEmail = sanitizeEmail(email);
  if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    return { success: false, message: '', error: 'لطفاً یک آدرس ایمیل معتبر (مثلاً yourname@gmail.com) وارد فرمایید.' };
  }

  try {
    const res = await fetch(`${API_BASE}/auth/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: cleanEmail,
        fullName: sanitizeInput(fullName || ''),
        mobile: sanitizeMobile(mobile || ''),
      }),
    });

    const data = await res.json();
    if (res.ok && data.success) {
      return {
        success: true,
        message: data.message || 'کد تأیید به ایمیل شما ارسال شد.',
        cooldownSeconds: data.cooldownSeconds || 60,
        simulationCode: data.simulationCode,
      };
    }
    return {
      success: false,
      message: '',
      error: data.error || 'خطا در ارسال کد تأیید ایمیلی. لطفاً مجدداً تلاش کنید.',
      cooldownSeconds: data.remainingSeconds,
    };
  } catch (err) {
    console.warn('Backend unavailable for OTP, using offline simulation fallback:', err);
    // در صورت میزبانی استاتیک روی GitHub Pages بدون سرور مجزا، شبیه‌ساز محلی کد را تولید می‌کند
    const fallbackCode = '12345';
    sessionStorage.setItem(`offline_otp_${cleanEmail}`, fallbackCode);
    return {
      success: true,
      message: 'کد تایید ایمیلی ارسال شد (کد تستی شبیه‌ساز: ۱۲۳۴۵).',
      cooldownSeconds: 60,
      simulationCode: fallbackCode,
    };
  }
}

/**
 * بررسی صحت کد تأیید ایمیل و ورود رسمی خریدار
 */
export async function verifyEmailOtp(
  email: string,
  code: string,
  fullName?: string,
  mobile?: string
): Promise<{
  success: boolean;
  user?: UserProfile;
  message?: string;
  error?: string;
}> {
  const cleanEmail = sanitizeEmail(email);
  const cleanCode = sanitizeInput(code).replace(/\D/g, '');

  try {
    const res = await fetch(`${API_BASE}/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: cleanEmail,
        code: cleanCode,
        fullName: sanitizeInput(fullName || ''),
        mobile: sanitizeMobile(mobile || ''),
      }),
    });

    const data = await res.json();
    if (res.ok && data.success) {
      const user: UserProfile = data.user;
      saveCurrentUser(user);
      return { success: true, user, message: data.message };
    }
    return { success: false, error: data.error || 'کد تایید وارد شده نادرست است.' };
  } catch (err) {
    console.warn('Backend unavailable, validating against offline simulation:', err);
    const saved = sessionStorage.getItem(`offline_otp_${cleanEmail}`);
    if (cleanCode === '12345' || (saved && saved === cleanCode)) {
      sessionStorage.removeItem(`offline_otp_${cleanEmail}`);
      const cleanMob = sanitizeMobile(mobile || '');
      const existing = getCurrentUser();
      const isSameUser = existing && (existing.gmail === cleanEmail || (cleanMob && existing.mobile === cleanMob));
      
      const user: UserProfile = isSameUser
        ? {
            ...existing,
            fullName: sanitizeInput(fullName || existing.fullName || 'کاربر گرامی'),
            mobile: cleanMob || existing.mobile || '',
            gmail: cleanEmail,
          }
        : {
            id: `cust_${cleanEmail.replace(/[^a-z0-9]/gi, '_').toLowerCase()}`,
            fullName: sanitizeInput(fullName || 'کاربر گرامی'),
            mobile: cleanMob,
            gmail: cleanEmail,
            createdAt: new Date().toISOString(),
          };
      saveCurrentUser(user);
      return { success: true, user, message: 'ورود با موفقیت انجام شد.' };
    }
    return { success: false, error: 'کد تایید وارد شده نادرست است (کد تستی آفلاین: ۱۲۳۴۵).' };
  }
}

/**
 * ورود یا ایجاد مستقیم پروفایل کاربری با نام، ایمیل و شماره موبایل
 * تضمین عدم ایجاد حساب تکراری برای یک خریدار
 */
export function loginOrRegisterCustomer(data: {
  fullName: string;
  gmail: string;
  mobile?: string;
}): UserProfile {
  const cleanName = sanitizeInput(data.fullName);
  const cleanGmail = sanitizeEmail(data.gmail);
  const cleanMobile = sanitizeMobile(data.mobile || '');

  // بررسی اکانت موجود برای جلوگیری از ایجاد اکانت تکراری
  const existing = getCurrentUser();
  if (existing && (existing.gmail === cleanGmail || (cleanMobile && existing.mobile === cleanMobile))) {
    const updated: UserProfile = {
      ...existing,
      fullName: cleanName || existing.fullName,
      mobile: cleanMobile || existing.mobile,
      gmail: cleanGmail || existing.gmail,
    };
    saveCurrentUser(updated);
    return updated;
  }

  // شناسه یکتا و پایدار بر پایه ایمیل یا موبایل
  const canonicalId = `cust_${(cleanGmail || cleanMobile).replace(/[^a-z0-9]/gi, '_').toLowerCase()}`;
  const user: UserProfile = {
    id: canonicalId,
    fullName: cleanName || 'کاربر گرامی',
    mobile: cleanMobile,
    gmail: cleanGmail,
    createdAt: new Date().toISOString(),
  };

  saveCurrentUser(user);
  return user;
}

/**
 * خروج مشتری از حساب کاربری
 */
export function logoutCustomer() {
  localStorage.removeItem(AUTH_STORAGE_KEY);
  window.dispatchEvent(new CustomEvent('gemini_auth_changed', { detail: null }));
}

/**
 * دریافت سابقه سفارشات متعلق به مشتری جاری (بر اساس ایمیل یا شماره موبایل)
 */
export function getCustomerOrders(identifier: string): StoreOrder[] {
  if (!identifier) return [];
  const cleanEmail = sanitizeEmail(identifier);
  const cleanMobile = sanitizeMobile(identifier);

  const allOrders = getStoredOrders();
  return allOrders.filter(
    (o) =>
      (cleanEmail && sanitizeEmail(o.gmail) === cleanEmail) ||
      (cleanMobile && sanitizeMobile(o.mobile) === cleanMobile)
  );
}

// توابع سازگاری گذشته (Backwards Compatibility)
export const requestSmsOtp = (mobileOrEmail: string) => requestEmailOtp(mobileOrEmail);
export const verifySmsOtp = (mobileOrEmail: string, code: string, fullName?: string, gmail?: string) =>
  verifyEmailOtp(gmail || mobileOrEmail, code, fullName, mobileOrEmail);
