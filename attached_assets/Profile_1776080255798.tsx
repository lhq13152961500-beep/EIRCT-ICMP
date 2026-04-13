import { TrendingUp, FileAudio, DollarSign, Clock, Sparkles } from 'lucide-react';

const stats = [
  {
    label: '累计收益',
    value: '¥1,247',
    icon: DollarSign,
    trend: '+18%',
    color: 'text-green-700',
    bg: 'bg-green-50',
  },
  {
    label: '录制档案',
    value: '12',
    icon: FileAudio,
    trend: '本月 +3',
    color: 'text-amber-700',
    bg: 'bg-amber-50',
  },
  {
    label: '总播放量',
    value: '8,432',
    icon: TrendingUp,
    trend: '+124',
    color: 'text-blue-700',
    bg: 'bg-blue-50',
  },
];

const myRecordings = [
  {
    id: '1',
    title: '维吾尔族老人讲述葡萄沟往事',
    category: '方言',
    status: '已发布',
    plays: 2847,
    revenue: '¥342',
    date: '2026-03-28',
  },
  {
    id: '2',
    title: '桑皮纸制作技艺实录',
    category: '传统工艺',
    status: '已发布',
    plays: 1523,
    revenue: '¥189',
    date: '2026-03-15',
  },
  {
    id: '3',
    title: '坎儿井流水声与劳作号子',
    category: '工具声音',
    status: '审核中',
    plays: 0,
    revenue: '¥0',
    date: '2026-04-10',
  },
];

export function Profile() {
  return (
    <div className="min-h-full bg-gradient-to-b from-white via-amber-50/30 to-orange-50/50 pb-6">
      {/* User Info */}
      <div className="relative overflow-hidden bg-gradient-to-br from-amber-500 via-orange-500 to-orange-600 px-6 py-10">
        <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full -mr-24 -mt-24" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/10 rounded-full -ml-16 -mb-16" />

        <div className="relative">
          <div className="flex items-center gap-5 mb-6">
            <div className="relative">
              <div className="absolute inset-0 bg-white/30 rounded-full blur-xl" />
              <div className="relative w-24 h-24 rounded-full bg-gradient-to-br from-white to-amber-100 flex items-center justify-center text-4xl shadow-2xl border-4 border-white/50">
                👤
              </div>
            </div>
            <div>
              <h2 className="text-2xl text-white mb-2 drop-shadow-lg">艾力·买买提</h2>
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 bg-white/20 backdrop-blur-sm rounded-full text-sm text-white border border-white/30">
                  认证村民
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 text-sm text-white/90">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-white/80" />
              吐峪沟
            </span>
            <span>•</span>
            <span>加入 126 天</span>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="px-6 py-8">
        <div className="grid grid-cols-3 gap-4">
          {stats.map((stat, index) => (
            <div
              key={stat.label}
              className="relative overflow-hidden bg-white rounded-2xl p-5 shadow-xl hover:shadow-2xl transition-all hover:scale-105"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <div className={`absolute top-0 right-0 w-20 h-20 bg-gradient-to-br ${stat.bg} opacity-20 rounded-full -mr-10 -mt-10`} />
              <div className="relative">
                <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${stat.bg} flex items-center justify-center mb-3 shadow-lg`}>
                  <stat.icon className={`w-6 h-6 ${stat.color}`} />
                </div>
                <div className={`text-2xl ${stat.color} mb-2`}>
                  {stat.value}
                </div>
                <div className="text-xs text-stone-600 mb-1.5">{stat.label}</div>
                <div className="text-xs text-stone-500 flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" />
                  {stat.trend}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* My Recordings */}
      <div className="px-6">
        <div className="flex items-center gap-2 mb-5">
          <Sparkles className="w-5 h-5 text-amber-600" />
          <h3 className="text-stone-900">我的档案</h3>
        </div>
        <div className="space-y-4">
          {myRecordings.map((recording, index) => (
            <div
              key={recording.id}
              className="relative overflow-hidden bg-white rounded-2xl p-6 shadow-xl hover:shadow-2xl transition-all hover:scale-[1.02]"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-amber-100/30 to-orange-100/30 rounded-full -mr-16 -mt-16" />

              <div className="relative">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h4 className="text-stone-900 mb-3 leading-snug pr-4">{recording.title}</h4>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="px-4 py-1.5 bg-gradient-to-r from-stone-50 to-stone-100 rounded-full text-stone-700 border border-stone-200">
                        {recording.category}
                      </span>
                      <span
                        className={`px-4 py-1.5 rounded-full border ${
                          recording.status === '已发布'
                            ? 'bg-gradient-to-r from-green-50 to-emerald-50 text-green-700 border-green-200'
                            : 'bg-gradient-to-r from-amber-50 to-orange-50 text-amber-700 border-amber-200'
                        }`}
                      >
                        {recording.status}
                      </span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xl text-green-700 mb-1 font-medium">{recording.revenue}</div>
                    <div className="text-xs text-stone-500">收益</div>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-stone-500 pt-4 border-t border-stone-100">
                  <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1.5">
                      <TrendingUp className="w-3.5 h-3.5" />
                      {recording.plays.toLocaleString()} 次播放
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" />
                      {recording.date}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Partnership Info */}
      <div className="px-6 py-6">
        <div className="relative overflow-hidden bg-gradient-to-br from-blue-500 to-cyan-600 rounded-2xl p-6 shadow-xl">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16" />
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full -ml-12 -mb-12" />

          <div className="relative">
            <h4 className="text-white mb-3 flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              合作机构
            </h4>
            <p className="text-sm text-white/95 mb-4">
              你的优质声音档案已被以下机构收录
            </p>
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-3 bg-white/20 backdrop-blur-sm rounded-xl px-4 py-3 border border-white/30">
                <span className="text-xl">🏛️</span>
                <span className="text-white">吐鲁番市档案馆</span>
              </div>
              <div className="flex items-center gap-3 bg-white/20 backdrop-blur-sm rounded-xl px-4 py-3 border border-white/30">
                <span className="text-xl">🎓</span>
                <span className="text-white">新疆大学民俗研究中心</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Incentive Info */}
      <div className="px-6 pb-8">
        <div className="relative overflow-hidden bg-gradient-to-br from-amber-500 via-orange-500 to-orange-600 rounded-2xl p-6 shadow-xl">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16" />

          <div className="relative">
            <h4 className="text-white mb-4 flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              收益说明
            </h4>
            <ul className="text-sm text-white/95 space-y-3">
              <li className="flex items-start gap-3">
                <span className="w-1.5 h-1.5 rounded-full bg-white/80 mt-2 shrink-0" />
                <span>收益根据播放量和内容质量计算</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-1.5 h-1.5 rounded-full bg-white/80 mt-2 shrink-0" />
                <span>优质内容将获得平台推荐</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-1.5 h-1.5 rounded-full bg-white/80 mt-2 shrink-0" />
                <span>每月5日结算上月收益</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-1.5 h-1.5 rounded-full bg-white/80 mt-2 shrink-0" />
                <span>被学术机构收录可获额外奖励</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
