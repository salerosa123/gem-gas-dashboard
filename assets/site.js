/* GOGPT 数据观察站 · 共享逻辑：常量、导航、页脚、URL 参数、ECharts 基础样式 */
(function() {
  'use strict';

  // ===== 版本（季度同步时只需改这里） =====
  var SITE_VERSION = '2025-01';

  // ===== 数据列定义：0电厂 1机组 2国家 3大区 4状态 5燃料大类 6容量MW 7lat 8lng 9投运年份 10业主 11wiki =====
  var STATUS_ORDER = ['在运', '在建', '前期开发', '已宣布', '搁置', '封存', '取消', '退役'];
  var DEV_STATUSES = ['在建', '前期开发', '已宣布'];
  var STATUS_COLOR = {
    '在运': '#159a86', '在建': '#f0a13a', '前期开发': '#c9a227', '已宣布': '#e0713a',
    '搁置': '#8f77d4', '取消': '#d4536a', '封存': '#7a8ca3', '退役': '#aab4bf'
  };
  var FUEL_ORDER = ['天然气', '油气混合', '燃油', '工业副产气', '掺氢/其他'];
  var COUNTRY_CN = {
    'China': '中国', 'United States': '美国', 'Russia': '俄罗斯', 'Iran': '伊朗', 'Saudi Arabia': '沙特阿拉伯',
    'Japan': '日本', 'South Korea': '韩国', 'India': '印度', 'Iraq': '伊拉克', 'Mexico': '墨西哥',
    'Brazil': '巴西', 'Indonesia': '印度尼西亚', 'Thailand': '泰国', 'Vietnam': '越南', 'Malaysia': '马来西亚',
    'United Arab Emirates': '阿联酋', 'Kuwait': '科威特', 'Qatar': '卡塔尔', 'Egypt': '埃及', 'Algeria': '阿尔及利亚',
    'Nigeria': '尼日利亚', 'Turkey': '土耳其', 'United Kingdom': '英国', 'Germany': '德国', 'Italy': '意大利',
    'Spain': '西班牙', 'France': '法国', 'Netherlands': '荷兰', 'Poland': '波兰', 'Ukraine': '乌克兰',
    'Australia': '澳大利亚', 'Canada': '加拿大', 'Argentina': '阿根廷', 'Venezuela': '委内瑞拉', 'Pakistan': '巴基斯坦',
    'Bangladesh': '孟加拉国', 'Philippines': '菲律宾', 'Singapore': '新加坡', 'Taiwan': '中国台湾', 'Israel': '以色列',
    'Oman': '阿曼', 'Libya': '利比亚', 'Kazakhstan': '哈萨克斯坦', 'Uzbekistan': '乌兹别克斯坦', 'Turkmenistan': '土库曼斯坦',
    'Azerbaijan': '阿塞拜疆', 'Belarus': '白俄罗斯', 'Belgium': '比利时', 'South Africa': '南非',
    'Morocco': '摩洛哥', 'Tunisia': '突尼斯', 'Ghana': '加纳', 'Myanmar': '缅甸', 'Cambodia': '柬埔寨', 'Laos': '老挝',
    'Chile': '智利', 'Peru': '秘鲁', 'Colombia': '哥伦比亚', 'Ecuador': '厄瓜多尔', 'Bolivia': '玻利维亚',
    'Trinidad and Tobago': '特立尼达和多巴哥', 'Norway': '挪威', 'Sweden': '瑞典', 'Finland': '芬兰', 'Denmark': '丹麦',
    'Ireland': '爱尔兰', 'Portugal': '葡萄牙', 'Greece': '希腊', 'Austria': '奥地利', 'Switzerland': '瑞士',
    'Czech Republic': '捷克', 'Hungary': '匈牙利', 'Romania': '罗马尼亚', 'Bulgaria': '保加利亚', 'Serbia': '塞尔维亚',
    'Croatia': '克罗地亚', 'Slovakia': '斯洛伐克', 'Lithuania': '立陶宛', 'Latvia': '拉脱维亚', 'Estonia': '爱沙尼亚',
    'New Zealand': '新西兰', 'Afghanistan': '阿富汗', 'Jordan': '约旦', 'Lebanon': '黎巴嫩', 'Syria': '叙利亚',
    'Yemen': '也门', 'Bahrain': '巴林', 'Cyprus': '塞浦路斯', 'Georgia': '格鲁吉亚', 'Armenia': '亚美尼亚',
    'Mongolia': '蒙古', 'North Korea': '朝鲜', 'Sri Lanka': '斯里兰卡', 'Nepal': '尼泊尔'
  };

  // ===== 基础工具 =====
  function cnCountry(en) { return COUNTRY_CN[en] || en; }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'); }
  function sumCap(rows) { var s = 0; for (var i = 0; i < rows.length; i++) s += rows[i][6]; return s; }
  function groupSum(rows, idx, order) {
    var m = {};
    rows.forEach(function(r) { var k = r[idx] || '未知'; m[k] = (m[k] || 0) + r[6]; });
    var arr = Object.keys(m).map(function(k) { return { name: k, value: m[k] / 1000 }; });
    if (order) arr.sort(function(a, b) { return order.indexOf(a.name) - order.indexOf(b.name); });
    else arr.sort(function(a, b) { return b.value - a.value; });
    return arr;
  }
  function debounce(fn, ms) { var t; return function() { clearTimeout(t); t = setTimeout(fn, ms || 250); }; }

  // ===== URL 参数（跨页筛选联动）=====
  // 格式: ?region=亚洲&status=在运,在建&fuel=天然气&country=中国&kw=xxx
  function getParams() {
    var q = new URLSearchParams(location.search);
    return {
      region: q.get('region') || '',
      status: q.get('status') ? q.get('status').split(',') : [],
      fuel: q.get('fuel') || '',
      country: q.get('country') || '',
      kw: q.get('kw') || ''
    };
  }
  function buildQuery(p) {
    var q = new URLSearchParams();
    if (p.region) q.set('region', p.region);
    if (p.status && p.status.length) q.set('status', p.status.join(','));
    if (p.fuel) q.set('fuel', p.fuel);
    if (p.country) q.set('country', p.country);
    if (p.kw) q.set('kw', p.kw);
    var s = q.toString();
    return s ? '?' + s : '';
  }
  // 通用过滤（status 为数组，空数组=全部）
  function filterRows(rows, p) {
    var kw = (p.kw || '').toLowerCase();
    var ctry = (p.country || '').toLowerCase();
    return rows.filter(function(r) {
      if (p.region && r[3] !== p.region) return false;
      if (p.status && p.status.length && p.status.indexOf(r[4]) < 0) return false;
      if (p.fuel && r[5] !== p.fuel) return false;
      if (ctry && r[2].toLowerCase().indexOf(ctry) < 0 && cnCountry(r[2]).toLowerCase().indexOf(ctry) < 0) return false;
      if (kw && (r[0] + ' ' + r[10]).toLowerCase().indexOf(kw) < 0) return false;
      return true;
    });
  }

  // ===== ECharts 共享样式 =====
  var EC = {
    tooltip: {
      appendToBody: true, backgroundColor: '#ffffff', borderColor: '#e7e4dc', borderWidth: 1,
      padding: [8, 12], textStyle: { color: '#1b2430', fontSize: 12 },
      extraCssText: 'box-shadow:0 4px 16px rgba(27,36,48,.12);border-radius:8px;'
    },
    axisLabel: { color: '#6b7688', fontSize: 11 },
    splitLine: { lineStyle: { color: '#eeece6' } },
    axisLine: { lineStyle: { color: '#e7e4dc' } },
    palette: ['#0e7c6f', '#e8a33d', '#8f77d4', '#4f8fd0', '#94a3b8', '#d4536a']
  };

  // ===== 注入顶部导航与页脚 =====
  var FEISHU_BASE = 'https://hf03zlwk29.feishu.cn/base/IfkrbPAGbaYeBXsMPpXcJDmRnDX';
  var GEM_PAGE = 'https://globalenergymonitor.org/projects/global-oil-gas-plant-tracker';
  var NAV_ITEMS = [
    ['index.html', '首页'], ['map.html', '全球地图'], ['analysis.html', '数据分析'],
    ['data.html', '数据库'], ['about.html', '关于']
  ];
  function currentPage() {
    var f = location.pathname.split('/').pop() || 'index.html';
    return f === '' ? 'index.html' : f;
  }
  function renderChrome() {
    var page = currentPage();
    var navHtml = NAV_ITEMS.map(function(it) {
      return '<a href="' + it[0] + '"' + (it[0] === page ? ' class="active"' : '') + '>' + it[1] + '</a>';
    }).join('');
    var topbar = document.createElement('div');
    topbar.className = 'topbar';
    topbar.innerHTML =
      '<div class="topbar-inner">' +
        '<a class="brand" href="index.html">' +
          '<div class="mark"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 3.9 5.7 3.9 9s-1.4 6.4-3.9 9c-2.5-2.6-3.9-5.7-3.9-9s1.4-6.4 3.9-9z"/></svg></div>' +
          '<div class="name">GOGPT 数据观察站<small>Global Oil &amp; Gas Plant Tracker</small></div>' +
          '<span class="ver-pill">v' + SITE_VERSION + '</span>' +
        '</a>' +
        '<nav class="nav">' + navHtml + '</nav>' +
        '<div class="actions"><a class="btn primary" href="' + FEISHU_BASE + '" target="_blank" rel="noopener">飞书数据库</a></div>' +
      '</div>';
    document.body.insertBefore(topbar, document.body.firstChild);

    var foot = document.createElement('footer');
    foot.className = 'site-footer';
    foot.innerHTML =
      '<div class="wrap" style="padding-bottom:0">' +
        '<div class="foot-grid">' +
          '<div><h4>GOGPT 数据观察站</h4>' +
            '<p class="foot-note">基于 Global Energy Monitor 全球油气电厂追踪（GOGPT）公开数据构建的非官方可视化站点，数据以 GEM 官方发布为准，每半年同步更新。</p></div>' +
          '<div><h4>本站</h4><ul>' +
            NAV_ITEMS.map(function(it) { return '<li><a href="' + it[0] + '">' + it[1] + '</a></li>'; }).join('') +
          '</ul></div>' +
          '<div><h4>数据与协作</h4><ul>' +
            '<li><a href="' + GEM_PAGE + '" target="_blank" rel="noopener">GEM 项目主页</a></li>' +
            '<li><a href="https://github.com/GlobalEnergyMonitor/features-maps" target="_blank" rel="noopener">GEM 数据仓库</a></li>' +
            '<li><a href="' + FEISHU_BASE + '" target="_blank" rel="noopener">飞书多维表格数据库</a></li>' +
          '</ul></div>' +
        '</div>' +
        '<div class="credit"><span>数据版本 GOGPT ' + SITE_VERSION + ' · 13,895 条机组记录 · 180 个国家/地区</span><span>CC BY 4.0（数据）</span></div>' +
      '</div>';
    document.body.appendChild(foot);
  }

  window.SITE = {
    VERSION: SITE_VERSION,
    STATUS_ORDER: STATUS_ORDER, DEV_STATUSES: DEV_STATUSES, STATUS_COLOR: STATUS_COLOR,
    FUEL_ORDER: FUEL_ORDER, COUNTRY_CN: COUNTRY_CN,
    cnCountry: cnCountry, esc: esc, sumCap: sumCap, groupSum: groupSum, debounce: debounce,
    getParams: getParams, buildQuery: buildQuery, filterRows: filterRows,
    EC: EC, FEISHU_BASE: FEISHU_BASE
  };

  renderChrome();
})();
