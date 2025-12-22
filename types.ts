export interface Episode {
  name: string
  link: string
}

// export interface VideoResource {
//   id: number | string;
//   title: string;
//   type?: string;
//   poster: string;
//   backdrop?: string;
//   rating?: string;
//   date?: string;
//   overview?: string;
//   genres?: string[];
//   remarks?: string;
//   area?: string;
//   year?: string;
//   director?: string;
//   actors?: string;
//   episodes?: Episode[];
// }

export interface HomeData {
  banners: VideoResource[]
  latest: VideoResource[]
}

export interface ApiResponse<T> {
  code: number
  message: string
  data: T
}

export type AppTab = "home" | "search" | "profile"

export interface UserHistory {
  videoId: string
  videoName: string
  pic: string
  timestamp: number
  type?: string
}

export interface VideoResource {
  id: number | string
  title: string
  type: string
  poster: string
  backdrop?: string
  remarks?: string
  year?: string
  area?: string
  rating?: string
  overview?: string
  episodes?: Episode[]
  director?: string
  actors?: string
}

export interface Category {
  type_id: number
  type_name: string
}

export interface HomeData {
  banners: VideoResource[]
  movies: VideoResource[]
  tvs: VideoResource[]
  animes: VideoResource[]
}
