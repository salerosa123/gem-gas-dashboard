(function() {
  var style = getComputedStyle(document.documentElement);
  function cv(n) { return style.getPropertyValue(n).trim(); }
  var accent = cv('--accent'), accentInk = cv('--accent-ink'), ink = cv('--ink'),
      muted = cv('--muted'), faint = cv('--faint'), rule = cv('--rule'), amber = cv('--amber');

  var RAW = window.GOGPT_DATA;
  // 列: 0电厂 1机组 2国家 3大区 4状态 5燃料大类 6容量MW 7lat 8lng 9投运年份 10业主 11wiki
  var STATUS_ORDER = ['在运', '在建', '前期开发', '已宣布', '搁置', '封存', '取消', '退役'];
  var STATUS_COLOR = {
    '在运': cv('--c-operating'), '在建': cv('--c-construction'),
    '前期开发': cv('--c-pre'), '已宣布': cv('--c-announced'),
    '搁置': cv('--c-shelved'), '取消': cv('--c-cancelled'),
    '封存': cv('--c-mothballed'), '退役': cv('--c-retired')
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
    'Azerbaijan': '阿塞拜疆', 'Belarus': '白俄罗斯', 'Belgium': '比利时', 'Netherlands ': '荷兰', 'South Africa': '南非',
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

  var state = { region: '', status: '', fuel: '', country: '', keyword: '' };
  var filtered = RAW;
  var charts = {};
  var page = 1, PAGE_SIZE = 50;

  function cnCountry(en) { return COUNTRY_CN[en] || en; }

  function applyFilter() {
    var kw = state.keyword.toLowerCase();
    var ctry = state.country.toLowerCase();
    filtered = RAW.filter(function(r) {
      if (state.region && r[3] !== state.region) return false;
      if (state.status && r[4] !== state.status) return false;
      if (state.fuel && r[5] !== state.fuel) return false;
      if (ctry && r[2].toLowerCase().indexOf(ctry) < 0 && cnCountry(r[2]).toLowerCase().indexOf(ctry) < 0) return false;
      if (kw && (r[0] + ' ' + r[10]).toLowerCase().indexOf(kw) < 0) return false;
      return true;
    });
    page = 1;
    renderAll();
  }

  function sumCap(rows) {
    var s = 0;
    for (var i = 0; i < rows.length; i++) s += rows[i][6];
    return s;
  }
  function groupSum(rows, idx, order) {
    var m = {};
    rows.forEach(function(r) { var k = r[idx] || '未知'; m[k] = (m[k] || 0) + r[6]; });
    var arr = Object.keys(m).map(function(k) { return { name: k, value: m[k] / 1000 }; });
    if (order) arr.sort(function(a, b) { return order.indexOf(a.name) - order.indexOf(b.name); });
    else arr.sort(function(a, b) { return b.value - a.value; });
    return arr;
  }

  function renderKpis() {
    var totalCap = sumCap(filtered) / 1000;
    var opCap = sumCap(filtered.filter(function(r) { return r[4] === '在运'; })) / 1000;
    var devCap = sumCap(filtered.filter(function(r) {
      return r[4] === '在建' || r[4] === '前期开发' || r[4] === '已宣布';
    })) / 1000;
    var countries = {};
    filtered.forEach(function(r) { countries[r[2]] = 1; });
    var kpis = [
      { num: filtered.length.toLocaleString(), label: '机组数量（条）', color: accent },
      { num: totalCap.toFixed(1), unit: 'GW', label: '总装机容量', color: accentInk },
      { num: opCap.toFixed(1), unit: 'GW', label: '在运容量', color: STATUS_COLOR['在运'] },
      { num: devCap.toFixed(1), unit: 'GW', label: '开发中容量（在建+前期+宣布）', color: STATUS_COLOR['在建'] },
      { num: Object.keys(countries).length, label: '覆盖国家/地区', color: muted }
    ];
    document.getElementById('kpis').innerHTML = kpis.map(function(k) {
      return '<div class="kpi" style="--kpi-color:' + k.color + '"><div class="label">' + k.label + '</div>' +
        '<div class="num">' + k.num + (k.unit ? '<span class="unit">' + k.unit + '</span>' : '') + '</div></div>';
    }).join('');
    document.getElementById('f-count').innerHTML = '当前筛选 <b>' + filtered.length.toLocaleString() + '</b> 条';
  }

  var tooltipBase = {
    appendToBody: true, backgroundColor: '#ffffff', borderColor: rule, borderWidth: 1,
    padding: [8, 12], textStyle: { color: ink, fontSize: 12 },
    extraCssText: 'box-shadow:0 4px 16px rgba(27,36,48,.12);border-radius:8px;'
  };
  var axisLabelStyle = { color: muted, fontSize: 11 };
  var splitLineStyle = { lineStyle: { color: '#eeece6' } };
  var axisLineStyle = { lineStyle: { color: rule } };

  function renderMap() {
    if (!charts.map) {
      echarts.registerMap('world', window.WORLD_GEOJSON);
      charts.map = echarts.init(document.getElementById('chart-map'));
      window.addEventListener('resize', function() { charts.map.resize(); });
    }
    var series = STATUS_ORDER.map(function(st) {
      var pts = [];
      filtered.forEach(function(r) {
        if (r[4] === st && r[7] && r[8]) pts.push({ name: r[0], value: [r[8], r[7], r[6]], row: r });
      });
      return {
        name: st, type: 'scatter', coordinateSystem: 'geo', data: pts,
        symbolSize: function(v) { return Math.max(3, Math.min(26, Math.sqrt(v[2]) / 2.2)); },
        itemStyle: { color: STATUS_COLOR[st], opacity: 0.85, borderColor: '#ffffff', borderWidth: 0.8,
          shadowBlur: 3, shadowColor: 'rgba(27,36,48,.25)' },
        emphasis: { itemStyle: { opacity: 1 } }
      };
    });
    charts.map.setOption({
      animation: false,
      backgroundColor: '#eef2f4',
      tooltip: Object.assign({}, tooltipBase, {
        formatter: function(p) {
          var r = p.data.row;
          return '<b>' + r[0] + '</b> · ' + r[1] + '<br/>' + cnCountry(r[2]) + ' · ' + r[4] +
            '<br/>容量 ' + r[6].toLocaleString() + ' MW · ' + r[5] +
            (r[9] ? '<br/>投运 ' + r[9] : '');
        }
      }),
      legend: { top: 10, textStyle: { color: muted, fontSize: 11 }, itemWidth: 12, itemHeight: 8, type: 'scroll',
        inactiveColor: '#c8cfd8' },
      geo: {
        map: 'world', roam: true, zoom: 1.15, top: 48,
        itemStyle: { areaColor: '#e2e6e2', borderColor: '#ffffff', borderWidth: 0.7 },
        emphasis: { itemStyle: { areaColor: '#e2e6e2' }, label: { show: false } },
        select: { disabled: true }
      },
      series: series
    }, { notMerge: true });
  }

  function renderStatus() {
    if (!charts.status) {
      charts.status = echarts.init(document.getElementById('chart-status'));
      window.addEventListener('resize', function() { charts.status.resize(); });
    }
    var data = groupSum(filtered, 4, STATUS_ORDER);
    charts.status.setOption({
      animation: false,
      tooltip: Object.assign({}, tooltipBase, { formatter: function(p) { return p.name + '<br/><b>' + p.value.toFixed(1) + '</b> GW'; } }),
      grid: { left: 70, right: 46, top: 12, bottom: 26 },
      xAxis: { type: 'value', axisLabel: axisLabelStyle, splitLine: splitLineStyle },
      yAxis: { type: 'category', inverse: true, data: data.map(function(d) { return d.name; }),
        axisLabel: { color: ink, fontSize: 12 }, axisLine: axisLineStyle, axisTick: { show: false } },
      series: [{
        type: 'bar', barWidth: 16,
        data: data.map(function(d) { return { value: +d.value.toFixed(2), itemStyle: { color: STATUS_COLOR[d.name] || faint, borderRadius: [0, 5, 5, 0] } }; }),
        label: { show: true, position: 'right', color: muted, fontSize: 11, formatter: function(p) { return p.value.toFixed(1); } }
      }]
    }, { notMerge: true });
  }

  function renderRegion() {
    if (!charts.region) {
      charts.region = echarts.init(document.getElementById('chart-region'));
      window.addEventListener('resize', function() { charts.region.resize(); });
    }
    var data = groupSum(filtered, 3);
    charts.region.setOption({
      animation: false,
      tooltip: Object.assign({}, tooltipBase, { formatter: function(p) { return p.name + '<br/><b>' + p.value.toFixed(1) + '</b> GW (' + p.percent + '%)'; } }),
      legend: { bottom: 0, textStyle: { color: muted, fontSize: 11 }, itemWidth: 12, itemHeight: 8 },
      color: [accent, '#e8a33d', '#8f77d4', '#4f8fd0', '#94a3b8'],
      series: [{
        type: 'pie', radius: ['46%', '70%'], center: ['50%', '46%'],
        label: { color: ink, formatter: '{b}\n{d}%', fontSize: 11, lineHeight: 15 },
        labelLine: { lineStyle: { color: faint } },
        itemStyle: { borderColor: '#ffffff', borderWidth: 2, borderRadius: 4 },
        emphasis: { scaleSize: 6 },
        data: data.map(function(d) { return { name: d.name, value: +d.value.toFixed(2) }; })
      }]
    }, { notMerge: true });
  }

  function renderFuel() {
    if (!charts.fuel) {
      charts.fuel = echarts.init(document.getElementById('chart-fuel'));
      window.addEventListener('resize', function() { charts.fuel.resize(); });
    }
    var data = groupSum(filtered, 5, FUEL_ORDER).filter(function(d) { return d.value > 0; });
    charts.fuel.setOption({
      animation: false,
      tooltip: Object.assign({}, tooltipBase, { formatter: function(p) { return p.name + '<br/><b>' + p.value.toFixed(1) + '</b> GW'; } }),
      grid: { left: 90, right: 50, top: 12, bottom: 26 },
      xAxis: { type: 'value', axisLabel: axisLabelStyle, splitLine: splitLineStyle },
      yAxis: { type: 'category', inverse: true, data: data.map(function(d) { return d.name; }),
        axisLabel: { color: ink, fontSize: 12 }, axisLine: axisLineStyle, axisTick: { show: false } },
      series: [{
        type: 'bar', barWidth: 18,
        data: data.map(function(d, i) {
          var cols = [accent, '#e8a33d', '#d4536a', '#8f77d4', '#94a3b8'];
          return { value: +d.value.toFixed(2), itemStyle: { color: cols[i % cols.length], borderRadius: [0, 5, 5, 0] } };
        }),
        label: { show: true, position: 'right', color: muted, fontSize: 11, formatter: function(p) { return p.value.toFixed(1); } }
      }]
    }, { notMerge: true });
  }

  function renderCountry() {
    if (!charts.country) {
      charts.country = echarts.init(document.getElementById('chart-country'));
      window.addEventListener('resize', function() { charts.country.resize(); });
    }
    var data = groupSum(filtered, 2).slice(0, 15);
    charts.country.setOption({
      animation: false,
      tooltip: Object.assign({}, tooltipBase, { formatter: function(p) { return p.name + '<br/><b>' + p.value.toFixed(1) + '</b> GW'; } }),
      grid: { left: 8, right: 20, top: 14, bottom: 64, containLabel: true },
      xAxis: { type: 'category', data: data.map(function(d) { return cnCountry(d.name); }),
        axisLabel: { color: muted, rotate: 38, fontSize: 10 }, axisLine: axisLineStyle, axisTick: { show: false } },
      yAxis: { type: 'value', axisLabel: axisLabelStyle, splitLine: splitLineStyle },
      series: [{
        type: 'bar', barWidth: 14,
        data: data.map(function(d, i) {
          var t = 1 - i / 15;
          return { value: +d.value.toFixed(2), itemStyle: {
            color: t > 0.85 ? accentInk : (t > 0.4 ? accent : '#5aa89e'),
            borderRadius: [4, 4, 0, 0] } };
        })
      }]
    }, { notMerge: true });
  }

  function renderYear() {
    if (!charts.year) {
      charts.year = echarts.init(document.getElementById('chart-year'));
      window.addEventListener('resize', function() { charts.year.resize(); });
    }
    var m = {};
    filtered.forEach(function(r) {
      if (r[9] && r[9] >= 1930 && r[9] <= 2035 && (r[4] === '在运' || r[4] === '封存' || r[4] === '退役')) {
        var y = r[9] < 1980 ? 1979 : r[9];
        m[y] = (m[y] || 0) + r[6];
      }
    });
    var years = Object.keys(m).map(Number).sort(function(a, b) { return a - b; });
    var yearly = years.map(function(y) { return +(m[y] / 1000).toFixed(2); });
    var cum = [], s = 0;
    yearly.forEach(function(v) { s += v; cum.push(+s.toFixed(1)); });
    var labels = years.map(function(y) { return y === 1979 ? '<1980' : String(y); });
    charts.year.setOption({
      animation: false,
      tooltip: Object.assign({}, tooltipBase, { trigger: 'axis', axisPointer: { type: 'shadow' } }),
      legend: { top: 0, textStyle: { color: muted, fontSize: 11 }, itemWidth: 14, itemHeight: 8 },
      grid: { left: 56, right: 60, top: 36, bottom: 46 },
      xAxis: { type: 'category', data: labels, axisLabel: { color: muted, fontSize: 10 }, axisLine: axisLineStyle, axisTick: { show: false } },
      yAxis: [
        { type: 'value', name: '当年投运 (GW)', nameTextStyle: { color: faint, fontSize: 10 }, axisLabel: axisLabelStyle, splitLine: splitLineStyle },
        { type: 'value', name: '累计 (GW)', nameTextStyle: { color: faint, fontSize: 10 }, axisLabel: axisLabelStyle, splitLine: { show: false } }
      ],
      series: [
        { name: '当年投运', type: 'bar', data: yearly, barWidth: '58%',
          itemStyle: { color: '#8fc7bf', borderRadius: [3, 3, 0, 0] },
          emphasis: { itemStyle: { color: accent } } },
        { name: '累计投运', type: 'line', yAxisIndex: 1, data: cum, symbol: 'none', smooth: 0.15,
          lineStyle: { color: amber, width: 2.5 },
          areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [{ offset: 0, color: 'rgba(196,122,18,.12)' }, { offset: 1, color: 'rgba(196,122,18,0)' }] } } }
      ]
    }, { notMerge: true });
  }

  function renderTable() {
    var total = filtered.length;
    var pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    if (page > pages) page = pages;
    var start = (page - 1) * PAGE_SIZE;
    var rows = filtered.slice(start, start + PAGE_SIZE);
    var html = rows.map(function(r) {
      var stColor = STATUS_COLOR[r[4]] || faint;
      return '<tr><td title="' + esc(r[0]) + '">' + esc(r[0]) + '</td><td>' + esc(r[1]) + '</td>' +
        '<td>' + esc(cnCountry(r[2])) + '</td><td>' + r[3] + '</td>' +
        '<td><span class="badge" style="background:' + stColor + '1f;color:' + stColor + '">' + r[4] + '</span></td>' +
        '<td>' + r[5] + '</td><td class="cap">' + r[6].toLocaleString() + '</td>' +
        '<td class="cap">' + (r[9] || '') + '</td><td title="' + esc(r[10]) + '">' + esc(r[10]) + '</td>' +
        (r[11] ? '<td><a class="b-wiki" href="' + r[11] + '" target="_blank" rel="noopener">链接</a></td>' : '<td></td>') +
        '</tr>';
    }).join('');
    document.getElementById('tbody').innerHTML = html;
    document.getElementById('pg-info').textContent = '第 ' + page + ' / ' + pages + ' 页 · 共 ' + total.toLocaleString() + ' 条';
    document.getElementById('pg-prev').disabled = page <= 1;
    document.getElementById('pg-next').disabled = page >= pages;
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  }

  function renderAll() {
    renderKpis(); renderMap(); renderStatus(); renderRegion(); renderFuel(); renderCountry(); renderYear(); renderTable();
  }

  // 初始化筛选器
  function fillSelect(id, values) {
    var sel = document.getElementById(id);
    values.forEach(function(v) {
      var o = document.createElement('option');
      o.value = v; o.textContent = v;
      sel.appendChild(o);
    });
  }
  var regions = [], fuels = [];
  RAW.forEach(function(r) {
    if (regions.indexOf(r[3]) < 0) regions.push(r[3]);
    if (fuels.indexOf(r[5]) < 0) fuels.push(r[5]);
  });
  fillSelect('f-region', regions.sort());
  fillSelect('f-status', STATUS_ORDER);
  fillSelect('f-fuel', FUEL_ORDER.filter(function(f) { return fuels.indexOf(f) >= 0; }));

  var timer;
  function debounce(fn) { clearTimeout(timer); timer = setTimeout(fn, 250); }
  document.getElementById('f-region').addEventListener('change', function() { state.region = this.value; applyFilter(); });
  document.getElementById('f-status').addEventListener('change', function() { state.status = this.value; applyFilter(); });
  document.getElementById('f-fuel').addEventListener('change', function() { state.fuel = this.value; applyFilter(); });
  document.getElementById('f-country').addEventListener('input', function() { var v = this.value; debounce(function() { state.country = v; applyFilter(); }); });
  document.getElementById('f-keyword').addEventListener('input', function() { var v = this.value; debounce(function() { state.keyword = v; applyFilter(); }); });
  document.getElementById('f-reset').addEventListener('click', function() {
    state = { region: '', status: '', fuel: '', country: '', keyword: '' };
    ['f-region', 'f-status', 'f-fuel'].forEach(function(id) { document.getElementById(id).value = ''; });
    document.getElementById('f-country').value = '';
    document.getElementById('f-keyword').value = '';
    applyFilter();
  });
  document.getElementById('pg-prev').addEventListener('click', function() { if (page > 1) { page--; renderTable(); } });
  document.getElementById('pg-next').addEventListener('click', function() { page++; renderTable(); });

  renderAll();
})();
