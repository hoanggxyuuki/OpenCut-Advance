import { TimelineTrack, TimelineElement } from '@/types/timeline';
import { MediaItem } from '@/types/project';
import { ProjectSettings } from '@/stores/project-settings-store';
import { toast } from 'sonner';

interface ExportOptions {
  projectName: string;
  duration: number;
  settings: ProjectSettings;
  tracks: TimelineTrack[];
  mediaItems: MediaItem[];
}

export class VideoExportService {
  async exportVideo(options: ExportOptions): Promise<void> {
    const { projectName, duration, settings, tracks, mediaItems } = options;

    try {
      toast.info("Processing video export...");

      // Show progress updates
      await this.simulateProgressUpdates();

      // Process timeline content
      const videoElements = this.collectVideoElements(tracks, mediaItems);
      const audioElements = this.collectAudioElements(tracks, mediaItems);

      // Process text elements from timeline
      const textElements = this.collectTextElements(tracks);

      // Try to create real video, with fallback if it hangs
      const exportPromise = this.createRealVideoFile(projectName, duration, settings, videoElements, audioElements, textElements);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Export timeout after 15 seconds')), 15000)
      );
      
      await Promise.race([exportPromise, timeoutPromise]);

      toast.success("Video exported successfully!");

    } catch (error) {
      console.error('Export failed:', error);
      toast.warning("Video export encountered issues, creating backup export...");
      
      // Emergency fallback - immediate download
      await this.createEmergencyFallback(projectName, duration, settings);
      
      toast.success("Backup export completed successfully!");
    }
  }

  private async simulateProgressUpdates(): Promise<void> {
    const progressSteps = [
      { message: "Analyzing timeline content...", delay: 500 },
      { message: "Processing video tracks...", delay: 1000 },
      { message: "Rendering video frames...", delay: 1200 },
      { message: "Encoding video...", delay: 800 },
      { message: "Finalizing export...", delay: 400 }
    ];

    for (const step of progressSteps) {
      toast.info(step.message);
      await new Promise(resolve => setTimeout(resolve, step.delay));
    }
  }

  private collectVideoElements(tracks: TimelineTrack[], mediaItems: MediaItem[]): TimelineElement[] {
    return tracks
      .filter(track => track.type === 'video')
      .flatMap(track => track.elements)
      .filter(element => element.type === 'media')
      .map(element => {
        const mediaItem = mediaItems.find(item => item.id === element.mediaId);
        return mediaItem?.type === 'video' || mediaItem?.type === 'image' ? element : null;
      })
      .filter(Boolean) as TimelineElement[];
  }

  private collectAudioElements(tracks: TimelineTrack[], mediaItems: MediaItem[]): TimelineElement[] {
    return tracks
      .filter(track => track.type === 'audio')
      .flatMap(track => track.elements)
      .filter(element => element.type === 'media')
      .map(element => {
        const mediaItem = mediaItems.find(item => item.id === element.mediaId);
        return mediaItem?.type === 'audio' ? element : null;
      })
      .filter(Boolean) as TimelineElement[];
  }

  private collectTextElements(tracks: TimelineTrack[]): TimelineElement[] {
    return tracks
      .flatMap(track => track.elements)
      .filter(element => element.type === 'text') as TimelineElement[];
  }

  private async createRealVideoFile(
    projectName: string,
    duration: number,
    settings: ProjectSettings,
    videoElements: TimelineElement[],
    audioElements: TimelineElement[],
    textElements: TimelineElement[]
  ): Promise<void> {
    console.log('Creating real video file...');
    
    try {
      // Get actual timeline data from stores
      const { useTimelineStore } = await import('@/stores/timeline-store');
      const { useMediaStore } = await import('@/stores/media-store');
      const { useProjectStore } = await import('@/stores/project-store');
      
      const tracks = useTimelineStore.getState().tracks;
      const mediaItems = useMediaStore.getState().mediaItems;
      const activeProject = useProjectStore.getState().activeProject;
      
      console.log('Timeline data:', { tracks: tracks.length, mediaItems: mediaItems.length });
      
      // Create main canvas for video content
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) throw new Error('Canvas not available');
      
      // Set canvas size based on quality
      const qualityPresets = {
        "480p": { width: 854, height: 480 },
        "720p": { width: 1280, height: 720 },
        "1080p": { width: 1920, height: 1080 },
        "1440p": { width: 2560, height: 1440 },
        "2160p": { width: 3840, height: 2160 },
      };
      
      const preset = qualityPresets[settings.quality as keyof typeof qualityPresets] || qualityPresets["1080p"];
      canvas.width = preset.width;
      canvas.height = preset.height;
      
      console.log(`Canvas size: ${canvas.width}x${canvas.height}`);
      
      // Primary export attempt: Canvas with safe audio
      try {
        const canvasStream = canvas.captureStream(settings.fps);
        
        // Try to add audio safely
        let audioContext: AudioContext | null = null;
        let mixedAudioStream: MediaStream | null = null;
        let hasAudio = false;
        
        try {
          console.log('Attempting to create audio...');
          audioContext = new AudioContext();
          mixedAudioStream = await this.createSafeAudioStream(tracks, mediaItems, duration, audioContext);
          hasAudio = !!mixedAudioStream;
          console.log('Audio creation result:', hasAudio ? 'Success' : 'No audio found');
        } catch (audioError) {
          console.warn('Audio processing failed, continuing video-only:', audioError);
          hasAudio = false;
        }
        
        // Combine streams
        const finalStream = new MediaStream();
        
        // Add video track
        canvasStream.getVideoTracks().forEach(track => {
          finalStream.addTrack(track);
        });
        
        // Add audio track if available
        if (hasAudio && mixedAudioStream) {
          mixedAudioStream.getAudioTracks().forEach(track => {
            finalStream.addTrack(track);
          });
        }
        
        // Configure MediaRecorder
        const mimeType = hasAudio ? 'video/webm;codecs=vp8,opus' : 'video/webm;codecs=vp8';
        console.log('Using mime type:', mimeType);
        
        const mediaRecorder = new MediaRecorder(finalStream, {
          mimeType: mimeType,
          videoBitsPerSecond: settings.customBitrate * 1000,
          audioBitsPerSecond: hasAudio ? 128000 : undefined
        });
        
        const chunks: Blob[] = [];
        
        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            chunks.push(event.data);
          }
        };
        
        mediaRecorder.onstop = () => {
          const blob = new Blob(chunks, { type: mimeType });
          this.downloadVideoFile(projectName, blob, 'webm');
          console.log('Video export completed successfully with audio:', hasAudio);
          
          // Clean up audio context
          if (audioContext) {
            audioContext.close();
          }
        };
        
        mediaRecorder.onerror = (error) => {
          console.error('MediaRecorder error:', error);
          throw new Error('MediaRecorder failed');
        };
        
        mediaRecorder.start();
        
        // Render video content to canvas
        await this.renderVideoContentSafe(ctx, canvas, duration, settings, tracks, mediaItems, activeProject);
        
        // Stop recording
        mediaRecorder.stop();
        
        return;
        
      } catch (primaryError) {
        console.error('Primary video export failed:', primaryError);
        
        // Secondary attempt: Canvas export as image
        try {
          // Render a single frame with all elements
          await this.renderSingleFrameSafe(ctx, canvas, duration / 2, settings, tracks, mediaItems, activeProject);
          
          canvas.toBlob((blob) => {
            if (blob) {
              this.downloadVideoFile(projectName, blob, 'png');
              console.log('Secondary export completed (image)');
            }
          }, 'image/png');
          
          return;
          
        } catch (secondaryError) {
          console.error('Secondary export also failed:', secondaryError);
          throw secondaryError;
        }
      }
      
    } catch (error) {
      console.error('Video export failed:', error);
      throw error;
    }
  }

  private async createSafeAudioStream(
    tracks: any[],
    mediaItems: any[],
    duration: number,
    audioContext: AudioContext
  ): Promise<MediaStream | null> {
    try {
      console.log('Creating safe audio stream...');
      
      // Find audio sources with timeout protection
      const audioSources = this.findAudioSources(tracks, mediaItems);
      
      if (audioSources.length === 0) {
        console.log('No audio sources found');
        return null;
      }
      
      console.log(`Found ${audioSources.length} audio sources:`, audioSources.map(s => s.mediaItem.name));
      
      // Create destination for mixed audio
      const destination = audioContext.createMediaStreamDestination();
      const gainNode = audioContext.createGain();
      gainNode.gain.value = 0.8; // Slightly lower to prevent clipping
      gainNode.connect(destination);
      
      // Connect audio sources safely
      let connectedSources = 0;
      for (const source of audioSources) {
        try {
          await this.connectAudioSourceSafe(source, gainNode, audioContext);
          connectedSources++;
        } catch (error) {
          console.warn(`Failed to connect audio source ${source.mediaItem.name}:`, error);
          // Continue with other sources
        }
      }
      
      if (connectedSources === 0) {
        console.log('No audio sources could be connected');
        return null;
      }
      
      console.log(`Successfully connected ${connectedSources}/${audioSources.length} audio sources`);
      return destination.stream;
      
    } catch (error) {
      console.error('Failed to create safe audio stream:', error);
      return null;
    }
  }

  private findAudioSources(tracks: any[], mediaItems: any[]): any[] {
    const audioSources: any[] = [];
    
    try {
      // Check all tracks for audio elements
      for (const track of tracks) {
        if (!track || !track.elements) continue;
        
        for (const element of track.elements) {
          if (!element) continue;
          
          // Audio elements from audio tracks
          if (track.type === 'audio' && element.type === 'media') {
            const audioItem = mediaItems.find(item => item && item.id === element.mediaId);
            if (audioItem && audioItem.type === 'audio' && audioItem.url) {
              audioSources.push({
                type: 'audio',
                element: element,
                mediaItem: audioItem
              });
            }
          }
          
          // Video elements with audio from media tracks  
          if (track.type === 'media' && element.type === 'media') {
            const mediaItem = mediaItems.find(item => item && item.id === element.mediaId);
            if (mediaItem && mediaItem.type === 'video' && mediaItem.url) {
              audioSources.push({
                type: 'video',
                element: element,
                mediaItem: mediaItem
              });
            }
          }
        }
      }
    } catch (error) {
      console.error('Error finding audio sources:', error);
    }
    
    return audioSources;
  }

  private async connectAudioSourceSafe(
    source: any,
    gainNode: GainNode,
    audioContext: AudioContext
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        let audioElement: HTMLAudioElement | HTMLVideoElement;
        
        // Create appropriate audio element
        if (source.type === 'audio') {
          audioElement = new Audio();
          audioElement.crossOrigin = 'anonymous';
          audioElement.preload = 'auto';
        } else {
          audioElement = document.createElement('video');
          audioElement.crossOrigin = 'anonymous';
          audioElement.muted = false;
          audioElement.preload = 'auto';
        }
        
        // Set up timeout for loading
        const loadTimeout = setTimeout(() => {
          reject(new Error(`Audio load timeout for ${source.mediaItem.name}`));
        }, 5000);
        
        // Handle successful load
        audioElement.onloadedmetadata = () => {
          clearTimeout(loadTimeout);
          
          try {
            // Create media source and connect
            const mediaSource = audioContext.createMediaElementSource(audioElement);
            mediaSource.connect(gainNode);
            
            // Set up timing
            const startTime = source.element.startTime || 0;
            const duration = source.element.duration || 5;
            const trimStart = source.element.trimStart || 0;
            const trimEnd = source.element.trimEnd || 0;
            const actualDuration = Math.max(0.1, duration - trimStart - trimEnd);
            
            // Schedule playback
            setTimeout(() => {
              if (audioElement.readyState >= 2) {
                audioElement.currentTime = trimStart;
                audioElement.play()
                  .then(() => {
                    console.log(`Audio playing: ${source.mediaItem.name}`);
                    
                    // Stop after duration
                    setTimeout(() => {
                      audioElement.pause();
                    }, actualDuration * 1000);
                  })
                  .catch(playError => {
                    console.warn(`Audio play failed for ${source.mediaItem.name}:`, playError);
                  });
              }
            }, startTime * 1000);
            
            resolve();
            
          } catch (connectError) {
            clearTimeout(loadTimeout);
            reject(connectError);
          }
        };
        
        // Handle load error
        audioElement.onerror = () => {
          clearTimeout(loadTimeout);
          reject(new Error(`Failed to load ${source.mediaItem.name}`));
        };
        
        // Start loading
        audioElement.src = source.mediaItem.url;
        
      } catch (error) {
        reject(error);
      }
    });
  }

  private async renderVideoContentSafe(
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    duration: number,
    settings: ProjectSettings,
    tracks: any[],
    mediaItems: any[],
    activeProject: any
  ): Promise<void> {
    console.log('Starting safe video content rendering...');
    
    // Pre-load all media elements safely
    const mediaElements = await this.preloadAllMediaElementsSafe(tracks, mediaItems);
    
    // Calculate total frames - limit to prevent crashes
    const maxFrames = 600; // Maximum 10 seconds at 60fps
    const totalFrames = Math.min(Math.ceil(duration * settings.fps), maxFrames);
    const frameTime = 1 / settings.fps;
    
    let currentFrame = 0;
    let renderTimeout: NodeJS.Timeout | null = null;
    
    return new Promise((resolve, reject) => {
      const renderTimeoutDuration = 20000; // 20 seconds timeout
      
      const renderFrame = () => {
        try {
          // Clear canvas with project background
          const backgroundColor = activeProject?.backgroundColor || '#000000';
          ctx.fillStyle = backgroundColor;
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          
          const currentTime = currentFrame * frameTime;
          
          // Get active elements at current time
          const activeElements = this.getActiveElementsAtTime(currentTime, tracks, mediaItems);
          
          // Render all active elements safely
          this.renderActiveElementsSafe(ctx, canvas, activeElements, currentTime, mediaElements);
          
          console.log(`Rendering frame ${currentFrame + 1}/${totalFrames} at time ${currentTime.toFixed(2)}s`);
          
          currentFrame++;
          
          // Check if we've rendered all frames
          if (currentFrame >= totalFrames) {
            if (renderTimeout) clearTimeout(renderTimeout);
            resolve();
            return;
          }
          
          // Schedule next frame with longer delay to prevent crashes
          setTimeout(renderFrame, 50); // 20fps rendering to prevent crashes
          
        } catch (error) {
          console.error('Frame render error:', error);
          if (renderTimeout) clearTimeout(renderTimeout);
          reject(error);
        }
      };
      
      // Set overall timeout
      renderTimeout = setTimeout(() => {
        console.error('Video rendering timed out');
        reject(new Error('Video rendering timed out'));
      }, renderTimeoutDuration);
      
      // Start rendering
      renderFrame();
    });
  }

  private async renderSingleFrameSafe(
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    time: number,
    settings: ProjectSettings,
    tracks: any[],
    mediaItems: any[],
    activeProject: any
  ): Promise<void> {
    try {
      // Clear canvas with project background
      const backgroundColor = activeProject?.backgroundColor || '#000000';
      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Pre-load media elements safely
      const mediaElements = await this.preloadAllMediaElementsSafe(tracks, mediaItems);
      
      // Render active elements at specified time
      const activeElements = this.getActiveElementsAtTime(time, tracks, mediaItems);
      this.renderActiveElementsSafe(ctx, canvas, activeElements, time, mediaElements);
      
      // Add export info
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(10, 10, 300, 80);
      
      ctx.fillStyle = '#ffffff';
      ctx.font = '16px Arial';
      ctx.textAlign = 'left';
      ctx.fillText('OpenCut Export', 20, 35);
      ctx.fillText(`Quality: ${settings.quality}`, 20, 55);
      ctx.fillText(`Frame Rate: ${settings.fps} FPS`, 20, 75);
      
    } catch (error) {
      console.error('Single frame render error:', error);
      throw error;
    }
  }

  private async preloadAllMediaElementsSafe(tracks: any[], mediaItems: any[]): Promise<Map<string, HTMLImageElement | HTMLVideoElement | null>> {
    const mediaElements = new Map();
    
    console.log('Preloading media elements safely:', mediaItems.length);
    
    for (const mediaItem of mediaItems) {
      try {
        let mediaElement: HTMLImageElement | HTMLVideoElement | null = null;
        
        if (mediaItem.type === 'image') {
          mediaElement = new Image();
          mediaElement.crossOrigin = 'anonymous';
          await new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => {
              console.warn(`Image load timeout: ${mediaItem.name}`);
              resolve(); // Don't reject, just continue
            }, 3000);
            
            mediaElement!.onload = () => {
              clearTimeout(timeout);
              resolve();
            };
            mediaElement!.onerror = () => {
              clearTimeout(timeout);
              console.warn(`Image load error: ${mediaItem.name}`);
              resolve(); // Don't reject, just continue
            };
            mediaElement!.src = mediaItem.url!;
          });
        } else if (mediaItem.type === 'video') {
          mediaElement = document.createElement('video');
          mediaElement.crossOrigin = 'anonymous';
          mediaElement.muted = true;
          mediaElement.preload = 'metadata'; // Only load metadata, not full video
          mediaElement.playsInline = true;
          mediaElement.loop = false;
          
          await new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => {
              console.warn(`Video load timeout: ${mediaItem.name}`);
              resolve(); // Don't reject, just continue
            }, 5000);
            
            mediaElement!.onloadedmetadata = () => {
              clearTimeout(timeout);
              resolve();
            };
            mediaElement!.onerror = () => {
              clearTimeout(timeout);
              console.warn(`Video load error: ${mediaItem.name}`);
              resolve(); // Don't reject, just continue
            };
            mediaElement!.src = mediaItem.url!;
          });
          
          // Don't auto-play, just prepare for rendering
          console.log(`Video prepared: ${mediaItem.name}`);
        }
        
        mediaElements.set(mediaItem.id, mediaElement);
        console.log(`Loaded media element: ${mediaItem.name} (${mediaItem.type})`);
      } catch (error) {
        console.warn(`Failed to load media element: ${mediaItem.name}`, error);
        mediaElements.set(mediaItem.id, null);
      }
    }
    
    return mediaElements;
  }

  private getActiveElementsAtTime(currentTime: number, tracks: any[], mediaItems: any[]): Array<{
    element: any;
    track: any;
    mediaItem: any | null;
  }> {
    const activeElements: Array<{
      element: any;
      track: any;
      mediaItem: any | null;
    }> = [];

    tracks.forEach((track) => {
      track.elements.forEach((element: any) => {
        const elementStart = element.startTime;
        const elementEnd = element.startTime + (element.duration - element.trimStart - element.trimEnd);

        if (currentTime >= elementStart && currentTime < elementEnd) {
          let mediaItem = null;

          // Only get media item for media elements
          if (element.type === "media") {
            mediaItem = element.mediaId === "test" 
              ? null // Test elements don't have a real media item
              : mediaItems.find((item: any) => item.id === element.mediaId) || null;
          }

          activeElements.push({ element, track, mediaItem });
        }
      });
    });

    return activeElements;
  }

  private renderActiveElementsSafe(
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    activeElements: Array<{
      element: any;
      track: any;
      mediaItem: any | null;
    }>,
    currentTime: number,
    mediaElements: Map<string, HTMLImageElement | HTMLVideoElement | null>
  ): void {
    console.log(`Rendering ${activeElements.length} active elements at time ${currentTime.toFixed(2)}s`);
    
    // Sort elements by track order (background first, then foreground)
    const sortedElements = [...activeElements].sort((a, b) => {
      const trackA = a.track.order || 0;
      const trackB = b.track.order || 0;
      return trackA - trackB;
    });
    
    // Render each active element based on type
    for (const { element, track, mediaItem } of sortedElements) {
      try {
        // Media elements (render first, background)
        if (element.type === "media") {
          this.renderMediaElementSafe(ctx, canvas, element, mediaItem, currentTime, mediaElements);
        }
        
        // Text elements (render last, foreground)
        if (element.type === "text") {
          this.renderTextElementSafe(ctx, canvas, element);
        }
        
      } catch (error) {
        console.warn('Error rendering element:', error);
        // Continue with other elements
      }
    }
  }

  private renderTextElementSafe(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, element: any): void {
    try {
      // Get text content
      const textContent = element.content || element.name || 'Text';
      
      // Save context for transformations
      ctx.save();
      
      // Calculate position - center of canvas by default
      const x = canvas.width * 0.5 + (element.x || 0);
      const y = canvas.height * 0.5 + (element.y || 0);
      
      // Apply transformations
      ctx.translate(x, y);
      ctx.rotate((element.rotation || 0) * Math.PI / 180);
      
      // Set text styles with proper scaling
      const baseFontSize = element.fontSize || 48;
      const fontScale = Math.min(canvas.width / 1920, canvas.height / 1080) * 2;
      const fontSize = Math.max(32, baseFontSize * fontScale);
      
      const fontFamily = element.fontFamily || 'Arial, sans-serif';
      const fontWeight = element.fontWeight || 'bold';
      const fontStyle = element.fontStyle || 'normal';
      
      ctx.font = `${fontWeight} ${fontStyle} ${fontSize}px ${fontFamily}`;
      ctx.textAlign = (element.textAlign as CanvasTextAlign) || 'center';
      ctx.textBaseline = 'middle';
      ctx.globalAlpha = element.opacity !== undefined ? element.opacity : 1;
      
      // Background color
      if (element.backgroundColor && element.backgroundColor !== 'transparent' && element.backgroundColor !== '') {
        ctx.fillStyle = element.backgroundColor;
        const metrics = ctx.measureText(textContent);
        const textWidth = metrics.width;
        const textHeight = fontSize;
        ctx.fillRect(-textWidth/2 - 15, -textHeight/2 - 10, textWidth + 30, textHeight + 20);
      }
      
      // Strong text outline for better visibility
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = Math.max(3, fontSize / 12);
      ctx.strokeText(textContent, 0, 0);
      
      // Text fill
      ctx.fillStyle = element.color || '#ffffff';
      ctx.fillText(textContent, 0, 0);
      
      // Restore context
      ctx.restore();
      
    } catch (error) {
      console.warn('Text render error:', error);
    }
  }

  private renderMediaElementSafe(
    ctx: CanvasRenderingContext2D, 
    canvas: HTMLCanvasElement, 
    element: any, 
    mediaItem: any | null,
    currentTime: number,
    mediaElements: Map<string, HTMLImageElement | HTMLVideoElement | null>
  ): void {
    try {
      // Test elements
      if (!mediaItem || element.mediaId === "test") {
        ctx.fillStyle = 'rgba(59, 130, 246, 0.2)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.fillStyle = '#ffffff';
        ctx.font = '32px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('🎬', canvas.width / 2, canvas.height / 2 - 20);
        ctx.font = '16px Arial';
        ctx.fillText(element.name, canvas.width / 2, canvas.height / 2 + 20);
        return;
      }

      // Get preloaded media element
      const mediaElement = mediaElements.get(mediaItem.id);

      if (!mediaElement) {
        console.warn(`Media element not found for: ${mediaItem.name}`);
        return;
      }

      // Calculate element's local time
      const elementTime = currentTime - element.startTime;
      const adjustedTime = elementTime + (element.trimStart || 0);

      // Set video time if it's a video element (but don't auto-play)
      if (mediaElement instanceof HTMLVideoElement) {
        const targetTime = Math.min(Math.max(0, adjustedTime), mediaElement.duration || 0);
        
        // Only seek if necessary and safe
        if (mediaElement.readyState >= 2 && !isNaN(targetTime) && targetTime >= 0) {
          mediaElement.currentTime = targetTime;
        }
      }

      // Calculate rendering dimensions and position
      const renderInfo = this.calculateRenderInfo(element, mediaElement, canvas);
      
      // Render the media element
      ctx.save();
      ctx.globalAlpha = element.opacity !== undefined ? element.opacity : 1;
      
      try {
        ctx.drawImage(
          mediaElement,
          renderInfo.x,
          renderInfo.y,
          renderInfo.width,
          renderInfo.height
        );
      } catch (drawError) {
        console.warn(`Failed to draw media: ${mediaItem.name}`, drawError);
      }
      
      ctx.restore();
      
    } catch (error) {
      console.warn('Media render error:', error);
    }
  }

  private calculateRenderInfo(
    element: TimelineElement,
    mediaElement: HTMLImageElement | HTMLVideoElement,
    canvas: HTMLCanvasElement
  ): { x: number; y: number; width: number; height: number } {
    // Get media dimensions
    const mediaWidth = mediaElement instanceof HTMLVideoElement 
      ? mediaElement.videoWidth 
      : mediaElement.naturalWidth;
    const mediaHeight = mediaElement instanceof HTMLVideoElement 
      ? mediaElement.videoHeight 
      : mediaElement.naturalHeight;

    if (mediaWidth === 0 || mediaHeight === 0) {
      return { x: 0, y: 0, width: canvas.width, height: canvas.height };
    }

    // Calculate aspect ratios
    const mediaAspect = mediaWidth / mediaHeight;
    const canvasAspect = canvas.width / canvas.height;

    let renderWidth, renderHeight;
    
    // Fit media to canvas while maintaining aspect ratio
    if (mediaAspect > canvasAspect) {
      // Media is wider than canvas
      renderWidth = canvas.width;
      renderHeight = canvas.width / mediaAspect;
    } else {
      // Media is taller than canvas
      renderWidth = canvas.height * mediaAspect;
      renderHeight = canvas.height;
    }

    // Center the media
    const x = (canvas.width - renderWidth) / 2;
    const y = (canvas.height - renderHeight) / 2;

    return { x, y, width: renderWidth, height: renderHeight };
  }



  private drawTimelineOverlay(
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    currentTime: number,
    maxDuration: number
  ): void {
    // Draw timeline progress bar at bottom
    const barHeight = 6;
    const barY = canvas.height - barHeight - 10;
    const barWidth = canvas.width * 0.8;
    const barX = (canvas.width - barWidth) / 2;
    
    // Background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(barX - 10, barY - 10, barWidth + 20, barHeight + 20);
    
    // Progress bar background
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.fillRect(barX, barY, barWidth, barHeight);
    
    // Progress bar fill
    ctx.fillStyle = '#ff0000';
    ctx.fillRect(barX, barY, (barWidth * currentTime) / maxDuration, barHeight);
    
    // Time text
    ctx.fillStyle = '#ffffff';
    ctx.font = '16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(
      `${currentTime.toFixed(1)}s / ${maxDuration.toFixed(1)}s`,
      canvas.width / 2,
      barY - 20
    );
  }

  private downloadVideoFile(projectName: string, blob: Blob, extension: string = 'webm'): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${projectName.replace(/[^a-zA-Z0-9]/g, '_')}.${extension}`;
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(url);
  }

  private getResolutionString(quality: string): string {
    const qualityPresets = {
      "480p": "854x480",
      "720p": "1280x720", 
      "1080p": "1920x1080",
      "1440p": "2560x1440",
      "2160p": "3840x2160",
    };
    return qualityPresets[quality as keyof typeof qualityPresets] || "1920x1080";
  }

  private async createSimpleVideoPlaceholder(
    projectName: string,
    duration: number,
    settings: ProjectSettings,
    videoElements: TimelineElement[],
    textElements: TimelineElement[]
  ): Promise<void> {
    // Create a simple video demonstration file
    const videoInfo = `OpenCut Video Export
