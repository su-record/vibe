'use client'

import { useState, useEffect } from 'react'
import { CartItem as CartItemType, CartSummary as CartSummaryType } from '@/types/cart'
import { CartManager } from '@/lib/cart/cartManager'
import { CartStorage } from '@/lib/cart/cartStorage'
import CartItem from './CartItem'
import CartSummary from './CartSummary'

export default function CartContainer() {
  const [items, setItems] = useState<CartItemType[]>([])
  const [summary, setSummary] = useState<CartSummaryType>({ subtotal: 0, shipping: 0, total: 0 })


  useEffect(() => {
    const loadedItems = CartStorage.getItems()
    setItems(loadedItems)
  }, [])

  useEffect(() => {
    const newSummary = CartManager.calculateSummary(items)
    setSummary(newSummary)
    CartStorage.saveItems(items)
  }, [items])

  const handleQuantityChange = (id: string, quantity: number) => {
    const updatedItems = CartManager.updateQuantity(items, id, quantity)
    setItems(updatedItems)
  }

  const handleToggleSelect = (id: string) => {
    const updatedItems = CartManager.toggleSelection(items, id)
    setItems(updatedItems)
  }

  const handleToggleSelectAll = () => {
    const updatedItems = CartManager.toggleSelectAll(items)
    setItems(updatedItems)
  }

  const isAllSelected = CartManager.isAllSelected(items)

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-4xl mx-auto p-4 md:p-6">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-6">장바구니</h1>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 상품 목록 */}
          <div className="lg:col-span-2 space-y-4">
            {/* 전체 선택 */}
            <div className="flex items-center gap-2 p-4 bg-white rounded-lg border border-gray-200">
              <input
                type="checkbox"
                checked={isAllSelected}
                onChange={handleToggleSelectAll}
                className="w-4 h-4 text-teal-600 border-gray-300 rounded focus:ring-teal-500"
              />
              <label className="text-sm md:text-base font-medium text-gray-900">
                전체 선택 ({items.filter(item => item.selected).length}/{items.length})
              </label>
            </div>

            {/* 상품 아이템들 */}
            {items.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-lg">
                <p className="text-gray-500">장바구니가 비어있습니다.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {items.map((item) => (
                  <CartItem
                    key={item.id}
                    item={item}
                    onQuantityChange={handleQuantityChange}
                    onToggleSelect={handleToggleSelect}
                  />
                ))}
              </div>
            )}
          </div>

          {/* 결제 정보 */}
          <div className="lg:col-span-1">
            <div className="sticky top-4">
              <CartSummary summary={summary} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}