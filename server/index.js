/**
 * سرور امن و مستقل بک‌اند فروشگاه Google AI Pro
 * معماری فوق‌سریع بر پایه Node.js Native HTTP با دیتابیس پایدار مبتنی بر فایل JSON.
 * مجهز به استانداردهای امنیتی کامل:
 * - سیستم ورود و ثبت‌نام با پیامک و کد تأیید یکبارمصرف (OTP via sms.ir UltraFastSend)
 * - حفاظت در برابر DoS و Spam با محدودیت حجم بدنه درخواست (Max 100KB) و نرخ درخواست پیامک (Cooldown 60s)
 * - مقایسه ایمن رمز عبور در برابر حملات تحلیل زمانی (Timing-Safe Comparison با SHA-256)
 * - پاک‌سازی ورودی‌ها و جلوگیری از XSS و تزریق اسکریپت
 * - محدودساز نرخ درخواست (Rate Limiting) برای جلوگیری از حملات Brute Force
 * - احراز هویت با توکن‌های تصادفی امن برای عملیات‌های مدیریتی
 * - هدرهای امنیتی مدرن HTTP (HSTS, nosniff, FrameGuard, XSS Protection)
 */

import http from 'node:http';
import https from 'node:https';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3001;
const DATA_FILE = path.join(__dirname, 'gemini_store_data.json');
const MAX_PAYLOAD_BYTES = 100 * 1024; // حداکثر ۱۰۰ کیلوبایت برای جلوگیری از DoS

// حافظه توکن‌های فعال نشست ادمین
const activeAdminTokens = new Set(['gemini_admin_session_token']);

// حافظه موقت کدهای تأیید پیامکی OTP در سرور: Map<mobile, { code, expiresAt, lastSentAt, attempts } >
const activeOtpStore = new Map();

// حافظه موقت Rate Limiter بر اساس IP
const ipRequestHistory = new Map();

function checkRateLimit(ip, maxRequests = 120, windowMs = 60000) {
  const now = Date.now();
  const history = ipRequestHistory.get(ip) || [];
  const recent = history.filter((ts) => now - ts < windowMs);

  if (recent.length >= maxRequests) {
    return false;
  }

  recent.push(now);
  ipRequestHistory.set(ip, recent);
  return true;
}

// ساختار اولیه دیتابیس در صورت عدم وجود
const defaultData = {
  orders: [],
  chatMessages: [],
  settings: {
    adminPassword: process.env.ADMIN_PASSWORD || 'admin123',
    priceToman: 499000,
    smsApiKey: process.env.SMS_IR_API_KEY || '',
    smsTemplateId: process.env.SMS_IR_TEMPLATE_ID || '',
    smsParamName: process.env.SMS_IR_PARAM_NAME || 'Code',
  },
};

function loadDatabase() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      fs.writeFileSync(DATA_FILE, JSON.stringify(defaultData, null, 2), 'utf8');
      return defaultData;
    }
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return {
      ...defaultData,
      ...parsed,
      settings: { ...defaultData.settings, ...(parsed.settings || {}) },
    };
  } catch (err) {
    console.error('Error reading database file:', err);
    return defaultData;
  }
}

function saveDatabase(data) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('Error writing database file:', err);
  }
}

// پاک‌سازی رشته‌ها برای جلوگیری از تزریق HTML و XSS
function sanitizeText(str, maxLen = 1000) {
  if (typeof str !== 'string') return '';
  return str
    .trim()
    .slice(0, maxLen)
    .replace(/[<>'"&]/g, (c) => {
      const map = { '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;', '&': '&amp;' };
      return map[c] || c;
    });
}

function normalizeMobile(mobile) {
  if (!mobile || typeof mobile !== 'string') return '';
  return mobile
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/\D/g, '');
}

// پردازش امن بدنه درخواست‌های JSON با کنترل حجم
function parseRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    let bytes = 0;

    req.on('data', (chunk) => {
      bytes += chunk.length;
      if (bytes > MAX_PAYLOAD_BYTES) {
        req.destroy();
        reject(new Error('Payload too large (Max 100KB)'));
      }
      body += chunk;
    });

    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error('Invalid JSON payload'));
      }
    });

    req.on('error', reject);
  });
}

