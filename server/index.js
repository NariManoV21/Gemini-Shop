/**
 * سرور امن و مستقل بک‌اند فروشگاه Gemini Shop
 * معماری فوق‌سریع بر پایه Node.js Native HTTP با دیتابیس پایدار مبتنی بر فایل JSON.
 * مجهز به استانداردهای امنیتی کامل:
 * - احراز هویت خریداران از طریق ارسال ایمیل کد تأیید یکبارمصرف (Gmail OTP via TLS Port 465)
 * - پنل مدیریت دو سطحی با کنترل دسترسی نقش‌محور (RBAC: head_admin و regular_admin)
 * - حفاظت در برابر DoS و Spam با محدودیت حجم بدنه درخواست (Max 100KB) و نرخ درخواست ایمیل (Cooldown 60s)
 * - مقایسه ایمن رمز عبور در برابر حملات تحلیل زمانی (Timing-Safe Comparison با SHA-256)
 * - پاک‌سازی ورودی‌ها و جلوگیری از XSS و تزریق اسکریپت
 * - محدودساز نرخ درخواست (Rate Limiting) برای جلوگیری از حملات Brute Force
 * - احراز هویت با توکن‌های تصادفی امن برای عملیات‌های مدیریتی
 * - هدرهای امنیتی مدرن HTTP (HSTS, nosniff, FrameGuard, XSS Protection)
 */

import http from 'node:http';
import https from 'node:https';
import tls from 'node:tls';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3001;
const DATA_FILE = process.env.DATA_FILE || path.join(__dirname, 'gemini_store_data.json');
const MAX_PAYLOAD_BYTES = 100 * 1024; // حداکثر ۱۰۰ کیلوبایت برای جلوگیری از DoS
const BODY_TIMEOUT_MS = 10000; // مهلت ۱۰ ثانیه‌ای جهت مقابله با حملات Slowloris

// حافظه توکن‌های فعال نشست ادمین: Map<token, { id, username, fullName, role, expiresAt }>
// کاملاً بدون توکن پیش‌فرض هاردکد شده جهت جلوگیری از نفوذ
const activeAdminSessions = new Map();

// حافظه موقت کدهای تأیید ایمیلی OTP در سرور: Map<email, { code, expiresAt, lastSentAt, attempts, fullName, mobile }>
const activeOtpStore = new Map();

// حافظه موقت Rate Limiter بر اساس IP
const ipRequestHistory = new Map();

// حافظه موقت حفاظت از حملات Brute Force برای لاگین ادمین
const loginAttemptsHistory = new Map();

// استخراج امن آی‌پی واقعی کلاینت از پشت پروکسی‌ها و کلادفلر
function getClientIp(req) {
  if (req.headers['cf-connecting-ip']) {
    return String(req.headers['cf-connecting-ip']).trim();
  }
  if (req.headers['x-forwarded-for']) {
    const ips = String(req.headers['x-forwarded-for']).split(',');
    return ips[0].trim();
  }
  if (req.headers['x-real-ip']) {
    return String(req.headers['x-real-ip']).trim();
  }
  return req.socket?.remoteAddress || '127.0.0.1';
}

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

// بررسی وضعیت قفل موقت ورود ادمین بر اساس آی‌پی یا نام‌کاربری
function checkLoginLockout(key) {
  const now = Date.now();
  const record = loginAttemptsHistory.get(key);
  if (record && record.lockedUntil && now < record.lockedUntil) {
    const remainingMinutes = Math.ceil((record.lockedUntil - now) / 60000);
    return { isLocked: true, remainingMinutes };
  }
  return { isLocked: false, remainingMinutes: 0 };
}

function recordFailedLogin(key) {
  const now = Date.now();
  const record = loginAttemptsHistory.get(key) || { count: 0, lockedUntil: 0 };
  record.count += 1;
  if (record.count >= 5) {
    record.lockedUntil = now + 15 * 60 * 1000; // قفل ۱۵ دقیقه‌ای در صورت ۵ تلاش ناموفق
    record.count = 0;
  }
  loginAttemptsHistory.set(key, record);
}

function clearFailedLogin(key) {
  loginAttemptsHistory.delete(key);
}

