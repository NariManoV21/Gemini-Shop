import { FOOTER_LINKS, SITE, SUPPORT } from '../config/site';
import './Footer.css';

interface Props {}

export function Footer({}: Props) {
  const go = (id: string) => (e: React.MouseEvent) => { e.preventDefault(); document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }); };
  return (
    <footer className="footer">
      <div className="container footer__grid">
        <div className="footer__brand">
          <span className="en footer__logo">Gemini <b className="brand-text">Pro</b></span>
          <p>خرید اشتراک Google AI Pro و دسترسی به قابلیت‌های هوش مصنوعی Gemini.</p>
        </div>
        <nav aria-label="دسترسی سریع">
          <h4>دسترسی سریع</h4>
          <ul>{FOOTER_LINKS.site.map((l) => <li key={l.id}><a href={`#${l.id}`} onClick={go(l.id)}>{l.label}</a></li>)}</ul>
        </nav>
        <nav aria-label="اطلاعات حقوقی">
          <h4>قوانین</h4>
          <ul>{FOOTER_LINKS.legal.map((l) => <li key={l.label}><a href={l.href}>{l.label}</a></li>)}</ul>
        </nav>
        <div>
          <h4>پشتیبانی</h4>
          <ul className="en footer__contact">
            <li>
              <a href={SUPPORT.telegramUrl || `https://t.me/${SUPPORT.telegram.replace('@', '')}`} target="_blank" rel="noreferrer">
                {SUPPORT.telegram}
              </a>
            </li>
            <li>
              <a href={`mailto:${SUPPORT.email}`}>
                {SUPPORT.email}
              </a>
            </li>
          </ul>
        </div>
      </div>
      <div className="container footer__bottom">
        <p>{SITE.affiliationNotice}</p>
        <div className="footer__copyright-row">
          <p>{SITE.copyright}</p>
        </div>
      </div>
    </footer>
  );
}
