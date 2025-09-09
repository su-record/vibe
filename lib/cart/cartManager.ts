import { CartItem, CartSummary } from '@/types/cart'

const SHIPPING_THRESHOLD = 50000
const SHIPPING_FEE = 3000

export class CartManager {
  static calculateSummary(items: CartItem[]): CartSummary {
    const selectedItems = items.filter(item => item.selected)
    const subtotal = selectedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0)
    const shipping = subtotal > 0 && subtotal < SHIPPING_THRESHOLD ? SHIPPING_FEE : 0
    const total = subtotal + shipping

    return { subtotal, shipping, total }
  }

  static updateQuantity(items: CartItem[], id: string, quantity: number): CartItem[] {
    if (quantity < 1) return items
    
    return items.map(item => 
      item.id === id ? { ...item, quantity } : item
    )
  }

  static toggleSelection(items: CartItem[], id: string): CartItem[] {
    return items.map(item => 
      item.id === id ? { ...item, selected: !item.selected } : item
    )
  }

  static toggleSelectAll(items: CartItem[]): CartItem[] {
    const allSelected = items.every(item => item.selected)
    return items.map(item => ({ ...item, selected: !allSelected }))
  }

  static isAllSelected(items: CartItem[]): boolean {
    return items.length > 0 && items.every(item => item.selected)
  }
}