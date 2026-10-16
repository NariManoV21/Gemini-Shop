import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { FAQ_ITEMS } from '../data/mockContent';
import { Icon } from './Icon';
import './Faq.css';

gsap.registerPlugin(ScrollTrigger);

export function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  const faqRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo(
        '.faq__item',
        { opacity: 0, y: 25 },
        {
          opacity: 1,
          y: 0,
          duration: 0.6,
          stagger: 0.1,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: faqRef.current,
            start: 'top 82%',
          },
        }
      );
    }, faqRef);
    return () => ctx.revert();
  }, []);

  return (
    <section id="faq" className="section" ref={faqRef}>
      <div className="container faq">
        <div className="section__head">
          <h2 className="section__title">سوالات متداول</h2>
          <p className="section__lead">پاسخ پرسش‌های رایج درباره‌ی خرید و فعال‌سازی</p>
        </div>
        <div className="faq__list">
          {FAQ_ITEMS.map((f, i) => {
            const isOpen = open === i;
            return (
              <div key={f.q} className={`faq__item glass ${isOpen ? 'is-open' : ''}`}>
                <h3>
                  <button id={`faq-q-${i}`} aria-expanded={isOpen} aria-controls={`faq-a-${i}`} onClick={() => setOpen(isOpen ? null : i)}>
                    <span>{f.q}</span>
                    <Icon name="chevron" size={20} />
                  </button>
                </h3>
                <div id={`faq-a-${i}`} role="region" aria-labelledby={`faq-q-${i}`} className="faq__panel">
                  <div><p>{f.a}</p></div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
