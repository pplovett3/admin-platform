export interface VoiceConfig {
  provider?: string;
  voice?: string;
  rate?: number;
  style?: string;
}

export interface SceneAction {
  type: 'camera.focus' | 'visibility.set' | 'highlight.show' | 'highlight.hide' | 'annotation.show' | 'annotation.hide' | 'animation.play' | 'pointer.point';
  target?: { nodeKey?: string } | { kind: 'image.bbox', imageId: string, bboxIndex: number };
  items?: { nodeKey: string; visible: boolean }[];
  ids?: string[];
  animationId?: string;
  startTime?: number;
  endTime?: number;
  duration?: number;
  easing?: string;
}

export interface SegmentItem {
  id: string;
  type: 'talk' | 'image.explain' | 'scene.action';
  say?: string;
  tts?: VoiceConfig & { rate?: number };
  audio?: { url: string; duration?: number; hash?: string };
  subtitles?: { text: string; offset: number }[];
  image?: { id?: string; src: string; title?: string; bbox?: [number, number, number, number] };
  actions?: SceneAction[];
}

export interface Segment {
  id: string;
  title: string;
  mode: 'sequence' | 'parallel';
  items: SegmentItem[];
}

export interface AICourse {
  _id?: string;
  version: string;
  title: string;
  theme?: string;
  audience?: string;
  durationTarget?: number;
  language?: string;
  voice?: VoiceConfig;
  coursewareId: string;
  coursewareVersion?: number;
  modelHash?: string;
  outline?: Segment[];
  assets?: { images?: any[]; audio?: any[] };
  status?: 'draft' | 'published';
  courseVersion?: number;
  createdAt?: string;
  updatedAt?: string;
}





