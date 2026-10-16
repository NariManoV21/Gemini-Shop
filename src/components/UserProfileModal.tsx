import { useState, useEffect } from 'react';
import { formatToman } from '../lib/format';
import { getCustomerOrders, logoutCustomer, saveCurrentUser, type UserProfile } from '../services/authService';
import type { StoreOrder } from '../services/orderStorage';
import { Icon, GeminiStar } from './Icon';
import './UserProfileModal.css';

interface Props {
  open: boolean;
  user: UserProfile;
  onClose: () => void;
  onBuy: () => void;
  onOpenChat?: () => void;
}

export function UserProfileModal({ open, user, onClose, onBuy, onOpenChat }: Props) {
  const [activeTab, setActiveTab] = useState<'orders' | 'profile'>('orders');
  const [orders, setOrders] = useState<StoreOrder[]>([]);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);

  const [editName, setEditName] = useState(user.fullName);
  const [editGmail, setEditGmail] = useState(user.gmail || '');
  const [savedNote, setSavedNote] = useState(false);

  useEffect(() => {
    if (!open) return;
    const fetchOrders = () => {
      setOrders(getCustomerOrders(user.mobile));
    };
    fetchOrders();

    const handleUpdate = () => fetchOrders();
    window.addEventListener('gemini_orders_updated', handleUpdate);
    return () => window.removeEventListener('gemini_orders_updated', handleUpdate);
  }, [open, user.mobile]);

  if (!open) return null;

  const handleCopy = (link: string, orderId: string) => {
    navigator.clipboard.writeText(link);
    setCopiedLink(orderId);
    setTimeout(() => setCopiedLink(null), 2000);
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    const updated: UserProfile = {
      ...user,
      fullName: editName.trim(),
      gmail: editGmail.trim(),
    };
    saveCurrentUser(updated);
    setSavedNote(true);
    setTimeout(() => setSavedNote(false), 2000);
  };

  const handleLogout = () => {
    logoutCustomer();
    onClose();
  };

  const approvedOrders = orders.filter((o) => o.status === 'approved');

  return (
    <div className="profile-overlay" dir="rtl" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="profile-modal" role="dialog" aria-modal="true">
        {/* هدر اطلاعات پروفایل کاربر */}
        <div className="profile-header">
          <div className="profile-user-info">
            <div className="profile-avatar">
              <span>{user.fullName.slice(0, 1)}</span>
            </div>
            <div className="profile-titles">
              <div className="profile-name-row">
                <h3>{user.fullName}</h3>
                <span className="profile-customer-badge">مشتری Gemini Shop</span>
                {approvedOrders.length > 0 && (
                  <span
                    className="profile-customer-badge"
                    style={{
                      background: 'rgba(16, 185, 129, 0.18)',
                      color: '#10b981',
                      borderColor: 'rgba(16, 185, 129, 0.35)',
                    }}
                  >
                    {approvedOrders.length} لایسنس فعال
                  </span>
                )}
              </div>
              <div className="profile-sub-info">
                <span className="en">{user.mobile}</span>
                {user.gmail && (
                  <>
                    <span className="profile-sub-dot">•</span>
                    <span className="en">{user.gmail}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="profile-header-actions">
            <button className="btn btn--sm btn--ghost" onClick={handleLogout} title="خروج از حساب">
              <Icon name="close" size={14} />
              <span>خروج</span>
            </button>
            <button className="profile-close-btn" onClick={onClose} aria-label="بستن">
              <Icon name="close" size={16} />
            </button>
          </div>
        </div>

        {/* نوار تب‌ها */}
        <div className="profile-nav-tabs">
          <button
            className={`profile-tab ${activeTab === 'orders' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('orders')}
          >
            <Icon name="bag" size={15} />
            <span>سفارش‌ها و لایسنس‌های من</span>
            <span className="profile-badge-count">{orders.length}</span>
          </button>
          <button
            className={`profile-tab ${activeTab === 'profile' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('profile')}
          >
            <Icon name="user" size={15} />
            <span>مشخصات حساب کاربری</span>
          </button>
        </div>

        {/* محتوای تب فعال */}
        <div className="profile-body">
          {/* تب ۱: سفارشات و لینک‌های فعال‌سازی */}
          {activeTab === 'orders' && (
            <div className="profile-orders-list">
              {orders.length === 0 ? (
                <div className="profile-empty-orders">
                  <div className="profile-empty-icon">
                    <Icon name="bag" size={32} />
                  </div>
                  <h4>هنوز سفارشی برای شما ثبت نشده است</h4>
                  <p>پس از ثبت سفارش و انتقال کارت به کارت، وضعیت بررسی و لینک فعال‌سازی رسمی شما در این صفحه قرار می‌گیرد.</p>
                  <button className="btn btn--accent" onClick={() => { onClose(); onBuy(); }}>
                    <span>ثبت سفارش اشتراک ۱۸ ماهه Google AI Pro</span>
                    <Icon name="arrow" size={16} />
                  </button>
                </div>
              ) : (
                orders.map((o) => (
                  <div
                    key={o.id}
                    className={`customer-order-card customer-order-card--${o.status}`}
                  >
                    {/* ردیف بالای کارت سفارش */}
                    <div className="customer-order-card__head">
                      <div className="order-product-badge">
                        <GeminiStar size={20} />
                        <div>
                          <strong>{o.productName}</strong>
                          <span className="order-date-text">
                            ثبت شده در: {new Date(o.createdAt).toLocaleDateString('fa-IR')} ساعت {new Date(o.createdAt).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>

                      <div className="order-price-col">
                        <b>{formatToman(o.amountToman)} تومان</b>
                        <span className="en order-track-id">کد پیگیری: {o.id}</span>
                      </div>
                    </div>

                    {/* بدنه وضعیت و لینک فعال‌سازی لایسنس */}
                    <div className="customer-order-card__body">
                      {o.status === 'approved' && (
                        <div className="license-active-box">
                          <div className="license-active-box__status">
                            <span className="status-badge-active">
                              <Icon name="check" size={13} />
                              <span>لایسنس فعال شد و آماده استفاده است</span>
                            </span>
                            <span className="activation-target-gmail">اکانت جیمیل: <b className="en">{o.gmail}</b></span>
                          </div>

                          <div className="license-link-wrap">
                            <label>لینک اختصاصی دعوت رسمی گوگل (Google AI Pro Promo URL):</label>
                            <div className="license-link-input-row">
                              <input
                                type="text"
                                readOnly
                                className="en"
                                value={o.activationLink || 'در حال آماده‌سازی لینک رسمی...'}
                              />
                              {o.activationLink && (
                                <button
                                  type="button"
                                  className="btn btn--sm btn--copy-link"
                                  onClick={() => handleCopy(o.activationLink!, o.id)}
                                >
                                  <Icon name="copy" size={14} />
                                  <span>{copiedLink === o.id ? 'کپی شد!' : 'کپی لینک'}</span>
                                </button>
                              )}
                            </div>
                          </div>

                          {o.activationLink && (
                            <a
                              href={o.activationLink}
                              target="_blank"
                              rel="noreferrer"
                              className="btn btn--activation-cta"
                            >
                              <span>ورود مستقیم به لینک فعال‌سازی گوگل</span>
                              <Icon name="external" size={15} />
                            </a>
                          )}

                          <div className="license-help-tip">
                            <Icon name="shield" size={15} />
                            <span>
                              <strong>راهنمای فعال‌سازی:</strong> لطفاً قبل از کلیک روی لینک، ابزار تغییر IP معتبر (DNS Leak Free) خود را روشن فرمایید تا گوگل لایسنس را بدون خطا روی جیمیل شما ثبت نماید.
                            </span>
                          </div>
                        </div>
                      )}

                      {o.status === 'pending_verification' && (
                        <div className="license-pending-box">
                          <div className="license-pending-box__status">
                            <span className="status-badge-pending">
                              <Icon name="clock" size={13} />
                              <span>در انتظار بررسی واریز توسط کارشناسان</span>
                            </span>
                            <span className="order-pay-ref">شماره پیگیری فیش: <strong className="en">{o.paymentRef}</strong></span>
                          </div>

                          <p className="pending-desc">
                            فیش واریزی شما با موفقیت دریافت شد و در نوبت استعلام بانکی قرار دارد (معمولاً ظرف ۲ الی ۴۸ ساعت کاری).
                            به محض تأیید ادمین، <strong>لینک فعال‌سازی رسمی گوگل مستقیماً در همین بخش از پروفایل شما قرار خواهد گرفت</strong> و نیازی به تماس تلفنی نخواهد بود.
                          </p>

                          {onOpenChat && (
                            <button
                              type="button"
                              className="btn btn--sm btn--ghost pending-support-btn"
                              onClick={() => { onClose(); onOpenChat(); }}
                            >
                              <Icon name="headset" size={14} />
                              <span>ارسال پیام به پشتیبانی جهت تسریع در بررسی</span>
                            </button>
                          )}
                        </div>
                      )}

                      {o.status === 'rejected' && (
                        <div className="license-rejected-box">
                          <div className="status-badge-rejected">
                            <Icon name="close" size={13} />
                            <span>عدم تأیید فیش واریزی</span>
                          </div>
                          <p className="rejected-reason">
                            علت: {o.adminNotes || 'عدم تطابق مبلغ یا فیش واریزی نامعتبر.'}
                          </p>
                          {onOpenChat && (
                            <button
                              type="button"
                              className="btn btn--sm btn--ghost"
                              onClick={() => { onClose(); onOpenChat(); }}
                            >
                              <Icon name="headset" size={14} />
                              <span>ارتباط با پشتیبانی و ارسال مجدد فیش</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* تب ۲: ویرایش مشخصات */}
          {activeTab === 'profile' && (
            <div className="profile-settings-tab">
              <form onSubmit={handleSaveProfile} className="profile-form">
                <div className="profile-field">
                  <label>نام و نام خانوادگی:</label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    required
                  />
                </div>

                <div className="profile-field">
                  <label>شماره موبایل (ثابت و شناسه کاربری):</label>
                  <input
                    type="text"
                    readOnly
                    dir="ltr"
                    className="en input-disabled"
                    value={user.mobile}
                  />
                  <small>شماره موبایل به عنوان شناسه یکتای پیگیری سفارشات شما محفوظ است</small>
                </div>

                <div className="profile-field">
                  <label>آدرس جیمیل پیش‌فرض (جهت فعال‌سازی هوش مصنوعی):</label>
                  <input
                    type="email"
                    dir="ltr"
                    className="en"
                    value={editGmail}
                    onChange={(e) => setEditGmail(e.target.value)}
                    placeholder="account@gmail.com"
                  />
                </div>

                {savedNote && <div className="profile-saved-alert">مشخصات شما با موفقیت ذخیره شد.</div>}

                <div className="profile-actions">
                  <button type="submit" className="btn btn--accent">
                    ذخیره تغییرات مشخصات
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
