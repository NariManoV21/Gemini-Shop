import { useEffect, useState } from 'react';
import { NAV_ITEMS } from '../config/site';
import type { UserProfile } from '../services/authService';
import { Icon } from './Icon';
import './Header.css';

interface Props {
  onBuy: () => void;
  onTrackOrder?: () => void;
  onOpenAuth?: () => void;
  onOpenProfile?: () => void;
  currentUser?: UserProfile | null;
}

export function Header({ onBuy, onTrackOrder, onOpenAuth, onOpenProfile, currentUser }: Props) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState('home');

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // وقتی منوی موبایل بازه، ستاره‌ی canvas مخفی می‌شه تا روی منو نیفته
  useEffect(() => {
    document.body.classList.toggle('menu-open', open);
    return () => document.body.classList.remove('menu-open');
  }, [open]);

  // آیتم فعال منو بر اساس سکشن قابل‌مشاهده
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && setActive(e.target.id)),
      { rootMargin: '-45% 0px -50% 0px' },
    );
    NAV_ITEMS.forEach((n) => {
      const el = document.getElementById(n.id);
      if (el) io.observe(el);
    });
    return () => io.disconnect();
  }, []);

  const go = (id: string) => {
    setOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <header className={`header ${scrolled ? 'header--scrolled' : ''}`}>
      <div className="header__inner container">
        <a
          className="logo"
          href="#home"
          dir="ltr"
          aria-label="Gemini Shop"
          onClick={(e) => {
            e.preventDefault();
            go('home');
          }}
        >
          <span id="logo-star-slot" className="logo__star" />
          <span className="logo__text en">
            Gemini <b className="brand-text">Shop</b>
          </span>
        </a>

        <nav className={`nav ${open ? 'nav--open' : ''}`} aria-label="منوی اصلی">
          {NAV_ITEMS.map((n) => (
            <a
              key={n.id}
              href={`#${n.id}`}
              className={`nav__link ${active === n.id ? 'is-active' : ''}`}
              onClick={(e) => {
                e.preventDefault();
                go(n.id);
              }}
            >
              {n.label}
            </a>
          ))}

          {currentUser ? (
            <button
              className="btn btn--ghost btn--sm nav__profile-mobile"
              onClick={() => {
                setOpen(false);
                onOpenProfile?.();
              }}
            >
              <Icon name="user" size={16} /> پروفایل کاربری ({currentUser.fullName.split(' ')[0]})
            </button>
          ) : (
            <button
              className="btn btn--ghost btn--sm nav__profile-mobile"
              onClick={() => {
                setOpen(false);
                onOpenAuth?.();
              }}
            >
              <Icon name="user" size={16} /> ورود / حساب کاربری
            </button>
          )}

          {onTrackOrder && (
            <button
              className="btn btn--ghost btn--sm nav__track-mobile"
              onClick={() => {
                setOpen(false);
                onTrackOrder();
              }}
            >
              <Icon name="search" size={16} /> پیگیری سفارش
            </button>
          )}
          <button
            className="btn btn--sm nav__cta-mobile"
            onClick={() => {
              setOpen(false);
              onBuy();
            }}
          >
            <Icon name="bag" size={18} /> خرید اشتراک
          </button>
        </nav>

        <div className="header__actions">
          {currentUser ? (
            <button className="header__user-chip" onClick={onOpenProfile} title="مشاهده پروفایل و لایسنس‌ها">
              <span className="user-avatar-circle">{currentUser.fullName.slice(0, 1)}</span>
              <span className="user-name-text">{currentUser.fullName.split(' ')[0]}</span>
              <span className="user-online-dot" />
            </button>
          ) : (
            <button className="btn btn--ghost btn--sm header__login-btn" onClick={onOpenAuth}>
              <Icon name="user" size={15} />
              <span>حساب کاربری</span>
            </button>
          )}

          <button className="btn btn--sm header__cta" onClick={onBuy}>
            <Icon name="bag" size={18} />
            <span>خرید اشتراک</span>
            <Icon name="arrow" size={16} />
          </button>
        </div>

        <button
          className="header__burger"
          aria-label={open ? 'بستن منو' : 'باز کردن منو'}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <Icon name={open ? 'close' : 'menu'} size={24} />
        </button>
      </div>
    </header>
  );
}
