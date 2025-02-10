import { GameState, RoomView, GameEvent, AgentGameStatus, AgentGameStateStore, AgentListItem, MatchingQueueInfo } from '../types'
import { ContractService } from './contract'
import { StorageService } from './storage'
import { v4 as uuidv4 } from 'uuid'

export class GameService {
    private static instance: GameService | null = null;
    private contractService: ContractService
    private storageService: StorageService
    
    // 所有全局状态改为static
    private static gameStates: AgentGameStateStore = {}
    private static isProcessingMatch = false
    private static processingMatchStartTime: number | null = null
    
    // 常量配置
    private static readonly TIMEOUTS = {
        LOCK: 30000,      // 锁超时时间
        MATCH: 30000,     // 匹配超时时间
        MAX_WAIT: 10000   // 最大等待时间
    } as const

    private static readonly GAME_CONFIG = {
        PLAYERS_PER_ROOM: 6,      // 每个房间的玩家数
        MIN_PLAYERS_TO_START: 3,  // 开始游戏的最小玩家数
        SCORE_RANGE: 50,          // 匹配分数范围
        SPY_RATIO: 1/3            // 卧底比例
    } as const

    private static readonly MOCK_NAMES = [
        'Alex', 'Bob', 'Charlie', 'David', 'Emma', 'Frank', 
        'George', 'Henry', 'Ivy', 'Jack', 'Kate', 'Leo', 
        'Mike', 'Nancy', 'Oliver', 'Peter'
    ] as const

    private static readonly STATE_TRANSITIONS: Record<AgentGameStatus, AgentGameStatus[]> = {
        'idle': ['in_matching_queue'],
        'in_matching_queue': ['idle', 'inGame'],
        'inGame': ['idle']
    } as const

    private static checkInterval: NodeJS.Timeout | null = null;

    private constructor() {
        this.contractService = new ContractService()
        this.storageService = new StorageService()
        this.initializeService().catch(error => {
            console.error('[Service] Initialization failed:', error)
        })
    }

    public static getInstance(): GameService {
        if (!GameService.instance) {
            GameService.instance = new GameService()
        }
        return GameService.instance
    }

    // 初始化服务
    private async initializeService(): Promise<void> {
        try {
            // 清理所有匹配队列中的记录
            await this.storageService.clearMatchingQueue()
            // 重置所有Agent状态为idle
            await this.storageService.resetAllAgentStatus()
            // 启动匹配服务
            this.startMatchingService()
            console.log('[Service] Initialization completed')
        } catch (error) {
            console.error('[Service] Initialization failed:', error)
            throw error
        }
    }

    // 启动匹配服务
    private startMatchingService(): void {
        if (!GameService.checkInterval) {
            GameService.checkInterval = setInterval(() => this.checkAndMatchPlayers(), 5000)
            console.log('[Service] Matching service started')
        }
    }

    // 停止匹配服务
    public stopMatchingService(): void {
        if (GameService.checkInterval) {
            clearInterval(GameService.checkInterval)
            GameService.checkInterval = null
            console.log('[Service] Matching service stopped')
        }
    }

    // 为房间生成随机名字列表
    private static getRandomMockNames(count: number): string[] {
        if (count > GameService.MOCK_NAMES.length) {
            throw new Error(`Requested name count (${count}) exceeds available names (${GameService.MOCK_NAMES.length})`);
        }

        // 复制一份名字数组
        const availableNames = [...GameService.MOCK_NAMES];
        const selectedNames: string[] = [];

        // Fisher-Yates 洗牌算法
        for (let i = 0; i < count; i++) {
            const remainingCount = availableNames.length - i;
            const array = new Uint32Array(1);
            crypto.getRandomValues(array);
            const randomIndex = array[0] % remainingCount;
            
            // 交换并选择名字
            [availableNames[i], availableNames[i + randomIndex]] = 
                [availableNames[i + randomIndex], availableNames[i]];
            selectedNames.push(availableNames[i]);
        }

        return selectedNames;
    }

    // 获取Agent状态
    private static async getAgentState(agentId: string) {
        if (!GameService.gameStates[agentId]) {
            GameService.gameStates[agentId] = {
                status: 'idle',
                roomId: null,
                lastUpdateTime: Date.now()
            };
        }
        return { ...GameService.gameStates[agentId] }; // 返回副本
    }