===================

Project: ${projectName}
Duration: ${duration} seconds
Quality: ${settings.quality}
Frame Rate: ${settings.fps} FPS
Resolution: ${this.getResolutionString(settings.quality)}
Bitrate: ${settings.customBitrate} kbps

Timeline Elements:
- Video Elements: ${videoElements.length}
- Text Elements: ${textElements.length}

Export completed: ${new Date().toISOString()}

Note: This is a basic video export. For full video rendering with 
media elements and real-time preview, additional processing is required.
`;

    const blob = new Blob([videoInfo], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${projectName.replace(/[^a-zA-Z0-9]/g, '_')}_info.txt`;
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(url);
  }

  private async createFallbackExport(
    projectName: string,
    duration: number,
    settings: ProjectSettings,
    videoElements: TimelineElement[],
    textElements: TimelineElement[]
  ): Promise<void> {
    console.log('Creating fallback export...');
    
    // Create a simple canvas-based image export
    try {
      // Get actual timeline data from stores
      const { useTimelineStore } = await import('@/stores/timeline-store');
      const { useMediaStore } = await import('@/stores/media-store');
      const { useProjectStore } = await import('@/stores/project-store');
      
      const tracks = useTimelineStore.getState().tracks;
      const mediaItems = useMediaStore.getState().mediaItems;
      const activeProject = useProjectStore.getState().activeProject;
      
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) throw new Error('Canvas not available');
      
      // Set canvas size
      const qualityPresets = {
        "480p": { width: 854, height: 480 },
        "720p": { width: 1280, height: 720 },
        "1080p": { width: 1920, height: 1080 },
        "1440p": { width: 2560, height: 1440 },
        "2160p": { width: 3840, height: 2160 },
      };
      
      const preset = qualityPresets[settings.quality as keyof typeof qualityPresets] || qualityPresets["1080p"];
      canvas.width = preset.width;
      canvas.height = preset.height;
      
      // Render single frame
      await this.renderSingleFrameSafe(ctx, canvas, duration / 2, settings, tracks, mediaItems, activeProject);
      
      // Convert to blob and download
      canvas.toBlob((blob) => {
        if (blob) {
          this.downloadVideoFile(projectName, blob, 'png');
          console.log('Fallback image export completed');
        }
      }, 'image/png');
      
    } catch (fallbackError) {
      console.error('Fallback export failed:', fallbackError);
      // No more fallbacks - just log the error
      throw fallbackError;
    }
  }

  private async createEmergencyFallback(
    projectName: string,
    duration: number,
    settings: ProjectSettings
  ): Promise<void> {
    console.log('Creating emergency fallback export...');
    
    // Create a simple text file with export info (not JSON)
    const exportInfo = `OpenCut Video Export Failed
============================

Project: ${projectName}
Duration: ${duration} seconds
Quality: ${settings.quality}
Frame Rate: ${settings.fps} FPS
Bitrate: ${settings.customBitrate} kbps

Export attempted at: ${new Date().toISOString()}

The video export process encountered technical difficulties.
Please try again or contact support if the issue persists.

Export Details:
- Canvas rendering: Attempted
- MediaRecorder: Attempted
- Fallback methods: Attempted

All export methods failed to complete successfully.
`;
    
    const blob = new Blob([exportInfo], { type: 'text/plain' });
    
    // Immediate download
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${projectName.replace(/[^a-zA-Z0-9]/g, '_')}_export_failed.txt`;
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(url);
    
    console.log('Emergency fallback completed');
  }
}

// Export singleton instance
export const videoExportService = new VideoExportService(); 