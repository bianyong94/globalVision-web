// 缓存工具类，用于管理页面数据缓存
interface CacheItem {
  data: any;
  timestamp: number; // 缓存时间戳
  ttl: number; // 缓存过期时间（毫秒）
}

class DataCache {
  private cache: Map<string, CacheItem> = new Map();

  /**
   * 设置缓存
   * @param key 缓存键
   * @param data 缓存数据
   * @param ttl 过期时间（毫秒），默认2小时
   */
  set(key: string, data: any, ttl: number = 2 * 60 * 60 * 1000): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    });
  }

  /**
   * 获取缓存
   * @param key 缓存键
   * @returns 缓存数据或null
   */
  get(key: string): any | null {
    const cacheItem = this.cache.get(key);
    
    if (!cacheItem) {
      return null;
    }

    // 检查是否过期
    const now = Date.now();
    if (now - cacheItem.timestamp > cacheItem.ttl) {
      this.cache.delete(key);
      return null;
    }

    return cacheItem.data;
  }

  /**
   * 清除缓存
   * @param key 缓存键，如果未提供则清除所有缓存
   */
  clear(key?: string): void {
    if (key) {
      this.cache.delete(key);
    } else {
      this.cache.clear();
    }
  }

  /**
   * 检查缓存是否存在且未过期
   * @param key 缓存键
   * @returns 是否存在有效缓存
   */
  hasValidCache(key: string): boolean {
    return this.get(key) !== null;
  }
}

export const dataCache = new DataCache();