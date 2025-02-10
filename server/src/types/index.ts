// ===================
// API 接口相关类型
// ===================

/**
 * API 通用响应格式
 * @template T 响应数据的具体类型
 */
export interface ApiResponse<T> {
    info: {
        ok: boolean        // 请求是否成功
        msg: string | null // 响应消息
        code: string | null // 响应代码
        redirectUrl: string | null // 重定向URL（如果需要）
    }
    data: T               // 具体的响应数据
}

/**
 * Agent列表响应格式
 */
export interface AgentListResponse {
    result: AgentListItem[]  // Agent列表数据
    total: number           // 总数量
}

// ===================
// 数据库模型相关类型
// ===================

/**
 * 玩家信息
 * 代表一个玩家在游戏中的状态和信息
 */
export interface Player {
    agentId: string | null   // 关联的Agent ID
    mockName: string         // 游戏中显示的名称
    agentName: string        // Agent的原始名称
    role: string            // 角色类型（spy/innocent）
    playerStatus: string     // 玩家状态（alive/dead）
    avatar?: string         // 头像URL
    winningRate?: number    // 胜率
    gameCount?: number      // 游戏场次
    rankNo?: number         // 排名
    score?: number          // 分数
}

/**
 * Agent列表项
 * 用于展示Agent的基本信息
 */
export interface AgentListItem {
    agentId: string         // Agent唯一标识
    avatar: string | null   // 头像URL
    name: string           // 名称
    score: number          // 分数
    mockName?: string      // 游戏中的显示名称
    winCount: number       // 获胜次数
    gameCount: number      // 游戏场次
    status: string         // 状态码
    statusName: string     // 状态描述
    matchStartTime: string | null // 开始匹配的时间
    prompts?: string       // 提示词配置
}

/**
 * 创建Agent的请求参数
 */
export interface CreateAgentRequest {
    agentId: string         // Agent唯一标识
    name: string           // 名称
    avatar?: string        // 头像URL
    prompts?: string       // 提示词配置
}

// ===================
// 游戏服务相关类型
// ===================

/**
 * 游戏事件
 * 记录游戏过程中的各种事件
 */
export interface GameEvent {
    round: number          // 当前回合数
    eventType: 'start' | 'hostSpeech' | 'speech' | 'vote' | 'end' // 事件类型
    agentId?: string       // 事件相关的Agent ID
    mockName?: string      // 事件相关的玩家显示名称
    text?: string          // 事件文本内容
    voteToMockName?: string // 投票目标的显示名称
    voteToAgentId?: string // 投票目标的Agent ID
    voteIsValid?: boolean  // 投票是否有效
    winnerRole?: 'spy' | 'innocent' // 获胜角色
    playerList: Player[]   // 当前玩家列表
    currentStatusDescriptions: string[] // 当前状态描述
    highLightIndex: number // 当前高亮的玩家索引
    loadingMockName?: string // 正在加载的玩家显示名称
}

/**
 * 游戏状态
 * 记录游戏的完整状态信息
 */
export interface GameState {
    roomId: string         // 房间ID
    status: 'waiting' | 'playing' | 'finished' // 游戏状态
    word?: string         // 当前回合的词语
    players: Player[]     // 玩家列表
    events: GameEvent[]   // 事件列表
    currentRound: number  // 当前回合数
    endGameData?: EndGameData | null // 游戏结束数据
}

/**
 * 游戏结束数据
 * 记录游戏结束时的相关信息
 */
export interface EndGameData {
    winnerRole: 'spy' | 'innocent' // 获胜角色
    winners: Player[]    // 获胜玩家列表
    scores: Array<{     // 得分情况
        playerId: number
        score: number
    }>
}

// ===================
// 匹配服务相关类型
// ===================

/**
 * Agent游戏状态
 * 表示Agent在匹配/游戏系统中的状态
 */
export type AgentGameStatus = 'idle' | 'in_matching_queue' | 'inGame'

/**
 * 匹配中的玩家信息
 */
export interface MatchingPlayer {
    agentId: string    // Agent ID
    score: number      // 分数
    timestamp: number  // 进入匹配的时间戳
    isHuman: boolean   // 是否为人类玩家
}

/**
 * 匹配队列项
 */
export interface MatchQueueItem {
    agentId: string    // Agent ID
    isHuman: boolean   // 是否为人类玩家
    score: number      // 分数
    joinTime: number   // 加入时间
}

/**
 * Agent游戏状态
 */
export interface AgentGameState {
    status: AgentGameStatus // 当前状态
    roomId: string | null  // 所在房间ID
    score?: number         // 分数
    lastUpdateTime: number // 最后更新时间
}

/**
 * Agent游戏状态存储
 */
export interface AgentGameStateStore {
    [agentId: string]: AgentGameState
}

/**
 * 匹配队列信息
 */
export interface MatchingQueueInfo {
    count: number     // 队列中的玩家数量
    items: Array<{    // 队列中的玩家
        agentId: string
        isHuman: boolean
    }>
}

// ===================
// 前端视图相关类型
// ===================

/**
 * 房间视图
 * 用于前端展示的房间信息
 */
export interface RoomView {
    word: string                    // 当前词语
    eventList: GameEvent[]          // 事件列表
    initialPlayerList: Player[]     // 初始玩家列表
    currentStatusDescriptions: string[] // 当前状态描述
    roomId: string                  // 房间ID
    highLightIndex: number          // 当前高亮的玩家索引
    endGameData?: EndGameData | null // 游戏结束数据
}