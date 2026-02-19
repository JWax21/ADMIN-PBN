import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { useState, useEffect } from "react";
import Layout from "./components/Layout";
import Visitors from "./pages/Visitors";
import PageIndex from "./pages/PageIndex";
import EngagementMetrics from "./pages/EngagementMetrics";
import ConversionMetrics from "./pages/ConversionMetrics";
import TechnicalPerformance from "./pages/TechnicalPerformance";
import ContentInsights from "./pages/ContentInsights";
import SEOMetrics from "./pages/SEOMetrics";
import ShoppingSessions from "./pages/ShoppingSessions";
import Login from "./pages/Login";
import apiClient from "./api/axios";
import "./App.css";

function App() {
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is authenticated
    const checkAuth = async () => {
      const token = localStorage.getItem("admin_token");
      
      if (!token) {
        setAuthenticated(false);
        setLoading(false);
        return;
      }

      try {
        const response = await apiClient.get("/api/auth/verify", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        
        if (response.data.success && response.data.authenticated) {
          setAuthenticated(true);
          
          // Check if token is about to expire (within 1 hour)
          if (response.data.expiresAt) {
            const expiresAt = response.data.expiresAt;
            const oneHourFromNow = Date.now() + (60 * 60 * 1000);
            if (expiresAt < oneHourFromNow) {
              console.warn("Token expiring soon, user will need to re-login");
            }
          }
        } else {
          localStorage.removeItem("admin_token");
          setAuthenticated(false);
        }
      } catch (error) {
        // Token expired or invalid
        localStorage.removeItem("admin_token");
        setAuthenticated(false);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        <Route
          path="/login"
          element={!authenticated ? <Login /> : <Navigate to="/" />}
        />

        <Route
          path="/"
          element={authenticated ? <Layout /> : <Navigate to="/login" />}
        >
          <Route index element={<Navigate to="/visitors" replace />} />
          <Route path="visitors" element={<Visitors />} />
          <Route path="traffic-sources" element={<Navigate to="/visitors" replace />} />
          <Route path="engagement" element={<EngagementMetrics />} />
          <Route path="conversion" element={<ConversionMetrics />} />
          <Route path="technical" element={<TechnicalPerformance />} />
          <Route path="content" element={<ContentInsights />} />
          <Route path="seo" element={<SEOMetrics />} />
          <Route path="power-users" element={<Navigate to="/visitors?view=audience" replace />} />
          <Route path="audience" element={<Navigate to="/visitors" replace />} />
          <Route path="page-index" element={<PageIndex />} />
          <Route path="page-rankings" element={<Navigate to="/visitors" replace />} />
          <Route path="top-pages" element={<Navigate to="/visitors" replace />} />
          <Route path="llm" element={<Navigate to="/visitors" replace />} />
          <Route path="socials" element={<Navigate to="/visitors" replace />} />
          <Route path="shopping-sessions" element={<ShoppingSessions />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
