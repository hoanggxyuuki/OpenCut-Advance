"use client";

import { useState, useEffect, useRef } from "react";
import { useMediaStore, type MediaItem } from "@/stores/media-store";
import { useProjectStore } from "@/stores/project-store";
import { usePlaybackStore } from "@/stores/playback-store";
import { processMediaFiles } from "@/lib/media-processing";
import { useDragDrop } from "@/hooks/use-drag-drop";
import { 
  Music, 
  Play, 
  Pause, 
  Volume2, 
  Download, 
  Plus,
  Upload,
  Search,
  Filter,
  RotateCcw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { DragOverlay } from "@/components/ui/drag-overlay";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { DraggableMediaItem } from "@/components/ui/draggable-item";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import AudioWaveform from "../../audio-waveform";

// Free audio library data
const FREE_AUDIO_LIBRARY = [
  {
    id: "ambient-forest",
    name: "Ambient Forest",
    category: "Nature",
    duration: 180,
    url: "/audio/ambient-forest.mp3", // These would be actual audio files
    description: "Peaceful forest ambience with birds chirping"
  },
  {
    id: "upbeat-electronic",
    name: "Upbeat Electronic",
    category: "Electronic",
    duration: 120,
    url: "/audio/upbeat-electronic.mp3",
    description: "High-energy electronic track perfect for vlogs"
  },
  {
    id: "gentle-piano",
    name: "Gentle Piano",
    category: "Classical",
    duration: 90,
    url: "/audio/gentle-piano.mp3",
    description: "Soft piano melody for emotional moments"
  },
  {
    id: "corporate-background",
    name: "Corporate Background",
    category: "Corporate",
    duration: 200,
    url: "/audio/corporate-background.mp3",
    description: "Professional background music for presentations"
  },
  {
    id: "acoustic-guitar",
    name: "Acoustic Guitar",
    category: "Acoustic",
    duration: 150,
    url: "/audio/acoustic-guitar.mp3",
    description: "Warm acoustic guitar strumming"
  },
  {
    id: "hip-hop-beat",
    name: "Hip Hop Beat",
    category: "Hip Hop",
    duration: 140,
    url: "/audio/hip-hop-beat.mp3",
    description: "Modern hip hop instrumental track"
  }
];

const AUDIO_CATEGORIES = ["All", "Nature", "Electronic", "Classical", "Corporate", "Acoustic", "Hip Hop"];

interface AudioPlayerState {
  currentTrack: string | null;
  isPlaying: boolean;
  volume: number;
  currentTime: number;
  duration: number;
}

export function AudioView() {
  const { mediaItems, addMediaItem, removeMediaItem } = useMediaStore();
  const { activeProject } = useProjectStore();
  const { volume: globalVolume } = usePlaybackStore();
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [activeTab, setActiveTab] = useState("library");
  
  // Audio player state
  const [playerState, setPlayerState] = useState<AudioPlayerState>({
    currentTrack: null,
    isPlaying: false,
    volume: 0.7,
    currentTime: 0,
    duration: 0
  });

  // Filter audio items from media store
  const audioItems = mediaItems.filter(item => item.type === "audio");
  
  // Filter free audio library
  const filteredFreeAudio = FREE_AUDIO_LIBRARY.filter(track => {
    const matchesSearch = track.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         track.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === "All" || track.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const { isDragOver, dragProps } = useDragDrop({
    onDrop: processFiles,
  });

  async function processFiles(files: FileList | File[]) {
    if (!files || files.length === 0) return;
    if (!activeProject) {
      toast.error("No active project");
      return;
    }

    // Filter audio files only
    const audioFiles = Array.from(files).filter(file => 
      file.type.startsWith("audio/")
    );

    if (audioFiles.length === 0) {
      toast.error("No audio files found");
      return;
    }

    setIsProcessing(true);
    setProgress(0);
    
    try {
      const processedItems = await processMediaFiles(audioFiles, (p) => setProgress(p));
      for (const item of processedItems) {
        await addMediaItem(activeProject.id, item);
      }
      toast.success(`Added ${processedItems.length} audio file(s)`);
    } catch (error) {
      console.error("Error processing audio files:", error);
      toast.error("Failed to process audio files");
    } finally {
      setIsProcessing(false);
      setProgress(0);
    }
  }

  const handleFileSelect = () => fileInputRef.current?.click();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) processFiles(e.target.files);
    e.target.value = "";
  };

  const handleRemoveAudio = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!activeProject) return;
    
    await removeMediaItem(activeProject.id, id);
    toast.success("Audio removed");
  };

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  };

  const playAudio = (trackId: string, url: string) => {
    if (playerState.currentTrack === trackId && playerState.isPlaying) {
      // Pause current track
      audioRef.current?.pause();
      setPlayerState(prev => ({ ...prev, isPlaying: false }));
    } else {
      // Play new track or resume current
      if (audioRef.current) {
        audioRef.current.src = url;
        audioRef.current.volume = playerState.volume;
        audioRef.current.play();
        setPlayerState(prev => ({ 
          ...prev, 
          currentTrack: trackId, 
          isPlaying: true 
        }));
      }
    }
  };

  const downloadFreeAudio = async (track: any) => {
    try {
      // In a real app, this would download from a CDN
      // For demo purposes, we'll show a message
      toast.info("Download feature would be implemented with actual audio files");
    } catch (error) {
      toast.error("Failed to download audio");
    }
  };

  // Audio player event handlers
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      setPlayerState(prev => ({ 
        ...prev, 
        currentTime: audio.currentTime 
      }));
    };

    const handleLoadedMetadata = () => {
      setPlayerState(prev => ({ 
        ...prev, 
        duration: audio.duration 
      }));
    };

    const handleEnded = () => {
      setPlayerState(prev => ({ 
        ...prev, 
        isPlaying: false,
        currentTime: 0 
      }));
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
    };
  }, []);

  const renderAudioItem = (item: MediaItem) => (
    <Card key={item.id} className="group hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0">
            <div className="w-12 h-12 bg-gradient-to-br from-green-500/20 to-emerald-500/20 rounded-lg flex items-center justify-center border border-green-500/20">
              <Music className="h-6 w-6 text-green-500" />
            </div>
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="font-medium truncate">{item.name}</h3>
              <Badge variant="secondary" className="text-xs">
                {item.duration ? formatDuration(item.duration) : "Unknown"}
              </Badge>
            </div>
            
            {item.url && item.url.length > 0 && (
              <div className="mb-3">
                <AudioWaveform 
                  key={item.id} // Add key to force re-render when item changes
                  audioUrl={item.url}
                  height={32}
                  className="rounded border border-border/50"
                />
              </div>
            )}
            
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => item.url && playAudio(item.id, item.url)}
                disabled={!item.url}
                className="flex-shrink-0"
              >
                {playerState.currentTrack === item.id && playerState.isPlaying ? (
                  <Pause className="h-4 w-4" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
              </Button>
              
              <DraggableMediaItem
                name={item.name}
                preview={
                  <div className="w-full h-full bg-gradient-to-br from-green-500/20 to-emerald-500/20 flex items-center justify-center rounded">
                    <Music className="h-4 w-4 text-green-500" />
                  </div>
                }
                dragData={{
                  id: item.id,
                  type: item.type,
                  name: item.name,
                }}
                className="flex-1"
              />
              
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => handleRemoveAudio(e, item.id)}
                className="flex-shrink-0 text-destructive hover:text-destructive"
              >
                ×
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const renderFreeAudioItem = (track: any) => (
    <Card key={track.id} className="group hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-lg flex items-center justify-center border border-blue-500/20">
              <Music className="h-6 w-6 text-blue-500" />
            </div>
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-medium truncate">{track.name}</h3>
              <Badge variant="outline" className="text-xs">
                {track.category}
              </Badge>
            </div>
            
            <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
              {track.description}
            </p>
            
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => playAudio(track.id, track.url)}
                className="flex-shrink-0"
              >
                {playerState.currentTrack === track.id && playerState.isPlaying ? (
                  <Pause className="h-4 w-4" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
              </Button>
              
              <span className="text-sm text-muted-foreground">
                {formatDuration(track.duration)}
              </span>
              
              <div className="flex-1" />
              
              <Button
                variant="ghost"
                size="sm"
                onClick={() => downloadFreeAudio(track)}
                className="flex-shrink-0"
              >
                <Download className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*"
        multiple
        className="hidden"
        onChange={handleFileChange}
      />
      
      <audio ref={audioRef} className="hidden" />
      
      <div
        className={`h-full flex flex-col transition-colors relative ${isDragOver ? "bg-accent/30" : ""}`}
        {...dragProps}
      >
        <DragOverlay isVisible={isDragOver} />
        
        {/* Header */}
        <div className="p-3 border-b border-border/50">
          <div className="flex items-center gap-2 mb-3">
            <div className="flex items-center gap-2 flex-1">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search audio..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="text-sm"
              />
            </div>
            
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AUDIO_CATEGORIES.map(category => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Button
              variant="outline"
              size="sm"
              onClick={handleFileSelect}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <>
                  <Upload className="h-4 w-4 animate-spin" />
                  <span className="ml-2">{progress}%</span>
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  <span className="ml-2">Add</span>
                </>
              )}
            </Button>
          </div>
          
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="library">My Audio</TabsTrigger>
              <TabsTrigger value="free">Free Audio</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        
        {/* Content */}
        <div className="flex-1 overflow-y-auto p-3">
          <Tabs value={activeTab} className="w-full">
            <TabsContent value="library" className="space-y-3 m-0">
              {audioItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="w-16 h-16 rounded-full bg-muted/30 flex items-center justify-center mb-4">
                    <Music className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">
                    No audio files in your library
                  </p>
                  <p className="text-xs text-muted-foreground/70">
                    Drag audio files here or click Add button
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {audioItems.map(renderAudioItem)}
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="free" className="space-y-3 m-0">
              {filteredFreeAudio.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="w-16 h-16 rounded-full bg-muted/30 flex items-center justify-center mb-4">
                    <Music className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">
                    No audio tracks match your search
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSearchQuery("");
                      setSelectedCategory("All");
                    }}
                  >
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Reset filters
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredFreeAudio.map(renderFreeAudioItem)}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
        
        {/* Audio Player Controls */}
        {playerState.currentTrack && (
          <div className="p-3 border-t border-border/50 bg-muted/20">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (playerState.isPlaying) {
                    audioRef.current?.pause();
                  } else {
                    audioRef.current?.play();
                  }
                  setPlayerState(prev => ({ 
                    ...prev, 
                    isPlaying: !prev.isPlaying 
                  }));
                }}
              >
                {playerState.isPlaying ? (
                  <Pause className="h-4 w-4" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
              </Button>
              
              <div className="flex items-center gap-2 flex-1">
                <span className="text-xs text-muted-foreground">
                  {formatDuration(playerState.currentTime)}
                </span>
                <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary transition-all duration-100"
                    style={{ 
                      width: `${(playerState.currentTime / playerState.duration) * 100}%` 
                    }}
                  />
                </div>
                <span className="text-xs text-muted-foreground">
                  {formatDuration(playerState.duration)}
                </span>
              </div>
              
              <div className="flex items-center gap-2">
                <Volume2 className="h-4 w-4" />
                <div className="w-16">
                  <Slider
                    value={[playerState.volume]}
                    onValueChange={(value) => {
                      const newVolume = value[0];
                      setPlayerState(prev => ({ ...prev, volume: newVolume }));
                      if (audioRef.current) {
                        audioRef.current.volume = newVolume;
                      }
                    }}
                    max={1}
                    step={0.1}
                    className="w-full"
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
} 