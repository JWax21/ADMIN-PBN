import React from "react";
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { BsHandIndexThumb } from "react-icons/bs";
import { MdPeopleAlt } from "react-icons/md";
import { MdAbc } from "react-icons/md";
import { PiRanking } from "react-icons/pi";
import { FaCompressArrowsAlt } from "react-icons/fa";
import { VscGraphLine } from "react-icons/vsc";
import { supabase } from "../config/supabase";
import "./Layout.css";

const Layout = () => {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-logo-container">
            <img src="/logo.png" alt="Protein Bar Nerd Logo" className="sidebar-logo" />
          </div>
          <h2>PROTEIN BAR NERD</h2>
        </div>
        <nav className="sidebar-nav">
          <div className="nav-section">
            <div className="nav-section-label">Traffic</div>
            <NavLink to="/visitors" className="nav-link">
              <span className="nav-icon">
                <MdPeopleAlt />
              </span>
              Visitors
            </NavLink>
            <NavLink to="/search-performance" className="nav-link">
              <span className="nav-icon">
                <VscGraphLine />
              </span>
              Search Performance
            </NavLink>
            <NavLink to="/traffic-sources" className="nav-link">
              <span className="nav-icon">
                <FaCompressArrowsAlt />
              </span>
              Traffic Sources
            </NavLink>
          </div>

          <div className="nav-section">
            <div className="nav-section-label">Google Rankings</div>
            <NavLink to="/page-index" className="nav-link">
              <span className="nav-icon">
                <BsHandIndexThumb />
              </span>
              Page Index
            </NavLink>
            <NavLink to="/top-pages" className="nav-link">
              <span className="nav-icon">
                <PiRanking />
              </span>
              Top Pages
            </NavLink>
            <NavLink to="/page-rankings" className="nav-link">
              <span className="nav-icon">
                <MdAbc />
              </span>
              Queries
            </NavLink>
          </div>
        </nav>
        <div className="sidebar-footer">
          <button
            onClick={handleLogout}
            className="btn btn-secondary logout-btn"
          >
            Logout
          </button>
        </div>
      </aside>

      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;
