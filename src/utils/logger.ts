import fs from 'fs';
import path from 'path';
import pino from 'pino';
import { getConfig } from '../config/config';

enum LogLevel {
  INFO = 'INFO',
  WARNING = 'WARNING',
  ERROR = 'ERROR',
  DEBUG = 'DEBUG',
}

// 日志级别映射
const LOG_LEVEL_MAP = {
  [LogLevel.DEBUG]: 10,
  [LogLevel.INFO]: 20,
  [LogLevel.WARNING]: 30,
  [LogLevel.ERROR]: 40,
};

class Logger {
  private logPath: string;
  private logFile: string;
  private logs: LogEntry[] = [];
  private pinoLogger?: pino.Logger;
  private pinoFileStream?: pino.DestinationStream;
  private consoleLogger?: pino.Logger;
  private isDevelopment: boolean;
  private logLevel: LogLevel;
  private maxBufferSize: number;
  private persistentLogging: boolean;

  constructor(logPath: string = path.join(__dirname, '../../logs')) {
    this.logPath = logPath;
    this.logFile = path.join(logPath, `media-hardlinker-${new Date().toISOString().split('T')[0]}.log`);
    this.isDevelopment = process.env.NODE_ENV === 'development';
    this.logLevel = (process.env.LOG_LEVEL as LogLevel) || LogLevel.INFO;
    this.maxBufferSize = 1000;
    
    // 从配置文件读取持久化日志设置
    try {
      const config = getConfig();
      this.persistentLogging = config.persistentLogging;
    } catch (error) {
      // 配置读取失败，记录错误并使用默认值
      console.warn('Logger: 读取配置文件失败，使用默认持久化日志设置:', error instanceof Error ? error.message : String(error));
      this.persistentLogging = true; // 默认启用持久化日志
    }
    
    this.initializeLoggers();
  }

