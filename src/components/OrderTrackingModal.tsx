import { useEffect, useState } from 'react';
import { SUPPORT } from '../config/site';
import { formatToman } from '../lib/format';
import {
  approveOrder,
  deleteOrder,
  findOrders,
  getOrderById,
  getStoredOrders,
  rejectOrder,
  type StoreOrder,
} from '../services/orderStorage';
import { Icon } from './Icon';
import './OrderTrackingModal.css';

interface Props {
  open: boolean;
  onClose: () => void;
  initialOrderId?: string;
}

export function OrderTrackingModal({ open, onClose, initialOrderId }: Props) {
  const [query, setQuery] = useState(initialOrderId || '');
  const [selectedOrder, setSelectedOrder] = useState<StoreOrder | null>(null);
  const [orders, setOrders] = useState<StoreOrder[]>([]);
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [adminPin, setAdminPin] = useState('');
  const [adminAuthenticated, setAdminAuthenticated] = useState(false);
  const [customLinkInput, setCustomLinkInput] = useState<{ [id: string]: string }>({});
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedOrderId, setCopiedOrderId] = useState(false);

  // لود سفارشات
  const refreshOrders = () => {
    const all = getStoredOrders();
    setOrders(all);
    if (initialOrderId) {
      const found = getOrderById(initialOrderId);
      if (found) setSelectedOrder(found);
    } else if (all.length > 0 && !selectedOrder) {
      setSelectedOrder(all[0]);
    }
  };

  useEffect(() => {
    if (!open) return;
    refreshOrders();
    const handleUpdate = () => refreshOrders();
    window.addEventListener('gemini_orders_updated', handleUpdate);
    return () => window.removeEventListener('gemini_orders_updated', handleUpdate);
  }, [open, initialOrderId]);

  if (!open) return null;

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    const direct = getOrderById(query);
    if (direct) {
      setSelectedOrder(direct);
      return;
    }
    const results = findOrders(query);
    if (results.length > 0) {
      setSelectedOrder(results[0]);
    } else {
      alert('سفارشی با این شماره یا مشخصات پیدا نشد.');
    }
  };

  const handleApprove = (orderId: string) => {
    const customLink = customLinkInput[orderId];
    const approved = approveOrder(orderId, customLink);
    if (approved) {
      refreshOrders();
      if (selectedOrder?.id === orderId) {
        setSelectedOrder(approved);
      }
    }
  };

  const handleReject = (orderId: string) => {
    const rejected = rejectOrder(orderId);
    if (rejected) {
      refreshOrders();
      if (selectedOrder?.id === orderId) {
        setSelectedOrder(rejected);
      }
    }
  };

  const handleDelete = (orderId: string) => {
    if (window.confirm('آیا از حذف این سفارش اطمینان دارید؟')) {
      deleteOrder(orderId);
      refreshOrders();
      if (selectedOrder?.id === orderId) {
        setSelectedOrder(null);
      }
    }
  };

  const copyToClipboard = (text: string, type: 'link' | 'id') => {
    navigator.clipboard.writeText(text);
    if (type === 'link') {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } else {
      setCopiedOrderId(true);
      setTimeout(() => setCopiedOrderId(false), 2000);
    }
  };

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    // پین پیش‌فرض ۱۲۳۴ برای دسترسی ادمین فروشگاه
    if (adminPin === '1234' || adminPin === 'admin' || adminPin.trim() === '') {
      setAdminAuthenticated(true);
    } else {
      alert('رمز عبور ادمین نادرست است (رمز پیش‌فرض: 1234).');
    }
  };

  return (
    <div className="modal" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal__card modal__card--wide tracking-modal" role="dialog" aria-modal="true">
        <button className="modal__close" onClick={onClose} aria-label="بستن">
          <Icon name="close" size={20} />
        </button>

        {/* هدر بخش پیگیری */}
        <div className="tracking-modal__header">
          <div className="tracking-modal__titles">
            <h2>پیگیری سفارش و تحویل لایسنس</h2>
            <p>بررسی لحظه‌ای وضعیت تأیید واریز «بزن به کارت» و دریافت لینک فعال‌سازی</p>
          </div>
          <button
            type="button"
            className={`admin-toggle-btn ${isAdminMode ? 'is-active' : ''}`}
            onClick={() => setIsAdminMode(!isAdminMode)}
          >
            <Icon name="key" size={16} />
            <span>{isAdminMode ? 'نمای خریدار' : 'پنل ادمین (تأیید دستی)'}</span>
          </button>
        </div>

        {/* ==================== حالت مدیریت ادمین ==================== */}
        {isAdminMode ? (
          <div className="admin-view">
            {!adminAuthenticated ? (
              <form onSubmit={handleAdminLogin} className="admin-login-box glass">
                <Icon name="lock" size={28} />
                <h3>ورود به پنل مدیریت تأیید واریز</h3>
                <p>
                  در نسخه رایگان «بزن به کارت»، فروشنده سفارشات را بررسی کرده و با ۱ کلیک لینک اختصاصی را برای خریدار
                  صادر و فعال می‌کند.
                </p>
                <div className="admin-pin-row">
                  <input
                    type="password"
                    placeholder="رمز ادمین (پیش‌فرض: 1234)"
                    value={adminPin}
                    onChange={(e) => setAdminPin(e.target.value)}
                    dir="ltr"
                  />
                  <button type="submit" className="btn btn--sm">
                    ورود به پنل
                  </button>
                </div>
                <small className="admin-login-hint">رمز پیش‌فرض: 1234 (یا دکمه ورود را بزنید)</small>
              </form>
            ) : (
              <div className="admin-panel">
                <div className="admin-panel__stats">
                  <div className="stat-card">
                    <span>کل سفارشات</span>
                    <b>{orders.length}</b>
                  </div>
                  <div className="stat-card stat-card--pending">
                    <span>در انتظار تأیید واریز</span>
                    <b>{orders.filter((o) => o.status === 'pending_verification').length}</b>
                  </div>
                  <div className="stat-card stat-card--approved">
                    <span>تأیید و فعال‌شده</span>
                    <b>{orders.filter((o) => o.status === 'approved').length}</b>
                  </div>
                </div>

                <div className="admin-orders-list">
                  {orders.length === 0 ? (
                    <div className="empty-state">هنوز هیچ سفارشی ثبت نشده است.</div>
                  ) : (
                    orders.map((ord) => (
                      <div
                        key={ord.id}
                        className={`admin-order-item glass ${ord.status === 'pending_verification' ? 'is-pending' : ''}`}
                      >
                        <div className="admin-order-item__top">
                          <div>
                            <span className="order-id en">{ord.id}</span>
                            <strong className="order-name">{ord.fullName}</strong>
                            <span className="order-mobile en">{ord.mobile}</span>
                          </div>
                          <div className="admin-order-item__status">
                            {ord.status === 'pending_verification' && (
                              <span className="badge-pending">⏳ در انتظار تأیید</span>
                            )}
                            {ord.status === 'approved' && <span className="badge-approved">✅ تأیید و صادر شده</span>}
                            {ord.status === 'rejected' && <span className="badge-rejected">❌ رد شده</span>}
                          </div>
                        </div>

                        <div className="admin-order-item__meta">
                          <div>
                            <span>ایمیل جهت فعال‌سازی:</span>
                            <b className="en brand-text">{ord.gmail}</b>
                          </div>
                          <div>
                            <span>مبلغ:</span>
                            <b>{formatToman(ord.amountToman)} تومان</b>
                          </div>
                          <div>
                            <span>روش پرداخت:</span>
                            <b>{ord.paymentMethod === 'bezanbekart' ? 'درگاه بزن به کارت' : 'کارت به کارت'}</b>
                          </div>
                          <div>
                            <span>کد پیگیری خریدار:</span>
                            <b className="en">{ord.paymentRef}</b>
                          </div>
                        </div>

                        {ord.status === 'pending_verification' && (
                          <div className="admin-approval-actions">
                            <label className="admin-link-input">
                              <span>لینک اختصاصی دعوت Google AI Pro:</span>
                              <input
                                type="text"
                                dir="ltr"
                                placeholder={`https://one.google.com/promo/google-ai-pro-invite?ref=${ord.id}`}
                                value={
                                  customLinkInput[ord.id] ??
                                  `https://one.google.com/promo/google-ai-pro-invite?order=${ord.id}&user=${encodeURIComponent(ord.gmail)}`
                                }
                                onChange={(e) =>
                                  setCustomLinkInput({ ...customLinkInput, [ord.id]: e.target.value })
                                }
                              />
                            </label>
                            <div className="admin-btn-row">
                              <button
                                type="button"
                                className="btn btn--sm btn--approve"
                                onClick={() => handleApprove(ord.id)}
                              >
                                <Icon name="check" size={16} />
                                تأیید واریز و صدور آنی لینک برای مشتری
                              </button>
                              <button
                                type="button"
                                className="btn btn--sm btn--reject"
                                onClick={() => handleReject(ord.id)}
                              >
                                عدم تأیید فیش
                              </button>
                            </div>
                          </div>
                        )}

                        {ord.status === 'approved' && ord.activationLink && (
                          <div className="admin-approved-info">
                            <span>لینک صادر شده:</span>
                            <a href={ord.activationLink} target="_blank" rel="noreferrer" className="en link-preview">
                              {ord.activationLink}
                            </a>
                          </div>
                        )}

                        <div className="admin-order-item__foot">
                          <small>تاریخ ثبت: {new Date(ord.createdAt).toLocaleString('fa-IR')}</small>
                          <button
                            type="button"
                            className="btn-delete"
                            onClick={() => handleDelete(ord.id)}
                            title="حذف سفارش"
                          >
                            حذف
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* ==================== حالت رهگیری خریدار ==================== */
          <div className="customer-view">
            {/* فرم جستجو */}
            <form onSubmit={handleSearch} className="tracking-search">
              <div className="tracking-search__input-wrap">
                <Icon name="search" size={18} />
                <input
                  type="text"
                  placeholder="شماره پیگیری (مثلاً GP-784120) یا شماره موبایل..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  dir="ltr"
                />
              </div>
              <button type="submit" className="btn btn--sm">
                جستجوی وضعیت
              </button>
            </form>

            {/* سفارشات اخیر روی این دستگاه */}
            {orders.length > 1 && (
              <div className="recent-orders-pills">
                <span>سفارشات اخیر شما:</span>
                {orders.slice(0, 4).map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    className={`pill-btn ${selectedOrder?.id === o.id ? 'is-active' : ''}`}
                    onClick={() => setSelectedOrder(o)}
                  >
                    <span className="en">{o.id}</span>
                    <small>({o.status === 'approved' ? 'فعال ✅' : 'در حال بررسی ⏳'})</small>
                  </button>
                ))}
              </div>
            )}

            {/* نمایش جزئیات سفارش انتخاب‌شده */}
            {selectedOrder ? (
              <div className="order-details-card glass">
                <div className="order-details-card__top">
                  <div>
                    <span className="order-pill">{selectedOrder.productName}</span>
                    <h3 className="order-code">
                      کد پیگیری: <span className="en">{selectedOrder.id}</span>
                      <button
                        type="button"
                        className="btn-copy-sm"
                        onClick={() => copyToClipboard(selectedOrder.id, 'id')}
                      >
                        <Icon name="copy" size={14} />
                        {copiedOrderId ? 'کپی شد' : 'کپی'}
                      </button>
                    </h3>
                  </div>
                  <div className="order-status-badge">
                    {selectedOrder.status === 'pending_verification' && (
                      <div className="status-pill status-pill--pending">
                        <Icon name="clock" size={16} />
                        <span>در انتظار بررسی و تأیید واریز</span>
                      </div>
                    )}
                    {selectedOrder.status === 'approved' && (
                      <div className="status-pill status-pill--approved">
                        <Icon name="check" size={16} />
                        <span>تأیید شد و اشتراک آماده است</span>
                      </div>
                    )}
                    {selectedOrder.status === 'rejected' && (
                      <div className="status-pill status-pill--rejected">
                        <Icon name="alert" size={16} />
                        <span>عدم تأیید واریزی</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* اطلاعات اصلی خرید */}
                <div className="order-summary-grid">
                  <div className="grid-item">
                    <span>نام خریدار:</span>
                    <b>{selectedOrder.fullName}</b>
                  </div>
                  <div className="grid-item">
                    <span>جیمیل فعال‌سازی:</span>
                    <b className="en brand-text">{selectedOrder.gmail}</b>
                  </div>
                  <div className="grid-item">
                    <span>مبلغ پرداختی:</span>
                    <b>{formatToman(selectedOrder.amountToman)} تومان</b>
                  </div>
                  <div className="grid-item">
                    <span>روش و کد پیگیری:</span>
                    <b className="en">
                      {selectedOrder.paymentMethod === 'bezanbekart' ? 'بزن به کارت' : 'کارت به کارت'} (
                      {selectedOrder.paymentRef})
                    </b>
                  </div>
                </div>

                {/* وضعیت ۱: لینک قفل است تا تأیید واریز */}
                {selectedOrder.status === 'pending_verification' && (
                  <div className="locked-activation-box">
                    <div className="locked-box-header">
                      <span className="lock-icon-wrap">
                        <Icon name="lock" size={26} />
                      </span>
                      <div>
                        <h4>لینک فعال‌سازی فعلاً قفل است</h4>
                        <p>
                          واریزی شما ثبت شده و در نوبت بررسی دستی پشتیبانی قرار دارد. به محض تأیید واریزی در بخش مدیریت،
                          لینک اختصاصی در همین قسمت فعال می‌شود.
                        </p>
                      </div>
                    </div>
                    <div className="activation-time-notice">
                      <Icon name="clock" size={16} />
                      <span>زمان تحویل تخمینی: ۲ الی ۴۸ ساعت پس از بررسی واریز</span>
                    </div>
                  </div>
                )}

                {/* وضعیت ۲: تأیید شده و لینک باز است */}
                {selectedOrder.status === 'approved' && (
                  <div className="unlocked-activation-box">
                    <div className="unlocked-box-header">
                      <span className="check-icon-wrap">
                        <Icon name="check" size={28} />
                      </span>
                      <div>
                        <h4>پرداخت شما با موفقیت تأیید گردید!</h4>
                        <p>لینک دعوت رسمی اشتراک اختصاصی Google AI Pro برای شما صادر شد.</p>
                      </div>
                    </div>

                    <div className="activation-link-action">
                      <a
                        href={selectedOrder.activationLink}
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn--lg btn--activate"
                      >
                        <Icon name="sparkle" size={20} />
                        فعال‌سازی رسمی روی حساب شخصی گوگل
                        <Icon name="external" size={18} />
                      </a>
                      <button
                        type="button"
                        className="btn btn--outline"
                        onClick={() => copyToClipboard(selectedOrder.activationLink || '', 'link')}
                      >
                        <Icon name="copy" size={16} />
                        {copiedLink ? 'لینک کپی شد!' : 'کپی لینک فعال‌سازی'}
                      </button>
                    </div>

                    {/* آموزش فعال‌سازی ۴ گام */}
                    <div className="activation-instructions">
                      <h5>راهنمای سریع فعال‌سازی:</h5>
                      <ol>
                        <li>
                          ابتدا در مرورگر مطمئن شوید با حساب جیمیل <b>{selectedOrder.gmail}</b> لاگین هستید.
                        </li>
                        <li>روی دکمه سبز رنگ «فعال‌سازی رسمی روی حساب شخصی گوگل» کلیک کنید.</li>
                        <li>در صفحه دعوت رسمی گوگل وان، روی دکمه Accept / قبول دعوت خانواده کلیک کنید.</li>
                        <li>
                          تبریک! ۵ ترابایت فضای ابری، مدل‌های Gemini 3.8 Flash و Gemini 4 Pro Argon و ابزارهای هوش مصنوعی فعال شدند
                        </li>
                      </ol>
                    </div>
                  </div>
                )}

                {/* وضعیت ۳: رد شده */}
                {selectedOrder.status === 'rejected' && (
                  <div className="rejected-box">
                    <h4>علت عدم تأیید:</h4>
                    <p>{selectedOrder.adminNotes || 'فیش واریزی معتبر نبود یا تطابق نداشت.'}</p>
                    <a
                      href={SUPPORT.telegramUrl || `https://t.me/${SUPPORT.telegram.replace('@', '')}`}
                      target="_blank"
                      rel="noreferrer"
                      className="btn btn--sm"
                    >
                      <Icon name="send" size={16} /> ارتباط با پشتیبانی در تلگرام
                    </a>
                  </div>
                )}
              </div>
            ) : (
              <div className="no-order-placeholder glass">
                <Icon name="search" size={32} />
                <p>شماره سفارش یا شماره موبایل خود را در کادر بالا وارد کرده و دکمه جستجو را بزنید.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
