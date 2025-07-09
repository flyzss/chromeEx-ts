// debugger.ts
// 提供Chrome调试器API相关的类型定义

/**
 * 调试器请求发送事件参数
 */
export interface DebuggerRequestWillBeSentParams {
  requestId: string;
  request: {
    url: string;
    method: string;
    headers: Record<string, string>;
    postData?: string;
  };
  url: string;
  method: string;
  headers: Record<string, string>;
  postData?: string;
  timestamp: number;
  initiator?: {
    type: string;
  };
  type?: string;
}

/**
 * 调试器响应接收事件参数
 */
export interface DebuggerResponseReceivedParams {
  requestId: string;
  response: {
    url: string;
    status: number;
    statusText: string;
    headers: Record<string, string>;
    mimeType: string;
    connectionReused?: boolean;
    connectionId?: number;
    encodedDataLength?: number;
    fromDiskCache?: boolean;
    fromServiceWorker?: boolean;
    timing?: any;
  };
  timestamp: number;
}

/**
 * 调试器加载完成事件参数
 */
export interface DebuggerLoadingFinishedParams {
  requestId: string;
  timestamp: number;
  encodedDataLength: number;
}

/**
 * 调试器响应体
 */
export interface DebuggerResponseBody {
  body: string;
  base64Encoded: boolean;
}

/**
 * 保存活动标签页信息及其debugger状态
 */
export interface DebuggeeTab {
  tabId: number;
  attached: boolean;
  url: string;
  networkRequestIds: Set<string>; // 正在监控的网络请求ID集合
}

/**
 * 扩展内部使用的请求数据类型
 */
export interface RequestData {
  url: string;
  method: string;
  timestamp: string;
  status: number;
  statusCode?: number;
  requestHeaders: Record<string, string>;
  responseHeaders?: Record<string, string>;
  requestBody?: string;
  responseBody?: string;
  contentType?: string;
  tabId?: number;
  headers?: Record<string, string>;
  // 标记响应体是否已经准备就绪，用于解决时序问题
  responseBodyReady?: boolean;
}
