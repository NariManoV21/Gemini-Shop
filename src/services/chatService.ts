/**
 * سرویس مدیریت پیام‌های چت پشتیبانی آنلاین و ربات هوشمند.
 * قابلیت ذخیره پایدار گفتگوها، پاسخ‌گویی خودکار به سوالات پرتکرار و پیگیری فوری سفارش درون چت.
 */

import { PAYMENT_CONFIG, SUPPORT } from '../config/site';
import { getOrderById } from './orderStorage';

export interface ChatMessage {
  id: string;
  sessionId: string;
  sender: 'user' | 'bot' | 'admin';
  text: string;
  createdAt: string;
  isRead?: boolean;
  orderCard?: {
    id: string;
    fullName: string;
    status: 'pending_verification' | 'approved' | 'rejected';
    amountToman: number;
    gmail: string;
    activationLink?: string;
  };
}

const CHAT_STORAGE_KEY = 'gemini_pro_chat_sessions_v1';
const SESSION_ID_KEY = 'gemini_pro_user_session_id';

/** دریافت یا ایجاد شناسه یکتای سشن برای کاربر جاری */
export function getOrCreateSessionId(): string {
  let sessionId = localStorage.getItem(SESSION_ID_KEY);
  if (!sessionId) {
    sessionId = `user_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    localStorage.setItem(SESSION_ID_KEY, sessionId);
  }
  return sessionId;
}

/** دریافت تمام پیام‌های یک سشن */
export function getSessionMessages(sessionId: string): ChatMessage[] {
  try {
    const raw = localStorage.getItem(CHAT_STORAGE_KEY);
    if (!raw) return [];
    const all: ChatMessage[] = JSON.parse(raw);
    return all.filter((m) => m.sessionId === sessionId);
  } catch (e) {
    console.error('Error reading chat messages', e);
    return [];
  }
}

/** دریافت تمام پیام‌های سیستم (برای پنل ادمین) */
export function getAllChatMessages(): ChatMessage[] {
  try {
    const raw = localStorage.getItem(CHAT_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (e) {
    console.error('Error reading all chat messages', e);
    return [];
  }
}

/** ذخیره تمام پیام‌ها و انتشار ایونت تغییرات */
function saveAllChatMessages(messages: ChatMessage[]) {
  try {
    localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(messages));
    window.dispatchEvent(new CustomEvent('gemini_chat_updated', { detail: messages }));
  } catch (e) {
    console.error('Error saving chat messages', e);
  }
}

/** ارسال پیام توسط کاربر و تولید پاسخ هوشمند */
export function sendUserMessage(sessionId: string, text: string): { userMsg: ChatMessage; botReply?: ChatMessage } {
  const userMsg: ChatMessage = {
    id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    sessionId,
    sender: 'user',
    text: text.trim(),
    createdAt: new Date().toISOString(),
    isRead: false,
  };

  const all = getAllChatMessages();
  all.push(userMsg);

  // بررسی پاسخ خودکار هوشمند
  const botReply = generateSmartReply(sessionId, text.trim());
  if (botReply) {
    all.push(botReply);
  }

  saveAllChatMessages(all);
  return { userMsg, botReply };
}

/** ارسال پاسخ توسط ادمین در پنل */
export function sendAdminReply(sessionId: string, text: string): ChatMessage {
  const adminMsg: ChatMessage = {
    id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    sessionId,
    sender: 'admin',
    text: text.trim(),
    createdAt: new Date().toISOString(),
    isRead: true,
  };

  const all = getAllChatMessages();
  all.push(adminMsg);
  saveAllChatMessages(all);
  return adminMsg;
}

/** علامت‌گذاری پیام‌های یک سشن به عنوان خوانده‌شده توسط ادمین */
export function markSessionAsRead(sessionId: string) {
  const all = getAllChatMessages();
  let changed = false;
  all.forEach((m) => {
    if (m.sessionId === sessionId && !m.isRead) {
      m.isRead = true;
      changed = true;
    }
  });
  if (changed) {
    saveAllChatMessages(all);
  }
}

/** موتور پاسخ هوشمند و استعلام فوری وضعیت سفارش */
function generateSmartReply(sessionId: string, text: string): ChatMessage | undefined {
  const clean = text.toUpperCase();

  // ۱. بررسی اگر کاربر کد سفارش فرستاده باشد (مثلا GP-123456 یا فقط ۶ رقم)
  const orderMatch = clean.match(/(?:GP-)?(\d{6})/);
  if (orderMatch) {
    const orderId = `GP-${orderMatch[1]}`;
    const order = getOrderById(orderId);

    if (order) {
      const statusFa =
        order.status === 'approved'
          ? 'فعال‌شده و آماده استفاده'
          : order.status === 'pending_verification'
          ? 'در انتظار بررسی واریز (۲ الی ۴۸ ساعت کاری)'
          : 'عدم تأیید به دلیل مغایرت فیش واریزی';

      let replyText = `اطلاعات سفارش ${order.id} استعلام گردید:\n• خریدار: ${order.fullName}\n• وضعیت: ${statusFa}\n• جیمیل فعال‌سازی: ${order.gmail}`;
      if (order.status === 'approved' && order.activationLink) {
        replyText += `\n\nاشتراک شما فعال شده است. لینک دعوت رسمی گوگل در سفارش شما ثبت گردید.`;
      } else if (order.status === 'pending_verification') {
        replyText += `\n\nفیش واریزی شما در صف بررسی کارشناسان قرار دارد.`;
      }

      return {
        id: `bot_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        sessionId,
        sender: 'bot',
        text: replyText,
        createdAt: new Date().toISOString(),
        orderCard: {
          id: order.id,
          fullName: order.fullName,
          status: order.status,
          amountToman: order.amountToman,
          gmail: order.gmail,
          activationLink: order.activationLink,
        },
      };
    } else {
      return {
        id: `bot_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        sessionId,
        sender: 'bot',
        text: `سفارشی با کد «${orderId}» در سیستم یافت نشد. لطفاً کد ۶ رقمی ثبت‌شده در فاکتور را بررسی و مجدداً ارسال نمایید.`,
        createdAt: new Date().toISOString(),
      };
    }
  }

  // ۲. سوالات پرتکرار درباره فعال‌سازی
  if (text.includes('فعال') || text.includes('چگونه') || text.includes('چطور')) {
    return {
      id: `bot_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      sessionId,
      sender: 'bot',
      text: `مراحل فعال‌سازی اشتراک:\n۱. ثبت سفارش و ثبت شماره پیگیری واریز ۴۹۹,۰۰۰ تومان در سایت.\n۲. ارسال دعوت‌نامه رسمی گوگل به جیمیل شخصی شما ظرف ۲ الی ۴۸ ساعت کاری.\n۳. پذیرش دعوت بدون نیاز به در اختیار گذاشتن رمز عبور جیمیل و فعال‌شدن اشتراک ۱۸ ماهه.`,
      createdAt: new Date().toISOString(),
    };
  }

  // ۳. اطلاعات واریز و شماره کارت
  if (text.includes('کارت') || text.includes('شماره') || text.includes('واریز') || text.includes('شبا')) {
    return {
      id: `bot_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      sessionId,
      sender: 'bot',
      text: `اطلاعات واریز رسمی فروشگاه:\nشماره کارت: ${PAYMENT_CONFIG.cardNumber}\nنام دارنده: ${PAYMENT_CONFIG.cardHolder} (${PAYMENT_CONFIG.bankName})\nشماره شبا: ${PAYMENT_CONFIG.shabaNumber}\nمبلغ: ۴۹۹,۰۰۰ تومان\nپس از پرداخت، شماره پیگیری را در فرم خرید سایت ثبت فرمایید.`,
      createdAt: new Date().toISOString(),
    };
  }

  // ۴. مشکل تحریم یا فیلترشکن
  if (text.includes('تحریم') || text.includes('vpn') || text.includes('فیلتر') || text.includes('dns') || text.includes('آی پی')) {
    return {
      id: `bot_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      sessionId,
      sender: 'bot',
      text: `با توجه به محدودیت‌های جغرافیایی گوگل، لطفاً هنگام ورود به لینک فعال‌سازی و محیط Gemini Pro، از اتصال یک ابزار معتبر و پایدار تغییر IP بدون نشت (DNS Leak-Free) اطمینان حاصل فرمایید.`,
      createdAt: new Date().toISOString(),
    };
  }

  // ۵. پیام پیش‌فرض ثبت تیکت برای پشتیبان انسانی
  return {
    id: `bot_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    sessionId,
    sender: 'bot',
    text: `پیام شما ثبت گردید و در نوبت پاسخگویی قرار گرفت. در صورت تمایل به ارتباط مستقیم و فوری، می‌توانید در تلگرام به آیدی ${SUPPORT.telegram} پیام ارسال فرمایید.`,
    createdAt: new Date().toISOString(),
  };
}
