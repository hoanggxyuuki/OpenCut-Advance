// Simple media utilities using browser APIs instead of FFmpeg
// This avoids Next.js module resolution issues with FFmpeg

export const generateThumbnail = async (
  videoFile: File,
  timeInSeconds: number = 1
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      reject(new Error('Canvas context not available'));
      return;
    }
    
    video.addEventListener('loadedmetadata', () => {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      video.currentTime = Math.min(timeInSeconds, video.duration);
    });
    
    video.addEventListener('seeked', () => {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(URL.createObjectURL(blob));
        } else {
          reject(new Error('Failed to generate thumbnail'));
        }
      }, 'image/jpeg', 0.8);
    });
    
    video.addEventListener('error', () => {
      reject(new Error('Error loading video'));
    });
    
    video.src = URL.createObjectURL(videoFile);
    video.muted = true;
    video.preload = 'metadata';
  });
};

export const getVideoInfo = async (videoFile: File): Promise<{
  duration: number;
  width: number;
  height: number;
  fps: number;
}> => {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    
    video.addEventListener('loadedmetadata', () => {
      resolve({
        duration: video.duration,
        width: video.videoWidth,
        height: video.videoHeight,
        fps: 30 // Default fps, can't easily get from browser API
      });
    });
    
    video.addEventListener('error', () => {
      reject(new Error('Error loading video'));
    });
    
    video.src = URL.createObjectURL(videoFile);
    video.muted = true;
    video.preload = 'metadata';
  });
};

export const getAudioInfo = async (audioFile: File): Promise<{
  duration: number;
}> => {
  return new Promise((resolve, reject) => {
    const audio = document.createElement('audio');
    
    audio.addEventListener('loadedmetadata', () => {
      resolve({
        duration: audio.duration
      });
    });
    
    audio.addEventListener('error', () => {
      reject(new Error('Error loading audio'));
    });
    
    audio.src = URL.createObjectURL(audioFile);
    audio.preload = 'metadata';
  });
};

// These FFmpeg-based functions are not available in browser-only mode
// They would require server-side processing or WebAssembly FFmpeg
export const trimVideo = async (
  videoFile: File,
  startTime: number,
  endTime: number,
  onProgress?: (progress: number) => void
): Promise<Blob> => {
  throw new Error('Video trimming is not available in browser-only mode');
};

export const convertToWebM = async (
  videoFile: File,
  onProgress?: (progress: number) => void
): Promise<Blob> => {
  throw new Error('Video conversion is not available in browser-only mode');
};

export const extractAudio = async (
  videoFile: File,
  format: 'mp3' | 'wav' = 'mp3'
): Promise<Blob> => {
  throw new Error('Audio extraction is not available in browser-only mode');
};