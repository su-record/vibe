export default class GameLoop {
  private isRunning: boolean = false
  private lastTime: number = 0
  private animationId: number | null = null
  private updateCallback: (deltaTime: number) => void

  constructor(updateCallback: (deltaTime: number) => void) {
    this.updateCallback = updateCallback
    this.gameLoop = this.gameLoop.bind(this)
  }

  start() {
    if (this.isRunning) return
    
    this.isRunning = true
    this.lastTime = performance.now()
    this.animationId = requestAnimationFrame(this.gameLoop)
  }

  stop() {
    this.isRunning = false
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId)
      this.animationId = null
    }
  }

  private gameLoop(currentTime: number) {
    if (!this.isRunning) return

    const deltaTime = currentTime - this.lastTime
    this.lastTime = currentTime

    this.updateCallback(deltaTime)

    this.animationId = requestAnimationFrame(this.gameLoop)
  }
}