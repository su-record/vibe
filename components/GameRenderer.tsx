import { GameState } from '../types/game'
import { GAME_CONFIG } from '../lib/gameState'

export default class GameRenderer {
  private ctx: CanvasRenderingContext2D
  private luffyImage: HTMLImageElement | null = null
  private akainuImage: HTMLImageElement | null = null
  private imagesLoaded: boolean = false

  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx
    this.loadImages()
  }

  private async loadImages() {
    try {
      this.luffyImage = new Image()
      this.akainuImage = new Image()
      
      const luffyPromise = new Promise((resolve, reject) => {
        this.luffyImage!.onload = resolve
        this.luffyImage!.onerror = reject
        this.luffyImage!.src = '/luffy.png'
      })
      
      const akainuPromise = new Promise((resolve, reject) => {
        this.akainuImage!.onload = resolve
        this.akainuImage!.onerror = reject
        this.akainuImage!.src = '/akainu.png'
      })

      await Promise.all([luffyPromise, akainuPromise])
      this.imagesLoaded = true
    } catch (error) {
      console.error('Failed to load images:', error)
      this.imagesLoaded = false
    }
  }

  render(gameState: GameState) {
    this.clearCanvas()
    
    if (!this.imagesLoaded) {
      this.renderLoadingState()
      return
    }

    this.renderUI(gameState)
    this.renderPlayer(gameState.player)
    this.renderEnemies(gameState.enemies)
  }

  private clearCanvas() {
    this.ctx.fillStyle = '#001122'
    this.ctx.fillRect(0, 0, GAME_CONFIG.CANVAS_WIDTH, GAME_CONFIG.CANVAS_HEIGHT)
  }

  private renderUI(gameState: GameState) {
    this.ctx.fillStyle = '#fff'
    this.ctx.font = '20px Arial'
    this.ctx.textAlign = 'left'
    
    // Runtime
    const seconds = Math.floor(gameState.runtime / 1000)
    this.ctx.fillText(`시간: ${seconds}초`, 10, 30)
    
    // Score
    this.ctx.fillText(`점수: ${gameState.score}`, 10, 60)
  }

  private renderPlayer(player: GameState['player']) {
    if (!this.luffyImage) {
      this.ctx.fillStyle = '#4ecdc4'
      this.ctx.fillRect(
        player.position.x,
        player.position.y,
        player.size.width,
        player.size.height
      )
      return
    }

    this.ctx.save()
    
    if (player.direction === 'right') {
      this.ctx.scale(-1, 1)
      this.ctx.drawImage(
        this.luffyImage,
        -(player.position.x + player.size.width),
        player.position.y,
        player.size.width,
        player.size.height
      )
    } else {
      this.ctx.drawImage(
        this.luffyImage,
        player.position.x,
        player.position.y,
        player.size.width,
        player.size.height
      )
    }
    
    this.ctx.restore()
  }

  private renderEnemies(enemies: GameState['enemies']) {
    enemies.forEach(enemy => {
      if (!this.akainuImage) {
        this.ctx.fillStyle = '#ff6b6b'
        this.ctx.fillRect(
          enemy.position.x,
          enemy.position.y,
          enemy.size.width,
          enemy.size.height
        )
        return
      }

      this.ctx.drawImage(
        this.akainuImage,
        enemy.position.x,
        enemy.position.y,
        enemy.size.width,
        enemy.size.height
      )
    })
  }

  private renderLoadingState() {
    this.ctx.fillStyle = '#666'
    this.ctx.font = '16px Arial'
    this.ctx.textAlign = 'center'
    this.ctx.fillText(
      'Loading images...',
      GAME_CONFIG.CANVAS_WIDTH / 2,
      GAME_CONFIG.CANVAS_HEIGHT - 50
    )
  }
}