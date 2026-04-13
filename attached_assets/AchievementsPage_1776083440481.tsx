import { motion } from 'motion/react';
import { X, Trophy } from 'lucide-react';
import { usePoints } from '../context/PointsContext';

interface AchievementsPageProps {
  onBack: () => void;
}

export function AchievementsPage({ onBack }: AchievementsPageProps) {
  const { badges } = usePoints();
  const unlockedBadgesCount = badges.filter((b) => b.unlocked).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50">
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="w-8" />
          <h2 className="font-medium">我的勋章墙</h2>
          <button
            onClick={onBack}
            className="flex items-center justify-center size-8 rounded-full hover:bg-muted transition-colors"
          >
            <X className="size-5" />
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl overflow-hidden shadow-lg"
        >
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800" />
            <div className="absolute inset-0 opacity-20">
              <svg className="w-full h-full" viewBox="0 0 400 300" preserveAspectRatio="none">
                <path d="M0,150 Q100,100 200,150 T400,150 L400,300 L0,300 Z" fill="currentColor" className="text-blue-900" />
                <path d="M0,170 Q100,120 200,170 T400,170 L400,300 L0,300 Z" fill="currentColor" className="text-blue-800" />
              </svg>
            </div>

            <div className="relative px-6 pt-12 pb-8">
              <div className="flex justify-center mb-8">
                <div className="relative">
                  <div className="size-40 rounded-3xl bg-gradient-to-br from-blue-400 via-blue-500 to-blue-600 p-1.5 shadow-2xl">
                    <div className="size-full rounded-2xl bg-gradient-to-br from-orange-400 via-orange-500 to-red-500 flex items-center justify-center relative overflow-hidden">
                      <Trophy className="size-20 text-white relative z-10" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
                    </div>
                  </div>
                  <div className="absolute -top-3 -right-3 size-12 rounded-full bg-yellow-400 border-4 border-blue-700 flex items-center justify-center font-bold text-lg shadow-lg">
                    {unlockedBadgesCount}
                  </div>
                  <div className="absolute -top-2 -left-2 px-3 py-1 rounded-full bg-white text-blue-700 text-xs font-bold shadow-lg">
                    2026
                  </div>
                  <div className="absolute -bottom-2 -right-2 px-3 py-1 rounded-full bg-white text-blue-700 text-xs font-bold shadow-lg">
                    JAN
                  </div>
                </div>
              </div>

              <div className="text-center">
                <p className="text-blue-100 text-sm mb-2">最近获得</p>
                <p className="text-white text-xl font-medium">1月地理星人 · 2026</p>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-blue-700 to-indigo-800 px-6 py-8">
            <div className="grid grid-cols-3 gap-6">
              {badges.map((badge, index) => (
                <motion.div
                  key={badge.id}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.05 }}
                  className="text-center"
                >
                  <div
                    className={`size-24 rounded-full mx-auto mb-3 flex items-center justify-center text-4xl transition-all ${
                      badge.unlocked
                        ? 'bg-white shadow-xl'
                        : 'bg-blue-800/50 opacity-40 grayscale'
                    }`}
                  >
                    {badge.icon}
                  </div>
                  <p
                    className={`text-sm font-medium mb-1 ${
                      badge.unlocked ? 'text-white' : 'text-blue-300'
                    }`}
                  >
                    {badge.name}
                  </p>
                  <p className="text-xs text-blue-200 px-2">{badge.description}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