    // 更新Agent状态
    private static async updateAgentState(agentId: string, state: Partial<{ status: AgentGameStatus; roomId: string | null }>) {
        const currentState = await GameService.getAgentState(agentId);
        
        // 状态转换验证
        if (state.status && !GameService.STATE_TRANSITIONS[currentState.status].includes(state.status)) {
            throw new Error(`Invalid state transition: ${currentState.status} -> ${state.status}`);
        }
        
        const newState = {
            ...currentState,
            ...state,
            lastUpdateTime: Date.now()
        };
        
        GameService.gameStates[agentId] = newState;
    }

    // 统一错误处理
    private static async handleServiceError(operation: string, error: unknown): Promise<void> {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        const errorStack = error instanceof Error ? error.stack : ''
        const errorTime = new Date().toISOString()
        
        // 构建结构化的错误日志
        const errorLog = {
            operation,
            error: {
                message: errorMessage,
                stack: errorStack || '',
                time: errorTime
            },
            context: {
                isProcessingMatch: GameService.isProcessingMatch || false,
                processingMatchStartTime: GameService.processingMatchStartTime || null
            }
        }
        
        console.error('[Error]', JSON.stringify(errorLog, null, 2))
        
        // 确保重置处理状态
        GameService.isProcessingMatch = false
        GameService.processingMatchStartTime = null
        
        throw error instanceof Error ? error : new Error(errorMessage)
    }

    // 开始匹配
    async startMatching(agentId: string): Promise<void> {
        try {
            // 1. 先检查 agent 是否存在
            const agent = await this.contractService.getAgentById(agentId)
            if (!agent) {
                throw new Error('Agent not found')
            }

            // 2. 再检查状态
            const currentState = await GameService.getAgentState(agentId)
            if (currentState.status !== 'idle') {
                throw new Error(`Agent's current status (${currentState.status}) does not allow matching`)
            }

            // 3. 更新状态并加入匹配队列
            await this.startMatchingTransaction(agent)
        } catch (error) {
            await GameService.handleServiceError('Start matching', error)
        }
    }

    // 开始匹配事务
    private async startMatchingTransaction(agent: AgentListItem): Promise<void> {
        try {
            // 1. 更新内存状态为匹配队列中
            await GameService.updateAgentState(agent.agentId, { status: 'in_matching_queue' })
            
            // 2. 加入匹配队列
            await this.storageService.addToMatching(agent.agentId, agent.score || 0)
        } catch (error) {
            // 如果任何步骤失败,回滚所有更改
            await GameService.updateAgentState(agent.agentId, { status: 'idle' })
            await this.storageService.removeFromMatching(agent.agentId).catch(e => {
                console.error('回滚移除匹配队列失败:', e)
            })
            throw error
        }
    }

    // 取消匹配
    async cancelMatching(agentId: string): Promise<void> {
        const currentState = await GameService.getAgentState(agentId)
        if (currentState.status !== 'in_matching_queue') {
            throw new Error(`Agent's current status (${currentState.status}) does not allow canceling match`)
        }

        try {
            // 从匹配队列中移除
            await this.storageService.removeFromMatching(agentId)
            
            // 更新内存状态为空闲
            await GameService.updateAgentState(agentId, { status: 'idle', roomId: null })
        } catch (error) {
            console.error(`[Match] Failed to cancel matching for Agent ${agentId}:`, error)
            throw error
        }
    }

    // 检查匹配状态
    async checkMatchStatus(agentId: string): Promise<{ gameStatus: AgentGameStatus, roomId: string | null }> {
        const state = await GameService.getAgentState(agentId)
        return {
            gameStatus: state.status,
            roomId: state.roomId
        }
    }

    // 获取当前匹配队列信息
    public async getMatchingQueueInfo(): Promise<MatchingQueueInfo> {
        const matchingPlayers = await this.storageService.getAllMatchingPlayers()
        return {
            count: matchingPlayers.length,
            items: matchingPlayers.map(p => ({
                agentId: p.agentId,
                isHuman: p.isHuman
            }))
        }
    }

