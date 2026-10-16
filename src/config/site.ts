/**
 * تنظیمات متمرکز سایت.
 * همه‌ی قیمت‌ها، اطلاعات محصول و لینک‌ها فقط از همین‌جا خوانده می‌شن.
 */

/** واحد قیمت: تومان (عدد صحیح). هیچ‌جا ریال استفاده نشده. */
export const PRICE_UNIT = 'toman' as const;

export interface Product {
  id: string;
  name: string;
  /** عنوان کوتاه روی نشان بالای هیرو */
  badgeLabel: string;
  /** قیمت به تومان */
  priceToman: number;
  /** قیمت قبل از تخفیف؛ بر اساس ارزش دلاری رسمی جهانی */
  compareAtToman: number | null;
  /** قیمت رسمی دلاری جهانی */
  dollarPrice: number;
  /** مدت زمان اشتراک به ماه */
  periodMonths: number;
  /** مدت زمان گارانتی تعویض به ماه */
  warrantyMonths: number;
  /** مدت اشتراک */
  durationLabel: string | null;
  available: boolean;
  highlights: string[];
}

export const PRODUCT: Product = {
  id: 'google-ai-pro',
  name: 'اشتراک ۱۸ ماهه Google AI Pro',
  badgeLabel: 'اشتراک ۱۸ ماهه Gemini Pro',
  priceToman: 499_000,
  compareAtToman: 75_600_000, // ارزش دلاری رسمی ۱۸ ماهه ($360 معادل ماهیانه ۱۹.۹۹ دلار)
  dollarPrice: 360,
  periodMonths: 18,
  warrantyMonths: 1,
  durationLabel: 'اشتراک ۱۸ ماهه با ۱ ماه گارانتی تعویض و پشتیبانی',
  available: true,
  highlights: [
    'دسترسی به Gemini 3.8 Flash و Gemini 4 Pro Argon',
    '۵ ترابایت فضای ابری Google One برای Drive و Photos',
    'اشتراک ۱۸ ماهه با ۱ ماه گارانتی تعویض و پشتیبانی',
    'فعال‌سازی روی ایمیل شخصی بدون نیاز به پسورد',
  ],
};

/** تنظیمات درگاه کارت به کارت و پرداخت بزن به کارت */
export const PAYMENT_CONFIG = {
  serviceName: 'بزن به کارت',
  paymentUrl: 'https://bezanbecard.ir/pay/link/pPil9MUHeu', // لینک مستقیم پرداخت بزن به کارت
  cardNumber: '6219-8619-4490-3367',
  cardHolder: 'نریمان موذنی',
  bankName: 'بانک سامان',
  shabaNumber: 'IR660560611828005571433501',
  activationWindow: '۲ الی ۴۸ ساعت پس از بررسی و تأیید واریز',
};

export const SITE = {
  brand: 'Gemini Shop',
  affiliationNotice:
    'Google و Gemini علامت‌های تجاری شرکت Google LLC هستند. وب‌سایت Gemini Shop ارائه‌دهنده مستقل لایسنس و فعال‌سازی روی ایمیل شخصی است',
  copyright: '© ۱۴۰۵ Gemini Shop. تمامی حقوق محفوظ است',
};

/** اطلاعات پشتیبانی */
export const SUPPORT = {
  telegram: '@Nariman_Mzny',
  telegramUrl: 'https://t.me/Nariman_Mzny',
  email: 'narimanmoazeni@gmail.com',
  hours: 'پشتیبانی ۲۴ ساعته در تمامی روزهای هفته',
  warranty: '۱ ماه گارانتی تعویض و بازگشت وجه کامل',
};

export const NAV_ITEMS = [
  { id: 'home', label: 'خانه' },
  { id: 'benefits', label: 'ویژگی‌های اکانت' },
  { id: 'pricing', label: 'مقایسه و قیمت' },
  { id: 'activation', label: 'نحوه فعال‌سازی' },
  { id: 'faq', label: 'سوالات متداول' },
] as const;

export const FOOTER_LINKS = {
  site: NAV_ITEMS.filter((n) => n.id !== 'home'),
  legal: [
    { label: 'شرایط و قوانین فعال‌سازی', href: '#activation' },
    { label: 'حریم خصوصی (عدم نیاز به پسورد)', href: '#activation' },
    { label: 'گارانتی ۱ ماهه و پشتیبانی اختصاصی', href: '#support' },
  ],
};
