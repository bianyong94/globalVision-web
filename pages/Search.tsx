import React, { useState, useEffect, useCallback } from 'react';
import { fetchCategories, fetchVideos } from '../services/api';
import { Category, VideoSummary } from '../types';
import VideoCard from '../components/VideoCard';
import { Search as SearchIcon, Loader2, FilterX } from 'lucide-react';

const YEARS = ['全部', '2025', '2024', '2023', '2022', '2021', '2020', '2019', '2010-2018', '2000-2009'];

const SearchPage = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [videos, setVideos] = useState<VideoSummary[]>([]);
  
  // Filters
  const [keyword, setKeyword] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<number | string>(''); 
  const [selectedYear, setSelectedYear] = useState('全部');
  
  const [loading, setLoading] = useState(false);

  // Initialize Categories
  useEffect(() => {
    fetchCategories().then(cats => {
      // If the API returns a complex tree, we might need to flatten or handle it. 
      // Assuming a flat list based on prompt description or simple array.
      setCategories(cats);
    });
  }, []);

  const doSearch = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchVideos({
        wd: keyword,
        t: selectedCategory,
        year: selectedYear,
        pg: 1
      });
      setVideos(res.list);
    } catch (e) {
      console.error(e);
      setVideos([]);
    } finally {
      setLoading(false);
    }
  }, [keyword, selectedCategory, selectedYear]);

  // Debounce search or trigger on filter change
  useEffect(() => {
    const timer = setTimeout(() => {
      doSearch();
    }, 500);
    return () => clearTimeout(timer);
  }, [doSearch]);

  return (
    <div className="min-h-screen bg-darker pb-20 pt-4">
      
      {/* Search Bar */}
      <div className="px-4 mb-4">
        <div className="relative">
          <input
            type="text"
            placeholder="搜索片名、导演、演员..."
            className="w-full bg-surface border border-white/10 text-white rounded-full py-3 pl-12 pr-4 focus:outline-none focus:border-primary transition-colors"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
          />
          <SearchIcon className="absolute left-4 top-3.5 text-gray-400" size={20} />
        </div>
      </div>

      {/* Categories Horizontal Scroll */}
      <div className="px-4 mb-4">
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
            <button
                onClick={() => setSelectedCategory('')}
                className={`px-4 py-1.5 rounded-full text-sm whitespace-nowrap border transition-colors ${
                  selectedCategory === '' 
                  ? 'bg-primary border-primary text-white' 
                  : 'bg-surface border-white/10 text-gray-400'
                }`}
            >
                全部
            </button>
            {categories.map(cat => (
                <button
                    key={cat.type_id}
                    onClick={() => setSelectedCategory(cat.type_id)}
                    className={`px-4 py-1.5 rounded-full text-sm whitespace-nowrap border transition-colors ${
                        selectedCategory === cat.type_id 
                        ? 'bg-primary border-primary text-white' 
                        : 'bg-surface border-white/10 text-gray-400'
                    }`}
                >
                    {cat.type_name}
                </button>
            ))}
        </div>
      </div>

      {/* Year Filter */}
      <div className="px-4 mb-6">
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
            {YEARS.map(year => (
                <button
                    key={year}
                    onClick={() => setSelectedYear(year)}
                    className={`px-3 py-1 rounded text-xs whitespace-nowrap border transition-colors ${
                        selectedYear === year 
                        ? 'bg-white/10 border-white/30 text-white' 
                        : 'bg-transparent border-transparent text-gray-500'
                    }`}
                >
                    {year}
                </button>
            ))}
        </div>
      </div>

      {/* Results */}
      <div className="px-4">
        {loading ? (
            <div className="flex justify-center py-20">
                <Loader2 className="animate-spin text-primary" size={32} />
            </div>
        ) : videos.length > 0 ? (
            <div className="grid grid-cols-3 gap-3">
                {videos.map(v => (
                    <VideoCard key={v.id} video={v} />
                ))}
            </div>
        ) : (
            <div className="flex flex-col items-center justify-center py-20 text-gray-600">
                <FilterX size={48} className="mb-2 opacity-50" />
                <p>未找到相关资源</p>
            </div>
        )}
      </div>
    </div>
  );
};

export default SearchPage;