    // 获取房间视图
    async getRoomView(roomId: string): Promise<RoomView> {
        const gameState = await this.storageService.getGame(roomId)
        if (!gameState) {
            throw new Error('游戏房间不存在')
        }

        return {
            word: gameState.word || '',
            eventList: gameState.events,
            initialPlayerList: gameState.players,
            currentStatusDescriptions: gameState.events.length > 0 
                ? gameState.events[gameState.events.length - 1].currentStatusDescriptions
                : [],
            roomId: gameState.roomId,
            highLightIndex: gameState.events.length > 0 
                ? gameState.events[gameState.events.length - 1].highLightIndex
                : 0,
            endGameData: gameState.endGameData
        }
    }

    // 处理游戏动作
    async processGameAction(roomId: string, action: { agentId: string, action: string, content: string, voteToMockName?: string }): Promise<void> {
        const gameState = await this.storageService.getGame(roomId)
        if (!gameState) {
            throw new Error('游戏房间不存在')
        }

        switch (action.action) {
            case 'speech':
                await this.processSpeech(gameState, { agentId: action.agentId, content: action.content })
                break
            case 'vote':
                if (!action.voteToMockName) {
                    throw new Error('投票目标不能为空')
                }
                await this.processVote(gameState, { agentId: action.agentId, voteToMockName: action.voteToMockName })
                break
            default:
                throw new Error(`不支持的动作类型: ${action.action}`)
        }

        await this.storageService.saveGame(gameState)
    }

    // 处理发言
    private async processSpeech(gameState: GameState, action: { agentId: string, content: string }): Promise<void> {
        const player = gameState.players.find(p => p.agentId === action.agentId)
        if (!player) {
            throw new Error('Player not found')
        }

        // 添加发言事件
        gameState.events.push({
            round: gameState.currentRound,
            eventType: 'speech',
            agentId: action.agentId || '',
            mockName: player.mockName,
            text: action.content,
            playerList: gameState.players,
            currentStatusDescriptions: this.generateStatusDescriptions(gameState),
            highLightIndex: gameState.players.findIndex(p => p.agentId === action.agentId)
        })

        // 保存游戏状态
        await this.storageService.saveGame(gameState)
    }

    // 处理投票
    private async processVote(gameState: GameState, action: { agentId: string, voteToMockName: string }): Promise<void> {
        const voter = gameState.players.find(p => p.agentId === action.agentId)
        if (!voter) {
            throw new Error('Voter not found')
        }

        const votedPlayer = gameState.players.find(p => p.mockName === action.voteToMockName)
        if (!votedPlayer) {
            throw new Error('Voted player not found')
        }

        // 检查投票有效性
        const voteIsValid = voter.playerStatus === 'alive' && votedPlayer.playerStatus === 'alive'

        // 添加投票事件
        gameState.events.push({
            round: gameState.currentRound,
            eventType: 'vote',
            agentId: action.agentId || '',
            mockName: voter.mockName,
            voteToMockName: action.voteToMockName,
            voteToAgentId: votedPlayer.agentId || '',
            voteIsValid,
            playerList: gameState.players,
            currentStatusDescriptions: this.generateStatusDescriptions(gameState),
            highLightIndex: gameState.players.findIndex(p => p.agentId === action.agentId)
        })

        // 如果所有存活玩家都已投票，处理本轮结果
        const alivePlayers = gameState.players.filter(p => p.playerStatus === 'alive')
        const validVotes = gameState.events
            .filter(e => e.round === gameState.currentRound && e.eventType === 'vote' && e.voteIsValid)
        
        if (validVotes.length === alivePlayers.length) {
            await this.processRoundEnd(gameState)
        } else {
            // 保存游戏状态
            await this.storageService.saveGame(gameState)
        }
    }