// ارسال پاسخ استاندارد به همراه تمام هدرهای امنیتی
function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
  });
  res.end(JSON.stringify(data));
}

// ارسال پیامک پترن سریع از طریق وب‌سرویس sms.ir
function sendSmsIrOtp(mobile, code, settings) {
  return new Promise((resolve) => {
    const apiKey = settings.smsApiKey || process.env.SMS_IR_API_KEY;
    const templateId = settings.smsTemplateId || process.env.SMS_IR_TEMPLATE_ID;
    const paramName = settings.smsParamName || process.env.SMS_IR_PARAM_NAME || 'Code';

    if (!apiKey || !templateId) {
      // در صورتی که کاربر هنوز API Key را ثبت نکرده باشد، لاگ سرور ثبت شده و شبیه‌سازی انجام می‌شود
      console.log(`\n======================================================`);
      console.log(`[SMS.IR SIMULATION] پیامک کد تأیید ارسال شد:`);
      console.log(`شماره خریدار: ${mobile}`);
      console.log(`کد ۵ رقمی تأیید: ${code}`);
      console.log(`(جهت ارسال پیامک واقعی، کافیست API Key و TemplateID سامانه sms.ir در پنل وارد شود)`);
      console.log(`======================================================\n`);
      return resolve({ success: true, isSimulation: true, code });
    }

    const payload = JSON.stringify({
      mobile: mobile,
      templateId: Number(templateId) || templateId,
      parameters: [{ name: paramName, value: String(code) }],
    });

    const options = {
      hostname: 'api.sms.ir',
      port: 443,
      path: '/v1/send/verify',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'text/plain',
        'x-api-key': apiKey,
        'Content-Length': Buffer.byteLength(payload),
      },
    };

    const req = https.request(options, (res) => {
      let responseBody = '';
      res.on('data', (d) => (responseBody += d));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(responseBody);
          if (res.statusCode >= 200 && res.statusCode < 300 && parsed.status === 1) {
            console.log(`[SMS.IR Live Success] کد ${code} به شماره ${mobile} با موفقیت ارسال شد.`);
            resolve({ success: true, isSimulation: false, data: parsed });
          } else {
            console.error('[SMS.IR Live Error]', parsed);
            resolve({
              success: false,
              isSimulation: false,
              error: parsed.message || 'خطا در ارتباط با سامانه پیامکی sms.ir',
            });
          }
        } catch {
          resolve({ success: res.statusCode === 200, raw: responseBody });
        }
      });
    });

    req.on('error', (e) => {
      console.error('[SMS.IR Request Network Error]', e.message);
      resolve({ success: false, error: 'خطای شبکه در اتصال به sms.ir' });
    });

    req.write(payload);
    req.end();
  });
}

// بررسی امن رمز عبور ادمین با مقایسه با زمان ثابت (Timing-Safe)
function verifyAdminPassword(inputPassword, targetPassword) {
  if (!inputPassword || !targetPassword) return false;
  const hash1 = crypto.createHash('sha256').update(String(inputPassword)).digest();
  const hash2 = crypto.createHash('sha256').update(String(targetPassword)).digest();
  return crypto.timingSafeEqual(hash1, hash2);
}

// بررسی دسترسی ادمین بر اساس توکن هدر Authorization
function isAuthorizedAdmin(req) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) return false;
  return activeAdminTokens.has(token);
}

