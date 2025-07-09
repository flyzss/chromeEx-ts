// types/index.ts
// 定义扩展中使用的共享类型

/**
 * 扩展配置接口
 */
export interface Config {
  targetUrl: string;
  // 旧字段（保留以兼容现有代码）
  buttonSelector: string;
  timerInterval: number;
  // 新字段：双按钮选择器
  queryButtonSelector: string;
  nextPageButtonSelector: string;
  // iframe选择器，用于在iframe中查找元素
  iframeSelector?: string;
  // 新字段：双定时器间隔
  queryTimerInterval: number; // 分钟
  nextPageTimerInterval: number; // 秒
  // 其他字段
  listenUrl: string;
  submitUrl: string;
  dataProcessingMethod: string;
  customScript: string;
  extractField?: string; // 提取字段路径
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
  buttonType?: 'query' | 'nextPage'; // 按钮类型：查询按钮或下一页按钮
  isXPath?: boolean; // 是否使用XPath选择器，默认为false，表示使用CSS选择器
  iframeSelector?: string; // iframe选择器，指定要在哪个iframe中查找元素
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
