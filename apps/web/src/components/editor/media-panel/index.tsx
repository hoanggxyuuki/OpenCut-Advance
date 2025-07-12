"use client";

import { TabBar } from "./tabbar";
import { MediaView } from "./views/media";
import { AudioView } from "./views/audio";
import { AdjustmentView } from "./views/adjustment";
import { useMediaPanelStore, Tab } from "./store";
import { TextView } from "./views/text";

export function MediaPanel() {
  const { activeTab } = useMediaPanelStore();

  const viewMap: Record<Tab, React.ReactNode> = {
    media: <MediaView />,
    audio: <AudioView />,
    text: <TextView />,
    stickers: (
      <div className="p-4 text-muted-foreground">
        Stickers view coming soon...
      </div>
    ),
    effects: (
      <div className="p-4 text-muted-foreground">
        Effects view coming soon...
      </div>
    ),
    transitions: (
      <div className="p-4 text-muted-foreground">
        Transitions view coming soon...
      </div>
    ),
    captions: (
      <div className="p-4 text-muted-foreground">
        Captions view coming soon...
      </div>
    ),
    filters: (
      <div className="p-4 text-muted-foreground">
        Filters view coming soon...
      </div>
    ),
    adjustment: <AdjustmentView />,
  };

  return (
    <div className="h-full flex flex-col bg-panel rounded-sm overflow-hidden">
      <TabBar />
      <div className="flex-1">{viewMap[activeTab]}</div>
    </div>
  );
}
