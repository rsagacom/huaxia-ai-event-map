// 华夏AI线下活动地图 — 种子数据
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 60 座城市坐标
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

// 20 条模拟活动
const EVENTS = [
  { id: 'evt-001', title: '2026全球人工智能技术大会', date: '2026-07-15', city: '北京', venue: '国家会议中心', registration: '官网在线注册', benefits: '参会证书、技术白皮书、AI周边礼包', requirements: 'AI相关领域从业者或研究者', contact: 'contact@gaitc2026.cn' },
  { id: 'evt-002', title: 'WAIC世界人工智能大会', date: '2026-07-28', city: '上海', venue: '世博展览馆', registration: '官网预约+审核', benefits: '行业报告、企业对接、创业路演名额', requirements: '需提交企业/机构证明', contact: 'info@waic2026.org' },
  { id: 'evt-003', title: '粤港澳大湾区AI创新峰会', date: '2026-08-05', city: '深圳', venue: '深圳湾科技生态园', registration: '微信小程序报名', benefits: '项目孵化资源、投资对接、技术沙龙', requirements: '粤港澳地区科技企业或团队', contact: 'ai-summit@gba-tech.cn' },
  { id: 'evt-004', title: 'AI+制造产业应用论坛', date: '2026-08-12', city: '广州', venue: '琶洲国际会展中心', registration: '官网在线注册', benefits: '工厂参访、供应链对接、行业白皮书', requirements: '制造业或AI从业者', contact: 'forum@ai-mfg.cn' },
  { id: 'evt-005', title: '云栖大会·AI原生专场', date: '2026-09-10', city: '杭州', venue: '云栖小镇国际会展中心', registration: '阿里云官网报名', benefits: '云计算资源包、AI模型体验账号、技术工坊', requirements: '开发者优先', contact: 'yq-ai@alibabacloud.com' },
  { id: 'evt-006', title: '西部AI开发者大会', date: '2026-08-20', city: '成都', venue: '天府国际会议中心', registration: '官网免费注册', benefits: '开发者工具包、算力资源、社区积分', requirements: '软件开发者或学生', contact: 'dev@west-ai.cn' },
  { id: 'evt-007', title: '光谷AI+医疗创新论坛', date: '2026-09-05', city: '武汉', venue: '光谷科技会展中心', registration: '微信公众号报名', benefits: '医疗AI Demo体验、学术交流、论文集', requirements: '医疗或AI相关背景', contact: 'med-ai@optovalley.cn' },
  { id: 'evt-008', title: '长三角AI安全与治理研讨会', date: '2026-09-18', city: '南京', venue: '紫金山庄会议中心', registration: '邀请制+官网申请', benefits: '政策解读、合规指引、专家咨询', requirements: '法律/安全/AI治理从业者', contact: 'governance@yangtze-ai.cn' },
  { id: 'evt-009', title: '丝绸之路AI文化交流展', date: '2026-10-08', city: '西安', venue: '曲江国际会议中心', registration: '官网在线注册', benefits: '文化遗产AI体验、文创礼包', requirements: '对AI+文化感兴趣即可', contact: 'silk-ai@qujiang.cn' },
  { id: 'evt-010', title: '智能制造AI应用展', date: '2026-10-15', city: '重庆', venue: '悦来国际会议中心', registration: '官网预约', benefits: '工厂实地考察、技术方案对接', requirements: '制造业从业者', contact: 'smart-mfg@cq-ai.cn' },
  { id: 'evt-011', title: 'AI大模型创业营', date: '2026-08-25', city: '北京', venue: '中关村创业大街', registration: '路演选拔', benefits: '算力补贴、投资对接、导师辅导', requirements: '有AI创业项目或MVP', contact: 'startup@zgc-ai.cn' },
  { id: 'evt-012', title: 'AI芯片与算力基础设施峰会', date: '2026-11-02', city: '上海', venue: '张江科学城会堂', registration: '官网注册+审核', benefits: '芯片样片申请、算力资源包', requirements: '半导体或算力从业者', contact: 'chip-ai@zhangjiang.cn' },
  { id: 'evt-013', title: '湖湘AI人才交流会', date: '2026-09-22', city: '长沙', venue: '梅溪湖国际文化艺术中心', registration: '免费入场', benefits: '面试直通、薪资洽谈、落户政策咨询', requirements: 'AI领域求职者', contact: 'talent@huxiang-ai.cn' },
  { id: 'evt-014', title: 'AI开源社区Meetup', date: '2026-07-20', city: '深圳', venue: '南山科技园联合空间', registration: 'Meetup.com报名', benefits: '开源项目贡献者T恤、技术分享', requirements: '开源爱好者', contact: 'oss@sz-ai.community' },
  { id: 'evt-015', title: '苏州AI+工业互联网论坛', date: '2026-10-20', city: '苏州', venue: '苏州国际博览中心', registration: '官网在线注册', benefits: '工业互联网平台试用、案例集', requirements: '制造业IT负责人', contact: 'iiot@suzhou-ai.cn' },
  { id: 'evt-016', title: 'AI教育应用研讨会', date: '2026-08-30', city: '合肥', venue: '中国科大先进技术研究院', registration: '官网注册', benefits: '教育AI工具包、教学案例集', requirements: '教育工作者或EdTech从业者', contact: 'edu-ai@ustc.cn' },
  { id: 'evt-017', title: '东北AI+冰雪经济论坛', date: '2026-12-05', city: '哈尔滨', venue: '哈尔滨国际会展中心', registration: '官网在线注册', benefits: '冰雪AI项目体验、文旅资源对接', requirements: '文旅或AI从业者', contact: 'ice-ai@hrb-tech.cn' },
  { id: 'evt-018', title: 'AI新零售创新工坊', date: '2026-09-28', city: '杭州', venue: '未来科技城海创园', registration: '微信小程序报名', benefits: '零售AI方案Demo、商家资源对接', requirements: '零售或电商从业者', contact: 'retail@future-ai.cn' },
  { id: 'evt-019', title: '滇池AI+生态保护研讨会', date: '2026-11-15', city: '昆明', venue: '滇池国际会展中心', registration: '官网注册', benefits: '生态AI监测Demo、科研合作机会', requirements: '环保或AI研究者', contact: 'eco-ai@dianchi.cn' },
  { id: 'evt-020', title: '横琴AI跨境数据论坛', date: '2026-11-20', city: '珠海', venue: '横琴粤澳深度合作区会展中心', registration: '官网申请+审核', benefits: '跨境数据沙盒试用、政策解读', requirements: '跨境业务或数据合规从业者', contact: 'data@hengqin-ai.cn' },
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

  // 种活动（全部 approved，作为初始数据）
  let eventCount = 0;
  for (const evt of EVENTS) {
    await prisma.event.upsert({
      where: { id: evt.id },
      update: {},
      create: {
        ...evt,
        status: 'approved',
        reviewedAt: new Date(),
        reviewedBy: 'seed',
      },
    });
    eventCount++;
  }
  console.log(`✅ ${eventCount} 条活动已写入（全部 approved）`);

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
