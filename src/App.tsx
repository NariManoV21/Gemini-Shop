import { useCallback, useEffect, useState } from 'react';
import { AdminPanel } from './components/AdminPanel';
import { AuthModal } from './components/AuthModal';
import { CheckoutModal } from './components/CheckoutModal';
import { Faq } from './components/Faq';
import { Footer } from './components/Footer';
import { Header } from './components/Header';
import { Hero } from './components/Hero';
import { OrderTrackingModal } from './components/OrderTrackingModal';
import { Activation, Benefits, CtaBand, Pricing, Trust, UseCases } from './components/Sections';
import { StarScene } from './components/StarScene';
import { SupportChatWidget } from './components/SupportChatWidget';
import { UserProfileModal } from './components/UserProfileModal';
import { WaveDivider } from './components/WaveDivider';
import { useProduct } from './hooks/useProduct';
import { getCurrentUser, type UserProfile } from './services/authService';

export default function App() {
  const product = useProduct(); // قیمت و اطلاعات محصول فقط از لایه‌ی سرویس/config
  const [checkout, setCheckout] = useState(false);
  const [trackingOpen, setTrackingOpen] = useState(false);
  const [trackOrderId, setTrackOrderId] = useState<string | undefined>(undefined);
  const [adminOpen, setAdminOpen] = useState(false);

  // وضعیت احراز هویت و پروفایل مشتری
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => getCurrentUser());
  const [authOpen, setAuthOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  // گوش دادن به تغییرات وضعیت لاگین/پروفایل
  useEffect(() => {
    const handleAuth = () => {
      setCurrentUser(getCurrentUser());
    };
    window.addEventListener('gemini_auth_changed', handleAuth);
    return () => window.removeEventListener('gemini_auth_changed', handleAuth);
  }, []);

  // باز کردن خودکار پنل ادمین در صورت وجود #admin در آدرس
  useEffect(() => {
    const checkHash = () => {
      if (window.location.hash === '#admin') {
        setAdminOpen(true);
      }
    };
    checkHash();
    window.addEventListener('hashchange', checkHash);
    return () => window.removeEventListener('hashchange', checkHash);
  }, []);

  const openCheckout = useCallback(() => setCheckout(true), []);
  const closeCheckout = useCallback(() => setCheckout(false), []);

  const openTracking = useCallback((orderId?: string) => {
    setTrackOrderId(orderId);
    setTrackingOpen(true);
  }, []);

  const closeTracking = useCallback(() => {
    setTrackingOpen(false);
    setTrackOrderId(undefined);
  }, []);

  const openAdmin = useCallback(() => setAdminOpen(true), []);
  const closeAdmin = useCallback(() => {
    setAdminOpen(false);
    if (window.location.hash === '#admin') {
      history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  }, []);

  const openAuth = useCallback(() => setAuthOpen(true), []);
  const closeAuth = useCallback(() => setAuthOpen(false), []);

  const openProfile = useCallback(() => {
    const latestUser = getCurrentUser();
    if (!latestUser) {
      setAuthOpen(true);
    } else {
      setCurrentUser(latestUser);
      setProfileOpen(true);
    }
  }, []);

  const closeProfile = useCallback(() => setProfileOpen(false), []);

  return (
    <>
      <Header
        onBuy={openCheckout}
        onTrackOrder={() => openTracking()}
        onOpenAuth={openAuth}
        onOpenProfile={openProfile}
        currentUser={currentUser}
      />
      <StarScene />
      <main>
        <Hero product={product} onBuy={openCheckout} />
        <Benefits />
        <UseCases />
        <Pricing product={product} onBuy={openCheckout} />
        <Activation />
        <Trust />
        <WaveDivider color="tint" />
        <Faq />
        <CtaBand product={product} onBuy={openCheckout} />
      </main>
      <WaveDivider color="pearl" />
      <Footer onOpenAdmin={openAdmin} />
      <CheckoutModal
        product={product}
        open={checkout}
        onClose={closeCheckout}
        onTrackOrder={(orderId) => openTracking(orderId)}
        onOpenProfile={openProfile}
      />
      <OrderTrackingModal
        open={trackingOpen}
        onClose={closeTracking}
        initialOrderId={trackOrderId}
      />
      {/* مدال احراز هویت خریداران */}
      <AuthModal
        open={authOpen}
        onClose={closeAuth}
        onSuccess={(u) => {
          setCurrentUser(u);
          setProfileOpen(true);
        }}
      />
      {/* داشبورد و پروفایل مشتری (مشاهده لینک فعال‌سازی رسمی گوگل) */}
      {currentUser && (
        <UserProfileModal
          open={profileOpen}
          user={currentUser}
          onClose={closeProfile}
          onBuy={openCheckout}
        />
      )}
      {/* ویجت شناور پشتیبانی و چت آنلاین */}
      <SupportChatWidget />
      {/* پنل مدیریت پیشرفته ادمین */}
      <AdminPanel open={adminOpen} onClose={closeAdmin} />
    </>
  );
}