  private initializeLoggers(): void {
    // 初始化文件日志
    if (this.persistentLogging) {
      if (!fs.existsSync(this.logPath)) {
        fs.mkdirSync(this.logPath, { recursive: true });
      }
      // 使用 pino.destination 提高性能并方便管理
      this.pinoFileStream = pino.destination({ dest: this.logFile, append: true, sync: false });
      this.pinoLogger = pino({
        level: this.getPinoLevel(this.logLevel),
        timestamp: pino.stdTimeFunctions.isoTime,
        formatters: {
          level: (label) => ({ level: label.toUpperCase() })
        }
      }, this.pinoFileStream);
    }

    // 初始化控制台日志
    if (this.isDevelopment) {
      this.consoleLogger = pino({
        level: this.getPinoLevel(this.logLevel),
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'yyyy-mm-dd HH:MM:ss',
            ignore: 'pid,hostname'
          }
        }
      });
    }
  }

  // 将自定义 LogLevel 转换为 pino 级别
  private getPinoLevel(level: LogLevel): string {
    const levelMap = {
      [LogLevel.DEBUG]: 'debug',
      [LogLevel.INFO]: 'info',
      [LogLevel.WARNING]: 'warn',
      [LogLevel.ERROR]: 'error',
    };
    return levelMap[level] || 'info';
  }

  // 检查当前级别是否应该记录
  private shouldLog(level: LogLevel): boolean {
    const currentLevelValue = LOG_LEVEL_MAP[this.logLevel];
    const messageLevelValue = LOG_LEVEL_MAP[level];
    return messageLevelValue >= currentLevelValue;
  }

  private log(level: LogLevel, message: string, error?: unknown): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const timestamp = new Date();
    
    // 内存日志只记录原始 message
    const logEntry: LogEntry = {
      id: this.logs.length + 1,
      timestamp,
      level,
      message: message,
    };

    // 添加到内存日志
    this.logs.push(logEntry);
    if (this.logs.length > this.maxBufferSize) {
      this.logs.shift();
    }

    // 写入文件日志
    this.writeToFile(level, message, error);
    
    // 写入控制台日志
    this.writeToConsole(level, message, error);
  }

  private writeToFile(level: LogLevel, message: string, error?: unknown): void {
    if (!this.persistentLogging || !this.pinoLogger) return;

    const obj = error ? { err: error } : undefined;
    switch (level) {
      case LogLevel.INFO:
        this.pinoLogger.info(obj, message);
        break;
      case LogLevel.WARNING:
        this.pinoLogger.warn(obj, message);
        break;
      case LogLevel.ERROR:
        this.pinoLogger.error(obj, message);
        break;
      case LogLevel.DEBUG:
        this.pinoLogger.debug(obj, message);
        break;
    }
  }

  private writeToConsole(level: LogLevel, message: string, error?: unknown): void {
    if (!this.consoleLogger) return;

    const obj = error ? { err: error } : undefined;
    switch (level) {
      case LogLevel.INFO:
        this.consoleLogger.info(obj, message);
        break;
      case LogLevel.WARNING:
        this.consoleLogger.warn(obj, message);
        break;
      case LogLevel.ERROR:
        this.consoleLogger.error(obj, message);
        break;
      case LogLevel.DEBUG:
        this.consoleLogger.debug(obj, message);
        break;
    }
  }

  public info(message: string): void {
    this.log(LogLevel.INFO, message);
  }

  public warn(message: string): void {
    this.log(LogLevel.WARNING, message);
  }

  public error(message: string, error?: unknown): void {
    this.log(LogLevel.ERROR, message, error);
  }

  public debug(message: string): void {
    this.log(LogLevel.DEBUG, message);
  }

  public pinoInfo(message: string, _obj?: any): void {
    if (!this.shouldLog(LogLevel.INFO)) return;
    this.writeToFile(LogLevel.INFO, message);
    this.writeToConsole(LogLevel.INFO, message);
  }

  public pinoWarn(message: string, _obj?: any): void {
    if (!this.shouldLog(LogLevel.WARNING)) return;
    this.writeToFile(LogLevel.WARNING, message);
    this.writeToConsole(LogLevel.WARNING, message);
  }

  public pinoError(message: string, obj?: any): void {
    if (!this.shouldLog(LogLevel.ERROR)) return;
    this.writeToFile(LogLevel.ERROR, message, obj);
    this.writeToConsole(LogLevel.ERROR, message, obj);
  }

  public pinoDebug(message: string, _obj?: any): void {
    if (!this.shouldLog(LogLevel.DEBUG)) return;
    this.writeToFile(LogLevel.DEBUG, message);
    this.writeToConsole(LogLevel.DEBUG, message);
  }

  // 获取原始 pino logger 实例
  public getPinoLogger(): pino.Logger | undefined {
    return this.pinoLogger;
  }

  public getConsoleLogger(): pino.Logger | undefined {
    return this.consoleLogger;
  }

  // 获取环境信息
  public getEnvInfo(): { isDevelopment: boolean; logLevel: LogLevel; persistentLogging: boolean } {
    return {
      isDevelopment: this.isDevelopment,
      logLevel: this.logLevel,
      persistentLogging: this.persistentLogging,
    };
  }

  // 重新初始化Logger（供config模块调用）
  public reinitialize(): void {
    try {
      const config = getConfig(false); // 不使用缓存，获取最新配置
      this.persistentLogging = config.persistentLogging;
      
      // 关闭现有的文件流
      if (this.pinoFileStream) {
        (this.pinoFileStream as any).end();
        this.pinoFileStream = undefined;
      }
      this.pinoLogger = undefined;
      
      // 重新初始化日志器
      this.initializeLoggers();
    } catch (_error) {
      // 配置读取失败，记录错误并保持当前设置
      console.warn('Logger: reinitialize时读取配置失败，保持当前设置:', _error instanceof Error ? _error.message : String(_error));
    }
  }

  public getLogs(
    page: number = 1,
    limit: number = 100,
    level?: LogLevel,
    keyword?: string,
    sortBy: string = "timestamp",
    sortOrder: "asc" | "desc" = "desc"
  ): { logs: LogEntry[]; total: number } {
    let filteredLogs = this.logs;

    if (level) {
      filteredLogs = filteredLogs.filter((log) => log.level === level);
    }
    // 根据关键词过滤日志
    if (keyword) {
      filteredLogs = filteredLogs.filter((log) =>
        log.message.includes(keyword)
      );
    }

    // 排序
    filteredLogs.sort((a, b) => {
      let aValue: any;
      let bValue: any;

      if (sortBy === "timestamp") {
        aValue = a.timestamp.getTime();
        bValue = b.timestamp.getTime();
      } else if (sortBy === 'level') {
        aValue = LOG_LEVEL_MAP[a.level];
        bValue = LOG_LEVEL_MAP[b.level];
      }
      else {
        aValue = a[sortBy as keyof LogEntry];
        bValue = b[sortBy as keyof LogEntry];
      }

      if (aValue < bValue) {
        return sortOrder === "asc" ? -1 : 1;
      }
      if (aValue > bValue) {
        return sortOrder === "asc" ? 1 : -1;
      }
      return 0;
    });

    const total = filteredLogs.length;
    const start = (page - 1) * limit;
    const end = start + limit;

    const logs = filteredLogs.slice(start, end);

    return { logs, total };
  }
}

export interface LogEntry {
  id: number;
  timestamp: Date;
  level: LogLevel;
  message: string;
}

// 全局logger实例
export const logger = new Logger();

export { LogLevel };