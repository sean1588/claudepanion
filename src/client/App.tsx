import { Routes, Route, Navigate } from "react-router-dom";
import Sidebar from "./components/Sidebar";
import TopBar from "./components/TopBar";
import CompanionRoute from "./pages/CompanionRoute";
import NewEntity from "./pages/NewEntity";
import EntityDetail from "./pages/EntityDetail";
import EntityList from "./pages/EntityList";
import Install from "./pages/Install";
import BuildEvolve from "./pages/BuildEvolve";
import BuildIterate from "./pages/BuildIterate";

export default function App() {
  return (
    <div className="wb-app">
      <Sidebar />
      <main className="wb-main">
        <TopBar />
        <div className="wb-content">
          <Routes>
            <Route path="/" element={<Navigate to="/c/build" replace />} />
            <Route path="/install" element={<Install />} />
            <Route path="/c/:companion" element={<CompanionRoute />} />
            <Route path="/c/build/evolve" element={<BuildEvolve />} />
            <Route path="/c/build/iterate/:target" element={<BuildIterate />} />
            <Route path="/c/:companion/runs" element={<EntityList />} />
            <Route path="/c/:companion/new" element={<NewEntity />} />
            <Route path="/c/:companion/:id" element={<EntityDetail />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}
