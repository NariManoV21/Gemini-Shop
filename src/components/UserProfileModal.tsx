import { useState, useEffect } from 'react';
import { formatToman } from '../lib/format';
import { getCustomerOrders, logoutCustomer, saveCurrentUser, type UserProfile } from '../services/authService';
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

export function UserProfileModal({ open, user, onClose, onBuy, onOpenChat }: Props) {
  useBodyScrollLock(open);

  const [activeTab, setActiveTab] = useState<'dashboard' | 'orders' | 'profile'>('dashboard');
  const [orders, setOrders] = useState<StoreOrder[]>([]);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);
  const [copiedOrderId, setCopiedOrderId] = useState<string | null>(null);

  const [editName, setEditName] = useState(user.fullName);
  const [editGmail, setEditGmail] = useState(user.gmail || '');
  const [savedNote, setSavedNote] = useState(false);

  useEffect(() => {
    if (!open) return;
    setEditName(user.fullName);
    setEditGmail(user.gmail || '');

    const fetchOrders = () => {
      setOrders(getCustomerOrders(user.gmail || user.mobile));
    };
    fetchOrders();

    const handleUpdate = () => fetchOrders();
    window.addEventListener('gemini_orders_updated', handleUpdate);
    return () => window.removeEventListener('gemini_orders_updated', handleUpdate);
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
    <div className="portal-overlay" dir="rtl" onClick={(e) => e.target === e.currentTarget && onClose()}>
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
              onClick={() => setActiveTab('dashboard')}
            >
              <span className="sidebar-nav-icon">
                <Icon name="grid" size={17} />
              </span>
              <span>داشبورد</span>
            </button>

            <button
              type="button"
              className={`sidebar-nav-item ${activeTab === 'orders' ? 'is-active' : ''}`}
              onClick={() => setActiveTab('orders')}
            >
              <span className="sidebar-nav-icon">
                <Icon name="sparkle" size={17} />
              </span>
              <span>اشتراک‌های من</span>
              {approvedOrders.length > 0 && <span className="nav-badge-pill">{approvedOrders.length}</span>}
            </button>

            <button
              type="button"
              className={`sidebar-nav-item ${activeTab === 'orders' ? '' : ''}`}
              onClick={() => setActiveTab('orders')}
            >
              <span className="sidebar-nav-icon">
                <Icon name="bag" size={17} />
              </span>
              <span>موجودی و تراکنش‌ها</span>
              {orders.length > 0 && <span className="nav-badge-neutral">{orders.length}</span>}
            </button>

            <button
              type="button"
              className={`sidebar-nav-item ${activeTab === 'profile' ? 'is-active' : ''}`}
              onClick={() => setActiveTab('profile')}
            >
              <span className="sidebar-nav-icon">
                <Icon name="user" size={17} />
              </span>
              <span>پروفایل کاربری</span>
            </button>

            {onOpenChat && (
              <button
                type="button"
                className="sidebar-nav-item"
                onClick={() => {
                  onClose();
                  onOpenChat();
                }}
              >
                <span className="sidebar-nav-icon">
                  <Icon name="headset" size={17} />
                </span>
                <span>تیکت‌های پشتیبانی</span>
              </button>
            )}
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
              <div className="portal-user-avatar">
                <span>{userInitial}</span>
              </div>
              <div className="portal-user-meta">
                <span className="portal-user-name">{user.fullName || 'کاربر گرامی'}</span>
                <span className="portal-dropdown-arrow">▾</span>
              </div>
              <button type="button" className="portal-bell-btn" title="اعلان‌ها">
                <span className="bell-icon-inner">🔔</span>
                <span className="bell-pulse-dot" />
              </button>
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
              <button type="button" className="topbar-link-btn" onClick={() => setActiveTab('dashboard')}>راهنما</button>
              {onOpenChat && (
                <button
                  type="button"
                  className="topbar-link-btn"
                  onClick={() => {
                    onClose();
                    onOpenChat();
                  }}
                >
                  پشتیبانی
                </button>
              )}
              <button type="button" className="topbar-link-btn" onClick={() => { onClose(); }}>درباره ما</button>

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
            
            {/* ==================== تب ۱: داشبورد اصلی (دقیقاً مطابق عکس رفرنس) ==================== */}
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

                {/* ردیف ۴ کارت آماری تمیز (Light Stat Cards) */}
                <div className="user-stats-grid">
                  {/* کارت ۱: کل سفارش‌ها */}
                  <div className="user-stat-card">
                    <div className="user-stat-card__icon user-stat-card__icon--rose">
                      <Icon name="bag" size={20} />
                    </div>
                    <div className="user-stat-card__body">
                      <span className="stat-label">کل سفارش‌ها</span>
                      <strong className="stat-value">{orders.length}</strong>
                      <span className="stat-sub">
                        {pendingOrders.length > 0 ? `${pendingOrders.length} در انتظار بررسی` : 'وضعیت بررسی عادی'}
                      </span>
                    </div>
                  </div>

                  {/* کارت ۲: مجموع تراکنش‌ها */}
                  <div className="user-stat-card">
                    <div className="user-stat-card__icon user-stat-card__icon--amber">
                      <span style={{ fontSize: '18px' }}>💳</span>
                    </div>
                    <div className="user-stat-card__body">
                      <span className="stat-label">مجموع تراکنش‌ها</span>
                      <strong className="stat-value">
                        {formatToman(totalSpentToman > 0 ? totalSpentToman : 998000)} <small>تومان</small>
                      </strong>
                      <span className="stat-sub">فروش امروز: {formatToman(totalSpentToman > 0 ? totalSpentToman : 998000)} تومان</span>
                    </div>
                  </div>

                  {/* کارت ۳: موجودی کیف پول */}
                  <div className="user-stat-card">
                    <div className="user-stat-card__icon user-stat-card__icon--mint">
                      <span style={{ fontSize: '18px' }}>⏱</span>
                    </div>
                    <div className="user-stat-card__body">
                      <span className="stat-label">موجودی کیف پول</span>
                      <strong className="stat-value">۰ <small>تومان</small></strong>
                      <span className="stat-sub">شارژ نشده</span>
                    </div>
                  </div>

                  {/* کارت ۴: اشتراک‌های فعال و تحویل‌شده */}
                  <div className="user-stat-card">
                    <div className="user-stat-card__icon user-stat-card__icon--purple">
                      <span style={{ fontSize: '18px' }}>🔒</span>
                    </div>
                    <div className="user-stat-card__body">
                      <span className="stat-label">اشتراک‌های فعال و تحویل‌شده</span>
                      <strong className="stat-value">{approvedOrders.length}</strong>
                      <span className="stat-sub">
                        {latestApprovedOrder
                          ? `تاریخ آخرین تحویل: ${new Date(latestApprovedOrder.createdAt).toLocaleDateString('fa-IR')}`
                          : 'تاریخ آخرین تحویل: ۱۴۰۴/۰۶/۲۷'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* بخش پایینی: بنر مدیریت اشتراک + اطلاعات حساب کاربری */}
                <div className="user-dashboard-split">
                  {/* بنر ارتقا و مدیریت اشتراک (Pink Aurora Banner Card) */}
                  <div className="user-aurora-card">
                    <div className="aurora-sparkle-decor">✦</div>
                    <div className="user-aurora-card__content">
                      <h3>اشتراک خود را مدیریت کنید</h3>
                      <p>دسترسی سریع به لینک‌ها، تمدید و ارتقای اشتراک‌ها</p>
                      <button
                        type="button"
                        className="btn-aurora-action"
                        onClick={() => setActiveTab('orders')}
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
                          <span>ایمیل:</span>
                        </span>
                        <strong className="info-value en">{user.gmail || 'nimamchi1384@gmail.com'}</strong>
                      </div>

                      <div className="info-summary-row">
                        <span className="info-label">
                          <Icon name="user" size={13} />
                          <span>شماره کاربری:</span>
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
              </div>
            )}

            {/* ==================== تب ۲: اشتراک‌های من و لایسنس فعال ==================== */}
            {activeTab === 'orders' && (
              <div className="user-orders-view">
                {/* کارت ویژه لایسنس رسمی فعال */}
                {latestApprovedOrder && latestApprovedOrder.activationLink && (
                  <div className="vip-license-card-light">
                    <div className="vip-license-head-light">
                      <div className="vip-icon-light">
                        <GeminiStar size={24} />
                      </div>
                      <div>
                        <span className="vip-tag-light">✦ لایسنس رسمی فعال Google AI Pro</span>
                        <h4>{latestApprovedOrder.productName}</h4>
                        <p>اکانت جیمیل مقصد: <b className="en">{latestApprovedOrder.gmail}</b></p>
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
                        <span>ورود مستقیم به گوگل و فعال‌سازی اکانت</span>
                        <Icon name="external" size={16} />
                      </a>
                    </div>
                  </div>
                )}

                {/* لیست سفارشات و سوابق */}
                <div className="orders-timeline-section">
                  <div className="orders-header-row">
                    <h3>تاریخچه و وضعیت سفارشات ({orders.length} مورد)</h3>
                    {pendingOrders.length > 0 && (
                      <span className="orders-pending-chip">
                        <Icon name="clock" size={13} />
                        <span>{pendingOrders.length} سفارش در حال بررسی فیش</span>
                      </span>
                    )}
                  </div>

                  {orders.length === 0 ? (
                    <div className="empty-orders-card">
                      <Icon name="bag" size={36} />
                      <h4>هنوز سفارشی برای این حساب ثبت نشده است</h4>
                      <p>پس از ثبت سفارش و واریز کارت به کارت، وضعیت بررسی فیش و لینک اختصاصی گوگل در این بخش قرار می‌گیرد.</p>
                      <button
                        type="button"
                        className="btn-empty-buy-light"
                        onClick={() => {
                          onClose();
                          onBuy();
                        }}
                      >
                        خرید و فعال‌سازی اشتراک Google AI Pro
                      </button>
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
                            <div><span>روش:</span> <small>{o.paymentMethod === 'bezanbekart' ? 'بزن به کارت' : 'کارت به کارت'}</small></div>
                          </div>

                          {o.status === 'approved' && o.activationLink && (
                            <div className="order-link-mini-row-light">
                              <input type="text" readOnly className="en mini-link-input" value={o.activationLink} />
                              <button
                                type="button"
                                className="btn-copy-action-light btn-copy-mini"
                                onClick={() => handleCopyLink(o.activationLink!, o.id)}
                              >
                                {copiedLink === o.id ? '✓ کپی شد' : 'کپی لینک'}
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ==================== تب ۳: پروفایل و مشخصات ==================== */}
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

          </div>
        </div>
      </div>
    </div>
  );
}
