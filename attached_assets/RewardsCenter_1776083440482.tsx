import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Gift, Award, Sparkles, Check, ShoppingBag } from 'lucide-react';
import { usePoints } from '../context/PointsContext';

interface RewardsCenterProps {
  onBack: () => void;
}

interface PhysicalReward {
  id: string;
  name: string;
  description: string;
  icon: string;
  cost: number;
  category: 'coupon' | 'experience' | 'product';
}

const physicalRewards: PhysicalReward[] = [
  {
    id: 'tea-coupon',
    name: '本地茶叶优惠券',
    description: '购买当地特产茶叶享8折优惠',
    icon: '🍵',
    cost: 50,
    category: 'coupon',
  },
  {
    id: 'fruit-coupon',
    name: '时令水果券',
    description: '兑换价值30元的新鲜时令水果',
    icon: '🍎',
    cost: 80,
    category: 'coupon',
  },
  {
    id: 'homestay-discount',
    name: '民宿折扣券',
    description: '入住合作民宿立减100元',
    icon: '🏠',
    cost: 120,
    category: 'coupon',
  },
  {
    id: 'craft-workshop',
    name: '非遗手工体验',
    description: '参与传统手工艺制作体验',
    icon: '🎨',
    cost: 150,
    category: 'experience',
  },
  {
    id: 'cooking-class',
    name: '地方美食课程',
    description: '学习制作当地特色美食',
    icon: '👨‍🍳',
    cost: 180,
    category: 'experience',
  },
  {
    id: 'honey-jar',
    name: '农家蜂蜜',
    description: '500g纯天然蜂蜜',
    icon: '🍯',
    cost: 100,
    category: 'product',
  },
];

