import { NetworkResponseData } from '../../types';

/**
 * 发送网络请求数据到background script
 * @param data 捕获的网络响应数据
 */
export function sendNetworkData(data: NetworkResponseData): void {
  chrome.runtime.sendMessage({
    command: 'networkRequestCaptured',
    data
  });
}

// 创建一个自定义事件类型，用于页面脚本和Content Script通信
const FETCH_RESPONSE_EVENT = 'st_extension_fetch_response';

/**
 * 将对象转换为可以在事件中传递的JSON字符串
 * @param obj 要转换的对象
 */
function safeStringify(obj: any): string {
  try {
    return JSON.stringify(obj);
  } catch (e) {
    return JSON.stringify({ error: '无法序列化的对象' });
  }
}

/**
 * 使用脚本注入方式设置fetch钩子，用于监听并获取网络请求和响应
 * @param urlFilterPattern 用于过滤URL的正则表达式模式
 */
export function setupFetchHook(urlFilterPattern: string|undefined): void {
  console.log('[ST Extension] 设置fetch钩子，过滤模式：', urlFilterPattern?.toString());
  
  // 1. 创建一个事件监听器，用于接收来自页面脚本的网络请求数据
  document.addEventListener(FETCH_RESPONSE_EVENT, ((event: CustomEvent) => {
    try {
      const responseData: NetworkResponseData = JSON.parse(event.detail);
      console.log('[ST Extension] 接收到页面fetch事件:', responseData.url);
      
      // 根据URL过滤模式决定是否发送到background script
      if (urlFilterPattern && responseData.url.includes(urlFilterPattern)) {
        sendNetworkData(responseData);
      }
    } catch (error) {
      console.error('[ST Extension] 处理fetch事件时出错:', error);
    }
  }) as EventListener);
  
  // 2. 使用chrome.runtime.getURL获取钩子脚本路径
  const scriptUrl = chrome.runtime.getURL('fetchHook.js');
  const script = document.createElement('script');
  script.src = scriptUrl;
  script.onload = () => {
    console.log('[ST Extension] Fetch钩子脚本加载完成');
    // 加载后从DOM中移除脚本标签（可选）
    script.remove();
  };
  script.onerror = (error) => {
    console.error('[ST Extension] Fetch钩子脚本加载失败:', error);
  };
  
  // 注入到页面中
  (document.head || document.documentElement).appendChild(script);
  console.log('[ST Extension] 已注入Fetch钩子脚本:', scriptUrl);
}
