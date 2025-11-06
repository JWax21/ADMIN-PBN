import React from "react";
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { BsGraphUpArrow } from "react-icons/bs";
import { FiClipboard } from "react-icons/fi";
import { FaUsers, FaBoxes } from "react-icons/fa";
import { IoFastFood } from "react-icons/io5";
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
          <h2>Admin Dashboard</h2>
        </div>
        <nav className="sidebar-nav">
          <NavLink to="/" className="nav-link">
            <span className="nav-icon">
              <BsGraphUpArrow />
            </span>
            KPI
          </NavLink>
          <NavLink to="/users" className="nav-link">
            <span className="nav-icon">
              <FaUsers />
            </span>
            Subscribers
          </NavLink>
          <NavLink to="/orders" className="nav-link">
            <span className="nav-icon">
              <FiClipboard />
            </span>
            Orders
          </NavLink>
          <NavLink to="/snack-catalogue" className="nav-link">
            <span className="nav-icon">
              <IoFastFood />
            </span>
            Snack Catalogue
          </NavLink>
          <NavLink to="/inventory" className="nav-link">
            <span className="nav-icon">
              <FaBoxes />
            </span>
            Inventory
          </NavLink>
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
