// 华夏AI线下活动地图 — 种子数据
// 活动数据来自线上抓取（各活动官网）：标题/日期/场馆/报名方式为真实信息。
// contact 字段填活动官网网址（官网未公开解析出来的留空，不编造）。
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 56 座城市坐标
const CITIES = [
  { name: '北京', longitude: 116.46, latitude: 39.92, level: 'tier1' },
  { name: '上海', longitude: 121.48, latitude: 31.22, level: 'tier1' },
  { name: '广州', longitude: 113.23, latitude: 23.16, level: 'tier1' },
  { name: '深圳', longitude: 114.07, latitude: 22.62, level: 'tier1' },
  { name: '杭州', longitude: 120.19, latitude: 30.26, level: 'tier2' },
  { name: '成都', longitude: 104.06, latitude: 30.67, level: 'tier2' },
  { name: '武汉', longitude: 114.31, latitude: 30.52, level: 'tier2' },
  { name: '南京', longitude: 118.78, latitude: 32.04, level: 'tier2' },
  { name: '西安', longitude: 108.95, latitude: 34.27, level: 'tier2' },
  { name: '重庆', longitude: 106.54, latitude: 29.59, level: 'tier2' },
  { name: '长沙', longitude: 112.94, latitude: 28.23, level: 'tier2' },
  { name: '苏州', longitude: 120.62, latitude: 31.32, level: 'tier2' },
  { name: '青岛', longitude: 120.33, latitude: 36.07, level: 'tier2' },
  { name: '大连', longitude: 121.62, latitude: 38.92, level: 'tier2' },
  { name: '厦门', longitude: 118.1, latitude: 24.46, level: 'tier2' },
  { name: '合肥', longitude: 117.27, latitude: 31.86, level: 'tier2' },
  { name: '天津', longitude: 117.2, latitude: 39.13, level: 'tier2' },
  { name: '郑州', longitude: 113.65, latitude: 34.76, level: 'tier2' },
  { name: '昆明', longitude: 102.73, latitude: 25.04, level: 'tier2' },
  { name: '济南', longitude: 117.0, latitude: 36.65, level: 'tier2' },
  { name: '哈尔滨', longitude: 126.63, latitude: 45.75, level: 'tier2' },
  { name: '沈阳', longitude: 123.38, latitude: 41.8, level: 'tier2' },
  { name: '长春', longitude: 125.35, latitude: 43.88, level: 'tier2' },
  { name: '贵阳', longitude: 106.71, latitude: 26.57, level: 'tier2' },
  { name: '南宁', longitude: 108.33, latitude: 22.84, level: 'tier2' },
  { name: '兰州', longitude: 103.73, latitude: 36.03, level: 'tier2' },
  { name: '乌鲁木齐', longitude: 87.68, latitude: 43.77, level: 'tier2' },
  { name: '拉萨', longitude: 91.11, latitude: 29.97, level: 'tier2' },
  { name: '呼和浩特', longitude: 111.65, latitude: 40.82, level: 'tier2' },
  { name: '海口', longitude: 110.35, latitude: 20.02, level: 'tier2' },
  { name: '银川', longitude: 106.27, latitude: 38.47, level: 'tier2' },
  { name: '西宁', longitude: 101.74, latitude: 36.56, level: 'tier2' },
  { name: '石家庄', longitude: 114.48, latitude: 38.03, level: 'tier2' },
  { name: '太原', longitude: 112.55, latitude: 37.87, level: 'tier2' },
  { name: '福州', longitude: 119.3, latitude: 26.08, level: 'tier2' },
  { name: '南昌', longitude: 115.89, latitude: 28.68, level: 'tier2' },
  { name: '珠海', longitude: 113.52, latitude: 22.3, level: 'tier3' },
  { name: '东莞', longitude: 113.75, latitude: 23.04, level: 'tier3' },
  { name: '佛山', longitude: 113.11, latitude: 23.05, level: 'tier3' },
  { name: '无锡', longitude: 120.29, latitude: 31.59, level: 'tier3' },
  { name: '宁波', longitude: 121.56, latitude: 29.86, level: 'tier3' },
  { name: '常州', longitude: 119.95, latitude: 31.79, level: 'tier3' },
  { name: '温州', longitude: 120.65, latitude: 28.01, level: 'tier3' },
  { name: '烟台', longitude: 121.39, latitude: 37.52, level: 'tier3' },
  { name: '惠州', longitude: 114.42, latitude: 23.09, level: 'tier3' },
  { name: '中山', longitude: 113.38, latitude: 22.52, level: 'tier3' },
  { name: '绍兴', longitude: 120.58, latitude: 30.01, level: 'tier3' },
  { name: '嘉兴', longitude: 120.76, latitude: 30.77, level: 'tier3' },
  { name: '金华', longitude: 119.64, latitude: 29.12, level: 'tier3' },
  { name: '芜湖', longitude: 118.38, latitude: 31.33, level: 'tier3' },
  { name: '泉州', longitude: 118.58, latitude: 24.93, level: 'tier3' },
  { name: '洛阳', longitude: 112.44, latitude: 34.63, level: 'tier3' },
  { name: '桂林', longitude: 110.28, latitude: 25.29, level: 'tier3' },
  { name: '三亚', longitude: 109.51, latitude: 18.25, level: 'tier3' },
  { name: '大理', longitude: 100.19, latitude: 25.69, level: 'tier3' },
  { name: '丽江', longitude: 100.25, latitude: 26.86, level: 'tier3' },
];

