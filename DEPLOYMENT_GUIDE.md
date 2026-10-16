# 🌐 راهنمای جامع استقرار و انتشار (Deployment Guide)

این راهنما نحوه استقرار پروژه **Gemini Shop** را روی انواع بسترهای ابری و سرورهای میزبانی توضیح می‌دهد.

---

## 📦 روش اول: انتشار استاتیک فرانت‌اند (سریع‌ترین و کم‌هزینه‌ترین)

پروژه به صورت مستقل با حافظه مرورگر (LocalStorage) و همگام‌سازی کلاینت بدون نیاز به سرور فعال عمل می‌کند. این روش برای پلتفرم‌های ابری رایگان و با ترافیک بالا بسیار ایده‌آل است.

### مراحل ساخت بیلد:
```bash
npm run build
```
پوشه خروجی `dist/` تمام فایل‌های نهایی شامل `index.html`، فایل‌های CSS، جاوااسکریپت و تصاویر بهینه‌سازی‌شده را دارا می‌باشد.

### الف) آپلود در Cloudflare Pages / Vercel:
1. پروژه را به گیت‌هاب (GitHub) متصل کنید.
2. در داشبورد پلتفرم، یک پروژه جدید بسازید:
   - **Framework Preset:** Vite
   - **Build Command:** `npm run build`
   - **Build Output Directory:** `dist`
3. دکمه Deploy را بزنید. سایت در کمتر از ۱ دقیقه با CDN جهانی و گواهی SSL رایگان در دسترس خواهد بود.

### ب) آپلود در هاست‌های اشتراکی سی‌پنل (cPanel) یا دایرکت‌ادمین:
1. وارد File Manager هاست شوید.
2. به مسیر `public_html` بروید.
3. تمام محتویات داخل پوشه `dist/` (نه خود پوشه `dist`، بلکه فایل‌های درون آن) را در `public_html` آپلود و استخراج نمایید.
4. در صورت نیاز به ریدایرکت SPA، یک فایل به نام `.htaccess` در `public_html` بسازید و محتوای زیر را در آن قرار دهید:
```apache
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  RewriteRule ^index\.html$ - [L]
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule . /index.html [L]
</IfModule>
```

---

## 🖥️ روش دوم: استقرار فول‌استک روی سرور مجازی (Ubuntu VPS) با PM2 و NGINX

اگر می‌خواهید بک‌اند Node.js را نیز به صورت دائم و متمرکز فعال داشته باشید:

### ۱. نصب پیش‌نیازها روی سرور لینوکس:
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install nodejs npm nginx -y
sudo npm install -g pm2
```

### ۲. انتقال پروژه به سرور:
پوشه پروژه را در مسیر `/var/www/gemini-store` قرار دهید.

### ۳. راه‌اندازی سرویس بک‌اند با PM2:
```bash
cd /var/www/gemini-store
pm2 start server/index.js --name "gemini-store-api"
pm2 save
pm2 startup
```

### ۴. ساخت بیلد فرانت‌اند:
```bash
cd /var/www/gemini-store
npm install
npm run build
```

### ۵. تنظیم NGINX:
فایل تنظیمات سایت را ویرایش کنید (`sudo nano /etc/nginx/sites-available/gemini-store`):
```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    # فایل‌های فرانت‌اند
    root /var/www/gemini-store/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # هدایت درخواست‌های API به بک‌اند Node.js
    location /api/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
    }
}
```
سپس تنظیمات را فعال کنید:
```bash
sudo ln -s /etc/nginx/sites-available/gemini-store /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### ۶. فعال‌سازی گواهی رایگان SSL (Let's Encrypt):
```bash
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

---

## ☁️ روش سوم: استقرار سریع روی پلتفرم لیارا (Liara)

1. یک برنامه از نوع **NodeJS** در پنل لیارا ایجاد نمایید.
2. یک فایل `liara.json` در ریشه پروژه قرار دهید:
```json
{
  "app": "gemini-pro-store",
  "port": 3001,
  "node": {
    "version": "18"
  }
}
```
3. دستور استقرار را اجرا کنید:
```bash
liara deploy
```
