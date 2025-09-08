import { GameState, Player } from '../types/game'

const CANVAS_WIDTH = 360
const CANVAS_HEIGHT = 640

export const createInitialGameState = (): GameState => {
  let screenWidth = CANVAS_WIDTH
  let screenHeight = CANVAS_HEIGHT
  
  if (typeof window !== 'undefined') {
    if (window.innerWidth <= 768) {
      screenWidth = window.innerWidth
      screenHeight = window.visualViewport?.height || window.innerHeight
    } else {
      screenWidth = 480
      screenHeight = 853
    }
  }
  
  const player: Player = {
    position: { x: screenWidth / 2 - 25, y: screenHeight - 80 },
    size: { width: 50, height: 60 },
    direction: 'left',
    speed: 5
  }

  return {
    isPlaying: false,
    isPaused: false,
    isGameOver: false,
    score: 0,
    runtime: 0,
    enemies: [],
    player
  }
}

export const GAME_CONFIG = {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  ENEMY_SPAWN_INTERVAL: 600,
  SPEED_INCREASE_INTERVAL: 10000,
  SPEED_INCREASE_RATE: 0.05,
  MIN_ENEMY_SIZE: 25,
  MAX_ENEMY_SIZE: 80,
  PLAYER_SPEED: 5
}