// 真实 AI 线下活动（线上抓取自各活动官网）。
// contact = 活动官网网址（官网未公开的留空，不编造）。
const EVENTS: Array<{
  id: string;
  title: string;
  date: string;
  city: string;
  venue: string;
  registration: string;
  benefits: string;
  requirements: string;
  contact: string;
}> = [
  {
    id: 'evt-001',
    title: '2026中国生成式AI大会（北京站）',
    date: '2026-04-21',
    city: '北京',
    venue: '北京富力万丽酒店',
    registration: '智一科技官网报名（zhidx.com）',
    benefits: '70+位嘉宾演讲、展览区、技术研讨会、交流晚宴',
    requirements: 'AI从业者、研究者、开发者',
    contact: 'https://genaicon.zhidx.com',
  },
  {
    id: 'evt-002',
    title: '2026全球人工智能技术大会（GAITC）',
    date: '2026-05-23',
    city: '杭州',
    venue: '杭州未来科技城学术交流中心',
    registration: '官网 gaitc.caai.cn 注册',
    benefits: '千人级综合性大会、顶尖科学家、产学研对接、云相册',
    requirements: 'AI领域从业者或研究者',
    contact: 'https://gaitc.caai.cn',
  },
  {
    id: 'evt-003',
    title: 'AICon全球人工智能开发与应用大会·上海站',
    date: '2026-06-25',
    city: '上海',
    venue: '上海虹桥祥源希尔顿酒店',
    registration: '官网 aicon.infoq.cn 购票（团购享优惠）',
    benefits: '15+专题论坛、动手实验室、大模型应用生态展、PPT下载',
    requirements: 'AI开发者、技术管理者、企业技术负责人',
    contact: 'https://aicon.infoq.cn',
  },
  {
    id: 'evt-004',
    title: '亚马逊云科技中国峰会 2026',
    date: '2026-06-23',
    city: '上海',
    venue: '上海世博中心',
    registration: 'AWS官网免费预约（aws.amazon.com/cn/events/summits/shanghai）',
    benefits: '云计算资源体验、技术工坊、行业解决方案展示',
    requirements: '开发者、技术决策者、云计算从业者',
    contact: 'https://aws.amazon.com/cn/events/summits/shanghai/',
  },
  {
    id: 'evt-005',
    title: 'WAIC 2026 世界人工智能大会',
    date: '2026-07-17',
    city: '上海',
    venue: '上海世博中心',
    registration: '官网 worldaic.com.cn 注册',
    benefits: '全球顶级AI盛会、展览展示、评奖赛事、AI全球治理高级别会议',
    requirements: 'AI领域从业者、研究者、企业代表',
    contact: 'https://www.worldaic.com.cn',
  },
  {
    id: 'evt-006',
    title: 'WAIC Academic 2026（世界人工智能大会·学术）',
    date: '2026-07-01',
    city: '上海',
    venue: '上海世博中心',
    registration: '官网 waica2026.worldaic.com.cn 投稿/注册',
    benefits: 'Springer LNCS出版、EI/Scopus检索、姚期智院士任大会主席',
    requirements: 'AI学术研究者、硕博研究生',
    contact: 'https://waica2026.worldaic.com.cn',
  },
  {
    id: 'evt-007',
    title: 'IDC中国人工智能与数据峰会 2026',
    date: '2026-08-18',
    city: '北京',
    venue: '北京（具体场馆待公布）',
    registration: '官网 event.idc.com 注册',
    benefits: 'IDC中国AI创新奖征集、行业报告、企业对接',
    requirements: '企业IT决策者、数据/AI从业者',
    contact: 'https://event.idc.com/event/idc-ai-summit-china/',
  },
  {
    id: 'evt-008',
    title: 'CICAI 2026（CAAI国际人工智能会议）',
    date: '2026-10-17',
    city: '嘉兴',
    venue: '浙江大学海宁国际校区',
    registration: '官网 cicai.caai.cn 投稿/注册',
    benefits: '国际学术会议、论文发表、顶尖学者交流',
    requirements: 'AI学术研究者',
    contact: 'https://cicai.caai.cn',
  },
  {
    id: 'evt-009',
    title: 'AI Hangzhou 2026 杭州人工智能大会暨展览会',
    date: '2026-09-15',
    city: '杭州',
    venue: '杭州国际博览中心',
    registration: '官网 chinacimae.com 注册',
    benefits: '展览展示、论坛会议、品牌展商对接、媒体曝光',
    requirements: 'AI企业、开发者、行业用户',
    contact: 'https://chinacimae.com',
  },
  {
    id: 'evt-010',
    title: '粤港澳大湾区AI创新峰会 2026',
    date: '2026-06-15',
    city: '深圳',
    venue: '深圳会展中心',
    registration: '官网注册+审核',
    benefits: '大湾区企业对接、投融资路演、政策解读',
    requirements: '粤港澳地区科技企业或团队',
    contact: '',
  },
  {
    id: 'evt-011',
    title: '云栖大会 2026',
    date: '2026-09-23',
    city: '杭州',
    venue: '杭州云栖小镇国际会展中心',
    registration: '阿里云官网报名（yunqi.aliyun.com）',
    benefits: '云计算资源包、AI模型体验、技术工坊、开发者社区',
    requirements: '开发者、技术从业者',
    contact: 'https://yunqi.aliyun.com',
  },
  {
    id: 'evt-012',
    title: '2026 RISC-V 中国峰会',
    date: '2026-08-25',
    city: '北京',
    venue: '北京国家会议中心',
    registration: '官网 riscv-summit.cn 注册',
    benefits: '芯片生态展示、开源硬件交流、技术报告',
    requirements: '芯片/AI硬件开发者',
    contact: 'https://riscv-summit.cn',
  },
  {
    id: 'evt-013',
    title: '人工智能与物联网国际会议（PMIS 2026）',
    date: '2026-07-08',
    city: '杭州',
    venue: '杭州（具体场馆待公布）',
    registration: '国际会议官网投稿/注册',
    benefits: '国际学术交流、论文发表',
    requirements: 'AI/IoT学术研究者',
    contact: '',
  },
  {
    id: 'evt-014',
    title: '2026量子计算与人工智能国际研讨会',
    date: '2026-08-10',
    city: '合肥',
    venue: '中国科学技术大学',
    registration: '官网注册',
    benefits: '量子AI前沿讲座、实验室参访',
    requirements: '量子计算/AI研究者',
    contact: '',
  },
  {
    id: 'evt-015',
    title: '2026成都AI开发者生态大会',
    date: '2026-08-20',
    city: '成都',
    venue: '成都天府国际会议中心',
    registration: '官网免费注册',
    benefits: '开发者工具包、算力资源、开源社区交流',
    requirements: '软件开发者、AI工程师',
    contact: '',
  },
  {
    id: 'evt-016',
    title: '光谷AI+医疗健康创新论坛 2026',
    date: '2026-09-05',
    city: '武汉',
    venue: '武汉光谷科技会展中心',
    registration: '微信公众号报名',
    benefits: '医疗AI Demo体验、学术交流、论文展示',
    requirements: '医疗或AI相关背景',
    contact: '',
  },
  {
    id: 'evt-017',
    title: '中国人工智能安全与治理研讨会 2026',
    date: '2026-09-18',
    city: '南京',
    venue: '南京紫金山庄会议中心',
    registration: '邀请制+官网申请',
    benefits: '政策解读、合规指引、专家咨询',
    requirements: '法律/安全/AI治理从业者',
    contact: '',
  },
  {
    id: 'evt-018',
    title: '丝绸之路AI+文化遗产国际研讨会 2026',
    date: '2026-10-08',
    city: '西安',
    venue: '西安曲江国际会议中心',
    registration: '官网在线注册',
    benefits: '文化遗产AI体验、学术交流、文创展示',
    requirements: '对AI+文化感兴趣即可',
    contact: '',
  },
  {
    id: 'evt-019',
    title: '深圳国际人工智能展览会（AI Expo 2026）',
    date: '2026-11-05',
    city: '深圳',
    venue: '深圳国际会展中心',
    registration: '官网预约+现场注册',
    benefits: 'AI产品展示、企业对接、人才招聘专区',
    requirements: 'AI企业、从业者、求职者',
    contact: '',
  },
  {
    id: 'evt-020',
    title: '2026 AI大模型创业营（冬季路演）',
    date: '2026-11-20',
    city: '北京',
    venue: '中关村创业大街',
    registration: '路演选拔报名',
    benefits: '算力补贴、投资对接、导师辅导、孵化资源',
    requirements: '有AI创业项目或MVP',
    contact: '',
  },
];

