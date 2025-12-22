import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchVideoDetail, saveHistory } from '../services/api';
import { VideoDetail } from '../types';
import HlsPlayer from '../components/HlsPlayer';
import { useAuth } from '../context/AuthContext';
import { Loader2, ChevronLeft, Calendar, User, AlignLeft } from 'lucide-react';

const Detail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [detail, setDetail] = useState<VideoDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentEpIndex, setCurrentEpIndex] = useState(0);

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      setLoading(true);
      try {
        const data = await fetchVideoDetail(id);
        setDetail(data);
        
        // Auto-save history if logged in
        if (user && data) {
           saveHistory({
             username: user.username,
             video: {
               id: data.id,
               title: data.title,
               poster: data.poster,
               type: data.type
             },
             episodeIndex: 0,
             progress: 0
           });
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id, user]);

  if (loading) return <div className="h-screen bg-black flex items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>;
  if (!detail) return <div className="h-screen bg-black flex items-center justify-center text-white">资源不存在</div>;

  const currentEp = detail.episodes[currentEpIndex];

  return (
    <div className="min-h-screen bg-darker pb-10">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-darker/80 backdrop-blur p-4 flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="p-1 rounded-full hover:bg-white/10">
            <ChevronLeft className="text-white" />
        </button>
        <h1 className="text-white font-medium truncate flex-1">{detail.title}</h1>
      </div>

      {/* Player */}
      <div className="w-full bg-black sticky top-14 z-20">
        {currentEp ? (
            <HlsPlayer src={currentEp.link} poster={detail.backdrop || detail.poster} />
        ) : (
            <div className="aspect-video bg-gray-900 flex items-center justify-center text-gray-500">
                暂无播放源
            </div>
        )}
      </div>

      <div className="p-4 space-y-6">
        {/* Info */}
        <div>
            <div className="flex justify-between items-start mb-2">
                <h2 className="text-2xl font-bold text-white">{detail.title}</h2>
                <span className="text-primary font-bold text-lg">{detail.rating}</span>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-400 mb-3">
                <span className="flex items-center gap-1"><Calendar size={14}/> {detail.year}</span>
                <span>{detail.area}</span>
                <span>{detail.type}</span>
            </div>
            
            <p className="text-sm text-gray-300 leading-relaxed line-clamp-3">
                {detail.overview || '暂无简介'}
            </p>
        </div>

        {/* Episodes */}
        <div>
            <div className="flex items-center gap-2 mb-3 border-l-4 border-primary pl-2">
                <AlignLeft size={18} className="text-white" />
                <h3 className="font-bold text-white">选集 ({detail.episodes.length})</h3>
            </div>
            <div className="grid grid-cols-4 gap-2 max-h-60 overflow-y-auto pr-1">
                {detail.episodes.map((ep, idx) => (
                    <button
                        key={idx}
                        onClick={() => setCurrentEpIndex(idx)}
                        className={`text-xs py-3 rounded-md transition-colors truncate px-1 ${
                            idx === currentEpIndex 
                            ? 'bg-primary text-white font-medium' 
                            : 'bg-surface text-gray-300 hover:bg-gray-700'
                        }`}
                    >
                        {ep.name}
                    </button>
                ))}
            </div>
        </div>

        {/* Cast */}
        {detail.actors && (
            <div>
                 <div className="flex items-center gap-2 mb-3 border-l-4 border-primary pl-2">
                    <User size={18} className="text-white" />
                    <h3 className="font-bold text-white">主演</h3>
                </div>
                <p className="text-sm text-gray-400">{detail.actors}</p>
                <p className="text-sm text-gray-500 mt-1">导演: {detail.director}</p>
            </div>
        )}
      </div>
    </div>
  );
};

export default Detail;