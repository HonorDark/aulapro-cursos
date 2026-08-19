import { BrowserRouter } from "react-router-dom";
import { AppRouter } from "./app/AppRouter";
import { AuthProvider } from "./context/AuthContext";
import { FeedbackProvider } from "./features/notifications/FeedbackProvider";
import { AppErrorBoundary } from "./app/AppErrorBoundary";
import "./styles";
export default function App() {
  return (
    <BrowserRouter>
      <FeedbackProvider>
        <AuthProvider>
          <AppErrorBoundary>
            <AppRouter />
          </AppErrorBoundary>
        </AuthProvider>
      </FeedbackProvider>
    </BrowserRouter>
  );
}
