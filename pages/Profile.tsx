import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { login, register, fetchHistory } from '../services/api';
import { HistoryItem } from '../types';
import VideoCard from '../components/VideoCard';
import { LogOut, User as UserIcon, History, PlayCircle } from 'lucide-react';

const Profile = () => {
  const { user, loginUser, logoutUser, isAuthenticated } = useAuth();
  
  // Auth Form State
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Data State
  const [history, setHistory] = useState<HistoryItem[]>([]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      let userData;
      if (isLoginMode) {
        userData = await login(username, password);
      } else {
        userData = await register(username, password);
      }
      loginUser(userData);
    } catch (err: any) {
      setError(err.message || '操作失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated && user) {
      fetchHistory(user.username).then(setHistory).catch(console.error);
    }
  }, [isAuthenticated, user]);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-darker flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <h1 className="text-3xl font-bold text-primary mb-2 text-center">StreamHub</h1>
          <p className="text-gray-400 text-center mb-8">海量高清影视免费看</p>
          
          <div className="bg-surface p-6 rounded-xl border border-white/5">
            <h2 className="text-xl text-white font-bold mb-6 text-center">
              {isLoginMode ? '账号登录' : '注册新账号'}
            </h2>
            
            <form onSubmit={handleAuth} className="space-y-4">
              <div>
                <input
                  type="text"
                  placeholder="用户名"
                  required
                  className="w-full bg-black/30 border border-white/10 rounded-lg px-4 py-3 text-white focus:border-primary outline-none"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                />
              </div>
              <div>
                <input
                  type="password"
                  placeholder="密码"
                  required
                  className="w-full bg-black/30 border border-white/10 rounded-lg px-4 py-3 text-white focus:border-primary outline-none"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                />
              </div>

              {error && <p className="text-red-500 text-sm text-center">{error}</p>}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-primary hover:bg-red-700 text-white font-bold py-3 rounded-lg transition-colors disabled:opacity-50"
              >
                {loading ? '处理中...' : (isLoginMode ? '立即登录' : '立即注册')}
              </button>
            </form>

            <div className="mt-6 text-center">
              <button 
                onClick={() => setIsLoginMode(!isLoginMode)}
                className="text-gray-400 text-sm hover:text-white transition-colors"
              >
                {isLoginMode ? '没有账号？去注册' : '已有账号？去登录'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-darker pb-20">
      {/* Header */}
      <div className="bg-surface/50 pt-10 pb-6 px-6 rounded-b-3xl border-b border-white/5">
        <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center text-white text-2xl font-bold shadow-lg">
                {user?.username.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1">
                <h2 className="text-xl text-white font-bold">{user?.username}</h2>
                <p className="text-gray-400 text-xs mt-1">ID: {user?.id}</p>
            </div>
            <button 
                onClick={logoutUser}
                className="p-2 bg-white/10 rounded-full hover:bg-white/20 transition-colors"
            >
                <LogOut size={20} className="text-gray-300" />
            </button>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-6">
        <div className="flex items-center gap-2 mb-4 text-white">
            <History className="text-primary" />
            <h3 className="font-bold text-lg">观看历史</h3>
        </div>

        {history.length > 0 ? (
             <div className="space-y-3">
                {history.map((item, idx) => (
                    <div key={idx} className="flex gap-3 bg-surface p-2 rounded-lg items-center border border-white/5">
                        <img src={item.poster} className="w-16 h-24 object-cover rounded bg-gray-800" alt={item.title} />
                        <div className="flex-1 min-w-0">
                            <h4 className="text-white font-medium truncate">{item.title}</h4>
                            <p className="text-xs text-gray-500 mt-1">{item.type} • {item.viewedAt ? new Date(item.viewedAt).toLocaleDateString() : '刚刚'}</p>
                        </div>
                         <button className="mr-2">
                             <PlayCircle className="text-primary opacity-80" size={28} />
                         </button>
                    </div>
                ))}
             </div>
        ) : (
            <div className="text-center py-10 text-gray-500 bg-surface rounded-xl border border-white/5 border-dashed">
                <p>暂无观看记录</p>
            </div>
        )}
      </div>
    </div>
  );
};

export default Profile;