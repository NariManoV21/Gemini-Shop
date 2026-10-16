import { useEffect } from 'react';

/**
 * هوک جامع و استاندارد جهت قفل کردن اسکرول صفحه هنگام باز بودن هر مدال یا پنل
 * همراه با تصحیح عرض اسکرول‌بار مرورگر جهت جلوگیری از پرش افقی لایه (Layout Shift)
 */
export function useBodyScrollLock(isLocked: boolean) {
  useEffect(() => {
    if (!isLocked) return;

    const originalOverflow = document.body.style.overflow;
    const originalPaddingRight = document.body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

    document.body.style.overflow = 'hidden';
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }

    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.paddingRight = originalPaddingRight;
    };
  }, [isLocked]);
}
