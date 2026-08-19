import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = { children: ReactNode };
type State = { failed: boolean };

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, details: ErrorInfo) {
    console.error("AulaFlow UI error", error, details.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;

    return (
      <main className="app-error-boundary" role="alert">
        <span>ALGO NO SALIÓ COMO ESPERÁBAMOS</span>
        <h1>No pudimos mostrar esta sección</h1>
        <p>
          Tus datos no se perdieron. Recarga la página para volver a intentarlo
          o regresa al inicio de AulaFlow.
        </p>
        <div>
          <button onClick={() => window.location.reload()}>Recargar página</button>
          <a href="/">Volver al inicio</a>
        </div>
      </main>
    );
  }
}
