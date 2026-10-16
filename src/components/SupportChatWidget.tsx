import { useEffect, useRef, useState } from 'react';
import { SUPPORT } from '../config/site';
import { formatToman } from '../lib/format';
import {
  type ChatMessage,
  getOrCreateSessionId,
  getSessionMessages,
  sendUserMessage,
} from '../services/chatService';
import { Icon } from './Icon';
import './SupportChatWidget.css';

export function SupportChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const sessionId = useRef(getOrCreateSessionId()).current;
  const bottomRef = useRef<HTMLDivElement>(null);

  // بارگذاری پیام‌ها و گوش دادن به بروزرسانی‌های سراسری
  useEffect(() => {
    const load = () => {
      const msgs = getSessionMessages(sessionId);
      if (msgs.length === 0) {
        const welcome: ChatMessage = {
          id: 'welcome_1',
          sessionId,
          sender: 'bot',
          text: 'درود، به مرکز پشتیبانی رسمی Gemini Pro خوش آمدید. برای استعلام فوری وضعیت سفارش یا راهنمایی فعال‌سازی، می‌توانید از گزینه‌های سریع زیر استفاده فرمایید یا پیام خود را بنویسید.',
          createdAt: new Date().toISOString(),
        };
        setMessages([welcome]);
      } else {
        setMessages(msgs);
      }
    };

    load();

    const handleUpdate = () => {
      const msgs = getSessionMessages(sessionId);
      setMessages(msgs);
      if (!open) {
        const last = msgs[msgs.length - 1];
        if (last && (last.sender === 'admin' || last.sender === 'bot')) {
          setUnreadCount((prev) => prev + 1);
        }
      }
    };

    window.addEventListener('gemini_chat_updated', handleUpdate);
    return () => window.removeEventListener('gemini_chat_updated', handleUpdate);
  }, [open, sessionId]);

  // اسکرول اتوماتیک به انتهای پیام‌ها
  useEffect(() => {
    if (open) {
      setUnreadCount(0);
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, open]);

  const handleSend = (textToSend?: string) => {
    const text = (textToSend || input).trim();
    if (!text) return;

    setInput('');
    setIsTyping(true);

    setTimeout(() => {
      const { userMsg, botReply } = sendUserMessage(sessionId, text);
      setMessages((prev) => [...prev, userMsg, ...(botReply ? [botReply] : [])]);
      setIsTyping(false);
    }, 400);
  };

  const handleQuickAction = (actionText: string) => {
    handleSend(actionText);
  };

  return (
    <div className="support-widget" dir="rtl">
      {/* پنجره گفتگوی باز شونده */}
      {open && (
        <div className="support-widget__window" role="dialog" aria-label="پشتیبانی آنلاین">
          {/* هدر رسمی و مینیمال چت */}
          <div className="support-widget__header">
            <div className="support-widget__agent-info">
              <div className="support-widget__avatar">
                <Icon name="headset" size={20} />
                <span className="support-widget__online-dot" />
              </div>
              <div className="support-widget__titles">
                <strong>پشتیبانی فروشگاه Gemini Pro</strong>
                <small>پاسخ‌گویی معمولاً در کمتر از ۵ دقیقه</small>
              </div>
            </div>

            <div className="support-widget__actions">
              <a
                href={`https://t.me/${SUPPORT.telegram.replace('@', '')}`}
                target="_blank"
                rel="noreferrer"
                className="support-widget__tg-head-btn"
                title="ارتباط مستقیم در تلگرام"
              >
                <Icon name="send" size={14} />
              </a>
              <button
                type="button"
                className="support-widget__close-btn"
                onClick={() => setOpen(false)}
                aria-label="بستن پنجره چت"
              >
                <Icon name="close" size={17} />
              </button>
            </div>
          </div>

          {/* نوار گزینه‌های دسترسی سریع با آیکون‌های SVG */}
          <div className="support-widget__chips">
            <button
              type="button"
              className="support-widget__chip"
              onClick={() => handleQuickAction('پیگیری وضعیت سفارش من')}
            >
              <Icon name="search" size={12} />
              <span>استعلام سفارش</span>
            </button>
            <button
              type="button"
              className="support-widget__chip"
              onClick={() => handleQuickAction('فعال‌سازی اشتراک چگونه است؟')}
            >
              <Icon name="key" size={12} />
              <span>نحوه فعال‌سازی</span>
            </button>
            <button
              type="button"
              className="support-widget__chip"
              onClick={() => handleQuickAction('شماره کارت جهت واریز چیست؟')}
            >
              <Icon name="bolt" size={12} />
              <span>اطلاعات حساب واریز</span>
            </button>
            <button
              type="button"
              className="support-widget__chip"
              onClick={() => handleQuickAction('مشکل تحریم و تغییر آی پی')}
            >
              <Icon name="shield" size={12} />
              <span>رفع محدودیت تحریم</span>
            </button>
          </div>

          {/* محوطه پیام‌ها */}
          <div className="support-widget__thread">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`support-widget__msg support-widget__msg--${m.sender}`}
              >
                {m.sender !== 'user' && (
                  <div className="support-widget__msg-avatar">
                    {m.sender === 'admin' ? <Icon name="headset" size={13} /> : <Icon name="sparkle" size={13} />}
                  </div>
                )}
                <div className="support-widget__bubble">
                  {m.sender === 'admin' && <span className="support-widget__sender-tag">پاسخ کارشناس پشتیبانی</span>}
                  <p className="support-widget__text">{m.text}</p>

                  {/* کارت سفارش در صورت استعلام کد سفارش */}
                  {m.orderCard && (
                    <div className="support-widget__order-card">
                      <div className="support-widget__order-row">
                        <span>کد رهگیری:</span>
                        <b className="en">{m.orderCard.id}</b>
                      </div>
                      <div className="support-widget__order-row">
                        <span>نام خریدار:</span>
                        <span>{m.orderCard.fullName}</span>
                      </div>
                      <div className="support-widget__order-row">
                        <span>مبلغ سفارش:</span>
                        <span>{formatToman(m.orderCard.amountToman)} تومان</span>
                      </div>
                      <div className="support-widget__order-row">
                        <span>وضعیت لایسنس:</span>
                        <span className={`support-widget__status support-widget__status--${m.orderCard.status}`}>
                          {m.orderCard.status === 'approved'
                            ? 'فعال‌شده و آماده'
                            : m.orderCard.status === 'pending_verification'
                            ? 'در انتظار بررسی فیش'
                            : 'عدم تایید فیش'}
                        </span>
                      </div>
                      {m.orderCard.activationLink && (
                        <a
                          href={m.orderCard.activationLink}
                          target="_blank"
                          rel="noreferrer"
                          className="support-widget__activation-btn"
                        >
                          <Icon name="external" size={13} />
                          <span>ورود به لینک فعال‌سازی رسمی گوگل</span>
                        </a>
                      )}
                    </div>
                  )}

                  <span className="support-widget__time">
                    {new Date(m.createdAt).toLocaleTimeString('fa-IR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              </div>
            ))}

            {isTyping && (
              <div className="support-widget__msg support-widget__msg--bot support-widget__msg--typing">
                <div className="support-widget__msg-avatar">
                  <Icon name="sparkle" size={13} />
                </div>
                <div className="support-widget__bubble typing-dots">
                  <span />
                  <span />
                  <span />
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* فیلد ورودی پیام */}
          <form
            className="support-widget__footer"
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
          >
            <input
              type="text"
              className="support-widget__input"
              placeholder="پیام یا کد سفارش (مانند GP-123456)..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
            />
            <button
              type="submit"
              className="support-widget__send-btn"
              disabled={!input.trim()}
              aria-label="ارسال پیام"
            >
              <Icon name="send" size={15} />
            </button>
          </form>
        </div>
      )}

      {/* دکمه شناور پرتابل (Launcher) */}
      <button
        type="button"
        className={`support-widget__launcher ${open ? 'support-widget__launcher--open' : ''}`}
        onClick={() => setOpen(!open)}
        aria-label="پشتیبانی آنلاین و چت"
      >
        <div className="support-widget__launcher-icon">
          {open ? (
            <Icon name="close" size={20} />
          ) : (
            <>
              <Icon name="headset" size={20} />
              <span className="support-widget__pulse-ring" />
            </>
          )}
        </div>
        {!open && <span className="support-widget__launcher-text">پشتیبانی و گفتگو</span>}
        {!open && unreadCount > 0 && (
          <span className="support-widget__unread-badge">{unreadCount}</span>
        )}
      </button>
    </div>
  );
}
