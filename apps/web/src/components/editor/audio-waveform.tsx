import React, { useEffect, useRef, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';

interface AudioWaveformProps {
  audioUrl: string;
  height?: number;
  className?: string;
}

const AudioWaveform: React.FC<AudioWaveformProps> = ({ 
  audioUrl, 
  height = 32, 
  className = '' 
}) => {
  const waveformRef = useRef<HTMLDivElement>(null);
  const wavesurfer = useRef<WaveSurfer | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);
  const abortController = useRef<AbortController | null>(null);

  useEffect(() => {
    let mounted = true;

    const initWaveSurfer = async () => {
      if (!waveformRef.current || !audioUrl) {
        setError(true);
        setIsLoading(false);
        return;
      }

      try {
        // Clean up any existing instance
        if (wavesurfer.current) {
          try {
            wavesurfer.current.destroy();
          } catch (e) {
            // Silently ignore destroy errors
          }
          wavesurfer.current = null;
        }

        // Cancel any previous request
        if (abortController.current) {
          abortController.current.abort();
        }
        abortController.current = new AbortController();

        // Check if audio URL is accessible
        try {
          const response = await fetch(audioUrl, { 
            method: 'HEAD',
            signal: abortController.current.signal 
          });
          if (!response.ok) {
            throw new Error(`Audio URL not accessible: ${response.status}`);
          }
        } catch (fetchError) {
          console.warn('Audio URL check failed:', fetchError);
          if (mounted) {
            setError(true);
            setIsLoading(false);
          }
          return;
        }

        if (!mounted) return;

        wavesurfer.current = WaveSurfer.create({
          container: waveformRef.current,
          waveColor: 'rgba(255, 255, 255, 0.6)',
          progressColor: 'rgba(255, 255, 255, 0.9)',
          cursorColor: 'transparent',
          barWidth: 2,
          barGap: 1,
          height: height,
          normalize: true,
          interact: false,
        });

        // Event listeners
        wavesurfer.current.on('ready', () => {
          if (mounted) {
            setIsLoading(false);
            setError(false);
          }
        });

        wavesurfer.current.on('error', (err) => {
          console.error('WaveSurfer error:', err);
          if (mounted) {
            setError(true);
            setIsLoading(false);
          }
        });

        wavesurfer.current.on('loading', (progress) => {
          // Optional: could show loading progress
        });

        if (mounted) {
          await wavesurfer.current.load(audioUrl);
        }

      } catch (err) {
        console.error('Failed to initialize WaveSurfer:', err);
        if (mounted) {
          setError(true);
          setIsLoading(false);
        }
      }
    };

    // Add a small delay to avoid rapid re-initialization
    const timeoutId = setTimeout(() => {
      if (mounted) {
        initWaveSurfer();
      }
    }, 100);

    return () => {
      mounted = false;
      clearTimeout(timeoutId);
      
      if (abortController.current) {
        abortController.current.abort();
      }
      
      if (wavesurfer.current) {
        try {
          wavesurfer.current.destroy();
        } catch (e) {
          // Silently ignore destroy errors
        }
        wavesurfer.current = null;
      }
    };
  }, [audioUrl, height]);

  if (error) {
    return (
      <div className={`flex items-center justify-center ${className}`} style={{ height }}>
        <span className="text-xs text-muted-foreground">Audio waveform unavailable</span>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/50 rounded">
          <span className="text-xs text-muted-foreground">Loading waveform...</span>
        </div>
      )}
      <div 
        ref={waveformRef} 
        className={`w-full transition-opacity duration-200 ${isLoading ? 'opacity-0' : 'opacity-100'}`}
        style={{ height }}
      />
    </div>
  );
};

export default AudioWaveform;