import { BrowserRouter, Routes, Route } from "react-router-dom";
import HomePage from "./pages/HomePage";
import AdminPage from "./pages/AdminPage";
import ReportPage from "./pages/ReportPage";
import MembersPage from "./pages/MembersPage";
import GuestsPage from "./pages/GuestsPage";
import ImportPage from "./pages/ImportPage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/admin/members" element={<MembersPage />} />
        <Route path="/admin/guests" element={<GuestsPage />} />
        <Route path="/admin/import" element={<ImportPage />} />
        <Route path="/report" element={<ReportPage />} />
      </Routes>
    </BrowserRouter>
  );
}
