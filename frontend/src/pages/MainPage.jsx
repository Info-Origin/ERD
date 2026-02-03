import { AppLayout } from "../components/layout/AppLayout";
import { ResizablePanels } from "../components/layout/ResizablePanels";
import { SchemaExplorer } from "../components/schema-explorer/SchemaExplorer";
import { ERDCanvas } from "../components/erd-canvas/ERDCanvas";
import EditTableModal from "../components/modals/EditTableModal";
import { useApp } from "../context/AppContext";

export const MainPage = () => {
  const { sharedEditTableModal, closeEditTableModal } = useApp();

  return (
    <AppLayout>
      <ResizablePanels left={<SchemaExplorer />} right={<ERDCanvas />} />

      {/* Shared Edit Table Modal - rendered at app level, outside React Flow */}
      <EditTableModal
        isOpen={sharedEditTableModal.isOpen}
        onClose={closeEditTableModal}
        tableName={sharedEditTableModal.tableName}
        schemaName={sharedEditTableModal.schemaName}
      />
    </AppLayout>
  );
};

export default MainPage;