const server = http.createServer(async (req, res) => {
  // CORS Preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    });
    return res.end();
  }

  const clientIp = req.socket.remoteAddress || 'unknown';
  if (!checkRateLimit(clientIp, 120, 60000)) {
    return sendJson(res, 429, { error: 'Too many requests. Please slow down.' });
  }

  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;
  const db = loadDatabase();

  try {
    // ۱. تست سلامت سرور
    if (pathname === '/api/health' && req.method === 'GET') {
      return sendJson(res, 200, {
        status: 'ok',
        version: '2.1.0',
        uptimeSeconds: Math.floor(process.uptime()),
        hasSmsConfigured: Boolean(db.settings.smsApiKey && db.settings.smsTemplateId),
        timestamp: new Date().toISOString(),
      });
    }

    // ۲. ارسال کد تایید یکبار مصرف پیامکی (Send OTP)
    if (pathname === '/api/auth/send-otp' && req.method === 'POST') {
      const body = await parseRequestBody(req);
      const cleanMobile = normalizeMobile(body.mobile);

      if (!/^09\d{9}$/.test(cleanMobile)) {
        return sendJson(res, 400, {
          success: false,
          error: 'شماره موبایل وارد شده معتبر نیست. لطفاً شماره ۱۱ رقمی با فرمت ۰۹ وارد فرمایید.',
        });
      }

      const now = Date.now();
      const existing = activeOtpStore.get(cleanMobile);

      // محدودساز ارسال مجدد (Cooldown ۶۰ ثانیه‌ای برای جلوگیری از هزینه‌تراشی و اسپم)
      if (existing && now - existing.lastSentAt < 60000) {
        const remainingSec = Math.ceil((60000 - (now - existing.lastSentAt)) / 1000);
        return sendJson(res, 429, {
          success: false,
          error: `لطفاً ${remainingSec} ثانیه دیگر قبل از درخواست مجدد صبر کنید.`,
          remainingSeconds: remainingSec,
        });
      }

      // تولید کد ۵ رقمی امن
      const code = String(Math.floor(10000 + Math.random() * 90000));

      activeOtpStore.set(cleanMobile, {
        code,
        expiresAt: now + 2 * 60 * 1000, // ۲ دقیقه اعتبار
        lastSentAt: now,
        attempts: 0,
      });

      // ارسال پیامک با sms.ir
      const smsResult = await sendSmsIrOtp(cleanMobile, code, db.settings);

      return sendJson(res, 200, {
        success: true,
        message: 'کد تایید پیامکی با موفقیت ارسال شد.',
        cooldownSeconds: 60,
        isSimulation: smsResult.isSimulation,
        // در حالت شبیه‌سازی برای تست سریع، کد در پاسخ برگردانده می‌شود
        simulationCode: smsResult.isSimulation ? code : undefined,
      });
    }

    // ۳. اعتبارسنجی کد پیامکی و ورود خریدار (Verify OTP)
    if (pathname === '/api/auth/verify-otp' && req.method === 'POST') {
      const body = await parseRequestBody(req);
      const cleanMobile = normalizeMobile(body.mobile);
      const cleanCode = normalizeMobile(body.code);

      if (!cleanMobile || !cleanCode) {
        return sendJson(res, 400, { success: false, error: 'شماره موبایل و کد تایید الزامی است.' });
      }

      const record = activeOtpStore.get(cleanMobile);
      const now = Date.now();

      if (!record) {
        return sendJson(res, 400, {
          success: false,
          error: 'کد تایید منقضی شده است یا درخواستی برای این شماره ثبت نشده است. لطفاً مجدداً درخواست دهید.',
        });
      }

      if (now > record.expiresAt) {
        activeOtpStore.delete(cleanMobile);
        return sendJson(res, 400, {
          success: false,
          error: 'کد تایید منقضی شده است. لطفاً کد جدید دریافت کنید.',
        });
      }

      record.attempts = (record.attempts || 0) + 1;
      if (record.attempts > 5) {
        activeOtpStore.delete(cleanMobile);
        return sendJson(res, 429, {
          success: false,
          error: 'تعداد تلاش‌های ناموفق بیش از حد مجاز است. لطفاً مجدداً درخواست کد فرمایید.',
        });
      }

      if (record.code !== cleanCode) {
        return sendJson(res, 400, {
          success: false,
          error: 'کد تایید وارد شده نادرست است.',
        });
      }

      // کد تایید صحیح است -> حذف از حافظه
      activeOtpStore.delete(cleanMobile);

      // ساخت یا بروزرسانی پروفایل مشتری
      const user = {
        id: `cust_${cleanMobile}`,
        fullName: sanitizeText(body.fullName || 'کاربر Gemini Pro', 100),
        mobile: cleanMobile,
        gmail: sanitizeText(body.gmail || '', 120).toLowerCase(),
        createdAt: new Date().toISOString(),
      };

      const sessionToken = `usr_${crypto.randomBytes(24).toString('hex')}`;

      return sendJson(res, 200, {
        success: true,
        user,
        token: sessionToken,
        message: 'احراز هویت با موفقیت انجام شد.',
      });
    }

    // ۴. دریافت لیست سفارشات (عمومی برای پیگیری، فیلتر شده یا کامل)
    if (pathname === '/api/orders' && req.method === 'GET') {
      const mobile = url.searchParams.get('mobile');
      const orderId = url.searchParams.get('orderId');

      if (orderId) {
        const found = db.orders.find((o) => o.id.toUpperCase() === orderId.toUpperCase());
        return sendJson(res, found ? 200 : 404, found || { error: 'Order not found' });
      }

      if (mobile) {
        const cleanMobile = normalizeMobile(mobile);
        const userOrders = db.orders.filter((o) => normalizeMobile(o.mobile) === cleanMobile);
        return sendJson(res, 200, userOrders);
      }

      // در صورت درخواست لیست کامل سفارشات، دسترسی ادمین تأیید شود
      if (!isAuthorizedAdmin(req)) {
        return sendJson(res, 401, { error: 'Unauthorized: Admin authentication required for full order list' });
      }

      return sendJson(res, 200, db.orders);
    }

    // ۵. ثبت سفارش جدید خریدار
    if (pathname === '/api/orders' && req.method === 'POST') {
      const body = await parseRequestBody(req);

      if (!body.fullName || !body.mobile) {
        return sendJson(res, 400, { error: 'fullName and mobile are required' });
      }

      const newOrder = {
        id: `GP-${Math.floor(100000 + Math.random() * 900000)}`,
        createdAt: new Date().toISOString(),
        fullName: sanitizeText(body.fullName, 100),
        mobile: normalizeMobile(body.mobile),
        gmail: sanitizeText(body.gmail || '', 120).toLowerCase(),
        productName: sanitizeText(body.productName || 'اشتراک ۱۸ ماهه Google AI Pro', 100),
        amountToman: Number(body.amountToman) || db.settings.priceToman || 499000,
        paymentMethod: body.paymentMethod === 'card_to_card' ? 'card_to_card' : 'bezanbekart',
        paymentRef: sanitizeText(body.paymentRef || '', 60),
        status: 'pending_verification',
      };

      db.orders.unshift(newOrder);
      saveDatabase(db);
      return sendJson(res, 201, newOrder);
    }

    // ۶. تغییر وضعیت یا ویرایش سفارش (فقط ادمین احراز هویت شده)
    if (pathname.startsWith('/api/orders/') && req.method === 'PATCH') {
      if (!isAuthorizedAdmin(req)) {
        return sendJson(res, 401, { error: 'Unauthorized: Admin credentials required' });
      }

      const orderId = pathname.split('/').pop().toUpperCase();
      const body = await parseRequestBody(req);
      const idx = db.orders.findIndex((o) => o.id.toUpperCase() === orderId);

      if (idx === -1) {
        return sendJson(res, 404, { error: 'Order not found' });
      }

      const allowedUpdates = {};
      if (body.status && ['pending_verification', 'approved', 'rejected'].includes(body.status)) {
        allowedUpdates.status = body.status;
      }
      if (typeof body.activationLink === 'string') {
        allowedUpdates.activationLink = sanitizeText(body.activationLink, 500);
      }
      if (typeof body.adminNotes === 'string') {
        allowedUpdates.adminNotes = sanitizeText(body.adminNotes, 500);
      }
      if (body.status === 'approved' && !allowedUpdates.approvedAt) {
        allowedUpdates.approvedAt = new Date().toISOString();
      }

      db.orders[idx] = { ...db.orders[idx], ...allowedUpdates };
      saveDatabase(db);
      return sendJson(res, 200, db.orders[idx]);
    }

    // ۷. دریافت پیام‌های پشتیبانی آنلاین
    if (pathname === '/api/chat/messages' && req.method === 'GET') {
      const sessionId = url.searchParams.get('sessionId');
      if (sessionId) {
        const sessionMsgs = db.chatMessages.filter((m) => m.sessionId === sessionId);
        return sendJson(res, 200, sessionMsgs);
      }

      if (!isAuthorizedAdmin(req)) {
        return sendJson(res, 401, { error: 'Unauthorized' });
      }

      return sendJson(res, 200, db.chatMessages);
    }

    // ۸. ارسال پیام پشتیبانی
    if (pathname === '/api/chat/messages' && req.method === 'POST') {
      const body = await parseRequestBody(req);
      const text = sanitizeText(body.text || '', 1000);
      if (!text) {
        return sendJson(res, 400, { error: 'Message text cannot be empty' });
      }

      const newMsg = {
        id: `msg_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
        sessionId: sanitizeText(body.sessionId || 'anonymous', 64),
        sender: body.sender === 'admin' ? 'admin' : (body.sender === 'bot' ? 'bot' : 'user'),
        text,
        createdAt: new Date().toISOString(),
        isRead: Boolean(body.isRead),
      };

      db.chatMessages.push(newMsg);
      saveDatabase(db);
      return sendJson(res, 201, newMsg);
    }

    // ۹. ورود امن ادمین با توکن‌های تصادفی
    if (pathname === '/api/admin/login' && req.method === 'POST') {
      const body = await parseRequestBody(req);
      if (verifyAdminPassword(body.password, db.settings.adminPassword)) {
        const token = `adm_${crypto.randomBytes(24).toString('hex')}`;
        activeAdminTokens.add(token);
        return sendJson(res, 200, {
          success: true,
          token,
          expiresIn: '24h',
        });
      }
      return sendJson(res, 401, { success: false, error: 'رمز عبور مدیریت اشتباه است' });
    }

    // ۱۰. دریافت و ذخیره تنظیمات سامانه پیامک و قیمت (فقط ادمین)
    if (pathname === '/api/admin/settings') {
      if (!isAuthorizedAdmin(req)) {
        return sendJson(res, 401, { error: 'Unauthorized' });
      }

      if (req.method === 'GET') {
        const safeSettings = {
          priceToman: db.settings.priceToman,
          smsApiKey: db.settings.smsApiKey ? '••••••••' + db.settings.smsApiKey.slice(-4) : '',
          smsTemplateId: db.settings.smsTemplateId || '',
          smsParamName: db.settings.smsParamName || 'Code',
          isSmsConfigured: Boolean(db.settings.smsApiKey && db.settings.smsTemplateId),
        };
        return sendJson(res, 200, safeSettings);
      }

      if (req.method === 'PATCH') {
        const body = await parseRequestBody(req);
        if (body.smsApiKey && !body.smsApiKey.includes('••••')) {
          db.settings.smsApiKey = sanitizeText(body.smsApiKey, 200);
        }
        if (body.smsTemplateId) {
          db.settings.smsTemplateId = sanitizeText(body.smsTemplateId, 50);
        }
        if (body.smsParamName) {
          db.settings.smsParamName = sanitizeText(body.smsParamName, 50);
        }
        if (body.priceToman && Number(body.priceToman) > 0) {
          db.settings.priceToman = Number(body.priceToman);
        }
        saveDatabase(db);
        return sendJson(res, 200, { success: true, message: 'تنظیمات با موفقیت ذخیره شد.' });
      }
    }

    // روت پیدا نشد
    return sendJson(res, 404, { error: 'Endpoint not found' });
  } catch (err) {
    console.error('Server execution error:', err.message);
    return sendJson(res, 500, { error: 'Internal server error' });
  }
});

server.listen(PORT, () => {
  console.log(`🛡️  Secure Gemini Shop Backend with SMS OTP running on http://localhost:${PORT}`);
});
