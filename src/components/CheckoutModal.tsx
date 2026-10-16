import { useEffect, useRef, useState } from 'react';
import type { Product } from '../config/site';
import { PAYMENT_CONFIG, SUPPORT } from '../config/site';
import { formatToman } from '../lib/format';
import { getCurrentUser, loginOrRegisterCustomer, requestEmailOtp, verifyEmailOtp } from '../services/authService';
import { createStoreOrder, type StoreOrder } from '../services/orderStorage';
import { Icon } from './Icon';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import './CheckoutModal.css';

interface Props {
  product: Product;
  open: boolean;
  onClose: () => void;
  onTrackOrder?: (orderId: string) => void;
  onOpenProfile?: () => void;
}

const normalizeDigits = (s: string) =>
  s.replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));

export function CheckoutModal({ product, open, onClose, onTrackOrder, onOpenProfile }: Props) {
  useBodyScrollLock(open);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [fullName, setFullName] = useState('');
  const [mobile, setMobile] = useState('');
  const [gmail, setGmail] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'bezanbekart' | 'card_to_card'>('bezanbekart');
  const [paymentRef, setPaymentRef] = useState('');
  const [copiedCard, setCopiedCard] = useState(false);
  const [copiedShaba, setCopiedShaba] = useState(false);
  const [copiedRef, setCopiedRef] = useState(false);

  // وضعیت‌های مربوط به تأیید پیامکی OTP در مرحله اول
  const [otpPending, setOtpPending] = useState(false);
  const [otpInput, setOtpInput] = useState('');
  const [otpTimer, setOtpTimer] = useState(60);
  const [loadingOtp, setLoadingOtp] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [simCode, setSimCode] = useState<string | null>(null);
  const checkoutTimerRef = useRef<number | null>(null);

  const [errors, setErrors] = useState<{ fullName?: string; mobile?: string; gmail?: string; paymentRef?: string }>({});
  const [loading, setLoading] = useState(false);
  const [createdOrder, setCreatedOrder] = useState<StoreOrder | null>(null);

  const firstRef = useRef<HTMLInputElement>(null);
  const lastFocus = useRef<HTMLElement | null>(null);

  // تایمر معکوس پیامک
  useEffect(() => {
    if (otpPending && otpTimer > 0) {
      checkoutTimerRef.current = window.setInterval(() => {
        setOtpTimer((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    } else if (otpTimer === 0 && checkoutTimerRef.current) {
      clearInterval(checkoutTimerRef.current);
    }
    return () => {
      if (checkoutTimerRef.current) clearInterval(checkoutTimerRef.current);
    };
  }, [otpPending, otpTimer]);

  useEffect(() => {
    if (!open) return;
    const existing = getCurrentUser();
    if (existing) {
      if (!fullName && existing.fullName) setFullName(existing.fullName);
      if (!mobile && existing.mobile) setMobile(existing.mobile);
      if (!gmail && existing.gmail) setGmail(existing.gmail);
    }
    lastFocus.current = document.activeElement as HTMLElement;
    const t = setTimeout(() => firstRef.current?.focus(), 80);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(t);
      window.removeEventListener('keydown', onKey);
      lastFocus.current?.focus();
    };
  }, [open]);

  if (!open) return null;

  const validateStep1 = () => {
    const errs: typeof errors = {};
    if (fullName.trim().length < 3) {
      errs.fullName = 'لطفاً نام و نام خانوادگی خود را کامل وارد کنید.';
    }
    const cleanGmail = gmail.trim().toLowerCase();
    if (!/^[a-zA-Z0-9._%+-]+@gmail\.com$/.test(cleanGmail)) {
      errs.gmail = 'ایمیل باید یک حساب معتبر گوگل باشد (حتماً به gmail.com@ ختم شود).';
    }
    const cleanMobile = normalizeDigits(mobile.trim());
    if (!/^09\d{9}$/.test(cleanMobile)) {
      errs.mobile = 'شماره موبایل باید ۱۱ رقم و با ۰۹ شروع شود (مانند ۰۹۱۲۳۴۵۶۷۸۹).';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleNextToPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateStep1()) return;

    const cleanGmail = gmail.trim().toLowerCase();
    const cleanMobile = normalizeDigits(mobile.trim());
    const currentUser = getCurrentUser();

    // اگر کاربر از قبل با همین ایمیل لاگین کرده است، مستقیم به پرداخت برود
    if (currentUser && currentUser.gmail === cleanGmail) {
      setStep(2);
      return;
    }

    // ارسال کد تأیید یکبارمصرف ایمیلی به جیمیل
    setLoadingOtp(true);
    setOtpError(null);
    const res = await requestEmailOtp(cleanGmail, fullName.trim(), cleanMobile);
    setLoadingOtp(false);

    if (res.success) {
      setOtpPending(true);
      setOtpTimer(res.cooldownSeconds || 60);
      if (res.simulationCode) setSimCode(res.simulationCode);
    } else {
      setErrors({ gmail: res.error || 'خطا در ارسال کد تأیید ایمیلی.' });
    }
  };

  const handleVerifyCheckoutOtp = async () => {
    const cleanGmail = gmail.trim().toLowerCase();
    const cleanMobile = normalizeDigits(mobile.trim());
    const cleanCode = otpInput.trim().replace(/\D/g, '');

    if (cleanCode.length < 4) {
      setOtpError('لطفاً کد ۵ رقمی ارسال‌شده به ایمیل را به طور کامل وارد نمایید.');
      return;
    }

    setLoadingOtp(true);
    setOtpError(null);
    const res = await verifyEmailOtp(cleanGmail, cleanCode, fullName.trim(), cleanMobile);
    setLoadingOtp(false);

    if (res.success) {
      setOtpPending(false);
      setStep(2);
    } else {
      setOtpError(res.error || 'کد تایید وارد شده نادرست است.');
    }
  };

  const handleResendCheckoutOtp = async () => {
    if (otpTimer > 0 || loadingOtp) return;
    const cleanGmail = gmail.trim().toLowerCase();
    const cleanMobile = normalizeDigits(mobile.trim());
    setLoadingOtp(true);
    setOtpError(null);
    const res = await requestEmailOtp(cleanGmail, fullName.trim(), cleanMobile);
    setLoadingOtp(false);
    if (res.success) {
      setOtpTimer(res.cooldownSeconds || 60);
      if (res.simulationCode) setSimCode(res.simulationCode);
    } else {
      setOtpError(res.error || 'خطا در ارسال مجدد کد تأیید.');
    }
  };

  const handleFinalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentRef.trim() || paymentRef.trim().length < 4) {
      setErrors({ paymentRef: 'لطفاً کد رهگیری، شماره ارجاع یا ۴ رقم آخر کارت را وارد فرمایید.' });
      return;
    }

    const cleanMobile = normalizeDigits(mobile.trim());
    const cleanName = fullName.trim();
    const cleanGmail = gmail.trim().toLowerCase();

    // همگام‌سازی و ذخیره آنی در پروفایل مشتری
    loginOrRegisterCustomer({
      fullName: cleanName,
      mobile: cleanMobile,
      gmail: cleanGmail,
    });

    setLoading(true);
    // ساخت سفارش در دیتابیس لوکال با وضعیت در انتظار بررسی واریز
    setTimeout(() => {
      const order = createStoreOrder({
        fullName: cleanName,
        mobile: cleanMobile,
        gmail: cleanGmail,
        productName: product.name,
        amountToman: product.priceToman,
        paymentMethod,
        paymentRef: paymentRef.trim(),
      });
      setCreatedOrder(order);
      setLoading(false);
      setStep(3);
    }, 500);
  };

  const copyCardNumber = () => {
    const plainCard = PAYMENT_CONFIG.cardNumber.replace(/[^0-9]/g, '');
    navigator.clipboard.writeText(plainCard);
    setCopiedCard(true);
    setTimeout(() => setCopiedCard(false), 2000);
  };

  const copyShaba = () => {
    navigator.clipboard.writeText(PAYMENT_CONFIG.shabaNumber);
    setCopiedShaba(true);
    setTimeout(() => setCopiedShaba(false), 2000);
  };

  const copyOrderRef = () => {
    if (createdOrder) {
      navigator.clipboard.writeText(createdOrder.id);
      setCopiedRef(true);
      setTimeout(() => setCopiedRef(false), 2000);
    }
  };

  const close = () => {
    setStep(1);
    setErrors({});
    setPaymentRef('');
    setCreatedOrder(null);
    setOtpPending(false);
    setOtpInput('');
    setOtpError(null);
    setSimCode(null);
    onClose();
  };

  return (
    <div className="modal" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div className="modal__card modal__card--wide" role="dialog" aria-modal="true" aria-labelledby="checkout-title">
        <button className="modal__close" onClick={close} aria-label="بستن">
          <Icon name="close" size={20} />
        </button>

        {/* نوار مراحل بالا */}
        <div className="modal__steps-bar">
          <div className={`step-dot ${step >= 1 ? 'is-active' : ''} ${step > 1 ? 'is-done' : ''}`}>
            <span>۱</span>
            <small>اطلاعات و ایمیل</small>
          </div>
          <div className="step-line" />
          <div className={`step-dot ${step >= 2 ? 'is-active' : ''} ${step > 2 ? 'is-done' : ''}`}>
            <span>۲</span>
            <small>واریز و ثبت فیش</small>
          </div>
          <div className="step-line" />
          <div className={`step-dot ${step >= 3 ? 'is-active' : ''}`}>
            <span>۳</span>
            <small>وضعیت تحویل</small>
          </div>
        </div>

        {/* -------------------- مرحله اول: اطلاعات و ایمیل + تأیید OTP -------------------- */}
        {step === 1 && (
          <div>
            <h2 id="checkout-title">سفارش {product.badgeLabel}</h2>
            <div className="modal__summary">
              <div>
                <b>{product.name} (دسترسی ۵ ترابایت + هوش مصنوعی)</b>
                <span className="modal__summary-sub">فعال‌سازی روی جیمیل شخصی • ضمانت کامل</span>
              </div>
              <div className="modal__price-tag">
                <b>{formatToman(product.priceToman)}</b>
                <small>تومان</small>
              </div>
            </div>

            {otpPending ? (
              <div className="checkout-otp-container glass">
                <div className="checkout-otp-head">
                  <div className="checkout-otp-icon">
                    <Icon name="shield" size={20} />
                  </div>
                  <div>
                    <strong>تأیید آدرس ایمیل خریدار</strong>
                    <p>کد ۵ رقمی ارسال‌شده به ایمیل <b>{gmail}</b> را وارد فرمایید:</p>
                  </div>
                </div>

                {simCode && (
                  <div className="auth-card__sim-code" style={{ margin: '12px 0' }}>
                    <span>کد تستی شبیه‌ساز: </span>
                    <b className="en">{simCode}</b>
                    <button type="button" className="btn-fill-sim" onClick={() => setOtpInput(simCode)}>درج خودکار</button>
                  </div>
                )}

                {otpError && <div className="auth-card__error">{otpError}</div>}

                <div className="field" style={{ marginTop: '12px' }}>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    placeholder="• • • • •"
                    dir="ltr"
                    className="auth-card__otp-input en"
                    value={otpInput}
                    onChange={(e) => setOtpInput(e.target.value)}
                    autoFocus
                  />
                </div>

                <div className="auth-card__timer-row" style={{ marginTop: '10px' }}>
                  {otpTimer > 0 ? (
                    <span className="auth-card__countdown">
                      ارسال مجدد کد پس از: <b>{Math.floor(otpTimer / 60)}:{(otpTimer % 60).toString().padStart(2, '0')}</b>
                    </span>
                  ) : (
                    <button type="button" className="auth-card__resend-btn" onClick={handleResendCheckoutOtp} disabled={loadingOtp}>
                      ارسال مجدد ایمیل کد
                    </button>
                  )}
                  <button type="button" className="auth-card__edit-btn" onClick={() => setOtpPending(false)}>
                    ویرایش مشخصات
                  </button>
                </div>

                <div className="modal__actions" style={{ marginTop: '16px' }}>
                  <button type="button" className="btn btn--ghost" onClick={() => setOtpPending(false)}>
                    بازگشت
                  </button>
                  <button
                    type="button"
                    className="btn modal__submit"
                    onClick={handleVerifyCheckoutOtp}
                    disabled={loadingOtp}
                  >
                    <span>{loadingOtp ? 'در حال بررسی کد...' : 'تأیید ایمیل و رفتن به پرداخت'}</span>
                    <Icon name="arrow" size={18} />
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleNextToPayment} noValidate>
                <label className="field">
                  <span>نام و نام خانوادگی</span>
                  <input
                    ref={firstRef}
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="مثال: علی احمدی"
                    autoComplete="name"
                    aria-invalid={!!errors.fullName}
                  />
                  {errors.fullName && <em role="alert">{errors.fullName}</em>}
                </label>

                <label className="field">
                  <span>ایمیل شخصی جیمیل (بدون نیاز به رمز عبور)</span>
                  <input
                    value={gmail}
                    onChange={(e) => setGmail(e.target.value)}
                    placeholder="yourname@gmail.com"
                    inputMode="email"
                    dir="ltr"
                    autoComplete="email"
                    aria-invalid={!!errors.gmail}
                  />
                  {errors.gmail ? (
                    <em role="alert">{errors.gmail}</em>
                  ) : (
                    <span className="field__hint">
                      🔒 کد تایید و لینک فعال‌سازی اختصاصی مستقیماً به همین ایمیل ارسال خواهد شد
                    </span>
                  )}
                </label>

                <label className="field">
                  <span>شماره تماس همراه (جهت هماهنگی و پشتیبانی)</span>
                  <input
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value)}
                    placeholder="۰۹۱۲۳۴۵۶۷۸۹"
                    inputMode="numeric"
                    dir="ltr"
                    autoComplete="tel"
                    aria-invalid={!!errors.mobile}
                  />
                  {errors.mobile && <em role="alert">{errors.mobile}</em>}
                </label>

                <button className="btn modal__submit" type="submit" disabled={loadingOtp}>
                  <span>{loadingOtp ? 'در حال ارسال کد تایید...' : 'ادامه و دریافت کد تایید ایمیلی'}</span>
                  <Icon name="arrow" size={18} />
                </button>
              </form>
            )}
          </div>
        )}

        {/* -------------------- مرحله دوم: پرداخت بزن به کارت یا کارت به کارت -------------------- */}
        {step === 2 && (
          <form onSubmit={handleFinalSubmit} noValidate>
            <h2 id="checkout-title">پرداخت و ثبت فیش واریز</h2>

            <div className="modal__payable">
              <span>مبلغ قابل پرداخت:</span>
              <b>{formatToman(product.priceToman)} تومان</b>
            </div>

            <div className="pay-methods">
              <button
                type="button"
                className={`pay-method-btn ${paymentMethod === 'bezanbekart' ? 'is-selected' : ''}`}
                onClick={() => setPaymentMethod('bezanbekart')}
              >
                <Icon name="external" size={18} />
                <span>درگاه پرداخت «بزن به کارت»</span>
              </button>
              <button
                type="button"
                className={`pay-method-btn ${paymentMethod === 'card_to_card' ? 'is-selected' : ''}`}
                onClick={() => setPaymentMethod('card_to_card')}
              >
                <Icon name="bolt" size={18} />
                <span>انتقال مستقیم کارت به کارت</span>
              </button>
            </div>

            {paymentMethod === 'bezanbekart' ? (
              <div className="pay-box glass">
                <div className="pay-box__head">
                  <strong>پرداخت آنلاین با درگاه {PAYMENT_CONFIG.serviceName}</strong>
                  <span className="badge-tag">سریع و آسان</span>
                </div>
                <p className="pay-box__desc">
                  روی دکمه زیر کلیک کنید تا وارد صفحه پرداخت شخصی ما در «بزن به کارت» شوید. پس از اتمام پرداخت، کد
                  پیگیری یا شماره ارجاع را در کادر پایین وارد کنید.
                </p>
                <a
                  href={PAYMENT_CONFIG.paymentUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn--outline pay-box__action-btn"
                >
                  <Icon name="external" size={18} />
                  ورود به درگاه پرداخت بزن به کارت
                </a>
              </div>
            ) : (
              <div className="pay-box glass">
                <div className="pay-box__head">
                  <strong>اطلاعات کارت جهت واریز</strong>
                  <span className="badge-tag">{PAYMENT_CONFIG.bankName}</span>
                </div>
                <div className="card-info">
                  <div className="card-info__number en" dir="ltr">
                    {PAYMENT_CONFIG.cardNumber}
                  </div>
                  <button type="button" className="btn-copy" onClick={copyCardNumber}>
                    <Icon name="copy" size={16} />
                    {copiedCard ? 'کپی شد!' : 'کپی شماره کارت'}
                  </button>
                </div>
                <div className="card-info" style={{ marginTop: '8px' }}>
                  <div className="card-info__number en" dir="ltr" style={{ fontSize: '13px' }}>
                    {PAYMENT_CONFIG.shabaNumber}
                  </div>
                  <button type="button" className="btn-copy" onClick={copyShaba}>
                    <Icon name="copy" size={16} />
                    {copiedShaba ? 'کپی شد!' : 'کپی شماره شبا'}
                  </button>
                </div>
                <div className="card-info__meta">
                  <span>صاحب حساب: <b>{PAYMENT_CONFIG.cardHolder}</b></span>
                  <span>بانک: <b>{PAYMENT_CONFIG.bankName}</b></span>
                </div>
              </div>
            )}

            <label className="field" style={{ marginTop: '16px' }}>
              <span>کد پیگیری، شماره ارجاع یا ۴ رقم آخر کارت</span>
              <input
                value={paymentRef}
                onChange={(e) => setPaymentRef(e.target.value)}
                placeholder="مثال: ۹۸۲۳۷۴ یا پرداخت از کارت ۸۳۲۱"
                dir="ltr"
                aria-invalid={!!errors.paymentRef}
              />
              {errors.paymentRef && <em role="alert">{errors.paymentRef}</em>}
              <span className="field__hint">
                برای تأیید سریع‌تر واریزی توسط مدیریت، شماره پیگیری را با دقت وارد فرمایید
              </span>
            </label>

            <div className="modal__actions">
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => setStep(1)}
              >
                بازگشت
              </button>
              <button className="btn modal__submit" type="submit" disabled={loading}>
                {loading ? 'در حال ثبت سفارش...' : 'تأیید پرداخت و ثبت سفارش'}
              </button>
            </div>
          </form>
        )}

        {/* -------------------- مرحله سوم: وضعیت سفارش و قفل بودن لینک -------------------- */}
        {step === 3 && createdOrder && (
          <div className="modal__done">
            <div className="modal__done-header">
              <span className="tile tile--pending">
                <Icon name="clock" size={30} />
              </span>
              <h2 id="checkout-title">سفارش شما با موفقیت ثبت شد!</h2>
              <p className="modal__ref-banner">
                شماره پیگیری سفارش شما: <b className="en">{createdOrder.id}</b>
                <button type="button" className="btn-copy-sm" onClick={copyOrderRef}>
                  <Icon name="copy" size={14} /> {copiedRef ? 'کپی شد' : 'کپی'}
                </button>
              </p>
            </div>

            {/* وضعیت فعلی واریز */}
            <div className="status-timeline glass">
              <div className="timeline-step is-complete">
                <span className="timeline-step__icon"><Icon name="check" size={14} /></span>
                <div>
                  <strong>۱. ثبت اطلاعات و ثبت فیش پرداخت</strong>
                  <small>فیش ارجاع {createdOrder.paymentRef} ثبت شد</small>
                </div>
              </div>

              <div className="timeline-step is-current">
                <span className="timeline-step__icon"><Icon name="clock" size={14} /></span>
                <div>
                  <strong className="accent-color">۲. بررسی و تأیید واریز توسط پشتیبانی</strong>
                  <small>در حال بررسی توسط ادمین فروشگاه ({PAYMENT_CONFIG.activationWindow})</small>
                </div>
              </div>

              <div className="timeline-step is-locked">
                <span className="timeline-step__icon"><Icon name="lock" size={14} /></span>
                <div>
                  <strong>۳. تحویل لینک فعال‌سازی رسمی گوگل</strong>
                  <small>ارسال به {createdOrder.gmail} و نمایش در پیگیری سفارش</small>
                </div>
              </div>
            </div>

            {/* جعبه لینک فعال‌سازی قفل شده */}
            <div className="locked-link-box glass">
              <div className="locked-link-box__head">
                <div className="locked-badge">
                  <Icon name="lock" size={16} />
                  <span>لینک فعال‌سازی فعلاً قفل است</span>
                </div>
                <span className="locked-time">تخمین تحویل: ۲ الی ۴۸ ساعت</span>
              </div>
              <p className="locked-link-box__text">
                به محض اینکه واریزی شما از طرف پشتیبانی فروشگاه تأیید شود، لینک فعال‌سازی اختصاصی گوگل در بخش <b>«پنل کاربری»</b>، <b>«پیگیری سفارش»</b> و همچنین در گفتگوی چت آنلاین پشتیبانی تحویل داده خواهد شد و به ایمیل شخصی <b>{createdOrder.gmail}</b> نیز ارسال می‌گردد.
              </p>
            </div>

            <div className="modal__done-footer">
              {onOpenProfile && (
                <button
                  type="button"
                  className="btn btn--accent"
                  onClick={() => {
                    close();
                    onOpenProfile();
                  }}
                >
                  <Icon name="user" size={16} />
                  مشاهده در پنل کاربری من
                </button>
              )}
              {onTrackOrder && (
                <button
                  type="button"
                  className="btn btn--outline"
                  onClick={() => {
                    close();
                    onTrackOrder(createdOrder.id);
                  }}
                >
                  <Icon name="search" size={16} />
                  مشاهده در بخش پیگیری سفارش
                </button>
              )}
              <a
                href={`https://t.me/${SUPPORT.telegram.replace('@', '')}`}
                target="_blank"
                rel="noreferrer"
                className="btn btn--ghost"
              >
                <Icon name="send" size={16} />
                ارتباط با پشتیبانی در تلگرام
              </a>
              <button className="btn btn--ghost" onClick={close}>
                متوجه شدم، بستن
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
