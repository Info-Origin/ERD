import { AppLayout } from "../components/layout/AppLayout";
import { ResizablePanels } from "../components/layout/ResizablePanels";
import { SchemaExplorer } from "../components/schema-explorer/SchemaExplorer";
import { ERDCanvas } from "../components/erd-canvas/ERDCanvas";
import { VerticalToolbar } from "../components/layout/VerticalToolbar";
import EditTableModal from "../components/modals/EditTableModal";
import { FKComparisonModal } from "../components/modals/FKComparisonModal";
import { Notification } from "../components/common/Notification";
import { useApp } from "../context/AppContext";
import { useVirtualSchema } from "../context/VirtualSchemaContext";
import { useState } from "react";

export const MainPage = () => {
  const { 
    sharedEditTableModal, 
    closeEditTableModal,
    fkComparisonModal,
    closeFKComparison,
    handleRevertFKChange,
    notifications,
    removeNotification
  } = useApp();
  const { originalSchema, workingSchema } = useVirtualSchema();
  
  // State to hold canvas control functions
  const [canvasControls, setCanvasControls] = useState({
    onZoomIn: null,
    onZoomOut: null,
    onFitView: null
  });

  return (
    <AppLayout>
      <ResizablePanels 
        left={<SchemaExplorer />} 
        toolbar={<VerticalToolbar {...canvasControls} />}
        right={<ERDCanvas onControlsReady={setCanvasControls} />}
      />

      {/* Shared Edit Table Modal - rendered at app level, outside React Flow */}
      <EditTableModal
        isOpen={sharedEditTableModal.isOpen}
        onClose={closeEditTableModal}
        tableName={sharedEditTableModal.tableName}
        schemaName={sharedEditTableModal.schemaName}
      />

      {/* FK Comparison Modal */}
      <FKComparisonModal
        isOpen={fkComparisonModal.isOpen}
        onClose={closeFKComparison}
        comparisonResult={fkComparisonModal.comparisonResult}
        baselineSchema={originalSchema}
        virtualSchema={workingSchema}
        onRevertChange={handleRevertFKChange}
      />

      {/* Notification System */}
      <div className="notification-container notification-container-top-right">
        {notifications.map(notification => (
          <Notification
            key={notification.id}
            message={notification.message}
            type={notification.type}
            duration={5000}
            onClose={() => removeNotification(notification.id)}
            position="top-right"
          />
        ))}
      </div>
    </AppLayout>
  );
};

export default MainPage;
