import type { Metadata } from 'next'
import CartContainer from '@/components/cart/CartContainer'

export const metadata: Metadata = {
  title: '장바구니 - Vibe',
  description: '장바구니에서 상품을 확인하고 주문하세요',
}

export default function CartPage() {
  return <CartContainer />
}