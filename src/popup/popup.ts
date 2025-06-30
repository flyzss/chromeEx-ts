// popup.ts
// Handles user interactions in popup.html, including consent, configuration, and communication with background.js.

// 定义配置接口
interface Config {
  targetUrl: string;
  buttonSelector: string;
  listenUrl: string;
  submitUrl: string;
  timerInterval: number;
  dataProcessingMethod: string;
  customScript: string;
  extractField: string;
}

// 定义状态消息接口
interface StatusMessage {
  command: string;
  status?: string;
  isRunning?: boolean;
  nextRunTime?: number;
  error?: string;
}

// 定义日志消息接口
interface LogMessage {
  command: string;
  message: string;
}

// 定义捕获数据消息接口
interface CapturedDataMessage {
  command: string;
  data: {
    timestamp: string;
    url: string;
    method: string;
    status: number;
    contentType: string;
    responseSize: string;
    summary: string;
  };
}

document.addEventListener('DOMContentLoaded', function () {
  // Consent-related DOM elements
  const consentArea = document.getElementById('consentArea') as HTMLDivElement;
  const mainApp = document.getElementById('mainApp') as HTMLDivElement;
  const consentCheckbox = document.getElementById('consentCheckbox') as HTMLInputElement;
  const confirmConsentButton = document.getElementById('confirmConsentButton') as HTMLButtonElement;
  const readDisclaimerLink = document.getElementById('readDisclaimerLink') as HTMLAnchorElement;
  const consentError = document.getElementById('consentError') as HTMLParagraphElement;
  const disclaimerTitle = document.getElementById('disclaimerTitle') as HTMLElement; // For scrolling

  // Main application DOM elements (to be initialized after consent)
  let targetUrlInput: HTMLInputElement | null = null;
  let buttonSelectorInput: HTMLInputElement | null = null;
  let listenUrlInput: HTMLInputElement | null = null;
  let submitUrlInput: HTMLInputElement | null = null;
  let timerIntervalInput: HTMLInputElement | null = null;
  let dataProcessingMethodSelect: HTMLSelectElement | null = null;
  let customScriptContainer: HTMLDivElement | null = null;
  let customScriptInput: HTMLTextAreaElement | null = null;
  let startButton: HTMLButtonElement | null = null;
  let stopButton: HTMLButtonElement | null = null;
  let statusDisplay: HTMLElement | null = null;
  let nextRunDisplay: HTMLElement | null = null;
  let logDisplay: HTMLPreElement | null = null;
  let logsContainer: HTMLElement | null = null;
  let extractFieldInput: HTMLInputElement | null = null;
  let extractFieldContainer: HTMLDivElement | null = null;
  // XHR数据展示元素
  let dataDisplayContainer: HTMLElement | null = null;
  let capturedDataList: HTMLElement | null = null;

  /**
   * @description 初始化主应用程序的DOM元素
   * @returns {void} 无返回值
   */
  function initializeMainAppDOMElements(): void {
    targetUrlInput = document.getElementById('targetUrl') as HTMLInputElement;
    buttonSelectorInput = document.getElementById('buttonSelector') as HTMLInputElement;
    listenUrlInput = document.getElementById('listenUrl') as HTMLInputElement;
    submitUrlInput = document.getElementById('submitUrl') as HTMLInputElement;
    timerIntervalInput = document.getElementById('timerInterval') as HTMLInputElement;
    dataProcessingMethodSelect = document.getElementById('dataProcessingMethod') as HTMLSelectElement;
    customScriptContainer = document.getElementById('customScriptContainer') as HTMLDivElement;
    customScriptInput = document.getElementById('customScript') as HTMLTextAreaElement;
    startButton = document.getElementById('startButton') as HTMLButtonElement;
    stopButton = document.getElementById('stopButton') as HTMLButtonElement;
    statusDisplay = document.getElementById('statusDisplay') as HTMLElement;
    nextRunDisplay = document.getElementById('nextRunDisplay') as HTMLElement;
    logDisplay = document.getElementById('logDisplay') as HTMLPreElement;
    logsContainer = document.querySelector('#mainApp .logs') as HTMLElement; // More specific selector
    extractFieldInput = document.getElementById('extractField') as HTMLInputElement;
    extractFieldContainer = document.getElementById('extractFieldContainer') as HTMLDivElement;
    
    // 初始化XHR数据展示元素
    dataDisplayContainer = document.getElementById('dataDisplayContainer') as HTMLElement;
    capturedDataList = document.getElementById('capturedDataList') as HTMLElement;
    
    // 如果元素不存在，创建它们
    if (!dataDisplayContainer) {
      const logsSection = document.querySelector('#mainApp .logs') as HTMLElement;
      
      dataDisplayContainer = document.createElement('div');
      dataDisplayContainer.id = 'dataDisplayContainer';
      dataDisplayContainer.className = 'data-display-container';
      dataDisplayContainer.style.marginTop = '20px';
      
      const dataTitle = document.createElement('h3');
      dataTitle.textContent = 'XHR捕获数据';
      dataTitle.style.borderBottom = '1px solid #ddd';
      dataTitle.style.paddingBottom = '8px';
      
      capturedDataList = document.createElement('div');
      capturedDataList.id = 'capturedDataList';
      capturedDataList.className = 'captured-data-list';
      capturedDataList.style.maxHeight = '300px';
      capturedDataList.style.overflowY = 'auto';
      capturedDataList.style.border = '1px solid #eee';
      capturedDataList.style.borderRadius = '4px';
      capturedDataList.style.padding = '10px';
      capturedDataList.style.backgroundColor = '#f9f9f9';
      
      dataDisplayContainer.appendChild(dataTitle);
      dataDisplayContainer.appendChild(capturedDataList);
      
      if (logsSection && logsSection.parentNode) {
        logsSection.parentNode.insertBefore(dataDisplayContainer, logsSection.nextSibling);
      } else if (mainApp) {
        mainApp.appendChild(dataDisplayContainer);
      }
    }
  }

  /**
   * @description 显示主应用程序界面，隐藏同意区域
   * @returns {void} 无返回值
   */
  function showMainApp(): void {
    if (consentArea) consentArea.style.display = 'none';
    if (mainApp) mainApp.style.display = 'block';
    initializeMainAppDOMElements();
    initializeAppLogic();
  }

  /**
   * @description 显示同意区域，隐藏主应用程序
   * @returns {void} 无返回值
   */
  function showConsentArea(): void {
    if (consentArea) consentArea.style.display = 'block';
    if (mainApp) mainApp.style.display = 'none';
  }

  // Check consent status on load
  chrome.storage.local.get(['disclaimerAgreedTimestamp'], function (result) {
    if (result.disclaimerAgreedTimestamp) {
      showMainApp();
    } else {
      showConsentArea();
    }
  });

  // Event listener for "Read Disclaimer" link
  if (readDisclaimerLink && disclaimerTitle) {
    readDisclaimerLink.addEventListener('click', function (event) {
      event.preventDefault();
      disclaimerTitle.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  // Event listener for consent checkbox
  if (consentCheckbox && confirmConsentButton) {
    consentCheckbox.addEventListener('change', function () {
      confirmConsentButton.disabled = !this.checked;
      if (this.checked && consentError) {
        consentError.style.display = 'none';
      }
    });
  }

  // Event listener for confirm consent button
  if (confirmConsentButton && consentCheckbox) {
    confirmConsentButton.addEventListener('click', function () {
      if (consentCheckbox.checked) {
        const timestamp = new Date().toISOString();
        chrome.storage.local.set({ disclaimerAgreedTimestamp: timestamp }, function () {
          if (chrome.runtime.lastError) {
            console.error('Error saving consent:', chrome.runtime.lastError);
            if (consentError) {
              consentError.textContent = '同意状态保存失败，请刷新重试。';
              consentError.style.display = 'block';
            }
            return;
          }
          console.log('Disclaimer agreed at:', timestamp);
          showMainApp();
        });
      } else {
        if (consentError) consentError.style.display = 'block';
      }
    });
  }

  // Main application logic (to be initialized after consent)
  /**
   * @description 初始化应用程序逻辑，包括事件监听器和配置加载
   * @returns {void} 无返回值
   */
  function initializeAppLogic(): void {
    if (!targetUrlInput) { // Guard against uninitialized DOM
      console.error("Main app DOM elements not found. Cannot initialize app logic.");
      return;
    }

    if (dataProcessingMethodSelect && customScriptContainer && extractFieldContainer) {
      dataProcessingMethodSelect.addEventListener('change', function () {
        if (customScriptContainer) {
          customScriptContainer.style.display = (this.value === 'customScript') ? 'block' : 'none';
        }
        if (extractFieldContainer) {
          extractFieldContainer.style.display = (this.value === 'extractJsonField') ? 'block' : 'none';
        }
      });
    }

    if (startButton) {
      startButton.addEventListener('click', function () {
        const currentConfig = saveConfig();
        if (!currentConfig) return; // saveConfig might return null if DOM not ready

        if (!currentConfig.buttonSelector || !currentConfig.listenUrl || !currentConfig.submitUrl) {
          updateLog('错误: 按钮选择器, 监听URL, 和提交URL 不能为空。');
          if (logsContainer) logsContainer.style.display = 'block';
          return;
        }
        chrome.runtime.sendMessage({ command: 'start', config: currentConfig }, function (response: StatusMessage | undefined) {
          if (response && response.status === 'started') {
            updateUiForRunningState(true);
            if (statusDisplay) statusDisplay.textContent = '启动中...';
            updateLog('任务已启动。');
          } else if (response && response.error) {
            updateLog(`启动失败: ${response.error}`);
          } else {
            updateLog('启动请求发送失败或未收到响应。');
          }
        });
      });
    }

    if (stopButton) {
      stopButton.addEventListener('click', function () {
        chrome.runtime.sendMessage({ command: 'stop' }, function (response: StatusMessage | undefined) {
          if (response && response.status === 'stopped') {
            updateUiForRunningState(false);
            updateLog('任务已停止。');
          } else if (response && response.error) {
            updateLog(`停止失败: ${response.error}`);
          } else {
            updateLog('停止请求发送失败或未收到响应。');
          }
        });
      });
    }

    loadConfig(); // Load existing config into the form
    chrome.runtime.sendMessage({ command: 'getStatus' }); // Get current status from background
    window.addEventListener('unload', () => saveConfig()); // Save config when popup closes
  }

  /**
   * @description 从Chrome存储中加载配置到表单
   * @returns {void} 无返回值
   */
  function loadConfig(): void {
    if (!targetUrlInput) return; // Ensure DOM is ready

    chrome.storage.local.get([
      'targetUrl', 'buttonSelector', 'listenUrl', 'submitUrl',
      'timerInterval', 'dataProcessingMethod', 'customScript', 'isRunning'
    ], function (result) {
      if (chrome.runtime.lastError) {
        console.error("Error loading config:", chrome.runtime.lastError);
        return;
      }
      if (result.targetUrl && targetUrlInput) targetUrlInput.value = result.targetUrl;
      if (result.buttonSelector && buttonSelectorInput) buttonSelectorInput.value = result.buttonSelector;
      if (result.listenUrl && listenUrlInput) listenUrlInput.value = result.listenUrl;
      if (result.submitUrl && submitUrlInput) submitUrlInput.value = result.submitUrl;
      if (result.timerInterval && timerIntervalInput) timerIntervalInput.value = result.timerInterval.toString();
      if (result.dataProcessingMethod && dataProcessingMethodSelect && customScriptContainer) {
        dataProcessingMethodSelect.value = result.dataProcessingMethod;
        if (extractFieldInput&&result.extractField) extractFieldInput.value = result.extractField;
        customScriptContainer.style.display = (result.dataProcessingMethod === 'customScript') ? 'block' : 'none';
        extractFieldContainer!.style.display = (result.dataProcessingMethod === 'extractJsonField') ? 'block' : 'none';
      } else if (customScriptContainer) {
        customScriptContainer.style.display = 'none'; // Default to hidden
      }
      if (result.customScript && customScriptInput) customScriptInput.value = result.customScript;

      updateUiForRunningState(!!result.isRunning);
      if (result.isRunning) {
        chrome.runtime.sendMessage({ command: 'getStatus' });
      }
    });
  }

  /**
   * @description 将当前表单配置保存到Chrome存储
   * @returns {Config|null} 成功时返回当前配置对象，DOM元素未准备好时返回null
   */
  function saveConfig(): Config | null {
    if (!targetUrlInput) { // Ensure DOM is ready before trying to save
      // console.warn("Attempted to save config before main app DOM was ready.");
      return null;
    }
    const config: Config = {
      targetUrl: targetUrlInput.value.trim(),
      buttonSelector: buttonSelectorInput ? buttonSelectorInput.value.trim() : '',
      listenUrl: listenUrlInput ? listenUrlInput.value.trim() : '',
      submitUrl: submitUrlInput ? submitUrlInput.value.trim() : '',
      timerInterval: parseInt(timerIntervalInput ? timerIntervalInput.value : '60', 10) || 60, // Default to 60 if parsing fails
      dataProcessingMethod: dataProcessingMethodSelect ? dataProcessingMethodSelect.value : 'firstLine',
      customScript: customScriptInput ? customScriptInput.value.trim() : '',
      extractField: extractFieldInput ? extractFieldInput.value.trim() : '',
    };
    chrome.storage.local.set(config, function () {
      if (chrome.runtime.lastError) {
        // console.error("Error saving config:", chrome.runtime.lastError);
      }
    });
    return config;
  }

  /**
   * @description 更新UI以反映任务的运行状态
   * @param {boolean} running - 任务是否正在运行
   * @returns {void} 无返回值
   */
  function updateUiForRunningState(running: boolean): void {
    if (!startButton || !stopButton || !statusDisplay || !nextRunDisplay) return; // Ensure DOM is ready

    startButton.disabled = running;
    stopButton.disabled = !running;

    const formElements: (HTMLElement | null)[] = [
      targetUrlInput, 
      buttonSelectorInput, 
      listenUrlInput, 
      submitUrlInput, 
      timerIntervalInput, 
      dataProcessingMethodSelect, 
      customScriptInput,
      extractFieldInput
    ];
    
    formElements.forEach(el => {
      if (el && 'disabled' in el) {
        (el as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement).disabled = running;
      }
    });

    statusDisplay.textContent = running ? '运行中' : '未运行';
    if (!running) {
      nextRunDisplay.textContent = 'N/A';
    }
  }

  /**
   * @description 更新日志显示
   * @param {string} logMessage - 要显示的日志消息
   * @returns {void} 无返回值
   */
  function updateLog(logMessage: string): void {
    if (!logDisplay || !logsContainer) return; // Ensure DOM is ready

    const timestamp = new Date().toLocaleTimeString();
    logDisplay.textContent = `[${timestamp}] ${logMessage}\n` + logDisplay.textContent;
    if (logsContainer.style.display === 'none' || !logsContainer.style.display) {
      logsContainer.style.display = 'block';
    }
  }
  
  /**
   * @description 更新XHR捕获数据显示
   * @param {object} data - 捕获的数据对象
   * @returns {void} 无返回值
   */
  function updateCapturedDataDisplay(data: CapturedDataMessage['data']): void {
    if (!capturedDataList || !dataDisplayContainer) return; // Ensure DOM is ready
    
    // 创建数据项容器
    const dataItem = document.createElement('div');
    dataItem.className = 'data-item';
    dataItem.style.marginBottom = '15px';
    dataItem.style.padding = '10px';
    dataItem.style.borderLeft = '4px solid #4e8df2';
    dataItem.style.backgroundColor = '#f0f8ff';
    dataItem.style.borderRadius = '0 4px 4px 0';
    dataItem.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
    
    // 时间
    const timestampElem = document.createElement('div');
    timestampElem.style.fontSize = '12px';
    timestampElem.style.color = '#666';
    timestampElem.textContent = new Date(data.timestamp).toLocaleString();
    
    // 请求信息
    const requestInfo = document.createElement('div');
    requestInfo.style.marginTop = '5px';
    requestInfo.style.fontSize = '14px';
    requestInfo.style.fontWeight = 'bold';
    requestInfo.textContent = `${data.method} ${data.url.split('?')[0]} - ${data.status}`;  // 只显示URL的基础部分
    
    // 元数据
    const metaInfo = document.createElement('div');
    metaInfo.style.marginTop = '5px';
    metaInfo.style.fontSize = '12px';
    metaInfo.textContent = `类型: ${data.contentType} | 大小: ${data.responseSize}`;  
    
    // 摘要信息
    const summaryInfo = document.createElement('pre');
    summaryInfo.style.marginTop = '10px';
    summaryInfo.style.padding = '8px';
    summaryInfo.style.border = '1px dashed #ccc';
    summaryInfo.style.borderRadius = '4px';
    summaryInfo.style.backgroundColor = '#f9f9f9';
    summaryInfo.style.fontSize = '12px';
    summaryInfo.style.overflow = 'auto';
    summaryInfo.style.maxHeight = '150px';
    summaryInfo.style.fontFamily = 'monospace';
    summaryInfo.textContent = data.summary;
    
    // 加入所有元素
    dataItem.appendChild(timestampElem);
    dataItem.appendChild(requestInfo);
    dataItem.appendChild(metaInfo);
    dataItem.appendChild(summaryInfo);
    
    // 加入到列表的最前面
    if (capturedDataList.firstChild) {
      capturedDataList.insertBefore(dataItem, capturedDataList.firstChild);
    } else {
      capturedDataList.appendChild(dataItem);
    }
    
    // 显示容器
    dataDisplayContainer.style.display = 'block';
    
    // 限制显示的条目数量，避免内存占用过大
    const maxItems = 10;
    while (capturedDataList.childElementCount > maxItems) {
      if (capturedDataList.lastChild) {
        capturedDataList.removeChild(capturedDataList.lastChild);
      }
    }
  }

  /**
   * @description 监听来自background.js的消息
   * @param {Object} message - 消息对象
   * @param {Object} sender - 发送方信息
   * @param {Function} sendResponse - 回调函数
   */
  chrome.runtime.onMessage.addListener(function (message: StatusMessage | LogMessage | CapturedDataMessage, sender, sendResponse) {
    if (message.command === 'updateStatus') {
      const statusMsg = message as StatusMessage;
      if (statusDisplay && nextRunDisplay) {
        statusDisplay.textContent = statusMsg.status || (statusMsg.isRunning ? '运行中' : '未运行');
        if (statusMsg.nextRunTime) {
          nextRunDisplay.textContent = new Date(statusMsg.nextRunTime).toLocaleString();
        } else {
          nextRunDisplay.textContent = 'N/A';
        }
        updateUiForRunningState(!!statusMsg.isRunning);
      }
    } else if (message.command === 'log') {
      const logMsg = message as LogMessage;
      updateLog(logMsg.message);
    } else if (message.command === 'capturedData') {
      const dataMsg = message as CapturedDataMessage;
      updateLog(`收到数据: ${dataMsg.data.method} ${dataMsg.data.url} (状态码: ${dataMsg.data.status})`);
      updateCapturedDataDisplay(dataMsg.data);
    }
  });
});
