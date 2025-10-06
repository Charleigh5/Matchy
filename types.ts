
export interface ImageRecord {
  id: string;
  url: string;
  names: string[];
}

export interface ImageCollection {
  id: string;
  name: string;
  images: ImageRecord[];
  complexity: number;
}

export enum GameStatus {
  IDLE = 'IDLE',
  LOADING = 'LOADING',
  PLAYING = 'PLAYING',
  FINISHED = 'FINISHED',
}
