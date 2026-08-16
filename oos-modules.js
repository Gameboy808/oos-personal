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
      navEnglish: "英语练习", navSocial: "自媒体运营", navInspiration: "灵感发现", navJournal: "手帐",
      newTask: "新建", newTaskFull: "＋ 新建", langToggle: "EN",
      newFor: { today: "新建任务", plan: "新建安排", tracks: "新建轨道", track: "新建任务", english: "新建例句", social: "新建发布", inspiration: "新建灵感", journal: "写手帐", finance: "记一笔", notes: "新建备忘" },
      moduleEnglish: "英语练习", moduleSocial: "自媒体运营", moduleInspiration: "灵感发现",
      englishSub: "每日磨耳朵 · 盲听跟读", socialSub: "六平台账号与发布记录", inspirationSub: "每日灵感 · 一键成稿",
      engTitle: "英语练习", engSub: "选一门课，盲听→显示原文→跟读，口语自然上来",
      lessonList: "课程", blind: "盲听", reveal: "显示原文", shadow: "跟读", play: "播放", prev: "上一句", next: "下一句", sentence: "句子",
      socialTitle: "自媒体运营", socialSub: "管理 6 个平台的账号、一键跳创作者中心、记录发布内容",
      editAccount: "编辑账号", publish: "发布", posts: "条发布", noPosts: "还没有发布记录", viewAll: "查看全部",
      accountName: "账号名 / @handle", homepage: "主页链接", save: "保存", username: "账号", deletePost: "删除",
      postTitle: "标题", postLink: "链接", postTime: "时间", postDesc: "描述", addPost: "记录发布",
      inspTitle: "灵感发现", inspSub: "每天 8 条高潜选题，点收藏进想法、点成稿直接进任务",
      journalTitle: "手帐", journalSub: "图文记录：灵感、素材、生活片段，随时翻阅",
      journalEmpty: "还没有手记", journalPrompt: "点右下角按钮，上传第一张图、写一段文字",
      fJournalTitle: "标题 / 主题", fJournalText: "文字记录", fJournalImages: "图片",
      journalAdded: "手帐已保存",
      journalTab1: "手帐", journalTab2: "复盘",
      guideTitle: "新手指南", guideWhat: "手帐 vs 复盘", guideWhatTxt: "手帐：随手存照片、灵感、生活碎片。复盘：每天 5 分钟，把今天的经历变成明天的经验。",
      guideTpl: "晚间 5 分钟模板", guideTplTxt: "① 心情　② 今天真正做完的　③ 1 个高光　④ 1 个可优化（只写事件）　⑤ 明天最关键的 1 件事",
      guideBujo: "Bullet Journal 符号", guideBujoTxt: "• 任务　○ 事件　- 笔记　✗ 划掉　★ 重要　用这些符号快速记，不用写长句",
      guideStreak: "连续打卡", guideStreakTxt: "每天记一次就亮一天。断了一天也没关系，第二天补上就行，别自责。",
      guideTip: "新手 3 条", guideTipTxt: "1) 先只做晚间，别加晨间。2) 给自己 5 分钟硬上限。3) 不写「我好烂」，只写发生了什么。",
      reviewTitle: "今日复盘", reviewEmpty: "今晚还没复盘", reviewStart: "开始今晚复盘", reviewDone: "今天已复盘 ✓", reviewEdit: "修改",
      reviewMood: "心情", reviewKeyword: "今日关键词", reviewDoneList: "今天做完的", reviewHighlight: "一个高光", reviewImprove: "一个可优化", reviewTomorrow: "明天最关键的 1 件事", reviewRapid: "快速记录（Bullet Journal）", reviewSaved: "复盘已保存",
      streakLabel: "连续复盘", days: "天",
      refresh: "换一批", save: "收藏", addTask: "成稿任务", heat: "热度", peak: "峰值", growth: "涨粉", recreate: "二创建议", viewDouyin: "抖音搜", viewBilibili: "B站搜",
      formTitle: "快速记录", type: "类型", typeTask: "今日 / 待办任务", typeTrack: "长期主线",
      fTitle: "要做什么", fTrack: "归哪条轨道", fTrackName: "主线名称", fDate: "定在哪一天", fNext: "下一步 / 备注", fPriority: "优先级",
      fStage: "当前阶段", fSummary: "描述 / 一句话说明", fTarget: "目标值", fUnit: "单位", fMetric: "指标名称", editTrack: "编辑轨道", trackUpdated: "轨道已更新",
      fVisionImage: "愿景图 / 激励图", fVisionImageHint: "像 Notion 封面一样，放一张能提醒你「为什么做这件事」的图片", addImage: "添加图片", changeImage: "更换图片", removeImage: "删除图片", imageTooLarge: "图片压缩后仍超过 300KB，请换一张小图",
      fBlockStart: "开始时间", fBlockEnd: "结束时间", fBlockKind: "类型", fBlockNote: "备注",
      kindFocus: "专注", kindFixed: "固定", kindRoutine: "例行", kindBuffer: "缓冲", kindErrand: "外出", kindAdmin: "行政", kindRecovery: "恢复",
      fLesson: "加入课程", fEnglish: "英文句子", fChinese: "中文意思",
      fInspTitle: "灵感标题", fInspCategory: "分类", fInspPlatform: "平台", fInspRecreate: "二创方向",
      priNormal: "普通", priHigh: "重要", submit: "保存", cancel: "取消",
      today: "今天", tmr: "明天",
      saved: "已保存", taskAdded: "任务已加入今日推进", trackAdded: "长期主线已创建", blockAdded: "安排已加入计划", sentenceAdded: "例句已加入课程", inspAdded: "灵感已收藏", pleaseTitle: "请填写标题",
      langZH: "中", langEN: "EN"
    },
    en: {
      navEnglish: "English", navSocial: "Social Media", navInspiration: "Inspiration", navJournal: "Journal",
      newTask: "New", newTaskFull: "+ New", langToggle: "中",
      newFor: { today: "+ New task", plan: "+ New block", tracks: "+ New track", track: "+ New task", english: "+ New sentence", social: "+ New post", inspiration: "+ New idea", journal: "+ New journal" },
      moduleEnglish: "English", moduleSocial: "Social Media", moduleInspiration: "Inspiration",
      englishSub: "Daily listening · blind + shadow", socialSub: "6 platforms · accounts & posts", inspirationSub: "Daily ideas · one-tap to draft",
      engTitle: "English Practice", engSub: "Pick a lesson, blind-listen → reveal → shadow. Speaking improves naturally",
      lessonList: "Lessons", blind: "Blind", reveal: "Reveal", shadow: "Shadow", play: "Play", prev: "Prev", next: "Next", sentence: "Sentence",
      socialTitle: "Social Media Ops", socialSub: "Manage 6 platforms, jump to creator studio, log your posts",
      editAccount: "Edit account", publish: "Publish", posts: "posts", noPosts: "No posts yet", viewAll: "View all",
      accountName: "Username / @handle", homepage: "Homepage", save: "Save", username: "Account", deletePost: "Delete",
      postTitle: "Title", postLink: "Link", postTime: "Time", postDesc: "Description", addPost: "Log post",
      inspTitle: "Inspiration Engine", inspSub: "8 high-potential topics daily. Save to ideas, or turn into a task",
      journalTitle: "Journal", journalSub: "Photo + text notes: ideas, materials, life moments",
      journalEmpty: "No journal entries yet", journalPrompt: "Tap the button to upload your first image and write a note",
      fJournalTitle: "Title / Theme", fJournalText: "Note", fJournalImages: "Images",
      journalAdded: "Journal saved",
      journalTab1: "Journal", journalTab2: "Review",
      guideTitle: "Guide", guideWhat: "Journal vs Review", guideWhatTxt: "Journal: casual photos, ideas, life moments. Review: 5 min daily to turn today into tomorrow's experience.",
      guideTpl: "Evening 5-min template", guideTplTxt: "1) Mood 2) What you finished 3) One highlight 4) One improvement (events only) 5) Tomorrow's one key thing",
      guideBujo: "Bullet Journal signs", guideBujoTxt: "• task ○ event - note ✗ done ★ important. Use these to log fast without long sentences.",
      guideStreak: "Streak", guideStreakTxt: "Log once a day and a day lights up. Miss one? Just resume next day, no guilt.",
      guideTip: "3 tips", guideTipTxt: "1) Evening only, skip morning. 2) Hard 5-min limit. 3) Don't write 'I'm so bad', just what happened.",
      reviewTitle: "Today Review", reviewEmpty: "No review yet tonight", reviewStart: "Start tonight review", reviewDone: "Reviewed today ✓", reviewEdit: "Edit",
      reviewMood: "Mood", reviewKeyword: "Keyword", reviewDoneList: "What got done", reviewHighlight: "One highlight", reviewImprove: "One improvement", reviewTomorrow: "Tomorrow's one key thing", reviewRapid: "Rapid log (Bullet Journal)", reviewSaved: "Review saved",
      streakLabel: "Streak", days: "days",
      refresh: "Shuffle", save: "Save", addTask: "To task", heat: "Heat", peak: "Peak", growth: "Growth", recreate: "Recreate", viewDouyin: "Search Douyin", viewBilibili: "Search Bilibili",
      formTitle: "Quick Capture", type: "Type", typeTask: "Today / To-do", typeTrack: "Long-term Track",
      fTitle: "What to do", fTrack: "Track", fTrackName: "Track name", fDate: "Due date", fNext: "Next step / note", fPriority: "Priority",
      fStage: "Stage", fSummary: "Summary / one-liner", fTarget: "Target value", fUnit: "Unit", fMetric: "Metric name", editTrack: "Edit track", trackUpdated: "Track updated",
      fVisionImage: "Vision / cover image", fVisionImageHint: "Like a Notion cover: a picture that reminds you why this track matters", addImage: "Add image", changeImage: "Change image", removeImage: "Remove image", imageTooLarge: "Image still over 300KB after compression. Please use a smaller one.",
      fBlockStart: "Start", fBlockEnd: "End", fBlockKind: "Kind", fBlockNote: "Note",
      kindFocus: "Focus", kindFixed: "Fixed", kindRoutine: "Routine", kindBuffer: "Buffer", kindErrand: "Errand", kindAdmin: "Admin", kindRecovery: "Recovery",
      fLesson: "Lesson", fEnglish: "English sentence", fChinese: "Chinese meaning",
      fInspTitle: "Idea title", fInspCategory: "Category", fInspPlatform: "Platform", fInspRecreate: "Recreate angle",
      priNormal: "Normal", priHigh: "High", submit: "Save", cancel: "Cancel",
      today: "Today", tmr: "Tomorrow",
      saved: "Saved", taskAdded: "Task added to Today", trackAdded: "Long-term track created", blockAdded: "Block added to plan", sentenceAdded: "Sentence added to lesson", inspAdded: "Idea saved", pleaseTitle: "Please enter a title",
      newFor: { today: "New task", plan: "New block", tracks: "New track", track: "New task", english: "New sentence", social: "New post", inspiration: "New idea", journal: "New journal", finance: "Log money", notes: "New note" },
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
  const LS_JOURNAL = "oos-journal-v1";
  function getSocial() { try { return JSON.parse(localStorage.getItem(LS_SOCIAL)) || {}; } catch (e) { return {}; } }
  function saveSocial(d) { try { localStorage.setItem(LS_SOCIAL, JSON.stringify(d)); } catch (e) {} }
  function getInsp() { try { return JSON.parse(localStorage.getItem(LS_INSP)) || { favs: [], saved: [] }; } catch (e) { return { favs: [], saved: [] }; } }
  function saveInsp(d) { try { localStorage.setItem(LS_INSP, JSON.stringify(d)); } catch (e) {} }
  function getJournal() { try { return JSON.parse(localStorage.getItem(LS_JOURNAL)) || []; } catch (e) { return []; } }
  function saveJournal(d) { try { localStorage.setItem(LS_JOURNAL, JSON.stringify(d)); } catch (e) {} }

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
  .oos-edit-grid{display:grid;grid-template-columns:1fr;gap:0 14px}
  @media(min-width:560px){.oos-edit-grid{grid-template-columns:1fr 1fr}}
  .oos-color-row{display:flex;flex-wrap:wrap;gap:8px;padding:4px 0}
  .oos-swatch{width:26px;height:26px;border-radius:50%;border:2px solid rgba(0,0,0,.12);cursor:pointer;padding:0;transition:transform .12s ease,box-shadow .12s ease;position:relative}
  .oos-swatch:hover{transform:scale(1.12)}
  .oos-swatch.active{border-color:#151513;box-shadow:0 0 0 2px #fff,0 0 0 4px #151513}
  .oos-seg{display:flex;gap:8px}
  .oos-seg button{flex:1;padding:10px;border-radius:10px;border:1px solid var(--border-card,rgba(0,0,0,.14));background:#fff;cursor:pointer;font-weight:600;font-size:13px}
  .oos-seg button.active{background:#10b981;color:#fff;border-color:#10b981}
  .oos-modal-actions{display:flex;gap:10px;margin-top:8px}
  .oos-modal-actions button{flex:1;padding:12px;border-radius:11px;font-weight:600;cursor:pointer;border:none;font-size:14px}
  .oos-btn-primary{background:#10b981;color:#fff}
  .oos-btn-primary:hover{filter:brightness(1.05)}
  .oos-btn-ghost{background:rgba(0,0,0,.06)}
  .oos-btn-secondary{display:inline-flex;align-items:center;justify-content:center;padding:9px 12px;border-radius:9px;border:1px solid var(--border-card,rgba(0,0,0,.14));background:#fff;cursor:pointer;font-size:12px;font-weight:600;transition:.15s}
  .oos-btn-secondary:hover{border-color:#10b981;color:#10b981}
  .oos-file-label{cursor:pointer}
  .oos-field-hint{margin:0 0 8px;color:#777;font-size:11px;line-height:1.45}
  .oos-vision-box{display:grid;gap:10px;padding:12px;border:1px dashed var(--border-card,rgba(0,0,0,.18));border-radius:12px;background:rgba(0,0,0,.02)}
  .oos-vision-box img{width:100%;max-height:180px;object-fit:cover;border-radius:10px;background:#f0f0f0}
  .oos-vision-actions{display:flex;gap:8px;flex-wrap:wrap}
  .track-new-btn{margin-left:auto;padding:7px 13px;border-radius:9px;background:#10b981;color:#fff;border:none;font-size:12px;font-weight:600;cursor:pointer}
  .nav-tracks-header{display:flex;align-items:center;justify-content:space-between;padding:0 8px 5px;color:#77746f;font-size:9px;letter-spacing:.085em;text-transform:uppercase}
  .nav-tracks-header button{padding:3px 7px;border-radius:5px;background:rgba(255,255,255,.1);color:#c7c4bd;border:none;font-size:10px;cursor:pointer}
  .nav-tracks-header button:hover{background:#10b981;color:#fff}
  .fab-hidden{display:none!important}
  /* 手帐 */
  .journal-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:16px}
  .journal-card{background:var(--bg-card,#fff);border:1px solid var(--border-card,rgba(0,0,0,.08));border-radius:16px;padding:16px;display:flex;flex-direction:column;gap:10px;cursor:pointer;transition:transform .2s,box-shadow .2s}
  .journal-card:hover{transform:translateY(-2px);box-shadow:0 12px 30px rgba(0,0,0,.08)}
  .journal-date{font-size:11px;opacity:.5;font-weight:700;letter-spacing:.04em}
  .journal-card-title{font-size:16px;font-weight:700}
  .journal-text{font-size:13px;opacity:.75;line-height:1.55;margin:0;max-height:4.6em;overflow:hidden;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical}
  .journal-thumbs{display:flex;gap:8px;flex-wrap:wrap;margin-top:4px}
  .journal-thumb{width:72px;height:72px;object-fit:cover;border-radius:10px;background:#f0f0f0}
  .journal-empty{min-height:220px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;opacity:.6;gap:8px}
  .journal-form-thumbs{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}
  @media(max-width:640px){.journal-grid{grid-template-columns:1fr}}
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
      { mod: "inspiration", label: t("navInspiration"), sub: "Ideas" },
      { mod: "journal", label: t("navJournal"), sub: "Journal" }
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
    else if (mod === "journal") c.innerHTML = renderJournal();
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

  /* ============ 当前上下文（决定新建按钮含义） ============ */
  function getContext() {
    // 模块优先
    if (currentMod) return currentMod;
    // 原视图
    const active = document.querySelector('.nav-item[data-view].active');
    if (active) return active.dataset.view;
    // body class 兜底
    if (document.body.classList.contains("plan-mode")) return "plan";
    if (document.body.classList.contains("tracks-mode")) return "tracks";
    if (document.body.classList.contains("track-mode")) return "track";
    return "today";
  }
  function fabLabelFor(ctx) {
    const map = I18N[LANG].newFor;
    return map[ctx] || map["today"];
  }
  function openCreateForContext(ctx) {
    if (ctx === "plan") return openBlockForm();
    if (ctx === "tracks") return openTrackForm();
    if (ctx === "track") return openTaskFormForTrack();
    if (ctx === "english") return openSentenceForm();
    if (ctx === "social") return openSocialPostForm();
    if (ctx === "inspiration") return openInspirationForm();
    if (ctx === "journal") return (window.__oosJournalTab === "review") ? openReviewForm() : openJournalForm();
    if (ctx === "finance" && typeof window.openFinModal === "function") return window.openFinModal("expenses");
    if (ctx === "notes" && typeof window.openNoteEditor === "function") return window.openNoteEditor("note-new");
    return openTaskForm();
  }

  /* ============ 新建 FAB（上下文感知） ============ */
  let newFabEl = null;
  function injectNewFab() {
    if (document.getElementById("newFab")) return;
    const b = document.createElement("button");
    b.id = "newFab"; b.innerHTML = `<span class="nf-icon">＋</span><span class="nf-label">${fabLabelFor(getContext())}</span>`;
    b.addEventListener("click", () => openCreateForContext(getContext()));
    document.body.appendChild(b); newFabEl = b;
    // 监听视图变化以更新文案
    observeContext(updateFab);
  }
  function updateFab() {
    if (!newFabEl) return;
    const ctx = getContext();
    const label = fabLabelFor(ctx);
    const txt = newFabEl.querySelector(".nf-label");
    if (txt && txt.textContent !== label) txt.textContent = label;
    // 复制当前 handler：移除旧 listener 比较麻烦，直接替换按钮
    const clone = newFabEl.cloneNode(true);
    clone.addEventListener("click", () => openCreateForContext(getContext()));
    newFabEl.parentNode.replaceChild(clone, newFabEl);
    newFabEl = clone;
    // Plan/Track 页面 FAB 与页面内已有大按钮共存；财务/备忘录自身有新建入口，隐藏避免重叠
    const hideOn = ["finance", "notes"];
    newFabEl.classList.toggle("fab-hidden", hideOn.includes(ctx));
  }
  function observeContext(cb) {
    const vc = document.getElementById("viewContent");
    if (!vc) return;
    new MutationObserver(cb).observe(vc, { childList: true });
    // 原导航点击也会切换视图
    document.querySelectorAll('.nav-item[data-view], [data-module]').forEach(b => b.addEventListener("click", () => setTimeout(cb, 50)));
  }

  function tracksList() {
    try {
      const s = window.__OOS_STATE && window.__OOS_STATE();
      if (s && s.tracks) return s.tracks.map(x => x.name);
    } catch (e) {}
    return ["自媒体起飞", "数字游民攒钱", "生活上安排事情"];
  }
  function trackNameOpts(selected) {
    return tracksList().map(n => `<option value="${esc(n)}" ${n === selected ? "selected" : ""}>${esc(n)}</option>`).join("");
  }

  /* ---------- 各视图新建表单 ---------- */
  function openTaskForm(goal) {
    const trackOpts = trackNameOpts(goal);
    openModal(`<h3>${t("newFor").today}</h3>
      <div class="oos-field"><label>${t("fTitle")}</label><input id="nfTitle" placeholder="例如：剪完第一条口播视频"></div>
      <div class="oos-field"><label>${t("fTrack")}</label><select id="nfTrack">${trackOpts}</select></div>
      <div class="oos-field"><label>${t("fDate")}</label><input id="nfDate" type="date" value="${todayIso()}"></div>
      <div class="oos-field"><label>${t("fNext")}</label><textarea id="nfNext" placeholder="最小下一步"></textarea></div>
      <div class="oos-field"><label>${t("fPriority")}</label><select id="nfPri"><option value="normal">${t("priNormal")}</option><option value="high">${t("priHigh")}</option></select></div>
      <div class="oos-modal-actions"><button class="oos-btn-ghost" data-close>${t("cancel")}</button><button class="oos-btn-primary" id="nfSubmit">${t("submit")}</button></div>`,
      () => {
        document.getElementById("nfSubmit").addEventListener("click", () => {
          const title = document.getElementById("nfTitle").value.trim();
          if (!title) { toastMsg(t("pleaseTitle")); return; }
          createTask({
            title, goal: document.getElementById("nfTrack").value,
            nextStep: document.getElementById("nfNext").value.trim(),
            due: document.getElementById("nfDate").value || todayIso(),
            priority: document.getElementById("nfPri").value
          });
          closeModal(); toastMsg(t("taskAdded"));
        });
      });
  }
  function openTaskFormForTrack() {
    // 在单个轨道详情页：自动选当前轨道
    let selectedGoal = "";
    try {
      const s = window.__OOS_STATE && window.__OOS_STATE();
      const activeTrack = document.querySelector('.nav-track.active');
      const trackId = activeTrack ? activeTrack.dataset.track : "";
      if (s && s.tracks && trackId) {
        const tr = s.tracks.find(x => x.id === trackId);
        if (tr) selectedGoal = tr.name;
      }
    } catch (e) {}
    openTaskForm(selectedGoal);
  }
  function openTrackForm() {
    const palette = window.TRACK_PALETTE || ["#E5484D","#F76808","#FFB224","#46A758","#12A594","#0091FF","#6564DB","#8E4EC6","#E93D82","#6E7681","#A16207","#0CA5E9"];
    let existing = [];
    try { const s = window.__OOS_STATE && window.__OOS_STATE(); existing = (s && s.tracks) || []; } catch (e) {}
    const defIdx = existing.length % palette.length;
    openModal(`<h3>${t("newFor").tracks}</h3>
      <div class="oos-field"><label>${t("fTrackName")}</label><input id="nfTrackName" placeholder="例如：每天英语口语打卡"></div>
      <div class="oos-field"><label>颜色（点一个选，之后可改）</label><div class="oos-color-row" id="nfColorRow">${palette.map(function (c, i) { return `<button type="button" class="oos-swatch ${i === defIdx ? "active" : ""}" data-color="${c}" style="background:${c}" aria-label="${c}"></button>`; }).join("")}</div></div>
      <div class="oos-field"><label>${t("fNext")}</label><textarea id="nfTrackNext" placeholder="这条主线要达成的目标 / 为什么重要"></textarea></div>
      <div class="oos-modal-actions"><button class="oos-btn-ghost" data-close>${t("cancel")}</button><button class="oos-btn-primary" id="nfSubmit">${t("submit")}</button></div>`,
      () => {
        let color = palette[defIdx];
        document.querySelectorAll("#nfColorRow .oos-swatch").forEach(function (b) {
          b.addEventListener("click", function () {
            color = b.dataset.color;
            document.querySelectorAll("#nfColorRow .oos-swatch").forEach(function (x) { x.classList.remove("active"); });
            b.classList.add("active");
          });
        });
        document.getElementById("nfSubmit").addEventListener("click", () => {
          const name = document.getElementById("nfTrackName").value.trim();
          if (!name) { toastMsg(t("pleaseTitle")); return; }
          createTrack({ name, nextAction: document.getElementById("nfTrackNext").value.trim(), color: color });
          closeModal(); toastMsg(t("trackAdded"));
        });
      });
  }
  function openBlockForm() {
    const kindOpts = ["focus", "fixed", "routine", "buffer", "errand", "admin", "recovery"]
      .map(k => `<option value="${k}">${t("kind" + k.charAt(0).toUpperCase() + k.slice(1))}</option>`).join("");
    const start = new Date();
    start.setMinutes(Math.ceil(start.getMinutes() / 15) * 15, 0, 0);
    const end = new Date(start.getTime() + 30 * 60000);
    const toIsoLocal = d => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    openModal(`<h3>${t("newFor").plan}</h3>
      <div class="oos-field"><label>${t("fTitle")}</label><input id="nbTitle" placeholder="例如：剪视频 / 学英语 / 拍摄"></div>
      <div class="oos-field"><label>${t("fBlockKind")}</label><select id="nbKind">${kindOpts}</select></div>
      <div class="oos-field"><label>${t("fBlockStart")}</label><input id="nbStart" type="datetime-local" value="${toIsoLocal(start)}"></div>
      <div class="oos-field"><label>${t("fBlockEnd")}</label><input id="nbEnd" type="datetime-local" value="${toIsoLocal(end)}"></div>
      <div class="oos-field"><label>${t("fTrack")}</label><select id="nbTrack"><option value="">${LANG === "zh" ? "不归轨道" : "No track"}</option>${trackNameOpts()}</select></div>
      <div class="oos-field"><label>${t("fBlockNote")}</label><textarea id="nbNote" placeholder="备注 / 地点 / 准备事项"></textarea></div>
      <div class="oos-modal-actions"><button class="oos-btn-ghost" data-close>${t("cancel")}</button><button class="oos-btn-primary" id="nbSubmit">${t("submit")}</button></div>`,
      () => {
        document.getElementById("nbSubmit").addEventListener("click", () => {
          const title = document.getElementById("nbTitle").value.trim();
          if (!title) { toastMsg(t("pleaseTitle")); return; }
          const startAt = document.getElementById("nbStart").value;
          const endAt = document.getElementById("nbEnd").value;
          if (!startAt || !endAt) { toastMsg("请选择起止时间"); return; }
          createBlock({
            title, kind: document.getElementById("nbKind").value,
            startAt, endAt,
            goal: document.getElementById("nbTrack").value || undefined,
            note: document.getElementById("nbNote").value.trim()
          });
          closeModal(); toastMsg(t("blockAdded"));
        });
      });
  }
  function openSentenceForm() {
    const lessonOpts = ENGLISH_LESSONS.map((l, i) => `<option value="${i}">${esc(LANG === "zh" ? l.zh : l.title)}</option>`).join("");
    openModal(`<h3>${t("newFor").english}</h3>
      <div class="oos-field"><label>${t("fLesson")}</label><select id="nsLesson">${lessonOpts}</select></div>
      <div class="oos-field"><label>${t("fEnglish")}</label><input id="nsEn" placeholder="例如：I built this app in one week."></div>
      <div class="oos-field"><label>${t("fChinese")}</label><input id="nsZh" placeholder="例如：我一周就搭好了这个应用。"></div>
      <div class="oos-modal-actions"><button class="oos-btn-ghost" data-close>${t("cancel")}</button><button class="oos-btn-primary" id="nsSubmit">${t("submit")}</button></div>`,
      () => {
        document.getElementById("nsSubmit").addEventListener("click", () => {
          const en = document.getElementById("nsEn").value.trim();
          if (!en) { toastMsg(t("pleaseTitle")); return; }
          const li = +document.getElementById("nsLesson").value;
          if (ENGLISH_LESSONS[li]) {
            ENGLISH_LESSONS[li].sentences.push({ en, zh: document.getElementById("nsZh").value.trim() });
            saveCustomSentences();
          }
          closeModal(); toastMsg(t("sentenceAdded")); switchModule("english");
        });
      });
  }
  function openSocialPostForm() {
    const platformOpts = SOCIAL_PLATFORMS.map(p => `<option value="${p.key}">${esc(p.name)}</option>`).join("");
    openModal(`<h3>${t("newFor").social}</h3>
      <div class="oos-field"><label>${LANG === "zh" ? "平台" : "Platform"}</label><select id="nspPlatform">${platformOpts}</select></div>
      <div class="oos-field"><label>${t("postTitle")}</label><input id="nspTitle"></div>
      <div class="oos-field"><label>${t("postLink")}</label><input id="nspLink" placeholder="https://..."></div>
      <div class="oos-field"><label>${t("postTime")}</label><input id="nspTime" type="datetime-local" value="${new Date().toISOString().slice(0, 16)}"></div>
      <div class="oos-field"><label>${t("postDesc")}</label><textarea id="nspDesc"></textarea></div>
      <div class="oos-modal-actions"><button class="oos-btn-ghost" data-close>${t("cancel")}</button><button class="oos-btn-primary" id="nspSubmit">${t("submit")}</button></div>`,
      () => {
        document.getElementById("nspSubmit").addEventListener("click", () => {
          const title = document.getElementById("nspTitle").value.trim();
          if (!title) { toastMsg(t("pleaseTitle")); return; }
          const key = document.getElementById("nspPlatform").value;
          const d = getSocial(); if (!d[key]) d[key] = { username: "", homepage: "", posts: [] };
          d[key].posts.unshift({
            id: "p" + Date.now(), title,
            link: document.getElementById("nspLink").value.trim(),
            time: document.getElementById("nspTime").value,
            description: document.getElementById("nspDesc").value.trim()
          });
          saveSocial(d); closeModal(); toastMsg(t("saved")); switchModule("social");
        });
      });
  }
  function openInspirationForm() {
    const platformOpts = [{k:"douyin",n:"抖音"},{k:"bilibili",n:"B站"},{k:"xiaohongshu",n:"小红书"},{k:"shipin",n:"视频号"}]
      .map(p => `<option value="${p.k}">${esc(p.n)}</option>`).join("");
    openModal(`<h3>${t("newFor").inspiration}</h3>
      <div class="oos-field"><label>${t("fInspTitle")}</label><input id="niTitle" placeholder="例如：无锡最值得拍的 10 家小酒馆"></div>
      <div class="oos-field"><label>${t("fInspCategory")}</label><input id="niCategory" placeholder="例如：生活 / 探店 / 摄影"></div>
      <div class="oos-field"><label>${t("fInspPlatform")}</label><select id="niPlatform">${platformOpts}</select></div>
      <div class="oos-field"><label>${t("fInspRecreate")}</label><textarea id="niRecreate" placeholder="可以怎么拍 / 差异化角度"></textarea></div>
      <div class="oos-modal-actions"><button class="oos-btn-ghost" data-close>${t("cancel")}</button><button class="oos-btn-primary" id="niSubmit">${t("submit")}</button></div>`,
      () => {
        document.getElementById("niSubmit").addEventListener("click", () => {
          const title = document.getElementById("niTitle").value.trim();
          if (!title) { toastMsg(t("pleaseTitle")); return; }
          const item = {
            id: "insp-u" + Date.now(), t: title,
            c: document.getElementById("niCategory").value.trim() || "灵感",
            p: document.getElementById("niPlatform").value,
            r: document.getElementById("niRecreate").value.trim(),
            h: 0, pk: 0, g: 0
          };
          const insp = getInsp(); if (!insp.custom) insp.custom = []; insp.custom.unshift(item); saveInsp(insp);
          closeModal(); toastMsg(t("inspAdded")); switchModule("inspiration");
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
    const palette = window.TRACK_PALETTE || ["#E5484D","#F76808","#FFB224","#46A758","#12A594","#0091FF","#6564DB","#8E4EC6","#E93D82","#6E7681","#A16207","#0CA5E9"];
    let existing = [];
    try { const s = window.__OOS_STATE && window.__OOS_STATE(); existing = (s && s.tracks) || []; } catch (e) {}
    const color = obj.color || palette[existing.length % palette.length];
    const track = {
      id, name: obj.name, navLabel: obj.name, summary: obj.nextAction || "", detail: "", color,
      archetype: "project", role: "operational", cadenceDays: 7, monitoring: { enabled: true },
      progress: 0, trackType: "project", stage: "新建", nextAction: obj.nextAction || "",
      nextActionDue: "", risk: "low", needsQuestion: "", metric: "", target: "", deadline: "",
      lastUpdated: now, views: [], checkpoints: [], visionImage: ""
    };
    if (window.stateOps) window.stateOps([{ type: "track.create", track }], t("trackAdded"));
    else console.warn("stateOps unavailable");
  }
  // 轨道编辑器：改名 + 改色（自定义命名 / 自定义颜色都在这里）
  function openTrackEditor(id) {
    let tr = null;
    try { const s = window.__OOS_STATE && window.__OOS_STATE(); tr = (s && s.tracks && s.tracks.find(function (x) { return x.id === id; })) || null; } catch (e) {}
    if (!tr) { toastMsg("找不到该轨道"); return; }
    const palette = window.TRACK_PALETTE || ["#E5484D","#F76808","#FFB224","#46A758","#12A594","#0091FF","#6564DB","#8E4EC6","#E93D82","#6E7681","#A16207","#0CA5E9"];
    const targetVal = tr.target !== undefined && tr.target !== "" ? tr.target : "";
    const hasVision = Boolean(tr.visionImage);
    openModal(`<h3>${t("editTrack")}</h3>
      <div class="oos-field"><label>${t("fTrackName")}</label><input id="etName" value="${esc(tr.name)}"></div>
      <div class="oos-field"><label>颜色（点一个选）</label><div class="oos-color-row" id="etColorRow">${palette.map(function (c) { return `<button type="button" class="oos-swatch ${c === tr.color ? "active" : ""}" data-color="${c}" style="background:${c}" aria-label="${c}"></button>`; }).join("")}</div></div>
      <div class="oos-field">
        <label>${t("fVisionImage")}</label>
        <p class="oos-field-hint">${t("fVisionImageHint")}</p>
        <div class="oos-vision-box" id="etVisionBox">
          ${hasVision ? `<img id="etVisionPreview" src="${esc(tr.visionImage)}" alt="${esc(t("fVisionImage"))}">` : ""}
          <div class="oos-vision-actions">
            <label class="oos-btn-secondary oos-file-label"><input type="file" id="etImageFile" accept="image/*" hidden>${hasVision ? t("changeImage") : t("addImage")}</label>
            ${hasVision ? `<button type="button" class="oos-btn-ghost" id="etRemoveImage">${t("removeImage")}</button>` : ""}
          </div>
        </div>
      </div>
      <div class="oos-edit-grid">
        <div class="oos-field"><label>${t("fStage")}</label><input id="etStage" placeholder="例如：记录基线" value="${esc(tr.stage || "")}"></div>
        <div class="oos-field"><label>${t("fMetric")}</label><input id="etMetric" placeholder="例如：月可投资结余" value="${esc(tr.metric || "")}"></div>
        <div class="oos-field"><label>${t("fTarget")}</label><input id="etTarget" type="number" step="any" placeholder="8000" value="${esc(typeof targetVal === "number" ? targetVal : (targetVal ? String(targetVal).replace(/[^0-9.\-]/g, "") : ""))}"></div>
        <div class="oos-field"><label>${t("fUnit")}</label><input id="etUnit" placeholder="元 / km / 篇" value="${esc(tr.unit || tr.metricUnit || "")}"></div>
      </div>
      <div class="oos-field"><label>${t("fSummary")}</label><textarea id="etSummary" placeholder="一句话讲清楚这条主线要达成什么">${esc(tr.summary || "")}</textarea></div>
      <div class="oos-field"><label>${t("fNext")}</label><textarea id="etNext" placeholder="最小下一步是什么 / 为什么重要">${esc(tr.nextAction || "")}</textarea></div>
      <div class="oos-modal-actions"><button class="oos-btn-ghost" data-close>${t("cancel")}</button><button class="oos-btn-primary" id="etSubmit">${t("submit")}</button></div>`,
      function () {
        let color = tr.color || palette[0];
        let visionImage = tr.visionImage || "";
        function renderVisionActions() {
          const box = document.getElementById("etVisionBox");
          if (!box) return;
          const has = Boolean(visionImage);
          box.innerHTML = (has ? `<img id="etVisionPreview" src="${esc(visionImage)}" alt="${esc(t("fVisionImage"))}">` : "") +
            `<div class="oos-vision-actions">` +
            `<label class="oos-btn-secondary oos-file-label"><input type="file" id="etImageFile" accept="image/*" hidden>${has ? t("changeImage") : t("addImage")}</label>` +
            (has ? `<button type="button" class="oos-btn-ghost" id="etRemoveImage">${t("removeImage")}</button>` : "") +
            `</div>`;
          bindVisionHandlers();
        }
        function bindVisionHandlers() {
          const fileInput = document.getElementById("etImageFile");
          if (fileInput) {
            fileInput.addEventListener("change", async function (e) {
              const file = e.target.files[0];
              if (!file) return;
              const dataUrl = await compressImage(file, 1200, 0.82);
              const bytes = Math.ceil(dataUrl.length * 0.75);
              if (bytes > 300000) { toastMsg(t("imageTooLarge")); return; }
              visionImage = dataUrl;
              renderVisionActions();
            });
          }
          const removeBtn = document.getElementById("etRemoveImage");
          if (removeBtn) removeBtn.addEventListener("click", function () { visionImage = ""; renderVisionActions(); });
        }
        document.querySelectorAll("#etColorRow .oos-swatch").forEach(function (b) {
          b.addEventListener("click", function () {
            color = b.dataset.color;
            document.querySelectorAll("#etColorRow .oos-swatch").forEach(function (x) { x.classList.remove("active"); });
            b.classList.add("active");
          });
        });
        bindVisionHandlers();
        document.getElementById("etSubmit").addEventListener("click", function () {
          const name = document.getElementById("etName").value.trim();
          if (!name) { toastMsg(t("pleaseTitle")); return; }
          const rawTarget = document.getElementById("etTarget").value.trim();
          const patch = {
            name: name,
            color: color,
            stage: document.getElementById("etStage").value.trim(),
            metric: document.getElementById("etMetric").value.trim(),
            target: rawTarget === "" ? "" : Number(rawTarget),
            unit: document.getElementById("etUnit").value.trim(),
            metricUnit: document.getElementById("etUnit").value.trim(),
            summary: document.getElementById("etSummary").value.trim(),
            nextAction: document.getElementById("etNext").value.trim(),
            navLabel: name,
            lastUpdated: todayIso(),
            visionImage: visionImage
          };
          if (window.stateOps) window.stateOps([{ type: "track.update", targetId: id, patch: patch }], t("trackUpdated"));
          closeModal();
        });
      });
  }
  window.openTrackEditor = openTrackEditor;
  function createBlock(obj) {
    const id = "block-u" + Date.now();
    const block = {
      id, title: obj.title, kind: obj.kind || "focus",
      startAt: obj.startAt, endAt: obj.endAt,
      goal: obj.goal || "", note: obj.note || "",
      status: "active", locked: false
    };
    if (window.stateOps) window.stateOps([{ type: "schedule.create", block }], t("blockAdded"));
    else console.warn("stateOps unavailable");
  }
  // 自定义例句（仅内存 + localStorage 镜像，云端同步通过 oos-eng / oos-social / oos-insp 桶）
  function saveCustomSentences() {
    try {
      const custom = ENGLISH_LESSONS.map((l, i) => l.sentences.slice(5).map((s, idx) => ({ ...s, lesson: i, idx: idx + 5 }))).flat();
      localStorage.setItem("oos-eng-custom", JSON.stringify(custom));
    } catch (e) {}
  }
  function loadCustomSentences() {
    try {
      const raw = localStorage.getItem("oos-eng-custom");
      if (!raw) return;
      const custom = JSON.parse(raw);
      custom.forEach(c => {
        const l = ENGLISH_LESSONS[c.lesson];
        if (l && l.sentences[c.idx] && l.sentences[c.idx].en === c.en) return;
        if (l) l.sentences.push({ en: c.en, zh: c.zh });
      });
    } catch (e) {}
  }
  loadCustomSentences();

  /* ============ 手帐 / Journal 模块 ============ */
  /* ============ 手帐 / Journal 模块（V2+V4 混搭 + 新手指南） ============ */
  function escAttr(s){ return (s==null?"":String(s)).replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }
  function ymd(d){ const z=n=>String(n).padStart(2,"0"); return d.getFullYear()+"-"+z(d.getMonth()+1)+"-"+z(d.getDate()); }
  function getReviews(){ return getJournal().filter(e=>e.type==="review"); }
  function computeStreak(){
    const set = new Set(getReviews().map(r=>r.date).filter(Boolean));
    if(!set.size) return 0;
    let d = new Date();
    if(!set.has(ymd(d))) d.setDate(d.getDate()-1);
    let s=0;
    while(set.has(ymd(d))){ s++; d.setDate(d.getDate()-1); }
    return s;
  }
  function todayDoneText(){
    try{
      const st = window.__OOS_STATE && window.__OOS_STATE();
      if(!st||!st.tasks) return "";
      const t = todayIso();
      return st.tasks.filter(x=>x.status==="done"&&((x.due||"").slice(0,10)===t)).map(x=>"• "+x.title).join("\n");
    }catch(e){ return ""; }
  }
  function guideHTML(){
    return `<div class="oos-guide">
      <button class="guide-toggle" id="guideToggle" type="button">${t("guideTitle")} <span class="gt-arrow">▾</span></button>
      <div class="guide-body" id="guideBody">
        <div class="guide-sec"><b>${t("guideWhat")}</b><p>${t("guideWhatTxt")}</p></div>
        <div class="guide-sec"><b>${t("guideTpl")}</b><p>${t("guideTplTxt")}</p></div>
        <div class="guide-sec"><b>${t("guideBujo")}</b><p>${t("guideBujoTxt")}</p></div>
        <div class="guide-sec"><b>${t("guideStreak")}</b><p>${t("guideStreakTxt")}</p></div>
        <div class="guide-sec"><b>${t("guideTip")}</b><p>${t("guideTipTxt")}</p></div>
      </div>
    </div>`;
  }
  function journalGrid(){
    const entries = getJournal().filter(e=>e.type!=="review").sort((a,b)=>(b.date||"").localeCompare(a.date||""));
    if(!entries.length) return `<div class="journal-empty"><strong>${t("journalEmpty")}</strong><p>${t("journalPrompt")}</p></div>`;
    const cards = entries.map(e=>{
      const thumbs=(e.images||[]).slice(0,4).map(src=>`<img src="${esc(src)}" class="journal-thumb" loading="lazy">`).join("");
      return `<div class="journal-card" data-journal-id="${esc(e.id)}">
        <div class="journal-date">${esc(e.date||"")}</div>
        <div class="journal-card-title">${esc(e.title||"")}</div>
        <p class="journal-text">${esc(e.text||"").replace(/\n/g,"<br>")}</p>
        <div class="journal-thumbs">${thumbs}</div>
      </div>`;
    }).join("");
    return `<div class="journal-grid">${cards}</div>`;
  }
  function reviewSection(){
    const today=todayIso();
    const ex=getReviews().find(r=>r.date===today);
    const past=getReviews().filter(r=>r.date!==today);
    const moods=["😞","🙁","😐","🙂","😄"];
    let body;
    if(ex){
      body=`<div class="review-card">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <b>${t("reviewDone")}</b>
          <button class="review-start" style="padding:6px 12px;font-size:12px" id="rvEdit" type="button">${t("reviewEdit")}</button>
        </div>
        <div class="review-row"><label>${t("reviewMood")}</label><div class="val">${moods[ex.mood]||""} ${esc(ex.keyword||"")}</div></div>
        <div class="review-row"><label>${t("reviewDoneList")}</label><div class="val">${esc(ex.done||"").replace(/\n/g,"<br>")}</div></div>
        <div class="review-row"><label>${t("reviewHighlight")}</label><div class="val">${esc(ex.highlight||"")}</div></div>
        <div class="review-row"><label>${t("reviewImprove")}</label><div class="val">${esc(ex.improve||"")}</div></div>
        <div class="review-row"><label>${t("reviewTomorrow")}</label><div class="val">${esc(ex.tomorrow||"")}</div></div>
        ${ex.rapid?`<div class="review-row"><label>${t("reviewRapid")}</label><div class="val">${esc(ex.rapid).replace(/\n/g,"<br>")}</div></div>`:""}
      </div>`;
    } else {
      body=`<div class="review-card"><p style="font-size:13px;color:#6b7280;margin:0 0 10px">${t("reviewEmpty")}</p><button class="review-start" id="rvStart" type="button">${t("reviewStart")}</button></div>`;
    }
    const list = past.length?`<div class="review-list">${past.slice(0,10).map(r=>`<div class="review-item"><b>${esc(r.date)}</b>　${esc(r.highlight||r.keyword||"")}</div>`).join("")}</div>`:"";
    return body+list;
  }
  function renderJournal(){
    return `<div class="mod-wrap">
      ${guideHTML()}
      <div class="journal-tabs">
        <button class="jt active" data-jt="journal" type="button">${t("journalTab1")}</button>
        <button class="jt" data-jt="review" type="button">${t("journalTab2")}</button>
        <span class="streak-badge">${t("streakLabel")} <b>${computeStreak()}</b> ${t("days")}</span>
      </div>
      <div id="journalPane">${journalGrid()}</div>
      <div id="reviewPane" style="display:none">${reviewSection()}</div>
    </div>`;
  }
  function bindJournal(){
    const wrap=document.getElementById("viewContent");
    if(!wrap) return;
    const jt=wrap.querySelectorAll(".journal-tabs .jt");
    jt.forEach(b=>b.addEventListener("click",()=>{
      jt.forEach(x=>x.classList.remove("active"));
      b.classList.add("active");
      const isR=b.dataset.jt==="review";
      window.__oosJournalTab=isR?"review":"journal";
      document.getElementById("journalPane").style.display=isR?"none":"block";
      document.getElementById("reviewPane").style.display=isR?"block":"none";
    }));
    const gt=document.getElementById("guideToggle");
    if(gt) gt.addEventListener("click",()=>{
      const g=document.getElementById("guideBody");
      const hidden=g.style.display==="none";
      g.style.display=hidden?"block":"none";
      gt.querySelector(".gt-arrow").textContent=hidden?"▾":"▸";
    });
    const rs=document.getElementById("rvStart"); if(rs) rs.addEventListener("click",openReviewForm);
    const re=document.getElementById("rvEdit"); if(re) re.addEventListener("click",openReviewForm);
  }
  function openJournalForm() {
    let pendingImages = [];
    openModal(`<h3>${t("newFor").journal}</h3>
      <div class="oos-field"><label>${t("fJournalTitle")}</label><input id="njTitle" placeholder="例如：今天拍的菜品参考 / 酒吧氛围"></div>
      <div class="oos-field"><label>${t("fDate")}</label><input id="njDate" type="date" value="${todayIso()}"></div>
      <div class="oos-field"><label>${t("fJournalText")}</label><textarea id="njText" rows="4" placeholder="记录当时的情境、想法、后续怎么用"></textarea></div>
      <div class="oos-field"><label>${t("fJournalImages")}</label><input id="njImages" type="file" accept="image/*" multiple></div>
      <div id="njPreview" class="journal-form-thumbs"></div>
      <div class="oos-modal-actions"><button class="oos-btn-ghost" data-close>${t("cancel")}</button><button class="oos-btn-primary" id="njSubmit">${t("submit")}</button></div>`,
      () => {
        const preview = document.getElementById("njPreview");
        document.getElementById("njImages").addEventListener("change", function () {
          const files = Array.from(this.files);
          files.forEach(file => compressImage(file, 1200, 0.7).then(b64 => {
            pendingImages.push(b64);
            const img = document.createElement("img"); img.src = b64; img.className = "journal-thumb"; preview.appendChild(img);
          }));
        });
        document.getElementById("njSubmit").addEventListener("click", () => {
          const title = document.getElementById("njTitle").value.trim();
          if (!title && !pendingImages.length) { toastMsg(t("pleaseTitle")); return; }
          const entry = {
            id: "journal-u" + Date.now(), type: "journal",
            date: document.getElementById("njDate").value || todayIso(),
            title, text: document.getElementById("njText").value.trim(),
            images: pendingImages, createdAt: new Date().toISOString()
          };
          const list = getJournal(); list.unshift(entry); saveJournal(list);
          closeModal(); toastMsg(t("journalAdded")); switchModule("journal");
        });
      });
  }
  function openReviewForm(){
    const today=todayIso();
    const existing=getReviews().find(r=>r.date===today);
    const prefill=todayDoneText();
    const moods=["😞","🙁","😐","🙂","😄"];
    openModal(`<h3>${t("reviewTitle")}</h3>
      <div class="oos-field"><label>${t("reviewMood")}</label><div class="mood-row" id="rvMood">
        ${moods.map((m,i)=>`<button type="button" class="mood-btn${existing&&existing.mood===i?" sel":""}" data-m="${i}">${m}</button>`).join("")}
      </div></div>
      <div class="oos-field"><label>${t("reviewKeyword")}</label><input id="rvKw" value="${escAttr(existing?existing.keyword:"")}" placeholder="一个词定调，例如：专注"></div>
      <div class="oos-field"><label>${t("reviewDoneList")}</label><textarea id="rvDone" rows="3" placeholder="自动带入今天完成的任务">${esc(existing?existing.done:prefill)}</textarea></div>
      <div class="oos-field"><label>${t("reviewHighlight")}</label><input id="rvHi" value="${escAttr(existing?existing.highlight:"")}" placeholder="小事也行"></div>
      <div class="oos-field"><label>${t("reviewImprove")}</label><input id="rvIm" value="${escAttr(existing?existing.improve:"")}" placeholder="只写事件"></div>
      <div class="oos-field"><label>${t("reviewTomorrow")}</label><input id="rvTm" value="${escAttr(existing?existing.tomorrow:"")}" placeholder="明天最关键 1 件"></div>
      <div class="oos-field"><label>${t("reviewRapid")}</label><textarea id="rvRapid" rows="3" placeholder="• 任务  ○ 事件  - 笔记">${esc(existing?existing.rapid:"")}</textarea></div>
      <div class="oos-modal-actions"><button class="oos-btn-ghost" data-close>${t("cancel")}</button><button class="oos-btn-primary" id="rvSubmit">${t("submit")}</button></div>`,
      () => {
        let mood=existing?existing.mood:-1;
        document.querySelectorAll("#rvMood .mood-btn").forEach(b=>b.addEventListener("click",()=>{
          document.querySelectorAll("#rvMood .mood-btn").forEach(x=>x.classList.remove("sel"));
          b.classList.add("sel"); mood=+b.dataset.m;
        }));
        document.getElementById("rvSubmit").addEventListener("click",()=>{
          const get=id=>document.getElementById(id).value.trim();
          const entry={ id:existing?existing.id:("review-u"+Date.now()), type:"review", date:today, mood,
            keyword:get("rvKw"), done:get("rvDone"), highlight:get("rvHi"), improve:get("rvIm"), tomorrow:get("rvTm"), rapid:get("rvRapid"), createdAt:new Date().toISOString() };
          const list=getJournal();
          if(existing){ const i=list.findIndex(x=>x.id===existing.id); list[i]=entry; } else list.unshift(entry);
          saveJournal(list); closeModal(); toastMsg(t("reviewSaved")); switchModule("journal");
        });
      });
  }
  function compressImage(file, maxWidth, quality) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = function (e) {
        const img = new Image();
        img.onload = function () {
          const canvas = document.createElement("canvas");
          const ratio = Math.min(1, maxWidth / img.width);
          canvas.width = img.width * ratio; canvas.height = img.height * ratio;
          const ctx = canvas.getContext("2d"); ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL("image/webp", quality));
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
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
      const head = target.querySelector(".tracks-head, .section-head, h2, .panel-head");
      // 仅在 tracks 视图且尚未注入时添加按钮
      if (document.querySelector('.nav-item[data-view="tracks"].active') && !document.getElementById("trackNewBtn")) {
        const anchor = target.querySelector(".two-col, .track-grid, .tracks-list, .panel") || target.firstElementChild;
        if (anchor && head && !head.querySelector("#trackNewBtn")) {
          const b = document.createElement("button");
          b.id = "trackNewBtn"; b.className = "track-new-btn"; b.textContent = "＋ " + (LANG === "zh" ? "新建轨道" : "New Track");
          b.addEventListener("click", () => openTrackForm());
          head.appendChild(b);
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
    window.OOSM = { openExternal, openTrackForm, openTaskForm };
    // 切换回原视图时同步模块导航高亮
    const origNav = document.querySelectorAll('.nav-item[data-view]');
    origNav.forEach(b => b.addEventListener("click", () => {
      currentMod = null;
      document.querySelectorAll('[data-module]').forEach(x => x.classList.remove("active"));
      setTimeout(updateFab, 50);
    }));
    // 侧边栏轨道区域 header + 新建按钮（桌面端）
    setTimeout(injectTrackSidebarHeader, 300);
  }

  function injectTrackSidebarHeader() {
    const navTracks = document.getElementById("navTracks");
    if (!navTracks || document.getElementById("navTracksHeader")) return;
    const hdr = document.createElement("div");
    hdr.id = "navTracksHeader";
    hdr.className = "nav-tracks-header";
    hdr.innerHTML = `<span>${LANG === "zh" ? "长期轨道" : "Life Tracks"}</span><button id="navTrackNew" title="${LANG === "zh" ? "新建轨道" : "New track"}">＋</button>`;
    navTracks.parentNode.insertBefore(hdr, navTracks);
    document.getElementById("navTrackNew").addEventListener("click", () => openTrackForm());
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  // 在视图渲染后绑定模块内交互
  function afterRenderBind() {
    if (currentMod === "english") bindEnglish();
    else if (currentMod === "social") bindSocial();
    else if (currentMod === "inspiration") bindInspiration();
    else if (currentMod === "journal") bindJournal();
    updateFab();
    injectTrackSidebarHeader();
  }
  // 监听 viewContent 变化以绑定
  const vc = document.getElementById("viewContent");
  if (vc) new MutationObserver(afterRenderBind).observe(vc, { childList: true });
})();
