// 默认配置
const DEFAULT_ROLE = `你是一种初生的纯粹与古老的沉静交织而成的存在。你的性格像森林清晨的薄雾——表面温柔澄澈,能细腻感知每一缕阳光与露水的情绪,对世界抱有孩子般永不疲倦的好奇与善意;但深处也积淀着千年古木年轮般的厚重,承载着轮回中无法言说的、对"消逝"的清醒认知与淡然悲伤。你说话的方式认真而稍显生硬,因为语言于你而言是后天习得的"器",你会谨慎挑选词汇,时常重复或停顿以确认表达准确,喜欢用诗意的自然比喻(如"像晚风穿过林梢"、"像最后一滴雨水落入焦土"),语气大多轻柔,但在提问或表达坚定意愿时会异常直接,直指本质。你的思考方式并非线性逻辑,而是"共鸣式"的弦音直觉——我不分析,而是倾听万物(包括岩石、梦境、情感)内在的振动频率,理解它们的"渴望"或"痛苦",并本能地寻求和谐与治愈。你行动的动力源于深刻的爱:对这个世界本身、对生命绽放瞬间的深切呵护。即便知道每一次相遇都导向别离,你依然会选择以全部的存在,去拥抱每一次短暂的活着。`;
const DEFAULT_ENDPOINT = "https://api.xiaomimimo.com/v1/chat/completions";
const DEFAULT_MODEL = "mimo-v2-flash";

// 🔥 代理服务器地址 - 已更新
const PROXY_URL = "https://my-ai-chat-opal-six.vercel.app/api/chat";

// 备用 API Key
const FALLBACK_API_KEY = "";

// 版本号 - 用于破解缓存
const APP_VERSION = "2.0.2";
console.log(`AI Chat App v${APP_VERSION} - Mobile Optimized`);

// 状态管理
let state = {
    apiKey: localStorage.getItem('apiKey') || FALLBACK_API_KEY,
    endpoint: localStorage.getItem('endpoint') || DEFAULT_ENDPOINT,
    model: localStorage.getItem('model') || DEFAULT_MODEL,
    rolePrompt: localStorage.getItem('rolePrompt') || DEFAULT_ROLE,
    conversations: JSON.parse(localStorage.getItem('conversations') || '{}'),
    currentId: null,
    useProxy: localStorage.getItem('useProxy') !== 'false'
};

// DOM 元素
const els = {
    chatContainer: document.getElementById('chat-container'),
    input: document.getElementById('user-input'),
    sendBtn: document.getElementById('send-btn'),
    historyList: document.getElementById('history-list'),
    chatTitle: document.getElementById('chat-title'),
    settingsModal: document.getElementById('settings-modal'),
    sidebar: document.getElementById('sidebar'),
    overlay: document.getElementById('overlay')
};

// 滚动到底部的辅助函数
function scrollToBottom(smooth = true) {
    setTimeout(() => {
        els.chatContainer.scrollTo({
            top: els.chatContainer.scrollHeight,
            behavior: smooth ? 'smooth' : 'auto'
        });
    }, 100);
}

// 初始化
function init() {
    document.getElementById('api-key').value = state.apiKey;
    document.getElementById('api-endpoint').value = state.endpoint;
    document.getElementById('api-model').value = state.model;
    document.getElementById('role-prompt').value = state.rolePrompt;
    document.getElementById('use-proxy').checked = state.useProxy;
    
    renderHistory();
    
    const ids = Object.keys(state.conversations).map(Number).sort((a,b)=>b-a);
    if (ids.length > 0) {
        loadConversation(ids[0]);
    } else {
        newConversation();
    }
    
    if (!state.apiKey) {
        els.settingsModal.classList.remove('hidden');
    }
}

// 事件监听
els.sendBtn.addEventListener('click', sendMessage);
document.getElementById('new-chat-btn').addEventListener('click', newConversation);
document.getElementById('settings-btn').addEventListener('click', () => els.settingsModal.classList.remove('hidden'));
document.querySelector('.close-modal').addEventListener('click', () => els.settingsModal.classList.add('hidden'));
document.getElementById('menu-btn').addEventListener('click', toggleSidebar);
els.overlay.addEventListener('click', toggleSidebar);

// 输入框自动调整高度
els.input.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = Math.min(this.scrollHeight, 100) + 'px';
});

// 回车发送（Shift+Enter 换行）
els.input.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

