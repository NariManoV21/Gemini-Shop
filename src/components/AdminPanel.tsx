import { useEffect, useState } from 'react';
import { PAYMENT_CONFIG, SUPPORT } from '../config/site';
import { formatToman } from '../lib/format';
import {
  type ChatMessage,
  getAllChatMessages,
  markSessionAsRead,
  sendAdminReply,
} from '../services/chatService';
import {
  approveOrder,
  deleteOrder,
  getStoredOrders,
  rejectOrder,
  type StoreOrder,
} from '../services/orderStorage';
import { Icon } from './Icon';
import './AdminPanel.css';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function AdminPanel({ open, onClose }: Props) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState(false);

  const [activeTab, setActiveTab] = useState<'dashboard' | 'orders' | 'chat' | 'settings'>('dashboard');

  const [orders, setOrders] = useState<StoreOrder[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'today' | 'pending_verification' | 'approved' | 'rejected'>('all');

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [adminReplyInput, setAdminReplyInput] = useState('');

  const [approveModalOrder, setApproveModalOrder] = useState<StoreOrder | null>(null);
  const [customLinkInput, setCustomLinkInput] = useState('');
  const [adminNoteInput, setAdminNoteInput] = useState('');

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedDeliveryMsg, setCopiedDeliveryMsg] = useState<string | null>(null);

  // تنظیمات وب‌سرویس پیامکی sms.ir
  const [smsApiKey, setSmsApiKey] = useState('');
  const [smsTemplateId, setSmsTemplateId] = useState('');
  const [smsParamName, setSmsParamName] = useState('Code');
  const [smsConfigured, setSmsConfigured] = useState(false);
  const [smsSavedToast, setSmsSavedToast] = useState(false);

  // بررسی وضعیت لاگین قبلی از sessionStorage
  useEffect(() => {
    if (sessionStorage.getItem('gemini_admin_auth') === 'true') {
      setIsAuthenticated(true);
    }
  }, []);

  // واکشی تنظیمات پیامک از سرور
  useEffect(() => {
    if (open && isAuthenticated) {
      fetch('http://localhost:3001/api/admin/settings', {
        headers: { Authorization: 'Bearer gemini_admin_session_token' },
      })
        .then((res) => res.json())
        .then((data) => {
          if (data) {
            if (data.smsApiKey) setSmsApiKey(data.smsApiKey);
            if (data.smsTemplateId) setSmsTemplateId(data.smsTemplateId);
            if (data.smsParamName) setSmsParamName(data.smsParamName);
            setSmsConfigured(Boolean(data.isSmsConfigured));
          }
        })
        .catch(() => {});
    }
  }, [open, isAuthenticated]);

  const handleSaveSmsSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('http://localhost:3001/api/admin/settings', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer gemini_admin_session_token',
        },
        body: JSON.stringify({
          smsApiKey,
          smsTemplateId,
          smsParamName,
        }),
      });
      if (res.ok) {
        setSmsConfigured(Boolean(smsApiKey && smsTemplateId));
        setSmsSavedToast(true);
        setTimeout(() => setSmsSavedToast(false), 2500);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // بارگذاری داده‌ها
  useEffect(() => {
    if (!open) return;

    const loadData = () => {
      setOrders(getStoredOrders());
      setChatMessages(getAllChatMessages());
    };

    loadData();

    const handleOrders = () => setOrders(getStoredOrders());
    const handleChat = () => setChatMessages(getAllChatMessages());

    window.addEventListener('gemini_orders_updated', handleOrders);
    window.addEventListener('gemini_chat_updated', handleChat);

    return () => {
      window.removeEventListener('gemini_orders_updated', handleOrders);
      window.removeEventListener('gemini_chat_updated', handleChat);
    };
  }, [open]);

  if (!open) return null;

  // ورود به پنل
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === 'admin123' || password === 'admin') {
      setIsAuthenticated(true);
      sessionStorage.setItem('gemini_admin_auth', 'true');
      setLoginError(false);
    } else {
      setLoginError(true);
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    sessionStorage.removeItem('gemini_admin_auth');
  };

  // محاسبات آمار کاربردی داشبورد
  const totalRevenue = orders.reduce((sum, o) => (o.status === 'approved' ? sum + o.amountToman : sum), 0);
  const pendingOrders = orders.filter((o) => o.status === 'pending_verification');
  const approvedOrders = orders.filter((o) => o.status === 'approved');
  const rejectedOrders = orders.filter((o) => o.status === 'rejected');

  // سفارشات امروز
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayOrders = orders.filter((o) => o.createdAt.slice(0, 10) === todayStr);
  const todayRevenue = todayOrders.filter((o) => o.status === 'approved').reduce((sum, o) => sum + o.amountToman, 0);

  // جلسات چت
  const chatSessionsMap = new Map<string, { lastMsg: ChatMessage; unreadCount: number }>();
  chatMessages.forEach((m) => {
    const existing = chatSessionsMap.get(m.sessionId);
    const unread = !m.isRead && m.sender === 'user' ? (existing ? existing.unreadCount + 1 : 1) : (existing ? existing.unreadCount : 0);
    chatSessionsMap.set(m.sessionId, { lastMsg: m, unreadCount: unread });
  });

  const chatSessions = Array.from(chatSessionsMap.entries()).map(([sessionId, info]) => ({
    sessionId,
    lastMsg: info.lastMsg,
    unreadCount: info.unreadCount,
  }));

  // فیلتر هوشمند سفارش‌ها
  const filteredOrders = orders.filter((o) => {
    let matchesStatus = true;
    if (statusFilter === 'today') {
      matchesStatus = o.createdAt.slice(0, 10) === todayStr;
    } else if (statusFilter !== 'all') {
      matchesStatus = o.status === statusFilter;
    }

    const q = searchQuery.trim().toLowerCase();
    const cleanQ = q.replace(/^0+/, ''); // پشتیبانی از جستجوی شماره بدون صفر
    const matchesQuery =
      !q ||
      o.id.toLowerCase().includes(q) ||
      o.fullName.toLowerCase().includes(q) ||
      o.mobile.includes(cleanQ) ||
      o.gmail.toLowerCase().includes(q) ||
      o.paymentRef.includes(q);

    return matchesStatus && matchesQuery;
  });

  // باز کردن مدال تأیید و تمپلیت دعوت
  const handleQuickApprove = (order: StoreOrder) => {
    const defaultLink = `https://one.google.com/promo/google-ai-pro-invite?order=${order.id}&account=${encodeURIComponent(order.gmail)}`;
    setCustomLinkInput(defaultLink);
    setAdminNoteInput('واریز بررسی و تأیید شد.');
    setApproveModalOrder(order);
  };

  const confirmApproval = () => {
    if (!approveModalOrder) return;
    approveOrder(approveModalOrder.id, customLinkInput, adminNoteInput);
    setApproveModalOrder(null);
  };

  const handleReject = (orderId: string) => {
    const reason = prompt('علت رد فیش را برای ثبت در گزارش وارد نمایید:', 'مغایرت فیش واریزی با مبلغ ۴۹۹,۰۰۰ تومان');
    if (reason !== null) {
      rejectOrder(orderId, reason);
    }
  };

  const handleDelete = (orderId: string) => {
    if (confirm(`آیا از حذف سفارش ${orderId} اطمینان دارید؟`)) {
      deleteOrder(orderId);
    }
  };

  // کپی سریع متن پیامک / تلگرام آماده تحویل لایسنس به مشتری
  const copyCustomerDeliveryText = (order: StoreOrder) => {
    const link = order.activationLink || `https://one.google.com/promo/google-ai-pro-invite?order=${order.id}&account=${encodeURIComponent(order.gmail)}`;
    const text = `سلام ${order.fullName} گرامی،\nاشتراک ۱۸ ماهه Google AI Pro شما با موفقیت فعال شد.\n\nکد سفارش: ${order.id}\nلینک فعال‌سازی رسمی گوگل:\n${link}\n\nپشتیبانی Gemini Shop`;
    navigator.clipboard.writeText(text);
    setCopiedDeliveryMsg(order.id);
    setTimeout(() => setCopiedDeliveryMsg(null), 2000);
  };

  // کپی ساده متن
  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  // ارسال پاسخ ادمین در چت
  const handleAdminSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSessionId || !adminReplyInput.trim()) return;

    sendAdminReply(selectedSessionId, adminReplyInput);
    setAdminReplyInput('');
  };

  // خروجی استاندارد CSV
  const exportToCSV = () => {
    const headers = ['کد سفارش', 'تاریخ', 'نام خریدار', 'موبایل', 'جیمیل', 'مبلغ (تومان)', 'روش پرداخت', 'کد پیگیری', 'وضعیت', 'لینک فعال‌سازی', 'یادداشت ادمین'];
    const rows = orders.map((o) => [
      o.id,
      new Date(o.createdAt).toLocaleDateString('fa-IR'),
      o.fullName,
      o.mobile,
      o.gmail,
      o.amountToman,
      o.paymentMethod === 'bezanbekart' ? 'درگاه بزن به کارت' : 'کارت به کارت',
      o.paymentRef,
      o.status === 'approved' ? 'تأییدشده' : o.status === 'pending_verification' ? 'در انتظار بررسی' : 'رد شده',
      o.activationLink || '-',
      o.adminNotes || '-',
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers, ...rows].map((e) => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `GeminiShop_Orders_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // فرم ورود تمیز بدون افکت‌های شلوغ
  if (!isAuthenticated) {
    return (
      <div className="admin-overlay" dir="rtl">
        <div className="admin-login-card">
          <div className="admin-login__head">
            <div className="admin-login__icon-wrap">
              <Icon name="lock" size={24} />
            </div>
            <h2>ورود به پنل مدیریت Gemini Shop</h2>
            <p>جهت مدیریت سفارشات و پاسخگویی به چت آنلاین، شناسه امنیتی خود را وارد فرمایید</p>
          </div>

          <form onSubmit={handleLogin} className="admin-login__form">
            <div className="admin-login__field">
              <label>رمز عبور مدیریت:</label>
              <input
                type="password"
                placeholder="رمز عبور پیش‌فرض: admin123"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
              />
            </div>

            {loginError && <div className="admin-login__error">رمز عبور صحیح نمی‌باشد. لطفاً مجدداً بررسی فرمایید.</div>}

            <div className="admin-login__actions">
              <button type="submit" className="btn btn--accent">ورود به پنل</button>
              <button type="button" className="btn btn--ghost" onClick={onClose}>انصراف</button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-overlay" dir="rtl">
      <div className="admin-panel">
        {/* نوار بالای پنل */}
        <header className="admin-header">
          <div className="admin-header__brand">
            <div className="admin-header__badge">
              <Icon name="shield" size={16} />
            </div>
            <div>
              <h1>پنل مدیریت فروشگاه Gemini Shop</h1>
              <span className="admin-header__live-tag">
                <span className="live-dot" /> لایه داده و وب‌سایت همگام
              </span>
            </div>
          </div>

          <nav className="admin-header__tabs">
            <button
              className={`admin-tab ${activeTab === 'dashboard' ? 'is-active' : ''}`}
              onClick={() => setActiveTab('dashboard')}
            >
              <Icon name="grid" size={15} />
              <span>داشبورد و آمار</span>
            </button>
            <button
              className={`admin-tab ${activeTab === 'orders' ? 'is-active' : ''}`}
              onClick={() => setActiveTab('orders')}
            >
              <Icon name="bag" size={15} />
              <span>مدیریت سفارش‌ها</span>
              {pendingOrders.length > 0 && <span className="tab-badge">{pendingOrders.length}</span>}
            </button>
            <button
              className={`admin-tab ${activeTab === 'chat' ? 'is-active' : ''}`}
              onClick={() => setActiveTab('chat')}
            >
              <Icon name="headset" size={15} />
              <span>صندوق چت پشتیبانی</span>
              {chatMessages.filter((m) => !m.isRead && m.sender === 'user').length > 0 && (
                <span className="tab-badge tab-badge--blue">
                  {chatMessages.filter((m) => !m.isRead && m.sender === 'user').length}
                </span>
              )}
            </button>
            <button
              className={`admin-tab ${activeTab === 'settings' ? 'is-active' : ''}`}
              onClick={() => setActiveTab('settings')}
            >
              <Icon name="code" size={15} />
              <span>اطلاعات حساب بانکی</span>
            </button>
          </nav>

          <div className="admin-header__controls">
            <button className="btn btn--sm btn--ghost" onClick={handleLogout} title="خروج از حساب">
              <Icon name="lock" size={14} />
              <span>خروج</span>
            </button>
            <button className="btn btn--sm admin-close-btn" onClick={onClose} aria-label="بستن پنل">
              <Icon name="close" size={16} />
            </button>
          </div>
        </header>

        {/* بدنه محتوا */}
        <div className="admin-content">
          {/* تب ۱: داشبورد و آمار تحلیلی کاربردی */}
          {activeTab === 'dashboard' && (
            <div className="admin-view admin-dashboard">
              {/* کارت‌های آماری استاندارد و حرفه‌ای */}
              <div className="stats-grid">
                <div className="stat-card stat-card--revenue">
                  <div className="stat-card__icon"><Icon name="sparkle" size={20} /></div>
                  <div className="stat-card__info">
                    <span>مجموع درآمد تحقق‌یافته</span>
                    <strong>{formatToman(totalRevenue)} <small>تومان</small></strong>
                    <div className="stat-sub">فروش امروز: {formatToman(todayRevenue)} تومان</div>
                  </div>
                </div>

                <div className="stat-card stat-card--pending">
                  <div className="stat-card__icon"><Icon name="clock" size={20} /></div>
                  <div className="stat-card__info">
                    <span>فیش‌های در انتظار بررسی</span>
                    <strong>{pendingOrders.length} <small>سفارش نیازمند اقدام</small></strong>
                    <div className="stat-sub">کل سفارشات امروز: {todayOrders.length} مورد</div>
                  </div>
                </div>

                <div className="stat-card stat-card--approved">
                  <div className="stat-card__icon"><Icon name="check" size={20} /></div>
                  <div className="stat-card__info">
                    <span>اکانت‌های فعال و تحویل‌شده</span>
                    <strong>{approvedOrders.length} <small>مشتری فعال</small></strong>
                    <div className="stat-sub">نرخ موفقیت تأیید: {orders.length ? Math.round((approvedOrders.length / orders.length) * 100) : 100}٪</div>
                  </div>
                </div>

                <div className="stat-card stat-card--chat">
                  <div className="stat-card__icon"><Icon name="headset" size={20} /></div>
                  <div className="stat-card__info">
                    <span>جلسات چت و گفتگو</span>
                    <strong>{chatSessions.length} <small>مکالمه آنلاین</small></strong>
                    <div className="stat-sub">پاسخگویی سریع فعال</div>
                  </div>
                </div>
              </div>

              {/* بخش سفارش‌های نیازمند اقدام فوری */}
              <div className="dashboard-section">
                <div className="dashboard-section__head">
                  <div className="head-title-wrap">
                    <span className="dot-indicator dot-indicator--amber" />
                    <h3>سفارش‌های در نوبت بررسی و صدور لایسنس</h3>
                  </div>
                  <button className="btn btn--sm btn--ghost" onClick={() => { setActiveTab('orders'); setStatusFilter('pending_verification'); }}>
                    مشاهده لیست کامل سفارشات
                  </button>
                </div>

                {pendingOrders.length === 0 ? (
                  <div className="empty-state">
                    <Icon name="check" size={32} />
                    <p>تمام فیش‌های واریزی بررسی شده‌اند و سفارش معوقه‌ای وجود ندارد.</p>
                  </div>
                ) : (
                  <div className="quick-orders-list">
                    {pendingOrders.slice(0, 5).map((o) => (
                      <div key={o.id} className="quick-order-row">
                        <div className="quick-order-main">
                          <b className="en">{o.id}</b>
                          <strong>{o.fullName}</strong>
                          <span className="en text-muted">{o.gmail}</span>
                          <span className="en text-muted">{o.mobile}</span>
                        </div>
                        <div className="quick-order-pay">
                          <span>کد پیگیری: <strong className="en">{o.paymentRef}</strong></span>
                          <span>{formatToman(o.amountToman)} تومان</span>
                        </div>
                        <div className="quick-order-actions">
                          <button className="btn btn--sm btn--accent" onClick={() => handleQuickApprove(o)}>
                            <Icon name="check" size={13} /> تأیید و صدور لینک
                          </button>
                          <button className="btn btn--sm btn--ghost" onClick={() => handleReject(o.id)}>
                            <Icon name="close" size={13} /> رد
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* تب ۲: مدیریت جامع سفارشات با ویجت‌های فوق‌العاده کاربردی */}
          {activeTab === 'orders' && (
            <div className="admin-view admin-orders">
              {/* نوار فیلتر و جستجوی پیشرفته */}
              <div className="orders-toolbar">
                <div className="orders-search">
                  <Icon name="search" size={16} />
                  <input
                    type="text"
                    placeholder="جستجو با کد سفارش (GP-...)، شماره موبایل، جیمیل، نام یا شماره پیگیری..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  {searchQuery && (
                    <button className="clear-btn" onClick={() => setSearchQuery('')} aria-label="پاک کردن">
                      <Icon name="close" size={14} />
                    </button>
                  )}
                </div>

                <div className="orders-filters">
                  <button
                    className={`filter-btn ${statusFilter === 'all' ? 'is-active' : ''}`}
                    onClick={() => setStatusFilter('all')}
                  >
                    همه ({orders.length})
                  </button>
                  <button
                    className={`filter-btn filter-btn--today ${statusFilter === 'today' ? 'is-active' : ''}`}
                    onClick={() => setStatusFilter('today')}
                  >
                    سفارشات امروز ({todayOrders.length})
                  </button>
                  <button
                    className={`filter-btn filter-btn--pending ${statusFilter === 'pending_verification' ? 'is-active' : ''}`}
                    onClick={() => setStatusFilter('pending_verification')}
                  >
                    در انتظار بررسی ({pendingOrders.length})
                  </button>
                  <button
                    className={`filter-btn filter-btn--approved ${statusFilter === 'approved' ? 'is-active' : ''}`}
                    onClick={() => setStatusFilter('approved')}
                  >
                    فعال‌شده ({approvedOrders.length})
                  </button>
                  <button
                    className={`filter-btn filter-btn--rejected ${statusFilter === 'rejected' ? 'is-active' : ''}`}
                    onClick={() => setStatusFilter('rejected')}
                  >
                    رد شده ({rejectedOrders.length})
                  </button>
                </div>

                <button className="btn btn--sm btn--ghost export-btn" onClick={exportToCSV}>
                  <Icon name="external" size={14} /> دانلود خروجی اکسل (CSV)
                </button>
              </div>

              {/* جدول داده‌های تمیز و ساخت‌یافته */}
              <div className="table-responsive">
                <table className="orders-table">
                  <thead>
                    <tr>
                      <th>کد رهگیری</th>
                      <th>تاریخ و زمان</th>
                      <th>خریدار و شماره تماس</th>
                      <th>جیمیل فعال‌سازی</th>
                      <th>روش و کد پیگیری</th>
                      <th>وضعیت</th>
                      <th>اقدامات ادمین</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOrders.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="table-empty">
                          هیچ سفارشی مطابق این فیلتر یا عبارت جستجو یافت نشد
                        </td>
                      </tr>
                    ) : (
                      filteredOrders.map((o) => (
                        <tr key={o.id} className={`order-status-row--${o.status}`}>
                          <td>
                            <div className="order-id-cell">
                              <b className="en">{o.id}</b>
                              <button
                                className="copy-icon-btn"
                                onClick={() => copyToClipboard(o.id, `id_${o.id}`)}
                                title="کپی کد سفارش"
                              >
                                <Icon name="copy" size={12} />
                              </button>
                              {copiedId === `id_${o.id}` && <span className="copied-tooltip">کپی شد</span>}
                            </div>
                          </td>
                          <td className="time-cell">
                            {new Date(o.createdAt).toLocaleDateString('fa-IR')}
                            <small className="en">{new Date(o.createdAt).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })}</small>
                          </td>
                          <td>
                            <strong>{o.fullName}</strong>
                            <div className="cell-sub">
                              <span className="en">{o.mobile}</span>
                              <button
                                className="copy-icon-btn"
                                onClick={() => copyToClipboard(o.mobile, `mob_${o.id}`)}
                                title="کپی شماره موبایل"
                              >
                                <Icon name="copy" size={11} />
                              </button>
                              <a href={`tel:${o.mobile}`} className="call-link" title="تماس مستقیم">
                                <Icon name="headset" size={11} />
                              </a>
                            </div>
                          </td>
                          <td>
                            <div className="gmail-cell">
                              <span className="en">{o.gmail}</span>
                              <button
                                className="copy-icon-btn"
                                onClick={() => copyToClipboard(o.gmail, `gm_${o.id}`)}
                                title="کپی آدرس جیمیل"
                              >
                                <Icon name="copy" size={11} />
                              </button>
                            </div>
                          </td>
                          <td>
                            <span className="badge-pay-method">
                              {o.paymentMethod === 'bezanbekart' ? 'بزن به کارت' : 'کارت به کارت'}
                            </span>
                            <div className="cell-sub">
                              <span>پیگیری: <strong className="en">{o.paymentRef}</strong></span>
                            </div>
                          </td>
                          <td>
                            <span className={`status-pill status-pill--${o.status}`}>
                              <span className="status-dot" />
                              {o.status === 'approved'
                                ? 'فعال‌شده'
                                : o.status === 'pending_verification'
                                ? 'در انتظار بررسی'
                                : 'عدم تایید'}
                            </span>
                          </td>
                          <td>
                            <div className="action-buttons">
                              {/* ویجت پرکاربرد: کپی متن آماده پیامک/تلگرام به مشتری */}
                              {o.status === 'approved' && (
                                <button
                                  className="btn btn--sm btn--delivery"
                                  onClick={() => copyCustomerDeliveryText(o)}
                                  title="کپی پیام آماده تلگرام/پیامک تحویل لایسنس به مشتری"
                                >
                                  <Icon name="send" size={12} />
                                  <span>{copiedDeliveryMsg === o.id ? 'متن کپی شد!' : 'کپی پیام تحویل'}</span>
                                </button>
                              )}

                              {o.status !== 'approved' && (
                                <button
                                  className="btn btn--sm btn--accent"
                                  onClick={() => handleQuickApprove(o)}
                                  title="تأیید فیش و صدور لینک فعال‌سازی"
                                >
                                  <Icon name="check" size={12} /> تأیید
                                </button>
                              )}

                              {o.status === 'approved' && o.activationLink && (
                                <a
                                  href={o.activationLink}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="btn btn--sm btn--ghost"
                                  title="مشاهده لینک دعوت رسمی گوگل"
                                >
                                  <Icon name="external" size={12} /> لینک
                                </a>
                              )}

                              {o.status !== 'rejected' && (
                                <button
                                  className="btn btn--sm btn--ghost text-red"
                                  onClick={() => handleReject(o.id)}
                                  title="رد فیش واریزی"
                                >
                                  <Icon name="close" size={12} />
                                </button>
                              )}

                              <button
                                className="btn btn--sm btn--ghost text-muted"
                                onClick={() => handleDelete(o.id)}
                                title="حذف سفارش از لیست"
                              >
                                <Icon name="alert" size={12} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* تب ۳: صندوق چت و پیام‌های پشتیبانی آنلاین */}
          {activeTab === 'chat' && (
            <div className="admin-view admin-chat-view">
              {/* لیست سشن‌ها */}
              <div className="chat-sessions-sidebar">
                <div className="chat-sessions-head">
                  <h3>گفتگوهای کاربران ({chatSessions.length})</h3>
                </div>

                <div className="chat-sessions-list">
                  {chatSessions.length === 0 ? (
                    <div className="empty-state">
                      <p>هنوز پیامی از سمت کاربران ارسال نشده است</p>
                    </div>
                  ) : (
                    chatSessions.map(({ sessionId, lastMsg, unreadCount }) => (
                      <div
                        key={sessionId}
                        className={`chat-session-item ${selectedSessionId === sessionId ? 'is-active' : ''}`}
                        onClick={() => {
                          setSelectedSessionId(sessionId);
                          markSessionAsRead(sessionId);
                        }}
                      >
                        <div className="session-item-avatar">
                          <Icon name="user" size={16} />
                          {unreadCount > 0 && <span className="session-unread-dot" />}
                        </div>
                        <div className="session-item-body">
                          <div className="session-item-row">
                            <strong className="en">{sessionId.slice(0, 14)}...</strong>
                            <small>{new Date(lastMsg.createdAt).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })}</small>
                          </div>
                          <p className="session-item-snippet">{lastMsg.text}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* پنجره گفتگو */}
              <div className="chat-detail-panel">
                {selectedSessionId ? (
                  <>
                    <div className="chat-detail-head">
                      <div>
                        <strong>گفتگو با مشتری: <span className="en">{selectedSessionId}</span></strong>
                      </div>
                      <a
                        href={`https://t.me/${SUPPORT.telegram.replace('@', '')}`}
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn--sm btn--ghost"
                      >
                        <Icon name="send" size={12} /> تلگرام پشتیبانی
                      </a>
                    </div>

                    <div className="chat-detail-thread">
                      {chatMessages
                        .filter((m) => m.sessionId === selectedSessionId)
                        .map((m) => (
                          <div
                            key={m.id}
                            className={`admin-chat-msg admin-chat-msg--${m.sender}`}
                          >
                            <div className="admin-chat-bubble">
                              <span className="msg-author-tag">
                                {m.sender === 'admin' ? 'پاسخ شما (ادمین)' : m.sender === 'bot' ? 'ربات هوشمند' : 'مشتری'}
                              </span>
                              <p>{m.text}</p>
                              <span className="msg-time">
                                {new Date(m.createdAt).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                          </div>
                        ))}
                    </div>

                    <form className="admin-chat-input-row" onSubmit={handleAdminSendChat}>
                      <input
                        type="text"
                        placeholder="پاسخ ادمین را تایپ کرده و Enter بزنید..."
                        value={adminReplyInput}
                        onChange={(e) => setAdminReplyInput(e.target.value)}
                        autoFocus
                      />
                      <button type="submit" className="btn btn--accent" disabled={!adminReplyInput.trim()}>
                        <span>ارسال پاسخ</span>
                        <Icon name="send" size={14} />
                      </button>
                    </form>
                  </>
                ) : (
                  <div className="empty-state select-chat-prompt">
                    <Icon name="headset" size={36} />
                    <p>جهت مشاهده پیام‌ها و پاسخ‌گویی آنلاین، یک مکالمه را از ستون راست انتخاب فرمایید</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* تب ۴: تنظیمات حساب بانکی */}
          {activeTab === 'settings' && (
            <div className="admin-view admin-settings">
              <div className="settings-card">
                <h3>اطلاعات حساب و درگاه واریز فروشگاه</h3>
                <p className="settings-desc">این اطلاعات در صفحه پرداخت و ویجت چت به خریداران ارائه می‌شود.</p>

                <div className="settings-grid">
                  <div className="settings-field">
                    <label>شماره کارت جهت واریز:</label>
                    <input type="text" value={PAYMENT_CONFIG.cardNumber} readOnly className="en" />
                  </div>
                  <div className="settings-field">
                    <label>نام صاحب حساب:</label>
                    <input type="text" value={PAYMENT_CONFIG.cardHolder} readOnly />
                  </div>
                  <div className="settings-field">
                    <label>بانک صادرکننده:</label>
                    <input type="text" value={PAYMENT_CONFIG.bankName} readOnly />
                  </div>
                  <div className="settings-field">
                    <label>شماره شبا (IBAN):</label>
                    <input type="text" value={PAYMENT_CONFIG.shabaNumber} readOnly className="en" />
                  </div>
                </div>

                <div className="settings-note">
                  <Icon name="shield" size={16} />
                  <span>برای تغییر اطلاعات بالا به فایل پیکربندی <code>src/config/site.ts</code> مراجعه فرمایید.</span>
                </div>
              </div>

              {/* کارت تنظیمات سامانه پیامکی sms.ir */}
              <div className="settings-card" style={{ marginTop: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <h3 style={{ margin: 0 }}>تنظیمات سامانه پیامکی sms.ir (ارسال کد تأیید OTP)</h3>
                  <span
                    className="badge-tag"
                    style={{
                      background: smsConfigured ? 'rgba(16, 185, 129, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                      color: smsConfigured ? '#10b981' : '#3b82f6',
                      borderColor: smsConfigured ? 'rgba(16, 185, 129, 0.3)' : 'rgba(59, 130, 246, 0.3)',
                    }}
                  >
                    {smsConfigured ? '● متصل به وب‌سرویس sms.ir' : '○ حالت شبیه‌ساز امن (دمو)'}
                  </span>
                </div>
                <p className="settings-desc">
                  ارسال کدهای تایید ورود و اطلاع‌رسانی سفارشات از خط خدماتی و متد وریفای سریع (UltraFastSend).
                </p>

                <form onSubmit={handleSaveSmsSettings}>
                  <div className="settings-grid">
                    <div className="settings-field" style={{ gridColumn: 'span 2' }}>
                      <label>کلید وب‌سرویس (x-api-key):</label>
                      <input
                        type="password"
                        placeholder="کلید API دریافت شده از پنل sms.ir"
                        className="en"
                        value={smsApiKey}
                        onChange={(e) => setSmsApiKey(e.target.value)}
                      />
                    </div>
                    <div className="settings-field">
                      <label>شناسه قالب پترن (Template ID):</label>
                      <input
                        type="text"
                        placeholder="مثال: 100000"
                        className="en"
                        value={smsTemplateId}
                        onChange={(e) => setSmsTemplateId(e.target.value)}
                      />
                    </div>
                    <div className="settings-field">
                      <label>نام متغیر کد در قالب (Parameter Name):</label>
                      <input
                        type="text"
                        placeholder="Code"
                        className="en"
                        value={smsParamName}
                        onChange={(e) => setSmsParamName(e.target.value)}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '16px' }}>
                    <span style={{ fontSize: '12px', color: '#64748b' }}>
                      🔒 کلیدها با امنیت بالا در سرور ذخیره شده و هیچ‌گاه در سمت کلاینت فاش نمی‌شوند
                    </span>
                    <button type="submit" className="btn btn--accent">
                      ذخیره تنظیمات پیامک
                    </button>
                  </div>
                  {smsSavedToast && (
                    <div className="profile-saved-alert" style={{ marginTop: '12px' }}>
                      تنظیمات وب‌سرویس پیامکی با موفقیت به‌روزرسانی شد.
                    </div>
                  )}
                </form>
              </div>
            </div>
          )}
        </div>

        {/* مدال تأیید سفارش و تنظیم لینک دعوت رسمی گوگل */}
        {approveModalOrder && (
          <div className="modal-inner-overlay">
            <div className="approve-modal">
              <h3>تأیید سفارش و صدور لایسنس رسمی گوگل</h3>
              <p>سفارش: <b className="en">{approveModalOrder.id}</b> — خریدار: <b>{approveModalOrder.fullName}</b></p>
              <p>جیمیل مقصد: <span className="en">{approveModalOrder.gmail}</span></p>

              <div className="approve-field">
                <label>لینک دعوت اختصاصی گوگل (Google One Promo URL):</label>
                <input
                  type="text"
                  className="en"
                  value={customLinkInput}
                  onChange={(e) => setCustomLinkInput(e.target.value)}
                />
              </div>

              <div className="approve-field">
                <label>یادداشت داخلی یا پیام به مشتری:</label>
                <input
                  type="text"
                  value={adminNoteInput}
                  onChange={(e) => setAdminNoteInput(e.target.value)}
                  placeholder="مثال: واریز از بانک ملت تأیید شد."
                />
              </div>

              <div className="approve-modal-actions">
                <button className="btn btn--accent" onClick={confirmApproval}>
                  تأیید نهایی و فعال‌سازی سفارش
                </button>
                <button className="btn btn--ghost" onClick={() => setApproveModalOrder(null)}>
                  انصراف
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
