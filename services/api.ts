import axios from 'axios';
import { HomeData, SearchResult, VideoDetail, AuthResponse, User, Category } from '../types';

// Base URL from the prompt - updated to HTTPS to avoid mixed content errors
const API_BASE_URL = 'https://bycurry.zeabur.app/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 20000, // Increased timeout to 20s as backend scrapes multiple sources
});

export const fetchHomeData = async (): Promise<HomeData> => {
  const response = await api.get('/home/trending');
  return response.data.data;
};

export const fetchVideos = async (params: {
  t?: string | number; // Type ID
  pg?: number;
  wd?: string; // Keyword
  year?: string;
}): Promise<SearchResult> => {
  const response = await api.get('/videos', { params });
  return response.data.data;
};

export const fetchVideoDetail = async (id: string | number): Promise<VideoDetail> => {
  const response = await api.get(`/detail/${id}`);
  return response.data.data;
};

export const fetchCategories = async (): Promise<Category[]> => {
  try {
    const response = await api.get('/categories');
    return response.data.data || [];
  } catch (error) {
    console.error("Failed to fetch categories", error);
    return [];
  }
};

// Auth
export const login = async (username: string, password: string): Promise<User> => {
  const response = await api.post<AuthResponse>('/auth/login', { username, password });
  if (response.data.code !== 200) throw new Error(response.data.message);
  return response.data.data;
};

export const register = async (username: string, password: string): Promise<User> => {
  const response = await api.post<AuthResponse>('/auth/register', { username, password });
  if (response.data.code !== 200) throw new Error(response.data.message);
  return response.data.data;
};

export const fetchHistory = async (username: string): Promise<any[]> => {
  const response = await api.get('/user/history', { params: { username } });
  return response.data.data;
};

export const saveHistory = async (payload: {
  username: string;
  video: { id: string | number; title: string; poster: string; type: string };
  episodeIndex: number;
  progress: number;
}) => {
  await api.post('/user/history', payload);
};