export function RewardsCenter({ onBack }: RewardsCenterProps) {
  const { points, spendPoints, badges, skins, unlockSkin, activeSkin, setActiveSkin } = usePoints();
  const [activeTab, setActiveTab] = useState<'physical' | 'badges' | 'skins'>('physical');
  const [showSuccess, setShowSuccess] = useState<string | null>(null);

  const handleRedeem = (reward: PhysicalReward) => {
    if (spendPoints(reward.cost)) {
      setShowSuccess(reward.name);
      setTimeout(() => setShowSuccess(null), 2000);
    }
  };

  const handleUnlockSkin = (skinId: string, cost: number) => {
    if (spendPoints(cost)) {
      unlockSkin(skinId);
      setShowSuccess('皮肤已解锁！');
      setTimeout(() => setShowSuccess(null), 2000);
    }
  };

  return (
    <div className="min-h-screen p-6 bg-gradient-to-br from-purple-50 via-pink-50 to-orange-50">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="max-w-6xl mx-auto"
      >
        <div className="mb-8">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-4"
          >
            <ArrowLeft className="size-5" />
            返回首页
          </button>

          <div className="flex items-center justify-between">
            <div>
              <h1 className="mb-1">积分中心</h1>
              <p className="text-muted-foreground">用乡音积分兑换精彩奖励</p>
            </div>
            <div className="text-right">
              <div className="text-4xl font-medium bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                {points}
              </div>
              <p className="text-sm text-muted-foreground">可用积分</p>
            </div>
          </div>
        </div>

        <div className="flex gap-3 mb-6">
          {[
            { id: 'physical', label: '实体权益', icon: Gift },
            { id: 'badges', label: '成就勋章', icon: Award },
            { id: 'skins', label: '伴游皮肤', icon: Sparkles },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`flex-1 py-3 px-4 rounded-xl font-medium transition-all ${
                  activeTab === tab.id
                    ? 'bg-white shadow-lg'
                    : 'bg-white/50 hover:bg-white/80'
                }`}
              >
                <Icon className={`size-5 mx-auto mb-1 ${activeTab === tab.id ? 'text-purple-600' : 'text-muted-foreground'}`} />
                {tab.label}
              </button>
            );
          })}
        </div>

        <AnimatePresence mode="wait">
          {activeTab === 'physical' && (
            <motion.div
              key="physical"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="grid gap-4 md:grid-cols-2 lg:grid-cols-3"
            >
              {physicalRewards.map((reward) => {
                const canAfford = points >= reward.cost;
                return (
                  <div
                    key={reward.id}
                    className="bg-white rounded-xl p-5 shadow-lg"
                  >
                    <div className="text-5xl mb-3">{reward.icon}</div>
                    <h3 className="mb-1">{reward.name}</h3>
                    <p className="text-sm text-muted-foreground mb-4">{reward.description}</p>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <Sparkles className="size-4 text-amber-500" />
                        <span className="font-medium">{reward.cost}</span>
                      </div>
                      <button
                        onClick={() => handleRedeem(reward)}
                        disabled={!canAfford}
                        className={`px-4 py-2 rounded-lg font-medium transition-all ${
                          canAfford
                            ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:shadow-lg'
                            : 'bg-muted text-muted-foreground cursor-not-allowed'
                        }`}
                      >
                        兑换
                      </button>
                    </div>
                  </div>
                );
              })}
            </motion.div>
          )}

          {activeTab === 'badges' && (
            <motion.div
              key="badges"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="grid gap-4 md:grid-cols-2 lg:grid-cols-3"
            >
              {badges.map((badge) => (
                <div
                  key={badge.id}
                  className={`relative overflow-hidden rounded-xl p-6 shadow-lg transition-all ${
                    badge.unlocked
                      ? 'bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-300'
                      : 'bg-white opacity-60'
                  }`}
                >
                  {badge.unlocked && (
                    <div className="absolute top-3 right-3">
                      <div className="size-8 rounded-full bg-green-500 flex items-center justify-center">
                        <Check className="size-5 text-white" />
                      </div>
                    </div>
                  )}
                  <div className="text-6xl mb-3">{badge.icon}</div>
                  <h3 className="mb-1">{badge.name}</h3>
                  <p className="text-sm text-muted-foreground">{badge.description}</p>
                  {!badge.unlocked && (
                    <div className="mt-3 text-sm text-muted-foreground">🔒 未解锁</div>
                  )}
                </div>
              ))}
            </motion.div>
          )}

          {activeTab === 'skins' && (
            <motion.div
              key="skins"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="grid gap-4 md:grid-cols-2 lg:grid-cols-4"
            >
              {skins.map((skin) => {
                const canAfford = points >= skin.cost;
                const isActive = activeSkin === skin.id;
                return (
                  <div
                    key={skin.id}
                    className={`relative rounded-xl p-5 shadow-lg transition-all ${
                      isActive
                        ? 'bg-gradient-to-br from-blue-50 to-cyan-50 border-2 border-blue-400'
                        : 'bg-white'
                    }`}
                  >
                    {isActive && (
                      <div className="absolute top-3 right-3">
                        <div className="px-2 py-1 rounded-full bg-blue-500 text-white text-xs font-medium">
                          使用中
                        </div>
                      </div>
                    )}
                    <div className="text-6xl mb-3 text-center">{skin.preview}</div>
                    <h4 className="text-center mb-3">{skin.name}</h4>
                    {skin.unlocked ? (
                      <button
                        onClick={() => setActiveSkin(skin.id)}
                        disabled={isActive}
                        className={`w-full py-2 rounded-lg font-medium transition-all ${
                          isActive
                            ? 'bg-blue-500 text-white'
                            : 'bg-muted hover:bg-accent'
                        }`}
                      >
                        {isActive ? '使用中' : '使用'}
                      </button>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex items-center justify-center gap-1 text-sm">
                          <Sparkles className="size-4 text-amber-500" />
                          <span className="font-medium">{skin.cost}</span>
                        </div>
                        <button
                          onClick={() => handleUnlockSkin(skin.id, skin.cost)}
                          disabled={!canAfford}
                          className={`w-full py-2 rounded-lg font-medium transition-all ${
                            canAfford
                              ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:shadow-lg'
                              : 'bg-muted text-muted-foreground cursor-not-allowed'
                          }`}
                        >
                          解锁
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      <AnimatePresence>
        {showSuccess && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-green-500 text-white px-6 py-3 rounded-full shadow-lg flex items-center gap-2"
          >
            <Check className="size-5" />
            <span>兑换成功：{showSuccess}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
