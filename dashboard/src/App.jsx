// dashboard/src/App.jsx
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider }     from './context/AuthContext.jsx';
import Login                from './pages/Login.jsx';
import Onboarding           from './pages/Onboarding.jsx';
import CustomerList         from './pages/CustomerList.jsx';
import ProfileEditor        from './pages/ProfileEditor.jsx';
import History              from './pages/History.jsx';
import Import               from './pages/Import.jsx';
import InterventionQueue    from './pages/InterventionQueue.jsx';
import Timeline             from './pages/Timeline.jsx';
import CohortAnalysis       from './pages/CohortAnalysis.jsx';
import ProtectedRoute       from './components/ProtectedRoute.jsx';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login"      element={<Login />} />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/"           element={<ProtectedRoute><CustomerList /></ProtectedRoute>} />
          <Route path="/customers/:customerId/profile"  element={<ProtectedRoute><ProfileEditor /></ProtectedRoute>} />
          <Route path="/customers/:customerId/history"  element={<ProtectedRoute><History /></ProtectedRoute>} />
          <Route path="/customers/:customerId/timeline" element={<ProtectedRoute><Timeline /></ProtectedRoute>} />
          <Route path="/import"        element={<ProtectedRoute><Import /></ProtectedRoute>} />
          <Route path="/interventions" element={<ProtectedRoute><InterventionQueue /></ProtectedRoute>} />
          <Route path="/cohorts"       element={<ProtectedRoute><CohortAnalysis /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
