import React, { useState, useEffect } from "react";
import { FaCircleCheck } from "react-icons/fa6";
import { IoRefreshCircleSharp } from "react-icons/io5";
import apiClient from "../api/axios";
import BoxDetailsPanel from "../components/BoxDetailsPanel";
import "./Orders.css";

const Orders = () => {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [draftbox, setDraftbox] = useState(null);
  const [loadingDraftbox, setLoadingDraftbox] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [customersWithBoxes, setCustomersWithBoxes] = useState(new Map());
  const [customersWithPopped, setCustomersWithPopped] = useState(new Set());
  const [completedCustomers, setCompletedCustomers] = useState(new Set());
  const itemsPerPage = 50;

  useEffect(() => {
    fetchCustomers();
  }, []);

  useEffect(() => {
    if (customers.length > 0 && selectedMonth && selectedYear) {
      checkMonthBoxes();
    }
  }, [customers, selectedMonth, selectedYear]);

  const fetchCustomers = async () => {
    try {
      const response = await apiClient.get("/api/customers");
      if (response.data.success) {
        setCustomers(response.data.data);
      }
    } catch (error) {
      setError("Failed to fetch customers. Make sure your backend is running.");
      console.error("Error fetching customers:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleRowClick = async (customer) => {
    console.log("🔍 Row clicked, customer object:", customer);

    setSelectedCustomer(customer);
    setLoadingDraftbox(true);
    setDraftbox(null);

    try {
      // Use the customerID field from the customer object
      const customerId =
        customer.customerID || customer._id?.toString() || customer.email;

      console.log("📋 Customer ID extracted:", customerId);

      if (!customerId) {
        console.error("❌ No valid customer ID found!");
        setDraftbox(null);
        setLoadingDraftbox(false);
        return;
      }

      const response = await apiClient.get(
        `/api/customers/${customerId}/draftbox`,
        {
          params: {
            month: selectedMonth,
            year: selectedYear,
          },
        }
      );
      if (response.data.success) {
        setDraftbox(response.data.data);
      }
    } catch (error) {
      console.error("❌ Error fetching draftbox:", error);
      console.error("Error details:", {
        status: error.response?.status,
        message: error.message,
        customer: customer,
      });
      if (error.response?.status === 404) {
        setDraftbox(null); // No draftbox found for this month
      }
    } finally {
      setLoadingDraftbox(false);
    }
  };

  const handleClosePanel = () => {
    setSelectedCustomer(null);
    setDraftbox(null);
  };

  const handleCreateBox = async (customer) => {
    // Show loading state
    setLoadingDraftbox(true);

    try {
      const customerId =
        customer.customerID || customer._id?.toString() || customer.email;

      console.log("🚀 Creating box for customer:", customerId);

      const response = await apiClient.post(
        `/api/customers/${customerId}/create-box`,
        {
          month: selectedMonth,
          year: selectedYear,
        }
      );

      if (response.data.success) {
        console.log("✅ Box created successfully:", response.data);

        // Wait a moment for the box to be available in the database
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // Refresh the draftbox data after creation
        await handleRowClick(customer);

        // Refresh the month boxes to update row opacity
        await checkMonthBoxes();
      }
    } catch (error) {
      console.error("❌ Error creating box:", error);
      setLoadingDraftbox(false);

      const errorMessage = error.response?.data?.details
        ? JSON.stringify(error.response.data.details)
        : error.response?.data?.error || error.message;

      alert(`Error creating box: ${errorMessage}`);
    }
  };

  const checkMonthBoxes = async () => {
    try {
      const customerIDs = customers.map((c) => c.customerID).filter(Boolean);
      const response = await apiClient.post("/api/customers/check-month", {
        month: selectedMonth,
        year: selectedYear,
        customerIDs,
      });

      if (response.data.success) {
        // Create a Map with customerID -> boxSize
        const boxSizesMap = new Map();
        const boxSizes = response.data.data.boxSizes || {};

        // Add all customers with boxes to the map with their box size
        response.data.data.withBoxes.forEach((customerID) => {
          boxSizesMap.set(customerID, boxSizes[customerID] || 0);
        });

        setCustomersWithBoxes(boxSizesMap);
        setCustomersWithPopped(new Set(response.data.data.withPopped));
        setCompletedCustomers(new Set(response.data.data.withPacked || []));
      }
    } catch (error) {
      console.error("Error checking month boxes:", error);
    }
  };

  const handleMonthChange = (e) => {
    setSelectedMonth(parseInt(e.target.value));
  };

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const getStatusBadge = (status) => {
    const statusMap = {
      active: "badge-success",
      trialing: "badge-info",
      past_due: "badge-warning",
    };
    return statusMap[status] || "badge-secondary";
  };

  // Sort customers: white rows (no box) first, grey rows (has box) last
  const sortedCustomers = [...customers].sort((a, b) => {
    const aHasBox = customersWithBoxes.has(a.customerID);
    const bHasBox = customersWithBoxes.has(b.customerID);
    const aIsPacked = completedCustomers.has(a.customerID);
    const bIsPacked = completedCustomers.has(b.customerID);

    // Primary sort: by hasBox (no box first, box second)
    if (aHasBox && !bHasBox) return 1;
    if (!aHasBox && bHasBox) return -1;

    // Secondary sort: within same hasBox status, sort by packed (not packed first, packed second)
    if (aIsPacked && !bIsPacked) return 1;
    if (!aIsPacked && bIsPacked) return -1;

    return 0; // Keep original order if both have same status
  });

  // Pagination calculations
  const totalPages = Math.ceil(sortedCustomers.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentCustomers = sortedCustomers.slice(startIndex, endIndex);

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const toggleComplete = async (e, customerID) => {
    e.stopPropagation(); // Prevent row click

    // Check if customer has a box for this month
    if (!customersWithBoxes.has(customerID)) {
      alert(
        "Cannot mark as complete - no box exists for this customer in the selected month"
      );
      return;
    }

    const willBePacked = !completedCustomers.has(customerID);

    // Optimistic update
    setCompletedCustomers((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(customerID)) {
        newSet.delete(customerID);
      } else {
        newSet.add(customerID);
      }
      return newSet;
    });

    try {
      // Generate month integer (MYY format)
      const yearShort = selectedYear.toString().slice(-2);
      const monthInt = parseInt(`${selectedMonth}${yearShort}`);

      const response = await apiClient.patch(
        `/api/customers/${customerID}/draftbox/${monthInt}/packed`,
        { packed: willBePacked }
      );

      if (response.data.success) {
        console.log(
          `✅ Packed status updated: ${customerID} -> ${willBePacked}`
        );
      }
    } catch (error) {
      console.error("❌ Error updating packed status:", error);
      // Revert optimistic update on error
      setCompletedCustomers((prev) => {
        const newSet = new Set(prev);
        if (willBePacked) {
          newSet.delete(customerID);
        } else {
          newSet.add(customerID);
        }
        return newSet;
      });
      alert(
        `Error updating packed status: ${
          error.response?.data?.error || error.message
        }`
      );
    }
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading customers...</p>
      </div>
    );
  }

  return (
    <div className="orders-page">
      {error && <div className="alert alert-error">{error}</div>}

      <div className="stats-row">
        <div className="month-selector-container">
          <div className="month-selector-row">
            <label htmlFor="month-select" className="month-label">
              Month:
            </label>
            <select
              id="month-select"
              value={selectedMonth}
              onChange={handleMonthChange}
              className="month-dropdown-header"
            >
              <option value={1}>January</option>
              <option value={2}>February</option>
              <option value={3}>March</option>
              <option value={4}>April</option>
              <option value={5}>May</option>
              <option value={6}>June</option>
              <option value={7}>July</option>
              <option value={8}>August</option>
              <option value={9}>September</option>
              <option value={10}>October</option>
              <option value={11}>November</option>
              <option value={12}>December</option>
            </select>
            <IoRefreshCircleSharp
              className="refresh-icon"
              onClick={fetchCustomers}
              title="Refresh data"
            />
          </div>
          <p className="month-subtitle">
            Active customer subscriptions from MongoDB
          </p>
        </div>

        <div className="stat-box">
          <span className="stat-value">{customers.length}</span>
          <span className="stat-label">Total Orders</span>
        </div>
        <div className="stat-box">
          <span className="stat-value">{customersWithBoxes.size}</span>
          <span className="stat-label">Submitted</span>
        </div>
        <div className="stat-box">
          <span className="stat-value">
            {customers.length - customersWithBoxes.size}
          </span>
          <span className="stat-label">Unsubmitted</span>
        </div>
        <div className="stat-box">
          <span className="stat-value">{customersWithPopped.size}</span>
          <span className="stat-label">Customized</span>
        </div>
      </div>

      {customers.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <span className="empty-icon">📦</span>
            <h3>No active customers</h3>
            <p>No customers found with active, trialing, or past_due status.</p>
          </div>
        </div>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Complete</th>
                <th>Name</th>
                <th>Email</th>
                <th>Address</th>
                <th>Box Size</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {currentCustomers.map((customer) => {
                const hasBox = customersWithBoxes.has(customer.customerID);
                const boxSize =
                  customersWithBoxes.get(customer.customerID) || 0;
                const isComplete = completedCustomers.has(customer.customerID);
                return (
                  <tr
                    key={customer._id?.toString() || customer.email}
                    onClick={() => handleRowClick(customer)}
                    className={`clickable-row ${hasBox ? "row-has-box" : ""}`}
                  >
                    <td className="complete-cell">
                      <FaCircleCheck
                        className={`complete-icon ${
                          isComplete ? "complete-active" : "complete-inactive"
                        }`}
                        onClick={(e) => toggleComplete(e, customer.customerID)}
                      />
                    </td>
                    <td className="name-cell">{customer.fullName || "N/A"}</td>
                    <td>{customer.email || "N/A"}</td>
                    <td className="address-cell">
                      <span title={customer.fullAddress}>
                        {customer.fullAddress || "N/A"}
                      </span>
                    </td>
                    <td className="box-size-cell">
                      {boxSize > 0 ? boxSize : "-"}
                    </td>
                    <td>{formatDate(customer.created_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination Controls */}
      {customers.length > itemsPerPage && (
        <div className="pagination-controls">
          <button
            onClick={handlePrevPage}
            disabled={currentPage === 1}
            className="pagination-btn"
          >
            ← Previous
          </button>
          <span className="pagination-info">
            Page {currentPage} of {totalPages}
            <span className="page-details">
              ({startIndex + 1}-{Math.min(endIndex, customers.length)} of{" "}
              {customers.length})
            </span>
          </span>
          <button
            onClick={handleNextPage}
            disabled={currentPage === totalPages}
            className="pagination-btn"
          >
            Next →
          </button>
        </div>
      )}

      {/* Overlay when panel is open */}
      {selectedCustomer && (
        <div className="panel-overlay" onClick={handleClosePanel}></div>
      )}

      {/* Box Details Panel */}
      {selectedCustomer && (
        <BoxDetailsPanel
          draftbox={draftbox}
          customer={selectedCustomer}
          onClose={handleClosePanel}
          loading={loadingDraftbox}
          onCreateBox={() => handleCreateBox(selectedCustomer)}
          selectedMonth={selectedMonth}
          selectedYear={selectedYear}
          onRefresh={() => handleRowClick(selectedCustomer)}
        />
      )}
    </div>
  );
};

export default Orders;
