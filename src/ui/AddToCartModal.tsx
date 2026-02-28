import React from 'react';
import { X } from 'lucide-react';
import { theme } from './theme';
import { PrimaryButton } from './PrimaryButton';
import { SecondaryButton } from './SecondaryButton';
import WebApp from '@twa-dev/sdk';
import { formatCurrency } from '../lib/currency';
import { blurStyle } from './blur';
import { CherryMascot } from './CherryMascot';

export type AddToCartModalProduct = {
  id: string;
  name: string;
  price: number;
  image?: string;
  variants?: string[];
};

type Props = {
  open: boolean;
  product: AddToCartModalProduct | null;
  onClose: () => void;
  onConfirm: (payload: { quantity: number; variant?: string }) => Promise<void> | void;
};

export const AddToCartModal: React.FC<Props> = ({ open, product, onClose, onConfirm }) => {
  const [qty, setQty] = React.useState(1);
  const [variant, setVariant] = React.useState<string | undefined>(undefined);
  const [busy, setBusy] = React.useState(false);
  const variants = product?.variants || [];

  React.useEffect(() => {
    if (!open) return;
    setQty(1);
    setVariant(variants[0]);
  }, [open, variants]);

  if (!open || !product) return null;

  const canConfirm = variants.length ? Boolean(variant) : true;

  const confirm = async () => {
    if (!canConfirm) return;
    setBusy(true);
    try {
      await onConfirm({ quantity: qty, variant });
      try {
        WebApp?.HapticFeedback?.impactOccurred?.('medium');
      } catch {
      }
      try {
        window.dispatchEvent(new CustomEvent('cart:add'));
      } catch {
      }
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1400,
        background: 'rgba(0,0,0,0.65)',
        display: 'flex',
        alignItems: 'flex-end',
        padding: theme.padding.screen,
        paddingBottom: `calc(${theme.padding.screen} + var(--safe-area-bottom, 0px))`,
      }}
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: '100%',
          borderRadius: theme.radius.lg,
          border: '1px solid rgba(255,255,255,0.14)',
          background: 'radial-gradient(circle at 30% 20%, rgba(192,25,58,0.15) 0%, #0d0608 72%)',
          ...blurStyle(theme.blur.glass),
          boxShadow: theme.shadow.card,
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ padding: theme.spacing.lg, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: theme.typography.fontSize.lg, fontWeight: theme.typography.fontWeight.bold, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            В корзину
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: theme.colors.dark.text, cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ padding: `0 ${theme.spacing.lg} ${theme.spacing.lg}` }}>
          <div
            style={{
              height: 140,
              borderRadius: theme.radius.lg,
              border: '1px solid rgba(255,255,255,0.12)',
              background: product.image
                ? `linear-gradient(135deg, rgba(0,0,0,0.12) 0%, rgba(0,0,0,0.72) 100%), url(${product.image || ''}) center/cover`
                : 'linear-gradient(135deg, rgba(0,0,0,0.12) 0%, rgba(0,0,0,0.72) 100%)',
              marginBottom: theme.spacing.md,
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {!product.image ? (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CherryMascot variant="pink" size={120} />
              </div>
            ) : null}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing.md, alignItems: 'flex-start', marginBottom: theme.spacing.md }}>
            <div style={{ flex: 1, fontWeight: theme.typography.fontWeight.bold, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{product.name}</div>
            <div
              style={{
                background: 'rgba(255,255,255,0.92)',
                color: '#000',
                borderRadius: 999,
                padding: '6px 12px',
                fontWeight: theme.typography.fontWeight.bold,
                boxShadow: '0 14px 30px rgba(0,0,0,0.35)',
                whiteSpace: 'nowrap',
              }}
            >
              {formatCurrency(product.price)}
            </div>
          </div>

          {variants.length ? (
            <div style={{ marginBottom: theme.spacing.md }}>
              <div style={{ fontSize: theme.typography.fontSize.xs, letterSpacing: '0.14em', textTransform: 'uppercase', opacity: 0.65, marginBottom: theme.spacing.sm }}>
                Вкус
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: theme.spacing.sm }}>
                {variants.map((v) => {
                  const active = v === variant;
                  return (
                    <button
                      key={v}
                      onClick={() => setVariant(v)}
                      style={{
                        borderRadius: 999,
                        border: '1px solid rgba(255,255,255,0.14)',
                        background: active ? 'rgba(255,45,85,0.18)' : 'rgba(255,255,255,0.06)',
                        color: theme.colors.dark.text,
                        padding: '8px 12px',
                        cursor: 'pointer',
                        fontSize: theme.typography.fontSize.sm,
                      }}
                    >
                      {v}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing.lg }}>
            <div style={{ opacity: 0.7, fontSize: theme.typography.fontSize.sm, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Количество</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.md }}>
              <button
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 10,
                  background: 'var(--cherry)',
                  color: '#fff',
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: theme.typography.fontWeight.bold,
                }}
              >
                −
              </button>
              <div style={{ width: 28, textAlign: 'center', fontWeight: theme.typography.fontWeight.bold }}>{qty}</div>
              <button
                onClick={() => setQty((q) => q + 1)}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 10,
                  background: 'var(--cherry)',
                  color: '#fff',
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: theme.typography.fontWeight.bold,
                }}
              >
                +
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gap: theme.spacing.sm, gridTemplateColumns: '1fr 1fr' }}>
            <SecondaryButton fullWidth onClick={onClose} disabled={busy} style={{ border: '1px solid rgba(255,255,255,0.15)', borderRadius: 12 }}>
              Отмена
            </SecondaryButton>
            <PrimaryButton fullWidth onClick={confirm} disabled={!canConfirm || busy} style={{ borderRadius: 12 }}>
              {busy ? 'Добавление…' : 'Добавить'}
            </PrimaryButton>
          </div>
        </div>
      </div>
    </div>
  );
};
