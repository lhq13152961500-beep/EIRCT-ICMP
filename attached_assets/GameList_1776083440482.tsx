import { motion } from 'motion/react';
import { Volume2, List, Trophy, ChevronRight, Gift, Sparkles } from 'lucide-react';
import { usePoints } from '../context/PointsContext';

interface GameListProps {
  onSelectGame: (game: 'dialect' | 'sound' | 'rewards' | 'achievements') => void;
}

const games = [
  {
    id: 'dialect',
    title: '方言采集',
    subtitle: '收集本地玉米的5种称呼',
    icon: List,
    progress: 3,
    total: 5,
    color: 'from-orange-400 to-red-400',
    bgColor: 'bg-orange-50',
  },
  {
    id: 'sound',
    title: '声音寻觅',
    subtitle: '根据方言找到对应物品',
    icon: Volume2,
    progress: 2,
    total: 8,
    color: 'from-blue-400 to-cyan-400',
    bgColor: 'bg-blue-50',
  },
];

export function GameList({ onSelectGame }: GameListProps) {
  const { points, badges } = usePoints();
  const unlockedBadgesCount = badges.filter((b) => b.unlocked).length;

  return (
    <div className="min-h-screen p-6">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-4xl mx-auto"
      >
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div className="text-center flex-1">
              <h1 className="text-5xl mb-3 bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent">
                乡音趣采
              </h1>
              <p className="text-muted-foreground">探索本地方言，感受文化魅力</p>
            </div>
          </div>

          <motion.button
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onSelectGame('rewards')}
            className="w-full p-4 rounded-2xl bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg mb-6 relative overflow-hidden"
          >
            <div className="flex items-center justify-between relative z-10">
              <div className="flex items-center gap-3">
                <div className="size-12 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center">
                  <Gift className="size-6" />
                </div>
                <div className="text-left">
                  <p className="font-medium">积分中心</p>
                  <p className="text-sm text-white/80">兑换精彩奖励</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className="flex items-center gap-1 justify-end">
                    <Sparkles className="size-5" />
                    <span className="text-2xl font-medium">{points}</span>
                  </div>
                  <p className="text-xs text-white/80">{unlockedBadgesCount} 个徽章</p>
                </div>
                <ChevronRight className="size-6" />
              </div>
            </div>
          </motion.button>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {games.map((game, index) => {
            const Icon = game.icon;
            const progressPercent = (game.progress / game.total) * 100;

            return (
              <motion.button
                key={game.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                whileHover={{ scale: 1.02, y: -4 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => onSelectGame(game.id as 'dialect' | 'sound')}
                className="relative overflow-hidden rounded-2xl bg-white p-6 text-left shadow-lg transition-shadow hover:shadow-xl"
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${game.color} opacity-5`} />

                <div className="relative">
                  <div className="flex items-start justify-between mb-4">
                    <div className={`p-3 rounded-xl bg-gradient-to-br ${game.color}`}>
                      <Icon className="size-6 text-white" />
                    </div>
                    <ChevronRight className="size-5 text-muted-foreground" />
                  </div>

                  <h3 className="mb-1">{game.title}</h3>
                  <p className="text-sm text-muted-foreground mb-4">{game.subtitle}</p>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">进度</span>
                      <span className="font-medium">{game.progress}/{game.total}</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${progressPercent}%` }}
                        transition={{ duration: 0.8, delay: index * 0.1 + 0.3 }}
                        className={`h-full bg-gradient-to-r ${game.color}`}
                      />
                    </div>
                  </div>
                </div>
              </motion.button>
            );
          })}
        </div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mt-6 text-center text-muted-foreground text-sm"
        >
          更多游戏即将上架....
        </motion.p>

        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          onClick={() => onSelectGame('achievements')}
          className="mt-12 w-full rounded-2xl bg-white shadow-lg overflow-hidden"
        >
          <div className="p-4 flex items-center gap-4">
            <div className="relative shrink-0">
              <div className="size-16 rounded-xl bg-gradient-to-br from-blue-400 via-blue-500 to-blue-600 p-0.5 shadow-lg">
                <div className="size-full rounded-lg bg-gradient-to-br from-orange-400 via-orange-500 to-red-500 flex items-center justify-center">
                  <Trophy className="size-8 text-white" />
                </div>
              </div>
              <div className="absolute -top-1 -right-1 size-6 rounded-full bg-yellow-400 border-2 border-white flex items-center justify-center text-xs font-bold shadow">
                {unlockedBadgesCount}
              </div>
            </div>
            <div className="flex-1 text-left">
              <h3 className="mb-0.5">已经获得{unlockedBadgesCount}枚勋章</h3>
              <p className="text-sm text-muted-foreground">随地理博主游新游</p>
            </div>
            <button className="px-4 py-1.5 rounded-full border-2 border-primary text-sm font-medium hover:bg-accent transition-colors">
              全部成就
            </button>
          </div>
        </motion.button>
      </motion.div>
    </div>
  );
}
