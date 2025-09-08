import { Enemy } from '../types/game'
import { GAME_CONFIG } from './gameState'

export class EnemyManager {
  private baseSpeed: number = 2
  private lastSpawnTime: number = 0
  private gameStartTime: number = 0

  constructor() {
    this.gameStartTime = Date.now()
  }

  reset() {
    this.gameStartTime = Date.now()
    this.lastSpawnTime = 0
    this.baseSpeed = 2
  }

  shouldSpawnEnemy(currentTime: number): boolean {
    return currentTime - this.lastSpawnTime > GAME_CONFIG.ENEMY_SPAWN_INTERVAL
  }

  createEnemy(): Enemy {
    this.lastSpawnTime = Date.now()
    
    const scale = Math.random() * 0.8 + 0.3 // 0.3 to 1.1 - 더 큰 크기 차이
    const size = GAME_CONFIG.MIN_ENEMY_SIZE + (GAME_CONFIG.MAX_ENEMY_SIZE - GAME_CONFIG.MIN_ENEMY_SIZE) * scale
    
    const currentSpeed = this.getCurrentSpeed()
    const speed = currentSpeed * (2 - scale) // Smaller enemies fall faster
    
    return {
      position: {
        x: Math.random() * (GAME_CONFIG.CANVAS_WIDTH - size),
        y: -size
      },
      size: {
        width: size,
        height: size
      },
      speed,
      scale
    }
  }

  updateEnemies(enemies: Enemy[], deltaTime: number): Enemy[] {
    return enemies
      .map(enemy => ({
        ...enemy,
        position: {
          ...enemy.position,
          y: enemy.position.y + enemy.speed * (deltaTime / 16)
        }
      }))
      .filter(enemy => enemy.position.y < GAME_CONFIG.CANVAS_HEIGHT + 50)
  }

  private getCurrentSpeed(): number {
    const elapsed = Date.now() - this.gameStartTime
    const speedIncrements = Math.floor(elapsed / GAME_CONFIG.SPEED_INCREASE_INTERVAL)
    return this.baseSpeed * Math.pow(1 + GAME_CONFIG.SPEED_INCREASE_RATE, speedIncrements)
  }
}