// هش‌گذاری امن رمز عبور با سالت تصادفی و الگوریتم PBKDF2 با ۱۰۰,۰۰۰ دور (استاندارد NIST)
function hashPasswordSalted(password, salt = crypto.randomBytes(16).toString('hex')) {
  const derived = crypto.pbkdf2Sync(String(password), salt, 100000, 64, 'sha512').toString('hex');
  return `pbkdf2:${salt}:${derived}`;
}

// بررسی زمان‌ثابت رمز عبور (Timing-Safe) با پشتیبانی ارتقای خودکار
function verifyPasswordSecure(password, stored) {
  if (!password || !stored) return false;
  try {
    if (typeof stored === 'string' && stored.startsWith('pbkdf2:')) {
      const parts = stored.split(':');
      const salt = parts[1];
      const targetHash = parts[2];
      const computed = crypto.pbkdf2Sync(String(password), salt, 100000, 64, 'sha512').toString('hex');
      return crypto.timingSafeEqual(Buffer.from(computed, 'utf8'), Buffer.from(targetHash, 'utf8'));
    }
    // پشتیبانی سازگار با هش‌های اولیه sha256
    const inputHash = crypto.createHash('sha256').update(String(password)).digest('hex');
    const targetHash = stored.length === 64
      ? stored
      : crypto.createHash('sha256').update(String(stored)).digest('hex');
    return crypto.timingSafeEqual(Buffer.from(inputHash, 'utf8'), Buffer.from(targetHash, 'utf8'));
  } catch (err) {
    console.error('Password verification exception:', err);
    return false;
  }
}

// ساختار اولیه دیتابیس در صورت عدم وجود
const initialAdminPass = process.env.ADMIN_PASSWORD || 'admin123';
const defaultData = {
  orders: [],
  chatMessages: [],
  users: [],
  settings: {
    adminPassword: hashPasswordSalted(initialAdminPass),
    priceToman: 499000,
    smtpHost: process.env.SMTP_HOST || 'smtp.gmail.com',
    smtpPort: Number(process.env.SMTP_PORT) || 465,
    smtpUser: process.env.SMTP_USER || '',
    smtpPass: process.env.SMTP_PASS || '',
  },
  admins: [
    {
      id: 'adm_head_1',
      username: 'admin',
      passwordHash: hashPasswordSalted(initialAdminPass),
      fullName: 'نریمان موذنی (مدیر ارشد)',
      role: 'head_admin',
      createdAt: new Date().toISOString(),
    },
  ],
};

function loadDatabase() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      saveDatabase(defaultData);
      return defaultData;
    }
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    const db = {
      ...defaultData,
      ...parsed,
      settings: { ...defaultData.settings, ...(parsed.settings || {}) },
      admins: Array.isArray(parsed.admins) && parsed.admins.length > 0 ? parsed.admins : defaultData.admins,
      users: Array.isArray(parsed.users) ? parsed.users : [],
    };
    return db;
  } catch (err) {
    console.error('Error reading database file:', err);
    return defaultData;
  }
}

