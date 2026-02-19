export type ProductSKU = string

export type Product = {
  sku: ProductSKU
  name: string
  category: string
  brand: string
  price: number
  stock: number
  active: boolean
}

export type CartItem = {
  id: string
  productId: ProductSKU
  quantity: number
  price: number
}

export type OrderStatus =
  | 'buffer'
  | 'pending'
  | 'assigned'
  | 'picked_up'
  | 'delivered'
  | 'cancelled'
  | 'paid'
  | 'courier_assigned'
  | 'confirmed'

export type Order = {
  order_id: string
  user_id: string
  status: OrderStatus
  total_amount: number
  created_at: string
  items_json: string
}
