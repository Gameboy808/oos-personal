/*
 * OOS 模块增强层 (oos-modules.js)
 * 在不改动 oos-builder 原 app.js 核心逻辑的前提下，叠加：
 *  - 左侧导航新增三个 Focus 模块：英语练习 / 自媒体运营 / 灵感发现（白底风格融合）
 *  - 全局「＋ 新建」浮标：任何页面都能自己记录（任务 / 长期主线），存本地、刷新不丢
 *  - Tracks 视图注入「＋ 新建长期主线」
 *  - 中英双语框架（导航 / 新建表单 / 三大模块全双语）
 * 数据来自 Focus 现成内容（英语课程、灵感池、自媒体 6 平台）
 */
(function () {
  "use strict";

  /* ============ i18n ============ */
  const I18N = {
    zh: {
      navEnglish: "英语练习", navSocial: "自媒体运营", navInspiration: "灵感发现",
      newTask: "新建", newTaskFull: "＋ 新建", langToggle: "EN",
      moduleEnglish: "英语练习", moduleSocial: "自媒体运营", moduleInspiration: "灵感发现",
      englishSub: "每日磨耳朵 · 盲听跟读", socialSub: "六平台账号与发布记录", inspirationSub: "每日灵感 · 一键成稿",
      engTitle: "英语练习", engSub: "选一门课，盲听→显示原文→跟读，口语自然上来",
      lessonList: "课程", blind: "盲听", reveal: "显示原文", shadow: "跟读", play: "播放", prev: "上一句", next: "下一句", sentence: "句子",
      socialTitle: "自媒体运营", socialSub: "管理 6 个平台的账号、一键跳创作者中心、记录发布内容",
      editAccount: "编辑账号", publish: "发布", posts: "条发布", noPosts: "还没有发布记录", viewAll: "查看全部",
      accountName: "账号名 / @handle", homepage: "主页链接", save: "保存", username: "账号", deletePost: "删除",
      postTitle: "标题", postLink: "链接", postTime: "时间", postDesc: "描述", addPost: "记录发布",
      inspTitle: "灵感发现", inspSub: "每天 8 条高潜选题，点收藏进想法、点成稿直接进任务",
      refresh: "换一批", save: "收藏", addTask: "成稿任务", heat: "热度", peak: "峰值", growth: "涨粉", recreate: "二创建议", viewDouyin: "抖音搜", viewBilibili: "B站搜",
      formTitle: "快速记录", type: "类型", typeTask: "今日 / 待办任务", typeTrack: "长期主线",
      fTitle: "要做什么", fTrack: "归哪条轨道", fTrackName: "主线名称", fDate: "定在哪一天", fNext: "下一步 / 备注", fPriority: "优先级",
      priNormal: "普通", priHigh: "重要", submit: "保存", cancel: "取消",
      today: "今天", tmr: "明天",
      saved: "已保存", taskAdded: "任务已加入今日推进", trackAdded: "长期主线已创建", pleaseTitle: "请填写标题",
      langZH: "中", langEN: "EN"
    },
    en: {
      navEnglish: "English", navSocial: "Social Media", navInspiration: "Inspiration",
      newTask: "New", newTaskFull: "+ New", langToggle: "中",
      moduleEnglish: "English", moduleSocial: "Social Media", moduleInspiration: "Inspiration",
      englishSub: "Daily listening · blind + shadow", socialSub: "6 platforms · accounts & posts", inspirationSub: "Daily ideas · one-tap to draft",
      engTitle: "English Practice", engSub: "Pick a lesson, blind-listen → reveal → shadow. Speaking improves naturally",
      lessonList: "Lessons", blind: "Blind", reveal: "Reveal", shadow: "Shadow", play: "Play", prev: "Prev", next: "Next", sentence: "Sentence",
      socialTitle: "Social Media Ops", socialSub: "Manage 6 platforms, jump to creator studio, log your posts",
      editAccount: "Edit account", publish: "Publish", posts: "posts", noPosts: "No posts yet", viewAll: "View all",
      accountName: "Username / @handle", homepage: "Homepage", save: "Save", username: "Account", deletePost: "Delete",
      postTitle: "Title", postLink: "Link", postTime: "Time", postDesc: "Description", addPost: "Log post",
      inspTitle: "Inspiration Engine", inspSub: "8 high-potential topics daily. Save to ideas, or turn into a task",
      refresh: "Shuffle", save: "Save", addTask: "To task", heat: "Heat", peak: "Peak", growth: "Growth", recreate: "Recreate", viewDouyin: "Search Douyin", viewBilibili: "Search Bilibili",
      formTitle: "Quick Capture", type: "Type", typeTask: "Today / To-do", typeTrack: "Long-term Track",
      fTitle: "What to do", fTrack: "Track", fTrackName: "Track name", fDate: "Due date", fNext: "Next step / note", fPriority: "Priority",
      priNormal: "Normal", priHigh: "High", submit: "Save", cancel: "Cancel",
      today: "Today", tmr: "Tomorrow",
      saved: "Saved", taskAdded: "Task added to Today", trackAdded: "Long-term track created", pleaseTitle: "Please enter a title",
      langZH: "中", langEN: "EN"
    }
  };
  let LANG = (localStorage.getItem("oos-lang") || (navigator.language || "zh").slice(0, 2));
  if (LANG !== "en") LANG = "zh";
  function t(key) { return (I18N[LANG] && I18N[LANG][key]) || I18N.zh[key] || key; }
  function todayIso() { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
  function tmrIso() { const d = new Date(Date.now() + 864e5); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }
  function openExternal(u) { window.open(u, "_blank", "noopener"); }
  function fmtNum(n) { if (n >= 1e7) return (n / 1e7).toFixed(1) + "千万"; if (n >= 1e4) return (n / 1e4).toFixed(1) + "万"; return String(n); }
  function toastMsg(msg) { if (window.toast) window.toast(msg); else console.log(msg); }

  /* ============ 数据（来自 Focus App 现成内容） ============ */
  const ENGLISH_LESSONS = [
    { title: "Daily Conversation", zh: "日常对话", sentences: [
      { en: "I've been thinking about starting my own business.", zh: "我一直在考虑自己创业。" },
      { en: "It takes courage to step out of your comfort zone.", zh: "走出舒适圈需要勇气。" },
      { en: "Every expert was once a beginner.", zh: "每个专家都曾经是新手。" },
      { en: "Don't let fear hold you back from your dreams.", zh: "不要让恐惧阻挡你追逐梦想。" },
      { en: "The best investment you can make is in yourself.", zh: "最好的投资就是投资自己。" }
    ] },
    { title: "Creator Economy", zh: "创作者经济", sentences: [
      { en: "Content creation is about providing genuine value.", zh: "内容创作是提供真实的价值。" },
      { en: "Consistency is more important than perfection.", zh: "持续输出比追求完美更重要。" },
      { en: "Your unique perspective is your greatest asset.", zh: "你独特的视角是你最大的资产。" },
      { en: "Monetization follows when you solve real problems.", zh: "当你能解决真实问题，变现自然随之而来。" },
      { en: "Build an audience one person at a time.", zh: "一个粉丝一个粉丝地积累你的观众。" }
    ] },
    { title: "Travel & Adventure", zh: "旅行与冒险", sentences: [
      { en: "The world is too big to stay in one place.", zh: "世界太大，不能只待在一个地方。" },
      { en: "Traveling solo teaches you more about yourself.", zh: "独自旅行让你更了解自己。" },
      { en: "Motorcycle trips through Tibet are life-changing.", zh: "骑摩托穿越西藏是改变人生的经历。" },
      { en: "Collect moments, not things.", zh: "收集经历，而不是物质。" },
      { en: "Adventure begins where your comfort zone ends.", zh: "冒险开始于舒适圈的边缘。" }
    ] },
    { title: "Photography", zh: "摄影", sentences: [
      { en: "A good photograph tells a story without words.", zh: "一张好照片不用语言就能讲一个故事。" },
      { en: "Light is the most important element in photography.", zh: "光线是摄影中最重要的元素。" },
      { en: "The best camera is the one you have with you.", zh: "最好的相机就是你手边那一台。" },
      { en: "Composition rules are guidelines, not laws.", zh: "构图法则是指导，不是铁律。" },
      { en: "Great photography requires patience and timing.", zh: "优秀的摄影需要耐心和时机。" }
    ] },
    { title: "Tech & Tools", zh: "科技与工具", sentences: [
      { en: "AI is transforming how we create content.", zh: "AI正在改变我们创作内容的方式。" },
      { en: "Automating repetitive tasks frees up creative energy.", zh: "将重复性工作自动化，释放创作能量。" },
      { en: "Software tools should simplify, not complicate.", zh: "软件工具应该简化工作，而不是让它更复杂。" },
      { en: "Learning to code is like learning a superpower.", zh: "学编程就像学习一种超能力。" },
      { en: "The future belongs to those who leverage technology.", zh: "未来属于善于利用技术的人。" }
    ] }
  ];
  const INSPIRATION_POOL = [
    { t: "一个人去西藏，7天花了多少钱", c: "旅行", p: "douyin", h: 8920000, pk: 156000, g: 32000, r: "用Osmo Pocket拍第一人称骑行vlog，旁白讲花费明细，配上雪山画面" },
    { t: "辞职后我靠做小红书月入5万", c: "自媒体", p: "douyin", h: 12500000, pk: 210000, g: 89000, r: "分享自己的收入截图和平台后台数据，做成数据可视化对比" },
    { t: "零基础3天学会Pr剪辑，附练习素材", c: "教程", p: "bilibili", h: 4500000, pk: 98000, g: 15000, r: "做一个剪映版教程，针对新手更友好，加上你实际剪辑的案例" },
    { t: "30天英语口语打卡挑战Day1", c: "学习", p: "bilibili", h: 3200000, pk: 76000, g: 21000, r: "结合你学英语的经历拍真实记录，比教程更易共鸣" },
    { t: "大疆Pocket 4P值不值得买？深度测评", c: "数码", p: "bilibili", h: 6800000, pk: 142000, g: 42000, r: "用你自己的Osmo Pocket实拍对比，突出真实使用感受" },
    { t: "南宁街头10家必吃粉店，本地人推荐", c: "美食", p: "douyin", h: 5600000, pk: 110000, g: 18000, r: "融入你的南宁人身份，拍得接地气，点评真实不套话" },
    { t: "酒吧打工日记：一晚能赚多少小费", c: "生活", p: "douyin", h: 7800000, pk: 185000, g: 56000, r: "把你在无锡酒吧的经历拍成vlog系列，每晚一个故事" },
    { t: "从摄影师到自媒体，我经历了什么", c: "个人成长", p: "bilibili", h: 4100000, pk: 89000, g: 27000, r: "这就是你的故事。用照片+口播，讲述转型的心路历程" },
    { t: "2024最赚钱的5个副业，最后一个最稳", c: "赚钱", p: "douyin", h: 15000000, pk: 280000, g: 105000, r: "做成清单式的信息图风格，结合你的目标：数字游民+被动收入" },
    { t: "如何用AI一天剪10条视频？全流程公开", c: "工具", p: "bilibili", h: 5200000, pk: 105000, g: 33000, r: "分享你实际的工作流，ChatCut+剪映+AI工具的搭配使用" },
    { t: "0粉丝第一条视频破10w播放的秘密", c: "自媒体", p: "douyin", h: 9800000, pk: 196000, g: 71000, r: "研究那些新号第一条就爆的视频，总结规律做成分析" },
    { t: "无锡最值得去的10个拍照打卡点", c: "旅行", p: "bilibili", h: 3700000, pk: 85000, g: 12000, r: "用你的摄影眼去拍，每个点给拍摄参数和构图技巧" },
    { t: "7天学会摄影构图，新手入门指南", c: "摄影", p: "bilibili", h: 2400000, pk: 62000, g: 19000, r: "做你最擅长的，用实际案例对比好构图vs烂构图" },
    { t: "我靠卖数字产品月入2万，不用发货", c: "赚钱", p: "douyin", h: 11000000, pk: 230000, g: 64000, r: "结合你之前想做的酒吧运营模板，展示数字产品怎么卖" },
    { t: "为什么我劝你别做自媒体（真心话）", c: "自媒体", p: "douyin", h: 6500000, pk: 135000, g: 37000, r: "反向操作——用真实数据说话，劝退不适合的人，反而更真诚" },
    { t: "摩托车旅行装备清单，2万封顶", c: "旅行", p: "bilibili", h: 2900000, pk: 71000, g: 11000, r: "为你的西藏摩托车之旅做准备，做攻略也能成内容" },
    { t: "南宁夜市到底有多好吃？挑战100元吃遍", c: "美食", p: "douyin", h: 4400000, pk: 95000, g: 23000, r: "回南宁后拍，预算挑战类视频在抖音流量极好" },
    { t: "小红书爆款封面图怎么做？5个模板直接套", c: "教程", p: "bilibili", h: 3100000, pk: 68000, g: 25000, r: "发挥你的摄影+设计优势，做成傻瓜模板让新手直接下载" },
    { t: "一人公司第1年：收入、踩坑和真实感受", c: "创业", p: "douyin", h: 7300000, pk: 152000, g: 48000, r: "虽然你还没开始，但可以做研究类——总结5个一人创业者的经历" },
    { t: "剪映专业版隐藏功能：3招提升视频质感", c: "教程", p: "bilibili", h: 3800000, pk: 82000, g: 16000, r: "你每天都在用剪映，分享真实发现的技巧，比别人讲更干货" },
    { t: "骑行318川藏线全攻略，新手也能上路", c: "旅行", p: "bilibili", h: 5100000, pk: 115000, g: 29000, r: "为你未来的西藏摩托旅行做准备，先做攻略积累素材和粉丝" },
    { t: "普通人做视频号3个月涨粉5000，我的方法", c: "自媒体", p: "douyin", h: 4200000, pk: 92000, g: 35000, r: "分享你视频号运营的真实数据，不管涨多少粉都是真实记录" },
    { t: "如何用手机拍出电影感vlog？6个技巧", c: "摄影", p: "bilibili", h: 2700000, pk: 59000, g: 14000, r: "用Pocket 4P实操演示，结合你的摄影专业知识拆解" },
    { t: "95后摄影师裸辞转型的真实收入账单", c: "生活", p: "douyin", h: 5900000, pk: 125000, g: 41000, r: "把你的真实财务状况做成信息图，真诚透明反而吸粉" },
    { t: "2024年短视频趋势：这3个赛道最容易起号", c: "自媒体", p: "bilibili", h: 4600000, pk: 101000, g: 22000, r: "结合你关注的多个平台数据，做趋势分析并给出建议" }
  ];
  const SOCIAL_PLATFORMS = [
    { key: "douyin", name: "抖音", color: "#000", creatorUrl: "https://creator.douyin.com/" },
    { key: "youtube", name: "YouTube", color: "#FF0000", creatorUrl: "https://studio.youtube.com/" },
    { key: "xiaohongshu", name: "小红书", color: "#FF3B3B", creatorUrl: "https://creator.xiaohongshu.com/" },
    { key: "shipin", name: "视频号", color: "#07C160", creatorUrl: "https://channels.weixin.qq.com/" },
    { key: "bilibili", name: "哔哩哔哩", color: "#FB7299", creatorUrl: "https://member.bilibili.com/" },
    { key: "gongzhonghao", name: "公众号", color: "#2DC100", creatorUrl: "https://mp.weixin.qq.com/" }
  ];

  /* ============ 自有本地数据（灵感收藏 / 自媒体发布记录，独立于 state.json） ============ */
  const LS_SOCIAL = "oos-social-v1";
  const LS_INSP = "oos-insp-v1";
  function getSocial() { try { return JSON.parse(localStorage.getItem(LS_SOCIAL)) || {}; } catch (e) { return {}; } }
  function saveSocial(d) { try { localStorage.setItem(LS_SOCIAL, JSON.stringify(d)); } catch (e) {} }
  function getInsp() { try { return JSON.parse(localStorage.getItem(LS_INSP)) || { favs: [], saved: [] }; } catch (e) { return { favs: [], saved: [] }; } }
  function saveInsp(d) { try { localStorage.setItem(LS_INSP, JSON.stringify(d)); } catch (e) {} }

  /* ============ 注入样式 ============ */
  const STYLE = `
  .nav-item[data-module]{margin-top:2px}
  .nav-module-label{display:flex;flex-direction:column;line-height:1.1;text-align:left}
  .nav-module-label small{font-size:10px;opacity:.5;font-weight:400;letter-spacing:.04em}
  .nav-sep{height:1px;background:var(--border-subtle, rgba(0,0,0,.08));margin:10px 4px}
  .lang-toggle{margin-top:auto;display:flex;align-items:center;justify-content:center;gap:6px;padding:8px;border-radius:10px;background:rgba(16,185,129,.1);color:#0f9d6b;font-size:12px;font-weight:600;cursor:pointer;border:none}
  .lang-toggle:hover{background:rgba(16,185,129,.18)}
  /* 新建 FAB */
  #newFab{position:fixed;right:22px;bottom:84px;z-index:60;display:inline-flex;align-items:center;gap:8px;padding:13px 20px;border:none;border-radius:999px;background:#151513;color:#fff;font-size:14px;font-weight:600;font-family:inherit;box-shadow:0 8px 24px rgba(0,0,0,.25);cursor:pointer;transition:transform .2s cubic-bezier(.16,1,.3,1),box-shadow .2s ease;-webkit-tap-highlight-color:transparent}
  #newFab:hover{transform:translateY(-2px);box-shadow:0 12px 30px rgba(0,0,0,.32)}
  #newFab:active{transform:scale(.96)}
  #newFab .nf-icon{font-size:18px;line-height:1}
  @media(max-width:640px){#newFab{right:14px;bottom:72px;padding:11px 15px}#newFab .nf-label{display:none}}
  /* 模块视图通用 */
  .mod-wrap{max-width:960px;margin:0 auto;padding:8px 0}
  .mod-head{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;margin-bottom:18px}
  .mod-head h2{font-size:26px;font-weight:700;letter-spacing:-.01em;margin:0}
  .mod-head p{margin:4px 0 0;opacity:.6;font-size:13px}
  .mod-section{background:var(--bg-card,#fff);border:1px solid var(--border-card,rgba(0,0,0,.08));border-radius:16px;padding:18px;margin-bottom:16px}
  .mod-section h3{margin:0 0 12px;font-size:14px;letter-spacing:.04em;text-transform:uppercase;opacity:.5}
  /* 英语 */
  .eng-lessons{display:flex;flex-direction:column;gap:8px}
  .eng-lesson{display:flex;flex-direction:column;padding:12px 14px;border-radius:12px;border:1px solid var(--border-card,rgba(0,0,0,.08));cursor:pointer;transition:border-color .2s,background .2s}
  .eng-lesson:hover{border-color:#10b981}
  .eng-lesson.active{background:rgba(16,185,129,.08);border-color:#10b981}
  .eng-lesson .lt{font-weight:600}
  .eng-lesson .lm{font-size:12px;opacity:.5}
  .eng-stage{display:grid;grid-template-columns:1fr;gap:14px}
  @media(min-width:720px){.eng-stage{grid-template-columns:240px 1fr}}
  .eng-player{background:rgba(16,185,129,.06);border:1px solid rgba(16,185,129,.2);border-radius:16px;padding:24px;text-align:center}
  .eng-sentence-en{font-size:22px;font-weight:600;line-height:1.4;letter-spacing:-.01em}
  .eng-sentence-en.english-hidden{filter:blur(8px);user-select:none}
  .eng-sentence-zh{margin-top:12px;opacity:.6;font-size:15px}
  .eng-num{margin-top:14px;font-size:13px;opacity:.5}
  .eng-controls{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin-top:18px}
  .eng-control-btn{padding:9px 14px;border-radius:10px;border:1px solid var(--border-card,rgba(0,0,0,.12));background:#fff;cursor:pointer;font-size:13px;font-weight:600;transition:.2s}
  .eng-control-btn:hover{border-color:#10b981}
  .eng-control-btn.active{background:#10b981;color:#fff;border-color:#10b981}
  .eng-progress{height:6px;border-radius:999px;background:rgba(0,0,0,.08);overflow:hidden;margin-top:16px}
  .eng-progress>div{height:100%;background:#10b981;transition:width .3s}
  /* 自媒体 */
  .social-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:14px}
  .social-card{background:var(--bg-card,#fff);border:1px solid var(--border-card,rgba(0,0,0,.08));border-radius:16px;padding:16px;display:flex;flex-direction:column;gap:12px}
  .social-card-header{display:flex;align-items:center;gap:10px}
  .social-card-icon{width:34px;height:34px;border-radius:9px;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:14px}
  .social-card-icon.douyin{background:#000}.social-card-icon.youtube{background:#FF0000}.social-card-icon.xiaohongshu{background:#FF3B3B}.social-card-icon.shipin{background:#07C160}.social-card-icon.bilibili{background:#FB7299}.social-card-icon.gongzhonghao{background:#2DC100}
  .social-card-name{font-weight:600}
  .social-account{border:1px dashed var(--border-card,rgba(0,0,0,.18));border-radius:10px;padding:8px 10px;font-size:13px;cursor:pointer}
  .social-account:hover{border-color:#10b981}
  .no-account{opacity:.45}
  .social-card-actions{display:flex;gap:8px}
  .social-publish-btn,.social-posts-btn{flex:1;text-align:center;padding:9px;border-radius:10px;font-size:13px;font-weight:600;text-decoration:none;border:none;cursor:pointer;transition:.2s}
  .social-publish-btn{background:#10b981;color:#fff;display:flex;align-items:center;justify-content:center;gap:5px}
  .social-publish-btn:hover{filter:brightness(1.05)}
  .social-posts-btn{background:rgba(0,0,0,.05)}
  .social-posts-btn:hover{background:rgba(0,0,0,.09)}
  .social-post-preview{display:flex;flex-direction:column;gap:6px;font-size:12px}
  .social-post-preview-item{display:flex;justify-content:space-between;gap:8px;cursor:pointer;opacity:.8}
  .social-post-preview-item:hover{opacity:1}
  .post-time{opacity:.5}
  .social-empty-preview{opacity:.4}
  /* 灵感 */
  .insp-toolbar{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px}
  .insp-refresh{padding:9px 16px;border-radius:10px;background:#10b981;color:#fff;border:none;font-weight:600;cursor:pointer}
  .insp-refresh:hover{filter:brightness(1.05)}
  .insp-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px}
  .insp-card{background:var(--bg-card,#fff);border:1px solid var(--border-card,rgba(0,0,0,.08));border-radius:16px;padding:16px;display:flex;flex-direction:column;gap:10px}
  .insp-platform{display:flex;align-items:center;gap:8px;font-size:12px;opacity:.7}
  .insp-platform-icon{width:22px;height:22px;border-radius:6px;display:flex;align-items:center;justify-content:center;color:#fff;font-size:11px;font-weight:700}
  .insp-title{font-weight:600;font-size:15px;line-height:1.4}
  .insp-stats{display:flex;gap:14px;font-size:12px}
  .insp-stat-value{font-weight:700}
  .insp-stat-label{opacity:.45}
  .insp-recreate{font-size:13px;opacity:.7;background:rgba(16,185,129,.06);border-radius:10px;padding:10px;line-height:1.5}
  .insp-actions{display:flex;flex-wrap:wrap;gap:6px}
  .insp-btn{padding:7px 10px;border-radius:9px;border:1px solid var(--border-card,rgba(0,0,0,.12));background:#fff;font-size:12px;cursor:pointer;transition:.2s}
  .insp-btn:hover{border-color:#10b981}
  .insp-btn.saved{background:#10b981;color:#fff;border-color:#10b981}
  /* 表单 modal */
  .oos-modal-mask{position:fixed;inset:0;background:rgba(10,12,10,.45);backdrop-filter:blur(4px);z-index:90;display:flex;align-items:center;justify-content:center;padding:20px}
  .oos-modal{width:100%;max-width:460px;background:var(--bg-card,#fff);border-radius:18px;padding:22px;box-shadow:0 24px 60px rgba(0,0,0,.3);max-height:90vh;overflow:auto}
  .oos-modal h3{margin:0 0 16px;font-size:18px}
  .oos-field{margin-bottom:13px}
  .oos-field label{display:block;font-size:12px;opacity:.6;margin-bottom:5px}
  .oos-field input,.oos-field select,.oos-field textarea{width:100%;padding:10px 12px;border:1px solid var(--border-card,rgba(0,0,0,.14));border-radius:10px;font-size:14px;font-family:inherit;background:#fff;color:inherit}
  .oos-field textarea{resize:vertical;min-height:60px}
  .oos-seg{display:flex;gap:8px}
  .oos-seg button{flex:1;padding:10px;border-radius:10px;border:1px solid var(--border-card,rgba(0,0,0,.14));background:#fff;cursor:pointer;font-weight:600;font-size:13px}
  .oos-seg button.active{background:#10b981;color:#fff;border-color:#10b981}
  .oos-modal-actions{display:flex;gap:10px;margin-top:8px}
  .oos-modal-actions button{flex:1;padding:12px;border-radius:11px;font-weight:600;cursor:pointer;border:none;font-size:14px}
  .oos-btn-primary{background:#10b981;color:#fff}
  .oos-btn-primary:hover{filter:brightness(1.05)}
  .oos-btn-ghost{background:rgba(0,0,0,.06)}
  .track-new-btn{margin-left:auto;padding:7px 13px;border-radius:9px;background:#10b981;color:#fff;border:none;font-size:12px;font-weight:600;cursor:pointer}
  `;

  function injectStyle() { const s = document.createElement("style"); s.textContent = STYLE; document.head.appendChild(s); }

  /* ============ 导航注入 ============ */
  function injectNav() {
    const nav = document.querySelector(".launcher .nav") || document.querySelector("nav.nav");
    if (!nav) return;
    const sep = document.createElement("div"); sep.className = "nav-sep"; nav.appendChild(sep);
    const items = [
      { mod: "english", label: t("navEnglish"), sub: "English" },
      { mod: "social", label: t("navSocial"), sub: "Social" },
      { mod: "inspiration", label: t("navInspiration"), sub: "Ideas" }
    ];
    items.forEach(it => {
      const b = document.createElement("button");
      b.className = "nav-item"; b.dataset.module = it.mod;
      b.innerHTML = `<i>★</i><span class="nav-module-label"><span>${esc(it.label)}</span><small>${esc(it.sub)}</small></span>`;
      b.addEventListener("click", () => switchModule(it.mod));
      nav.appendChild(b);
    });
    // 语言切换
    const lang = document.createElement("button");
    lang.className = "lang-toggle"; lang.id = "langToggle";
    lang.innerHTML = `<span>${t("langToggle")}</span>`;
    lang.addEventListener("click", toggleLang);
    nav.appendChild(lang);
  }

  function toggleLang() {
    LANG = LANG === "zh" ? "en" : "zh";
    localStorage.setItem("oos-lang", LANG);
    document.documentElement.lang = LANG === "zh" ? "zh-CN" : "en";
    // 重渲染当前模块 + 导航
    const activeMod = document.querySelector(".nav-item.active[data-module]");
    injectNavRefresh();
    if (activeMod) switchModule(activeMod.dataset.module);
    toastMsg(LANG === "zh" ? "已切到中文" : "Switched to English");
  }
  function injectNavRefresh() {
    const nav = document.querySelector(".launcher .nav") || document.querySelector("nav.nav");
    if (!nav) return;
    // 移除旧的模块项与分隔与语言按钮，重新注入
    nav.querySelectorAll("[data-module],.nav-sep,.lang-toggle").forEach(n => n.remove());
    injectNav();
  }

  /* ============ 模块切换 ============ */
  let currentMod = null;
  function switchModule(mod) {
    currentMod = mod;
    document.querySelectorAll(".nav-item").forEach(b => {
      if (b.dataset.module === mod) b.classList.add("active");
      else if (!b.dataset.view) b.classList.remove("active");
    });
    // 取消原导航 active
    document.querySelectorAll('.nav-item[data-view]').forEach(b => b.classList.remove("active"));
    const c = document.getElementById("viewContent");
    if (!c) return;
    if (mod === "english") c.innerHTML = renderEnglish();
    else if (mod === "social") c.innerHTML = renderSocial();
    else if (mod === "inspiration") c.innerHTML = renderInspiration();
    window.scrollTo(0, 0);
  }

  /* ============ 英语视图 ============ */
  let engState = { lesson: 0, sentence: 0, blind: false, shadow: false };
  function renderEnglish() {
    engState = JSON.parse(localStorage.getItem("oos-eng") || "null") || engState;
    const cur = ENGLISH_LESSONS[engState.lesson] || ENGLISH_LESSONS[0];
    const list = ENGLISH_LESSONS.map((l, i) => `<div class="eng-lesson ${i === engState.lesson ? "active" : ""}" data-eng-lesson="${i}"><div class="lt">${esc(LANG === "zh" ? l.zh : l.title)}</div><div class="lm">${l.sentences.length} ${t("sentence")}</div></div>`).join("");
    return `<div class="mod-wrap">
      <div class="mod-head"><div><h2>${t("engTitle")}</h2><p>${t("engSub")}</p></div></div>
      <div class="eng-stage">
        <div class="mod-section"><h3>${t("lessonList")}</h3><div class="eng-lessons">${list}</div></div>
        <div class="eng-player">
          <div class="eng-sentence-en ${engState.blind ? "english-hidden" : ""}" id="engEn">${esc(cur.sentences[engState.sentence].en)}</div>
          <div class="eng-sentence-zh" id="engZh">${esc(cur.sentences[engState.sentence].zh)}</div>
          <div class="eng-num" id="engNum">${engState.sentence + 1} / ${cur.sentences.length}</div>
          <div class="eng-controls">
            <button class="eng-control-btn" id="engPrev">${t("prev")}</button>
            <button class="eng-control-btn" id="engPlay">▶ ${t("play")}</button>
            <button class="eng-control-btn ${engState.blind ? "active" : ""}" id="engBlind">${t("blind")}</button>
            <button class="eng-control-btn" id="engReveal">${t("reveal")}</button>
            <button class="eng-control-btn ${engState.shadow ? "active" : ""}" id="engShadow">${t("shadow")}</button>
            <button class="eng-control-btn" id="engNext">${t("next")}</button>
          </div>
          <div class="eng-progress"><div id="engFill" style="width:${((engState.sentence + 1) / cur.sentences.length) * 100}%"></div></div>
        </div>
      </div>
    </div>`;
  }
  function bindEnglish() {
    document.querySelectorAll("[data-eng-lesson]").forEach(el => el.addEventListener("click", () => { engState.lesson = +el.dataset.engLesson; engState.sentence = 0; engState.blind = false; persistEng(); switchModule("english"); }));
    const byId = id => document.getElementById(id);
    byId("engPrev") && byId("engPrev").addEventListener("click", () => stepEng(-1));
    byId("engNext") && byId("engNext").addEventListener("click", () => stepEng(1));
    byId("engPlay") && byId("engPlay").addEventListener("click", playEng);
    byId("engBlind") && byId("engBlind").addEventListener("click", () => { engState.blind = !engState.blind; persistEng(); switchModule("english"); });
    byId("engReveal") && byId("engReveal").addEventListener("click", () => { engState.blind = false; persistEng(); switchModule("english"); });
    byId("engShadow") && byId("engShadow").addEventListener("click", () => { engState.shadow = !engState.shadow; persistEng(); switchModule("english"); });
  }
  function stepEng(d) { const cur = ENGLISH_LESSONS[engState.lesson]; let i = engState.sentence + d; if (i < 0) i = cur.sentences.length - 1; if (i >= cur.sentences.length) i = 0; engState.sentence = i; engState.blind = false; persistEng(); switchModule("english"); }
  function playEng() { const cur = ENGLISH_LESSONS[engState.lesson]; const s = cur.sentences[engState.sentence].en; if ("speechSynthesis" in window) { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(s); u.lang = "en-US"; u.rate = 0.85; speechSynthesis.speak(u); } else toastMsg("Speech not supported"); }
  function persistEng() { try { localStorage.setItem("oos-eng", JSON.stringify(engState)); } catch (e) {} }

  /* ============ 自媒体视图 ============ */
  function renderSocial() {
    const data = getSocial();
    const cards = SOCIAL_PLATFORMS.map(p => {
      const sm = data[p.key] || { username: "", homepage: "", posts: [] };
      const posts = sm.posts || [];
      const preview = posts.slice(0, 3).map(po => `<div class="social-post-preview-item" data-social-post="${p.key}"><span>${esc(po.title || t("noPosts"))}</span><span class="post-time">${(po.time || "").slice(0, 10)}</span></div>`).join("") || `<div class="social-empty-preview">${t("noPosts")}</div>`;
      return `<div class="social-card">
        <div class="social-card-header"><div class="social-card-icon ${p.key}">${p.name.slice(0, 1)}</div><div class="social-card-name">${esc(p.name)}</div></div>
        <div class="social-account" data-social-account="${p.key}">${sm.username ? esc(sm.username) : `<span class="no-account">+ ${t("editAccount")}</span>`}</div>
        <div class="social-card-actions">
          <a class="social-publish-btn ${p.key}" href="${p.creatorUrl}" target="_blank" rel="noopener">＋ ${t("publish")}</a>
          <button class="social-posts-btn" data-social-post="${p.key}"><span class="post-count">${posts.length}</span> ${t("posts")}</button>
        </div>
        <div class="social-post-preview">${preview}</div>
      </div>`;
    }).join("");
    return `<div class="mod-wrap">
      <div class="mod-head"><div><h2>${t("socialTitle")}</h2><p>${t("socialSub")}</p></div></div>
      <div class="social-grid">${cards}</div>
    </div>`;
  }
  function bindSocial() {
    document.querySelectorAll("[data-social-account]").forEach(el => el.addEventListener("click", () => openAccountModal(el.dataset.socialAccount)));
    document.querySelectorAll("[data-social-post]").forEach(el => el.addEventListener("click", () => openPostModal(el.dataset.socialPost)));
  }
  function openAccountModal(key) {
    const data = getSocial(); const sm = data[key] || { username: "", homepage: "" };
    const name = (SOCIAL_PLATFORMS.find(p => p.key === key) || {}).name || key;
    openModal(`<h3>${esc(name)} · ${t("editAccount")}</h3>
      <div class="oos-field"><label>${t("accountName")}</label><input id="accUser" value="${esc(sm.username || "")}"></div>
      <div class="oos-field"><label>${t("homepage")}</label><input id="accHome" value="${esc(sm.homepage || "")}"></div>
      <div class="oos-modal-actions"><button class="oos-btn-ghost" data-close>${t("cancel")}</button><button class="oos-btn-primary" id="accSave">${t("save")}</button></div>`,
      () => {
        document.getElementById("accSave").addEventListener("click", () => {
          const d = getSocial(); if (!d[key]) d[key] = { username: "", homepage: "", posts: [] };
          d[key].username = document.getElementById("accUser").value.trim();
          d[key].homepage = document.getElementById("accHome").value.trim();
          saveSocial(d); closeModal(); switchModule("social"); toastMsg(t("saved"));
        });
      });
  }
  function openPostModal(key) {
    const data = getSocial(); const sm = data[key] || { posts: [] }; const posts = sm.posts || [];
    const name = (SOCIAL_PLATFORMS.find(p => p.key === key) || {}).name || key;
    const list = posts.map((p, i) => `<div class="social-post-preview-item" style="cursor:default"><span>${p.link ? `<a href="${esc(p.link)}" target="_blank">${esc(p.title)}</a>` : esc(p.title)}</span><button class="insp-btn" data-del-post="${i}">${t("deletePost")}</button></div>`).join("") || `<div class="social-empty-preview">${t("noPosts")}</div>`;
    openModal(`<h3>${esc(name)} · ${t("posts")}</h3>
      <div class="oos-field"><label>${t("postTitle")}</label><input id="postTitle"></div>
      <div class="oos-field"><label>${t("postLink")}</label><input id="postLink"></div>
      <div class="oos-field"><label>${t("postTime")}</label><input id="postTime" type="datetime-local" value="${new Date().toISOString().slice(0, 16)}"></div>
      <div class="oos-field"><label>${t("postDesc")}</label><textarea id="postDesc"></textarea></div>
      <div class="oos-modal-actions"><button class="oos-btn-ghost" data-close>${t("cancel")}</button><button class="oos-btn-primary" id="postSave">${t("addPost")}</button></div>
      <div style="margin-top:14px">${list}</div>`,
      () => {
        document.getElementById("postSave").addEventListener("click", () => {
          const title = document.getElementById("postTitle").value.trim();
          if (!title) { toastMsg(t("pleaseTitle")); return; }
          const d = getSocial(); if (!d[key]) d[key] = { username: "", homepage: "", posts: [] }; if (!d[key].posts) d[key].posts = [];
          d[key].posts.unshift({ id: "p" + Date.now(), title, link: document.getElementById("postLink").value.trim(), time: document.getElementById("postTime").value, description: document.getElementById("postDesc").value.trim() });
          saveSocial(d); closeModal(); switchModule("social"); toastMsg(t("saved"));
        });
        document.querySelectorAll("[data-del-post]").forEach(b => b.addEventListener("click", () => {
          const d = getSocial(); d[key].posts.splice(+b.dataset.delPost, 1); saveSocial(d); openPostModal(key);
        }));
      });
  }

  /* ============ 灵感视图 ============ */
  function dailyInspirations(seed) {
    const d = seed || todayIso();
    let h = 0; for (let i = 0; i < d.length; i++) { h = ((h << 5) - h) + d.charCodeAt(i); h |= 0; }
    const rng = () => { h = (h * 16807) % 2147483647; return (h - 1) / 2147483646; };
    const sh = INSPIRATION_POOL.slice();
    for (let i = sh.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [sh[i], sh[j]] = [sh[j], sh[i]]; }
    return sh.slice(0, 8).map((it, idx) => ({ ...it, id: `insp-${d}-${idx}`, heat: Math.floor(it.h * (0.8 + rng() * 0.4)), peak: Math.floor(it.pk * (0.7 + rng() * 0.6)), growth: Math.floor(it.g * (0.8 + rng() * 0.4)) }));
  }
  function renderInspiration() {
    const insp = getInsp();
    const items = dailyInspirations().map(it => {
      const isFav = insp.favs.includes(it.id);
      const q = encodeURIComponent(it.t);
      return `<div class="insp-card">
        <div class="insp-platform"><div class="insp-platform-icon ${it.p === "douyin" ? "social-card-icon douyin" : "social-card-icon bilibili"}">${it.p === "douyin" ? "抖" : "B"}</div><div>${it.p === "douyin" ? "抖音" : "B站"} · ${esc(it.c)}</div></div>
        <div class="insp-title">${esc(it.t)}</div>
        <div class="insp-stats">
          <div class="insp-stat"><div class="insp-stat-value">${fmtNum(it.heat)}</div><div class="insp-stat-label">${t("heat")}</div></div>
          <div class="insp-stat"><div class="insp-stat-value">${fmtNum(it.peak)}</div><div class="insp-stat-label">${t("peak")}</div></div>
          <div class="insp-stat"><div class="insp-stat-value">${fmtNum(it.growth)}</div><div class="insp-stat-label">${t("growth")}</div></div>
        </div>
        <div class="insp-recreate"><strong>${t("recreate")}：</strong>${esc(it.r)}</div>
        <div class="insp-actions">
          <button class="insp-btn" onclick="OOSM.openExternal('https://www.douyin.com/search/${q}')">🎵 ${t("viewDouyin")}</button>
          <button class="insp-btn" onclick="OOSM.openExternal('https://search.bilibili.com/all?keyword=${q}')">📺 ${t("viewBilibili")}</button>
          <button class="insp-btn ${isFav ? "saved" : ""}" data-insp-save="${it.id}" data-insp-title="${esc(it.t)}" data-insp-rec="${esc(it.r)}">⭐ ${t("save")}</button>
          <button class="insp-btn" data-insp-task="${it.id}" data-insp-title="${esc(it.t)}" data-insp-rec="${esc(it.r)}">☑ ${t("addTask")}</button>
        </div>
      </div>`;
    }).join("");
    return `<div class="mod-wrap">
      <div class="mod-head"><div><h2>${t("inspTitle")}</h2><p>${t("inspSub")}</p></div></div>
      <div class="insp-toolbar"><span style="opacity:.5;font-size:13px">${todayIso()}</span><button class="insp-refresh" id="inspRefresh">↻ ${t("refresh")}</button></div>
      <div class="insp-grid">${items}</div>
    </div>`;
  }
  function bindInspiration() {
    const rf = document.getElementById("inspRefresh"); rf && rf.addEventListener("click", () => switchModule("inspiration"));
    document.querySelectorAll("[data-insp-save]").forEach(b => b.addEventListener("click", () => {
      const insp = getInsp(); const id = b.dataset.inspSave;
      if (insp.favs.includes(id)) { insp.favs = insp.favs.filter(x => x !== id); toastMsg(LANG === "zh" ? "已取消收藏" : "Unsaved"); }
      else { insp.favs.push(id); toastMsg(t("saved")); }
      saveInsp(insp); switchModule("inspiration");
    }));
    document.querySelectorAll("[data-insp-task]").forEach(b => b.addEventListener("click", () => {
      const title = b.dataset.inspTitle, rec = b.dataset.inspRec;
      createTask({ title: `二创：「${title.slice(0, 50)}」`, goal: "自媒体起飞", nextStep: "二创建议：" + rec, due: todayIso(), priority: "normal" });
      const insp = getInsp(); if (!insp.saved) insp.saved = []; insp.saved.push(b.dataset.inspTask); saveInsp(insp);
      toastMsg(t("taskAdded"));
    }));
  }

  /* ============ 新建表单 ============ */
  let newFabEl = null;
  function injectNewFab() {
    if (document.getElementById("newFab")) return;
    const b = document.createElement("button");
    b.id = "newFab"; b.innerHTML = `<span class="nf-icon">＋</span><span class="nf-label">${t("newTaskFull")}</span>`;
    b.addEventListener("click", openNewForm);
    document.body.appendChild(b); newFabEl = b;
  }
  function tracksList() {
    // 从当前 state 取轨道名
    try {
      const s = window.__OOS_STATE && window.__OOS_STATE();
      if (s && s.tracks) return s.tracks.map(x => x.name);
    } catch (e) {}
    return ["自媒体起飞", "数字游民攒钱", "生活上安排事情"];
  }
  function openNewForm(presetType) {
    const type = presetType || "task";
    const trackOpts = tracksList().map(n => `<option value="${esc(n)}">${esc(n)}</option>`).join("");
    openModal(`<h3>${t("formTitle")}</h3>
      <div class="oos-field"><label>${t("type")}</label><div class="oos-seg" id="newType">
        <button data-t="task" class="${type === "task" ? "active" : ""}">${t("typeTask")}</button>
        <button data-t="track" class="${type === "track" ? "active" : ""}">${t("typeTrack")}</button>
      </div></div>
      <div id="newTaskFields">
        <div class="oos-field"><label>${t("fTitle")}</label><input id="nfTitle" placeholder="例如：剪完第一条口播视频"></div>
        <div class="oos-field"><label>${t("fTrack")}</label><select id="nfTrack">${trackOpts}</select></div>
        <div class="oos-field"><label>${t("fDate")}</label><input id="nfDate" type="date" value="${todayIso()}"></div>
        <div class="oos-field"><label>${t("fNext")}</label><textarea id="nfNext" placeholder="最小下一步"></textarea></div>
        <div class="oos-field"><label>${t("fPriority")}</label><select id="nfPri"><option value="normal">${t("priNormal")}</option><option value="high">${t("priHigh")}</option></select></div>
      </div>
      <div id="newTrackFields" style="display:${type === "track" ? "block" : "none"}">
        <div class="oos-field"><label>${t("fTrackName")}</label><input id="nfTrackName" placeholder="例如：每天英语口语打卡"></div>
        <div class="oos-field"><label>${t("fNext")}</label><textarea id="nfTrackNext" placeholder="这条主线要达成的目标"></textarea></div>
      </div>
      <div class="oos-modal-actions"><button class="oos-btn-ghost" data-close>${t("cancel")}</button><button class="oos-btn-primary" id="nfSubmit">${t("submit")}</button></div>`,
      () => {
        document.querySelectorAll("#newType button").forEach(btn => btn.addEventListener("click", () => {
          document.querySelectorAll("#newType button").forEach(x => x.classList.remove("active"));
          btn.classList.add("active");
          const isTrack = btn.dataset.t === "track";
          document.getElementById("newTaskFields").style.display = isTrack ? "none" : "block";
          document.getElementById("newTrackFields").style.display = isTrack ? "block" : "none";
        }));
        document.getElementById("nfSubmit").addEventListener("click", () => {
          const isTrack = document.querySelector("#newType button.active").dataset.t === "track";
          if (isTrack) {
            const name = document.getElementById("nfTrackName").value.trim();
            if (!name) { toastMsg(t("pleaseTitle")); return; }
            createTrack({ name, nextAction: document.getElementById("nfTrackNext").value.trim() });
            closeModal(); toastMsg(t("trackAdded"));
          } else {
            const title = document.getElementById("nfTitle").value.trim();
            if (!title) { toastMsg(t("pleaseTitle")); return; }
            createTask({
              title,
              goal: document.getElementById("nfTrack").value,
              nextStep: document.getElementById("nfNext").value.trim(),
              due: document.getElementById("nfDate").value || todayIso(),
              priority: document.getElementById("nfPri").value
            });
            closeModal(); toastMsg(t("taskAdded"));
          }
        });
      });
  }

  /* ============ 写操作（走原 app.js 的 stateOps → shim 持久化） ============ */
  function createTask(obj) {
    const now = new Date().toISOString();
    const task = {
      id: "task-u" + Date.now(),
      title: obj.title, goal: obj.goal || "自媒体起飞", status: "open",
      priority: obj.priority || "normal", nextStep: obj.nextStep || "",
      estimatedMinutes: 30, due: obj.due || todayIso(),
      createdAt: now, updatedAt: now
    };
    if (window.stateOps) window.stateOps([{ type: "task.create", task }], t("taskAdded"));
    else console.warn("stateOps unavailable");
  }
  function createTrack(obj) {
    const now = todayIso();
    const id = "track-u" + Date.now();
    const track = {
      id, name: obj.name, navLabel: obj.name, summary: obj.nextAction || "", detail: "",
      archetype: "project", role: "operational", cadenceDays: 7, monitoring: { enabled: true },
      progress: 0, trackType: "project", stage: "新建", nextAction: obj.nextAction || "",
      nextActionDue: "", risk: "low", needsQuestion: "", metric: "", target: "", deadline: "",
      lastUpdated: now, views: [], checkpoints: []
    };
    if (window.stateOps) window.stateOps([{ type: "track.create", track }], t("trackAdded"));
    else console.warn("stateOps unavailable");
  }

  /* ============ Modal 工具 ============ */
  function openModal(html, onMount) {
    closeModal();
    const mask = document.createElement("div"); mask.className = "oos-modal-mask"; mask.id = "oosModal";
    mask.innerHTML = `<div class="oos-modal">${html}</div>`;
    mask.addEventListener("click", e => { if (e.target === mask || e.target.closest("[data-close]")) closeModal(); });
    document.body.appendChild(mask);
    if (onMount) onMount();
  }
  function closeModal() { const m = document.getElementById("oosModal"); if (m) m.remove(); }

  /* ============ Tracks 视图注入「新建长期主线」 ============ */
  function observeTracks() {
    const target = document.getElementById("viewContent");
    if (!target) return;
    const mo = new MutationObserver(() => {
      const head = target.querySelector(".tracks-head, .section-head, h2");
      // 仅在 tracks 视图且尚未注入时添加按钮
      if (document.querySelector('.nav-item[data-view="tracks"].active') && !document.getElementById("trackNewBtn")) {
        const anchor = target.querySelector(".two-col, .track-grid, .tracks-list") || target.firstElementChild;
        if (anchor) {
          const b = document.createElement("button");
          b.id = "trackNewBtn"; b.className = "track-new-btn"; b.textContent = "＋ " + (LANG === "zh" ? "新建长期主线" : "New Track");
          b.addEventListener("click", () => openNewForm("track"));
          anchor.parentNode.insertBefore(b, anchor);
        }
      }
    });
    mo.observe(target, { childList: true, subtree: true });
  }

  /* ============ 主入口 ============ */
  function boot() {
    injectStyle();
    injectNav();
    injectNewFab();
    observeTracks();
    // 暴露给内联 onclick
    window.OOSM = { openExternal };
    // 切换回原视图时同步模块导航高亮
    const origNav = document.querySelectorAll('.nav-item[data-view]');
    origNav.forEach(b => b.addEventListener("click", () => {
      document.querySelectorAll('[data-module]').forEach(x => x.classList.remove("active"));
    }));
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  // 在视图渲染后绑定模块内交互
  const origPush = history.pushState;
  function afterRenderBind() {
    if (currentMod === "english") bindEnglish();
    else if (currentMod === "social") bindSocial();
    else if (currentMod === "inspiration") bindInspiration();
  }
  // 监听 viewContent 变化以绑定
  const vc = document.getElementById("viewContent");
  if (vc) new MutationObserver(afterRenderBind).observe(vc, { childList: true });
})();
