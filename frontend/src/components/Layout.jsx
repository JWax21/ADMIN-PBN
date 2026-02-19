import React from "react";
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { BsHandIndexThumb, BsGear, BsFileText } from "react-icons/bs";
import { MdPeopleAlt } from "react-icons/md";
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
            <NavLink to="/shopping-sessions" className="nav-link">
              <span className="nav-icon">
                <FaShoppingCart />
              </span>
              Monetization
            </NavLink>
          </div>

          <div className="nav-section">
            <div className="nav-section-label">Site</div>
            <NavLink to="/page-index" className="nav-link">
              <span className="nav-icon">
                <BsHandIndexThumb />
              </span>
              Sitemap
            </NavLink>
            <NavLink to="/technical" className="nav-link">
              <span className="nav-icon">
                <BsGear />
              </span>
              Technical
            </NavLink>
            <NavLink to="/content" className="nav-link">
              <span className="nav-icon">
                <BsFileText />
              </span>
              Content
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
