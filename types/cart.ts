export interface CartItem {
  id: string
  name: string
  price: number
  quantity: number
  thumbnail: string
  selected: boolean
}

export interface CartState {
  items: CartItem[]
  selectedAll: boolean
}

export interface CartSummary {
  subtotal: number
  shipping: number
  total: number
}