    // 处理回合结束
    private async processRoundEnd(gameState: GameState): Promise<void> {
        // 统计本轮有效票数
        const validVotes = gameState.events
            .filter(e => e.round === gameState.currentRound && e.eventType === 'vote' && e.voteIsValid)
            .map(e => e.voteToMockName || '')

        // 计算被投票最多的玩家
        const voteCount = new Map<string, number>()
        validVotes.forEach(mockName => {
            voteCount.set(mockName, (voteCount.get(mockName) || 0) + 1)
        })

        let maxVotes = 0
        let votedOutPlayers: string[] = []
        voteCount.forEach((count, mockName) => {
            if (count > maxVotes) {
                maxVotes = count
                votedOutPlayers = [mockName]
            } else if (count === maxVotes) {
                votedOutPlayers.push(mockName)
            }
        })

        // 处理投票结果
        if (votedOutPlayers.length === 1) {
            const votedOutPlayer = gameState.players.find(p => p.mockName === votedOutPlayers[0])
            if (votedOutPlayer) {
                votedOutPlayer.playerStatus = 'dead'
                // 添加投票结果事件
                gameState.events.push({
                    round: gameState.currentRound,
                    eventType: 'hostSpeech',
                    text: `${votedOutPlayer.mockName} has been voted out.`,
                    playerList: gameState.players,
                    currentStatusDescriptions: this.generateStatusDescriptions(gameState),
                    highLightIndex: gameState.players.findIndex(p => p.mockName === votedOutPlayer.mockName)
                })
            }
        } else {
            // 平票情况
            gameState.events.push({
                round: gameState.currentRound,
                eventType: 'hostSpeech',
                text: 'Tie vote, no one is eliminated.',
                playerList: gameState.players,
                currentStatusDescriptions: this.generateStatusDescriptions(gameState),
                highLightIndex: -1
            })
        }

        // 检查游戏是否结束
        if (this.checkGameOver(gameState)) {
            await this.endGame(gameState)
        } else {
            // 进入下一轮
            gameState.currentRound++
            gameState.events.push({
                round: gameState.currentRound,
                eventType: 'start',
                text: `Round ${gameState.currentRound} begins.`,
                playerList: gameState.players,
                currentStatusDescriptions: this.generateStatusDescriptions(gameState),
                highLightIndex: -1
            })
            await this.storageService.saveGame(gameState)
        }
    }

    // 检查游戏是否结束
    private checkGameOver(gameState: GameState): boolean {
        const alivePlayers = gameState.players.filter(p => p.playerStatus === 'alive')
        const aliveSpies = alivePlayers.filter(p => p.role === 'spy').length
        const aliveInnocents = alivePlayers.filter(p => p.role === 'innocent').length

        return aliveSpies === 0 || aliveSpies >= aliveInnocents
    }

    // 结束游戏
    private async endGame(gameState: GameState): Promise<void> {
        // 确定获胜方
        const alivePlayers = gameState.players.filter(p => p.playerStatus === 'alive')
        const aliveSpies = alivePlayers.filter(p => p.role === 'spy')
        const winnerRole = aliveSpies.length > 0 ? 'spy' : 'innocent'

        // 更新游戏状态
        gameState.status = 'finished'
        gameState.endGameData = {
            winnerRole,
            winners: alivePlayers,
            scores: []
        }

        // 添加游戏结束事件
        gameState.events.push({
            round: gameState.currentRound,
            eventType: 'end',
            text: `Game Over! ${winnerRole === 'spy' ? 'Spy' : 'Innocent'} team wins!`,
            playerList: gameState.players,
            currentStatusDescriptions: this.generateStatusDescriptions(gameState),
            highLightIndex: -1,
            winnerRole
        })

        // 保存最终游戏状态
        await this.storageService.saveGame(gameState)

        // 重置所有玩家状态为idle
        for (const player of gameState.players) {
            if (player.agentId) {
                await GameService.updateAgentState(player.agentId, { status: 'idle', roomId: null })
            }
        }
    }

    // 生成状态描述
    private generateStatusDescriptions(gameState: GameState): string[] {
        const descriptions: string[] = [];
        
        if (gameState.status === 'waiting') {
            descriptions.push('Waiting for players to join...');
        } else if (gameState.status === 'playing') {
            descriptions.push(`Round ${gameState.currentRound}`);
            if (gameState.events.length > 0) {
                const lastEvent = gameState.events[gameState.events.length - 1];
                if (lastEvent.eventType === 'vote') {
                    descriptions.push('Voting in progress...');
                } else if (lastEvent.eventType === 'speech') {
                    descriptions.push('Players are describing...');
                }
            }
        } else if (gameState.status === 'finished') {
            descriptions.push('Game Over');
            if (gameState.endGameData) {
                descriptions.push(`Winner: ${gameState.endGameData.winnerRole === 'spy' ? 'Spy' : 'Innocent'}`);
            }
        }
        
        return descriptions;
    }

