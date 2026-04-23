import { Routes, Route, Navigate } from "react-router-dom";
import Sidebar from "./components/Sidebar";
import EntityList from "./pages/EntityList";
import NewEntity from "./pages/NewEntity";
import EntityDetail from "./pages/EntityDetail";

export default function App() {
  return (
    <div className="app">
      <Sidebar />
      <main className="app-main">
        <Routes>
          <Route path="/" element={<Navigate to="/c/expense-tracker" replace />} />
          <Route path="/c/:companion" element={<EntityList />} />
          <Route path="/c/:companion/new" element={<NewEntity />} />
          <Route path="/c/:companion/:id" element={<EntityDetail />} />
        </Routes>
      </main>
    </div>
  );
}
