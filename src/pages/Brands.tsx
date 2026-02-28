import React from 'react';
import WebApp from '@twa-dev/sdk';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { catalogAPI } from '../services/api';
import { GlassCard, SectionDivider, theme } from '../ui';
import { useToastStore } from '../store/useToastStore';
import { useCityStore } from '../store/useCityStore';
import { blurStyle } from '../ui/blur';

type BrandRow = {
  brand: string;
  count: number;
  logo?: string;
};

const assetUrl = (p: string) => {
  const base = String(import.meta.env.BASE_URL || '/');
  const prefix = base.endsWith('/') ? base.slice(0, -1) : base;
  const path = p.startsWith('/') ? p : `/${p}`;
  return `${prefix}${path}`;
};

const brandKey = (s: string) => {
  const cleaned = String(s || '')
    .toLowerCase()
    .trim()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/[^a-z0-9 ]/g, '');
  return { cleaned, compact: cleaned.replace(/\s+/g, '') };
};

const brandLogo = (brand: string) => {
  const k = brandKey(brand);
  if (k.compact.includes('elfliq')) return assetUrl('/images/brands/elfliq/elfliq_liquid.png');
  if (k.compact.includes('elfic')) return assetUrl('/images/brands/elfic_liquid.png');
  if (k.compact.includes('elflic')) return assetUrl('/images/brands/elfic_liquid.png');
  if (k.compact.includes('elfbar') || k.cleaned.includes('elf bar')) return assetUrl('/images/brands/elfbar/elfbar_liquid.png');
  if (k.compact.includes('geekvape') || k.cleaned.includes('geek vape')) return assetUrl('/images/brands/geekvape/geekvape_liquid.png');
  if (k.compact.includes('vaporesso')) return assetUrl('/images/brands/vaporesso/vaporesso_liquid.png');
  return '';
};

const Brands: React.FC = () => {
  const navigate = useNavigate();
  const toast = useToastStore();
  const { city } = useCityStore();
  const [searchParams] = useSearchParams();
  const category = String(searchParams.get('category') || '');
  const [loading, setLoading] = React.useState(true);
  const [rows, setRows] = React.useState<BrandRow[]>([]);

  React.useEffect(() => {
    (async () => {
      try {
        if (!city) {
          setRows([]);
          setLoading(false);
          return;
        }
        setLoading(true);
        const resp = await catalogAPI.getProducts({ city, category });
        const list = (resp.data.products || []) as Array<{ brand: string }>;
        const map = new Map<string, number>();
        for (const p of list) {
          const b = String((p as any).brand || '').trim();
          if (!b) continue;
          map.set(b, (map.get(b) || 0) + 1);
        }
        let directory: string[] = [];
        try {
          const b = await catalogAPI.getBrands(city);
          directory = Array.isArray(b.data?.brands) ? b.data.brands : [];
        } catch {
          directory = [];
        }

        const out = directory.length
          ? directory
              .map((brand) => ({ brand: String(brand || '').trim(), count: map.get(String(brand || '').trim()) || 0 }))
              .filter((r) => r.brand && r.count > 0)
              .map((r) => ({ ...r, logo: brandLogo(r.brand) }))
          : Array.from(map.entries())
              .map(([brand, count]) => ({ brand, count, logo: brandLogo(brand) }))
              .sort((a, b) => a.brand.localeCompare(b.brand));
        setRows(out);
      } catch (e) {
        console.error('Brands load error:', e);
        try {
          WebApp.showAlert('Ошибка загрузки брендов');
        } catch {
          toast.push('Ошибка загрузки брендов', 'error');
        }
        setRows([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [city, category]);

  return (
    <div style={{ paddingBottom: theme.spacing.xl }}>
      <SectionDivider title={category || 'Бренды'} />
      <div style={{ padding: `0 ${theme.padding.screen}` }}>
        {loading ? (
          <div style={{ display: 'grid', gap: 10 }}>
            {[...Array(8)].map((_, i) => (
              <div
                key={i}
                className="skeleton-shimmer"
                style={{ height: 80, borderRadius: 12, border: '1px solid rgba(255,255,255,0.10)' }}
              />
            ))}
          </div>
        ) : rows.length ? (
          <div style={{ display: 'grid', gap: 10 }}>
            {rows.map((r) => (
              <GlassCard
                key={r.brand}
                padding="md"
                variant="elevated"
                style={{
                  height: 80,
                  borderRadius: 12,
                  overflow: 'hidden',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: theme.spacing.md,
                  background: 'rgba(12, 10, 26, 0.62)',
                  ...blurStyle(theme.blur.glass),
                }}
                onClick={() => navigate(`/catalog?category=${encodeURIComponent(category)}&brand=${encodeURIComponent(r.brand)}`)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                  <div style={{ width: 58, height: 58, borderRadius: 12, background: 'rgba(0,0,0,0.24)', border: '1px solid rgba(255,255,255,0.10)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                    {r.logo ? <img src={r.logo} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 6 }} /> : null}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontFamily: '"Bebas Neue", ' + theme.typography.fontFamily, fontSize: 26, letterSpacing: '0.12em', textTransform: 'uppercase', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.brand}
                    </div>
                    <div style={{ fontSize: 12, color: theme.colors.dark.textSecondary, letterSpacing: '0.06em' }}>
                      {r.count} вкусов
                    </div>
                  </div>
                </div>
                <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 18, paddingRight: 4 }}>→</div>
              </GlassCard>
            ))}
          </div>
        ) : (
          <GlassCard padding="lg" variant="elevated">
            <div style={{ textAlign: 'center', color: theme.colors.dark.textSecondary }}>Бренды не найдены</div>
          </GlassCard>
        )}
      </div>
    </div>
  );
};

export default Brands;
