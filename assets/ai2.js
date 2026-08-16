/* GOGPT 数据观察站 · Kimi AI 接入：Key 管理 + 设置面板 + 通用调用
   直连模式：API Key 仅保存在访问者自己浏览器的 localStorage，不上传服务器 */
(function() {
  'use strict';
  var API_URL = 'https://api.moonshot.cn/v1/chat/completions';
  var MODELS = ['kimi-k3', 'kimi-k2-0905-preview', 'kimi-k2-turbo-preview', 'kimi-k2-thinking', 'moonshot-v1-8k', 'moonshot-v1-128k'];
  var LS_KEY = 'gogpt_kimi_key', LS_MODEL = 'gogpt_kimi_model';

  function getKey() { try { return localStorage.getItem(LS_KEY) || ''; } catch (e) { return ''; } }
  function setKey(k) { try { localStorage.setItem(LS_KEY, k.trim()); } catch (e) {} }
  function clearKey() { try { localStorage.removeItem(LS_KEY); } catch (e) {} }
  function getModel() {
    try {
      var m = localStorage.getItem(LS_MODEL) || '';
      return MODELS.indexOf(m) >= 0 ? m : MODELS[0];
    } catch (e) { return MODELS[0]; }
  }
  function setModel(m) { try { localStorage.setItem(LS_MODEL, m); } catch (e) {} }

  /* ===== 设置面板（自动注入页面） ===== */
  function injectSettings() {
    if (document.getElementById('ai-backdrop')) return;
    var bd = document.createElement('div');
    bd.className = 'ai-backdrop'; bd.id = 'ai-backdrop';
    bd.innerHTML =
      '<div class="ai-modal" role="dialog" aria-label="AI 设置">' +
        '<div class="ai-modal-head"><h3>✦ AI 设置（Kimi）</h3><button class="ai-x" id="ai-close">×</button></div>' +
        '<div class="ai-modal-body">' +
          '<label class="ai-lb">API Key</label>' +
          '<input type="password" id="ai-key" class="ai-inp" placeholder="sk-... 粘贴你的 Kimi API Key" autocomplete="off">' +
          '<label class="ai-lb">模型</label>' +
          '<select id="ai-model" class="ai-inp">' + MODELS.map(function(m) { return '<option value="' + m + '">' + m + '</option>'; }).join('') + '</select>' +
          '<div class="ai-tips">' +
            '· Key 只保存在<b>本浏览器</b> localStorage，不会上传任何服务器<br>' +
            '· 没有 Key？到 <a href="https://platform.moonshot.cn/console/api-keys" target="_blank" rel="noopener">platform.moonshot.cn</a> 注册领取<br>' +
            '· 费用按 token 计，本站单次调用约几分钱' +
          '</div>' +
        '</div>' +
        '<div class="ai-modal-foot">' +
          '<button class="ai-linkbtn" id="ai-clear">清除 Key</button><span style="flex:1"></span>' +
          '<button class="btn primary" id="ai-save">保存</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(bd);
    bd.addEventListener('click', function(e) { if (e.target === bd) closeSettings(); });
    document.getElementById('ai-close').addEventListener('click', closeSettings);
    document.getElementById('ai-save').addEventListener('click', function() {
      var k = document.getElementById('ai-key').value;
      if (!k.trim()) { toastAi('请填写 API Key'); return; }
      setKey(k); setModel(document.getElementById('ai-model').value);
      closeSettings(); toastAi('已保存，可以使用 AI 功能了');
    });
    document.getElementById('ai-clear').addEventListener('click', function() {
      clearKey(); document.getElementById('ai-key').value = ''; toastAi('已清除本浏览器的 Key');
    });
    // 顶栏入口
    var inner = document.querySelector('.topbar-inner');
    if (inner) {
      var a = document.createElement('a');
      a.className = 'nav-ai'; a.href = 'javascript:void(0)'; a.textContent = '✦ AI';
      a.addEventListener('click', openSettings);
      var nav = inner.querySelector('.nav');
      if (nav) nav.appendChild(a); else inner.appendChild(a);
    }
  }
  function openSettings() {
    injectSettings();
    document.getElementById('ai-key').value = getKey();
    document.getElementById('ai-model').value = getModel();
    document.getElementById('ai-backdrop').classList.add('show');
  }
  function closeSettings() {
    var bd = document.getElementById('ai-backdrop');
    if (bd) bd.classList.remove('show');
  }
  function toastAi(msg) {
    var t = document.createElement('div');
    t.className = 'ai-toast'; t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function() { t.classList.add('out'); setTimeout(function() { t.remove(); }, 300); }, 2200);
  }

  /* ===== 通用调用 =====
     chat(system, user, opts, cb)   cb(err, text) */
  function chat(system, user, opts, cb) {
    if (typeof opts === 'function') { cb = opts; opts = {}; }
    opts = opts || {};
    if (!getKey()) { openSettings(); cb(new Error('未设置 API Key')); return; }
    var body = {
      model: getModel(),
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
      reasoning_effort: opts.reasoning_effort || 'low'
    };
    if (opts.max_tokens) body.max_tokens = opts.max_tokens;
    fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + getKey() },
      body: JSON.stringify(body)
    }).then(function(r) {
      return r.json().then(function(j) { return { status: r.status, j: j }; });
    }).then(function(res) {
      if (res.status !== 200) {
        var m = (res.j && res.j.error && res.j.error.message) || ('HTTP ' + res.status);
        if (res.status === 401) m = 'API Key 无效，请检查（点顶栏「✦ AI」重新设置）';
        cb(new Error(m)); return;
      }
      var msg = res.j && res.j.choices && res.j.choices[0] && res.j.choices[0].message;
      // K3 思考耗尽 max_tokens 时 content 可能为空，回退取思考内容
      var txt = msg && (msg.content || msg.reasoning_content);
      if (!txt) { cb(new Error('模型返回为空，请重试')); return; }
      cb(null, txt);
    }).catch(function(e) {
      cb(new Error('网络请求失败：' + e.message + '（可能是跨域或网络问题）'));
    });
  }

  /* 从模型输出中提取首个 JSON 对象 */
  function extractJSON(text) {
    var s = String(text).replace(/```json|```/g, '');
    var i = s.indexOf('{'), j = s.lastIndexOf('}');
    if (i < 0 || j <= i) return null;
    try { return JSON.parse(s.slice(i, j + 1)); } catch (e) { return null; }
  }

  window.KIMI = {
    chat: chat, extractJSON: extractJSON,
    hasKey: function() { return !!getKey(); },
    openSettings: openSettings, toast: toastAi
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', injectSettings);
  else injectSettings();
})();
