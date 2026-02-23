import { useCallback } from 'react';
import WebApp from '@twa-dev/sdk';
import { analyticsAPI } from '../services/api';

interface AnalyticsEvent {
  event: string;
  params?: Record<string, any>;
}

export const useAnalytics = () => {
  const trackEvent = useCallback((event: string, params?: Record<string, any>) => {
    try {
      analyticsAPI.event(event, params).catch(() => {});
    } catch (error) {
      console.error('Analytics tracking error:', error);
    }
  }, []);

  const trackProductView = useCallback((productId: string, productName: string, category: string) => {
    trackEvent('view_product', {
      product_id: productId,
      product_name: productName,
      category,
      timestamp: Date.now()
    });
  }, [trackEvent]);

  const trackAddToCart = useCallback((productId: string, productName: string, price: number, quantity: number) => {
    trackEvent('add_to_cart', {
      product_id: productId,
      product_name: productName,
      price,
      quantity,
      value: price * quantity,
      currency: 'RUB'
    });
  }, [trackEvent]);

  const trackRemoveFromCart = useCallback((productId: string, productName: string, price: number, quantity: number) => {
    trackEvent('remove_from_cart', {
      product_id: productId,
      product_name: productName,
      price,
      quantity,
      value: price * quantity,
      currency: 'RUB'
    });
  }, [trackEvent]);

  const trackCheckout = useCallback((items: any[], total: number) => {
    trackEvent('checkout', {
      items: items.map(item => ({
        product_id: item.productId,
        product_name: item.name,
        category: item.category,
        price: item.price,
        quantity: item.quantity
      })),
      total,
      currency: 'RUB'
    });
  }, [trackEvent]);

  const trackOrderComplete = useCallback((orderId: string, total: number, items: any[]) => {
    trackEvent('delivered', {
      order_id: orderId,
      total,
      items: items.length,
      currency: 'RUB'
    });
  }, [trackEvent]);

  const trackSearch = useCallback((searchTerm: string, resultsCount: number) => {
    trackEvent('search', {
      search_term: searchTerm,
      results_count: resultsCount
    });
  }, [trackEvent]);

  const trackFilterUse = useCallback((filterType: string, filterValue: string) => {
    trackEvent('filter_used', {
      filter_type: filterType,
      filter_value: filterValue
    });
  }, [trackEvent]);

  const trackCategoryView = useCallback((category: string) => {
    trackEvent('view_category', {
      category
    });
  }, [trackEvent]);

  return {
    trackEvent,
    trackProductView,
    trackAddToCart,
    trackRemoveFromCart,
    trackCheckout,
    trackOrderComplete,
    trackSearch,
    trackFilterUse,
    trackCategoryView
  };
};