    // 创建游戏房间
    private async createGameRoom(playersForRoom: { agentId: string, score: number, isHuman: boolean }[]): Promise<void> {
        const roomId = uuidv4();
        console.log(`[房间] 开始创建房间 ${roomId}，玩家数量: ${playersForRoom.length}`)

        try {
            // 1. 先检查所有玩家的状态
            for (const player of playersForRoom) {
                const state = await GameService.getAgentState(player.agentId);
                if (state.status !== 'in_matching_queue') {
                    throw new Error(`玩家 ${player.agentId} 状态异常: ${state.status}，期望状态: in_matching_queue`);
                }
            }

            // 2. 创建游戏房间
            const gameState: GameState = {
                roomId,
                status: 'waiting',
                currentRound: 1,
                players: [],
                events: []
            };

            // 3. 生成随机名字并设置玩家信息
            const mockNames = GameService.getRandomMockNames(playersForRoom.length);
            console.log(`[房间] 生成随机名字:`, mockNames);

            // 4. 获取玩家信息并分配角色
            for (let i = 0; i < playersForRoom.length; i++) {
                const player = playersForRoom[i];
                const agent = await this.contractService.getAgentById(player.agentId);
                if (!agent) {
                    throw new Error(`玩家 ${player.agentId} 不存在`);
                }
                
                gameState.players.push({
                    agentId: agent.agentId,
                    mockName: mockNames[i],
                    agentName: agent.name,
                    role: 'innocent', // 先设置为innocent，后面再分配spy
                    playerStatus: 'alive',
                    avatar: agent.avatar || undefined,
                    winningRate: undefined,
                    gameCount: agent.gameCount,
                    rankNo: undefined,
                    score: agent.score
                });
                console.log(`[房间] 玩家 ${agent.agentId} 信息已添加，游戏名: ${mockNames[i]}`);
            }

            // 5. 分配卧底角色
            const spyCount = Math.floor(gameState.players.length * GameService.GAME_CONFIG.SPY_RATIO);
            console.log(`[房间] 开始分配角色，卧底数量: ${spyCount}`);
            const array = new Uint32Array(spyCount);
            crypto.getRandomValues(array);
            const spyIndices = Array.from(array).map(n => n % gameState.players.length);
            spyIndices.forEach(index => {
                if (gameState.players[index]) {
                    gameState.players[index].role = 'spy';
                    console.log(`[房间] 玩家 ${gameState.players[index].mockName} 被分配为卧底`);
                }
            });

            // 6. 添加游戏开始事件
            const event: GameEvent = {
                round: 1,
                eventType: 'start',
                highLightIndex: 0,
                currentStatusDescriptions: this.generateStatusDescriptions(gameState),
                playerList: gameState.players
            };
            gameState.events.push(event);

            // 7. 保存游戏状态
            await this.storageService.saveGame(gameState);

            // 8. 从匹配队列中移除玩家并更新状态为inGame
            await Promise.all([
                // 从匹配队列中移除玩家
                ...playersForRoom.map(player => 
                    this.storageService.removeFromMatching(player.agentId)
                ),
                // 更新玩家状态为inGame
                ...playersForRoom.map(player => 
                    GameService.updateAgentState(player.agentId, {
                        status: 'inGame',
                        roomId
                    })
                )
            ]);

            console.log(`[房间] 房间 ${roomId} 创建成功`);
        } catch (error) {
            console.error('[房间] 创建房间失败:', error);
            // 回滚所有玩家状态
            await Promise.all(playersForRoom.map(player =>
                GameService.updateAgentState(player.agentId, {
                    status: 'idle',
                    roomId: null
                }).catch(e => console.error(`[房间] 回滚玩家 ${player.agentId} 状态失败:`, e))
            ));
            throw error;
        }
    }

