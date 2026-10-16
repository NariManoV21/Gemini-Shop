import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import type { Product } from '../config/site';
import { PAYMENT_CONFIG, SUPPORT } from '../config/site';
import {
  ACTIVATION_SAFETY_NOTE,
  ACTIVATION_STEPS,
  BENEFITS,
  COMPARE_NOTE,
  COMPARE_ROWS,
  TRUST_ITEMS,
  USE_CASES,
} from '../data/mockContent';
import { formatToman } from '../lib/format';
import { Icon } from './Icon';
import './Sections.css';

gsap.registerPlugin(ScrollTrigger);

/* ---------- ۴ رکن اصلی اشتراک (کارت‌های استگر با نمادهای شیشه‌ای) ---------- */
export function Benefits() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      // انیمیشن استگر ورود کارت‌ها
      gsap.fromTo(
        '.feature-card',
        { opacity: 0, y: 35 },
        {
          opacity: 1,
          y: 0,
          duration: 0.65,
          stagger: 0.14,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: containerRef.current,
            start: 'top 82%',
            toggleActions: 'play none none reverse',
          },
        }
      );
    }, containerRef);

    return () => ctx.revert();
  }, []);

  return (
    <section id="benefits" className="section section--benefits" ref={containerRef}>
      <div className="container">
        <div className="section__head section__head--center">
          <div className="section__badge">
            <Icon name="sparkle" size={16} />
            <span>امکانات کامل پکیج اکانت Google AI Pro</span>
          </div>
          <h2 className="section__title">
            ویژگی‌های انحصاری اشتراک <span className="en brand-text">Gemini Pro</span>
          </h2>
          <p className="section__lead">
            بررسی قابلیت‌ها و ابزارهایی که پس از فعال‌سازی اشتراک مستقیماً روی ایمیل شخصی در اختیارتان قرار می‌گیرد
          </p>
        </div>

        {/* شبکه ۴ کارت مدرن با استگر */}
        <div className="features-grid">
          {BENEFITS.map((item) => (
            <article key={item.id} className="feature-card glass">
              <div className="feature-card__top">
                <div className="feature-card__logo-wrap">
                  <div className="feature-card__logo-glow" />
                  <img
                    src={item.image}
                    alt={item.title}
                    className="feature-card__logo"
                    loading="lazy"
                  />
                </div>
                <div className="feature-card__badge" style={{ background: item.badgeColor }}>
                  {item.badge}
                </div>
              </div>

              <div className="feature-card__body">
                <h3 className="feature-card__title">{item.title}</h3>
                <h4 className="feature-card__subtitle">{item.subtitle}</h4>
                <p className="feature-card__desc">{item.summary}</p>

                <ul className="feature-card__points">
                  {item.points.map((p, idx) => (
                    <li key={idx}>
                      <span className="feature-card__check">
                        <Icon name="check" size={14} />
                      </span>
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- امکانات و کاربردها (چت شبیه‌سازی دستیار هوشمند Gemini Pro) ---------- */
export function UseCases() {
  const [active, setActive] = useState(USE_CASES[0].id);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showResponse, setShowResponse] = useState(true);
  const messagesRef = useRef<HTMLDivElement>(null);
  const current = USE_CASES.find((u) => u.id === active)!;

  // تغییر تب به همراه انیمیشن نرم تفکر و پاسخ گام‌به‌گام
  const handleTabChange = (id: string) => {
    if (id === active && showResponse) return;
    setActive(id);
    setIsGenerating(true);
    setShowResponse(false);
    setTimeout(() => {
      setIsGenerating(false);
      setShowResponse(true);
    }, 1100);
  };

  const handleRegenerate = () => {
    setIsGenerating(true);
    setShowResponse(false);
    setTimeout(() => {
      setIsGenerating(false);
      setShowResponse(true);
    }, 1000);
  };

  // اسکرول نرم درون جعبه پیام‌ها هنگام تولید پاسخ جدید
  useEffect(() => {
    if (showResponse && messagesRef.current) {
      messagesRef.current.scrollTo({ top: messagesRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [showResponse]);

  return (
    <section id="uses" className="section">
      <div className="container uses">
        <div>
          <div className="section__head">
            <h2 className="section__title">یک دستیار برای کارهای هر روز</h2>
            <p className="section__lead">یکی از کاربردها را انتخاب کنید و نمونه‌ی پرسش و پاسخ هوشمند را ببینید</p>
          </div>
          <div className="tabs" role="tablist" aria-label="کاربردها">
            {USE_CASES.map((u) => (
              <button
                key={u.id}
                role="tab"
                id={`tab-${u.id}`}
                aria-selected={u.id === active}
                aria-controls="use-panel"
                className={`tab ${u.id === active ? 'is-active' : ''}`}
                onClick={() => handleTabChange(u.id)}
              >
                <Icon name={u.icon} size={18} /> {u.label}
              </button>
            ))}
          </div>
          <div id="use-panel" role="tabpanel" aria-labelledby={`tab-${active}`} className="use-panel" key={active}>
            <h3>{current.title}</h3>
            <p>{current.text}</p>
          </div>
        </div>

        {/* چت تعاملی و پرامپت با پاسخ دستیار Gemini */}
        <div className="chat glass" aria-label="نمونه پرامپت و پاسخ دستیار Gemini Pro">
          <div className="chat__head">
            <div className="chat__status">
              <span className="chat__dot" />
              <span>دستیار هوشمند Gemini Pro</span>
            </div>
            <span className="chat__model-tag en">Gemini 4 Pro Argon</span>
          </div>

          <div className="chat__messages" ref={messagesRef}>
            {/* پیام کاربر */}
            <div className="chat__msg chat__msg--user">
              <p className="chat__bubble chat__bubble--user">{current.samplePrompt}</p>
            </div>

            {/* حالت در حال فکر کردن و لودینگ سه نقطه */}
            {isGenerating && (
              <div className="chat__msg chat__msg--ai chat__msg--loading">
                <div className="chat__avatar">
                  <Icon name="sparkle" size={15} />
                </div>
                <div className="chat__thinking-bubble glass">
                  <div className="typing-indicator">
                    <span />
                    <span />
                    <span />
                  </div>
                  <small>Gemini در حال استدلال و آماده‌سازی پاسخ...</small>
                </div>
              </div>
            )}

            {/* پاسخ شبیه‌سازی‌شده هوش مصنوعی با ظاهر نرم و تایپوگرافی خوانا */}
            {showResponse && !isGenerating && (
              <div className="chat__msg chat__msg--ai chat__msg--ai-revealed">
                <div className="chat__avatar">
                  <Icon name="sparkle" size={15} />
                </div>
                <div className="chat__bubble chat__bubble--ai glass">
                  <div className="chat__ai-head">
                    <strong>پاسخ تحلیلی Gemini Pro</strong>
                    <span className="chat__tag-argon">مدل Argon</span>
                  </div>
                  <div className="chat__response-body">
                    {current.sampleResponse.split('\n').map((line, idx) => {
                      const trimmed = line.trim();
                      if (trimmed.startsWith('•')) {
                        return (
                          <div key={idx} className="chat__response-bullet">
                            <span className="chat__bullet-dot" />
                            <span>{trimmed.replace('•', '').trim()}</span>
                          </div>
                        );
                      }
                      return (
                        <p key={idx} className="chat__response-line">
                          {trimmed}
                        </p>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div
            className="chat__input"
            onClick={handleRegenerate}
            title="کلیک برای شبیه‌سازی مجدد ارسال پرامپت"
          >
            <span>ارسال پرامپت به دستیار Gemini...</span>
            <button type="button" className="chat__send-btn" aria-label="ارسال">
              <Icon name="send" size={16} />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------- مقایسه و قیمت با انیمیشن استگر و کارت ۱۸ ماهه لوکس ---------- */
export function Pricing({ product, onBuy }: { product: Product; onBuy: () => void }) {
  const pricingRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo(
        '.pricing > *, .ip-warning-card',
        { opacity: 0, y: 35 },
        {
          opacity: 1,
          y: 0,
          duration: 0.7,
          stagger: 0.16,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: pricingRef.current,
            start: 'top 80%',
          },
        }
      );
    }, pricingRef);
    return () => ctx.revert();
  }, []);

  return (
    <section id="pricing" className="section section--tint" ref={pricingRef}>
      <div className="container">
        <div className="section__head">
          <div className="section__badge">
            <Icon name="sparkle" size={16} />
            <span>تعرفه شفاف و مقایسه اقتصادی</span>
          </div>
          <h2 className="section__title">مقایسه و قیمت اشتراک ۱۸ ماهه</h2>
          <p className="section__lead">{COMPARE_NOTE}</p>
        </div>
        <div className="pricing">
          <div className="compare glass" role="table" aria-label="مقایسه برنامه رایگان و Pro">
            <div className="compare__row compare__row--head" role="row">
              <span role="columnheader">ویژگی و امکانات</span>
              <span role="columnheader">نسخه رایگان</span>
              <span role="columnheader" className="en brand-text">
                Google AI Pro
              </span>
            </div>
            {COMPARE_ROWS.map((r) => (
              <div className="compare__row" role="row" key={r.label}>
                <span role="rowheader">{r.label}</span>
                <span role="cell" className="muted">
                  {r.free}
                </span>
                <span role="cell">
                  <b>{r.pro}</b>
                </span>
              </div>
            ))}
          </div>

          <aside className="plan">
            <div className="plan__aura" aria-hidden="true" />
            <div className="plan__flare" aria-hidden="true" />

            {/* نوار نشان‌های بالای کارت */}
            <div className="plan__top-row">
              <span className="plan__tag">
                <Icon name="sparkle" size={14} />
                {product.badgeLabel}
              </span>
              <span className="plan__guarantee-pill">۱ ماه گارانتی تعویض</span>
            </div>

            {/* عنوان و معرفی پلن */}
            <div className="plan__header">
              <h3 className="plan__title">Google AI Pro</h3>
              <p className="plan__subtitle">دسترسی اختصاصی به Gemini 4 Pro Argon و ۵ ترابایت فضای ابری</p>
            </div>

            {/* بخش ویژگی‌ها با آیکون‌های تیک و فاصله‌بندی زیبا */}
            <div className="plan__features-box">
              <span className="plan__features-label">امکانات کامل پکیج اشتراک:</span>
              <ul className="plan__features">
                {product.highlights.map((h) => (
                  <li key={h}>
                    <span className="plan__check-circle">
                      <Icon name="check" size={14} />
                    </span>
                    <span>{h}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* باکس قیمت‌گذاری: دقیقاً در انتهای کارت و بالای دکمه اقدام */}
            <div className="plan__pricing-box">
              {product.compareAtToman && (
                <div className="plan__global-val">
                  <span className="plan__global-title">ارزش رسمی بین‌المللی گوگل ($19.99/ماه):</span>
                  <div className="plan__global-nums">
                    <span className="plan__usd-badge en">$360 USD</span>
                    <s className="plan__toman-strike">{formatToman(product.compareAtToman)} تومان</s>
                  </div>
                </div>
              )}

              <div className="plan__price-row">
                <b>{formatToman(product.priceToman)}</b>
                <small>تومان</small>
                <span className="plan__period-badge">دوره کامل ۱۸ ماهه</span>
              </div>
              <span className="plan__payment-note">پرداخت یک‌باره بدون هزینه شارژ ماهانه یا تمدید پنهان</span>
            </div>

            {/* دکمه خرید و پی‌نوشت */}
            <button className="btn plan__buy-btn" onClick={onBuy} disabled={!product.available}>
              <span>{product.available ? 'خرید و فعال‌سازی روی ایمیل' : 'فعلاً ناموجود'}</span>
              <Icon name="arrow" size={18} />
            </button>
            <p className="plan__footnote">واریز با درگاه {PAYMENT_CONFIG.serviceName} یا کارت به کارت • تحویل ۲ الی ۴۸ ساعت</p>
          </aside>
        </div>

        {/* تذکر مهم ابزار تغییر IP و تحریم‌های گوگل */}
        <div className="ip-warning-card glass">
          <div className="ip-warning-card__icon">
            <Icon name="alert" size={22} />
          </div>
          <div className="ip-warning-card__content">
            <strong>تذکر مهم درباره تغییر IP و فیلترشکن:</strong>
            <p>
              با توجه به محدودیت‌های جغرافیایی گوگل برای کاربران ایران، جهت ورود به اکانت جیمیل و فعال‌سازی و استفاده از
              Gemini Pro و فضای ابری، حتماً از یک ابزار تغییر IP معتبر، پایدار و بدون نشت (DNS/WebRTC Leak-Free) استفاده
              فرمایید
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------- مراحل فعال‌سازی با استگر ---------- */
export function Activation() {
  const stepsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo(
        '.step',
        { opacity: 0, y: 35, scale: 0.95 },
        {
          opacity: 1,
          y: 0,
          scale: 1,
          duration: 0.65,
          stagger: 0.14,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: stepsRef.current,
            start: 'top 82%',
          },
        }
      );
    }, stepsRef);
    return () => ctx.revert();
  }, []);

  return (
    <section id="activation" className="section" ref={stepsRef}>
      <div className="container">
        <div className="section__head">
          <div className="section__badge">
            <Icon name="bolt" size={16} />
            <span>فرایند ثبت، پرداخت و تحویل</span>
          </div>
          <h2 className="section__title">نحوه فعال‌سازی اشتراک روی جیمیل شخصی</h2>
          <p className="section__lead">چهار گام ساده از ثبت سفارش تا فعال شدن رسمی لایسنس بر روی ایمیل شما</p>
        </div>
        <ol className="steps">
          {ACTIVATION_STEPS.map((s, i) => (
            <li key={s.title} className="step glass">
              <span className="step__n">{['۱', '۲', '۳', '۴'][i]}</span>
              <h3>{s.title}</h3>
              <p>{s.text}</p>
            </li>
          ))}
        </ol>
        <div className="activation-alert glass">
          <Icon name="lock" size={20} />
          <div>
            <strong>امنیت صد در صدی و حفظ حریم خصوصی:</strong>
            <p>{ACTIVATION_SAFETY_NOTE}</p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------- اعتمادسازی و پشتیبانی ---------- */
export function Trust() {
  const trustRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo(
        '.trust__item, .contact',
        { opacity: 0, y: 30 },
        {
          opacity: 1,
          y: 0,
          duration: 0.65,
          stagger: 0.12,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: trustRef.current,
            start: 'top 82%',
          },
        }
      );
    }, trustRef);
    return () => ctx.revert();
  }, []);

  return (
    <section id="support" className="section section--tint" ref={trustRef}>
      <div className="container">
        <div className="section__head">
          <h2 className="section__title">خیالتان از خرید و پشتیبانی راحت باشد</h2>
        </div>
        <div className="trust">
          <div className="trust__items">
            {TRUST_ITEMS.map((t) => (
              <article key={t.title} className="trust__item">
                <span className="tile tile--sm">
                  <Icon name={t.icon} size={22} />
                </span>
                <div>
                  <h3>{t.title}</h3>
                  <p>{t.text}</p>
                </div>
              </article>
            ))}
          </div>
          <div className="contact glass">
            <h3>ارتباط و پشتیبانی سریع</h3>
            <p className="contact__desc">جهت پیگیری فوری سفارشات، ارسال فیش واریزی یا سوالات پیش از خرید:</p>
            <a
              href={SUPPORT.telegramUrl || `https://t.me/${SUPPORT.telegram.replace('@', '')}`}
              className="contact__row"
              dir="ltr"
              target="_blank"
              rel="noreferrer"
            >
              <Icon name="send" size={18} /> <span className="en">{SUPPORT.telegram}</span>
            </a>
            <a href={`mailto:${SUPPORT.email}`} className="contact__row" dir="ltr">
              <Icon name="mail" size={18} /> <span className="en">{SUPPORT.email}</span>
            </a>
            <p className="contact__hours">{SUPPORT.hours}</p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------- دعوت به خرید ---------- */
export function CtaBand({ product, onBuy }: { product: Product; onBuy: () => void }) {
  return (
    <section className="section cta-section">
      <div className="container">
        <div className="cta glass">
          <div>
            <span className="section__badge">
              <Icon name="sparkle" size={16} />
              <span>پیشنهاد اختصاصی فعال‌سازی مستقیم</span>
            </span>
            <h2>دسترسی به پکیج کامل Google AI Pro را همین امروز آغاز کنید</h2>
            <p>
              {product.badgeLabel} تنها با {formatToman(product.priceToman)} تومان به همراه ۵ ترابایت فضای ابری
            </p>
          </div>
          <button className="btn btn--lg" onClick={onBuy} disabled={!product.available}>
            خرید و ثبت فیش واریزی <Icon name="arrow" size={18} />
          </button>
        </div>
      </div>
    </section>
  );
}
