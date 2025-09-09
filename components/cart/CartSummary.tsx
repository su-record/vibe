import { useState } from 'react'
import { CartSummary as CartSummaryType } from '@/types/cart'

interface CartSummaryProps {
  summary: CartSummaryType
}

export default function CartSummary({ summary }: CartSummaryProps) {
  const [isLoading, setIsLoading] = useState(false)
  const formatPrice = (price: number) => {
    return price.toLocaleString('ko-KR')
  }

  const handleOrder = async () => {
    if (summary.total === 0 || isLoading) return
    
    setIsLoading(true)
    
    // 3초 후 로딩 해제
    setTimeout(() => {
      setIsLoading(false)
    }, 3000)
  }

  return (
    <div className="bg-gray-50 p-4 md:p-6 rounded-lg">
      <h2 className="text-lg font-bold text-gray-900 mb-4">결제 정보</h2>
      
      <div className="space-y-2">
        <div className="flex justify-between text-sm md:text-base">
          <span className="text-gray-600">상품 금액</span>
          <span className="font-medium">{formatPrice(summary.subtotal)}원</span>
        </div>
        
        <div className="flex justify-between text-sm md:text-base">
          <span className="text-gray-600">배송비</span>
          <span className="font-medium">
            {summary.shipping === 0 ? '무료' : `${formatPrice(summary.shipping)}원`}
          </span>
        </div>
        
        {summary.subtotal > 0 && summary.subtotal < 50000 && (
          <p className="text-xs md:text-sm text-orange-600 mt-1">
            50,000원 이상 주문시 배송비 무료
          </p>
        )}
        
        <hr className="my-3" />
        
        <div className="flex justify-between text-lg md:text-xl font-bold">
          <span>총 결제금액</span>
          <span className="text-teal-600">{formatPrice(summary.total)}원</span>
        </div>
      </div>
      
      <button 
        onClick={handleOrder}
        className="w-full mt-6 bg-teal-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        disabled={summary.total === 0 || isLoading}
      >
        {isLoading ? (
          <>
            <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
            <span>주문 중...</span>
          </>
        ) : (
          '주문하기'
        )}
      </button>
    </div>
  )
}