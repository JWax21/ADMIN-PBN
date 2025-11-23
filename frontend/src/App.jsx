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
import PageRankings from "./pages/PageRankings";
import TopPages from "./pages/TopPages";
import TrafficSources from "./pages/TrafficSources";
import SearchPerformance from "./pages/SearchPerformance";
import Login from "./pages/Login";
import { supabase } from "./config/supabase";
import "./App.css";

function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
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
          element={!session ? <Login /> : <Navigate to="/" />}
        />

        <Route
          path="/"
          element={session ? <Layout /> : <Navigate to="/login" />}
        >
          <Route index element={<Navigate to="/visitors" replace />} />
          <Route path="visitors" element={<Visitors />} />
          <Route path="search-performance" element={<SearchPerformance />} />
          <Route path="traffic-sources" element={<TrafficSources />} />
          <Route path="page-index" element={<PageIndex />} />
          <Route path="page-rankings" element={<PageRankings />} />
          <Route path="top-pages" element={<TopPages />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
