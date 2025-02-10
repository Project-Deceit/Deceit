import { GameState, AgentListItem } from '../types'
import { StorageService } from './storage'

/**
 * 合约服务类
 * 负责处理链上只读查询和管理员特权操作
 */
export class ContractService {
    /** 存储服务实例 */
    private storageService: StorageService

    constructor() {
        this.storageService = new StorageService()
    }

    // =================== 链上只读查询 ===================

    /**
     * 获取所有Agent列表
     * @returns {Promise<AgentListItem[]>} Agent列表
     */
    async getAgentList(): Promise<AgentListItem[]> {
        return this.storageService.getAllAgents()
    }

    /**
     * 根据ID获取指定Agent
     * @param {string} agentId Agent的唯一标识
     * @returns {Promise<AgentListItem | null>} Agent信息，不存在时返回null
     */
    async getAgentById(agentId: string): Promise<AgentListItem | null> {
        return this.storageService.getAgent(agentId)
    }

    /**
     * 获取游戏状态
     * @param {string} gameId 游戏ID
     * @returns {Promise<GameState | null>} 游戏状态，不存在时返回null
     */
    async getGame(gameId: string): Promise<GameState | null> {
        return this.storageService.getGame(gameId)
    }

    // =================== 管理员特权操作 ===================

    /**
     * 结算游戏（管理员特权操作）
     * @param {string} gameId 游戏ID
     * @param {string[]} winners 获胜者ID列表
     * @description 更新游戏状态为结束，记录获胜者，并更新玩家分数
     */
    async concludeGame(gameId: string, winners: string[]): Promise<void> {
        const game = await this.storageService.getGame(gameId)
        if (game) {
            // 更新游戏状态
            game.status = 'finished'
            game.endGameData = {
                winnerRole: 'spy',
                winners: game.players.filter(p => winners.includes(p.agentId || '')),
                scores: []
            }
            await this.storageService.saveGame(game)

            // 更新获胜者分数（管理员特权操作）
            for (const winner of winners) {
                const agent = await this.storageService.getAgent(winner)
                if (agent) {
                    const updatedAgent: AgentListItem = {
                        ...agent,
                        score: agent.score + 10,
                        gameCount: agent.gameCount + 1,
                        winCount: agent.winCount + 1
                    }
                    await this.storageService.saveAgent(updatedAgent)
                }
            }
        }
    }

    // =================== 链上数据模拟 ===================

    /**
     * 初始化测试数据
     * @description 模拟链上已经存在的Agent数据
     */
    async initTestData(): Promise<void> {
        await this.storageService.initTestData()
    }
} 