import {
  Atom,
  BookOpen,
  BrainCircuit,
  Database,
  Gauge,
  Grid3X3,
  Layers3,
  RefreshCcw,
  Search,
  Sparkles,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { periodicElements } from "./data/elements";
import { getInitialMaterials, toUiMaterial } from "./materials-data.js";

type UiMaterial = ReturnType<typeof toUiMaterial>;

async function loadCachedMaterials() {
  try {
    const response = await fetch("/data/materials-summary.json", { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`cache unavailable: ${response.status}`);
    }
    const payload = await response.json();
    if (!Array.isArray(payload.materials) || payload.materials.length === 0) {
      throw new Error("cache empty");
    }
    return payload.materials.map(toUiMaterial) as UiMaterial[];
  } catch {
    return getInitialMaterials().map(toUiMaterial) as UiMaterial[];
  }
}

function Header() {
  return (
    <header className="topbar">
      <div className="brand-block">
        <div className="brand-orb" aria-hidden="true">
          <Sparkles size={25} />
        </div>
        <div>
          <h1>Material Crystal Studio</h1>
          <p>Materials Project powered lattice explorer</p>
        </div>
      </div>

      <nav className="top-nav" aria-label="Primary">
        <a href="#periodic">
          <Grid3X3 size={22} />
          <span>Elements</span>
        </a>
        <a href="#crystal">
          <Layers3 size={22} />
          <span>Crystal</span>
        </a>
        <a href="#properties">
          <Gauge size={22} />
          <span>Properties</span>
        </a>
        <a href="#research">
          <BrainCircuit size={22} />
          <span>AI Notes</span>
        </a>
      </nav>
    </header>
  );
}

function PeriodicTable({
  selected,
  onToggle,
}: {
  selected: string[];
  onToggle: (symbol: string) => void;
}) {
  return (
    <div className="periodic-grid" id="periodic">
      {periodicElements.map((element) => (
        <button
          key={element.symbol}
          type="button"
          className={`element-tile category-${element.category}${selected.includes(element.symbol) ? " is-selected" : ""}`}
          style={{ gridColumn: element.group, gridRow: element.period }}
          onClick={() => onToggle(element.symbol)}
          title={element.name}
        >
          <span>{element.atomicNumber}</span>
          <strong>{element.symbol}</strong>
          <em>{element.name}</em>
        </button>
      ))}
    </div>
  );
}

function LeftRail({
  materials,
  selectedMaterial,
  selectedElements,
  loading,
  onSelectMaterial,
  onToggleElement,
  onSearch,
  onClear,
}: {
  materials: UiMaterial[];
  selectedMaterial: UiMaterial;
  selectedElements: string[];
  loading: boolean;
  onSelectMaterial: (id: string) => void;
  onToggleElement: (symbol: string) => void;
  onSearch: () => void;
  onClear: () => void;
}) {
  return (
    <aside className="left-rail">
      <section className="panel selector-panel">
        <div className="panel-heading">
          <span>
            <Grid3X3 size={17} />
            Periodic Table
          </span>
          <small>{selectedElements.length ? selectedElements.join("-") : "pick 1+"}</small>
        </div>
        <div className="periodic-scroll">
          <PeriodicTable selected={selectedElements} onToggle={onToggleElement} />
        </div>
        <div className="element-actions">
          <button type="button" className="primary-action" onClick={onSearch} disabled={loading || selectedElements.length < 1}>
            <Search size={17} />
            {loading ? "Querying" : "Search MP"}
          </button>
          <button type="button" onClick={onClear}>
            Clear
          </button>
        </div>
      </section>

      <section className="panel material-panel">
        <div className="panel-heading">
          <span>
            <Database size={17} />
            Compounds
          </span>
          <small>{materials.length} docs</small>
        </div>
        <div className="material-list">
          {materials.map((material) => (
            <button
              className={`material-row ${selectedMaterial.id === material.id ? "is-active" : ""}`}
              type="button"
              key={material.id}
              onClick={() => onSelectMaterial(material.id)}
            >
              <span className="mini-lattice" style={{ "--a": material.theme[0], "--b": material.theme[1] } as React.CSSProperties} />
              <span className="material-copy">
                <strong>{material.formula}</strong>
                <span>{material.id} / {material.spaceGroup}</span>
              </span>
              <b>{material.atomCount}</b>
            </button>
          ))}
        </div>
      </section>
    </aside>
  );
}

function Stage({ material }: { material: UiMaterial }) {
  return (
    <main className="stage-column" id="crystal">
      <section className="stage-panel">
        <div className="stage-title">
          <div>
            <span className="terminal-line">&gt; selected_material</span>
            <h2>{material.formula}</h2>
            <p>{material.meta}</p>
          </div>

          <div className="view-card">
            <span>Renderer</span>
            <strong>Crystal Toolkit</strong>
            <small>MP-compatible rendering / black studio skin</small>
          </div>
        </div>

        <div className="canvas-wrap">
          <iframe
            key={material.id}
            className="ct-viewer-frame"
            title={`${material.formula} Crystal Toolkit viewer`}
            src={`/ct-viewer/${encodeURIComponent(material.id)}`}
            loading="eager"
            referrerPolicy="no-referrer"
            allowTransparency={true}
          />
        </div>

        <div className="stage-toolbar">
          <button type="button">
            <RefreshCcw size={18} />
            MP / Crystal Toolkit viewer
          </button>
          <button type="button">Black studio skin</button>
          <button type="button">CrystalNN bonding</button>
        </div>
      </section>
    </main>
  );
}

function RightRail({ material, queryError }: { material: UiMaterial; queryError: string | null }) {
  const lattice = material.lattice;
  return (
    <aside className="right-rail" id="properties">
      {queryError && <section className="panel warning-panel">{queryError}</section>}

      <section className="panel details-panel">
        <div className="panel-heading">
          <span>
            <Gauge size={17} />
            Summary Properties
          </span>
        </div>
        <dl className="property-list">
          <div>
            <dt>Material ID</dt>
            <dd>{material.id}</dd>
          </div>
          <div>
            <dt>Band gap</dt>
            <dd>{material.bandGap}</dd>
          </div>
          <div>
            <dt>Energy above hull</dt>
            <dd>{material.hull}</dd>
          </div>
          <div>
            <dt>Density</dt>
            <dd>{material.density}</dd>
          </div>
          <div>
            <dt>Space group</dt>
            <dd>{material.spaceGroup}</dd>
          </div>
        </dl>
      </section>

      <section className="panel lattice-panel">
        <div className="panel-heading">
          <span>
            <Layers3 size={17} />
            Lattice Metrics
          </span>
        </div>
        <div className="metric-grid">
          <div>
            <span>a</span>
            <strong>{lattice.a.toFixed(3)} A</strong>
          </div>
          <div>
            <span>b</span>
            <strong>{lattice.b.toFixed(3)} A</strong>
          </div>
          <div>
            <span>c</span>
            <strong>{lattice.c.toFixed(3)} A</strong>
          </div>
          <div>
            <span>setting</span>
            <strong>
              {lattice.displayKind === "pymatgen-standard"
                ? "pymatgen std"
                : lattice.displayKind === "conventional-cubic"
                  ? "conv. cubic"
                  : "MP API"}
            </strong>
          </div>
          <div>
            <span>sites</span>
            <strong>{material.atomCount}</strong>
          </div>
        </div>
      </section>

      <section className="panel site-panel">
        <div className="panel-heading">
          <span>
            <Atom size={17} />
            Atomic Sites
          </span>
          <small>{material.elements.join(" / ")}</small>
        </div>
        <div className="site-table">
          {material.atoms.slice(0, 12).map((atom: any) => (
            <div key={atom.id}>
              <strong>{atom.element}</strong>
              <span>{atom.abc.map((value: number) => value.toFixed(3)).join(", ")}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="panel notes-panel" id="research">
        <div className="panel-heading">
          <span>
            <BookOpen size={17} />
            AI Research Notes
          </span>
        </div>
        <p>{material.researchNote}</p>
        <div className="prompt-list">
          <button type="button">Find defect-sensitive analogs</button>
          <button type="button">Compare band gap vs stability</button>
          <button type="button">Generate wafer inspection hypotheses</button>
        </div>
      </section>
    </aside>
  );
}

export default function App() {
  const [materials, setMaterials] = useState<UiMaterial[]>(() => getInitialMaterials().map(toUiMaterial) as UiMaterial[]);
  const [selectedId, setSelectedId] = useState(materials[0].id);
  const [selectedElements, setSelectedElements] = useState<string[]>(["Si", "O"]);
  const [loading, setLoading] = useState(false);
  const [queryError, setQueryError] = useState<string | null>(null);

  useEffect(() => {
    loadCachedMaterials().then((items) => {
      setMaterials(items);
      setSelectedId(items[0]?.id ?? selectedId);
    });
  }, []);

  const selectedMaterial = useMemo(
    () => materials.find((material) => material.id === selectedId) ?? materials[0],
    [materials, selectedId],
  );

  function toggleElement(symbol: string) {
    setSelectedElements((current) => {
      if (current.includes(symbol)) {
        return current.filter((item) => item !== symbol);
      }
      return [...current, symbol].slice(-4);
    });
  }

  async function searchSelectedSystem() {
    if (selectedElements.length < 1) {
      return;
    }
    setLoading(true);
    setQueryError(null);
    try {
      const response = await fetch(`/api/materials/summary?elements=${selectedElements.join(",")}&limit=24`);
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Materials Project query failed.");
      }
      const nextMaterials = payload.materials.map(toUiMaterial) as UiMaterial[];
      if (!nextMaterials.length) {
        throw new Error("Materials Project returned no compounds for this element set.");
      }
      setMaterials(nextMaterials);
      setSelectedId(nextMaterials[0].id);
    } catch (error) {
      setQueryError(error instanceof Error ? error.message : "Unknown query failure.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="app-shell" style={{ "--accent": selectedMaterial.theme[0], "--accent-2": selectedMaterial.theme[1] } as React.CSSProperties}>
      <div className="crt-overlay" aria-hidden="true" />
      <div className="grid-floor" aria-hidden="true" />
      <Header />
      <div className="app-grid">
        <LeftRail
          materials={materials}
          selectedMaterial={selectedMaterial}
          selectedElements={selectedElements}
          loading={loading}
          onSelectMaterial={setSelectedId}
          onToggleElement={toggleElement}
          onSearch={searchSelectedSystem}
          onClear={() => setSelectedElements([])}
        />
        <Stage material={selectedMaterial} />
        <RightRail material={selectedMaterial} queryError={queryError} />
      </div>
    </div>
  );
}
