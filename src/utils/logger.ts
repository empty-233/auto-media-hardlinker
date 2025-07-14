import fs from 'fs';
import path from 'path';
import pino from 'pino';

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
  private pinoLogger: pino.Logger;
  private consoleLogger?: pino.Logger;
  private isDevelopment: boolean;
  private logLevel: LogLevel;
  private maxBufferSize: number; // 最大内存日志缓冲

  constructor(logPath: string = path.join(__dirname, '../../logs')) {
    this.logPath = logPath;
    this.logFile = path.join(logPath, `media-hardlinker-${new Date().toISOString().split('T')[0]}.log`);
    
    // 判断是否是开发环境
    this.isDevelopment = process.env.NODE_ENV === 'development';
    
    // 从环境变量获取日志级别，默认为 INFO
    this.logLevel = (process.env.LOG_LEVEL as LogLevel) || LogLevel.INFO;
    this.maxBufferSize = 1000; // 限制内存日志数量为1000条
    
    // 确保日志目录存在
    if (!fs.existsSync(this.logPath)) {
      fs.mkdirSync(this.logPath, { recursive: true });
    }

    // 配置文件日志
    const fileStream = fs.createWriteStream(this.logFile, { flags: 'a' });
    this.pinoLogger = pino({
      level: this.getPinoLevel(this.logLevel),
      timestamp: pino.stdTimeFunctions.isoTime,
      formatters: {
        level: (label) => {
          return { level: label.toUpperCase() };
        }
      }
    }, fileStream);

    // 只在开发环境配置控制台日志
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

  private log(level: LogLevel, message: string): LogEntry {
    // 检查是否应该记录此级别的日志
    if (!this.shouldLog(level)) {
      return {
        id: this.logs.length + 1,
        timestamp: new Date(),
        level,
        message,
      };
    }

    const timestamp = new Date();
    const logEntry: LogEntry = {
      id: this.logs.length + 1,
      timestamp,
      level,
      message,
    };

    // 添加到内存日志
    this.logs.push(logEntry);
    // 超过缓冲则移除最旧日志
    if (this.logs.length > this.maxBufferSize) {
      this.logs.shift();
    }

    // 使用 pino 记录日志到文件
    switch (level) {
      case LogLevel.INFO:
        this.pinoLogger.info(message);
        this.consoleLogger?.info(message);
        break;
      case LogLevel.WARNING:
        this.pinoLogger.warn(message);
        this.consoleLogger?.warn(message);
        break;
      case LogLevel.ERROR:
        this.pinoLogger.error(message);
        this.consoleLogger?.error(message);
        break;
      case LogLevel.DEBUG:
        this.pinoLogger.debug(message);
        this.consoleLogger?.debug(message);
        break;
    }

    return logEntry;
  }

  public info(message: string): LogEntry {
    return this.log(LogLevel.INFO, message);
  }

  public warning(message: string): LogEntry {
    return this.log(LogLevel.WARNING, message);
  }

  public error(message: string): LogEntry {
    return this.log(LogLevel.ERROR, message);
  }

  public debug(message: string): LogEntry {
    return this.log(LogLevel.DEBUG, message);
  }

  // 新增：直接使用 pino 记录日志（不保存到内存）
  public pinoInfo(message: string, obj?: any): void {
    if (!this.shouldLog(LogLevel.INFO)) return;
    
    this.pinoLogger.info(obj, message);
    this.consoleLogger?.info(obj, message);
  }

  public pinoWarn(message: string, obj?: any): void {
    if (!this.shouldLog(LogLevel.WARNING)) return;
    
    this.pinoLogger.warn(obj, message);
    this.consoleLogger?.warn(obj, message);
  }

  public pinoError(message: string, obj?: any): void {
    if (!this.shouldLog(LogLevel.ERROR)) return;
    
    this.pinoLogger.error(obj, message);
    this.consoleLogger?.error(obj, message);
  }

  public pinoDebug(message: string, obj?: any): void {
    if (!this.shouldLog(LogLevel.DEBUG)) return;
    
    this.pinoLogger.debug(obj, message);
    this.consoleLogger?.debug(obj, message);
  }

  // 获取原始 pino logger 实例
  public getPinoLogger(): pino.Logger {
    return this.pinoLogger;
  }

  public getConsoleLogger(): pino.Logger | undefined {
    return this.consoleLogger;
  }

  // 获取环境信息
  public getEnvInfo(): { isDevelopment: boolean; logLevel: LogLevel } {
    return {
      isDevelopment: this.isDevelopment,
      logLevel: this.logLevel,
    };
  }

  public getLogs(limit: number = 100, level?: LogLevel, keyword?: string): LogEntry[] {
    let filteredLogs = this.logs;
    
    if (level) {
      filteredLogs = filteredLogs.filter(log => log.level === level);
    }
    // 根据关键词过滤日志
    if (keyword) {
      filteredLogs = filteredLogs.filter(log => log.message.includes(keyword));
    }
    
    // 返回最新的日志，按时间降序排列
    return filteredLogs
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }
}

export interface LogEntry {
  id: number;
  timestamp: Date;
  level: LogLevel;
  message: string;
}

export const logger = new Logger();
export { LogLevel };