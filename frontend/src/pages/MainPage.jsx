import { AppLayout } from "../components/layout/AppLayout";
import { ResizablePanels } from "../components/layout/ResizablePanels";
import { SchemaExplorer } from "../components/schema-explorer/SchemaExplorer";
import { ERDCanvas } from "../components/erd-canvas/ERDCanvas";
import { VerticalToolbar } from "../components/layout/VerticalToolbar";
import EditTableModal from "../components/modals/EditTableModal";
import { FKComparisonModal } from "../components/modals/FKComparisonModal";
import { DatabaseChangesModal } from "../components/modals/DatabaseChangesModal";
import { NewChangesAvailableModal } from "../components/modals/NewChangesAvailableModal";
import { UnsavedChangesModal } from "../components/modals/UnsavedChangesModal";
import { OutOfSyncModal } from "../components/modals/OutOfSyncModal";
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
    removeNotification,
    newChangesModal,
    closeNewChangesModal,
    handleRefreshFromNewChanges,
    unsavedChangesModal,
    closeUnsavedChangesModal,
    handleSaveAndSwitch,
    handleDiscardAndSwitch,
    outOfSyncModal,
    closeOutOfSyncModal,
    handleRefreshFromOutOfSync,
    databaseChangesModal,
    handleDatabaseChangesRefresh
  } = useApp();
  const { originalSchema, workingSchema } = useVirtualSchema();
  
  // State to hold canvas control functions
  const [canvasControls, setCanvasControls] = useState({
    onZoomIn: null,
    onZoomOut: null,
    onFitView: null,
    onResetLayout: null
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

      {/* Database Changes Modal - NEW */}
      <DatabaseChangesModal
        isOpen={databaseChangesModal.isOpen}
        changes={databaseChangesModal.changes}
        onRefresh={handleDatabaseChangesRefresh}
        isRefreshing={databaseChangesModal.isRefreshing}
      />

      {/* New Changes Available Modal */}
      <NewChangesAvailableModal
        isOpen={newChangesModal.isOpen}
        onRefresh={handleRefreshFromNewChanges}
        onCancel={closeNewChangesModal}
      />

      {/* Unsaved Changes Modal */}
      <UnsavedChangesModal
        isOpen={unsavedChangesModal.isOpen}
        onSave={handleSaveAndSwitch}
        onDiscard={handleDiscardAndSwitch}
        onCancel={closeUnsavedChangesModal}
      />

      {/* Out of Sync Modal */}
      <OutOfSyncModal
        isOpen={outOfSyncModal.isOpen}
        onRefresh={handleRefreshFromOutOfSync}
        onCancel={closeOutOfSyncModal}
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
