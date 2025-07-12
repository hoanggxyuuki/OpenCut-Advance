"use client";

import Link from "next/link";
import { Button } from "./ui/button";
import { ChevronLeft, Download } from "lucide-react";
import { useTimelineStore } from "@/stores/timeline-store";
import { useProjectSettingsStore } from "@/stores/project-settings-store";
import { HeaderBase } from "./header-base";
import { formatTimeCode } from "@/lib/time";
import { useProjectStore } from "@/stores/project-store";
import { useMediaStore } from "@/stores/media-store";
import { videoExportService } from "@/lib/video-export";
import { toast } from "sonner";
import { useState } from "react";

export function EditorHeader() {
  const { getTotalDuration, tracks } = useTimelineStore();
  const { activeProject } = useProjectStore();
  const { mediaItems } = useMediaStore();
  const { settings } = useProjectSettingsStore();
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    if (!activeProject) {
      toast.error("No active project to export");
      return;
    }

    if (tracks.length === 0) {
      toast.error("No content to export. Add media to your timeline first.");
      return;
    }

    setIsExporting(true);
    
    try {
      toast.info("Starting video export...");
      
      // Show export settings
      toast.info(
        `Exporting with settings: ${settings.fps} FPS, ${settings.quality} quality, ${settings.customBitrate} kbps`
      );

      // Use the real video export service
      await videoExportService.exportVideo({
        projectName: activeProject.name,
        duration: getTotalDuration(),
        settings: settings,
        tracks: tracks,
        mediaItems: mediaItems,
      });

      toast.success(
        `Video exported successfully! "${activeProject.name}.mp4" with ${settings.quality} quality at ${settings.fps} FPS`
      );
      
    } catch (error) {
      console.error("Export failed:", error);
      toast.error("Export failed. Please try again.");
    } finally {
      setIsExporting(false);
    }
  };

  const leftContent = (
    <div className="flex items-center gap-2">
      <Link
        href="/projects"
        className="font-medium tracking-tight flex items-center gap-2 hover:opacity-80 transition-opacity"
      >
        <ChevronLeft className="h-4 w-4" />
        <span className="text-sm">{activeProject?.name}</span>
      </Link>
    </div>
  );

  const centerContent = (
    <div className="flex items-center gap-2 text-xs">
      <span>{formatTimeCode(getTotalDuration(), "HH:MM:SS:CS")}</span>
    </div>
  );

  const rightContent = (
    <nav className="flex items-center gap-2">
      <Button 
        size="sm" 
        variant="primary" 
        className="h-7 text-xs" 
        onClick={handleExport}
        disabled={isExporting}
      >
        <Download className={`h-4 w-4 ${isExporting ? 'animate-bounce' : ''}`} />
        <span className="text-sm">{isExporting ? 'Exporting...' : 'Export'}</span>
      </Button>
    </nav>
  );

  return (
    <HeaderBase
      leftContent={leftContent}
      centerContent={centerContent}
      rightContent={rightContent}
      className="bg-background h-[3.2rem] px-4"
    />
  );
}
