import React from "react";
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { BsHandIndexThumb } from "react-icons/bs";
import { MdPeopleAlt } from "react-icons/md";
import { MdAbc } from "react-icons/md";
import { PiRanking, PiComputerTowerBold } from "react-icons/pi";
import { FaCompressArrowsAlt } from "react-icons/fa";
import { FaStar } from "react-icons/fa6";
import { MdGroups } from "react-icons/md";
import { FaShareAlt } from "react-icons/fa";
import { FaShoppingCart } from "react-icons/fa";
import "./Layout.css";

const Layout = () => {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem("admin_token");
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
            <NavLink to="/traffic-sources" className="nav-link">
              <span className="nav-icon">
                <FaCompressArrowsAlt />
              </span>
              Traffic Sources
            </NavLink>
            <NavLink to="/power-users" className="nav-link">
              <span className="nav-icon">
                <FaStar />
              </span>
              Power Users
            </NavLink>
            <NavLink to="/shopping-sessions" className="nav-link">
              <span className="nav-icon">
                <FaShoppingCart />
              </span>
              Shopping Sessions
            </NavLink>
          </div>

          <div className="nav-section">
            <div className="nav-section-label">Site</div>
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
            <NavLink to="/audience" className="nav-link">
              <span className="nav-icon">
                <MdGroups />
              </span>
              Audience
            </NavLink>
          </div>

          <div className="nav-section">
            <div className="nav-section-label">Sources</div>
            <NavLink to="/page-rankings" className="nav-link">
              <span className="nav-icon">
                <MdAbc />
              </span>
              Google
            </NavLink>
            <NavLink to="/llm" className="nav-link">
              <span className="nav-icon">
                <PiComputerTowerBold />
              </span>
              LLM
            </NavLink>
            <NavLink to="/socials" className="nav-link">
              <span className="nav-icon">
                <FaShareAlt />
              </span>
              Socials
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
