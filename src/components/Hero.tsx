import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import type { Product } from '../config/site';
import { HERO_COPY } from '../data/mockContent';
import { formatToman } from '../lib/format';
import { GoogleG, Icon, GeminiStar } from './Icon';
import './Hero.css';

gsap.registerPlugin(ScrollTrigger);

interface Props { product: Product; onBuy: () => void }

export function Hero({ product, onBuy }: Props) {
  const stageRef = useRef<HTMLDivElement>(null);
  const hintRef = useRef<HTMLDivElement>(null);

  // سایه‌ی کف و نشانگر اسکرول با شروع حرکت ستاره محو می‌شن (برگشت‌پذیر)
  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.to(stageRef.current!.querySelector('.hero__floor'), {
        opacity: 0, ease: 'none',
        scrollTrigger: { start: 0, end: () => window.innerHeight * 0.5, scrub: true },
      });
      gsap.to(hintRef.current, {
        opacity: 0, ease: 'none',
        scrollTrigger: { start: 0, end: 180, scrub: true },
      });
    });
    return () => ctx.revert();
  }, []);

  return (
    <section id="home" className="hero">
      <div className="hero__bg" aria-hidden="true" />
      <div className="hero__grid container">
        <div className="hero__stage" ref={stageRef}>
          <div id="star-slot" className="hero__star-slot" />
          <div className="hero__floor" aria-hidden="true" />
        </div>

        <div className="hero__copy">
          <div className="hero-badge glass">
            <GoogleG size={22} />
            <span className="hero-badge__text">{product.badgeLabel}</span>
          </div>

          <h1 className="hero__title">
            <span className="hero__line hero__line--ink">{HERO_COPY.titleTop}</span>
            <span className="hero__line hero__line--accent brand-text">{HERO_COPY.titleAccent}</span>
            <span className="hero__line hero__line--en en brand-text">Gemini Pro</span>
          </h1>

          {/* کارت ورودی ریدیزاین‌شده مطابق عکس رفرنس */}
          <div className="price-card luxury-card" dir="rtl">
            {/* نوار بالای کارت: عنوان برند Gemini Pro با لوگو + نشان‌ها */}
            <div className="luxury-card__header">
              <div className="luxury-card__brand-col">
                <div className="luxury-card__brand-title">
                  <GeminiStar size={32} />
                  <span className="luxury-card__brand-name en">
                    Gemini <b>Pro</b>
                  </span>
                </div>
                <div className="luxury-card__period-pill">
                  <span>اشتراک ۱۸ ماهه</span>
                  <Icon name="calendar" size={14} />
                </div>
              </div>

              <div className="luxury-card__smart-pill">
                <span>انتخابی هوشمندانه</span>
                <Icon name="sparkle" size={14} />
              </div>
            </div>

            {/* بدنه دو ستونه: امکانات در راست و قیمت/دکمه خرید در چپ */}
            <div className="luxury-card__body">
              {/* ستون راست: ۵ ویژگی با تیک دایره‌ای بنفش */}
              <ul className="luxury-card__features">
                <li>
                  <span className="luxury-card__check">
                    <Icon name="check" size={13} />
                  </span>
                  <span>دسترسی به Gemini 3.8 Flash و Gemini 4 Pro Argon</span>
                </li>
                <li>
                  <span className="luxury-card__check">
                    <Icon name="check" size={13} />
                  </span>
                  <span>ترکیب با ابزارهای Google One برای بهره‌وری بیشتر</span>
                </li>
                <li>
                  <span className="luxury-card__check">
                    <Icon name="check" size={13} />
                  </span>
                  <span>اشتراک ۱۸ ماهه با ۱ ماه رایگان</span>
                </li>
                <li>
                  <span className="luxury-card__check">
                    <Icon name="check" size={13} />
                  </span>
                  <span>فعال‌سازی سریع و آسان</span>
                </li>
                <li>
                  <span className="luxury-card__check">
                    <Icon name="check" size={13} />
                  </span>
                  <span>پشتیبانی اختصاصی پس از خرید</span>
                </li>
              </ul>

              {/* ستون چپ: قیمت، پرداخت یکباره و دکمه گرادیانی */}
              <div className="luxury-card__action-block">
                <div className="luxury-card__price-box">
                  <span className="luxury-card__price-label">قیمت</span>
                  <div className="luxury-card__amount-row">
                    <b className="luxury-card__number">{formatToman(product.priceToman)}</b>
                    <span className="luxury-card__currency">تومان</span>
                  </div>
                </div>

                <div className="luxury-card__onetime-pill">
                  <span>پرداخت یکباره، بدون هزینه تمدید</span>
                  <Icon name="shield" size={14} />
                </div>

                <button
                  className="btn luxury-card__cta"
                  onClick={onBuy}
                  disabled={!product.available}
                >
                  <Icon name="arrow" size={16} />
                  <span>{product.available ? 'خرید و فعال‌سازی روی ایمیل' : 'فعلاً ناموجود'}</span>
                  <Icon name="bag" size={18} />
                </button>
              </div>
            </div>

            {/* فوتر درون کارت: ۳ گزینه اعتمادسازی جداشده با خط عمودی */}
            <div className="luxury-card__footer">
              <div className="luxury-card__trust-item">
                <Icon name="headset" size={17} />
                <span>پشتیبانی ۲۴ ساعته</span>
              </div>
              <span className="luxury-card__divider" />
              <div className="luxury-card__trust-item">
                <Icon name="bolt" size={17} />
                <span>تحویل فوری پس از پرداخت</span>
              </div>
              <span className="luxury-card__divider" />
              <div className="luxury-card__trust-item">
                <Icon name="shield" size={17} />
                <span>پرداخت امن و مطمئن</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="scroll-hint" ref={hintRef} aria-hidden="true">
        <span className="scroll-hint__line" />
        <span className="scroll-hint__text">اسکرول کنید</span>
        <span className="scroll-hint__mouse"><i /></span>
      </div>
    </section>
  );
}
