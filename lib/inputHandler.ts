export class InputHandler {
  private keys: Set<string> = new Set()
  private touchStartX: number = 0
  private touchCurrentX: number = 0
  private isDragging: boolean = false
  private canvas: HTMLCanvasElement | null = null

  constructor() {
    this.handleKeyDown = this.handleKeyDown.bind(this)
    this.handleKeyUp = this.handleKeyUp.bind(this)
    this.handleTouchStart = this.handleTouchStart.bind(this)
    this.handleTouchMove = this.handleTouchMove.bind(this)
    this.handleTouchEnd = this.handleTouchEnd.bind(this)
    this.handleMouseDown = this.handleMouseDown.bind(this)
    this.handleMouseMove = this.handleMouseMove.bind(this)
    this.handleMouseUp = this.handleMouseUp.bind(this)
  }

  init(canvas?: HTMLCanvasElement) {
    if (canvas) this.canvas = canvas
    document.addEventListener('keydown', this.handleKeyDown)
    document.addEventListener('keyup', this.handleKeyUp)
    if (this.canvas) {
      // 터치 이벤트
      this.canvas.addEventListener('touchstart', this.handleTouchStart, { passive: false })
      this.canvas.addEventListener('touchmove', this.handleTouchMove, { passive: false })
      this.canvas.addEventListener('touchend', this.handleTouchEnd)
      
      // 마우스 이벤트 (모바일 사이즈에서도 마우스 드래그 지원)
      this.canvas.addEventListener('mousedown', this.handleMouseDown)
      this.canvas.addEventListener('mousemove', this.handleMouseMove)
      this.canvas.addEventListener('mouseup', this.handleMouseUp)
      this.canvas.addEventListener('mouseleave', this.handleMouseUp) // 캔버스 밖으로 나갈 때
    }
  }

  cleanup() {
    document.removeEventListener('keydown', this.handleKeyDown)
    document.removeEventListener('keyup', this.handleKeyUp)
    if (this.canvas) {
      this.canvas.removeEventListener('touchstart', this.handleTouchStart)
      this.canvas.removeEventListener('touchmove', this.handleTouchMove)
      this.canvas.removeEventListener('touchend', this.handleTouchEnd)
      this.canvas.removeEventListener('mousedown', this.handleMouseDown)
      this.canvas.removeEventListener('mousemove', this.handleMouseMove)
      this.canvas.removeEventListener('mouseup', this.handleMouseUp)
      this.canvas.removeEventListener('mouseleave', this.handleMouseUp)
    }
  }

  private handleKeyDown(e: KeyboardEvent) {
    this.keys.add(e.key)
  }

  private handleKeyUp(e: KeyboardEvent) {
    this.keys.delete(e.key)
  }

  private handleTouchStart(e: TouchEvent) {
    e.preventDefault()
    if (!this.canvas) return
    const touch = e.touches[0]
    const rect = this.canvas.getBoundingClientRect()
    this.touchStartX = (touch.clientX - rect.left) * (this.canvas.width / rect.width)
    this.touchCurrentX = this.touchStartX
    this.isDragging = true
  }

  private handleTouchMove(e: TouchEvent) {
    e.preventDefault()
    if (!this.isDragging || !this.canvas) return
    const touch = e.touches[0]
    const rect = this.canvas.getBoundingClientRect()
    this.touchCurrentX = (touch.clientX - rect.left) * (this.canvas.width / rect.width)
  }

  private handleTouchEnd(e: TouchEvent) {
    e.preventDefault()
    this.isDragging = false
  }

  private handleMouseDown(e: MouseEvent) {
    e.preventDefault()
    if (!this.canvas) return
    const rect = this.canvas.getBoundingClientRect()
    this.touchStartX = (e.clientX - rect.left) * (this.canvas.width / rect.width)
    this.touchCurrentX = this.touchStartX
    this.isDragging = true
  }

  private handleMouseMove(e: MouseEvent) {
    e.preventDefault()
    if (!this.isDragging || !this.canvas) return
    const rect = this.canvas.getBoundingClientRect()
    this.touchCurrentX = (e.clientX - rect.left) * (this.canvas.width / rect.width)
  }

  private handleMouseUp(e: MouseEvent) {
    e.preventDefault()
    this.isDragging = false
  }

  getMovementDirection(): 'left' | 'right' | null {
    if (this.keys.has('ArrowLeft')) return 'left'
    if (this.keys.has('ArrowRight')) return 'right'
    
    if (this.isDragging) {
      const diff = this.touchCurrentX - this.touchStartX
      if (Math.abs(diff) > 5) {
        return diff < 0 ? 'left' : 'right'
      }
    }
    
    return null
  }

  getTouchPosition(): number | null {
    return this.isDragging ? this.touchCurrentX : null
  }

  isSpacePressed(): boolean {
    return this.keys.has(' ')
  }
}