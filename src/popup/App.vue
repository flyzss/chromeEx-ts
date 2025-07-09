<template>
  <div>
    <!-- 同意区域 -->
    <div v-if="!hasConsent" id="consentArea" class="container" style="padding-bottom: 15px;">
      <h2>使用前确认</h2>
      <p style="font-size: 0.9em;">请仔细阅读并同意以下 <a href="#disclaimerTitle" @click="scrollToDisclaimer">免责声明</a> 的全部条款后方可使用本扩展。</p>
      <div>
        <input type="checkbox" id="consentCheckbox" v-model="consentChecked" style="margin-right: 5px;">
        <label for="consentCheckbox" style="font-size: 0.9em;">我已阅读、理解并完全同意免责声明的全部内容。</label>
      </div>
      <button :disabled="!consentChecked" @click="agreeToDisclaimer" style="margin-top: 10px; padding: 8px 15px;">确认同意并开始使用</button>
      <p v-show="showConsentError" style="color: red; font-size: 0.8em; margin-top: 5px;">请先勾选同意框。</p>
    </div>

    <hr v-if="!hasConsent" style="margin-top: 20px; margin-bottom: 10px;">
    <div v-if="!hasConsent" class="disclaimer" style="font-size: 0.8em; color: #555; text-align: justify;">
      <p><strong id="disclaimerTitle">免责声明</strong></p>
      <p style="margin-top: 8px;">本扩展程序是一款为用户提供自定义网页自动化操作的专业工具。其核心设计目的是帮助用户在个人授权、完全符合所有适用法律法规及相关网站服务条款的前提下，根据个性化需求配置并执行高效的网页自动化流程。</p>
      <p style="margin-top: 8px;">如同任何工具（例如厨房中的刀具），本扩展程序的最终用途完全取决于使用者。用户对如何配置本扩展程序以及通过它执行的所有操作（包括但不限于指定目标网站、定义操作规则、数据获取与处理、以及后续的数据使用和提交行为）承担全部且不可推卸的责任。</p>
      <p style="margin-top: 8px;">使用本扩展程序时，用户必须确保所有行为严格遵守当地及国际间的各项法律法规，包括但不限于《中华人民共和国网络安全法》、《中华人民共和国个人信息保护法》、《通用数据保护条例》(GDPR)、《加州消费者隐私法》(CCPA)等适用的数据保护和隐私规定，并充分尊重及遵守目标网站的服务条款、隐私政策以及相关的版权和数据保护规定。</p>
      <p style="margin-top: 8px;">将本扩展程序用于任何非法目的（侵犯他人隐私、恶意攻击、违反网站使用协议等）、或任何可能侵犯第三方合法权益、或违背社会公德的行为，均非本扩展程序的设计初衷，也非开发者所支持或认可。对于用户任何形式的非法使用、不当使用或滥用本扩展程序导致的一切法律纠纷、经济损失或其他不良后果，开发者不承担任何形式的责任。</p>
      <p style="margin-top: 8px;">通过勾选上方同意框并点击"确认同意并开始使用"按钮，即表示您已仔细阅读、充分理解并完全接受本免责声明的全部条款。您承诺将以合法、合规、道德且负责任的方式使用本工具，并自行承担因使用本工具可能涉及的包括但不限于GDPR、CCPA在内的所有相关法律法规的合规责任。您的同意状态及时间将被系统记录。</p>
    </div>

    <!-- 主应用区域 -->
    <div v-if="hasConsent" class="container">
      <h2>配置</h2>

      <div class="form-group">
        <label for="targetUrl">目标网页URL (可选):</label>
        <input type="url" id="targetUrl" v-model="config.targetUrl" placeholder="例如: https://example.com">
      </div>

      <div class="form-group">
        <label for="queryButtonSelector">查询按钮选择器 (必填):</label>
        <input type="text" id="queryButtonSelector" v-model="config.queryButtonSelector" placeholder="例如: #search-button 或 button.search-btn" />
      </div>

      <div class="form-group">
        <label for="iframeSelector">iframe选择器 (可选):</label>
        <input type="text" id="iframeSelector" v-model="config.iframeSelector" placeholder="例如: #main-iframe 或 iframe[name='content']" />
        <small>如果目标元素在iframe中，请指定iframe选择器，留空则在主页面查找</small>
      </div>

      <div class="form-group">
        <label for="nextPageButtonSelector">下一页按钮选择器 (必填):</label>
        <input type="text" id="nextPageButtonSelector" v-model="config.nextPageButtonSelector" placeholder="例如: #next-page-button 或 button.next-btn" />
      </div>

      <div class="form-group">
        <label for="queryTimerInterval">查询定时器间隔 (分钟):</label>
        <input type="number" id="queryTimerInterval" v-model.number="config.queryTimerInterval" min="1" placeholder="例如: 20" />
        <small>每隔多少分钟点击一次查询按钮</small>
      </div>

      <div class="form-group">
        <label for="nextPageTimerInterval">翻页定时器间隔 (秒):</label>
        <input type="number" id="nextPageTimerInterval" v-model.number="config.nextPageTimerInterval" min="1" placeholder="例如: 10" />
        <small>查询后每隔多少秒点击一次下一页按钮</small>
      </div>

      <div class="form-group">
        <label for="listenUrl">监听的服务器URL/模式:</label>
        <input type="text" id="listenUrl" v-model="config.listenUrl" placeholder="例如: *://api.example.com/data*">
      </div>

      <div class="form-group">
        <label for="submitUrl">数据提交URL:</label>
        <input type="url" id="submitUrl" v-model="config.submitUrl" placeholder="例如: https://your-server.com/api/submit">
      </div>

      <div class="form-group">
        <label for="dataProcessingMethod">数据整理方法:</label>
        <select id="dataProcessingMethod" v-model="config.dataProcessingMethod">
          <option value="none">不整理</option>
          <option value="extractJsonField">提取特定JSON字段</option>
          <option value="customScript">自定义脚本</option>
        </select>
      </div>

      <div class="form-group" v-show="config.dataProcessingMethod === 'extractJsonField'">
        <label for="extractField">提取字段:</label>
        <input type="text" id="extractField" v-model="config.extractField" placeholder="例如: data.result.records">
      </div>

      <div class="form-group" v-show="config.dataProcessingMethod === 'customScript'">
        <label for="customScript">自定义整理脚本 (JavaScript):</label>
        <textarea id="customScript" v-model="config.customScript" rows="5" placeholder="// responseData 是捕获到的响应体
