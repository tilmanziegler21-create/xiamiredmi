export function isBlurEnabled() {
  if (typeof window === 'undefined') return true;
  try {
    return typeof CSS !== 'undefined' && CSS.supports('backdrop-filter', 'blur(1px)');
  } catch {
    return false;
  }
}

export function blurStyle(value: string) {
  if (!isBlurEnabled()) return {};
  const ua = typeof navigator !== 'undefined' ? (navigator.userAgent || '') : '';
  const isAndroid = /Android/i.test(ua);
  const isTelegram = /Telegram/i.test(ua);
  const isTgWebview = (() => {
    try {
      return document.documentElement.classList.contains('tg-webview');
    } catch {
      return false;
    }
  })();
  const blurValue = isAndroid ? '4px' : isTelegram || isTgWebview ? '8px' : value;
  return {
    backdropFilter: `blur(${blurValue})`,
    WebkitBackdropFilter: `blur(${blurValue})`,
  } as const;
}
