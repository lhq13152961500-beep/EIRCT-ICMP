import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Volume2, VolumeX, Check, X, Trophy, Coins } from 'lucide-react';
import { usePoints } from '../context/PointsContext';

interface SoundMatchingGameProps {
  onBack: () => void;
}

interface GameItem {
  id: number;
  name: string;
  dialectName: string;
  emoji: string;
  audioHint: string;
}

const gameItems: GameItem[] = [
  { id: 1, name: '土豆', dialectName: '洋芋', emoji: '🥔', audioHint: '阳雨' },
  { id: 2, name: '西红柿', dialectName: '番茄', emoji: '🍅', audioHint: '番切' },
  { id: 3, name: '花生', dialectName: '长生果', emoji: '🥜', audioHint: '长生果' },
  { id: 4, name: '红薯', dialectName: '地瓜', emoji: '🍠', audioHint: '地瓜' },
  { id: 5, name: '黄瓜', dialectName: '青瓜', emoji: '🥒', audioHint: '青瓜' },
  { id: 6, name: '茄子', dialectName: '矮瓜', emoji: '🍆', audioHint: '矮瓜' },
  { id: 7, name: '菠菜', dialectName: '赤根菜', emoji: '🥬', audioHint: '赤根菜' },
  { id: 8, name: '南瓜', dialectName: '番瓜', emoji: '🎃', audioHint: '番瓜' },
];

export function SoundMatchingGame({ onBack }: SoundMatchingGameProps) {
  const [currentRound, setCurrentRound] = useState(0);
  const [score, setScore] = useState(0);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showResult, setShowResult] = useState<'correct' | 'wrong' | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [completedRounds, setCompletedRounds] = useState<number[]>([]);
  const [gameCompleted, setGameCompleted] = useState(false);
  const { addPoints, unlockBadge } = usePoints();

  const currentItem = gameItems[currentRound];
  const shuffledOptions = [...gameItems]
    .sort(() => Math.random() - 0.5)
    .slice(0, 4)
    .filter((item, index, arr) =>
      arr.findIndex(i => i.id === item.id) === index
    );

  if (!shuffledOptions.find((item) => item.id === currentItem.id)) {
    shuffledOptions[Math.floor(Math.random() * shuffledOptions.length)] = currentItem;
  }

  const playSound = () => {
    setIsPlaying(true);
    setTimeout(() => setIsPlaying(false), 1000);
  };

  const handleSelect = (id: number) => {
    if (showResult) return;

    setSelectedId(id);
    const isCorrect = id === currentItem.id;
    setShowResult(isCorrect ? 'correct' : 'wrong');

    if (isCorrect) {
      setScore((prev) => prev + 1);
      setCompletedRounds((prev) => [...prev, currentRound]);
    }

    setTimeout(() => {
      if (currentRound < gameItems.length - 1) {
        setCurrentRound((prev) => prev + 1);
      } else if (!gameCompleted) {
        setGameCompleted(true);
      }
      setSelectedId(null);
      setShowResult(null);
    }, 1500);
  };

  useEffect(() => {
    if (gameCompleted && currentRound === gameItems.length - 1) {
      const pointsEarned = score * 10;
      addPoints(pointsEarned);
      unlockBadge('sound-expert');
      if (score === gameItems.length) {
        unlockBadge('perfect-score');
      }
    }
  }, [gameCompleted, currentRound, score, addPoints, unlockBadge]);

  const progress = ((currentRound + 1) / gameItems.length) * 100;

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

          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="mb-1">声音寻觅</h1>
              <p className="text-muted-foreground">听方言发音，找到对应物品</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <div className="text-2xl font-medium bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
                  {score}/{gameItems.length}
                </div>
                <p className="text-sm text-muted-foreground">得分</p>
              </div>
            </div>
          </div>

          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <motion.div
              animate={{ width: `${progress}%` }}
              className="h-full bg-gradient-to-r from-blue-500 to-cyan-500"
              transition={{ duration: 0.3 }}
            />
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-8 mb-6">
          <div className="text-center mb-8">
            <p className="text-muted-foreground mb-4">第 {currentRound + 1} / {gameItems.length} 题</p>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={playSound}
              className={`relative inline-flex items-center justify-center size-24 rounded-full shadow-lg transition-all ${
                isPlaying
                  ? 'bg-gradient-to-br from-blue-500 to-cyan-500'
                  : 'bg-gradient-to-br from-blue-400 to-cyan-400 hover:shadow-xl'
              }`}
            >
              {isPlaying ? (
                <VolumeX className="size-12 text-white" />
              ) : (
                <Volume2 className="size-12 text-white" />
              )}

              {isPlaying && (
                <motion.div
                  initial={{ scale: 1, opacity: 0.5 }}
                  animate={{ scale: 2, opacity: 0 }}
                  transition={{ duration: 1 }}
                  className="absolute inset-0 rounded-full bg-blue-400"
                />
              )}
            </motion.button>

            {isPlaying && (
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4 text-lg"
              >
                "{currentItem.audioHint}"
              </motion.p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            {shuffledOptions.map((item) => {
              const isSelected = selectedId === item.id;
              const isCorrectAnswer = item.id === currentItem.id;
              const showCorrect = showResult && isCorrectAnswer;
              const showWrong = showResult === 'wrong' && isSelected;

              return (
                <motion.button
                  key={item.id}
                  whileHover={!showResult ? { scale: 1.02 } : {}}
                  whileTap={!showResult ? { scale: 0.98 } : {}}
                  onClick={() => handleSelect(item.id)}
                  disabled={showResult !== null}
                  className={`p-6 rounded-xl border-2 transition-all ${
                    showCorrect
                      ? 'bg-green-50 border-green-500'
                      : showWrong
                      ? 'bg-red-50 border-red-500'
                      : isSelected
                      ? 'bg-blue-50 border-blue-500'
                      : 'bg-white border-border hover:border-blue-300'
                  }`}
                >
                  <div className="text-5xl mb-2">{item.emoji}</div>
                  <p className="font-medium">{item.name}</p>

                  <AnimatePresence>
                    {showCorrect && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="absolute top-2 right-2 size-8 rounded-full bg-green-500 flex items-center justify-center"
                      >
                        <Check className="size-5 text-white" />
                      </motion.div>
                    )}
                    {showWrong && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="absolute top-2 right-2 size-8 rounded-full bg-red-500 flex items-center justify-center"
                      >
                        <X className="size-5 text-white" />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.button>
              );
            })}
          </div>
        </div>

        {currentRound === gameItems.length - 1 && showResult && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-br from-blue-500 to-cyan-500 rounded-2xl shadow-lg p-8 text-white text-center"
          >
            <Trophy className="size-16 mx-auto mb-4" />
            <h2 className="mb-2 text-white">游戏完成！</h2>
            <p className="text-lg mb-2">你的得分：{score} / {gameItems.length}</p>
            <p className="text-blue-100 mb-4">
              {score === gameItems.length
                ? '完美！你对方言了如指掌！'
                : score >= gameItems.length * 0.7
                ? '非常好！继续加油！'
                : '不错的尝试，多练习会更好！'}
            </p>
            <div className="flex items-center justify-center gap-2 p-4 rounded-xl bg-white/20 backdrop-blur">
              <Coins className="size-6" />
              <span className="text-lg font-medium">+{score * 10} 乡音积分</span>
            </div>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