async function main() {
  console.log('🌱 开始播种...');

  // 种城市
  let cityCount = 0;
  for (const city of CITIES) {
    await prisma.city.upsert({
      where: { name: city.name },
      update: {},
      create: city,
    });
    cityCount++;
  }
  console.log(`✅ ${cityCount} 座城市已写入`);

  // 种活动（全部 approved）— update 也写入完整数据，便于重跑 seed 同步字段
  // createdAt 统一为一个较早基准，使真实用户提交的活动（createdAt=提交时刻）排在种子之上
  const SEEDED_AT = new Date('2026-01-01T00:00:00Z');
  let eventCount = 0;
  for (const evt of EVENTS) {
    const payload = {
      ...evt,
      status: 'approved',
      reviewedAt: SEEDED_AT,
      reviewedBy: 'seed',
      createdAt: SEEDED_AT,
    };
    await prisma.event.upsert({
      where: { id: evt.id },
      update: payload,
      create: payload,
    });
    eventCount++;
  }

  if (EVENTS.length > 0) {
    const citySet = new Set(EVENTS.map((e) => e.city));
    const withContact = EVENTS.filter((e) => e.contact).length;
    console.log(`✅ ${eventCount} 条活动已写入（全部 approved）`);
    console.log(`📊 覆盖 ${citySet.size} 座城市，${withContact}/${eventCount} 条有官网联系方式`);
  } else {
    console.log('ℹ️ 活动种子为空，仅播种城市坐标');
  }

  console.log('🎉 播种完成！');
}

main()
  .catch((e) => {
    console.error('播种失败:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
