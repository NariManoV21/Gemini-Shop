import { useEffect, useState } from 'react';
import { PAYMENT_CONFIG } from '../config/site';
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
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import './AdminPanel.css';

interface Props {
  open: boolean;
  onClose: () => void;
}

export interface AdminUser {
  id: string;
  username: string;
  fullName: string;
  role: 'head_admin' | 'regular_admin';
  createdAt?: string;
}

const API_BASE = window.location.hostname === 'localhost' ? 'http://localhost:3001/api' : '/api';

export function AdminPanel({ open, onClose }: Props) {
  useBodyScrollLock(open);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentAdmin, setCurrentAdmin] = useState<AdminUser | null>(null);
  const [adminToken, setAdminToken] = useState<string>('gemini_admin_session_token');

  // فرم ورود
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);

  // تب فعال
  const [activeTab, setActiveTab] = useState<'dashboard' | 'orders' | 'chat' | 'admins' | 'settings'>('dashboard');

  // سفارشات
  const [orders, setOrders] = useState<StoreOrder[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'today' | 'pending_verification' | 'approved' | 'rejected'>('all');

  // چت
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [adminReplyInput, setAdminReplyInput] = useState('');

  // مدال تأیید سفارش
  const [approveModalOrder, setApproveModalOrder] = useState<StoreOrder | null>(null);
  const [customLinkInput, setCustomLinkInput] = useState('');
  const [adminNoteInput, setAdminNoteInput] = useState('');

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedDeliveryMsg, setCopiedDeliveryMsg] = useState<string | null>(null);

  // لیست ادمین‌ها (فقط برای head_admin)
  const [adminsList, setAdminsList] = useState<AdminUser[]>([]);
  const [showAddAdminModal, setShowAddAdminModal] = useState(false);
  const [newAdminUsername, setNewAdminUsername] = useState('');
  const [newAdminFullName, setNewAdminFullName] = useState('');
  const [newAdminPassword, setNewAdminPassword] = useState('');
  const [newAdminRole, setNewAdminRole] = useState<'regular_admin' | 'head_admin'>('regular_admin');
  const [addAdminError, setAddAdminError] = useState<string | null>(null);
  const [addAdminLoading, setAddAdminLoading] = useState(false);

  // تنظیمات Gmail SMTP
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpPass, setSmtpPass] = useState('');
  const [smtpHost, setSmtpHost] = useState('smtp.gmail.com');
  const [smtpPort, setSmtpPort] = useState(465);
  const [smtpConfigured, setSmtpConfigured] = useState(false);
  const [smtpSavedToast, setSmtpSavedToast] = useState(false);

  // بررسی نشست لاگین قبلی از sessionStorage
  useEffect(() => {
    const savedAuth = sessionStorage.getItem('gemini_admin_auth') === 'true';
    const savedToken = sessionStorage.getItem('gemini_admin_token') || 'gemini_admin_session_token';
    const savedUserRaw = sessionStorage.getItem('gemini_admin_user');

    if (savedAuth) {
      setIsAuthenticated(true);
      setAdminToken(savedToken);
      if (savedUserRaw) {
        try {
          setCurrentAdmin(JSON.parse(savedUserRaw));
        } catch {
          setCurrentAdmin({
            id: 'adm_head_1',
            username: 'admin',
            fullName: 'نریمان موذنی (مدیر ارشد)',
            role: 'head_admin',
          });
        }
      }
    }
  }, []);

  // محافظت از تب‌های اختصاصی: اگر ادمین عادی باشد، دسترسی به تنظیمات و ادمین‌ها نداشته باشد
  useEffect(() => {
    if (currentAdmin && currentAdmin.role !== 'head_admin') {
      if (activeTab === 'admins' || activeTab === 'settings') {
        setActiveTab('dashboard');
      }
    }
  }, [currentAdmin, activeTab]);

  // بارگذاری لیست ادمین‌ها برای head_admin
  const loadAdminsList = async () => {
    try {
      const res = await fetch(`${API_BASE}/admin/users`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setAdminsList(data);
      }
    } catch {
      // در حالت آفلاین
      const localAdmins = localStorage.getItem('gemini_local_admins');
      if (localAdmins) {
        try {
          setAdminsList(JSON.parse(localAdmins));
        } catch {}
      } else {
        setAdminsList([
          {
            id: 'adm_head_1',
            username: 'admin',
            fullName: 'نریمان موذنی (مدیر ارشد)',
            role: 'head_admin',
          },
        ]);
      }
    }
  };

  // واکشی تنظیمات جیمیل SMTP از سرور
  const loadSettings = async () => {
    try {
      const res = await fetch(`${API_BASE}/admin/settings`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data) {
          if (data.smtpUser) setSmtpUser(data.smtpUser);
          if (data.smtpHost) setSmtpHost(data.smtpHost);
          if (data.smtpPort) setSmtpPort(data.smtpPort);
          setSmtpConfigured(Boolean(data.isSmtpConfigured));
        }
      }
    } catch {}
  };

  useEffect(() => {
    if (open && isAuthenticated && currentAdmin?.role === 'head_admin') {
      loadSettings();
      loadAdminsList();
    }
  }, [open, isAuthenticated, currentAdmin]);

  const handleSaveSmtpSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/admin/settings`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          smtpUser,
          smtpPass,
          smtpHost,
          smtpPort,
        }),
      });
      if (res.ok) {
        setSmtpConfigured(Boolean(smtpUser && smtpPass));
        setSmtpSavedToast(true);
        setTimeout(() => setSmtpSavedToast(false), 2500);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // بارگذاری داده‌های سفارشات و چت
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

  // ورود به پنل ادمین
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setLoginLoading(true);

    try {
      const res = await fetch(`${API_BASE}/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username.trim(),
          password,
        }),
      });

      const data = await res.json();
      setLoginLoading(false);

      if (res.ok && data.success) {
        setIsAuthenticated(true);
        setCurrentAdmin(data.admin);
        setAdminToken(data.token);
        sessionStorage.setItem('gemini_admin_auth', 'true');
        sessionStorage.setItem('gemini_admin_token', data.token);
        sessionStorage.setItem('gemini_admin_user', JSON.stringify(data.admin));
        return;
      }

      setLoginError(data.error || 'نام کاربری یا رمز عبور اشتباه است.');
    } catch {
      setLoginLoading(false);
      // حالت دمو / بدون بک‌اند آفلاین
      if (password === 'admin123' || password === 'admin') {
        const adminObj: AdminUser = {
          id: 'adm_head_1',
          username: username || 'admin',
          fullName: 'نریمان موذنی (مدیر ارشد)',
          role: 'head_admin',
        };
        setIsAuthenticated(true);
        setCurrentAdmin(adminObj);
        sessionStorage.setItem('gemini_admin_auth', 'true');
        sessionStorage.setItem('gemini_admin_user', JSON.stringify(adminObj));
      } else if (password === 'staff123') {
        const staffObj: AdminUser = {
          id: 'adm_reg_1',
          username: username || 'staff',
          fullName: 'ادمین فروش و سفارشات',
          role: 'regular_admin',
        };
        setIsAuthenticated(true);
        setCurrentAdmin(staffObj);
        sessionStorage.setItem('gemini_admin_auth', 'true');
        sessionStorage.setItem('gemini_admin_user', JSON.stringify(staffObj));
      } else {
        setLoginError('رمز عبور صحیح نمی‌باشد (رمز پیش‌فرض مدیر ارشد: admin123)');
      }
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setCurrentAdmin(null);
    sessionStorage.removeItem('gemini_admin_auth');
    sessionStorage.removeItem('gemini_admin_token');
    sessionStorage.removeItem('gemini_admin_user');
  };

  // افزودن ادمین جدید توسط head_admin
  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddAdminError(null);
    setAddAdminLoading(true);

    try {
      const res = await fetch(`${API_BASE}/admin/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          username: newAdminUsername.trim(),
          fullName: newAdminFullName.trim(),
          password: newAdminPassword,
          role: newAdminRole,
        }),
      });

      const data = await res.json();
      setAddAdminLoading(false);

      if (res.ok && data.success) {
        setShowAddAdminModal(false);
        setNewAdminUsername('');
        setNewAdminFullName('');
        setNewAdminPassword('');
        loadAdminsList();
        return;
      }

      setAddAdminError(data.error || 'خطا در ثبت ادمین جدید.');
    } catch {
      setAddAdminLoading(false);
      // ذخیره آفلاین دمو
      const newAdm: AdminUser = {
        id: `adm_${Date.now()}`,
        username: newAdminUsername.trim(),
        fullName: newAdminFullName.trim() || newAdminUsername,
        role: newAdminRole,
        createdAt: new Date().toISOString(),
      };
      const updated = [...adminsList, newAdm];
      setAdminsList(updated);
      localStorage.setItem('gemini_local_admins', JSON.stringify(updated));
      setShowAddAdminModal(false);
      setNewAdminUsername('');
      setNewAdminFullName('');
      setNewAdminPassword('');
    }
  };

  // حذف ادمین توسط head_admin
  const handleDeleteAdmin = async (adminId: string, adminName: string) => {
    if (!confirm(`آیا از حذف دسترسی ادمین «${adminName}» اطمینان دارید؟`)) return;

    try {
      const res = await fetch(`${API_BASE}/admin/users/${adminId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      if (res.ok) {
        loadAdminsList();
        return;
      }
      const data = await res.json();
      alert(data.error || 'خطا در حذف ادمین.');
    } catch {
      const updated = adminsList.filter((a) => a.id !== adminId);
      setAdminsList(updated);
      localStorage.setItem('gemini_local_admins', JSON.stringify(updated));
    }
  };

  // محاسبات آمار کاربردی داشبورد
  const totalRevenue = orders.reduce((sum, o) => (o.status === 'approved' ? sum + o.amountToman : sum), 0);
  const pendingOrders = orders.filter((o) => o.status === 'pending_verification');
  const approvedOrders = orders.filter((o) => o.status === 'approved');
  const rejectedOrders = orders.filter((o) => o.status === 'rejected');

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
    const cleanQ = q.replace(/^0+/, '');
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

  // کپی سریع متن تلگرام / ایمیل آماده تحویل لایسنس به مشتری
  const copyCustomerDeliveryText = (order: StoreOrder) => {
    const link = order.activationLink || `https://one.google.com/promo/google-ai-pro-invite?order=${order.id}&account=${encodeURIComponent(order.gmail)}`;
    const text = `سلام ${order.fullName} گرامی،\nاشتراک ۱۸ ماهه Google AI Pro شما با موفقیت فعال شد.\n\nکد سفارش: ${order.id}\nلینک فعال‌سازی رسمی گوگل:\n${link}\n\nپشتیبانی Gemini Shop`;
    navigator.clipboard.writeText(text);
    setCopiedDeliveryMsg(order.id);
    setTimeout(() => setCopiedDeliveryMsg(null), 2000);
  };

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

  // فرم ورود به پنل
  if (!isAuthenticated) {
    return (
      <div className="admin-overlay" dir="rtl">
        <div className="admin-login-card">
          <div className="admin-login__head">
            <div className="admin-login__icon-wrap">
              <Icon name="lock" size={24} />
            </div>
            <h2>ورود به پنل مدیریت Gemini Shop</h2>
            <p>جهت دسترسی به سیستم مدیریت سفارشات و چت، نام کاربری و رمز عبور خود را وارد نمایید</p>
          </div>

          <form onSubmit={handleLogin} className="admin-login__form">
            <div className="admin-login__field">
              <label>نام کاربری:</label>
              <input
                type="text"
                placeholder="مثال: admin"
                className="en"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoFocus
                required
              />
            </div>

            <div className="admin-login__field">
              <label>رمز عبور مدیریت:</label>
              <input
                type="password"
                placeholder="رمز عبور پیش‌فرض: admin123"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            {loginError && <div className="admin-login__error">{loginError}</div>}

            <div className="admin-login__actions">
              <button type="submit" className="btn btn--accent" disabled={loginLoading}>
                {loginLoading ? 'در حال ورود...' : 'ورود به پنل'}
              </button>
              <button type="button" className="btn btn--ghost" onClick={onClose}>
                انصراف
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  const isHead = currentAdmin?.role === 'head_admin';

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
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h1 style={{ margin: 0 }}>پنل مدیریت Gemini Shop</h1>
                <span
                  className={`admin-role-badge ${
                    isHead ? 'admin-role-badge--head' : 'admin-role-badge--regular'
                  }`}
                >
                  <Icon name={isHead ? 'shield' : 'user'} size={12} />
                  <span>{isHead ? 'مدیر ارشد سیستم' : 'ادمین فروش و سفارشات'}</span>
                </span>
              </div>
              <span className="admin-header__live-tag">
                <span className="live-dot" /> {currentAdmin?.fullName || 'مدیر فروشگاه'}
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

            {/* تب‌های اختصاصی مدیر ارشد (Head Admin) */}
            {isHead && (
              <>
                <button
                  className={`admin-tab ${activeTab === 'admins' ? 'is-active' : ''}`}
                  onClick={() => setActiveTab('admins')}
                >
                  <Icon name="user" size={15} />
                  <span>همکاران و ادمین‌ها</span>
                  {adminsList.length > 0 && <span className="tab-badge">{adminsList.length}</span>}
                </button>
                <button
                  className={`admin-tab ${activeTab === 'settings' ? 'is-active' : ''}`}
                  onClick={() => setActiveTab('settings')}
                >
                  <Icon name="code" size={15} />
                  <span>تنظیمات و درگاه ایمیل</span>
                </button>
              </>
            )}
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
                            تأیید و صدور لینک
                          </button>
                          <button className="btn btn--sm btn--ghost" onClick={() => handleReject(o.id)}>
                            رد فیش
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* تب ۲: مدیریت سفارش‌ها و واریزی‌ها */}
          {activeTab === 'orders' && (
            <div className="admin-view admin-orders">
              <div className="orders-toolbar">
                <div className="orders-filters">
                  <button className={`filter-chip ${statusFilter === 'all' ? 'is-active' : ''}`} onClick={() => setStatusFilter('all')}>
                    همه سفارشات ({orders.length})
                  </button>
                  <button className={`filter-chip ${statusFilter === 'pending_verification' ? 'is-active' : ''}`} onClick={() => setStatusFilter('pending_verification')}>
                    در انتظار بررسی ({pendingOrders.length})
                  </button>
                  <button className={`filter-chip ${statusFilter === 'approved' ? 'is-active' : ''}`} onClick={() => setStatusFilter('approved')}>
                    تأییدشده ({approvedOrders.length})
                  </button>
                  <button className={`filter-chip ${statusFilter === 'rejected' ? 'is-active' : ''}`} onClick={() => setStatusFilter('rejected')}>
                    رد شده ({rejectedOrders.length})
                  </button>
                  <button className={`filter-chip ${statusFilter === 'today' ? 'is-active' : ''}`} onClick={() => setStatusFilter('today')}>
                    ثبت‌شده امروز ({todayOrders.length})
                  </button>
                </div>

                <div className="orders-actions-row">
                  <div className="search-box">
                    <Icon name="search" size={15} />
                    <input
                      type="text"
                      placeholder="جستجو با نام، شماره، ایمیل، شناسه سفارش یا کد پیگیری..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    {searchQuery && (
                      <button className="clear-search" onClick={() => setSearchQuery('')}>✕</button>
                    )}
                  </div>
                  <button className="btn btn--sm btn--ghost btn-export" onClick={exportToCSV}>
                    <Icon name="download" size={14} />
                    <span>خروجی اکسل (CSV)</span>
                  </button>
                </div>
              </div>

              {/* جدول سفارشات */}
              <div className="table-responsive">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>شناسه سفارش</th>
                      <th>خریدار</th>
                      <th>جیمیل فعال‌سازی</th>
                      <th>مبلغ</th>
                      <th>روش و پیگیری</th>
                      <th>وضعیت</th>
                      <th>لینک اختصاصی</th>
                      <th>عملیات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOrders.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="empty-table-cell">
                          هیچ سفارشی با این مشخصات یافت نشد.
                        </td>
                      </tr>
                    ) : (
                      filteredOrders.map((o) => (
                        <tr key={o.id} className={`order-status-row--${o.status}`}>
                          <td>
                            <div className="order-id-cell">
                              <span className="en">{o.id}</span>
                              <button
                                className="btn-copy-mini"
                                onClick={() => copyToClipboard(o.id, `id_${o.id}`)}
                                title="کپی شناسه"
                              >
                                {copiedId === `id_${o.id}` ? '✓' : <Icon name="copy" size={12} />}
                              </button>
                            </div>
                            <small className="order-date-label">
                              {new Date(o.createdAt).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })}
                            </small>
                          </td>
                          <td>
                            <strong>{o.fullName}</strong>
                            <div className="en text-muted" style={{ fontSize: '12px' }}>{o.mobile}</div>
                          </td>
                          <td>
                            <span className="en highlight-gmail">{o.gmail}</span>
                          </td>
                          <td>
                            <b>{formatToman(o.amountToman)}</b> <small>تومان</small>
                          </td>
                          <td>
                            <span className="badge-tag">
                              {o.paymentMethod === 'bezanbekart' ? 'بزن به کارت' : 'کارت به کارت'}
                            </span>
                            <div className="payment-ref-text en">
                              کد: <b>{o.paymentRef}</b>
                            </div>
                          </td>
                          <td>
                            {o.status === 'pending_verification' && (
                              <span className="status-badge status-badge--pending">در انتظار بررسی</span>
                            )}
                            {o.status === 'approved' && (
                              <span className="status-badge status-badge--approved">تأییدشده</span>
                            )}
                            {o.status === 'rejected' && (
                              <span className="status-badge status-badge--rejected">رد شده</span>
                            )}
                          </td>
                          <td>
                            {o.activationLink ? (
                              <div className="link-cell-wrap">
                                <a href={o.activationLink} target="_blank" rel="noreferrer" className="link-preview en">
                                  {o.activationLink.slice(0, 24)}...
                                </a>
                                <button
                                  className="btn-copy-mini"
                                  onClick={() => copyToClipboard(o.activationLink!, `link_${o.id}`)}
                                  title="کپی لینک فعال‌سازی"
                                >
                                  {copiedId === `link_${o.id}` ? '✓' : <Icon name="copy" size={12} />}
                                </button>
                              </div>
                            ) : (
                              <span className="text-muted" style={{ fontSize: '11px' }}>قفل (ثبت‌نشده)</span>
                            )}
                          </td>
                          <td>
                            <div className="actions-cell">
                              {o.status === 'pending_verification' && (
                                <button
                                  className="btn btn--sm btn--accent"
                                  onClick={() => handleQuickApprove(o)}
                                  title="بررسی واریز و صدور لینک اختصاصی"
                                >
                                  تأیید
                                </button>
                              )}
                              {o.status === 'approved' && (
                                <button
                                  className="btn btn--sm btn--ghost"
                                  onClick={() => copyCustomerDeliveryText(o)}
                                  title="کپی پیام آماده ارسال به مشتری"
                                >
                                  {copiedDeliveryMsg === o.id ? 'کپی شد!' : 'کپی پیام تحویل'}
                                </button>
                              )}
                              {o.status === 'pending_verification' && (
                                <button
                                  className="btn btn--sm btn--ghost"
                                  onClick={() => handleReject(o.id)}
                                  title="رد فیش"
                                >
                                  رد
                                </button>
                              )}
                              <button
                                className="btn btn--sm btn-icon-only text-danger"
                                onClick={() => handleDelete(o.id)}
                                title="حذف سفارش"
                              >
                                <Icon name="close" size={13} />
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

          {/* تب ۳: صندوق چت و گفتگوهای زنده خریداران */}
          {activeTab === 'chat' && (
            <div className="admin-view admin-chat-view">
              <div className="admin-chat-sidebar">
                <div className="admin-chat-sidebar__head">
                  <strong>گفتگوها ({chatSessions.length})</strong>
                </div>
                <div className="admin-chat-sessions-list">
                  {chatSessions.length === 0 ? (
                    <div className="empty-state">گفتگویی یافت نشد.</div>
                  ) : (
                    chatSessions.map((s) => (
                      <div
                        key={s.sessionId}
                        className={`session-item ${selectedSessionId === s.sessionId ? 'is-active' : ''}`}
                        onClick={() => {
                          setSelectedSessionId(s.sessionId);
                          markSessionAsRead(s.sessionId);
                        }}
                      >
                        <div className="session-item__head">
                          <span className="session-id en">{s.sessionId.slice(0, 16)}</span>
                          {s.unreadCount > 0 && <span className="session-unread">{s.unreadCount}</span>}
                        </div>
                        <p className="session-last-text">{s.lastMsg.text}</p>
                        <small className="session-time">
                          {new Date(s.lastMsg.createdAt).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })}
                        </small>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="admin-chat-main">
                {selectedSessionId ? (
                  <>
                    <div className="admin-chat-header">
                      <div>
                        <strong>مکالمه کاربر با شناسه: <span className="en">{selectedSessionId}</span></strong>
                      </div>
                    </div>

                    <div className="admin-chat-history">
                      {chatMessages
                        .filter((m) => m.sessionId === selectedSessionId)
                        .map((m) => (
                          <div key={m.id} className={`admin-msg-bubble admin-msg-bubble--${m.sender}`}>
                            <div className="msg-sender-name">
                              {m.sender === 'admin' ? 'پشتیبان ادمین' : m.sender === 'bot' ? 'پاسخ هوشمند' : 'کاربر خریدار'}
                            </div>
                            <div className="msg-body">{m.text}</div>
                            <div className="msg-time">
                              {new Date(m.createdAt).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })}
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

          {/* تب ۴: مدیریت همکاران و ادمین‌ها (فقط برای head_admin) */}
          {activeTab === 'admins' && isHead && (
            <div className="admin-view admins-management">
              <div className="admins-header-card">
                <div>
                  <h3>مدیریت همکاران و سطوح دسترسی (RBAC)</h3>
                  <p>تعریف ادمین‌های فروش و اختصاص پرمیشن‌ها (فقط مدیر ارشد مجاز به مدیریت این بخش است)</p>
                </div>
                <button
                  type="button"
                  className="btn btn--accent"
                  onClick={() => {
                    setAddAdminError(null);
                    setShowAddAdminModal(true);
                  }}
                >
                  <Icon name="user" size={16} />
                  <span>افزودن ادمین جدید</span>
                </button>
              </div>

              <div className="admins-table-card">
                <table className="admins-table">
                  <thead>
                    <tr>
                      <th>نام و نام خانوادگی</th>
                      <th>نام کاربری</th>
                      <th>سطح دسترسی (Role)</th>
                      <th>تاریخ ثبت</th>
                      <th>عملیات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {adminsList.map((adm) => {
                      const isSelf = currentAdmin?.username === adm.username;
                      const isHeadRole = adm.role === 'head_admin';
                      return (
                        <tr key={adm.id || adm.username}>
                          <td>
                            <strong>{adm.fullName}</strong>
                            {isSelf && <small style={{ marginRight: '6px', color: '#10b981' }}>(حساب شما)</small>}
                          </td>
                          <td>
                            <code className="en" style={{ fontSize: '13px' }}>{adm.username}</code>
                          </td>
                          <td>
                            <span
                              className={`admin-role-badge ${
                                isHeadRole ? 'admin-role-badge--head' : 'admin-role-badge--regular'
                              }`}
                            >
                              <Icon name={isHeadRole ? 'shield' : 'user'} size={12} />
                              <span>{isHeadRole ? 'مدیر ارشد (Head Admin)' : 'ادمین فروش (Orders & Chat)'}</span>
                            </span>
                          </td>
                          <td>
                            <small className="en text-muted">
                              {adm.createdAt
                                ? new Date(adm.createdAt).toLocaleDateString('fa-IR')
                                : 'پیش‌فرض سیستم'}
                            </small>
                          </td>
                          <td>
                            <button
                              type="button"
                              className="admin-del-btn"
                              disabled={isSelf}
                              onClick={() => handleDeleteAdmin(adm.id, adm.fullName || adm.username)}
                              title={isSelf ? 'نمی‌توانید حساب جاری خود را حذف کنید' : 'حذف دسترسی ادمین'}
                            >
                              <Icon name="close" size={12} />
                              <span>حذف</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* مدال افزودن ادمین جدید */}
              {showAddAdminModal && (
                <div className="modal-inner-overlay">
                  <div className="approve-modal" style={{ maxWidth: '440px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <h3 style={{ margin: 0 }}>افزودن همکار / ادمین جدید</h3>
                      <button
                        className="btn-icon-only"
                        onClick={() => setShowAddAdminModal(false)}
                      >
                        ✕
                      </button>
                    </div>
                    <p style={{ marginTop: '6px', color: '#64748b' }}>
                      مشخصات ورود و سطح دسترسی ادمین را مشخص فرمایید:
                    </p>

                    {addAdminError && (
                      <div className="admin-login__error" style={{ marginTop: '10px' }}>
                        {addAdminError}
                      </div>
                    )}

                    <form onSubmit={handleCreateAdmin}>
                      <div className="approve-field">
                        <label>نام و نام خانوادگی:</label>
                        <input
                          type="text"
                          placeholder="مثال: علی رضایی"
                          value={newAdminFullName}
                          onChange={(e) => setNewAdminFullName(e.target.value)}
                          required
                        />
                      </div>

                      <div className="approve-field">
                        <label>نام کاربری (جهت ورود به پنل):</label>
                        <input
                          type="text"
                          placeholder="مثال: sales_ali"
                          className="en"
                          value={newAdminUsername}
                          onChange={(e) => setNewAdminUsername(e.target.value)}
                          required
                        />
                      </div>

                      <div className="approve-field">
                        <label>رمز عبور ورود:</label>
                        <input
                          type="password"
                          placeholder="حداقل ۶ کاراکتر"
                          value={newAdminPassword}
                          onChange={(e) => setNewAdminPassword(e.target.value)}
                          required
                        />
                      </div>

                      <div className="approve-field">
                        <label>نقش و سطح پرمیشن:</label>
                        <select
                          value={newAdminRole}
                          onChange={(e) => setNewAdminRole(e.target.value as any)}
                          style={{
                            padding: '9px 12px',
                            borderRadius: '8px',
                            border: '1px solid #cbd5e1',
                            fontFamily: 'inherit',
                            fontSize: '13px',
                          }}
                        >
                          <option value="regular_admin">
                            ادمین فروش (دسترسی به سفارش‌ها، فیش‌ها و چت آنلاین)
                          </option>
                          <option value="head_admin">
                            مدیر ارشد (دسترسی کامل به مدیریت سیستم، ادمین‌ها و تنظیمات)
                          </option>
                        </select>
                      </div>

                      <div className="approve-modal-actions" style={{ marginTop: '20px' }}>
                        <button type="submit" className="btn btn--accent" disabled={addAdminLoading}>
                          {addAdminLoading ? 'در حال ثبت...' : 'تأیید و ساخت ادمین'}
                        </button>
                        <button
                          type="button"
                          className="btn btn--ghost"
                          onClick={() => setShowAddAdminModal(false)}
                        >
                          انصراف
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* تب ۵: تنظیمات و درگاه ایمیل (فقط برای head_admin) */}
          {activeTab === 'settings' && isHead && (
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
                  <span>برای تغییر اطلاعات حساب بانکی به فایل پیکربندی <code>src/config/site.ts</code> مراجعه فرمایید.</span>
                </div>
              </div>

              {/* کارت تنظیمات سامانه Gmail OTP via TLS 465 */}
              <div className="settings-card" style={{ marginTop: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <h3 style={{ margin: 0 }}>تنظیمات ارسال ایمیل کد تأیید (Gmail OTP via TLS 465)</h3>
                  <span
                    className="badge-tag"
                    style={{
                      background: smtpConfigured ? 'rgba(16, 185, 129, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                      color: smtpConfigured ? '#10b981' : '#3b82f6',
                      borderColor: smtpConfigured ? 'rgba(16, 185, 129, 0.3)' : 'rgba(59, 130, 246, 0.3)',
                    }}
                  >
                    {smtpConfigured ? '● متصل به سرویس زنده جیمیل TLS' : '○ حالت شبیه‌ساز امن (دمو)'}
                  </span>
                </div>
                <p className="settings-desc">
                  ارسال کدهای تأیید ورود و لایسنس‌ها مستقیماً از طریق پروتکل امن TLS و پورت 465 گوگل به ایمیل خریداران.
                </p>

                <form onSubmit={handleSaveSmtpSettings}>
                  <div className="settings-grid">
                    <div className="settings-field">
                      <label>آدرس جیمیل فرستنده (Google Account):</label>
                      <input
                        type="email"
                        placeholder="yourshop@gmail.com"
                        className="en"
                        value={smtpUser}
                        onChange={(e) => setSmtpUser(e.target.value)}
                      />
                    </div>
                    <div className="settings-field">
                      <label>رمز عبور اختصاصی اپلیکیشن (App Password ۱۶ رقمی):</label>
                      <input
                        type="password"
                        placeholder="•••• •••• •••• •••• (App Password)"
                        className="en"
                        value={smtpPass}
                        onChange={(e) => setSmtpPass(e.target.value)}
                      />
                    </div>
                    <div className="settings-field">
                      <label>سرور SMTP:</label>
                      <input
                        type="text"
                        placeholder="smtp.gmail.com"
                        className="en"
                        value={smtpHost}
                        onChange={(e) => setSmtpHost(e.target.value)}
                      />
                    </div>
                    <div className="settings-field">
                      <label>پورت اتصال TLS:</label>
                      <input
                        type="number"
                        placeholder="465"
                        className="en"
                        value={smtpPort}
                        onChange={(e) => setSmtpPort(Number(e.target.value))}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '16px' }}>
                    <span style={{ fontSize: '12px', color: '#64748b' }}>
                      🔒 رمزهای عبور بر روی سرور محافظت شده و هیچ‌گاه در سمت کلاینت بازگشت داده نمی‌شوند.
                    </span>
                    <button type="submit" className="btn btn--accent">
                      ذخیره تنظیمات جیمیل
                    </button>
                  </div>
                  {smtpSavedToast && (
                    <div className="profile-saved-alert" style={{ marginTop: '12px' }}>
                      تنظیمات درگاه جیمیل با موفقیت ذخیره شد.
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
