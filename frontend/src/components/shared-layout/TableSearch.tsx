import { Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { normalizeSearchText } from "../../shared/utils/text";

export function TableSearch() {
  const [term, setTerm] = useState("");
  const [result, setResult] = useState({ visible: 0, total: 0 });
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const applyFilter = () => {
      const rows = [
        ...document.querySelectorAll<HTMLElement>(
          ".dashboard-content table tbody tr",
        ),
      ];
      const query = normalizeSearchText(term);
      let visible = 0;

      rows.forEach((row) => {
        const matches =
          !query || normalizeSearchText(row.innerText).includes(query);
        row.hidden = !matches;
        if (matches) visible += 1;
      });
      setResult({ visible, total: rows.length });
    };

    applyFilter();
    const root = document.querySelector(".dashboard-content");
    const observer = root ? new MutationObserver(applyFilter) : null;
    observer?.observe(root!, { childList: true, subtree: true });
    return () => observer?.disconnect();
  }, [term]);

  useEffect(() => {
    const focusSearch = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        input.current?.focus();
      }
    };
    window.addEventListener("keydown", focusSearch);
    return () => window.removeEventListener("keydown", focusSearch);
  }, []);

  return (
    <label
      className={term ? "table-global-search active" : "table-global-search"}
    >
      <Search />
      <input
        ref={input}
        value={term}
        onChange={(event) => setTerm(event.target.value)}
        placeholder="Buscar en la tabla actual…"
      />
      {term ? (
        <>
          <span>
            {result.visible}/{result.total}
          </span>
          <button
            type="button"
            onClick={() => setTerm("")}
            aria-label="Limpiar búsqueda"
          >
            <X />
          </button>
        </>
      ) : (
        <kbd>Ctrl K</kbd>
      )}
    </label>
  );
}
