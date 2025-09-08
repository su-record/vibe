import { GameObject } from '../types/game'

export class CollisionDetector {
  static checkCollision(obj1: GameObject, obj2: GameObject): boolean {
    // 충돌 박스를 각 객체 크기의 20% 줄여서 더 정확한 충돌 감지
    const margin1 = Math.min(obj1.size.width, obj1.size.height) * 0.2
    const margin2 = Math.min(obj2.size.width, obj2.size.height) * 0.2
    
    const obj1Left = obj1.position.x + margin1
    const obj1Right = obj1.position.x + obj1.size.width - margin1
    const obj1Top = obj1.position.y + margin1
    const obj1Bottom = obj1.position.y + obj1.size.height - margin1
    
    const obj2Left = obj2.position.x + margin2
    const obj2Right = obj2.position.x + obj2.size.width - margin2
    const obj2Top = obj2.position.y + margin2
    const obj2Bottom = obj2.position.y + obj2.size.height - margin2
    
    return (
      obj1Left < obj2Right &&
      obj1Right > obj2Left &&
      obj1Top < obj2Bottom &&
      obj1Bottom > obj2Top
    )
  }
}