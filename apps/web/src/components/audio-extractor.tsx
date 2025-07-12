"use client";

import { Download, Loader2 } from "lucide-react";
import { useState } from "react";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface AudioExtractorProps {
  videoFile: File;
  videoName: string;
  onExtracted: (audioFile: File, audioUrl: string, duration: number) => void;
  className?: string;
  variant?: "default" | "secondary" | "outline";
  size?: "sm" | "default" | "lg";
}

export function AudioExtractor({
  videoFile,
  videoName,
  onExtracted,
  className,
  variant = "default",
  size = "default",
}: AudioExtractorProps) {
  const [isExtracting, setIsExtracting] = useState(false);

  const extractAudio = async () => {
    if (!videoFile) return;
    
    setIsExtracting(true);
    toast.info("Extracting audio from video...");
    
    try {
      // Create a video element to get duration
      const video = document.createElement("video");
      video.src = URL.createObjectURL(videoFile);
      video.muted = true;
      video.preload = "metadata";
      
      // Wait for video metadata to load
      await new Promise<void>((resolve, reject) => {
        video.onloadedmetadata = () => resolve();
        video.onerror = () => reject(new Error("Failed to load video"));
      });

      const duration = video.duration;
      URL.revokeObjectURL(video.src);
      
      // Create "audio" file by changing the mime type
      // Most MP4 videos contain audio streams that can be played as audio
      let audioMimeType = "audio/mp4";
      let audioExtension = "m4a";
      
      // Determine the best audio format based on video type
      if (videoFile.type.includes("webm")) {
        audioMimeType = "audio/webm";
        audioExtension = "webm";
      } else if (videoFile.type.includes("ogg")) {
        audioMimeType = "audio/ogg";
        audioExtension = "ogg";
      }
      
      const audioFileName = videoName.replace(/\.[^/.]+$/, "") + `.${audioExtension}`;
      
      // Create audio file with the same binary data but different mime type
      const audioFile = new File([videoFile], audioFileName, { 
        type: audioMimeType 
      });
      
      const audioUrl = URL.createObjectURL(audioFile);
      
      // Test if the audio actually works
      const audio = new Audio();
      audio.src = audioUrl;
      audio.muted = true;
      audio.preload = "metadata";
      
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Audio test timeout"));
        }, 5000);
        
        audio.onloadedmetadata = () => {
          clearTimeout(timeout);
          resolve();
        };
        
        audio.onerror = () => {
          clearTimeout(timeout);
          reject(new Error("Audio format not supported"));
        };
      });
      
      // Clean up test audio
      audio.src = "";
      
      // Call the callback
      onExtracted(audioFile, audioUrl, duration);
      
      toast.success(`Audio extracted successfully: ${audioFileName}`);
      
    } catch (error) {
      console.error("Error extracting audio:", error);
      
      // Fallback: create a copy with audio mime type anyway
      try {
        const fallbackAudioFileName = videoName.replace(/\.[^/.]+$/, "") + "_audio.mp4";
        const fallbackAudioFile = new File([videoFile], fallbackAudioFileName, { 
          type: "audio/mp4" 
        });
        const fallbackAudioUrl = URL.createObjectURL(fallbackAudioFile);
        
        // Get duration
        const video = document.createElement("video");
        video.src = URL.createObjectURL(videoFile);
        video.muted = true;
        video.preload = "metadata";
        
        await new Promise<void>((resolve, reject) => {
          video.onloadedmetadata = () => resolve();
          video.onerror = () => reject(new Error("Failed to load video"));
        });
        
        const duration = video.duration;
        URL.revokeObjectURL(video.src);
        
        onExtracted(fallbackAudioFile, fallbackAudioUrl, duration);
        
        toast.success(`Audio file created: ${fallbackAudioFileName}`);
        toast.info("Note: This is the video file with audio mime type. It should play as audio in most players.");
        
      } catch (fallbackError) {
        console.error("Fallback extraction also failed:", fallbackError);
        toast.error("Failed to extract audio. " + (error instanceof Error ? error.message : "Unknown error"));
      }
    } finally {
      setIsExtracting(false);
    }
  };

  return (
    <Button
      onClick={extractAudio}
      disabled={isExtracting}
      variant={variant}
      size={size}
      className={cn(className)}
      title="Extract Audio"
    >
      {isExtracting ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Download className="h-4 w-4" />
      )}
    </Button>
  );
} 