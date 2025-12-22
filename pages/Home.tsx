import React, { useEffect, useState } from 'react';
import { fetchHomeData } from '../services/api';
import { HomeData } from '../types';
import VideoCard from '../components/VideoCard';
import { Loader2, TrendingUp, Film, Tv } from 'lucide-react';

const Home = () => {
  const [data, setData] = useState<HomeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const result = await fetchHomeData();
        setData(result);
      } catch (err) {
        console.error("Home fetch error:", err);
        setError('无法加载首页数据，请稍后重试');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin text-primary" size={40} /></div>;
  if (error) return <div className="flex h-screen items-center justify-center text-red-500">{error}</div>;
  if (!data) return null;

  return (
    <div className="pb-20">
      {/* Banner / Featured */}
      <section className="relative h-[50vh] w-full overflow-hidden">
        {data.banners[0] && (
            <div className="w-full h-full relative">
                <img 
                    src={data.banners[0].backdrop || data.banners[0].poster} 
                    className="w-full h-full object-cover object-top"
                    alt="Banner"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-darker via-darker/50 to-transparent" />
                <div className="absolute bottom-4 left-4 right-4">
                    <span className="bg-primary text-white text-xs px-2 py-1 rounded mb-2 inline-block">热门推荐</span>
                    <h1 className="text-3xl font-bold text-white mb-1 shadow-lg">{data.banners[0].title}</h1>
                    <p className="text-sm text-gray-300 line-clamp-2">{data.banners[0].remarks} • {data.banners[0].type}</p>
                </div>
            </div>
        )}
      </section>

      {/* Sections */}
      <div className="px-4 -mt-6 relative z-10 space-y-8">
        
        {/* Movies */}
        <section>
            <div className="flex items-center gap-2 mb-4">
                <Film className="text-primary" size={20} />
                <h2 className="text-xl font-bold text-white">热门电影</h2>
            </div>
            <div className="grid grid-cols-3 gap-3">
                {data.movies.map(movie => <VideoCard key={movie.id} video={movie} />)}
            </div>
        </section>

        {/* TV Shows */}
        <section>
            <div className="flex items-center gap-2 mb-4">
                <Tv className="text-primary" size={20} />
                <h2 className="text-xl font-bold text-white">热门电视剧</h2>
            </div>
            <div className="grid grid-cols-3 gap-3">
                {data.tvs.map(tv => <VideoCard key={tv.id} video={tv} />)}
            </div>
        </section>

         {/* Animes */}
         <section>
            <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="text-primary" size={20} />
                <h2 className="text-xl font-bold text-white">动漫精选</h2>
            </div>
            <div className="grid grid-cols-3 gap-3">
                {data.animes.map(anime => <VideoCard key={anime.id} video={anime} />)}
            </div>
        </section>
      </div>
    </div>
  );
};

export default Home;