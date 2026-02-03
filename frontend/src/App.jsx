import { AppProvider } from "./context/AppContext";
import { ThemeProvider } from "./context/ThemeContext";
import { VirtualSchemaProvider } from "./context/VirtualSchemaContext";
import { ErrorBoundary } from "./components/common/ErrorBoundary";
import { MainPage } from "./pages/MainPage";

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <VirtualSchemaProvider>
          <AppProvider>
            <MainPage />
          </AppProvider>
        </VirtualSchemaProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