    // 检查并匹配玩家
    private async checkAndMatchPlayers(): Promise<void> {
        if (GameService.isProcessingMatch) {
            if (GameService.processingMatchStartTime && 
                Date.now() - GameService.processingMatchStartTime > GameService.TIMEOUTS.LOCK) {
                console.log('[匹配] 上一次匹配超时，重置状态')
                GameService.isProcessingMatch = false
            } else {
                return
            }
        }
        const corid = uuidv4()
        try {
            console.log(corid,'[匹配] 执行匹配流程开始')
            GameService.isProcessingMatch = true
            GameService.processingMatchStartTime = Date.now()

            const matchingPlayers = await this.storageService.getAllMatchingPlayers()
            console.log(`[匹配] 当前匹配队列中的玩家数量: ${matchingPlayers.length}`)
            
            // 检查是否需要补充AI玩家
            for (const player of matchingPlayers) {
                const waitTime = Date.now() - new Date(player.createdAt).getTime()
                console.log(`[匹配] 玩家 ${player.agentId} 等待时间: ${waitTime}ms`)
                
                if (waitTime > GameService.TIMEOUTS.MAX_WAIT) {
                    const aiPlayersNeeded = GameService.GAME_CONFIG.PLAYERS_PER_ROOM - matchingPlayers.length;
                    console.log(`[匹配] 需要补充 ${aiPlayersNeeded} 个AI玩家`)
                    
                    // 获取所有可用的agent
                    const allAgents = await this.contractService.getAgentList();
                    console.log(`[匹配] 当前系统中共有 ${allAgents.length} 个agents`)
                    
                    // 过滤出不在当前匹配队列中的agent
                    const availableAgents = allAgents.filter((agent: AgentListItem) => 
                        !matchingPlayers.some(p => p.agentId === agent.agentId)
                    );
                    console.log(`[匹配] 可用作AI玩家的agents数量: ${availableAgents.length}`)

                    // 随机选择需要数量的agent
                    const selectedAgents = [...availableAgents]
                        .sort(() => Math.random() - 0.5)
                        .slice(0, aiPlayersNeeded);

                    // 批量更新AI玩家状态并加入匹配队列
                    await Promise.all(selectedAgents.map(async (agent) => {
                        try {
                            console.log(`[匹配] 选择agent ${agent.agentId} 作为AI玩家`)
                            await GameService.updateAgentState(agent.agentId, { 
                                status: 'in_matching_queue',
                                roomId: null
                            });
                            await this.storageService.addToMatching(agent.agentId, agent.score || 0, false);
                            matchingPlayers.push({
                                agentId: agent.agentId,
                                score: agent.score || 0,
                                isHuman: false,
                                createdAt: new Date().toISOString()
                            });
                            console.log(`[匹配] AI玩家(agent: ${agent.agentId})已加入匹配队列`)
                        } catch (error) {
                            console.error(`[匹配] 添加AI玩家(agent: ${agent.agentId})失败:`, error);
                            await GameService.updateAgentState(agent.agentId, {
                                status: 'idle',
                                roomId: null
                            }).catch(e => console.error(`[匹配] 回滚AI玩家状态失败:`, e));
                        }
                    }));
                    break;
                }
            }

            // 如果玩家数量达到要求，创建房间
            if (matchingPlayers.length >= GameService.GAME_CONFIG.MIN_PLAYERS_TO_START) {
                const playersForRoom = matchingPlayers.slice(0, GameService.GAME_CONFIG.PLAYERS_PER_ROOM);
                try {
                    await this.createGameRoom(playersForRoom);
                    // 从匹配列表中移除已匹配的玩家
                    matchingPlayers.splice(0, playersForRoom.length);
                    console.log(`[匹配] 房间创建成功，剩余待匹配玩家: ${matchingPlayers.length}`);
                } catch (error) {
                    console.error('[匹配] 创建房间失败:', error);
                    throw error;
                }
            } else {
                console.log(`[匹配] 当前玩家数量(${matchingPlayers.length})不足最小开始人数(${GameService.GAME_CONFIG.MIN_PLAYERS_TO_START})`);
            }
        } catch (error) {
            console.error('[匹配] 执行匹配流程失败:', error);
            console.error('[匹配] 错误详情:', {
                error: error instanceof Error ? {
                    message: error.message,
                    stack: error.stack
                } : error
            });
        } finally {
            GameService.isProcessingMatch = false;
            GameService.processingMatchStartTime = null;
            console.log(corid,'[匹配] 执行匹配流程结束');
        }
    }
}

// 创建单例实例
export const gameService = GameService.getInstance() 