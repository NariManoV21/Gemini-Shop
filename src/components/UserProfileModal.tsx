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

  const [activeTab, setActiveTab] = useState<'orders' | 'profile'>('orders');
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

  return (
    <div className="profile-overlay" dir="rtl" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="profile-modal" role="dialog" aria-modal="true" aria-labelledby="profile-title">
        {/* نوار سربرگ لوکس حساب کاربری */}
        <header className="profile-header">
          <div className="profile-user-summary">
            <div className="profile-avatar-wrap">
              <span className="profile-avatar-char">{user.fullName ? user.fullName.slice(0, 1) : 'گ'}</span>
              <span className="profile-avatar-dot" title="حساب فعال" />
            </div>

            <div className="profile-meta">
              <div className="profile-meta__title-row">
                <h3 id="profile-title">{user.fullName || 'کاربر گرامی'}</h3>
                <span className="profile-badge-tier">
                  <Icon name="shield" size={13} />
                  <span>مشتری تأییدشده</span>
                </span>
                {approvedOrders.length > 0 && (
                  <span className="profile-badge-active">
                    <Icon name="sparkle" size={12} />
                    <span>اشتراک فعال</span>
                  </span>
                )}
              </div>

              <div className="profile-meta__contact-chips">
                {user.gmail && (
                  <span className="contact-chip contact-chip--gmail">
                    <GoogleG size={13} />
                    <span className="en">{user.gmail}</span>
                  </span>
                )}
                {user.mobile && (
                  <span className="contact-chip contact-chip--phone">
                    <span className="en">{user.mobile}</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* تنها یک دکمه بستن شفاف در گوشه کادر، بدون هیچ دکمه خروج مزاحم */}
          <button
            type="button"
            className="profile-modal__close-btn"
            onClick={onClose}
            aria-label="بستن پنجره حساب کاربری"
            title="بستن پنجره (Esc)"
          >
            <Icon name="close" size={18} />
          </button>
        </header>

        {/* نوار جابجایی تب‌ها */}
        <nav className="profile-tabs-nav" aria-label="بخش‌های پروفایل">
          <button
            type="button"
            className={`profile-tab-btn ${activeTab === 'orders' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('orders')}
          >
            <Icon name="bag" size={16} />
            <span>سفارش‌ها و اشتراک‌های من</span>
            {orders.length > 0 && <span className="profile-tab-count">{orders.length}</span>}
          </button>

          <button
            type="button"
            className={`profile-tab-btn ${activeTab === 'profile' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('profile')}
          >
            <Icon name="user" size={16} />
            <span>مشخصات و امنیت حساب</span>
          </button>
        </nav>

        {/* بدنه محتوا */}
        <div className="profile-body-content">
          {/* ==================== تب ۱: سفارشات و اشتراک فعال ==================== */}
          {activeTab === 'orders' && (
            <div className="profile-orders-view">
              {/* کارت ویژه VIP: لایسنس فعال Google AI Pro (در صورت وجود سفارش تأیید شده) */}
              {latestApprovedOrder && latestApprovedOrder.activationLink && (
                <div className="vip-license-card">
                  <div className="vip-license-card__head">
                    <div className="vip-gemini-icon">
                      <GeminiStar size={24} />
                    </div>
                    <div>
                      <div className="vip-tag">
                        <span>✦ لایسنس رسمی فعال شده</span>
                      </div>
                      <h4>{latestApprovedOrder.productName}</h4>
                      <p>متصل به اکانت شخصی جیمیل: <b className="en">{latestApprovedOrder.gmail}</b></p>
                    </div>
                  </div>

                  <div className="vip-link-box">
                    <label>لینک اختصاصی دعوت رسمی گوگل (Google One Promo URL):</label>
                    <div className="vip-link-input-row">
                      <input
                        type="text"
                        readOnly
                        dir="ltr"
                        className="en vip-input"
                        value={latestApprovedOrder.activationLink}
                      />
                      <button
                        type="button"
                        className="btn-copy-action"
                        onClick={() => handleCopyLink(latestApprovedOrder.activationLink!, 'vip_link')}
                      >
                        <Icon name={copiedLink === 'vip_link' ? 'check' : 'copy'} size={15} />
                        <span>{copiedLink === 'vip_link' ? 'کپی شد!' : 'کپی لینک'}</span>
                      </button>
                    </div>
                  </div>

                  <div className="vip-actions-row">
                    <a
                      href={latestApprovedOrder.activationLink}
                      target="_blank"
                      rel="noreferrer"
                      className="btn btn--vip-activate"
                    >
                      <span>ورود مستقیم به گوگل و فعال‌سازی اشتراک</span>
                      <Icon name="external" size={16} />
                    </a>
                  </div>

                  <div className="vip-guide-note">
                    <Icon name="shield" size={15} />
                    <span>
                      <strong>راهنمای فعال‌سازی:</strong> پیش از کلیک روی لینک، ابزار تغییر IP (DNS Leak Free) خود را روشن کنید تا گوگل اشتراک را بدون خطا بر روی جیمیل شما ثبت نماید.
                    </span>
                  </div>
                </div>
              )}

              {/* لیست تاریخچه سفارشات */}
              {orders.length === 0 ? (
                <div className="profile-empty-state">
                  <div className="profile-empty-icon">
                    <Icon name="bag" size={38} />
                  </div>
                  <h4>هنوز سفارشی برای این حساب کاربری ثبت نشده است</h4>
                  <p>
                    پس از ثبت سفارش و واریز کارت به کارت، وضعیت بررسی فیش و لینک اختصاصی لایسنس گوگل در این بخش قرار می‌گیرد.
                  </p>
                  <button
                    type="button"
                    className="btn btn--accent btn-empty-buy"
                    onClick={() => {
                      onClose();
                      onBuy();
                    }}
                  >
                    <Icon name="sparkle" size={16} />
                    <span>خرید و فعال‌سازی اشتراک Google AI Pro</span>
                  </button>
                </div>
              ) : (
                <div className="orders-timeline-container">
                  <div className="orders-section-header">
                    <h4>تاریخچه و وضعیت سفارشات ({orders.length} مورد)</h4>
                    {pendingOrders.length > 0 && (
                      <span className="pending-alert-badge">
                        <span className="pulse-dot" /> {pendingOrders.length} سفارش در حال بررسی
                      </span>
                    )}
                  </div>

                  <div className="orders-cards-stack">
                    {orders.map((o) => (
                      <div key={o.id} className={`order-card-item order-card-item--${o.status}`}>
                        <div className="order-card-item__top">
                          <div className="order-item-title-group">
                            <strong>{o.productName}</strong>
                            <div className="order-item-id-pill">
                              <span className="en">{o.id}</span>
                              <button
                                type="button"
                                className="btn-copy-tiny"
                                onClick={() => handleCopyOrderId(o.id)}
                                title="کپی کد سفارش"
                              >
                                {copiedOrderId === o.id ? '✓' : <Icon name="copy" size={12} />}
                              </button>
                            </div>
                          </div>

                          <div className="order-item-status-col">
                            {o.status === 'approved' && (
                              <span className="status-pill-order status-pill-order--approved">
                                <Icon name="check" size={13} />
                                <span>تأییدشده و فعال</span>
                              </span>
                            )}
                            {o.status === 'pending_verification' && (
                              <span className="status-pill-order status-pill-order--pending">
                                <Icon name="clock" size={13} />
                                <span>در نوبت بررسی فیش</span>
                              </span>
                            )}
                            {o.status === 'rejected' && (
                              <span className="status-pill-order status-pill-order--rejected">
                                <Icon name="close" size={13} />
                                <span>عدم تأیید فیش</span>
                              </span>
                            )}
                            <b className="order-item-amount">{formatToman(o.amountToman)} <small>تومان</small></b>
                          </div>
                        </div>

                        {/* اطلاعات پرداختی */}
                        <div className="order-item-meta-grid">
                          <div>
                            <span>تاریخ ثبت:</span>
                            <small>{new Date(o.createdAt).toLocaleDateString('fa-IR')} ساعت {new Date(o.createdAt).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })}</small>
                          </div>
                          <div>
                            <span>جیمیل مقصد:</span>
                            <small className="en text-highlight">{o.gmail}</small>
                          </div>
                          <div>
                            <span>شماره پیگیری فیش:</span>
                            <small className="en">{o.paymentRef}</small>
                          </div>
                          <div>
                            <span>روش واریز:</span>
                            <small>{o.paymentMethod === 'bezanbekart' ? 'درگاه بزن به کارت' : 'کارت به کارت'}</small>
                          </div>
                        </div>

                        {/* وضعیت جزئیات لینک فعال‌سازی */}
                        {o.status === 'approved' && o.activationLink && (
                          <div className="order-item-activation-section">
                            <div className="order-link-mini-row">
                              <input type="text" readOnly className="en mini-link-input" value={o.activationLink} />
                              <button
                                type="button"
                                className="btn btn--sm btn--outline"
                                onClick={() => handleCopyLink(o.activationLink!, o.id)}
                              >
                                {copiedLink === o.id ? '✓ کپی شد' : 'کپی لینک'}
                              </button>
                            </div>
                          </div>
                        )}

                        {o.status === 'pending_verification' && (
                          <div className="order-item-pending-notice">
                            <div className="pending-notice-head">
                              <Icon name="clock" size={15} />
                              <span>فیش واریزی شما ثبت شده و در نوبت بررسی دستی پشتیبانی قرار دارد (معمولاً ۲ الی ۴۸ ساعت).</span>
                            </div>
                            {onOpenChat && (
                              <button
                                type="button"
                                className="btn btn--sm btn--ghost btn-chat-nudge"
                                onClick={() => {
                                  onClose();
                                  onOpenChat();
                                }}
                              >
                                <Icon name="headset" size={14} />
                                <span>ارسال پیام به پشتیبانی چت جهت پیگیری</span>
                              </button>
                            )}
                          </div>
                        )}

                        {o.status === 'rejected' && (
                          <div className="order-item-rejected-notice">
                            <strong>علت عدم تأیید:</strong>
                            <p>{o.adminNotes || 'عدم تطابق فیش واریزی با مبلغ یا شماره ارجاع نامعتبر.'}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ==================== تب ۲: تنظیمات و مشخصات کاربری ==================== */}
          {activeTab === 'profile' && (
            <div className="profile-settings-view">
              <div className="profile-card">
                <div className="profile-card__head">
                  <Icon name="user" size={18} />
                  <div>
                    <h4>اطلاعات هویتی خریدار</h4>
                    <p>مشخصات شما جهت ثبت رسمی اشتراک و پیگیری لایسنس هوش مصنوعی استفاده می‌شود</p>
                  </div>
                </div>

                <form onSubmit={handleSaveProfile} className="profile-settings-form">
                  <div className="form-group">
                    <label>نام و نام خانوادگی:</label>
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder="مثال: علی احمدی"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>آدرس جیمیل پیش‌فرض (جهت فعال‌سازی اکانت گوگل):</label>
                    <input
                      type="email"
                      dir="ltr"
                      className="en"
                      value={editGmail}
                      onChange={(e) => setEditGmail(e.target.value)}
                      placeholder="name@gmail.com"
                      required
                    />
                    <small>اکانت جیمیل شما که اشتراک ۱۸ ماهه Google AI Pro روی آن اعمال خواهد شد</small>
                  </div>

                  <div className="form-group">
                    <label>شماره تماس همراه (تأییدشده):</label>
                    <div className="verified-mobile-field">
                      <input
                        type="text"
                        readOnly
                        dir="ltr"
                        className="en input-readonly"
                        value={user.mobile || 'ثبت‌نشده'}
                      />
                      <span className="verified-badge">
                        <Icon name="check" size={13} />
                        <span>تأییدشده با OTP</span>
                      </span>
                    </div>
                  </div>

                  {savedNote && (
                    <div className="profile-success-toast">
                      <Icon name="check" size={16} />
                      <span>تغییرات مشخصات با موفقیت ذخیره شد.</span>
                    </div>
                  )}

                  <div className="form-actions-row">
                    <button type="submit" className="btn btn--accent">
                      <span>ذخیره تغییرات مشخصات</span>
                    </button>
                  </div>
                </form>
              </div>

              {/* بخش مجزا و شفاف امنیت نشست و خروج از حساب (کاملاً تفکیک‌شده از دکمه بستن) */}
              <div className="profile-security-card">
                <div className="profile-security-card__info">
                  <div className="security-icon-wrap">
                    <Icon name="shield" size={20} />
                  </div>
                  <div>
                    <h4>نشست کاربری و امنیت حساب</h4>
                    <p>
                      برای خروج از حساب کاربری روی این مرورگر، از دکمه روبه‌رو استفاده فرمایید. تمام سفارشات و لایسنس‌های شما بر روی ایمیل و شماره همراه شما محفوظ خواهد ماند.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  className="btn-logout-danger"
                  onClick={handleLogout}
                  title="خروج از حساب کاربری جاری"
                >
                  <Icon name="logout" size={16} />
                  <span>خروج از حساب کاربری</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