// return processedData;"></textarea>
      </div>

      <h2>控制</h2>
      <div class="controls">
        <button @click="startTask" :disabled="isRunning">启动</button>
        <button @click="stopTask" :disabled="!isRunning">停止</button>
      </div>

      <div class="status">
        <p>状态: <span>{{ status }}</span></p>
        <p>下次执行: <span>{{ nextRunDisplay }}</span></p>
      </div>

      <div class="logs">
        <h3>日志:</h3>
        <pre>{{ logs }}</pre>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { watch } from 'vue';
import { defineComponent, ref, onMounted, onUnmounted } from 'vue';

// 定义配置接口
interface Config {
  targetUrl: string;
  queryButtonSelector: string;
  nextPageButtonSelector: string;
  iframeSelector: string; // iframe选择器，留空则在主页面查找元素
  queryTimerInterval: number; // 分钟为单位
  nextPageTimerInterval: number; // 秒为单位
  listenUrl: string;
  submitUrl: string;
  dataProcessingMethod: string;
  extractField: string;
  customScript: string;
}

// 定义状态消息接口
interface StatusMessage {
  command?: string;
  status?: string;
  isRunning?: boolean;
  nextRunTime?: number;
  error?: string;
}

// 定义日志消息接口
interface LogMessage {
  command?: string;
  message: string;
}

