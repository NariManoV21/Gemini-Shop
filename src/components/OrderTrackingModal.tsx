import { useEffect, useState } from 'react';
import { SUPPORT } from '../config/site';
import { formatToman } from '../lib/format';
import {
  findOrders,
  getOrderById,
  getStoredOrders,
  type StoreOrder,
} from '../services/orderStorage';
import { Icon } from './Icon';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import './OrderTrackingModal.css';

interface Props {
  open: boolean;
  onClose: () => void;
  initialOrderId?: string;
  onOpenChat?: () => void;
}

export function OrderTrackingModal({ open, onClose, initialOrderId, onOpenChat }: Props) {
  useBodyScrollLock(open);
  const [query, setQuery] = useState(initialOrderId || '');
  const [selectedOrder, setSelectedOrder] = useState<StoreOrder | null>(null);
  const [orders, setOrders] = useState<StoreOrder[]>([]);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedOrderId, setCopiedOrderId] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // بارگذاری سفارشات
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
    setSearchError(null);
    if (!query.trim()) return;

    const direct = getOrderById(query.trim());
    if (direct) {
      setSelectedOrder(direct);
      return;
    }
    const results = findOrders(query.trim());
    if (results.length > 0) {
      setSelectedOrder(results[0]);
    } else {
      setSearchError('سفارشی با این شماره سفارش یا مشخصات در این مرورگر یافت نشد. لطفاً کد پیگیری را با دقت وارد نمایید.');
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

  return (
    <div className="modal" onMouseDown={(e) => e.target === e.currentTarget && onClose()} dir="rtl">
      <div className="modal__card modal__card--wide tracking-modal" role="dialog" aria-modal="true">
        <button className="modal__close" onClick={onClose} aria-label="بستن پنجره">
          <Icon name="close" size={20} />
        </button>

        {/* هدر بخش پیگیری */}
        <div className="tracking-modal__header">
          <div className="tracking-modal__titles">
            <h2>پیگیری سفارش و تحویل لایسنس</h2>
            <p>استعلام وضعیت تأیید واریز فیش بانکی و دریافت لینک فعال‌سازی رسمی Google AI Pro</p>
          </div>
        </div>

        {/* نمای رهگیری خریدار */}
        <div className="customer-view">
          {/* فرم جستجو */}
          <form onSubmit={handleSearch} className="tracking-search">
            <div className="tracking-search__input-wrap">
              <Icon name="search" size={18} />
              <input
                type="text"
                placeholder="کد پیگیری سفارش (مثلاً GP-784120) یا شماره موبایل..."
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setSearchError(null);
                }}
                dir="ltr"
              />
            </div>
            <button type="submit" className="btn btn--sm btn--accent">
              <span>استعلام وضعیت</span>
              <Icon name="arrow" size={14} />
            </button>
          </form>

          {searchError && (
            <div className="tracking-search-error">
              <Icon name="alert" size={16} />
              <span>{searchError}</span>
            </div>
          )}

          {/* سفارشات اخیر خریدار روی این مرورگر */}
          {orders.length > 1 && (
            <div className="recent-orders-pills">
              <span>سفارشات اخیر شما:</span>
              {orders.slice(0, 4).map((o) => (
                <button
                  key={o.id}
                  type="button"
                  className={`pill-btn ${selectedOrder?.id === o.id ? 'is-active' : ''}`}
                  onClick={() => {
                    setSelectedOrder(o);
                    setSearchError(null);
                  }}
                >
                  <span className="en">{o.id}</span>
                  <small>({o.status === 'approved' ? 'فعال ✅' : 'در نوبت بررسی ⏳'})</small>
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
                      title="کپی شناسه سفارش"
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
                      <span>عدم تأیید فیش واریزی</span>
                    </div>
                  )}
                </div>
              </div>

              {/* اطلاعات خلاصه سفارش */}
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
                  <span>روش و کد ارجاع:</span>
                  <b className="en">
                    {selectedOrder.paymentMethod === 'bezanbekart' ? 'درگاه بزن به کارت' : 'کارت به کارت'} (
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
                        واریزی شما ثبت شده و در نوبت بررسی کارشناسان پشتیبانی قرار دارد. به محض بررسی فیش توسط ادمین،
                        لینک فعال‌سازی اختصاصی در همین قسمت باز شده و به پنل کاربری شما اضافه خواهد شد.
                      </p>
                    </div>
                  </div>
                  <div className="activation-time-notice">
                    <Icon name="clock" size={16} />
                    <span>تخمین زمان بررسی و صدور لایسنس: ۲ الی ۴۸ ساعت</span>
                  </div>
                  {onOpenChat && (
                    <button
                      type="button"
                      className="btn btn--sm btn--ghost"
                      style={{ marginTop: '12px' }}
                      onClick={() => {
                        onClose();
                        onOpenChat();
                      }}
                    >
                      <Icon name="headset" size={14} />
                      <span>پیگیری سریع‌تر از طریق گفتگوی چت آنلاین</span>
                    </button>
                  )}
                </div>
              )}

              {/* وضعیت ۲: تأیید شده و لینک فعال است */}
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
                    {selectedOrder.activationLink && (
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
                    )}
                    <button
                      type="button"
                      className="btn btn--outline"
                      onClick={() => copyToClipboard(selectedOrder.activationLink || '', 'link')}
                    >
                      <Icon name="copy" size={16} />
                      {copiedLink ? 'لینک کپی شد!' : 'کپی لینک فعال‌سازی'}
                    </button>
                  </div>

                  <div className="license-help-tip" style={{ marginTop: '16px' }}>
                    <Icon name="shield" size={16} />
                    <span>
                      <strong>راهنما:</strong> لطفاً پیش از کلیک روی لینک، ابزار تغییر IP باکیفیت خود را روشن نمایید تا لایسنس بدون خطا روی اکانت گوگل شما ثبت گردد.
                    </span>
                  </div>
                </div>
              )}

              {/* وضعیت ۳: رد فیش واریز */}
              {selectedOrder.status === 'rejected' && (
                <div className="rejected-activation-box">
                  <Icon name="alert" size={24} />
                  <div>
                    <h4>فیش واریزی مورد تأیید قرار نگرفت</h4>
                    <p>علت: {selectedOrder.adminNotes || 'مغایرت در مبلغ واریزی یا شماره پیگیری نادرست.'}</p>
                    <a
                      href={`https://t.me/${SUPPORT.telegram.replace('@', '')}`}
                      target="_blank"
                      rel="noreferrer"
                      className="btn btn--sm btn--outline"
                      style={{ marginTop: '10px' }}
                    >
                      ارتباط با پشتیبانی در تلگرام
                    </a>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="empty-tracking-state">
              <Icon name="search" size={32} />
              <p>جهت استعلام، شناسه سفارش یا شماره موبایل خود را در کادر بالا وارد فرمایید.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
