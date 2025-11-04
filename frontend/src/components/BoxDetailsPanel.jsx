import React, { useState } from "react";
import { IoAddCircle, IoCloseCircleOutline } from "react-icons/io5";
import SnackReplacementModal from "./SnackReplacementModal";
import apiClient from "../api/axios";
import "./BoxDetailsPanel.css";

const BoxDetailsPanel = ({
  draftbox,
  customer,
  onClose,
  loading,
  onCreateBox,
  selectedMonth,
  selectedYear,
  onRefresh,
}) => {
  const [selectedSnack, setSelectedSnack] = useState(null);
  const [showReplacementModal, setShowReplacementModal] = useState(false);
  const [replacing, setReplacing] = useState(false);

  const handleSnackClick = (snack) => {
    setSelectedSnack(snack);
    setShowReplacementModal(true);
  };

  const handleSnackReplace = async (oldSnackID, newSnackID, replaceCount) => {
    console.log(
      `🔄 Replacing ${oldSnackID} with ${newSnackID} (count: ${
        replaceCount || "all"
      })`
    );
    setReplacing(true);

    try {
      const customerId =
        customer.customerID || customer._id?.toString() || customer.email;

      // Calculate month integer (MYY format)
      const monthInt = parseInt(
        `${selectedMonth}${selectedYear.toString().slice(-2)}`
      );

      console.log(
        `  📤 Calling replace API for customer ${customerId}, month ${monthInt}`
      );
      console.log(`     Replacing ${replaceCount || "all"} of ${oldSnackID}`);

      const response = await apiClient.put(
        `/api/customers/${customerId}/draftbox/${monthInt}/replace-snack`,
        {
          oldSnackID,
          newSnackID,
          replaceCount: replaceCount || undefined, // Only send if specified
        }
      );

      if (response.data.success) {
        console.log("✅ Snack replaced successfully:", response.data);

        // Close modal
        setShowReplacementModal(false);
        setSelectedSnack(null);

        // Refresh the draftbox if onRefresh callback is provided
        if (onRefresh) {
          await onRefresh();
        }
      }
    } catch (error) {
      console.error("❌ Error replacing snack:", error);
      alert(
        `Error replacing snack: ${error.response?.data?.error || error.message}`
      );
    } finally {
      setReplacing(false);
    }
  };

  if (loading) {
    return (
      <div className="box-details-panel">
        <div className="panel-header">
          <h2>Loading...</h2>
          <button onClick={onClose} className="close-btn">
            <IoCloseCircleOutline />
          </button>
        </div>
        <div className="loading-container">
          <div className="spinner"></div>
        </div>
      </div>
    );
  }

  const getMonthName = (month) => {
    const months = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];
    return months[month - 1] || "Unknown";
  };

  if (!draftbox) {
    return (
      <div className="box-details-panel">
        <div className="panel-header">
          <div>
            <h2>No Box Found</h2>
            <p className="box-date">
              {customer?.fullName || customer?.firstName || "Customer"} -{" "}
              {getMonthName(selectedMonth)} {selectedYear}
            </p>
          </div>
          <button onClick={onClose} className="close-btn">
            <IoCloseCircleOutline />
          </button>
        </div>
        <div className="panel-content create-box-container">
          <div className="create-box-empty">
            <div className="plus-icon" onClick={onCreateBox}>
              <IoAddCircle />
            </div>
            <h3>Create Box</h3>
            <p>
              No box exists for this customer for {getMonthName(selectedMonth)}{" "}
              {selectedYear}.
            </p>
            <p className="create-hint">
              Click the + icon to generate a new box
            </p>
          </div>
        </div>
      </div>
    );
  }

  const formatDateTime = (dateString) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return date.toLocaleString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const extractBrand = (productLine) => {
    if (!productLine) return "N/A";
    const brand = productLine.split("_")[0];
    return brand.toUpperCase();
  };

  const extractFlavor = (snackId) => {
    if (!snackId) return "N/A";
    const parts = snackId.split("_");
    return parts.length > 1 ? parts[1] : snackId;
  };

  // Sort snacks by SnackID and calculate totals
  const sortedSnacks = draftbox.snacks
    ? [...draftbox.snacks].sort((a, b) => {
        const snackA = a.SnackID || "";
        const snackB = b.SnackID || "";
        return snackA.localeCompare(snackB);
      })
    : [];

  const totalSnacks = sortedSnacks.reduce(
    (sum, snack) => sum + (snack.count || 0),
    0
  );
  const uniqueSnacks = sortedSnacks.length;

  return (
    <div className="box-details-panel">
      <div className="panel-header">
        <div className="header-left">
          <h2>
            {customer?.firstName || ""} {customer?.lastName || ""}
          </h2>
          <p className="box-date">{formatDateTime(draftbox.createdAt)}</p>
        </div>

        <div className="header-stats">
          <div className="stats-section">
            <span className="stat-label">Total Snacks:</span>
            <span className="stat-badge">{totalSnacks}</span>
            <span className="stat-divider">|</span>
            <span className="stat-label">Unique Snacks:</span>
            <span className="stat-badge">{uniqueSnacks}</span>
          </div>
          <div className="custom-section">
            <span className="custom-label">Custom</span>
            <div
              className={`checkmark-icon ${
                draftbox.popped ? "popped" : "not-popped"
              }`}
              title={draftbox.popped ? "Popped: Yes" : "Popped: No"}
            >
              ✓
            </div>
          </div>
        </div>

        <button onClick={onClose} className="close-btn">
          <IoCloseCircleOutline />
        </button>
      </div>

      <div className="panel-content">
        {/* Customer Data Cards */}
        <div className="customer-data-cards">
          <div className="data-card">
            <h4 className="data-card-title">Allergens</h4>
            <div className="data-card-content">
              {customer?.allergens && customer.allergens.length > 0 ? (
                <div className="data-tags">
                  {customer.allergens.map((item, index) => (
                    <span key={index} className="data-tag allergen-tag">
                      {item}
                    </span>
                  ))}
                </div>
              ) : (
                <span className="data-empty">None</span>
              )}
            </div>
          </div>

          <div className="data-card">
            <h4 className="data-card-title">Dislikes</h4>
            <div className="data-card-content">
              {customer?.dislikes && customer.dislikes.length > 0 ? (
                <div className="data-tags">
                  {customer.dislikes.map((item, index) => (
                    <span key={index} className="data-tag dislike-tag">
                      {item}
                    </span>
                  ))}
                </div>
              ) : (
                <span className="data-empty">None</span>
              )}
            </div>
          </div>

          <div className="data-card">
            <h4 className="data-card-title">Staples</h4>
            <div className="data-card-content">
              {customer?.staples &&
              typeof customer.staples === "object" &&
              Object.keys(customer.staples).length > 0 ? (
                <div className="data-tags">
                  {Object.entries(customer.staples).map(
                    ([key, value], index) => (
                      <span key={index} className="staple-item">
                        <span className="staple-category">{key}</span>
                        <span className="data-tag staple-tag">
                          {value.toUpperCase()}
                        </span>
                        <span className="staple-separator">|</span>
                      </span>
                    )
                  )}
                </div>
              ) : (
                <span className="data-empty">None</span>
              )}
            </div>
          </div>

          <div className="data-card">
            <h4 className="data-card-title">Repeat Monthly</h4>
            <div className="data-card-content">
              {customer?.repeatMonthly &&
              Array.isArray(customer.repeatMonthly) &&
              customer.repeatMonthly.length > 0 ? (
                <div className="data-tags">
                  {customer.repeatMonthly.map((item, index) => (
                    <span key={index} className="data-tag repeat-tag">
                      {typeof item === "object"
                        ? item.SnackID || item.name || JSON.stringify(item)
                        : item}
                    </span>
                  ))}
                </div>
              ) : (
                <span className="data-empty">None</span>
              )}
            </div>
          </div>

          <div className="data-card">
            <h4 className="data-card-title">Vetoed Flavors</h4>
            <div className="data-card-content">
              {customer?.vetoedFlavors && customer.vetoedFlavors.length > 0 ? (
                <div className="data-tags">
                  {customer.vetoedFlavors.map((item, index) => (
                    <span key={index} className="data-tag vetoed-tag">
                      {item}
                    </span>
                  ))}
                </div>
              ) : (
                <span className="data-empty">None</span>
              )}
            </div>
          </div>
        </div>

        {/* Snacks Table */}
        <div className="snacks-section">
          {sortedSnacks.length > 0 ? (
            <div className="snacks-table-container">
              <table className="snacks-table">
                <thead>
                  <tr>
                    <th>Snack ID</th>
                    <th>Category</th>
                    <th>Brand</th>
                    <th>Flavor</th>
                    <th>Count</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedSnacks.map((snack, index) => {
                    const count = snack.count || 0;
                    const countBadgeClass =
                      count === 1 ? "count-badge-grey" : "count-badge-yellow";

                    // Check if this snack is in repeatMonthly array
                    const isRepeatMonthly =
                      customer?.repeatMonthly &&
                      Array.isArray(customer.repeatMonthly) &&
                      customer.repeatMonthly.some(
                        (item) => item.SnackID === snack.SnackID
                      );

                    return (
                      <tr
                        key={index}
                        onClick={() => handleSnackClick(snack)}
                        className={`snack-row-clickable ${
                          isRepeatMonthly ? "repeat-monthly-row" : ""
                        }`}
                      >
                        <td>
                          <code className="snack-id">
                            {snack.SnackID || "N/A"}
                          </code>
                        </td>
                        <td className="category-cell">
                          <span className="category-badge">
                            {snack.primaryCategory || "N/A"}
                          </span>
                        </td>
                        <td className="brand-cell">
                          {extractBrand(snack.productLine)}
                        </td>
                        <td className="flavor-cell">
                          {extractFlavor(snack.SnackID)}
                        </td>
                        <td className="count-cell">
                          <span className={`count-badge ${countBadgeClass}`}>
                            {count}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="no-snacks">No snacks in this box.</p>
          )}
        </div>
      </div>

      {/* Snack Replacement Modal */}
      {showReplacementModal && selectedSnack && (
        <SnackReplacementModal
          snack={selectedSnack}
          customer={customer}
          onClose={() => {
            setShowReplacementModal(false);
            setSelectedSnack(null);
          }}
          onReplace={handleSnackReplace}
          replacing={replacing}
        />
      )}
    </div>
  );
};

export default BoxDetailsPanel;