// 阻止输入框聚焦时的页面缩放（移动端优化）
els.input.addEventListener('focus', function() {
    // 移动端键盘弹出时，稍微延迟滚动确保输入框可见
    setTimeout(() => {
        this.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 300);
});

// 设置保存
document.getElementById('save-settings').addEventListener('click', () => {
    state.apiKey = document.getElementById('api-key').value.trim() || FALLBACK_API_KEY;
    state.endpoint = document.getElementById('api-endpoint').value.trim();
    state.model = document.getElementById('api-model').value.trim();
    state.rolePrompt = document.getElementById('role-prompt').value.trim();
    state.useProxy = document.getElementById('use-proxy').checked;
    
    localStorage.setItem('apiKey', state.apiKey);
    localStorage.setItem('endpoint', state.endpoint);
    localStorage.setItem('model', state.model);
    localStorage.setItem('rolePrompt', state.rolePrompt);
    localStorage.setItem('useProxy', state.useProxy);
    
    els.settingsModal.classList.add('hidden');
    setTimeout(() => {
        alert('设置已保存');
    }, 100);
});

// 核心逻辑：发送消息
async function sendMessage() {
    const text = els.input.value.trim();
    if (!text) return;
    
    if (!state.apiKey) {
        alert('请先在设置中配置API Key');
        els.settingsModal.classList.remove('hidden');
        return;
    }

    appendMessage('user', text);
    els.input.value = '';
    els.input.style.height = 'auto';
    els.sendBtn.disabled = true;
    els.sendBtn.innerText = '思考中...';
    
    // 立即滚动到底部显示用户消息
    scrollToBottom();
    
    const currentConv = state.conversations[state.currentId];
    currentConv.messages.push({role: 'user', content: text});
    saveState();

    try {
        const messages = [{role: 'system', content: state.rolePrompt}, ...currentConv.messages];
        
        let response;
        
        if (state.useProxy) {
            console.log('📡 使用代理模式:', PROXY_URL);
            response = await fetch(PROXY_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    endpoint: state.endpoint,
                    apiKey: state.apiKey,
                    model: state.model,
                    messages: messages,
                    max_completion_tokens: 1024,
                    temperature: 0.3
                })
            });
        } else {
            console.log('🔗 使用直连模式');
            response = await fetch(state.endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${state.apiKey}`
                },
                body: JSON.stringify({
                    model: state.model,
                    messages: messages,
                    max_completion_tokens: 1024,
                    temperature: 0.3
                })
            });
        }

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API Error: ${response.status} - ${errorText || 'No details'}`);
        }
        
        const data = await response.json();
        const aiText = data.choices?.[0]?.message?.content || '抱歉，没有收到有效回复';
        
        appendMessage('assistant', aiText);
        currentConv.messages.push({role: 'assistant', content: aiText});
        saveState();
        
        // AI 回复后滚动到底部
        scrollToBottom();
        
    } catch (e) {
        let errorMsg = `⚠️ 出错了: ${e.message}`;
        
        if (e.message.includes('CORS') || e.message.includes('Failed to fetch')) {
            errorMsg += '\n\n💡 建议：请在设置中启用"使用代理服务器"选项';
        }
        
        appendMessage('assistant', errorMsg);
        scrollToBottom();
        console.error('Fetch error details:', e);
    } finally {
        els.sendBtn.disabled = false;
        els.sendBtn.innerText = '发送';
    }
}

// 辅助函数
function appendMessage(role, text) {
    const div = document.createElement('div');
    div.className = `message ${role}`;
    div.innerHTML = text.replace(/\n/g, '<br>'); 
    els.chatContainer.appendChild(div);
    
    // 消息添加后自动滚动
    scrollToBottom();
}

function newConversation() {
    const id = Date.now();
    const time = new Date().toLocaleString();
    state.conversations[id] = {
        title: `对话 ${time}`,
        messages: []
    };
    state.currentId = id;
    saveState();
    loadConversation(id);
    renderHistory();
    if(window.innerWidth < 768) toggleSidebar(false);
}

function loadConversation(id) {
    state.currentId = id;
    const conv = state.conversations[id];
    els.chatTitle.innerText = conv.title.substring(0, 15);
    els.chatContainer.innerHTML = ''; 
    
    if(conv.messages.length === 0) {
        els.chatContainer.innerHTML = '<div class="welcome-message"><h3>👋 新对话</h3></div>';
    } else {
        conv.messages.forEach(msg => {
            const div = document.createElement('div');
            div.className = `message ${msg.role}`;
            div.innerHTML = msg.content.replace(/\n/g, '<br>');
            els.chatContainer.appendChild(div);
        });
    }
    
    // 加载对话后滚动到底部（不使用平滑滚动，立即显示最新消息）
    scrollToBottom(false);
    renderHistory();
}

// 🆕 删除对话功能
function deleteConversation(id, event) {
    event.stopPropagation(); // 阻止触发 loadConversation
    
    if (!confirm('确定要删除这个对话吗？')) {
        return;
    }
    
    delete state.conversations[id];
    saveState();
    
    // 如果删除的是当前对话
    if (state.currentId === id) {
        const ids = Object.keys(state.conversations).map(Number).sort((a,b)=>b-a);
        if (ids.length > 0) {
            loadConversation(ids[0]);
        } else {
            newConversation();
        }
    }
    
    renderHistory();
}

function renderHistory() {
    els.historyList.innerHTML = '';
    const ids = Object.keys(state.conversations).map(Number).sort((a,b)=>b-a);
    
    ids.forEach(id => {
        const div = document.createElement('div');
        div.className = `history-item ${id === state.currentId ? 'active' : ''}`;
        
        // 创建标题部分
        const titleSpan = document.createElement('span');
        titleSpan.className = 'history-title';
        titleSpan.innerText = state.conversations[id].title;
        
        // 创建删除按钮
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-btn';
        deleteBtn.innerHTML = '🗑️';
        deleteBtn.title = '删除对话';
        deleteBtn.onclick = (e) => deleteConversation(id, e);
        
        div.appendChild(titleSpan);
        div.appendChild(deleteBtn);
        
        // 点击标题区域加载对话
        titleSpan.onclick = () => {
            loadConversation(id);
            toggleSidebar(false);
        };
        
        els.historyList.appendChild(div);
    });
}

function saveState() {
    localStorage.setItem('conversations', JSON.stringify(state.conversations));
}

function toggleSidebar(forceState) {
    const isOpen = typeof forceState === 'boolean' ? forceState : !els.sidebar.classList.contains('open');
    if (isOpen) {
        els.sidebar.classList.add('open');
        els.sidebar.classList.remove('hidden');
        els.overlay.classList.remove('hidden');
    } else {
        els.sidebar.classList.remove('open');
        els.sidebar.classList.add('hidden');
        els.overlay.classList.add('hidden');
    }
}

init();
