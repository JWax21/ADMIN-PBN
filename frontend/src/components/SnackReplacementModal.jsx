import React, { useState, useEffect } from "react";
import apiClient from "../api/axios";
import "./SnackReplacementModal.css";

const SnackReplacementModal = ({
  snack,
  customer,
  onClose,
  onReplace,
  replacing,
}) => {
  const [activeTab, setActiveTab] = useState("same");
  const [availableSnacks, setAvailableSnacks] = useState({
    sameCategory: [],
    otherCategories: [],
  });
  const [triedSnacks, setTriedSnacks] = useState({
    sameCategory: [],
    otherCategories: [],
  });
  const [loading, setLoading] = useState(true);
  const [currentCategory, setCurrentCategory] = useState(null);

  // Count selector state
  const [showCountSelector, setShowCountSelector] = useState(false);
  const [selectedNewSnackID, setSelectedNewSnackID] = useState(null);
  const [replaceCount, setReplaceCount] = useState(1);

  useEffect(() => {
    fetchAvailableSnacks();
  }, [snack, customer]);

  const fetchAvailableSnacks = async () => {
    try {
      setLoading(true);
      const customerId = customer.customerID || customer._id?.toString();

      const response = await apiClient.post(
        `/api/customers/${customerId}/available-snacks`,
        {
          currentSnackID: snack.SnackID,
        }
      );

      if (response.data.success) {
        setAvailableSnacks({
          sameCategory: response.data.data.sameCategory,
          otherCategories: response.data.data.otherCategories,
        });
        setTriedSnacks({
          sameCategory: response.data.data.triedSameCategory || [],
          otherCategories: response.data.data.triedOtherCategories || [],
        });
        setCurrentCategory(response.data.data.currentCategory);
      }
    } catch (error) {
      console.error("Error fetching available snacks:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSnackSelect = (newSnackID) => {
    const snackCount = snack.count || 1;

    if (snackCount > 1) {
      // Show count selector for multi-count snacks
      setSelectedNewSnackID(newSnackID);
      setReplaceCount(1); // Default to 1
      setShowCountSelector(true);
    } else {
      // Single count - replace immediately
      onReplace(snack.SnackID, newSnackID, 1);
    }
  };

  const handleConfirmReplace = () => {
    if (selectedNewSnackID) {
      onReplace(snack.SnackID, selectedNewSnackID, replaceCount);
      setShowCountSelector(false);
    }
  };

  const handleCancelCountSelector = () => {
    setShowCountSelector(false);
    setSelectedNewSnackID(null);
    setReplaceCount(1);
  };

  const incrementCount = () => {
    const maxCount = snack.count || 1;
    if (replaceCount < maxCount) {
      setReplaceCount(replaceCount + 1);
    }
  };

  const decrementCount = () => {
    if (replaceCount > 1) {
      setReplaceCount(replaceCount - 1);
    }
  };

  const extractFlavor = (snackId) => {
    if (!snackId) return "N/A";
    const parts = snackId.split("_");
    return parts.length > 1 ? parts[1] : snackId;
  };

  const formatMonth = (monthInt) => {
    if (!monthInt) return "";
    const monthStr = monthInt.toString();
    // Handle both MYY (925) and MMYY (1125) formats
    if (monthStr.length === 3) {
      // MYY format (e.g., 925 -> 09/25)
      const month = monthStr.substring(0, 1).padStart(2, "0");
      const year = monthStr.substring(1);
      return `${month}/${year}`;
    } else if (monthStr.length === 4) {
      // MMYY format (e.g., 1125 -> 11/25)
      const month = monthStr.substring(0, 2);
      const year = monthStr.substring(2);
      return `${month}/${year}`;
    }
    return monthStr;
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2>Replace Snack</h2>
            <p className="modal-subtitle">
              Current: <code>{snack.SnackID}</code> -{" "}
              {extractFlavor(snack.SnackID)}
            </p>
            <p className="modal-category">Category: {currentCategory}</p>
          </div>
          <button onClick={onClose} className="modal-close-btn">
            ✕
          </button>
        </div>

        <div className="modal-tabs">
          <button
            className={`tab-btn ${activeTab === "same" ? "active" : ""}`}
            onClick={() => setActiveTab("same")}
          >
            Same Category ({availableSnacks.sameCategory.length})
          </button>
          <button
            className={`tab-btn ${activeTab === "other" ? "active" : ""}`}
            onClick={() => setActiveTab("other")}
          >
            All Other Categories ({availableSnacks.otherCategories.length})
          </button>
        </div>

        <div className="modal-body">
          {loading ? (
            <div className="loading-state">
              <div className="spinner"></div>
              <p>Loading available snacks...</p>
            </div>
          ) : (
            <div className="modal-body-content">
              {/* Already Tried Section - Only for Same Category Tab */}
              {activeTab === "same" && triedSnacks.sameCategory.length > 0 && (
                <div className="tried-snacks-section">
                  <h4 className="section-title">
                    Already Tried in Category {currentCategory} (
                    {triedSnacks.sameCategory.length})
                  </h4>
                  <div className="tried-snacks-list">
                    {triedSnacks.sameCategory.map((snackEntry, index) => (
                      <div
                        key={`${snackEntry.SnackID}-${snackEntry.month}-${index}`}
                        className={`tried-snack-item ${
                          replacing ? "disabled" : ""
                        }`}
                        onClick={() =>
                          !replacing && handleSnackSelect(snackEntry.SnackID)
                        }
                      >
                        <code className="snack-sku tried">
                          {snackEntry.SnackID}
                        </code>
                        <span className="snack-flavor tried">
                          {extractFlavor(snackEntry.SnackID)}
                        </span>
                        <span className="snack-month">
                          {formatMonth(snackEntry.month)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Available Snacks Section Header */}
              {activeTab === "same" && (
                <div className="available-snacks-section">
                  <h4 className="section-title">
                    Available to Select ({availableSnacks.sameCategory.length})
                  </h4>
                </div>
              )}

              {/* Snacks List */}
              <div className="snacks-list">
                {activeTab === "same" &&
                  availableSnacks.sameCategory.map((snackID) => (
                    <div
                      key={snackID}
                      className={`snack-option ${replacing ? "disabled" : ""}`}
                      onClick={() => !replacing && handleSnackSelect(snackID)}
                    >
                      <code className="snack-sku">{snackID}</code>
                      <span className="snack-flavor">
                        {extractFlavor(snackID)}
                      </span>
                      <button className="select-btn" disabled={replacing}>
                        {replacing ? "Replacing..." : "Select"}
                      </button>
                    </div>
                  ))}

                {activeTab === "other" &&
                  availableSnacks.otherCategories.map((snackID) => (
                    <div
                      key={snackID}
                      className={`snack-option ${replacing ? "disabled" : ""}`}
                      onClick={() => !replacing && handleSnackSelect(snackID)}
                    >
                      <code className="snack-sku">{snackID}</code>
                      <span className="snack-flavor">
                        {extractFlavor(snackID)}
                      </span>
                      <span className="snack-category">
                        Cat: {snackID.substring(0, 2)}
                      </span>
                      <button className="select-btn" disabled={replacing}>
                        {replacing ? "Replacing..." : "Select"}
                      </button>
                    </div>
                  ))}

                {activeTab === "same" &&
                  availableSnacks.sameCategory.length === 0 && (
                    <div className="empty-state">
                      <p>No snacks available in the same category</p>
                    </div>
                  )}

                {activeTab === "other" &&
                  availableSnacks.otherCategories.length === 0 && (
                    <div className="empty-state">
                      <p>No snacks available in other categories</p>
                    </div>
                  )}
              </div>
            </div>
          )}
        </div>

        {/* Count Selector Overlay */}
        {showCountSelector && (
          <div className="count-selector-overlay">
            <div className="count-selector-box">
              <h3>How many would you like to replace?</h3>
              <p className="count-selector-subtitle">
                Replacing: <code>{snack.SnackID}</code> with{" "}
                <code>{selectedNewSnackID}</code>
              </p>
              <p className="count-info">
                Current count: <strong>{snack.count || 1}</strong>
              </p>

              <div className="count-controls">
                <button
                  className="count-btn"
                  onClick={decrementCount}
                  disabled={replaceCount <= 1}
                >
                  ▼
                </button>
                <div className="count-display">{replaceCount}</div>
                <button
                  className="count-btn"
                  onClick={incrementCount}
                  disabled={replaceCount >= (snack.count || 1)}
                >
                  ▲
                </button>
              </div>

              <div className="count-selector-actions">
                <button
                  className="cancel-count-btn"
                  onClick={handleCancelCountSelector}
                >
                  Cancel
                </button>
                <button
                  className="confirm-count-btn"
                  onClick={handleConfirmReplace}
                >
                  Confirm Replace
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SnackReplacementModal;
