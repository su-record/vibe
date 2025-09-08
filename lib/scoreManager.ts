import { ScoreRecord } from '../types/game'

export class ScoreManager {
  private static readonly STORAGE_KEY = 'luffy_game_scores'

  static calculateFinalScore(runtime: number, enemiesAvoided: number): number {
    const timeScore = Math.floor(runtime / 1000) * 10 // 10 points per second
    const avoidScore = enemiesAvoided * 50 // 50 points per avoided enemy
    return timeScore + avoidScore
  }

  static getTopScores(): ScoreRecord[] {
    if (typeof window === 'undefined') return []
    
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY)
      return stored ? JSON.parse(stored) : []
    } catch {
      return []
    }
  }

  static saveScore(initials: string, score: number): boolean {
    if (typeof window === 'undefined') return false
    
    try {
      const scores = this.getTopScores()
      const newRecord: ScoreRecord = {
        initials,
        score,
        date: new Date().toISOString()
      }
      
      scores.push(newRecord)
      scores.sort((a, b) => b.score - a.score)
      const top10 = scores.slice(0, 10)
      
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(top10))
      return true
    } catch {
      return false
    }
  }

  static isTopScore(score: number): boolean {
    const scores = this.getTopScores()
    return scores.length < 10 || score > scores[scores.length - 1].score
  }
}