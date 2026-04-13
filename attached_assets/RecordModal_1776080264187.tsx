import { useState } from 'react';
import { X, Mic, Square, Play, Upload, AlertCircle, CheckCircle } from 'lucide-react';

interface RecordModalProps {
  onClose: () => void;
}

export function RecordModal({ onClose }: RecordModalProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [hasRecording, setHasRecording] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [verified] = useState(true);
  const [step, setStep] = useState<'record' | 'details'>('record');

  const categories = [
    { name: '方言', icon: '💬' },
    { name: '传统工艺', icon: '🔨' },
    { name: '工具声音', icon: '⚙️' },
    { name: '民歌小调', icon: '🎵' },
    { name: '故事传说', icon: '📖' },
    { name: '自然声景', icon: '🌾' },
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
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end z-50 animate-in fade-in">
      <div className="w-full max-w-md mx-auto bg-white rounded-t-3xl shadow-2xl animate-in slide-in-from-bottom">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100">
          <h2 className="text-lg text-stone-900">录制声音档案</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-stone-100 flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5 text-stone-500" />
          </button>
        </div>

        <div className="max-h-[80vh] overflow-auto">
          {/* Verification Status */}
          <div className="px-6 pt-6 pb-4">
            {verified ? (
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                    <CheckCircle className="w-5 h-5 text-green-700" />
                  </div>
                  <div>
                    <h3 className="text-sm text-green-900 mb-1">已完成认证</h3>
                    <p className="text-xs text-green-700">
                      你可以录制并上传声音档案，经审核后即可发布
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-sm text-amber-900 mb-1">等待认证</h3>
                    <p className="text-xs text-amber-700 mb-3">
                      完成村民身份认证后即可录制声音档案
                    </p>
                    <button className="text-xs text-amber-700 bg-white border border-amber-300 rounded-full px-4 py-2 hover:bg-amber-50 transition-colors">
                      前往认证
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {step === 'record' ? (
            /* Recording Interface */
            <div className="px-6 pb-6">
              {/* Recording Visualizer */}
              <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl p-12 mb-6 flex flex-col items-center justify-center">
                {isRecording ? (
                  <>
                    <div className="relative w-28 h-28 mb-6">
                      <div className="absolute inset-0 rounded-full bg-red-500/20 animate-ping" />
                      <div className="relative w-28 h-28 rounded-full bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center shadow-lg">
                        <Mic className="w-12 h-12 text-white" />
                      </div>
                    </div>
                    <div className="text-4xl text-stone-900 mb-2">{formatTime(recordingTime)}</div>
                    <div className="text-sm text-stone-600">正在录制...</div>
                  </>
                ) : hasRecording ? (
                  <>
                    <div className="w-28 h-28 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg mb-6">
                      <Play className="w-12 h-12 text-white ml-1" />
                    </div>
                    <div className="text-4xl text-stone-900 mb-2">{formatTime(recordingTime)}</div>
                    <div className="text-sm text-green-700">录制完成</div>
                  </>
                ) : (
                  <>
                    <div className="w-28 h-28 rounded-full bg-white border-4 border-stone-200 flex items-center justify-center shadow-md mb-6">
                      <Mic className="w-12 h-12 text-stone-400" />
                    </div>
                    <div className="text-sm text-stone-500">轻触下方按钮开始录制</div>
                  </>
                )}
              </div>

              {/* Recording Controls */}
              <div className="space-y-3">
                {!isRecording && !hasRecording && (
                  <button
                    onClick={startRecording}
                    disabled={!verified}
                    className="w-full bg-gradient-to-r from-amber-600 to-orange-600 text-white rounded-xl py-4 flex items-center justify-center gap-2 hover:from-amber-700 hover:to-orange-700 transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Mic className="w-5 h-5" />
                    开始录制
                  </button>
                )}

                {isRecording && (
                  <button
                    onClick={() => {
                      setIsRecording(false);
                      setHasRecording(true);
                    }}
                    className="w-full bg-gradient-to-r from-red-600 to-red-700 text-white rounded-xl py-4 flex items-center justify-center gap-2 hover:from-red-700 hover:to-red-800 transition-all shadow-md hover:shadow-lg"
                  >
                    <Square className="w-5 h-5" />
                    停止录制
                  </button>
                )}

                {hasRecording && !isRecording && (
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => {
                        setHasRecording(false);
                        setRecordingTime(0);
                      }}
                      className="border-2 border-stone-300 text-stone-700 rounded-xl py-4 hover:bg-stone-50 transition-colors"
                    >
                      重新录制
                    </button>
                    <button
                      onClick={() => setStep('details')}
                      className="bg-gradient-to-r from-amber-600 to-orange-600 text-white rounded-xl py-4 hover:from-amber-700 hover:to-orange-700 transition-all shadow-md"
                    >
                      下一步
                    </button>
                  </div>
                )}
              </div>

              {/* Guidelines */}
              <div className="mt-6 bg-blue-50 border border-blue-100 rounded-xl p-4">
                <h4 className="text-sm text-blue-900 mb-2">录制建议</h4>
                <ul className="text-xs text-blue-800 space-y-1.5">
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600 mt-0.5">•</span>
                    <span>选择安静的环境，减少背景噪音干扰</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600 mt-0.5">•</span>
                    <span>清晰讲述声音的来源和文化背景</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600 mt-0.5">•</span>
                    <span>方言录制建议包含日常对话或传统表达</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600 mt-0.5">•</span>
                    <span>优质内容将获得更多收听和收益</span>
                  </li>
                </ul>
              </div>
            </div>
          ) : (
            /* Details Form */
            <div className="px-6 pb-6 space-y-5">
              <div>
                <label className="block text-sm text-stone-700 mb-2">声音标题</label>
                <input
                  type="text"
                  placeholder="例如：维吾尔族老人讲述葡萄沟往事"
                  className="w-full border-2 border-stone-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm text-stone-700 mb-3">选择分类</label>
                <div className="grid grid-cols-3 gap-2">
                  {categories.map((cat) => (
                    <button
                      key={cat.name}
                      onClick={() => setSelectedCategory(cat.name)}
                      className={`text-sm px-3 py-3 rounded-xl border-2 transition-all ${
                        selectedCategory === cat.name
                          ? 'bg-gradient-to-br from-amber-50 to-orange-50 border-amber-500 text-amber-900 shadow-md'
                          : 'border-stone-200 text-stone-700 hover:border-amber-300 hover:bg-amber-50/50'
                      }`}
                    >
                      <div className="text-xl mb-1">{cat.icon}</div>
                      <div>{cat.name}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm text-stone-700 mb-2">内容描述</label>
                <textarea
                  placeholder="讲述声音的来源、背景故事或文化意义..."
                  rows={4}
                  className="w-full border-2 border-stone-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-amber-500 resize-none transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm text-stone-700 mb-2">地点</label>
                <input
                  type="text"
                  defaultValue="吐峪沟"
                  className="w-full border-2 border-stone-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setStep('record')}
                  className="flex-1 border-2 border-stone-300 text-stone-700 rounded-xl py-4 hover:bg-stone-50 transition-colors"
                >
                  返回
                </button>
                <button className="flex-1 bg-gradient-to-r from-amber-600 to-orange-600 text-white rounded-xl py-4 flex items-center justify-center gap-2 hover:from-amber-700 hover:to-orange-700 transition-all shadow-md hover:shadow-lg">
                  <Upload className="w-5 h-5" />
                  提交审核
                </button>
              </div>

              <p className="text-xs text-stone-500 text-center">
                提交后将由专业团队审核，审核通过后即可发布
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
