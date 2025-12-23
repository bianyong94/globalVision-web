import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Home, Search, User } from 'lucide-react';

const BottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { icon: Home, label: '首页', path: '/' },
    { icon: Search, label: '发现', path: '/search' },
    { icon: User, label: '我的', path: '/profile' },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-surface/95 backdrop-blur-md border-t border-white/10 pb-safe pt-2 px-6 h-16 z-50 flex justify-between items-center">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = location.pathname === item.path;
        return (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            className={`flex flex-col items-center justify-center space-y-1 w-full ${
              isActive ? 'text-primary' : 'text-gray-400'
            }`}
          >
            <Icon size={24} strokeWidth={isActive ? 2.5 : 2} />
            <span className="text-xs font-medium">{item.label}</span>
          </button>
        );
      })}
    </div>
  );
};

export default BottomNav;