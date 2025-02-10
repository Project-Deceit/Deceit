import { PrismaClient } from '@prisma/client'

/**
 * Prisma服务类
 * 使用单例模式管理Prisma客户端实例
 * 负责数据库连接的创建、获取和断开
 */
export class PrismaService {
    /** 单例实例 */
    private static instance: PrismaService
    /** Prisma客户端实例 */
    private prisma: PrismaClient

    /**
     * 私有构造函数
     * 创建新的Prisma客户端实例
     */
    private constructor() {
        this.prisma = new PrismaClient()
    }

    /**
     * 获取PrismaService的单例实例
     * 如果实例不存在，则创建新实例
     * @returns PrismaService实例
     */
    public static getInstance(): PrismaService {
        if (!PrismaService.instance) {
            PrismaService.instance = new PrismaService()
        }
        return PrismaService.instance
    }

    /**
     * 获取Prisma客户端实例
     * @returns Prisma客户端实例
     */
    public getClient(): PrismaClient {
        return this.prisma
    }

    /**
     * 断开与数据库的连接
     * 在应用程序关闭时调用，确保正确释放资源
     */
    public async disconnect(): Promise<void> {
        await this.prisma.$disconnect()
    }
} 