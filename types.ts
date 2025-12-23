export interface VideoSummary {
  id: number | string;
  title: string;
  type: string;
  poster: string;
  backdrop?: string;
  remarks: string;
  year: number | string;
  rating: number | string;
  date?: string;
  overview?: string;
}

export interface Episode {
  name: string;
  link: string;
}

export interface VideoDetail extends VideoSummary {
  area: string;
  director: string;
  actors: string;
  episodes: Episode[];
}

export interface HomeData {
  banners: VideoSummary[];
  movies: VideoSummary[];
  tvs: VideoSummary[];
  animes: VideoSummary[];
}

export interface SearchResult {
  list: VideoSummary[];
  total: number;
  pagecount: number;
  source: string;
}

export interface Category {
  type_id: number;
  type_name: string;
}

export interface User {
  id: string;
  username: string;
  history: any[];
}

export interface AuthResponse {
  code: number;
  message: string;
  data: User;
}

export interface HistoryItem extends VideoSummary {
  episodeIndex: number;
  progress: number;
  viewedAt: string;
}