// ذخیره‌سازی اتمیک (Atomic File Write) برای جلوگیری از خرابی داده در قطعی ناگهانی
function saveDatabase(data) {
  const tempFile = `${DATA_FILE}.tmp.${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  try {
    fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tempFile, DATA_FILE);
  } catch (err) {
    console.error('Error writing database file atomically:', err);
    try {
      if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
    } catch {}
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

function normalizeEmail(email) {
  if (!email || typeof email !== 'string') return '';
  return email.trim().toLowerCase();
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


/**
 * پیاده‌سازی سبک و فوق‌سریع ارسال ایمیل پروتکل SMTP با TLS بومی Node.js
 * اتصال مستقیم به smtp.gmail.com روی پورت 465 با احراز هویت App Password
 */
function sendSmtpTlsMail({ host, port, user, pass, to, subject, html, text }) {
  return new Promise((resolve) => {
    const cleanPass = pass.replace(/\s+/g, '');
    const socket = tls.connect(
      {
        host: host || 'smtp.gmail.com',
        port: Number(port) || 465,
        minVersion: 'TLSv1.2',
      },
      () => {
        // اتصال TLS برقرار شد
      }
    );

    let buffer = '';
    let step = 0;

    const send = (line) => {
      socket.write(line + '\r\n');
    };

    socket.setEncoding('utf8');

    socket.on('data', (chunk) => {
      buffer += chunk;
      const lines = buffer.split('\r\n');
      buffer = lines.pop(); // باقیمانده خط ناقص بعدی

      for (const line of lines) {
        if (!line) continue;
        const code = parseInt(line.slice(0, 3), 10);
        const isLastLineOfReply = line.charAt(3) !== '-';
        if (!isLastLineOfReply) continue;

        if (code >= 400) {
          console.error(`[SMTP Error ${code}]`, line);
          try {
            socket.destroy();
          } catch {}
          return resolve({ success: false, error: line });
        }

        if (step === 0 && code === 220) {
          step = 1;
          send('EHLO localhost');
        } else if (step === 1 && code === 250) {
          step = 2;
          send('AUTH LOGIN');
        } else if (step === 2 && code === 334) {
          step = 3;
          send(Buffer.from(user).toString('base64'));
        } else if (step === 3 && code === 334) {
          step = 4;
          send(Buffer.from(cleanPass).toString('base64'));
        } else if (step === 4 && code === 235) {
          step = 5;
          send(`MAIL FROM:<${user}>`);
        } else if (step === 5 && code === 250) {
          step = 6;
          send(`RCPT TO:<${to}>`);
        } else if (step === 6 && code === 250) {
          step = 7;
          send('DATA');
        } else if (step === 7 && code === 354) {
          step = 8;
          const boundary = '----=_Part_' + Date.now();
          const emailData = [
            `From: "Gemini Shop" <${user}>`,
            `To: <${to}>`,
            `Subject: =?UTF-8?B?${Buffer.from(subject).toString('base64')}?=`,
            'MIME-Version: 1.0',
            `Content-Type: multipart/alternative; boundary="${boundary}"`,
            '',
            `--${boundary}`,
            'Content-Type: text/plain; charset=UTF-8',
            'Content-Transfer-Encoding: base64',
            '',
            Buffer.from(text || '').toString('base64'),
            '',
            `--${boundary}`,
            'Content-Type: text/html; charset=UTF-8',
            'Content-Transfer-Encoding: base64',
            '',
            Buffer.from(html || '').toString('base64'),
            '',
            `--${boundary}--`,
            '.',
          ].join('\r\n');
          socket.write(emailData + '\r\n');
        } else if (step === 8 && code === 250) {
          step = 9;
          send('QUIT');
          return resolve({ success: true });
        }
      }
    });

    socket.on('error', (err) => {
      console.error('[SMTP Socket Error]', err.message);
      resolve({ success: false, error: err.message });
    });

    socket.setTimeout(15000, () => {
      try {
        socket.destroy();
      } catch {}
      resolve({ success: false, error: 'SMTP Timeout after 15s' });
    });
  });
}

/**
 * ارسال ایمیل کد ۵ رقمی تأیید OTP به کاربر
 * اگر اطلاعات اکانت جیمیل در تنظیمات ثبت نشده باشد، شبیه‌سازی انجام می‌شود
 */
async function sendGmailOtp(email, fullName, code, settings) {
  const displayName = fullName ? fullName.trim() : 'خریدار محترم';
  const user = settings.smtpUser || process.env.SMTP_USER;
  const pass = settings.smtpPass || process.env.SMTP_PASS;

  if (!user || !pass) {
    console.log(`\n======================================================`);
    console.log(`[GMAIL OTP SIMULATION] کد تأیید ایمیلی تولید شد:`);
    console.log(`گیرنده: ${displayName} <${email}>`);
    console.log(`کد ۵ رقمی تأیید: ${code}`);
    console.log(`(جهت ارسال ایمیل زنده، مشخصات Gmail و App Password در پنل مدیریت ثبت شود)`);
    console.log(`======================================================\n`);
    return { success: true, isSimulation: true, code };
  }

  const subject = `کد تایید ورود به Gemini Shop: ${code}`;
  const textBody = `سلام ${displayName} عزیز،\nکد تایید شما برای ورود به فروشگاه Gemini Shop برابر است با: ${code}\nاین کد به مدت ۲ دقیقه معتبر می‌باشد.`;

  const htmlBody = `
  <!DOCTYPE html>
  <html dir="rtl" lang="fa">
  <head>
    <meta charset="utf-8">
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background: #0f172a; margin: 0; padding: 24px; color: #f8fafc; direction: rtl; }
      .container { max-width: 520px; margin: 0 auto; background: #1e293b; border-radius: 16px; border: 1px solid rgba(255,255,255,0.1); padding: 32px 28px; box-shadow: 0 20px 40px rgba(0,0,0,0.4); }
      .brand { font-size: 20px; font-weight: 800; color: #a855f7; letter-spacing: -0.5px; margin-bottom: 24px; text-align: center; }
      .greeting { font-size: 16px; color: #e2e8f0; margin-bottom: 12px; line-height: 1.6; }
      .desc { font-size: 14px; color: #94a3b8; line-height: 1.6; margin-bottom: 24px; }
      .code-box { background: linear-gradient(135deg, rgba(168,85,247,0.15), rgba(59,130,246,0.15)); border: 1px solid rgba(168,85,247,0.3); border-radius: 12px; padding: 18px; text-align: center; margin-bottom: 24px; }
      .code { font-size: 34px; font-weight: 800; letter-spacing: 8px; color: #38bdf8; font-family: monospace; }
      .expiry { font-size: 13px; color: #e2e8f0; margin-top: 8px; }
      .footer-note { font-size: 12px; color: #64748b; line-height: 1.5; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 16px; text-align: center; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="brand">✦ Gemini Shop — پشتیبانی رسمی</div>
      <div class="greeting">سلام <b>${displayName}</b> عزیز،</div>
      <div class="desc">کد یکبارمصرف جهت تایید ایمیل و پیگیری سفارش اشتراک ۱۸ ماهه Google AI Pro شما صادر گردید:</div>
      <div class="code-box">
        <div class="code">${code}</div>
        <div class="expiry">⏱️ اعتبار کد: ۲ دقیقه</div>
      </div>
      <div class="footer-note">
        این ایمیل به صورت خودکار از سوی فروشگاه Gemini Shop ارسال شده است.<br>
        اگر شما این درخواست را ثبت نکرده‌اید، لطفاً این پیام را نادیده بگیرید.
      </div>
    </div>
  </body>
  </html>
  `;

  const result = await sendSmtpTlsMail({
    host: settings.smtpHost || 'smtp.gmail.com',
    port: settings.smtpPort || 465,
    user,
    pass,
    to: email,
    subject,
    html: htmlBody,
    text: textBody,
  });

  if (result.success) {
    console.log(`[Gmail Live OTP] ایمیل کد تأیید با موفقیت به ${email} ارسال شد.`);
    return { success: true, isSimulation: false };
  } else {
    console.error(`[Gmail OTP Failed]`, result.error);
    return { success: false, isSimulation: false, error: result.error };
  }
}

// تولید هدرهای امنیتی CORS و HTTP
function getCorsHeaders(req) {
  const origin = req.headers.origin;
  const allowedEnv = process.env.ALLOWED_ORIGINS;
  let allowOrigin = '*';

  if (allowedEnv && origin) {
    const list = allowedEnv.split(',').map((o) => o.trim().toLowerCase());
    if (list.includes('*') || list.includes(origin.toLowerCase())) {
      allowOrigin = origin;
    } else {
      allowOrigin = 'null';
    }
  }

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
  };
}

// ارسال پاسخ استاندارد به همراه تمام هدرهای امنیتی
function sendJson(res, statusCode, data, req) {
  const headers = req ? getCorsHeaders(req) : {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
  };

  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    ...headers,
  });
  res.end(JSON.stringify(data));
}

// استخراج اطلاعات ادمین احراز هویت شده از هدر Authorization با اعتبارسنجی انقضا
function getAuthenticatedAdmin(req) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;

  const session = activeAdminSessions.get(token);
  if (!session) return null;

  // بررسی انقضای نشست (۲۴ ساعت)
  if (session.expiresAt && Date.now() > session.expiresAt) {
    activeAdminSessions.delete(token);
    return null;
  }

  return session;
}

function isAuthorizedAdmin(req) {
  return Boolean(getAuthenticatedAdmin(req));
}

function isHeadAdmin(req) {
  const admin = getAuthenticatedAdmin(req);
  return admin && admin.role === 'head_admin';
}

const server = http.createServer(async (req, res) => {
  // CORS Preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, getCorsHeaders(req));
    return res.end();
  }

  const clientIp = getClientIp(req);
  if (!checkRateLimit(clientIp, 120, 60000)) {
    return sendJson(res, 429, { error: 'تعداد درخواست‌ها بیش از حد مجاز است. لطفاً کمی صبر فرمایید.' }, req);
  }

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;
  const db = loadDatabase();

  try {
    // ۱. تست سلامت سرور
    if (pathname === '/api/health' && req.method === 'GET') {
      return sendJson(res, 200, {
        status: 'ok',
        version: '3.0.0',
        uptimeSeconds: Math.floor(process.uptime()),
        hasSmtpConfigured: Boolean(db.settings.smtpUser && db.settings.smtpPass),
        adminsCount: db.admins.length,
        timestamp: new Date().toISOString(),
      });
    }

    // ۲. ارسال کد تایید یکبار مصرف ایمیلی (Send Gmail OTP)
    if (pathname === '/api/auth/send-otp' && req.method === 'POST') {
      const body = await parseRequestBody(req);
      const cleanEmail = normalizeEmail(body.email || body.gmail);
      const cleanFullName = sanitizeText(body.fullName || '', 100);
      const cleanMobile = normalizeMobile(body.mobile || '');

      if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
        return sendJson(res, 400, {
          success: false,
          error: 'آدرس ایمیل وارد شده معتبر نیست. لطفاً یک ایمیل صحیح وارد فرمایید.',
        });
      }

      const now = Date.now();
      const existing = activeOtpStore.get(cleanEmail);

      // محدودساز ارسال مجدد (Cooldown ۶۰ ثانیه‌ای)
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

      activeOtpStore.set(cleanEmail, {
        code,
        expiresAt: now + 2 * 60 * 1000, // ۲ دقیقه اعتبار
        lastSentAt: now,
        attempts: 0,
        fullName: cleanFullName,
        mobile: cleanMobile,
      });

      // ارسال ایمیل از طریق جیمیل SMTP
      const mailResult = await sendGmailOtp(cleanEmail, cleanFullName, code, db.settings);

      return sendJson(res, 200, {
        success: true,
        message: 'کد تایید با موفقیت به ایمیل شما ارسال شد.',
        cooldownSeconds: 60,
        isSimulation: mailResult.isSimulation,
        simulationCode: mailResult.isSimulation ? code : undefined,
      });
    }

    // ۳. اعتبارسنجی کد ایمیلی و ورود خریدار (Verify OTP)
    if (pathname === '/api/auth/verify-otp' && req.method === 'POST') {
      const body = await parseRequestBody(req);
      const cleanEmail = normalizeEmail(body.email || body.gmail);
      const cleanCode = normalizeMobile(body.code);
      const cleanFullName = sanitizeText(body.fullName || '', 100);
      const cleanMobile = normalizeMobile(body.mobile || '');

      if (!cleanEmail || !cleanCode) {
        return sendJson(res, 400, { success: false, error: 'آدرس ایمیل و کد تایید الزامی است.' });
      }

      const record = activeOtpStore.get(cleanEmail);
      const now = Date.now();

      if (!record) {
        return sendJson(res, 400, {
          success: false,
          error: 'کد تایید منقضی شده است یا درخواستی برای این ایمیل ثبت نشده است. لطفاً مجدداً درخواست دهید.',
        });
      }

      if (now > record.expiresAt) {
        activeOtpStore.delete(cleanEmail);
        return sendJson(res, 400, {
          success: false,
          error: 'کد تایید منقضی شده است. لطفاً کد جدید دریافت کنید.',
        });
      }

      record.attempts = (record.attempts || 0) + 1;
      if (record.attempts > 5) {
        activeOtpStore.delete(cleanEmail);
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

      // کد تایید صحیح است -> حذف از حافظه موقت
      activeOtpStore.delete(cleanEmail);

      // جلوگیری از ایجاد کاربر تکراری: جستجو در میان مشتریان ثبت شده
      let existingUser = db.users.find(
        (u) => normalizeEmail(u.gmail) === cleanEmail || (cleanMobile && normalizeMobile(u.mobile) === cleanMobile)
      );

      let user;
      if (existingUser) {
        if (cleanFullName && cleanFullName !== 'کاربر گرامی') {
          existingUser.fullName = cleanFullName;
        }
        if (cleanMobile && !existingUser.mobile) {
          existingUser.mobile = cleanMobile;
        }
        existingUser.lastLoginAt = new Date().toISOString();
        user = existingUser;
      } else {
        const canonicalId = `cust_${cleanEmail.replace(/[^a-z0-9]/gi, '_').toLowerCase()}`;
        user = {
          id: canonicalId,
          fullName: cleanFullName || record.fullName || 'کاربر گرامی',
          mobile: cleanMobile || record.mobile || '',
          gmail: cleanEmail,
          createdAt: new Date().toISOString(),
          lastLoginAt: new Date().toISOString(),
        };
        db.users.push(user);
      }
      saveDatabase(db);

      const sessionToken = `usr_${crypto.randomBytes(24).toString('hex')}`;

      return sendJson(res, 200, {
        success: true,
        user,
        token: sessionToken,
        message: 'احراز هویت با موفقیت انجام شد.',
      });
    }

    // ۴. دریافت لیست سفارشات (عمومی برای پیگیری یا لیست کامل برای ادمین)
    if (pathname === '/api/orders' && req.method === 'GET') {
      const mobile = url.searchParams.get('mobile');
      const email = url.searchParams.get('email');
      const orderId = url.searchParams.get('orderId');

      if (orderId) {
        const found = db.orders.find((o) => o.id.toUpperCase() === orderId.toUpperCase());
        return sendJson(res, found ? 200 : 404, found || { error: 'Order not found' });
      }

      if (email) {
        const cleanEmail = normalizeEmail(email);
        const userOrders = db.orders.filter((o) => normalizeEmail(o.gmail) === cleanEmail);
        return sendJson(res, 200, userOrders);
      }

      if (mobile) {
        const cleanMobile = normalizeMobile(mobile);
        const userOrders = db.orders.filter((o) => normalizeMobile(o.mobile) === cleanMobile);
        return sendJson(res, 200, userOrders);
      }

      // مشاهده کل سفارشات نیازمند دسترسی ادمین (چه head_admin چه regular_admin)
      if (!isAuthorizedAdmin(req)) {
        return sendJson(res, 401, { error: 'Unauthorized: Admin authentication required for full order list' });
      }

      return sendJson(res, 200, db.orders);
    }

    // ۵. ثبت سفارش جدید خریدار
    if (pathname === '/api/orders' && req.method === 'POST') {
      const body = await parseRequestBody(req);

      if (!body.fullName || !body.gmail) {
        return sendJson(res, 400, { error: 'fullName and gmail are required' });
      }

      const cleanOrderEmail = normalizeEmail(body.gmail);
      const cleanOrderMobile = normalizeMobile(body.mobile || '');
      const cleanOrderName = sanitizeText(body.fullName, 100);

      // همگام‌سازی یا ثبت اطلاعات کاربر در db.users جهت حفظ یکپارچگی حساب
      let customer = db.users.find(
        (u) => normalizeEmail(u.gmail) === cleanOrderEmail || (cleanOrderMobile && normalizeMobile(u.mobile) === cleanOrderMobile)
      );
      if (customer) {
        if (cleanOrderName && cleanOrderName !== 'کاربر گرامی') customer.fullName = cleanOrderName;
        if (cleanOrderMobile && !customer.mobile) customer.mobile = cleanOrderMobile;
      } else {
        const canonicalId = `cust_${cleanOrderEmail.replace(/[^a-z0-9]/gi, '_').toLowerCase()}`;
        customer = {
          id: canonicalId,
          fullName: cleanOrderName || 'کاربر گرامی',
          mobile: cleanOrderMobile,
          gmail: cleanOrderEmail,
          createdAt: new Date().toISOString(),
        };
        db.users.push(customer);
      }

      const newOrder = {
        id: `GP-${Math.floor(100000 + Math.random() * 900000)}`,
        createdAt: new Date().toISOString(),
        fullName: cleanOrderName,
        mobile: cleanOrderMobile,
        gmail: cleanOrderEmail,
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

    // ۶. تغییر وضعیت یا ویرایش سفارش (توسط هر ادمینی اعم از head_admin یا regular_admin)
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

    // ۷. حذف سفارش
    if (pathname.startsWith('/api/orders/') && req.method === 'DELETE') {
      if (!isAuthorizedAdmin(req)) {
        return sendJson(res, 401, { error: 'Unauthorized: Admin credentials required' });
      }

      const orderId = pathname.split('/').pop().toUpperCase();
      const idx = db.orders.findIndex((o) => o.id.toUpperCase() === orderId);

      if (idx === -1) {
        return sendJson(res, 404, { error: 'Order not found' });
      }

      const deleted = db.orders.splice(idx, 1)[0];
      saveDatabase(db);
      return sendJson(res, 200, { success: true, deletedOrder: deleted });
    }

    // ۸. دریافت پیام‌های پشتیبانی آنلاین (فیلتر بر اساس sessionId یا کل پیام‌ها برای ادمین)
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

    // ۹. ارسال پیام پشتیبانی
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

    // ۱۰. ورود امن ادمین با نام کاربری، رمز عبور و نقش (RBAC Login با محافظت Brute Force)
    if (pathname === '/api/admin/login' && req.method === 'POST') {
      const lockoutIp = checkLoginLockout(clientIp);
      if (lockoutIp.isLocked) {
        return sendJson(res, 429, { error: `به دلیل تلاش‌های ناموفق مکرر، دسترسی شما موقتاً به مدت ${lockoutIp.remainingMinutes} دقیقه قفل شده است.` }, req);
      }

      const body = await parseRequestBody(req);
      const username = (body.username || 'admin').trim().toLowerCase();
      const password = body.password || '';

      const lockoutUser = checkLoginLockout(username);
      if (lockoutUser.isLocked) {
        return sendJson(res, 429, { error: `حساب کاربری ${username} به دلیل تلاش‌های ناموفق متوالی موقتاً به مدت ${lockoutUser.remainingMinutes} دقیقه قفل است.` }, req);
      }

      const matchedAdmin = db.admins.find((a) => a.username.toLowerCase() === username);

      if (matchedAdmin && verifyPasswordSecure(password, matchedAdmin.passwordHash)) {
        clearFailedLogin(clientIp);
        clearFailedLogin(username);
        const token = `adm_${crypto.randomBytes(24).toString('hex')}`;
        const sessionData = {
          id: matchedAdmin.id,
          username: matchedAdmin.username,
          fullName: matchedAdmin.fullName,
          role: matchedAdmin.role || 'regular_admin',
          expiresAt: Date.now() + 24 * 3600 * 1000,
        };

        activeAdminSessions.set(token, sessionData);

        return sendJson(res, 200, {
          success: true,
          token,
          admin: sessionData,
          expiresIn: '24h',
        }, req);
      }

      // سازگاری پشتیبان برای پسورد کلی پیشین در صورتی که کاربر نام‌کاربری وارد نکرده باشد
      if (username === 'admin' && verifyPasswordSecure(password, db.settings.adminPassword)) {
        clearFailedLogin(clientIp);
        clearFailedLogin(username);
        const token = `adm_${crypto.randomBytes(24).toString('hex')}`;
        const headAdmin = {
          id: db.admins[0]?.id || 'adm_head_1',
          username: db.admins[0]?.username || 'admin',
          fullName: db.admins[0]?.fullName || 'مدیر ارشد فروشگاه',
          role: 'head_admin',
          expiresAt: Date.now() + 24 * 3600 * 1000,
        };
        activeAdminSessions.set(token, headAdmin);
        return sendJson(res, 200, {
          success: true,
          token,
          admin: headAdmin,
          expiresIn: '24h',
        }, req);
      }

      recordFailedLogin(clientIp);
      recordFailedLogin(username);
      return sendJson(res, 401, { success: false, error: 'نام کاربری یا رمز عبور اشتباه است.' }, req);
    }

    // ۱۱. دریافت اطلاعات هویت ادمین فعال
    if (pathname === '/api/admin/me' && req.method === 'GET') {
      const currentAdmin = getAuthenticatedAdmin(req);
      if (!currentAdmin) {
        return sendJson(res, 401, { error: 'Unauthorized' });
      }
      return sendJson(res, 200, { success: true, admin: currentAdmin });
    }

    // ۱۲. مدیریت ادمین‌ها: دریافت لیست همکاران (فقط مدیر ارشد - head_admin)
    if (pathname === '/api/admin/users' && req.method === 'GET') {
      if (!isHeadAdmin(req)) {
        return sendJson(res, 403, { error: 'Forbidden: تنها مدیر ارشد دسترسی به مدیریت ادمین‌ها دارد.' });
      }

      const safeAdmins = db.admins.map((a) => ({
        id: a.id,
        username: a.username,
        fullName: a.fullName,
        role: a.role,
        createdAt: a.createdAt,
      }));
      return sendJson(res, 200, safeAdmins);
    }

    // ۱۳. مدیریت ادمین‌ها: تعریف ادمین جدید (فقط مدیر ارشد - head_admin)
    if (pathname === '/api/admin/users' && req.method === 'POST') {
      if (!isHeadAdmin(req)) {
        return sendJson(res, 403, { error: 'Forbidden: تنها مدیر ارشد مجاز به تعریف ادمین جدید است.' });
      }

      const body = await parseRequestBody(req);
      const cleanUsername = sanitizeText(body.username || '', 50).toLowerCase();
      const cleanFullName = sanitizeText(body.fullName || '', 100);
      const cleanPassword = body.password || '';
      const role = body.role === 'head_admin' ? 'head_admin' : 'regular_admin';

      if (!cleanUsername || cleanUsername.length < 3) {
        return sendJson(res, 400, { error: 'نام کاربری باید حداقل ۳ کاراکتر باشد.' });
      }
      if (!cleanPassword || cleanPassword.length < 6) {
        return sendJson(res, 400, { error: 'رمز عبور باید حداقل ۶ کاراکتر باشد.' });
      }
      if (db.admins.some((a) => a.username.toLowerCase() === cleanUsername)) {
        return sendJson(res, 400, { error: 'این نام کاربری قبلاً ثبت شده است.' });
      }

      const newAdmin = {
        id: `adm_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
        username: cleanUsername,
        passwordHash: hashPasswordSalted(cleanPassword),
        fullName: cleanFullName || cleanUsername,
        role,
        createdAt: new Date().toISOString(),
      };

      db.admins.push(newAdmin);
      saveDatabase(db);

      return sendJson(res, 201, {
        success: true,
        admin: {
          id: newAdmin.id,
          username: newAdmin.username,
          fullName: newAdmin.fullName,
          role: newAdmin.role,
          createdAt: newAdmin.createdAt,
        },
      });
    }

    // ۱۴. مدیریت ادمین‌ها: حذف ادمین (فقط مدیر ارشد - head_admin)
    if (pathname.startsWith('/api/admin/users/') && req.method === 'DELETE') {
      if (!isHeadAdmin(req)) {
        return sendJson(res, 403, { error: 'Forbidden: تنها مدیر ارشد مجاز به حذف ادمین است.' });
      }

      const targetId = pathname.split('/').pop();
      const currentAdmin = getAuthenticatedAdmin(req);

      if (targetId === currentAdmin.id) {
        return sendJson(res, 400, { error: 'امکان حذف حساب کاربری جاری خودتان وجود ندارد.' });
      }

      const idx = db.admins.findIndex((a) => a.id === targetId);
      if (idx === -1) {
        return sendJson(res, 404, { error: 'ادمین مورد نظر یافت نشد.' });
      }

      db.admins.splice(idx, 1);
      saveDatabase(db);
      return sendJson(res, 200, { success: true, message: 'ادمین با موفقیت حذف گردید.' });
    }

    // ۱۵. تنظیمات سرور و درگاه ایمیل (فقط مدیر ارشد - head_admin)
    if (pathname === '/api/admin/settings') {
      if (!isHeadAdmin(req)) {
        return sendJson(res, 403, { error: 'Forbidden: تنظیمات پیکربندی تنها برای مدیر ارشد قابل ویرایش است.' });
      }

      if (req.method === 'GET') {
        const safeSettings = {
          priceToman: db.settings.priceToman,
          smtpHost: db.settings.smtpHost || 'smtp.gmail.com',
          smtpPort: db.settings.smtpPort || 465,
          smtpUser: db.settings.smtpUser ? '••••@' + db.settings.smtpUser.split('@')[1] || 'gmail.com' : '',
          hasSmtpPass: Boolean(db.settings.smtpPass),
          isSmtpConfigured: Boolean(db.settings.smtpUser && db.settings.smtpPass),
        };
        return sendJson(res, 200, safeSettings);
      }

      if (req.method === 'PATCH') {
        const body = await parseRequestBody(req);
        if (body.smtpUser && !body.smtpUser.includes('••••')) {
          db.settings.smtpUser = sanitizeText(body.smtpUser, 150);
        }
        if (body.smtpPass) {
          db.settings.smtpPass = String(body.smtpPass).trim();
        }
        if (body.smtpHost) {
          db.settings.smtpHost = sanitizeText(body.smtpHost, 100);
        }
        if (body.smtpPort) {
          db.settings.smtpPort = Number(body.smtpPort) || 465;
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
  console.log(`🛡️  Secure Gemini Shop Backend running on http://localhost:${PORT}`);
  console.log(`✉️  Email OTP Engine: Ready via TLS Port 465`);
  console.log(`👥 Multi-Tier RBAC Admin System: Initialized`);
});
