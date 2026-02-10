import { AppProvider } from "./context/AppContext";
import { ThemeProvider } from "./context/ThemeContext";
import { VirtualSchemaProvider } from "./context/VirtualSchemaContext";
import { RelationshipCreationProvider } from "./context/RelationshipCreationContext";
import { ErrorBoundary } from "./components/common/ErrorBoundary";
import { MainPage } from "./pages/MainPage";

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <VirtualSchemaProvider>
          <RelationshipCreationProvider>
            <AppProvider>
              <MainPage />
            </AppProvider>
          </RelationshipCreationProvider>
        </VirtualSchemaProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
