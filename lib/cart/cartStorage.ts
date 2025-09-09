import { CartItem } from '@/types/cart'

const STORAGE_KEY = 'cart-items'

export class CartStorage {
  static getItems(): CartItem[] {
    if (typeof window === 'undefined') return []
    
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (!stored) {
        const dummyData = this.initializeDummyData()
        this.saveItems(dummyData)
        return dummyData
      }
      return JSON.parse(stored)
    } catch {
      const dummyData = this.initializeDummyData()
      this.saveItems(dummyData)
      return dummyData
    }
  }

  static saveItems(items: CartItem[]): void {
    if (typeof window === 'undefined') return
    
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
    } catch (error) {
      console.error('Failed to save cart items:', error)
    }
  }

  static initializeDummyData(): CartItem[] {
    return [
      {
        id: '1',
        name: '무선 블루투스 헤드폰',
        price: 89000,
        quantity: 1,
        thumbnail: 'https://images.unsplash.com/photo-1484704849700-f032a568e944?w=200&h=200&fit=crop',
        selected: true
      },
      {
        id: '2',
        name: '스마트워치',
        price: 199000,
        quantity: 2,
        thumbnail: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=200&h=200&fit=crop',
        selected: true
      },
      {
        id: '3',
        name: 'USB-C 충전 케이블',
        price: 15000,
        quantity: 3,
        thumbnail: 'https://images.unsplash.com/photo-1518717758536-85ae29035b6d?w=200&h=200&fit=crop',
        selected: false
      },
      {
        id: '4',
        name: '무선 마우스',
        price: 45000,
        quantity: 1,
        thumbnail: 'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=200&h=200&fit=crop',
        selected: true
      },
      {
        id: '5',
        name: '휴대용 보조배터리',
        price: 35000,
        quantity: 1,
        thumbnail: 'https://images.unsplash.com/photo-1609091839311-d5365f9ff1c5?w=200&h=200&fit=crop',
        selected: true
      }
    ]
  }
}