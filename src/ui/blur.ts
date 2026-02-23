export function isBlurEnabled() {
  if (typeof window === 'undefined') return true;
  try {
    if (document.documentElement.classList.contains('tg-webview')) return false;
  } catch {
  }
  const ua = navigator.userAgent || '';
  if (/Android/i.test(ua)) return false;
  if (/Telegram/i.test(ua)) return false;
  try {
    return typeof CSS !== 'undefined' && CSS.supports('backdrop-filter', 'blur(1px)');
  } catch {
    return false;
  }
}

export function blurStyle(value: string) {
  if (!isBlurEnabled()) return {};
  return {
    backdropFilter: `blur(${value})`,
    WebkitBackdropFilter: `blur(${value})`,
  } as const;
}
