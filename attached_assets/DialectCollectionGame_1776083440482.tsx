import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Check, Sparkles, MapPin, Coins } from 'lucide-react';
import { usePoints } from '../context/PointsContext';

interface DialectCollectionGameProps {
  onBack: () => void;
}

interface DialectTerm {
  id: number;
  term: string;
  location: string;
  collected: boolean;
  x: number;
  y: number;
}

const initialTerms: DialectTerm[] = [
  { id: 1, term: '包谷', location: '西南地区', collected: false, x: 20, y: 30 },
  { id: 2, term: '棒子', location: '华北地区', collected: false, x: 60, y: 20 },
  { id: 3, term: '苞米', location: '东北地区', collected: false, x: 75, y: 40 },
  { id: 4, term: '珍珠米', location: '江南地区', collected: false, x: 35, y: 60 },
  { id: 5, term: '玉蜀黍', location: '闽南地区', collected: false, x: 50, y: 75 },
];

export function DialectCollectionGame({ onBack }: DialectCollectionGameProps) {
  const [terms, setTerms] = useState(initialTerms);
  const [showCelebration, setShowCelebration] = useState(false);
  const [pointsAwarded, setPointsAwarded] = useState(false);
  const { addPoints, unlockBadge } = usePoints();

  const handleCollect = (id: number) => {
    setTerms((prev) =>
      prev.map((term) => (term.id === id ? { ...term, collected: true } : term))
    );

    const allCollected = terms.filter((t) => t.id !== id).every((t) => t.collected);
    if (allCollected) {
      setTimeout(() => setShowCelebration(true), 500);
    }
  };

  const collectedCount = terms.filter((t) => t.collected).length;

  useEffect(() => {
    if (collectedCount === 5 && !pointsAwarded) {
      addPoints(100);
      unlockBadge('dialect-master');
      unlockBadge('perfect-score');
      setPointsAwarded(true);
    }
  }, [collectedCount, pointsAwarded, addPoints, unlockBadge]);

  return (
    <div className="min-h-screen p-6">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="max-w-4xl mx-auto"
      >
        <div className="mb-8">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-4"
          >
            <ArrowLeft className="size-5" />
            返回游戏列表
          </button>

          <div className="flex items-center justify-between">
            <div>
              <h1 className="mb-1">方言采集</h1>
              <p className="text-muted-foreground">点击地图上的标记收集方言</p>
            </div>
            <div className="text-right">
              <div className="text-3xl font-medium bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent">
                {collectedCount}/5
              </div>
              <p className="text-sm text-muted-foreground">已收集</p>
            </div>
          </div>
        </div>

        <div className="relative bg-white rounded-2xl shadow-lg overflow-hidden">
          <div className="aspect-[4/3] bg-gradient-to-br from-amber-100 via-orange-50 to-yellow-100 relative">
            <AnimatePresence>
              {terms.map((term) => (
                <motion.button
                  key={term.id}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  transition={{ delay: term.id * 0.1 }}
                  style={{
                    position: 'absolute',
                    left: `${term.x}%`,
                    top: `${term.y}%`,
                    transform: 'translate(-50%, -50%)',
                  }}
                  onClick={() => !term.collected && handleCollect(term.id)}
                  disabled={term.collected}
                  className="group"
                >
                  <motion.div
                    whileHover={!term.collected ? { scale: 1.1 } : {}}
                    whileTap={!term.collected ? { scale: 0.95 } : {}}
                    className="relative"
                  >
                    <div
                      className={`size-16 rounded-full flex items-center justify-center shadow-lg transition-all ${
                        term.collected
                          ? 'bg-gradient-to-br from-green-400 to-emerald-500'
                          : 'bg-gradient-to-br from-orange-400 to-red-400 group-hover:shadow-xl'
                      }`}
                    >
                      {term.collected ? (
                        <Check className="size-8 text-white" />
                      ) : (
                        <MapPin className="size-8 text-white" />
                      )}
                    </div>

                    {!term.collected && (
                      <motion.div
                        animate={{ scale: [1, 1.3, 1] }}
                        transition={{ duration: 2, repeat: Infinity }}
                        className="absolute inset-0 rounded-full bg-orange-400 opacity-30"
                      />
                    )}

                    <div
                      className={`absolute top-full mt-2 left-1/2 -translate-x-1/2 whitespace-nowrap px-3 py-1.5 rounded-lg shadow-lg transition-opacity ${
                        term.collected
                          ? 'bg-green-500 opacity-100'
                          : 'bg-white opacity-0 group-hover:opacity-100'
                      }`}
                    >
                      <p className={`text-sm font-medium ${term.collected ? 'text-white' : ''}`}>
                        {term.term}
                      </p>
                      <p
                        className={`text-xs ${
                          term.collected ? 'text-green-100' : 'text-muted-foreground'
                        }`}
                      >
                        {term.location}
                      </p>
                    </div>
                  </motion.div>
                </motion.button>
              ))}
            </AnimatePresence>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-5 gap-3">
          {terms.map((term) => (
            <motion.div
              key={term.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 + term.id * 0.05 }}
              className={`p-3 rounded-xl text-center transition-all ${
                term.collected
                  ? 'bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-300'
                  : 'bg-muted'
              }`}
            >
              <p
                className={`text-sm font-medium mb-1 ${
                  term.collected ? 'text-green-700' : 'text-muted-foreground'
                }`}
              >
                {term.collected ? term.term : '???'}
              </p>
              <p className="text-xs text-muted-foreground">{term.location}</p>
            </motion.div>
          ))}
        </div>
      </motion.div>

      <AnimatePresence>
        {showCelebration && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
            onClick={() => setShowCelebration(false)}
          >
            <motion.div
              initial={{ scale: 0, rotate: -10 }}
              animate={{ scale: 1, rotate: 0 }}
              exit={{ scale: 0, rotate: 10 }}
              className="bg-white rounded-2xl p-8 max-w-md mx-4 text-center"
              onClick={(e) => e.stopPropagation()}
            >
              <motion.div
                animate={{ rotate: [0, 10, -10, 0] }}
                transition={{ duration: 0.5, repeat: Infinity }}
                className="inline-flex items-center justify-center size-20 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 mb-4"
              >
                <Sparkles className="size-10 text-white" />
              </motion.div>
              <h2 className="mb-2">恭喜完成！</h2>
              <p className="text-muted-foreground mb-4">
                你已收集到"玉米"的5种方言称呼，了解了中国语言的多样性！
              </p>
              <div className="flex items-center justify-center gap-2 mb-6 p-4 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50">
                <Coins className="size-6 text-amber-600" />
                <span className="text-lg font-medium text-amber-700">+100 乡音积分</span>
              </div>
              <button
                onClick={() => setShowCelebration(false)}
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 text-white font-medium hover:shadow-lg transition-shadow"
              >
                继续探索
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
