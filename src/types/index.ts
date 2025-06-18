// types/index.ts
// 定义扩展中使用的共享类型

/**
 * 扩展配置接口
 */
export interface Config {
  targetUrl: string;
  buttonSelector: string;
  listenUrl: string;
  submitUrl: string;
  timerInterval: number;
  dataProcessingMethod: string;
  customScript: string;
}

/**
 * 状态消息接口
 */
export interface StatusMessage {
  command: string;
  status?: string;
  isRunning?: boolean;
  nextRunTime?: number;
  error?: string;
}

/**
 * 日志消息接口
 */
export interface LogMessage {
  command: string;
  message: string;
}

/**
 * 网络请求响应数据接口
 */
export interface ResponseData {
  url: string;
  method: string;
  statusCode: number;
  timestamp: string;
  message?: string;
  [key: string]: any;
}

/**
 * 点击按钮消息接口
 */
export interface ClickButtonMessage {
  command: string;
  selector: string;
}

/**
 * 点击结果消息接口
 */
export interface ClickResultMessage {
  command: string;
  success: boolean;
  error?: string;
}

/**
 * 命令消息接口
 */
export interface CommandMessage {
  command: string;
  config?: Config;
}

/**
 * 网络请求捕获消息接口
 */
export interface NetworkRequestMessage {
  command: string;
  data: NetworkResponseData;
}

/**
 * 网络响应捕获数据接口
 */
export interface NetworkResponseData {
  url: string;
  method: string;
  requestHeaders?: Record<string, string>;
  requestBody?: string;
  status: number;
  responseHeaders?: Record<string, string>;
  responseBody?: string;
  timestamp: string;
  contentType?: string;
}
