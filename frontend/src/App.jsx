import { AppProvider } from "./context/AppContext";
import { ThemeProvider } from "./context/ThemeContext";
import { VirtualSchemaProvider } from "./context/VirtualSchemaContext";
import { RelationshipCreationProvider } from "./context/RelationshipCreationContext";
import { ConnectionProvider } from "./context/ConnectionContext";
import { ErrorBoundary } from "./components/common/ErrorBoundary";
import { MainPage } from "./pages/MainPage";

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <ConnectionProvider>
          <VirtualSchemaProvider>
            <RelationshipCreationProvider>
              <AppProvider>
                <MainPage />
              </AppProvider>
            </RelationshipCreationProvider>
          </VirtualSchemaProvider>
        </ConnectionProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
