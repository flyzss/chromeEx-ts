// content.ts
// 该脚本在匹配的网页上下文中运行，负责与页面DOM交互和网络请求监听。
// 重构版本：使用模块化结构提高可读性和可维护性

import { setupFetchHook } from './content/modules/fetchHook';
import { setupXhrHook } from './content/modules/xhrHook';
import { setupMessageListener, getConfigFromBackground } from './content/modules/messageManager';

// 初始化消息监听器(包含点击按钮功能)
setupMessageListener();

// 从background script获取配置并设置网络请求钩子
getConfigFromBackground()
  .then((config: {listenUrl?: string, [key: string]: any}) => {
    if (config && config.listenUrl) {
      // 将监听URL模式转换为正则表达式，并直接传递给钩子函数
      const urlFilterPattern = config.listenUrl;
      
      // 配置获取成功后设置钩子
      setupFetchHook(urlFilterPattern);
      setupXhrHook(urlFilterPattern);
      
      console.log('[ST Extension] 网络请求监听启动，过滤模式：', config.listenUrl);
    } else {
      // 未配置监听URL，不启用监听
      console.log('[ST Extension] 未配置监听URL，不启用网络请求监听');
    }
  })
  .catch((error: Error) => {
    console.error('[ST Extension] 获取配置失败：', error);
  });

// 注意：所有的消息监听逻辑已移至messageManager.ts模块中
