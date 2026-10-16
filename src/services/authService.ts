/**
 * سرویس مدیریت پروفایل و احراز هویت خریداران فروشگاه Gemini Pro
 * ذخیره‌سازی امن مشخصات مشتری، ارتباط با وب‌سرویس پیامکی sms.ir جهت ارسال و اعتبارسنجی OTP
 */

import { sanitizeInput, sanitizeMobile, sanitizeEmail, isValidIranianMobile } from '../lib/sanitize';
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
 * دریافت مشخصات مشتری جاری
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
 * ذخیره مشخصات کاربر در حافظه محلی و انتشار تغییرات
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
 * درخواست ارسال کد تأیید یکبار مصرف پیامکی (OTP)
 */
export async function requestSmsOtp(mobile: string): Promise<{
  success: boolean;
  message: string;
  cooldownSeconds?: number;
  simulationCode?: string;
  error?: string;
}> {
  const cleanMobile = sanitizeMobile(mobile);
  if (!isValidIranianMobile(cleanMobile)) {
    return { success: false, message: '', error: 'شماره موبایل وارد شده باید ۱۱ رقم و با ۰۹ شروع شود.' };
  }

  try {
    const res = await fetch(`${API_BASE}/auth/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mobile: cleanMobile }),
    });

    const data = await res.json();
    if (res.ok && data.success) {
      return {
        success: true,
        message: data.message || 'کد تایید پیامکی ارسال شد.',
        cooldownSeconds: data.cooldownSeconds || 60,
        simulationCode: data.simulationCode,
      };
    }
    return {
      success: false,
      message: '',
      error: data.error || 'خطا در ارسال کد تایید پیامکی. لطفاً مجدداً تلاش کنید.',
      cooldownSeconds: data.remainingSeconds,
    };
  } catch (err) {
    console.warn('Backend unavailable for OTP, using offline simulation fallback:', err);
    // در صورت عدم دسترسی به سرور (مثلاً هاست استاتیک بدون بک‌اند)، شبیه‌سازی محلی
    const fallbackCode = '12345';
    sessionStorage.setItem(`offline_otp_${cleanMobile}`, fallbackCode);
    return {
      success: true,
      message: 'کد تایید پیامکی ارسال شد (حالت آفلاین دمو: ۱۲۳۴۵).',
      cooldownSeconds: 60,
      simulationCode: fallbackCode,
    };
  }
}

/**
 * بررسی صحت کد تایید پیامکی و ورود کاربر
 */
export async function verifySmsOtp(
  mobile: string,
  code: string,
  fullName?: string,
  gmail?: string
): Promise<{
  success: boolean;
  user?: UserProfile;
  message?: string;
  error?: string;
}> {
  const cleanMobile = sanitizeMobile(mobile);
  const cleanCode = sanitizeInput(code).replace(/\D/g, '');

  try {
    const res = await fetch(`${API_BASE}/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mobile: cleanMobile,
        code: cleanCode,
        fullName: sanitizeInput(fullName || ''),
        gmail: sanitizeEmail(gmail || ''),
      }),
    });

    const data = await res.json();
    if (res.ok && data.success) {
      const user: UserProfile = data.user;
      saveCurrentUser(user);
      return { success: true, user, message: data.message };
    }
    return { success: false, error: data.error || 'کد وارد شده صحیح نمی‌باشد.' };
  } catch (err) {
    console.warn('Backend unavailable, validating against offline simulation:', err);
    const saved = sessionStorage.getItem(`offline_otp_${cleanMobile}`);
    if (saved && saved === cleanCode) {
      sessionStorage.removeItem(`offline_otp_${cleanMobile}`);
      const user: UserProfile = {
        id: `cust_${cleanMobile}`,
        fullName: sanitizeInput(fullName || 'کاربر گرامی'),
        mobile: cleanMobile,
        gmail: sanitizeEmail(gmail || ''),
        createdAt: new Date().toISOString(),
      };
      saveCurrentUser(user);
      return { success: true, user, message: 'ورود با موفقیت انجام شد.' };
    }
    return { success: false, error: 'کد تایید وارد شده نادرست است (کد تستی آفلاین: ۱۲۳۴۵).' };
  }
}

/**
 * ورود یا ایجاد مستقیم پروفایل کاربری با نام و شماره موبایل
 */
export function loginOrRegisterCustomer(data: {
  fullName: string;
  mobile: string;
  gmail?: string;
}): UserProfile {
  const cleanName = sanitizeInput(data.fullName);
  const cleanMobile = sanitizeMobile(data.mobile);
  const cleanGmail = sanitizeEmail(data.gmail || '');

  const user: UserProfile = {
    id: `cust_${cleanMobile}`,
    fullName: cleanName,
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
 * دریافت سابقه سفارشات متعلق به شماره موبایل کاربر جاری
 */
export function getCustomerOrders(mobile: string): StoreOrder[] {
  const cleanMobile = sanitizeMobile(mobile);
  if (!cleanMobile) return [];

  const allOrders = getStoredOrders();
  return allOrders.filter(
    (o) => sanitizeMobile(o.mobile) === cleanMobile
  );
}
