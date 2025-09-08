export interface Position {
  x: number
  y: number
}

export interface Size {
  width: number
  height: number
}

export interface GameObject {
  position: Position
  size: Size
}

export interface Player extends GameObject {
  direction: 'left' | 'right'
  speed: number
}

export interface Enemy extends GameObject {
  speed: number
  scale: number
}

export interface GameState {
  isPlaying: boolean
  isPaused: boolean
  isGameOver: boolean
  score: number
  runtime: number
  enemies: Enemy[]
  player: Player
}

export interface ScoreRecord {
  initials: string
  score: number
  date: string
}