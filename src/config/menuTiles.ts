export type Focal = "left" | "center" | "right";

export type MenuTile = {
  id: string; // Allow any string for admin/courier tiles
  title: string;
  subtitle?: string;
  cta: string;
  route: string;
  image: string;        // import path
  focal: Focal;         // ВОТ ЭТО решает "вишенка слева/справа"
  badgeText?: string;   // например: "NEW" / "x4"
  analyticsEvent: string;
};

// Import images - these should be placed in src/assets/menu/
// For now using placeholder images, replace with actual banner images
const catalogImg = "/assets/elfcherry/tiles/tile-catalog.jpg";
const promoImg = "/assets/elfcherry/tiles/tile-promo.jpg";
const bonusesImg = "/assets/elfcherry/tiles/tile-bonuses.jpg";
const cartImg = "/assets/elfcherry/tiles/tile-cart.jpg";
const favoritesImg = "/assets/elfcherry/tiles/tile-favorites.jpg";
const ordersImg = "/assets/elfcherry/tiles/tile-orders.jpg";
const referralImg = "/assets/elfcherry/tiles/tile-referral.jpg";
const supportImg = "/assets/elfcherry/tiles/tile-support.jpg";

export const menuTiles: MenuTile[] = [
  {
    id: "catalog",
    title: "КАТАЛОГ",
    subtitle: "все товары",
    cta: "открыть",
    route: "/catalog",
    image: catalogImg,
    focal: "center",
    analyticsEvent: "menu_catalog_click"
  },
  {
    id: "promo",
    title: "АКЦИИ И КОНКУРСЫ",
    subtitle: "скидки и подарки",
    cta: "посмотреть",
    route: "/promotions",
    image: promoImg,
    focal: "right",
    analyticsEvent: "menu_promo_click"
  },
  {
    id: "bonuses",
    title: "МОИ БОНУСЫ",
    subtitle: "кэшбек и привилегии",
    cta: "использовать",
    route: "/bonuses",
    image: bonusesImg,
    focal: "left",
    analyticsEvent: "menu_bonuses_click"
  },
  {
    id: "cart",
    title: "КОРЗИНА",
    subtitle: "ваши покупки",
    cta: "открыть",
    route: "/cart",
    image: cartImg,
    focal: "center",
    analyticsEvent: "menu_cart_click"
  },
  {
    id: "favorites",
    title: "ИЗБРАННОЕ",
    subtitle: "любимые товары",
    cta: "открыть",
    route: "/favorites",
    image: favoritesImg,
    focal: "right",
    analyticsEvent: "menu_favorites_click"
  },
  {
    id: "orders",
    title: "ИСТОРИЯ ПОКУПОК",
    subtitle: "последние заказы",
    cta: "просмотреть",
    route: "/orders",
    image: ordersImg,
    focal: "left",
    analyticsEvent: "menu_orders_click"
  },
  {
    id: "referral",
    title: "РЕФЕРАЛЬНАЯ ПРОГРАММА",
    subtitle: "пригласи друзей",
    cta: "открыть",
    route: "/referral",
    image: referralImg,
    focal: "center",
    analyticsEvent: "menu_referral_click"
  },
  {
    id: "support",
    title: "ПОДДЕРЖКА",
    subtitle: "помощь 24/7",
    cta: "связаться",
    route: "/support",
    image: supportImg,
    focal: "right",
    analyticsEvent: "menu_support_click"
  }
];

// Admin and courier tiles (shown only for respective users)
export const adminTiles: MenuTile[] = [
  {
    id: "admin",
    title: "АДМИН-ПАНЕЛЬ",
    subtitle: "заказы и курьеры",
    cta: "открыть",
    route: "/admin",
    image: "/assets/elfcherry/tiles/tile-admin.jpg",
    focal: "center",
    analyticsEvent: "menu_admin_click"
  }
];

export const courierTiles: MenuTile[] = [
  {
    id: "courier",
    title: "КУРЬЕР",
    subtitle: "мои заказы",
    cta: "открыть",
    route: "/courier",
    image: "/assets/elfcherry/tiles/tile-courier.jpg",
    focal: "center",
    analyticsEvent: "menu_courier_click"
  }
];