export default defineComponent({
  name: 'App',
  setup() {
    // 同意相关状态
    const hasConsent = ref(false);
    const consentChecked = ref(false);
    const showConsentError = ref(false);
    
    // 应用状态
    const isRunning = ref(false);
    const status = ref('未运行');
    const nextRunDisplay = ref('N/A');
    const showLogs = ref(false);
    const logs = ref('');
    
    // 配置数据
    const config = ref<Config>({
      targetUrl: '',
      queryButtonSelector: '',
      nextPageButtonSelector: '',
      iframeSelector: '', // iframe选择器初始值为空，表示在主页面查询
      queryTimerInterval: 20, // 默认20分钟查询一次
      nextPageTimerInterval: 10, // 默认每10秒翻页一次
      listenUrl: '',
      submitUrl: '',
      dataProcessingMethod: 'none',
      extractField: 'data.result.records',
      customScript: ''
    });
    
    // 滚动到免责声明
    const scrollToDisclaimer = () => {
      document.getElementById('disclaimerTitle')?.scrollIntoView({ behavior: 'smooth' });
    };
    
    // 同意免责声明
    const agreeToDisclaimer = () => {
      if (!consentChecked.value) {
        showConsentError.value = true;
        return;
      }
      
      const timestamp = Date.now();
      chrome.storage.local.set({ disclaimerAgreedTimestamp: timestamp }, () => {
        hasConsent.value = true;
        loadConfig(); // 加载配置
      });
    };
    
    // 加载配置
    const loadConfig = () => {
      chrome.storage.local.get(['config'], (result) => {
        if (result.config) {
          // 直接将存储的配置合并到当前配置
          Object.assign(config.value, result.config);
          addLog('已加载配置。');
        }
      });
    };
    
    // 保存配置
    const saveConfig = async () => {
      // 验证必填字段
      if (!config.value.queryButtonSelector || !config.value.nextPageButtonSelector || !config.value.listenUrl || !config.value.submitUrl) {
        addLog('错误: 查询按钮选择器, 下一页按钮选择器, 监听URL, 和提交URL 不能为空。');
        showLogs.value = true;
        //return null;
      }
      
      // 确保定时器间隔不小于1
      config.value.queryTimerInterval = Math.max(1, config.value.queryTimerInterval || 20);
      config.value.nextPageTimerInterval = Math.max(1, config.value.nextPageTimerInterval || 10);
      
      // 保存配置到本地存储
      return new Promise<Config | null>((resolve) => {
        chrome.storage.local.set({ config: config.value }, () => {
          if (chrome.runtime.lastError) {
            addLog(`配置保存失败: ${chrome.runtime.lastError.message}`);
            resolve(null);
          } else {
            addLog('配置已保存。');
            resolve(config.value);
          }
        });
      });
    };
    
    // 添加日志
    const addLog = (message: string) => {
      const timestamp = new Date().toLocaleTimeString();
      logs.value = `[${timestamp}] ${message}\n${logs.value}`;
      showLogs.value = true;
    };
    
    // 启动任务
    const startTask = async () => {
      const savedConfig = await saveConfig();
      if (!savedConfig) return;
      
      chrome.runtime.sendMessage({ command: 'start', config: savedConfig }, (response: StatusMessage | undefined) => {
        if (response && response.status === 'started') {
          isRunning.value = true;
          status.value = '启动中...';
          addLog('任务已启动。');
          addLog(`查询按钮定时器已设置为每 ${savedConfig.queryTimerInterval} 分钟触发。`);
          addLog(`下一页按钮定时器已设置为每 ${savedConfig.nextPageTimerInterval} 秒触发。`);
        } else if (response && response.error) {
          addLog(`启动失败: ${response.error}`);
        } else {
          addLog('启动请求发送失败或未收到响应。');
        }
      });
    };
    
    // 停止任务
    const stopTask = () => {
      chrome.runtime.sendMessage({ command: 'stop' }, (response: StatusMessage | undefined) => {
        if (response && response.status === 'stopped') {
          isRunning.value = false;
          status.value = '已停止';
          addLog('任务已停止。查询按钮和下一页按钮定时器均已关闭。');
        } else if (response && response.error) {
          addLog(`停止失败: ${response.error}`);
        } else {
          addLog('停止请求发送失败或未收到响应。');
        }
      });
    };
    
    // 处理来自background的消息
    const handleMessages = (message: StatusMessage | LogMessage) => {
      if (message.command === 'updateStatus') {
        const statusMsg = message as StatusMessage;
        status.value = statusMsg.status || (statusMsg.isRunning ? '运行中' : '未运行');
        
        if (statusMsg.nextRunTime) {
          nextRunDisplay.value = new Date(statusMsg.nextRunTime).toLocaleString();
        } else {
          nextRunDisplay.value = 'N/A';
        }
        
        isRunning.value = !!statusMsg.isRunning;
      } else if (message.command === 'log') {
        const logMsg = message as LogMessage;
        addLog(logMsg.message);
      }
    };
    
    // 组件挂载时
    onMounted(() => {
      // 检查同意状态
      chrome.storage.local.get(['disclaimerAgreedTimestamp'], (result) => {
        if (result.disclaimerAgreedTimestamp) {
          hasConsent.value = true;
          loadConfig(); // 加载配置
        }
      });
      
      // 添加消息监听器
      chrome.runtime.onMessage.addListener(handleMessages);
      
      // 获取当前运行状态
      chrome.runtime.sendMessage({ command: 'getStatus' }, (response: StatusMessage | undefined) => {
        if (response) {
          status.value = response.status || (response.isRunning ? '运行中' : '未运行');
          isRunning.value = !!response.isRunning;
          
          if (response.nextRunTime) {
            nextRunDisplay.value = new Date(response.nextRunTime).toLocaleString();
          }
          
          if (isRunning.value) {
            addLog('检测到任务正在运行中。');
          }
        }
      });
    });
    watch(config.value, (v:any) => {
      console.log('配置发生变化:', v);
      saveConfig();
    }, { deep: true });
    
    // 组件卸载时
    onUnmounted(() => {
      // 保存配置
      saveConfig();
      
      // 移除消息监听器
      chrome.runtime.onMessage.removeListener(handleMessages);
    });
    
    return {
      // 同意相关
      hasConsent,
      consentChecked,
      showConsentError,
      scrollToDisclaimer,
      agreeToDisclaimer,
      
      // 配置和状态
      config,
      isRunning,
      status,
      nextRunDisplay,
      showLogs,
      logs,
      
      // 方法
      startTask,
      stopTask,
      loadConfig,
      saveConfig,
      addLog
    };
  }
});
</script>

<style>
/* 可以从popup.css中导入样式，或直接定义在这里 */
.logs {
  height: 300px;
  overflow-y: scroll;
}
</style>
