
import React, { ReactNode } from 'react';
import { Home, Search, User, Moon, Sun } from 'lucide-react';
import { AppTab } from '../types';

interface LayoutProps {
  children: ReactNode;
  activeTab: AppTab;
  onTabChange: (tab: AppTab) => void;
  darkMode: boolean;
  toggleDarkMode: () => void;
}

const Layout: React.FC<LayoutProps> = ({ children, activeTab, onTabChange, darkMode, toggleDarkMode }) => {
  return (
    <div className={`min-h-screen flex flex-col ${darkMode ? 'bg-zinc-950 text-zinc-100' : 'bg-gray-50 text-gray-900'} pb-20`}>
      {/* Header */}
      <header className={`sticky top-0 z-50 px-4 py-3 flex justify-between items-center backdrop-blur-md border-b ${darkMode ? 'bg-zinc-900/80 border-zinc-800' : 'bg-white/80 border-gray-200'}`}>
        <h1 className="text-xl font-bold bg-gradient-to-r from-blue-500 to-indigo-600 bg-clip-text text-transparent">
          Global Vision
        </h1>
        <button 
          onClick={toggleDarkMode}
          className={`p-2 rounded-full transition-colors ${darkMode ? 'hover:bg-zinc-800' : 'hover:bg-gray-100'}`}
        >
          {darkMode ? <Sun size={20} className="text-yellow-400" /> : <Moon size={20} className="text-indigo-600" />}
        </button>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-x-hidden">
        {children}
      </main>

      {/* Bottom Navigation */}
      <nav className={`fixed bottom-0 left-0 right-0 h-16 border-t flex items-center justify-around px-6 z-50 ${darkMode ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-gray-200 shadow-[0_-1px_10px_rgba(0,0,0,0.05)]'}`}>
        <button 
          onClick={() => onTabChange('home')}
          className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'home' ? 'text-blue-500' : darkMode ? 'text-zinc-500' : 'text-gray-400'}`}
        >
          <Home size={22} strokeWidth={activeTab === 'home' ? 2.5 : 2} />
          <span className="text-[10px] font-medium uppercase tracking-wider">首页</span>
        </button>
        <button 
          onClick={() => onTabChange('search')}
          className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'search' ? 'text-blue-500' : darkMode ? 'text-zinc-500' : 'text-gray-400'}`}
        >
          <Search size={22} strokeWidth={activeTab === 'search' ? 2.5 : 2} />
          <span className="text-[10px] font-medium uppercase tracking-wider">搜索</span>
        </button>
        <button 
          onClick={() => onTabChange('profile')}
          className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'profile' ? 'text-blue-500' : darkMode ? 'text-zinc-500' : 'text-gray-400'}`}
        >
          <User size={22} strokeWidth={activeTab === 'profile' ? 2.5 : 2} />
          <span className="text-[10px] font-medium uppercase tracking-wider">我的</span>
        </button>
      </nav>
    </div>
  );
};

export default Layout;
