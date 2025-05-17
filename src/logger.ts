import fs from 'fs';
import path from 'path';

enum LogLevel {
  INFO = 'INFO',
  WARNING = 'WARNING',
  ERROR = 'ERROR',
  DEBUG = 'DEBUG',
}

class Logger {
  private logPath: string;
  private logFile: string;
  private logs: LogEntry[] = [];

  constructor(logPath: string = path.join(__dirname, '../logs')) {
    this.logPath = logPath;
    this.logFile = path.join(logPath, `media-hardlinker-${new Date().toISOString().split('T')[0]}.log`);
    
    // 确保日志目录存在
    if (!fs.existsSync(this.logPath)) {
      fs.mkdirSync(this.logPath, { recursive: true });
    }
  }

  private log(level: LogLevel, message: string): LogEntry {
    const timestamp = new Date();
    const logEntry: LogEntry = {
      id: this.logs.length + 1,
      timestamp,
      level,
      message,
    };

    // 添加到内存日志
    this.logs.push(logEntry);

    // 写入文件
    const logMessage = `[${timestamp.toISOString()}] [${level}] ${message}\n`;
    fs.appendFileSync(this.logFile, logMessage);

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

  public getLogs(limit: number = 100, level?: LogLevel): LogEntry[] {
    let filteredLogs = this.logs;
    
    if (level) {
      filteredLogs = filteredLogs.filter(log => log.level === level);
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