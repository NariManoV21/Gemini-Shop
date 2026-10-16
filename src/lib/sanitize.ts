/**
 * ابزار اعتبارسنجی و پاک‌سازی ورودی‌ها جهت جلوگیری از حملات XSS و تزریق اسکریپت
 */

/**
 * پاک‌سازی رشته‌های متنی و تبدیل کاراکترهای خطرناک به موجودیت‌های امن HTML
 */
export function sanitizeInput(input: string | undefined | null): string {
  if (!input) return '';
  return String(input)
    .trim()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * پاک‌سازی و استانداردسازی شماره موبایل ایران
 */
export function sanitizeMobile(mobile: string | undefined | null): string {
  if (!mobile) return '';
  // تبدیل اعداد فارسی و عربی به انگلیسی
  const normalized = mobile
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/\D/g, ''); // حذف هرگونه کاراکتر غیر عددی

  return normalized;
}

/**
 * بررسی صحت فرمت شماره موبایل ۱۱ رقمی ایران
 */
export function isValidIranianMobile(mobile: string): boolean {
  const clean = sanitizeMobile(mobile);
  return /^09\d{9}$/.test(clean);
}

/**
 * پاک‌سازی آدرس ایمیل و جیمیل
 */
export function sanitizeEmail(email: string | undefined | null): string {
  if (!email) return '';
  return email.trim().toLowerCase().replace(/[^a-z0-9._%+-@]/g, '');
}

/**
 * اعتبارسنجی جیمیل گوگل
 */
export function isValidGmail(email: string): boolean {
  const clean = sanitizeEmail(email);
  return /^[a-zA-Z0-9._%+-]+@gmail\.com$/.test(clean);
}
