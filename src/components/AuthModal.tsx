import { useState, useRef, useEffect } from 'react';
import { Icon } from './Icon';
import { sanitizeEmail, sanitizeMobile, isValidIranianMobile } from '../lib/sanitize';
import { requestEmailOtp, verifyEmailOtp, type UserProfile } from '../services/authService';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import './AuthModal.css';

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: (user: UserProfile) => void;
}

export function AuthModal({ open, onClose, onSuccess }: Props) {
  useBodyScrollLock(open);
  const [step, setStep] = useState<1 | 2>(1);
  const [fullName, setFullName] = useState('');
  const [gmail, setGmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [otpCode, setOtpCode] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [simulationCode, setSimulationCode] = useState<string | null>(null);

  // تایمر ۶۰ ثانیه‌ای ارسال مجدد کد
  const [timer, setTimer] = useState(60);
  const timerRef = useRef<number | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const otpInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setError(null);
      setSimulationCode(null);
      setStep(1);
      setOtpCode('');
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
  }, [open]);

  // مدیریت شمارش معکوس تایمر
  useEffect(() => {
    if (step === 2 && timer > 0) {
      timerRef.current = window.setInterval(() => {
        setTimer((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    } else if (timer === 0 && timerRef.current) {
      clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [step, timer]);

  if (!open) return null;

  // مرحله ۱: ارسال کد تایید به جیمیل خریدار
  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (fullName.trim().length < 3) {
      setError('لطفاً نام و نام خانوادگی خود را کامل وارد فرمایید.');
      return;
    }

    const cleanGmail = sanitizeEmail(gmail);
    if (!cleanGmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanGmail)) {
      setError('لطفاً یک آدرس ایمیل معتبر (مانند yourname@gmail.com) وارد فرمایید.');
      return;
    }

    if (mobile.trim() && !isValidIranianMobile(mobile)) {
      setError('شماره موبایل وارد شده باید ۱۱ رقم و با ۰۹ شروع شود.');
      return;
    }

    setLoading(true);
    const cleanMobile = sanitizeMobile(mobile);
    const result = await requestEmailOtp(cleanGmail, fullName, cleanMobile);
    setLoading(false);

    if (result.success) {
      setStep(2);
      setTimer(result.cooldownSeconds || 60);
      if (result.simulationCode) {
        setSimulationCode(result.simulationCode);
      }
      setTimeout(() => otpInputRef.current?.focus(), 100);
    } else {
      setError(result.error || 'خطا در ارسال کد تایید ایمیلی.');
    }
  };

  // مرحله ۲: بررسی کد و ورود قطعی
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanCode = otpCode.trim().replace(/\D/g, '');
    if (cleanCode.length < 4) {
      setError('لطفاً کد تایید ۵ رقمی ارسال‌شده را به طور کامل وارد فرمایید.');
      return;
    }

    setLoading(true);
    const cleanGmail = sanitizeEmail(gmail);
    const cleanMobile = sanitizeMobile(mobile);
    const result = await verifyEmailOtp(cleanGmail, cleanCode, fullName, cleanMobile);
    setLoading(false);

    if (result.success && result.user) {
      onSuccess(result.user);
      onClose();
    } else {
      setError(result.error || 'کد تایید وارد شده نادرست است.');
    }
  };

  // ارسال مجدد کد ایمیلی
  const handleResendOtp = async () => {
    if (timer > 0 || loading) return;
    setError(null);
    setLoading(true);

    const cleanGmail = sanitizeEmail(gmail);
    const cleanMobile = sanitizeMobile(mobile);
    const result = await requestEmailOtp(cleanGmail, fullName, cleanMobile);
    setLoading(false);

    if (result.success) {
      setTimer(result.cooldownSeconds || 60);
      if (result.simulationCode) {
        setSimulationCode(result.simulationCode);
      }
    } else {
      setError(result.error || 'خطا در ارسال مجدد کد تایید.');
    }
  };

  return (
    <div className="auth-overlay" dir="rtl" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="auth-card" role="dialog" aria-modal="true">
        <div className="auth-card__header">
          <div className="auth-card__icon-wrap">
            <Icon name={step === 1 ? 'user' : 'shield'} size={24} />
          </div>
          <h2>{step === 1 ? 'ورود به حساب با تأیید ایمیل' : 'تأیید آدرس ایمیل'}</h2>
          <p>
            {step === 1
              ? 'جهت امنیت و پیگیری سفارشات، ورود از طریق کد یکبارمصرف ارسالی به ایمیل انجام می‌شود'
              : `کد تایید ۵ رقمی ارسال‌شده به ${gmail} را وارد فرمایید:`}
          </p>
          <button className="auth-card__close" onClick={onClose} aria-label="بستن">
            <Icon name="close" size={18} />
          </button>
        </div>

        {error && <div className="auth-card__error">{error}</div>}

        {simulationCode && (
          <div className="auth-card__sim-code">
            <span>کد تستی شبیه‌ساز (دمو): </span>
            <b className="en">{simulationCode}</b>
            <button
              type="button"
              className="btn-fill-sim"
              onClick={() => setOtpCode(simulationCode)}
            >
              درج خودکار
            </button>
          </div>
        )}

        {step === 1 ? (
          <form onSubmit={handleRequestOtp} className="auth-card__form">
            <div className="auth-card__field">
              <label>نام و نام خانوادگی:</label>
              <input
                ref={inputRef}
                type="text"
                placeholder="مثال: علی محمدی"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </div>

            <div className="auth-card__field">
              <label>آدرس ایمیل / جیمیل شخصی (جهت دریافت کد تأیید):</label>
              <input
                type="email"
                placeholder="name@gmail.com"
                dir="ltr"
                value={gmail}
                onChange={(e) => setGmail(e.target.value)}
                required
              />
              <small>اکانت جیمیل شما که اشتراک ۱۸ ماهه Google AI Pro روی آن فعال خواهد شد</small>
            </div>

            <div className="auth-card__field">
              <label>شماره تماس همراه (جهت هماهنگی و پشتیبانی):</label>
              <input
                type="tel"
                placeholder="۰۹۱۲۳۴۵۶۷۸۹"
                dir="ltr"
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                required
              />
            </div>

            <div className="auth-card__actions">
              <button
                type="submit"
                className="btn btn--accent auth-card__submit-btn"
                disabled={loading}
              >
                <span>{loading ? 'در حال ارسال ایمیل...' : 'دریافت کد تایید ایمیلی'}</span>
                <Icon name="arrow" size={16} />
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} className="auth-card__form">
            <div className="auth-card__field">
              <label>کد تایید ۵ رقمی:</label>
              <input
                ref={otpInputRef}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                placeholder="• • • • •"
                dir="ltr"
                className="auth-card__otp-input en"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value)}
                required
              />
            </div>

            <div className="auth-card__timer-row">
              {timer > 0 ? (
                <span className="auth-card__countdown">
                  ارسال مجدد کد پس از: <b>{Math.floor(timer / 60)}:{(timer % 60).toString().padStart(2, '0')}</b>
                </span>
              ) : (
                <button
                  type="button"
                  className="auth-card__resend-btn"
                  onClick={handleResendOtp}
                  disabled={loading}
                >
                  ارسال مجدد ایمیل کد
                </button>
              )}
              <button
                type="button"
                className="auth-card__edit-btn"
                onClick={() => {
                  setStep(1);
                  setOtpCode('');
                }}
              >
                ویرایش مشخصات
              </button>
            </div>

            <div className="auth-card__actions">
              <button
                type="submit"
                className="btn btn--accent auth-card__submit-btn"
                disabled={loading}
              >
                <span>{loading ? 'در حال بررسی کد...' : 'تایید و ورود به حساب'}</span>
                <Icon name="check" size={16} />
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
