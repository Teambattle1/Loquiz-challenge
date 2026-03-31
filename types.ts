
export interface PlayerAnswer {
  taskId: string;
  isCorrect?: boolean;
  score?: number;
  raw?: any; // Store full raw answer object for debugging/inspection
}

export interface PlayerResult {
  position: number;
  name: string;
  score: number;
  correctAnswers?: number;
  incorrectAnswers?: number;
  isFinished?: boolean;
  odometer?: number;
  color?: string;
  startTime?: number;
  finishTime?: number;
  answers?: PlayerAnswer[];
}

export interface GameInfo {
  name: string;
  intro?: string;
  outro?: string;
  logoUrl?: string;
  tasks?: any[]; // Embedded tasks from the game definition
}

export interface GameListItem {
  id: string;
  name: string;
  created?: string | number;
  isPlayable?: boolean;
  status?: string | number;
}

export interface GameTask {
  id: string;
  title: string;
  type: string;
  intro?: string;
  shortIntro?: string;
  content?: string; // Added field for v4 task definition
  points?: number;
  latitude?: number;
  longitude?: number;
  radius?: number;
  raw?: any; 
}

export interface Question {
  questionText: string;
  options: string[];
  correctAnswerIndex: number;
}

export interface GamePhoto {
  id: string;
  url: string;
  thumbnailUrl?: string;
  teamName?: string;
  taskTitle?: string;
  timestamp?: string | number;
}