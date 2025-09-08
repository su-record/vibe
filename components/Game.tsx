'use client'

import { useEffect, useRef, useState } from 'react'
import GameRenderer from './GameRenderer'
import GameLoop from './GameLoop'
import { createInitialGameState } from '../lib/gameState'
import { InputHandler } from '../lib/inputHandler'
import { EnemyManager } from '../lib/enemyManager'
import { CollisionDetector } from '../lib/collisionDetector'
import { ScoreManager } from '../lib/scoreManager'
import { GameState } from '../types/game'
import { GAME_CONFIG } from '../lib/gameState'

export default function Game() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [gameState, setGameState] = useState<GameState>(createInitialGameState())
  const [showInitials, setShowInitials] = useState(false)
  const [initials, setInitials] = useState('')
  
  const inputHandlerRef = useRef<InputHandler>(new InputHandler())
  const enemyManagerRef = useRef<EnemyManager>(new EnemyManager())
  const gameLoopRef = useRef<GameLoop | null>(null)
  const rendererRef = useRef<GameRenderer | null>(null)
  const gameStartTimeRef = useRef<number>(0)
  const lastUpdateTimeRef = useRef<number>(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // 화면 크기에 맞게 캔버스 크기 설정
    const resizeCanvas = () => {
      if (window.innerWidth <= 768) {
        // 모바일: 전체 화면
        canvas.width = window.innerWidth
        canvas.height = window.innerHeight
        canvas.style.width = '100vw'
        canvas.style.height = '100vh'
      } else {
        // PC: 480px 너비, 9:16 비율
        canvas.width = 480
        canvas.height = 853 // 480 * 16/9
        canvas.style.width = '480px'
        canvas.style.height = '853px'
      }
    }
    
    resizeCanvas()
    window.addEventListener('resize', resizeCanvas)

    rendererRef.current = new GameRenderer(ctx)
    inputHandlerRef.current.init(canvas)

    return () => {
      window.removeEventListener('resize', resizeCanvas)
      inputHandlerRef.current.cleanup()
      if (gameLoopRef.current) {
        gameLoopRef.current.stop()
      }
    }
  }, [])

  useEffect(() => {
    if (rendererRef.current) {
      rendererRef.current.render(gameState)
    }
  }, [gameState])

  const updateGame = (deltaTime: number) => {
    if (!gameState.isPlaying || gameState.isPaused || gameState.isGameOver) {
      return
    }

    const currentTime = Date.now()
    const runtime = currentTime - gameStartTimeRef.current

    setGameState(prevState => {
      const newState = { ...prevState }
      
      // Update runtime
      newState.runtime = runtime

      // Handle player movement
      const touchPosition = inputHandlerRef.current.getTouchPosition()
      if (touchPosition !== null) {
        // 터치/드래그로 직접 위치 설정
        const previousX = newState.player.position.x + newState.player.size.width / 2
        const playerCenterX = touchPosition - newState.player.size.width / 2
        const canvas = canvasRef.current
        const canvasWidth = canvas ? canvas.width : (window.innerWidth <= 768 ? window.innerWidth : 480)
        const newX = Math.max(0, Math.min(
          canvasWidth - newState.player.size.width,
          playerCenterX
        ))
        
        // 이전 위치와 새 위치를 비교하여 방향 결정
        const newCenterX = newX + newState.player.size.width / 2
        if (Math.abs(newCenterX - previousX) > 1) {
          if (newCenterX > previousX) {
            newState.player.direction = 'right'
          } else if (newCenterX < previousX) {
            newState.player.direction = 'left'
          }
        }
        
        newState.player.position.x = newX
      } else {
        // 키보드 입력 처리
        const direction = inputHandlerRef.current.getMovementDirection()
        if (direction) {
          const speed = GAME_CONFIG.PLAYER_SPEED * (deltaTime / 16)
          if (direction === 'left') {
            newState.player.position.x = Math.max(0, newState.player.position.x - speed)
            newState.player.direction = 'left'
          } else {
            const canvas = canvasRef.current
        const canvasWidth = canvas ? canvas.width : (window.innerWidth <= 768 ? window.innerWidth : 480)
            newState.player.position.x = Math.min(
              canvasWidth - newState.player.size.width,
              newState.player.position.x + speed
            )
            newState.player.direction = 'right'
          }
        }
      }

      // Spawn enemies
      if (enemyManagerRef.current.shouldSpawnEnemy(currentTime)) {
        const newEnemy = enemyManagerRef.current.createEnemy()
        newState.enemies.push(newEnemy)
      }

      // Update enemies
      newState.enemies = enemyManagerRef.current.updateEnemies(newState.enemies, deltaTime)

      // Update score based on enemies that fell off screen
      const previousEnemyCount = prevState.enemies.length
      const currentEnemyCount = newState.enemies.length
      const enemiesFellOff = previousEnemyCount - currentEnemyCount
      if (enemiesFellOff > 0) {
        newState.score += enemiesFellOff
      }

      // Check collisions
      for (const enemy of newState.enemies) {
        if (CollisionDetector.checkCollision(newState.player, enemy)) {
          endGame(newState)
          break
        }
      }

      return newState
    })
  }

  const startGame = () => {
    gameStartTimeRef.current = Date.now()
    enemyManagerRef.current.reset()
    
    const newGameState = {
      ...createInitialGameState(),
      isPlaying: true
    }
    
    setGameState(newGameState)

    if (gameLoopRef.current) {
      gameLoopRef.current.stop()
    }

    gameLoopRef.current = new GameLoop((deltaTime) => {
      setGameState(currentState => {
        if (!currentState.isPlaying || currentState.isPaused || currentState.isGameOver) {
          return currentState
        }

        const currentTime = Date.now()
        const runtime = currentTime - gameStartTimeRef.current

        const newState = { ...currentState }
        
        // Update runtime
        newState.runtime = runtime

        // Handle player movement
        const touchPosition = inputHandlerRef.current.getTouchPosition()
        if (touchPosition !== null) {
          // 터치/드래그로 직접 위치 설정
          const previousX = newState.player.position.x + newState.player.size.width / 2
          const playerCenterX = touchPosition - newState.player.size.width / 2
          const canvas = canvasRef.current
        const canvasWidth = canvas ? canvas.width : (window.innerWidth <= 768 ? window.innerWidth : 480)
        const newX = Math.max(0, Math.min(
            canvasWidth - newState.player.size.width,
            playerCenterX
          ))
          
          // 이전 위치와 새 위치를 비교하여 방향 결정
          const newCenterX = newX + newState.player.size.width / 2
          if (Math.abs(newCenterX - previousX) > 1) {
            if (newCenterX > previousX) {
              newState.player.direction = 'right'
            } else if (newCenterX < previousX) {
              newState.player.direction = 'left'
            }
          }
          
          newState.player.position.x = newX
        } else {
          // 키보드 입력 처리
          const direction = inputHandlerRef.current.getMovementDirection()
          if (direction) {
            const speed = GAME_CONFIG.PLAYER_SPEED * (deltaTime / 16)
            if (direction === 'left') {
              newState.player.position.x = Math.max(0, newState.player.position.x - speed)
              newState.player.direction = 'left'
            } else {
              const canvas = canvasRef.current
        const canvasWidth = canvas ? canvas.width : (window.innerWidth <= 768 ? window.innerWidth : 480)
              newState.player.position.x = Math.min(
                canvasWidth - newState.player.size.width,
                newState.player.position.x + speed
              )
              newState.player.direction = 'right'
            }
          }
        }

        // Spawn enemies
        if (enemyManagerRef.current.shouldSpawnEnemy(currentTime)) {
          const newEnemy = enemyManagerRef.current.createEnemy()
          newState.enemies.push(newEnemy)
        }

        // Update enemies
        newState.enemies = enemyManagerRef.current.updateEnemies(newState.enemies, deltaTime)

        // Update score based on enemies that fell off screen
        const previousEnemyCount = currentState.enemies.length
        const currentEnemyCount = newState.enemies.length
        const enemiesFellOff = previousEnemyCount - currentEnemyCount
        if (enemiesFellOff > 0) {
          newState.score += enemiesFellOff
        }

        // Check collisions
        for (const enemy of newState.enemies) {
          if (CollisionDetector.checkCollision(newState.player, enemy)) {
            const finalScore = ScoreManager.calculateFinalScore(newState.runtime, newState.score)
            
            const gameOverState = {
              ...newState,
              isGameOver: true,
              isPlaying: false
            }

            gameLoopRef.current?.stop()

            if (ScoreManager.isTopScore(finalScore)) {
              setShowInitials(true)
            }

            return gameOverState
          }
        }

        return newState
      })
    })
    
    gameLoopRef.current.start()
  }

  const endGame = (currentState: GameState) => {
    const finalScore = ScoreManager.calculateFinalScore(currentState.runtime, currentState.score)
    
    setGameState(prevState => ({
      ...prevState,
      isGameOver: true,
      isPlaying: false
    }))

    if (gameLoopRef.current) {
      gameLoopRef.current.stop()
    }

    if (ScoreManager.isTopScore(finalScore)) {
      setShowInitials(true)
    }
  }

  const handleInitialsSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (initials.length >= 2) {
      const finalScore = ScoreManager.calculateFinalScore(gameState.runtime, gameState.score)
      ScoreManager.saveScore(initials.toUpperCase(), finalScore)
      setShowInitials(false)
      setInitials('')
    }
  }

  const resetGame = () => {
    setGameState(createInitialGameState())
    setShowInitials(false)
    setInitials('')
  }

  return (
    <div className="game-container">
      <div className="relative w-full h-full flex items-center justify-center">
        <canvas
          ref={canvasRef}
          className="game-canvas"
        />
        
        {!gameState.isPlaying && !gameState.isGameOver && (
          <div className="game-overlay">
            <div className="game-modal">
              <div className="text-2xl mb-6">루피의 아카이누 주먹 피하기</div>
              <button
                onClick={startGame}
                className="game-button game-button-primary"
              >
                게임 시작
              </button>
            </div>
          </div>
        )}

        {gameState.isGameOver && !showInitials && (
          <div className="game-overlay">
            <div className="game-modal">
              <div className="mb-4 text-xl font-bold">🏆 TOP 10 랭킹 🏆</div>
              <div className="max-h-60 overflow-y-auto mb-4">
                {ScoreManager.getTopScores().length === 0 ? (
                  <div className="text-gray-400 py-8">아직 기록이 없습니다.</div>
                ) : (
                  <div className="space-y-2">
                    {ScoreManager.getTopScores().map((record, index) => (
                      <div
                        key={index}
                        className={`flex justify-between items-center p-2 rounded-lg text-sm ${
                          index < 3 
                            ? 'bg-gradient-to-r from-yellow-600/20 to-orange-600/20 border border-yellow-500/30' 
                            : 'bg-gray-800/50'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className={`text-base font-bold ${
                            index === 0 ? 'text-yellow-400' :
                            index === 1 ? 'text-gray-300' :
                            index === 2 ? 'text-orange-400' :
                            'text-gray-400'
                          }`}>
                            #{index + 1}
                          </span>
                          <span className="font-semibold text-white">{record.initials}</span>
                        </div>
                        <div className="text-right">
                          <div className="text-base font-bold text-teal-400">
                            {record.score.toLocaleString()}점
                          </div>
                          <div className="text-xs text-gray-400">
                            {new Date(record.date).toLocaleDateString('ko-KR')}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              {/* 내 점수와 다시 시작 버튼 */}
              <div className="bg-gray-800/70 p-3 rounded-lg border border-gray-600">
                <div className="text-center mb-3">
                  <div className="text-sm text-gray-400">내 점수</div>
                  <div className="text-lg font-bold text-teal-400">
                    {ScoreManager.calculateFinalScore(gameState.runtime, gameState.score).toLocaleString()}점
                  </div>
                  <div className="text-xs text-gray-400">
                    시간: {Math.floor(gameState.runtime / 1000)}초 | 피한 주먹: {gameState.score}개
                  </div>
                </div>
                <button
                  onClick={resetGame}
                  className="game-button game-button-secondary w-full"
                >
                  다시 시작
                </button>
              </div>
            </div>
          </div>
        )}

        {showInitials && (
          <div className="game-overlay">
            <div className="game-modal">
              <div className="mb-6 text-2xl">
                🎉 TOP 10 진입! 🎉
              </div>
            <form onSubmit={handleInitialsSubmit}>
              <input
                type="text"
                value={initials}
                onChange={(e) => setInitials(e.target.value.slice(0, 3))}
                placeholder="이니셜 입력"
                className="w-full p-3 mb-4 text-center uppercase bg-gray-800 text-white border-2 border-gray-600 rounded-lg focus:outline-none focus:border-teal-400"
                autoFocus
              />
              <button
                type="submit"
                disabled={initials.length < 2}
                className={`game-button ${
                  initials.length >= 2 
                    ? 'game-button-primary' 
                    : 'bg-gray-600 cursor-not-allowed'
                }`}
              >
                저장
              </button>
            </form>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}