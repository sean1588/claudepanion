import { Routes, Route, Navigate } from "react-router-dom";
import Sidebar from "./components/Sidebar";
import CompanionRoute from "./pages/CompanionRoute";
import NewEntity from "./pages/NewEntity";
import EntityDetail from "./pages/EntityDetail";
import EntityList from "./pages/EntityList";
import Install from "./pages/Install";

export default function App() {
  return (
    <div className="app">
      <Sidebar />
      <main className="app-main">
        <Routes>
          <Route path="/" element={<Navigate to="/c/build" replace />} />
          <Route path="/install" element={<Install />} />
          <Route path="/c/:companion" element={<CompanionRoute />} />
          <Route path="/c/:companion/runs" element={<EntityList />} />
          <Route path="/c/:companion/new" element={<NewEntity />} />
          <Route path="/c/:companion/:id" element={<EntityDetail />} />
        </Routes>
      </main>
    </div>
  );
}
