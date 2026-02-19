export function normalizeOrderStatus(raw) {
  const v = String(raw || '').trim().toLowerCase();
  if (!v) return 'buffer';
  if (v === 'paid') return 'pending';
  if (v === 'confirmed') return 'pending';
  if (v === 'courier_assigned') return 'assigned';
  return v;
}

export function isAllowedAdminOrderStatus(status) {
  const s = normalizeOrderStatus(status);
  return s === 'pending' || s === 'assigned' || s === 'picked_up' || s === 'delivered' || s === 'cancelled';
}

export function isAllowedCourierOrderStatus(status) {
  const s = normalizeOrderStatus(status);
  return s === 'assigned' || s === 'picked_up' || s === 'delivered' || s === 'cancelled';
}

export function isOrderStatusProgressing(current, next) {
  const c = normalizeOrderStatus(current);
  const n = normalizeOrderStatus(next);
  const rank = new Map([
    ['buffer', 0],
    ['pending', 1],
    ['assigned', 2],
    ['picked_up', 3],
    ['delivered', 4],
    ['cancelled', 99],
  ]);
  if (!rank.has(c) || !rank.has(n)) return false;
  if (c === 'cancelled') return false;
  if (c === 'delivered') return false;
  if (n === 'cancelled') return true;
  return rank.get(n) >= rank.get(c);
}

