export function RouteLoadingFallback() {
  return (
    <main
      className="page-state"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      Cargando la sección solicitada…
    </main>
  );
}
