import { useState, useEffect } from 'react';
import { formatToman } from '../lib/format';
import { getCustomerOrders, logoutCustomer, saveCurrentUser, type UserProfile } from '../services/authService';
import { getSessionMessages, getOrCreateSessionId } from '../services/chatService';
import type { StoreOrder } from '../services/orderStorage';
import { Icon, GeminiStar, GoogleG } from './Icon';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import './UserProfileModal.css';

interface Props {
  open: boolean;
  user: UserProfile;
  onClose: () => void;
  onBuy: () => void;
  onOpenChat?: () => void;
}

type UserTab = 'dashboard' | 'subscriptions' | 'transactions' | 'profile' | 'support' | 'guide' | 'about';

export function UserProfileModal({ open, user, onClose, onBuy, onOpenChat }: Props) {
  useBodyScrollLock(open);

  const [activeTab, setActiveTab] = useState<UserTab>('dashboard');
  const [orders, setOrders] = useState<StoreOrder[]>([]);
  const [unreadSupportCount, setUnreadSupportCount] = useState(0);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);
  const [copiedOrderId, setCopiedOrderId] = useState<string | null>(null);

  const [editName, setEditName] = useState(user.fullName);
  const [editGmail, setEditGmail] = useState(user.gmail || '');
  const [savedNote, setSavedNote] = useState(false);

  // پاپ‌اورهای سربرگ
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  useEffect(() => {
    if (!open) return;
    setEditName(user.fullName);
    setEditGmail(user.gmail || '');

    const fetchOrders = () => {
      setOrders(getCustomerOrders(user.gmail || user.mobile));
    };
    fetchOrders();

    const checkChat = () => {
      const msgs = getSessionMessages(getOrCreateSessionId());
      const unread = msgs.filter((m) => !m.isRead && m.sender === 'admin').length;
      setUnreadSupportCount(unread);
    };
    checkChat();

    const handleUpdate = () => {
      fetchOrders();
      checkChat();
    };
    window.addEventListener('gemini_orders_updated', handleUpdate);
    window.addEventListener('gemini_chat_updated', handleUpdate);
    return () => {
      window.removeEventListener('gemini_orders_updated', handleUpdate);
      window.removeEventListener('gemini_chat_updated', handleUpdate);
    };
  }, [open, user.gmail, user.mobile, user.fullName]);

  if (!open) return null;

  const handleCopyLink = (link: string, id: string) => {
    navigator.clipboard.writeText(link);
    setCopiedLink(id);
    setTimeout(() => setCopiedLink(null), 2200);
  };

  const handleCopyOrderId = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedOrderId(id);
    setTimeout(() => setCopiedOrderId(null), 1800);
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    const updated: UserProfile = {
      ...user,
      fullName: editName.trim() || user.fullName,
      gmail: editGmail.trim() || user.gmail,
    };
    saveCurrentUser(updated);
    setSavedNote(true);
    setTimeout(() => setSavedNote(false), 2500);
  };

  const handleLogout = () => {
    if (confirm('آیا از خروج از حساب کاربری اطمینان دارید؟')) {
      logoutCustomer();
      onClose();
    }
  };

  const approvedOrders = orders.filter((o) => o.status === 'approved');
  const pendingOrders = orders.filter((o) => o.status === 'pending_verification');
  const latestApprovedOrder = approvedOrders[0];

  const totalSpentToman = orders.reduce((sum, o) => sum + (o.amountToman || 0), 0);
  const userInitial = user.fullName ? user.fullName.trim().charAt(0) : 'ک';

  return (
    <div
      className="portal-overlay"
      dir="rtl"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          setShowUserDropdown(false);
          setShowNotifications(false);
          onClose();
        }
      }}
    >
      <div className="portal-window portal-window--user" role="dialog" aria-modal="true" aria-labelledby="user-panel-title">
        
        {/* ==================== ستون سایدبار راست (Right Sidebar) ==================== */}
        <aside className="portal-sidebar">
          <div className="portal-sidebar__brand">
            <div className="portal-sidebar__logo-wrap">
              <span className="brand-gemini-sparkle">✦</span>
            </div>
            <div className="portal-sidebar__brand-text">
              <strong className="en">Gemini Shop</strong>
              <small>Google AI Pro</small>
            </div>
          </div>

          <nav className="portal-sidebar__nav" aria-label="منوی کاربری">
            <button
              type="button"
              className={`sidebar-nav-item ${activeTab === 'dashboard' ? 'is-active' : ''}`}
              onClick={() => {
                setActiveTab('dashboard');
                setShowUserDropdown(false);
                setShowNotifications(false);
              }}
            >
              <span className="sidebar-nav-icon">
                <Icon name="grid" size={17} />
              </span>
              <span>داشبورد</span>
            </button>

            <button
              type="button"
              className={`sidebar-nav-item ${activeTab === 'subscriptions' ? 'is-active' : ''}`}
              onClick={() => {
                setActiveTab('subscriptions');
                setShowUserDropdown(false);
                setShowNotifications(false);
              }}
            >
              <span className="sidebar-nav-icon">
                <Icon name="sparkle" size={17} />
              </span>
              <span>اشتراک‌های من</span>
              {approvedOrders.length > 0 && <span className="nav-badge-pill">{approvedOrders.length}</span>}
            </button>

            <button
              type="button"
              className={`sidebar-nav-item ${activeTab === 'transactions' ? 'is-active' : ''}`}
              onClick={() => {
                setActiveTab('transactions');
                setShowUserDropdown(false);
                setShowNotifications(false);
              }}
            >
              <span className="sidebar-nav-icon">
                <Icon name="bag" size={17} />
              </span>
              <span>موجودی و تراکنش‌ها</span>
              {pendingOrders.length > 0 && <span className="nav-badge-amber">{pendingOrders.length}</span>}
            </button>

            <button
              type="button"
              className={`sidebar-nav-item ${activeTab === 'profile' ? 'is-active' : ''}`}
              onClick={() => {
                setActiveTab('profile');
                setShowUserDropdown(false);
                setShowNotifications(false);
              }}
            >
              <span className="sidebar-nav-icon">
                <Icon name="user" size={17} />
              </span>
              <span>پروفایل کاربری</span>
            </button>

            <button
              type="button"
              className={`sidebar-nav-item ${activeTab === 'support' ? 'is-active' : ''}`}
              onClick={() => {
                setActiveTab('support');
                setShowUserDropdown(false);
                setShowNotifications(false);
              }}
            >
              <span className="sidebar-nav-icon">
                <Icon name="headset" size={17} />
              </span>
              <span>تیکت‌های پشتیبانی</span>
              {unreadSupportCount > 0 && <span className="nav-badge-pill">{unreadSupportCount}</span>}
            </button>
          </nav>

          <div className="portal-sidebar__footer">
            <button type="button" className="sidebar-nav-item sidebar-logout-btn" onClick={handleLogout} title="خروج از حساب">
              <span className="sidebar-nav-icon">
                <Icon name="logout" size={17} />
              </span>
              <span>خروج از حساب</span>
            </button>
          </div>
        </aside>

        {/* ==================== محتوای اصلی (Main Content Area) ==================== */}
        <div className="portal-main-area">
          {/* نوار سربرگ بالای داشبورد (Top Bar) */}
          <header className="portal-topbar">
            <div className="portal-topbar__user">
              {/* کپسول شیک و لوکس مشخصات کاربر */}
              <div
                className={`portal-user-pill ${showUserDropdown ? 'is-open' : ''}`}
                onClick={() => {
                  setShowUserDropdown(!showUserDropdown);
                  setShowNotifications(false);
                }}
                title="منوی حساب کاربری"
              >
                <div className="portal-user-avatar">
                  <span>{userInitial}</span>
                </div>
                <div className="portal-user-meta">
                  <span className="portal-user-name">{user.fullName || 'کاربر گرامی'}</span>
                  <span className="portal-user-sub-badge">عضو ویژه</span>
                </div>
                <Icon name="chevron" size={13} className={`portal-chevron-arrow ${showUserDropdown ? 'is-rotated' : ''}`} />
              </div>

              {/* دراپ‌داون پروفایل کاربر */}
              {showUserDropdown && (
                <div className="portal-popover portal-dropdown-menu">
                  <div className="popover-user-info">
                    <strong>{user.fullName || 'کاربر گرامی'}</strong>
                    <span className="en">{user.gmail || user.mobile}</span>
                  </div>
                  <div className="popover-divider" />
                  <button type="button" className="popover-item" onClick={() => { setActiveTab('profile'); setShowUserDropdown(false); }}>
                    <Icon name="user" size={15} />
                    <span>ویرایش مشخصات</span>
                  </button>
                  <button type="button" className="popover-item" onClick={() => { setActiveTab('subscriptions'); setShowUserDropdown(false); }}>
                    <Icon name="sparkle" size={15} />
                    <span>اشتراک‌های من</span>
                  </button>
                  <button type="button" className="popover-item" onClick={() => { setActiveTab('transactions'); setShowUserDropdown(false); }}>
                    <Icon name="bag" size={15} />
                    <span>سوابق تراکنش‌ها</span>
                  </button>
                  <div className="popover-divider" />
                  <button type="button" className="popover-item popover-item--danger" onClick={handleLogout}>
                    <Icon name="logout" size={15} />
                    <span>خروج از حساب</span>
                  </button>
                </div>
              )}

              {/* دکمه مدرن اعلان‌ها با SVG Bell */}
              <button
                type="button"
                className={`portal-bell-btn ${showNotifications ? 'is-active' : ''}`}
                title="اعلان‌ها"
                onClick={() => {
                  setShowNotifications(!showNotifications);
                  setShowUserDropdown(false);
                }}
              >
                <Icon name="bell" size={17} />
                {pendingOrders.length > 0 && <span className="bell-pulse-dot" />}
              </button>

              {showNotifications && (
                <div className="portal-popover portal-popover--notifications">
                  <div className="popover-head">
                    <strong>اعلان‌های حساب شما</strong>
                    <small>{pendingOrders.length + approvedOrders.length} مورد</small>
                  </div>
                  <div className="popover-notifications-list">
                    {pendingOrders.map((o) => (
                      <div key={o.id} className="notification-row notification-row--pending" onClick={() => { setActiveTab('transactions'); setShowNotifications(false); }}>
                        <span className="notif-badge">⏳ در نوبت بررسی</span>
                        <p>فیش سفارش <b>{o.id}</b> در صف بررسی کارشناسان قرار دارد.</p>
                      </div>
                    ))}
                    {approvedOrders.slice(0, 2).map((o) => (
                      <div key={o.id} className="notification-row notification-row--approved" onClick={() => { setActiveTab('subscriptions'); setShowNotifications(false); }}>
                        <span className="notif-badge">✅ لایسنس فعال شد</span>
                        <p>اشتراک رسمی شما برای سفارش <b>{o.id}</b> صادر گردید.</p>
                      </div>
                    ))}
                    {orders.length === 0 && (
                      <div className="notification-empty">اعلان جدیدی وجود ندارد.</div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="portal-topbar__links">
              <button
                type="button"
                className="topbar-cta-pill"
                onClick={() => {
                  onClose();
                  onBuy();
                }}
              >
                <span>خرید اشتراک</span>
              </button>
              <button
                type="button"
                className={`topbar-link-btn ${activeTab === 'guide' ? 'is-active-link' : ''}`}
                onClick={() => {
                  setActiveTab('guide');
                  setShowUserDropdown(false);
                  setShowNotifications(false);
                }}
              >
                راهنما
              </button>
              <button
                type="button"
                className={`topbar-link-btn ${activeTab === 'support' ? 'is-active-link' : ''}`}
                onClick={() => {
                  setActiveTab('support');
                  setShowUserDropdown(false);
                  setShowNotifications(false);
                }}
              >
                پشتیبانی
              </button>
              <button
                type="button"
                className={`topbar-link-btn ${activeTab === 'about' ? 'is-active-link' : ''}`}
                onClick={() => {
                  setActiveTab('about');
                  setShowUserDropdown(false);
                  setShowNotifications(false);
                }}
              >
                درباره ما
              </button>

              <button
                type="button"
                className="portal-close-circle"
                onClick={onClose}
                aria-label="بستن پنجره"
                title="بستن (Esc)"
              >
                <Icon name="close" size={16} />
              </button>
            </div>
          </header>

          {/* محتوای درونی اسکرول‌پذیر */}
          <div className="portal-content-body">
            
            {/* ==================== تب ۱: داشبورد اصلی ==================== */}
            {activeTab === 'dashboard' && (
              <div className="user-dashboard-view">
                {/* تیتر داشبورد */}
                <div className="dashboard-header-title">
                  <div className="dashboard-title-icon">
                    <Icon name="user" size={18} />
                  </div>
                  <div>
                    <h2 id="user-panel-title">پنل کاربری</h2>
                    <p>مدیریت اشتراک‌ها، پرداخت‌ها و اطلاعات حساب شما</p>
                  </div>
                </div>

                {/* ردیف ۴ کارت آماری روشن و کاملاً تعاملی (منطبق بر رفرنس اختصاصی عکس ۲) */}
                <div className="user-stats-grid">
                  {/* کارت ۱: کل سفارش‌ها (سمت راست در RTL) */}
                  <div className="user-stat-card clickable" onClick={() => setActiveTab('transactions')} title="مشاهده سوابق و تراکنش‌ها">
                    <div className="user-stat-card__body">
                      <span className="stat-label">کل سفارش‌ها</span>
                      <div className="stat-value-wrap">
                        <strong className="stat-value">{orders.length}</strong>
                      </div>
                      <span className="stat-sub">
                        {pendingOrders.length > 0 ? `${pendingOrders.length} در انتظار بررسی` : 'همه سفارشات بررسی شده'}
                      </span>
                    </div>
                    <div className="user-stat-card__icon user-stat-card__icon--rose">
                      <Icon name="bag" size={20} />
                    </div>
                  </div>

                  {/* کارت ۲: مجموع تراکنش‌ها */}
                  <div className="user-stat-card clickable" onClick={() => setActiveTab('transactions')} title="مشاهده جزئیات مبالغ پرداختی">
                    <div className="user-stat-card__body">
                      <span className="stat-label">مجموع تراکنش‌ها</span>
                      <div className="stat-value-wrap">
                        <strong className="stat-value">
                          {formatToman(totalSpentToman)} <small>تومان</small>
                        </strong>
                      </div>
                      <span className="stat-sub">مجموع پرداختی‌های موفق: {formatToman(totalSpentToman)} تومان</span>
                    </div>
                    <div className="user-stat-card__icon user-stat-card__icon--amber">
                      <span style={{ fontSize: '18px' }}>💳</span>
                    </div>
                  </div>

                  {/* کارت ۳: موجودی کیف پول */}
                  <div className="user-stat-card clickable" onClick={() => setActiveTab('transactions')} title="مشاهده کیف پول و اعتبار">
                    <div className="user-stat-card__body">
                      <span className="stat-label">موجودی کیف پول</span>
                      <div className="stat-value-wrap">
                        <strong className="stat-value">۰ <small>تومان</small></strong>
                      </div>
                      <span className="stat-sub">شارژ نشده</span>
                    </div>
                    <div className="user-stat-card__icon user-stat-card__icon--mint">
                      <span style={{ fontSize: '18px' }}>⏱</span>
                    </div>
                  </div>

                  {/* کارت ۴: اشتراک‌های فعال و تحویل‌شده (سمت چپ در RTL) */}
                  <div className="user-stat-card clickable" onClick={() => setActiveTab('subscriptions')} title="مشاهده لایسنس فعال Google AI Pro">
                    <div className="user-stat-card__body">
                      <span className="stat-label">اشتراک‌های فعال و تحویل‌شده</span>
                      <div className="stat-value-wrap">
                        <strong className="stat-value">{approvedOrders.length}</strong>
                      </div>
                      <span className="stat-sub">
                        {latestApprovedOrder
                          ? `تاریخ آخرین تحویل: ${new Date(latestApprovedOrder.createdAt).toLocaleDateString('fa-IR')}`
                          : 'فاقد اشتراک فعال'}
                      </span>
                    </div>
                    <div className="user-stat-card__icon user-stat-card__icon--purple">
                      <span style={{ fontSize: '18px' }}>🔒</span>
                    </div>
                  </div>
                </div>

                {/* بخش پایینی: بنر مدیریت اشتراک + اطلاعات حساب کاربری */}
                <div className="user-dashboard-split">
                  {/* بنر ارتقا و مدیریت اشتراک */}
                  <div className="user-aurora-card">
                    <div className="aurora-sparkle-decor">✦</div>
                    <div className="user-aurora-card__content">
                      <h3>اشتراک خود را مدیریت کنید</h3>
                      <p>دسترسی سریع به لینک‌ها، تمدید و ارتقای اشتراک‌ها</p>
                      <button
                        type="button"
                        className="btn-aurora-action"
                        onClick={() => setActiveTab('subscriptions')}
                      >
                        <span>مشاهده اشتراک‌های من</span>
                        <span className="arrow-icon">←</span>
                      </button>
                    </div>
                  </div>

                  {/* کارت اطلاعات حساب کاربری */}
                  <div className="user-info-summary-card">
                    <div className="info-summary-head">
                      <div className="info-summary-icon">
                        <Icon name="user" size={16} />
                      </div>
                      <h4>اطلاعات حساب کاربری</h4>
                    </div>

                    <div className="info-summary-rows">
                      <div className="info-summary-row">
                        <span className="info-label">
                          <GoogleG size={13} />
                          <span>ایمیل فعال‌سازی:</span>
                        </span>
                        <strong className="info-value en">{user.gmail || 'nimamchi1384@gmail.com'}</strong>
                      </div>

                      <div className="info-summary-row">
                        <span className="info-label">
                          <Icon name="user" size={13} />
                          <span>شماره همراه / کاربری:</span>
                        </span>
                        <strong className="info-value en">{user.mobile || '09103527670'}</strong>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="btn-edit-profile-quick"
                      onClick={() => setActiveTab('profile')}
                    >
                      ویرایش مشخصات حساب کاربری
                    </button>
                  </div>
                </div>

                {/* کادر تذکر مهم ابزار تغییر IP و توصیه حیاتی جیمیل با سلب مسئولیت */}
                <div className="user-dashboard-warning-card">
                  <div className="user-dashboard-warning__icon">
                    <Icon name="alert" size={24} />
                  </div>
                  <div className="user-dashboard-warning__body">
                    <div className="warning-entry">
                      <strong>تذکر اول درباره ابزار تغییر IP معتبر:</strong>
                      <p>
                        جهت اتصال امن، فعال‌سازی و بهره‌مندی از امکانات Google One و هوش مصنوعی Gemini Advanced، همیشه از یک ابزار تغییر IP پایدار، باکیفیت و بدون نشت (DNS/WebRTC Leak-Free) استفاده فرمایید.
                      </p>
                    </div>

                    <div className="warning-divider" />

                    <div className="warning-entry">
                      <strong className="text-warning-highlight">⚠️ توصیه فوق‌العاده مهم درباره جیمیل و سلب مسئولیت حقوقی:</strong>
                      <p>
                        همان‌طور که مستحضر هستید، اخیراً ساخت اکانت‌های جدید جیمیل در ایران با دشواری‌های زیادی همراه شده و ریسک بالای مسدودی (Disable شدن توسط ربات‌های گوگل) را در پی دارد. <strong>پیشنهاد اکید تیم Gemini Shop:</strong> جهت فعال‌سازی اشتراک، حتماً از یک <strong>جیمیل فرعی و باسابقه (نه جیمیل شخصی و کاری اصلی و نه جیمیل تازه ساخته‌شده)</strong> استفاده فرمایید؛ چرا که اکانت‌های نوپا به سرعت توسط گوگل در ایران بلاک می‌شوند.
                      </p>
                      <div className="legal-disclaimer-pill">
                        ⚖️ <strong>سلب مسئولیت رسمی:</strong> در صورت فعال‌سازی بر روی جیمیل اصلی و شخصی یا اکانت‌های تازه تاسیس و بروز هرگونه مسدودی، تعلیق یا غیرفعال شدن اکانت توسط شرکت گوگل، فروشگاه Gemini Shop هیچ‌گونه مسئولیتی در قبال اکانت جیمیل کاربر به عهده نخواهد داشت.
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ==================== تب ۲: اشتراک‌های من ==================== */}
            {activeTab === 'subscriptions' && (
              <div className="user-orders-view">
                {/* کارت ویژه لایسنس رسمی فعال */}
                {latestApprovedOrder && latestApprovedOrder.activationLink ? (
                  <div className="vip-license-card-light">
                    <div className="vip-license-head-light">
                      <div className="vip-icon-light">
                        <GeminiStar size={24} />
                      </div>
                      <div>
                        <span className="vip-tag-light">✦ لایسنس رسمی فعال Google AI Pro</span>
                        <h4>{latestApprovedOrder.productName}</h4>
                        <p>اکانت جیمیل متصل: <b className="en">{latestApprovedOrder.gmail}</b></p>
                      </div>
                    </div>

                    <div className="vip-link-box-light">
                      <label>لینک اختصاصی دعوت رسمی گوگل (Google One Promo URL):</label>
                      <div className="vip-link-input-row-light">
                        <input
                          type="text"
                          readOnly
                          dir="ltr"
                          className="en vip-input-light"
                          value={latestApprovedOrder.activationLink}
                        />
                        <button
                          type="button"
                          className="btn-copy-action-light"
                          onClick={() => handleCopyLink(latestApprovedOrder.activationLink!, 'vip_link')}
                        >
                          <Icon name={copiedLink === 'vip_link' ? 'check' : 'copy'} size={15} />
                          <span>{copiedLink === 'vip_link' ? 'کپی شد!' : 'کپی لینک'}</span>
                        </button>
                      </div>
                    </div>

                    <div className="vip-actions-row-light">
                      <a
                        href={latestApprovedOrder.activationLink}
                        target="_blank"
                        rel="noreferrer"
                        className="btn-vip-activate-light"
                      >
                        <span>ورود مستقیم به گوگل و فعال‌سازی اشتراک</span>
                        <Icon name="external" size={16} />
                      </a>
                    </div>

                    <div className="vip-instructions-box">
                      <Icon name="shield" size={15} />
                      <span><strong>راهنمای فعال‌سازی:</strong> پیش از کلیک روی لینک، VPN یا ابزار تغییر IP خود را روشن فرمایید تا گوگل اشتراک را بدون خطا بر روی اکانت جیمیل شما فعال کند.</span>
                    </div>
                  </div>
                ) : (
                  <div className="empty-orders-card">
                    <Icon name="sparkle" size={40} />
                    <h4>هنوز اشتراک فعالی برای این حساب ثبت نشده است</h4>
                    <p>به محض ثبت سفارش و تأیید واریز، لینک رسمی دعوت گوگل و دسترسی اختصاصی شما در این بخش فعال خواهد شد.</p>
                    <button
                      type="button"
                      className="btn-empty-buy-light"
                      onClick={() => {
                        onClose();
                        onBuy();
                      }}
                    >
                      خرید و فعال‌سازی اشتراک ۱۸ ماهه Google AI Pro
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* ==================== تب ۳: موجودی و تراکنش‌ها ==================== */}
            {activeTab === 'transactions' && (
              <div className="user-transactions-view">
                <div className="transactions-wallet-card">
                  <div className="wallet-card-head">
                    <div>
                      <span className="wallet-label">موجودی کیف پول حساب کاربری</span>
                      <strong className="wallet-amount">۰ <small>تومان</small></strong>
                      <p>روش تسویه کنونی: پرداخت مستقیم کارت به کارت با ثبت فیش</p>
                    </div>
                    <button
                      type="button"
                      className="btn-wallet-topup"
                      onClick={() => {
                        onClose();
                        onBuy();
                      }}
                    >
                      + خرید لایسنس جدید
                    </button>
                  </div>
                </div>

                <div className="orders-timeline-section" style={{ marginTop: '20px' }}>
                  <div className="orders-header-row">
                    <h3>سوابق تراکنش‌ها و پرداخت‌های بانکی ({orders.length} مورد)</h3>
                    {pendingOrders.length > 0 && (
                      <span className="orders-pending-chip">
                        <Icon name="clock" size={13} />
                        <span>{pendingOrders.length} تراکنش در حال بررسی</span>
                      </span>
                    )}
                  </div>

                  {orders.length === 0 ? (
                    <div className="empty-orders-card">
                      <Icon name="bag" size={36} />
                      <h4>تراکنشی یافت نشد</h4>
                      <p>پس از ثبت سفارش و واریز وجه، رسید دیجیتال و کد پیگیری تراکنش در این جدول ثبت می‌گردد.</p>
                    </div>
                  ) : (
                    <div className="orders-stack">
                      {orders.map((o) => (
                        <div key={o.id} className="order-item-card-light">
                          <div className="order-item-top">
                            <div>
                              <strong>{o.productName}</strong>
                              <span className="order-code-tag en">
                                {o.id}
                                <button
                                  type="button"
                                  className="btn-copy-tiny"
                                  onClick={() => handleCopyOrderId(o.id)}
                                  title="کپی شناسه"
                                >
                                  {copiedOrderId === o.id ? '✓' : <Icon name="copy" size={11} />}
                                </button>
                              </span>
                            </div>

                            <div className="order-status-wrap">
                              {o.status === 'approved' && (
                                <span className="status-pill-clean status-pill-clean--approved">
                                  <Icon name="check" size={12} />
                                  <span>تأییدشده و فعال</span>
                                </span>
                              )}
                              {o.status === 'pending_verification' && (
                                <span className="status-pill-clean status-pill-clean--pending">
                                  <Icon name="clock" size={12} />
                                  <span>در نوبت بررسی فیش</span>
                                </span>
                              )}
                              {o.status === 'rejected' && (
                                <span className="status-pill-clean status-pill-clean--rejected">
                                  <Icon name="close" size={12} />
                                  <span>عدم تأیید فیش</span>
                                </span>
                              )}
                              <b className="order-amount-text">{formatToman(o.amountToman)} <small>تومان</small></b>
                            </div>
                          </div>

                          <div className="order-item-meta">
                            <div><span>تاریخ:</span> <small>{new Date(o.createdAt).toLocaleDateString('fa-IR')}</small></div>
                            <div><span>جیمیل مقصد:</span> <small className="en text-accent">{o.gmail}</small></div>
                            <div><span>پیگیری فیش:</span> <small className="en">{o.paymentRef}</small></div>
                            <div><span>روش واریز:</span> <small>{o.paymentMethod === 'bezanbekart' ? 'درگاه بزن به کارت' : 'کارت به کارت'}</small></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ==================== تب ۴: پروفایل کاربری ==================== */}
            {activeTab === 'profile' && (
              <div className="user-profile-edit-view">
                <div className="profile-form-card">
                  <div className="profile-form-head">
                    <Icon name="user" size={18} />
                    <div>
                      <h3>اطلاعات هویتی خریدار</h3>
                      <p>مشخصات شما جهت ثبت لایسنس رسمی هوش مصنوعی استفاده می‌شود</p>
                    </div>
                  </div>

                  <form onSubmit={handleSaveProfile} className="profile-edit-form">
                    <div className="form-field">
                      <label>نام و نام خانوادگی:</label>
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        placeholder="مثال: نریمان موذنی"
                        required
                      />
                    </div>

                    <div className="form-field">
                      <label>آدرس جیمیل پیش‌فرض (جهت فعال‌سازی اشتراک گوگل):</label>
                      <input
                        type="email"
                        dir="ltr"
                        className="en"
                        value={editGmail}
                        onChange={(e) => setEditGmail(e.target.value)}
                        placeholder="yourname@gmail.com"
                        required
                      />
                    </div>

                    <div className="form-field">
                      <label>شماره تماس همراه (تأییدشده با OTP):</label>
                      <input
                        type="text"
                        readOnly
                        dir="ltr"
                        className="en input-disabled"
                        value={user.mobile || 'ثبت‌نشده'}
                      />
                    </div>

                    {savedNote && (
                      <div className="save-toast-success">
                        <Icon name="check" size={15} />
                        <span>تغییرات مشخصات با موفقیت ذخیره شد.</span>
                      </div>
                    )}

                    <div className="form-submit-row">
                      <button type="submit" className="btn-save-profile">
                        ذخیره تغییرات مشخصات
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* ==================== تب ۵: تیکت‌های پشتیبانی ==================== */}
            {activeTab === 'support' && (
              <div className="user-support-view">
                <div className="support-hero-card">
                  <div className="support-icon-circle">
                    <Icon name="headset" size={28} />
                  </div>
                  <h3>مرکز پشتیبانی و تیکت آنلاین Gemini Shop</h3>
                  <p>تیم فنی و پشتیبانی ۲۴/۷ آماده پاسخگویی به پرسش‌ها و بررسی سفارشات شماست.</p>

                  <div className="support-channels-grid">
                    <div className="support-channel-item">
                      <span className="channel-icon">💬</span>
                      <strong>چت آنلاین داخل سایت</strong>
                      <p>گفتگوی زنده با پشتیبان جهت استعلام فوری فیش و وضعیت لایسنس</p>
                      {onOpenChat && (
                        <button
                          type="button"
                          className="btn-channel-action"
                          onClick={() => {
                            onClose();
                            onOpenChat();
                          }}
                        >
                          باز کردن چت آنلاین
                        </button>
                      )}
                    </div>

                    <div className="support-channel-item">
                      <span className="channel-icon">✈️</span>
                      <strong>پشتیبانی اختصاصی تلگرام</strong>
                      <p>ارسال پیام به آی‌دی مستقیم تلگرام با زمان پاسخگویی کمتر از ۵ دقیقه</p>
                      <a
                        href="https://t.me/GeminiProSupport"
                        target="_blank"
                        rel="noreferrer"
                        className="btn-channel-action"
                      >
                        ارسال پیام در تلگرام
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ==================== تب ۶: راهنمای فعال‌سازی ==================== */}
            {activeTab === 'guide' && (
              <div className="user-guide-view">
                <div className="guide-card">
                  <h3>راهنمای ۴ مرحله‌ای فعال‌سازی اشتراک Google AI Pro</h3>
                  <p className="guide-intro">لطفاً پیش از کلیک روی لینک لایسنس اختصاصی مراحل زیر را رعایت فرمایید:</p>

                  <div className="guide-steps-list">
                    <div className="guide-step-item">
                      <div className="step-num-badge">۱</div>
                      <div>
                        <strong>روشن کردن ابزار تغییر IP (DNS Leak Free)</strong>
                        <p>به دلیل محدودیت‌های منطقه‌ای شرکت گوگل، پیش از باز کردن لینک حتماً VPN با کیفیت (لوکیشن آمریکا، آلمان یا امارات) را متصل فرمایید.</p>
                      </div>
                    </div>

                    <div className="guide-step-item">
                      <div className="step-num-badge">۲</div>
                      <div>
                        <strong>ورود به اکانت جیمیل (ترجیحاً جیمیل فرعی و باسابقه)</strong>
                        <p>
                          مطمئن شوید همان اکانت جیمیل که می‌خواهید اشتراک روی آن فعال شود در مرورگر لاگین باشد. <strong>توصیه حیاتی:</strong> اکیداً پیشنهاد می‌شود از یک <strong>جیمیل فرعیِ باسابقه</strong> استفاده نمایید و از فعال‌سازی روی جیمیل‌های تازه ساخته‌شده (به دلیل ریسک بالای مسدودی سریع توسط گوگل در ایران) یا اکانت اصلی کاری خودداری فرمایید.
                        </p>
                      </div>
                    </div>

                    <div className="guide-step-item">
                      <div className="step-num-badge">۳</div>
                      <div>
                        <strong>کلیک بر روی لینک اختصاصی دعوت گوگل</strong>
                        <p>از تب «اشتراک‌های من» روی دکمه ورود مستقیم به گوگل کلیک کنید و در صفحه بازشده دکمه «Accept Promo» یا تایید را بزنید.</p>
                      </div>
                    </div>

                    <div className="guide-step-item">
                      <div className="step-num-badge">۴</div>
                      <div>
                        <strong>تأیید فعال‌سازی و لذت بردن از هوش مصنوعی</strong>
                        <p>ظرف چند ثانیه، فضای ۲ ترابایت Google One و نشان Gemini Advanced بر روی اکانت شما فعال خواهد شد.</p>
                      </div>
                    </div>
                  </div>

                  {/* جعبه سلب مسئولیت و تذکر راهنما */}
                  <div className="guide-disclaimer-callout">
                    <div className="disclaimer-callout-head">
                      <Icon name="alert" size={20} />
                      <strong>⚠️ تذکر امنیتی و سلب مسئولیت قانونی در انتخاب جیمیل:</strong>
                    </div>
                    <p>
                      ساخت جیمیل جدید در ایران با حساسیت‌های شدید گوگل روبروست و جیمیل‌های نوپا سریعاً توسط گوگل مسدود (Disable) می‌شوند. ترجیح و توصیه کاربردی تیم Gemini Shop فعال‌سازی لایسنس روی اکانت فرعی باسابقه است. توجه داشته باشید در صورت فعال‌سازی روی جیمیل شخصی اصلی و بروز مسدودی توسط گوگل، مجموعه ما هیچ‌گونه مسئولیتی در قبال وضعیت اکانت متقبل نخواهد شد.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* ==================== تب ۷: درباره ما ==================== */}
            {activeTab === 'about' && (
              <div className="user-about-view">
                <div className="about-brand-card">
                  <div className="about-brand-head">
                    <span className="brand-gemini-sparkle" style={{ fontSize: '32px' }}>✦</span>
                    <div>
                      <h3>درباره Gemini Shop</h3>
                      <p>پلتفرم ارائه اشتراک‌های رسمی و قانونی هوش مصنوعی گوگل در ایران</p>
                    </div>
                  </div>
                  <div className="about-text-body">
                    <p>
                      فروشگاه Gemini Shop با هدف تسهیل دسترسی متخصصان، پژوهشگران و کاربران ایرانی به جدیدترین نسخه هوش مصنوعی Google Gemini Pro و سرویس ابری ۵ ترابایت گوگل تأسیس گردیده است.
                    </p>
                    <p>
                      تمامی لایسنس‌های ارائه‌شده ۱۰۰٪ رسمی و به صورت دعوت‌نامه مستقیم Google One صادر می‌شوند و هیچ‌گونه اکانت اشتراکی، کرک‌شده یا ناامن به خریداران تحویل داده نمی‌شود.
                    </p>
                  </div>
                  <div className="about-guarantees-row">
                    <div className="guarantee-pill">🔒 لایسنس اختصاصی روی اکانت شخصی شما</div>
                    <div className="guarantee-pill">⚡ تحویل سریع ۲ الی ۴۸ ساعته</div>
                    <div className="guarantee-pill">🛡️ پشتیبانی و تضمین کارکرد تا آخرین روز</div>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
