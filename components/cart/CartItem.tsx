import { CartItem as CartItemType } from '@/types/cart'

interface CartItemProps {
  item: CartItemType
  onQuantityChange: (id: string, quantity: number) => void
  onToggleSelect: (id: string) => void
}

export default function CartItem({ item, onQuantityChange, onToggleSelect }: CartItemProps) {
  const handleQuantityChange = (delta: number) => {
    const newQuantity = item.quantity + delta
    if (newQuantity >= 1) {
      onQuantityChange(item.id, newQuantity)
    }
  }

  const formatPrice = (price: number) => {
    return price.toLocaleString('ko-KR')
  }

  return (
    <div className="flex items-center gap-4 p-4 border border-gray-200 rounded-lg bg-white">
      {/* 선택 체크박스 */}
      <input
        type="checkbox"
        checked={item.selected}
        onChange={() => onToggleSelect(item.id)}
        className="w-4 h-4 text-teal-600 border-gray-300 rounded focus:ring-teal-500"
      />

      {/* 상품 이미지 */}
      <div className="flex-shrink-0">
        <img
          src={item.thumbnail}
          alt={item.name}
          className="w-16 h-16 md:w-20 md:h-20 object-cover rounded-lg"
        />
      </div>

      {/* 상품 정보 */}
      <div className="flex-1 min-w-0">
        <h3 className="text-sm md:text-base font-medium text-gray-900 truncate">
          {item.name}
        </h3>
        <p className="text-sm md:text-base font-bold text-gray-900 mt-1">
          {formatPrice(item.price)}원
        </p>
      </div>

      {/* 수량 조절 */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => handleQuantityChange(-1)}
          disabled={item.quantity <= 1}
          className="w-8 h-8 flex items-center justify-center border border-gray-300 rounded-md bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          -
        </button>
        <span className="w-8 text-center text-sm font-medium">
          {item.quantity}
        </span>
        <button
          onClick={() => handleQuantityChange(1)}
          className="w-8 h-8 flex items-center justify-center border border-gray-300 rounded-md bg-white hover:bg-gray-50"
        >
          +
        </button>
      </div>
    </div>
  )
}