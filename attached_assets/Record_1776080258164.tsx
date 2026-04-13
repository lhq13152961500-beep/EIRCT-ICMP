import { useState } from 'react';
import { Mic, Square, Play, Upload, AlertCircle, CheckCircle, Sparkles } from 'lucide-react';

export function Record() {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [hasRecording, setHasRecording] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [verified] = useState(true);
  const [step, setStep] = useState<'record' | 'details'>('record');

  const categories = [
    { name: '方言', icon: '💬', gradient: 'from-rose-400 to-pink-500' },
    { name: '传统工艺', icon: '🔨', gradient: 'from-amber-400 to-orange-500' },
    { name: '工具声音', icon: '⚙️', gradient: 'from-slate-400 to-gray-500' },
    { name: '民歌小调', icon: '🎵', gradient: 'from-violet-400 to-purple-500' },
    { name: '故事传说', icon: '📖', gradient: 'from-blue-400 to-cyan-500' },
    { name: '自然声景', icon: '🌾', gradient: 'from-green-400 to-emerald-500' },
  ];

  const startRecording = () => {
    setIsRecording(true);
    setRecordingTime(0);
    const timer = setInterval(() => {
      setRecordingTime((t) => t + 1);
    }, 1000);
    setTimeout(() => {
      clearInterval(timer);
      setIsRecording(false);
      setHasRecording(true);
    }, 3000);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-full bg-gradient-to-b from-white via-amber-50/30 to-orange-50/50">
      <div className="px-6 py-8 space-y-6">
        {/* Verification Status */}
        {verified ? (
          <div className="relative overflow-hidden bg-gradient-to-r from-green-500 to-emerald-600 rounded-2xl p-5 shadow-xl">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16" />
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full -ml-12 -mb-12" />
            <div className="relative flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center shrink-0">
                <CheckCircle className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="text-white mb-1">已完成认证</h3>
                <p className="text-sm text-white/90">
                  你可以录制并上传声音档案，经审核后即可发布
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="relative overflow-hidden bg-gradient-to-r from-amber-500 to-orange-600 rounded-2xl p-5 shadow-xl">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16" />
            <div className="relative flex items-start gap-4">
              <AlertCircle className="w-6 h-6 text-white shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="text-white mb-1">等待认证</h3>
                <p className="text-sm text-white/90 mb-3">
                  完成村民身份认证后即可录制声音档案
                </p>
                <button className="text-sm text-amber-700 bg-white rounded-full px-5 py-2 hover:bg-white/90 transition-all shadow-md">
                  前往认证
                </button>
              </div>
            </div>
          </div>
        )}

      {step === 'record' ? (
        /* Recording Interface */
        <>
          <div className="relative overflow-hidden bg-white rounded-3xl p-8 shadow-2xl shadow-amber-200/50">
            {/* Decorative elements */}
            <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-br from-amber-100/40 to-orange-100/40 rounded-full blur-3xl -mr-20 -mt-20" />
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-gradient-to-tr from-orange-100/40 to-amber-100/40 rounded-full blur-3xl -ml-16 -mb-16" />

            {/* Recording Visualizer */}
            <div className="relative mb-8 flex flex-col items-center justify-center py-8">
              {isRecording ? (
                <>
                  <div className="relative w-36 h-36 mb-8">
                    <div className="absolute inset-0 rounded-full bg-red-400/30 animate-ping" />
                    <div className="absolute inset-2 rounded-full bg-red-400/20 animate-pulse" />
                    <div className="relative w-36 h-36 rounded-full bg-gradient-to-br from-red-500 via-red-600 to-rose-600 flex items-center justify-center shadow-2xl shadow-red-500/50">
                      <Mic className="w-16 h-16 text-white drop-shadow-lg" />
                    </div>
                  </div>
                  <div className="text-5xl font-light text-stone-900 mb-3 tracking-wider">{formatTime(recordingTime)}</div>
                  <div className="flex items-center gap-2 text-stone-600">
                    <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    <span className="text-sm">正在录制</span>
                  </div>
                </>
              ) : hasRecording ? (
                <>
                  <div className="relative w-36 h-36 mb-8">
                    <div className="absolute inset-0 rounded-full bg-gradient-to-br from-amber-400/20 to-orange-400/20 blur-xl" />
                    <div className="relative w-36 h-36 rounded-full bg-gradient-to-br from-amber-500 via-orange-500 to-orange-600 flex items-center justify-center shadow-2xl shadow-amber-500/50">
                      <Play className="w-16 h-16 text-white ml-2 drop-shadow-lg" />
                    </div>
                  </div>
                  <div className="text-5xl font-light text-stone-900 mb-3 tracking-wider">{formatTime(recordingTime)}</div>
                  <div className="flex items-center gap-2 text-green-700">
                    <CheckCircle className="w-4 h-4" />
                    <span className="text-sm">录制完成</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="relative w-36 h-36 mb-8">
                    <div className="absolute inset-0 rounded-full bg-gradient-to-br from-stone-100 to-stone-200 blur-xl" />
                    <div className="relative w-36 h-36 rounded-full bg-gradient-to-br from-stone-50 to-stone-100 border-4 border-stone-200 flex items-center justify-center shadow-xl">
                      <Mic className="w-16 h-16 text-stone-400" />
                    </div>
                  </div>
                  <div className="text-sm text-stone-500">轻触下方按钮开始录制</div>
                </>
              )}
            </div>

            {/* Recording Controls */}
            <div className="relative space-y-3">
              {!isRecording && !hasRecording && (
                <button
                  onClick={startRecording}
                  disabled={!verified}
                  className="w-full bg-gradient-to-r from-amber-600 via-orange-600 to-orange-700 text-white rounded-2xl py-5 flex items-center justify-center gap-3 hover:from-amber-700 hover:via-orange-700 hover:to-orange-800 transition-all shadow-xl shadow-amber-500/30 hover:shadow-2xl hover:shadow-amber-500/40 hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Mic className="w-6 h-6" />
                  <span className="text-lg">开始录制</span>
                </button>
              )}

              {isRecording && (
                <button
                  onClick={() => {
                    setIsRecording(false);
                    setHasRecording(true);
                  }}
                  className="w-full bg-gradient-to-r from-red-600 via-red-700 to-rose-700 text-white rounded-2xl py-5 flex items-center justify-center gap-3 hover:from-red-700 hover:via-red-800 hover:to-rose-800 transition-all shadow-xl shadow-red-500/30 hover:shadow-2xl hover:shadow-red-500/40 hover:scale-[1.02]"
                >
                  <Square className="w-6 h-6 fill-current" />
                  <span className="text-lg">停止录制</span>
                </button>
              )}

              {hasRecording && !isRecording && (
                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => {
                      setHasRecording(false);
                      setRecordingTime(0);
                    }}
                    className="border-2 border-stone-300 text-stone-700 rounded-2xl py-5 hover:bg-stone-50 hover:border-stone-400 transition-all shadow-lg hover:shadow-xl"
                  >
                    重新录制
                  </button>
                  <button
                    onClick={() => setStep('details')}
                    className="bg-gradient-to-r from-amber-600 to-orange-600 text-white rounded-2xl py-5 hover:from-amber-700 hover:to-orange-700 transition-all shadow-lg shadow-amber-500/30 hover:shadow-xl hover:shadow-amber-500/40"
                  >
                    下一步
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Guidelines */}
          <div className="relative overflow-hidden bg-gradient-to-br from-blue-500 to-cyan-600 rounded-2xl p-6 shadow-xl">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16" />
            <div className="relative">
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="w-5 h-5 text-white" />
                <h4 className="text-white">录制建议</h4>
              </div>
              <ul className="text-sm text-white/95 space-y-2.5">
                <li className="flex items-start gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-white/80 mt-2 shrink-0" />
                  <span>选择安静的环境，减少背景噪音干扰</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-white/80 mt-2 shrink-0" />
                  <span>清晰讲述声音的来源和文化背景</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-white/80 mt-2 shrink-0" />
                  <span>方言录制建议包含日常对话或传统表达</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-white/80 mt-2 shrink-0" />
                  <span>优质内容将获得更多收听和收益</span>
                </li>
              </ul>
            </div>
          </div>
        </>
      ) : (
        /* Details Form */
        <div className="relative overflow-hidden bg-white rounded-3xl p-8 shadow-2xl shadow-amber-200/50">
          {/* Decorative elements */}
          <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-br from-amber-100/40 to-orange-100/40 rounded-full blur-3xl -mr-20 -mt-20" />

          <div className="relative space-y-6">
            <div>
              <label className="block text-sm text-stone-700 mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                声音标题
              </label>
              <input
                type="text"
                placeholder="例如：维吾尔族老人讲述葡萄沟往事"
                className="w-full border-2 border-stone-200 rounded-2xl px-5 py-4 focus:outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-100 transition-all shadow-sm hover:shadow-md"
              />
            </div>

            <div>
              <label className="block text-sm text-stone-700 mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                选择分类
              </label>
              <div className="grid grid-cols-3 gap-3">
                {categories.map((cat) => (
                  <button
                    key={cat.name}
                    onClick={() => setSelectedCategory(cat.name)}
                    className={`relative overflow-hidden text-sm px-4 py-4 rounded-2xl border-2 transition-all ${
                      selectedCategory === cat.name
                        ? 'border-transparent shadow-xl scale-105'
                        : 'border-stone-200 hover:border-stone-300 shadow-sm hover:shadow-md'
                    }`}
                  >
                    {selectedCategory === cat.name && (
                      <div className={`absolute inset-0 bg-gradient-to-br ${cat.gradient} opacity-90`} />
                    )}
                    <div className="relative">
                      <div className={`text-2xl mb-2 ${selectedCategory === cat.name ? 'drop-shadow-lg' : ''}`}>
                        {cat.icon}
                      </div>
                      <div className={selectedCategory === cat.name ? 'text-white' : 'text-stone-700'}>
                        {cat.name}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm text-stone-700 mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                内容描述
              </label>
              <textarea
                placeholder="讲述声音的来源、背景故事或文化意义..."
                rows={5}
                className="w-full border-2 border-stone-200 rounded-2xl px-5 py-4 focus:outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-100 resize-none transition-all shadow-sm hover:shadow-md"
              />
            </div>

            <div>
              <label className="block text-sm text-stone-700 mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                地点
              </label>
              <input
                type="text"
                defaultValue="吐峪沟"
                className="w-full border-2 border-stone-200 rounded-2xl px-5 py-4 focus:outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-100 transition-all shadow-sm hover:shadow-md"
              />
            </div>

            <div className="flex gap-4 pt-4">
              <button
                onClick={() => setStep('record')}
                className="flex-1 border-2 border-stone-300 text-stone-700 rounded-2xl py-5 hover:bg-stone-50 hover:border-stone-400 transition-all shadow-lg hover:shadow-xl"
              >
                返回
              </button>
              <button className="flex-1 bg-gradient-to-r from-amber-600 via-orange-600 to-orange-700 text-white rounded-2xl py-5 flex items-center justify-center gap-2 hover:from-amber-700 hover:via-orange-700 hover:to-orange-800 transition-all shadow-xl shadow-amber-500/30 hover:shadow-2xl hover:shadow-amber-500/40 hover:scale-[1.02]">
                <Upload className="w-5 h-5" />
                <span>提交审核</span>
              </button>
            </div>

            <p className="text-xs text-stone-500 text-center pt-2">
              提交后将由专业团队审核，审核通过后即可发布
            </p>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
