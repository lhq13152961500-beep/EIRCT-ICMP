import { useState } from 'react';
import { ArrowLeft, Mic, User } from 'lucide-react';
import { Record } from './Record';
import { Profile } from './Profile';

interface RecordPageProps {
  onBack: () => void;
}

export function RecordPage({ onBack }: RecordPageProps) {
  const [activeTab, setActiveTab] = useState<'record' | 'profile'>('record');

  return (
    <div className="size-full flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-stone-100 px-6 py-4 shrink-0 shadow-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="w-9 h-9 rounded-full hover:bg-stone-100 flex items-center justify-center transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-stone-700" />
          </button>
          <h1 className="text-lg text-stone-900">
            {activeTab === 'record' ? '录制声音' : '我的'}
          </h1>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-auto bg-gradient-to-b from-white to-stone-50">
        {activeTab === 'record' && <Record />}
        {activeTab === 'profile' && <Profile />}
      </main>

      {/* Bottom Navigation */}
      <nav className="bg-white border-t border-stone-100 px-6 py-3 shrink-0 shadow-lg">
        <div className="flex items-center justify-around">
          <button
            onClick={() => setActiveTab('record')}
            className={`flex flex-col items-center gap-1 px-6 py-2 transition-all ${
              activeTab === 'record'
                ? 'text-amber-700'
                : 'text-stone-500'
            }`}
          >
            <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
              activeTab === 'record'
                ? 'bg-gradient-to-br from-amber-100 to-orange-100'
                : ''
            }`}>
              <Mic className="w-5 h-5" />
            </div>
            <span className="text-xs">声音</span>
          </button>

          <button
            onClick={() => setActiveTab('profile')}
            className={`flex flex-col items-center gap-1 px-6 py-2 transition-all ${
              activeTab === 'profile'
                ? 'text-amber-700'
                : 'text-stone-500'
            }`}
          >
            <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
              activeTab === 'profile'
                ? 'bg-gradient-to-br from-amber-100 to-orange-100'
                : ''
            }`}>
              <User className="w-5 h-5" />
            </div>
            <span className="text-xs">我的</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
