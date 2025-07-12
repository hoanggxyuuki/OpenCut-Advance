"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Settings, Zap, Film, Download, Upload } from "lucide-react";
import { toast } from "sonner";
import { useProjectSettingsStore } from "@/stores/project-settings-store";

// Common FPS values
const FPS_OPTIONS = [
  { value: 24, label: "24 FPS", description: "Cinema standard" },
  { value: 25, label: "25 FPS", description: "PAL standard" },
  { value: 30, label: "30 FPS", description: "NTSC standard" },
  { value: 50, label: "50 FPS", description: "High motion" },
  { value: 60, label: "60 FPS", description: "Ultra smooth" },
  { value: 120, label: "120 FPS", description: "Very high motion" },
];

// Video quality presets
const QUALITY_PRESETS = [
  { 
    value: "480p", 
    label: "480p (SD)", 
    description: "Standard Definition",
    bitrate: "1000 kbps",
    resolution: "854x480"
  },
  { 
    value: "720p", 
    label: "720p (HD)", 
    description: "High Definition",
    bitrate: "2500 kbps",
    resolution: "1280x720"
  },
  { 
    value: "1080p", 
    label: "1080p (Full HD)", 
    description: "Full High Definition",
    bitrate: "5000 kbps",
    resolution: "1920x1080"
  },
  { 
    value: "1440p", 
    label: "1440p (2K)", 
    description: "Quad HD",
    bitrate: "10000 kbps",
    resolution: "2560x1440"
  },
  { 
    value: "2160p", 
    label: "2160p (4K)", 
    description: "Ultra HD",
    bitrate: "20000 kbps",
    resolution: "3840x2160"
  },
];

export function AdjustmentView() {
  const { settings, updateFps, updateQuality, updateCustomBitrate } = useProjectSettingsStore();
  const [isProcessing, setIsProcessing] = useState(false);

  const selectedQualityInfo = QUALITY_PRESETS.find(q => q.value === settings.quality);
  const selectedFpsInfo = FPS_OPTIONS.find(f => f.value === settings.fps);

  const handleApplyAdjustments = async () => {
    setIsProcessing(true);
    toast.info("Applying video adjustments...");

    try {
      // In a real implementation, this would process the video with new settings
      // For now, we'll just simulate the process
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      toast.success(
        `Video adjustments applied: ${settings.fps} FPS, ${settings.quality} quality`
      );
    } catch (error) {
      toast.error("Failed to apply adjustments");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExportSettings = () => {
    const exportSettings = {
      fps: settings.fps,
      quality: settings.quality,
      bitrate: settings.customBitrate,
      resolution: selectedQualityInfo?.resolution,
    };

    const blob = new Blob([JSON.stringify(exportSettings, null, 2)], { 
      type: "application/json" 
    });
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "video-settings.json";
    a.click();
    URL.revokeObjectURL(url);
    
    toast.success("Settings exported successfully");
  };

  return (
    <div className="h-full flex flex-col">
      <div 
        className="flex-1 overflow-y-scroll custom-scrollbar"
        style={{ 
          maxHeight: 'calc(100vh - 250px)'
        }}
      >
        <div className="p-4 pb-6 space-y-4">
        {/* Header */}
        <div className="flex items-center gap-2 mb-4">
          <Settings className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Video Adjustments</h2>
        </div>

        {/* FPS Settings */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Film className="h-4 w-4" />
              Frame Rate (FPS)
            </CardTitle>
            <CardDescription>
              Adjust the frame rate for smoother or more cinematic playback
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              {FPS_OPTIONS.map((fps) => (
                <Button
                  key={fps.value}
                  variant={settings.fps === fps.value ? "default" : "outline"}
                  size="sm"
                  onClick={() => updateFps(fps.value)}
                  className="justify-start"
                >
                  <span className="font-medium">{fps.label}</span>
                </Button>
              ))}
            </div>
            
            {selectedFpsInfo && (
              <div className="p-3 bg-muted rounded-md">
                <p className="text-sm text-muted-foreground">
                  {selectedFpsInfo.description}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quality Settings */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Zap className="h-4 w-4" />
              Video Quality
            </CardTitle>
            <CardDescription>
              Choose output resolution and quality settings
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-xs text-muted-foreground mb-2">
              Available quality options: {QUALITY_PRESETS.length} presets
            </div>
            <div className="space-y-2">
              {QUALITY_PRESETS.map((quality, index) => (
                <div
                  key={quality.value}
                  className={`p-3 rounded-md border cursor-pointer transition-colors ${
                    settings.quality === quality.value
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  }`}
                  onClick={() => {
                    console.log('Quality selected:', quality.value); // Debug log
                    updateQuality(quality.value);
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">{quality.label}</div>
                      <div className="text-sm text-muted-foreground">
                        {quality.description}
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge variant="secondary" className="text-xs">
                        {quality.resolution}
                      </Badge>
                      <div className="text-xs text-muted-foreground mt-1">
                        {quality.bitrate}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            <Separator />
            
            <div className="space-y-3">
              <Label className="text-sm font-medium">
                Custom Bitrate: {settings.customBitrate} kbps
              </Label>
              <Slider
                value={[settings.customBitrate]}
                onValueChange={(value) => updateCustomBitrate(value[0])}
                max={30000}
                min={500}
                step={100}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Low (500 kbps)</span>
                <span>High (30000 kbps)</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Preview Settings */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Current Settings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <Label className="text-muted-foreground">Frame Rate</Label>
                <p className="font-medium">{settings.fps} FPS</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Quality</Label>
                <p className="font-medium">{settings.quality}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Resolution</Label>
                <p className="font-medium">{selectedQualityInfo?.resolution}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Bitrate</Label>
                <p className="font-medium">{settings.customBitrate} kbps</p>
              </div>
            </div>
          </CardContent>
        </Card>
        </div>
      </div>

      {/* Actions */}
      <div className="p-4 border-t bg-muted/30">
        <div className="flex gap-2">
          <Button
            onClick={handleApplyAdjustments}
            disabled={isProcessing}
            className="flex-1"
          >
            {isProcessing ? "Processing..." : "Apply Adjustments"}
          </Button>
          <Button
            variant="outline"
            onClick={handleExportSettings}
            className="flex-shrink-0"
          >
            <Download className="h-4 w-4 mr-2" />
            Export Settings
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Note: Adjustments will be applied to the final exported video
        </p>
      </div>
    </div>
  );
} 