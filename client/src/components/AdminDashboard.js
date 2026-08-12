import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";
import axios from "axios";
import "./AdminDashboard.css";
import { FaUserCheck, FaUserPlus } from "react-icons/fa6";
import { FaFilter } from "react-icons/fa6";
import BirthdayNotificationBell from "./BirthdayNotifications";

// IMAGES
import logoImg from "./new-logo.png";
import titleImg from "./logo-title-copy.png";

// LEVELS CONFIGURATION
const LEVEL_STRUCTURE = {
  Foundation: ["Level 1", "Level 2", "Level 3"],
  "Pre-Basic": ["Level 1", "Level 2", "Level 3"],
  Basic: ["Level 1", "Level 2", "Level 3"],
  Intermediate: ["Level 1", "Level 2", "Level 3"],
  Advanced: ["Level 1", "Level 2", "Level 3"],
};

// ==========================================
// 1. HELPER FUNCTIONS
// ==========================================

const formatDateForInput = (isoDate) => {
  if (!isoDate) return "";
  const date = new Date(isoDate);
  return date.toISOString().split("T")[0];
};

const formatDateShort = (dateInput) => {
  if (!dateInput) return "N/A";
  const date = new Date(dateInput);
  return date.toLocaleDateString("en-GB");
};

const isRegisteredInOrBefore = (regDate, currentMonth) => {
  if (!regDate) return true; // Fallback for old users
  const regYM = regDate.slice(0, 7);
  return regYM <= currentMonth;
};

// Returns true if a student's inactiveHistory covers the given month (fee should be ₹0).
const isStudentInactiveForMonth = (user, monthStr) => {
  const history = user.inactiveHistory || [];
  return history.some(entry => {
    const from = entry.inactiveFrom;
    const to = entry.inactiveTo; // null/undefined = still inactive
    return monthStr >= from && (!to || monthStr <= to);
  });
};

// Returns the fee that was in effect for a given month, using feeChangeHistory when available.
// Falls back to user.monthlyFee if no history exists (backwards compatible).
// Returns 0 for months where the student was inactive.
const getFeeForMonth = (user, monthStr) => {
  if (isStudentInactiveForMonth(user, monthStr)) return 0;
  const history = user.feeChangeHistory || [];
  if (history.length === 0) return Number(user.monthlyFee) || 0;

  // Walk the array once: track the best entry (greatest effectiveFrom <= monthStr).
  // For ties on effectiveFrom, the LAST entry in the array wins (most recently saved).
  let best = null;
  let earliest = null;
  for (const entry of history) {
    // Track earliest for the fallback below
    if (!earliest || entry.effectiveFrom < earliest.effectiveFrom) earliest = entry;

    if (entry.effectiveFrom <= monthStr) {
      if (!best || entry.effectiveFrom >= best.effectiveFrom) {
        best = entry;
      }
    }
  }

  if (best) return Number(best.fee) || 0;

  // monthStr is before all history entries — use the earliest recorded fee
  return Number(earliest?.fee) || Number(user.monthlyFee) || 0;
};

// ==========================================
// 2. LEAF COMPONENTS (Modals & Views)
// ==========================================

// --- INACTIVE REASON MODAL ---
const InactiveReasonModal = ({ userName, onConfirm, onCancel }) => {
  const [reason, setReason] = useState("");
  const [inactiveFrom, setInactiveFrom] = useState(new Date().toISOString().slice(0, 7));

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: "420px" }}>
        <div className="modal-header">
          <h3>Mark as Inactive</h3>
          <button className="close-modal" onClick={onCancel}>×</button>
        </div>
        <div style={{ padding: "20px" }}>
          <p style={{ color: "#64748b", fontSize: "0.9rem", marginTop: 0, marginBottom: "20px" }}>
            <strong>{userName}</strong> will be marked inactive. Fee will not be charged for inactive months.
          </p>
          <div className="form-group">
            <label>Inactive From Month</label>
            <input
              type="month"
              value={inactiveFrom}
              onChange={e => setInactiveFrom(e.target.value)}
              max={new Date().toISOString().slice(0, 7)}
              style={{ fontWeight: "bold" }}
            />
          </div>
          <div className="form-group">
            <label>Reason for Inactivity</label>
            <textarea
              placeholder="e.g. Family vacation, health issues, exams, relocated..."
              value={reason}
              onChange={e => setReason(e.target.value)}
              rows={3}
              style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #e2e8f0", resize: "vertical", fontSize: "0.9rem", boxSizing: "border-box" }}
            />
          </div>
        </div>
        <div className="modal-actions" style={{ justifyContent: "flex-end", padding: "0 20px 20px" }}>
          <button className="cancel-btn" onClick={onCancel}>Cancel</button>
          <button
            className="save-btn"
            style={{ width: "auto", padding: "10px 20px", background: "#ef4444", marginLeft: "10px" }}
            onClick={() => onConfirm({ reason, inactiveFrom })}
          >
            Confirm Inactive
          </button>
        </div>
      </div>
    </div>
  );
};

// --- CLASS MODAL ---
const ClassModal = ({
  teachers,
  existingClasses,
  initialData,
  onClose,
  onSuccess,
}) => {
  const [formData, setFormData] = useState({
    className: initialData ? initialData.className : "",
    level: initialData ? initialData.level : "",
    subLevel: initialData ? initialData.subLevel : "",
    teacher: initialData && initialData.teacher ? initialData.teacher._id : "",
    meetingLink: initialData ? initialData.meetingLink || "" : "",
    maxCapacity: initialData ? initialData.maxCapacity : 10,
    classMode: initialData ? (initialData.classMode || "online") : "online",
    schedule:
      initialData && initialData.schedule && initialData.schedule.length > 0
        ? initialData.schedule.map((s) => ({ day: s.day, time: s.time, link: s.link || "" }))
        : [
            { day: "Saturday", time: "10:00", link: "" },
            { day: "Wednesday", time: "17:00", link: "" },
          ],
  });

  const [availableSubLevels, setAvailableSubLevels] = useState([]);
  const [duplicateError, setDuplicateError] = useState("");

  useEffect(() => {
    if (formData.level && LEVEL_STRUCTURE[formData.level]) {
      setAvailableSubLevels(LEVEL_STRUCTURE[formData.level]);
    } else {
      setAvailableSubLevels([]);
    }
  }, [formData.level]);

  useEffect(() => {
    const checkDuplicate = () => {
      if (!formData.className) {
        setDuplicateError("");
        return;
      }
      const normalize = (str) => (str || "").toString().trim().toLowerCase();
      const isDuplicate = existingClasses.some((cls) => {
        if (initialData && cls._id === initialData._id) return false;
        return normalize(cls.className) === normalize(formData.className);
      });
      if (isDuplicate)
        setDuplicateError(`Name "${formData.className}" is already taken!`);
      else setDuplicateError("");
    };
    checkDuplicate();
  }, [formData.className, existingClasses, initialData]);

  const handleScheduleChange = (index, field, value) => {
    setFormData(prev => {
      const newSchedule = [...prev.schedule];
      newSchedule[index] = { ...newSchedule[index], [field]: value };
      return { ...prev, schedule: newSchedule };
    });
  };
  const addScheduleSlot = () => {
    setFormData(prev => ({
      ...prev,
      schedule: [...prev.schedule, { day: "Monday", time: "17:00", link: "" }],
    }));
  };
  const removeScheduleSlot = (index) => {
    setFormData(prev => ({
      ...prev,
      schedule: prev.schedule.filter((_, i) => i !== index),
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (duplicateError) return;
    try {
      if (initialData)
        await axios.put(
          `https://art-portal-7n6r.onrender.com/api/classes/${initialData._id}`,
          formData,
        );
      else
        await axios.post(
          "https://art-portal-7n6r.onrender.com/api/classes",
          formData,
        );
      onSuccess();
    } catch (err) {
      alert("⚠️ Error saving class");
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: "600px" }}>
        <div className="modal-header">
          <h3>{initialData ? "Edit Class" : "Create New Class"}</h3>
          <button className="close-modal" onClick={onClose}>
            ×
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label>Class Name</label>
              <input
                required
                placeholder="e.g. Oil Painting A"
                value={formData.className}
                onChange={(e) =>
                  setFormData(prev => ({ ...prev, className: e.target.value }))
                }
                className={duplicateError ? "input-error" : ""}
              />
            </div>
            <div className="form-group">
              <label>Max Capacity</label>
              <input
                type="number"
                required
                value={formData.maxCapacity}
                onChange={(e) =>
                  setFormData(prev => ({ ...prev, maxCapacity: e.target.value }))
                }
                style={{ width: "80px" }}
              />
            </div>
          </div>
          {duplicateError && (
            <div
              className="error-msg"
              style={{ marginTop: "-10px", marginBottom: "15px" }}
            >
              ⛔ {duplicateError}
            </div>
          )}
          <div className="form-group">
            <label>Class Mode *</label>
            <select
              value={formData.classMode}
              onChange={(e) => setFormData(prev => ({ ...prev, classMode: e.target.value }))}
              style={{ fontWeight: "bold" }}
            >
              <option value="online">🌐 Online</option>
              <option value="offline">🏫 Offline</option>
            </select>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Level</label>
              <select
                required
                value={formData.level}
                onChange={(e) =>
                  setFormData(prev => ({ ...prev, level: e.target.value, subLevel: "" }))
                }
              >
                <option value="">Select Level</option>
                {Object.keys(LEVEL_STRUCTURE).map((lvl) => (
                  <option key={lvl} value={lvl}>
                    {lvl}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Sub-Level</label>
              <select
                required
                value={formData.subLevel}
                onChange={(e) =>
                  setFormData(prev => ({ ...prev, subLevel: e.target.value }))
                }
                disabled={!formData.level}
              >
                <option value="">Select Sub-Level</option>
                {availableSubLevels.map((sub) => (
                  <option key={sub} value={sub}>
                    {sub}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div
            className="form-group class-schedule-section"
            style={{
              background: "#f8fafc",
              padding: "15px",
              borderRadius: "8px",
              marginTop: "15px",
              border: "1px solid #e2e8f0",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <label style={{ color: "#334155", fontWeight: "600" }}>
                Class Schedule
              </label>
              {formData.classMode === "offline" && (
                <span style={{ fontSize: "0.75rem", color: "#d97706", background: "#fef3c7", padding: "2px 8px", borderRadius: "8px", fontWeight: "600" }}>
                  🏫 Offline — no meeting links
                </span>
              )}
            </div>
            {formData.schedule.map((slot, index) => (
              <div
                key={index}
                className="schedule-slot-row"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "6px",
                  marginTop: "12px",
                  background: "#fff",
                  padding: "10px",
                  borderRadius: "6px",
                  border: "1px solid #e2e8f0",
                }}
              >
                <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                  <select
                    value={slot.day}
                    onChange={(e) =>
                      handleScheduleChange(index, "day", e.target.value)
                    }
                    style={{ flex: 1 }}
                  >
                    {[
                      "Monday",
                      "Tuesday",
                      "Wednesday",
                      "Thursday",
                      "Friday",
                      "Saturday",
                      "Sunday",
                    ].map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                  <input
                    type="time"
                    value={slot.time}
                    onChange={(e) =>
                      handleScheduleChange(index, "time", e.target.value)
                    }
                    style={{ flex: 1 }}
                  />
                  <button
                    type="button"
                    onClick={() => removeScheduleSlot(index)}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#ef4444",
                      cursor: "pointer",
                    }}
                  >
                    ✕
                  </button>
                </div>
                {formData.classMode !== "offline" && (
                  <input
                    type="url"
                    placeholder={`Meeting link for ${slot.day || "this slot"} (optional)`}
                    value={slot.link || ""}
                    onChange={(e) =>
                      handleScheduleChange(index, "link", e.target.value)
                    }
                    style={{ fontSize: "0.85rem", color: "#334155" }}
                  />
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={addScheduleSlot}
              style={{
                marginTop: "10px",
                fontSize: "0.85rem",
                color: "#0284c7",
                background: "none",
                border: "none",
                cursor: "pointer",
              }}
            >
              + Add Another Day
            </button>
          </div>
          {/* Per-slot meeting links are now inside each schedule slot above */}
          <div className="form-group">
            <label>Assign Teacher</label>
            <select
              required
              value={formData.teacher}
              onChange={(e) =>
                setFormData(prev => ({ ...prev, teacher: e.target.value }))
              }
            >
              <option value="">Select Teacher</option>
              {teachers.map((t) => (
                <option key={t._id} value={t._id}>
                  {t.fullName || t.username}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            className="save-btn"
            style={{ marginTop: "15px" }}
            disabled={!!duplicateError}
          >
            {initialData ? "Save Changes" : "Create Class"}
          </button>
        </form>
      </div>
    </div>
  );
};

// --- ASSIGN STUDENTS MODAL ---
const AssignStudentsModal = ({ classId, className, onClose, onRefresh }) => {
  const [students, setStudents] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // ✨ Filter State: 'available', 'this_class', 'other_class'
  const [filter, setFilter] = useState("available");

  const loadStudents = useCallback(async () => {
    try {
      setLoading(true);
      // cache-busting param ensures we never get a stale browser-cached response
      const res = await axios.get(
        `https://art-portal-7n6r.onrender.com/api/users?_t=${Date.now()}`,
      );
      const studentList = res.data.filter((u) => u.role === "parent");
      setStudents(studentList);

      // Pre-select students who are ALREADY in this class
      const alreadyInClass = studentList
        .filter((s) => s.assignedClass && s.assignedClass.toString() === classId.toString())
        .map((s) => s._id);

      setSelectedIds(alreadyInClass);
      setLoading(false);
    } catch (err) {
      console.error("Error loading students", err);
      setLoading(false);
    }
  }, [classId]);

  useEffect(() => {
    loadStudents();
  }, [loadStudents]);

  // Handle Checkbox Toggle
  const toggleStudent = (id) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((sid) => sid !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const handleSave = async () => {
    try {
      await axios.post(
        `https://art-portal-7n6r.onrender.com/api/classes/${classId}/assign`,
        { studentIds: selectedIds },
      );

      // Optimistically update local state immediately — don't wait for re-fetch.
      // Students removed from this class (were assigned here, now not selected) → null.
      // Students added to this class (now selected) → classId.
      setStudents((prev) =>
        prev.map((s) => {
          const wasInThisClass =
            s.assignedClass &&
            s.assignedClass.toString() === classId.toString();
          const isNowSelected = selectedIds.includes(s._id);

          if (wasInThisClass && !isNowSelected) {
            return { ...s, assignedClass: null };
          }
          if (isNowSelected) {
            return { ...s, assignedClass: classId };
          }
          return s;
        }),
      );

      setFilter("available");
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      // Refresh dashboard data in background without closing modal
      if (onRefresh) onRefresh();
    } catch (err) {
      alert("Failed to assign students");
    }
  };

  // ✨ DROPDOWN FILTER LOGIC
  const isSameClass = (assignedClass) =>
    assignedClass && assignedClass.toString() === classId.toString();

  const getFilteredStudents = () => {
    switch (filter) {
      case "available":
        // Students who have NO class assigned and are not inactive
        return students.filter((s) => !s.assignedClass && s.isActive !== false);
      case "this_class":
        // Students assigned to THIS specific class
        return students.filter((s) => isSameClass(s.assignedClass));
      case "other_class":
        // Students assigned to ANY OTHER class
        return students.filter(
          (s) => s.assignedClass && !isSameClass(s.assignedClass),
        );
      default:
        return students;
    }
  };

  const displayedStudents = getFilteredStudents();

  return (
    <div className="modal-overlay">
      <div
        className="modal-content"
        style={{ maxWidth: "500px", width: "90%" }}
      >
        {/* Header */}
        <div className="modal-header">
          <h3>Assign to: {className}</h3>
          <button className="close-modal" onClick={onClose}>
            ×
          </button>
        </div>

        {/* ✨ FILTER DROPDOWN SECTION */}
        <div className="filter-section">
          <div className="select-wrapper">
            <FaFilter className="filter-icon" />
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="custom-filter-dropdown"
            >
              <option value="available">
                Available to Assign (
                {students.filter((s) => !s.assignedClass && s.isActive !== false).length})
              </option>
              <option value="this_class">
                Assigned in This Class (
                {students.filter((s) => isSameClass(s.assignedClass)).length})
              </option>
              <option value="other_class">
                Already in Another Class (
                {
                  students.filter(
                    (s) => s.assignedClass && !isSameClass(s.assignedClass),
                  ).length
                }
                )
              </option>
            </select>
          </div>
        </div>

        {/* Body */}
        <div className="modal-body">
          <div className="student-selection-list">
            {loading ? (
              <p
                style={{
                  textAlign: "center",
                  color: "#64748b",
                  padding: "20px",
                }}
              >
                Loading students...
              </p>
            ) : displayedStudents.length === 0 ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "30px",
                  color: "#94a3b8",
                }}
              >
                <p>No students found in this category.</p>
              </div>
            ) : (
              displayedStudents.map((student) => {
                const isAssignedElsewhere =
                  student.assignedClass && !isSameClass(student.assignedClass);
                const isSelected = selectedIds.includes(student._id);

                return (
                  <label
                    key={student._id}
                    className={`student-item ${isSelected ? "selected" : ""}`}
                    style={{ cursor: "pointer" }}
                  >
                    {/* Left Side: Info */}
                    <div className="student-info">
                      <span className="student-name">{student.childName}</span>
                      <span className="parent-name">
                        Parent: {student.fullName}
                      </span>

                      {isAssignedElsewhere && (
                        <span className="badge-conflict">In Other Class</span>
                      )}
                    </div>

                    {/* Right Side: Checkbox — always shown so students can be reassigned */}
                    <div className="checkbox-wrapper">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleStudent(student._id)}
                      />
                    </div>
                  </label>
                );
              })
            )}
          </div>

          {/* Success Banner */}
          {saveSuccess && (
            <div
              style={{
                background: "#dcfce7",
                color: "#166534",
                padding: "8px 14px",
                borderRadius: "6px",
                fontSize: "0.85rem",
                marginBottom: "8px",
                textAlign: "center",
              }}
            >
              Saved! Unassigned students are now shown in "Available to Assign".
            </div>
          )}

          {/* Footer Actions */}
          <div className="modal-actions">
            <button className="cancel-btn" onClick={onClose}>
              Close
            </button>
            <button className="save-btn" onClick={handleSave}>
              Save Changes ({selectedIds.length})
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- CLASS DETAILS VIEW ---
const ClassDetailsView = ({ cls, onBack, onEdit, onDelete, onAssign }) => {
  const [copiedIdx, setCopiedIdx] = useState(null);

  const handleCopyLink = (link, idx) => {
    if (link) {
      navigator.clipboard.writeText(link);
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx(null), 2000);
    }
  };

  return (
    <div className="object-page">
      <div className="object-header">
        <button className="back-btn" onClick={onBack}>
          ← Back to Classes
        </button>
        <div className="header-content">
          <div
            className="header-avatar"
            style={{ background: "#06b6d4", fontSize: "1.5rem" }}
          >
            📚
          </div>
          <div>
            <h1>{cls.className}</h1>
            <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
              <span className="level-badge" style={{ fontSize: "0.9rem" }}>
                {cls.level}
              </span>
              {cls.subLevel && (
                <span
                  style={{
                    fontSize: "0.9rem",
                    color: "#64748b",
                    fontWeight: "600",
                  }}
                >
                  • {cls.subLevel}
                </span>
              )}
              <span className={`mode-badge ${cls.classMode || "online"}`} style={{ fontSize: "0.85rem" }}>
                {cls.classMode === "offline" ? "🏫 Offline" : "🌐 Online"}
              </span>
            </div>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", gap: "10px" }}>
            <button
              className="edit-btn"
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
              style={{
                background: "#eff6ff",
                padding: "10px 20px",
                fontSize: "1rem",
              }}
            >
              Edit Class
            </button>
            <button
              className="delete-btn-large"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
            >
              Delete Class
            </button>
          </div>
        </div>
      </div>

      <div className="object-body-grid">
        <div className="top-row-grid">
          <div className="detail-card">
            <h3>Schedule & Link</h3>
            <div style={{ marginBottom: "10px" }}>
              {cls.schedule && cls.schedule.length > 0 ? (
                cls.schedule.map((slot, i) => {
                  const slotLink = slot.link || (i === 0 ? cls.meetingLink : "");
                  return (
                    <div
                      key={i}
                      style={{
                        padding: "10px 0",
                        borderBottom: "1px solid #f1f5f9",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: slotLink ? "6px" : "0" }}>
                        <span style={{ fontWeight: "600", color: "#334155" }}>
                          {slot.day}
                        </span>
                        <span style={{ color: "#64748b" }}>{slot.time}</span>
                      </div>
                      {slotLink && (
                        <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                          <div
                            style={{
                              flex: 1,
                              minWidth: 0,
                              background: "#f1f5f9",
                              padding: "5px 8px",
                              borderRadius: "4px",
                              fontSize: "0.78rem",
                              color: "#64748b",
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {slotLink}
                          </div>
                          <button
                            onClick={() => handleCopyLink(slotLink, i)}
                            style={{
                              fontSize: "0.75rem",
                              padding: "4px 10px",
                              background: copiedIdx === i ? "#10b981" : "#0284c7",
                              color: "#fff",
                              border: "none",
                              borderRadius: "4px",
                              cursor: "pointer",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {copiedIdx === i ? "Copied ✅" : "Copy"}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <span style={{ color: "#94a3b8" }}>No schedule set</span>
              )}
            </div>
            {/* legacy fallback — only shown if no per-slot links exist and meetingLink is set */}
            {cls.meetingLink && !cls.schedule?.some((s) => s.link) ? (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                }}
              >
                <div
                  style={{
                    background: "#f1f5f9",
                    padding: "8px",
                    borderRadius: "4px",
                    fontSize: "0.85rem",
                    color: "#64748b",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {cls.meetingLink}
                </div>
                <button
                  onClick={() => handleCopyLink(cls.meetingLink, -1)}
                  className="save-btn"
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: "center",
                    backgroundColor: copiedIdx === -1
                      ? "#10b981"
                      : "#0284c7",
                    transition: "background-color 0.2s",
                  }}
                >
                  {copiedIdx === -1 ? "Copied ✅" : "Copy Meeting Link 📋"}
                </button>
              </div>
            ) : null}
          </div>

          <div className="detail-card">
            <h3>Class Info</h3>
            <div className="info-row">
              <label>Mode:</label>
              <span>
                <span className={`mode-badge ${cls.classMode || "online"}`}>
                  {cls.classMode === "offline" ? "🏫 Offline" : "🌐 Online"}
                </span>
              </span>
            </div>
            <div className="info-row">
              <label>Teacher:</label>{" "}
              <span>
                {cls.teacher
                  ? cls.teacher.fullName || cls.teacher.username
                  : "Unassigned"}
              </span>
            </div>
            <div className="info-row">
              <label>Total Students:</label> <span>{cls.students.length}</span>
            </div>
            <div className="info-row">
              <label>Created:</label>{" "}
              <span>{new Date(cls.createdAt).toLocaleDateString()}</span>
            </div>
          </div>
        </div>

        <div className="detail-card full-width-card">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <h3>Enrolled Students</h3>
            <button
              className="save-btn"
              style={{ width: "auto", fontSize: "0.9rem" }}
              onClick={onAssign}
            >
              Manage Students
            </button>
          </div>
          {cls.students.length === 0 ? (
            <p
              style={{ color: "#94a3b8", padding: "20px", textAlign: "center" }}
            >
              No students assigned.
            </p>
          ) : (
            <>
              {/* Desktop/tablet: table. Hidden on mobile to avoid side-scrolling. */}
              <div className="table-container enrolled-students-table">
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>Student Name</th>
                      <th>Parent Name</th>
                      <th>Age</th>
                      <th>Joining Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cls.students.map((student) => (
                      <tr key={student._id}>
                        <td style={{ fontWeight: "bold" }}>
                          {student.childName}
                        </td>
                        <td>{student.fullName}</td>
                        <td>{student.childAge || "-"}</td>
                        <td>
                          {student.joiningDate
                            ? new Date(student.joiningDate).toLocaleDateString()
                            : "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile: stacked cards, no horizontal scrolling needed. */}
              <div className="enrolled-students-cards">
                {cls.students.map((student) => (
                  <div key={student._id} className="enrolled-student-card">
                    <div className="enrolled-student-avatar">
                      {(student.childName || "?").charAt(0).toUpperCase()}
                    </div>
                    <div className="enrolled-student-info">
                      <div className="enrolled-student-name">
                        {student.childName}
                      </div>
                      <div className="enrolled-student-parent">
                        Parent: {student.fullName}
                      </div>
                      <div className="enrolled-student-meta">
                        <span>🎂 Age {student.childAge || "-"}</span>
                        <span>
                          📅{" "}
                          {student.joiningDate
                            ? new Date(student.joiningDate).toLocaleDateString()
                            : "-"}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// --- EDIT USER MODAL ---
const EditUserModal = ({ user, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    ...user,
    city: user.city || "",
    joiningDate: formatDateForInput(user.joiningDate),
    registeredDate: user.registeredDate || formatDateForInput(user.joiningDate),
    childDob: formatDateForInput(user.childDob),
    dob: formatDateForInput(user.dob),
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };
  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: "600px" }}>
        <div className="modal-header">
          <h3>Edit Details: {user.username}</h3>
          <button
            className="close-modal"
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              fontSize: "1.5rem",
              cursor: "pointer",
            }}
          >
            ×
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="edit-form-grid">
            <div className="form-group">
              <label>Full Name</label>
              <input
                name="fullName"
                value={formData.fullName || ""}
                onChange={handleChange}
              />
            </div>
            <div className="form-group">
              <label>Phone Number</label>
              <input
                name="phone"
                value={formData.phone || ""}
                onChange={handleChange}
              />
            </div>
            <div className="form-group">
              <label>Email</label>
              <input
                name="email"
                value={formData.email || ""}
                onChange={handleChange}
              />
            </div>
            <div className="form-group">
              <label>Location</label>
              <input
                name="location"
                value={formData.location || ""}
                onChange={handleChange}
              />
            </div>
            <div className="form-group">
              <label>City</label>
              <input
                name="city"
                value={formData.city || ""}
                onChange={handleChange}
              />
            </div>
            {user.role !== "admin" && (
              <>
                <div className="form-group">
                  <label>Zoom ID</label>
                  <input
                    name="zoomId"
                    value={formData.zoomId || ""}
                    onChange={handleChange}
                  />
                </div>
                <div className="form-group">
                  <label>Referred By</label>
                  <input
                    name="referredBy"
                    value={formData.referredBy || ""}
                    onChange={handleChange}
                  />
                </div>
              </>
            )}
          </div>

          <div
            style={{
              background: "#f8fafc",
              padding: "15px",
              borderRadius: "8px",
              marginBottom: "20px",
              marginTop: "15px",
            }}
          >
            {user.role === "parent" ? (
              <div className="edit-form-grid">
                <div className="form-group">
                  <label>Child Name</label>
                  <input
                    name="childName"
                    value={formData.childName || ""}
                    onChange={handleChange}
                  />
                </div>
                <div className="form-group">
                  <label>Monthly Fee (₹)</label>
                  <input
                    type="number"
                    name="monthlyFee"
                    value={formData.monthlyFee || ""}
                    onChange={handleChange}
                    style={{ fontWeight: "bold", color: "#16a34a" }}
                  />
                </div>
                <div className="form-group">
                  <label>Classes / Month</label>
                  <input
                    type="number"
                    name="monthlyClassesTarget"
                    value={formData.monthlyClassesTarget || ""}
                    onChange={handleChange}
                    style={{ fontWeight: "bold", color: "#0284c7" }}
                  />
                </div>
                <div className="form-group">
                  <label>Child Age</label>
                  <input
                    name="childAge"
                    value={formData.childAge || ""}
                    onChange={handleChange}
                  />
                </div>
                <div className="form-group">
                  <label>Date of Birth</label>
                  <input
                    type="date"
                    name="childDob"
                    value={formData.childDob || ""}
                    onChange={handleChange}
                  />
                </div>
                <div className="form-group">
                  <label>Class/Grade</label>
                  <input
                    name="childClass"
                    value={formData.childClass || ""}
                    onChange={handleChange}
                  />
                </div>
                <div className="form-group">
                  <label>Joining Date</label>
                  <input
                    type="date"
                    name="joiningDate"
                    value={formData.joiningDate || ""}
                    onChange={handleChange}
                  />
                </div>
                <div className="form-group">
                  <label style={{ color: "#ea580c" }}>
                    Fee Start Date (Reg)
                  </label>
                  <input
                    type="date"
                    name="registeredDate"
                    value={formData.registeredDate || ""}
                    onChange={handleChange}
                    style={{ border: "1px solid #ea580c" }}
                  />
                </div>
                <div className="form-group">
                  <label>Class Mode</label>
                  <select
                    name="classMode"
                    value={formData.classMode || "online"}
                    onChange={handleChange}
                    style={{ fontWeight: "bold" }}
                  >
                    <option value="online">🌐 Online</option>
                    <option value="offline">🏫 Offline</option>
                  </select>
                </div>
              </div>
            ) : user.role === "teacher" ? (
              <div className="edit-form-grid">
                <div className="form-group">
                  <label>Specialization</label>
                  <input
                    name="specialization"
                    value={formData.specialization || ""}
                    onChange={handleChange}
                  />
                </div>
                <div className="form-group">
                  <label>Monthly Salary (₹)</label>
                  <input
                    type="number"
                    name="monthlyFee"
                    value={formData.monthlyFee || ""}
                    onChange={handleChange}
                    style={{ fontWeight: "bold", color: "#9333ea" }}
                  />
                </div>
                <div className="form-group">
                  <label>Date of Birth</label>
                  <input
                    type="date"
                    name="childDob"
                    value={formData.childDob || ""}
                    onChange={handleChange}
                  />
                </div>
                <div className="form-group">
                  <label>Joining Date</label>
                  <input
                    type="date"
                    name="joiningDate"
                    value={formData.joiningDate || ""}
                    onChange={handleChange}
                  />
                </div>
              </div>
            ) : (
              <div className="edit-form-grid">
                <div className="form-group">
                  <label>Specialization / Role</label>
                  <input
                    name="specialization"
                    value={formData.specialization || ""}
                    onChange={handleChange}
                  />
                </div>
                <div className="form-group">
                  <label>Date of Birth</label>
                  <input
                    type="date"
                    name="dob"
                    value={formData.dob || ""}
                    onChange={handleChange}
                  />
                </div>
                <div className="form-group">
                  <label>Joining Date</label>
                  <input
                    type="date"
                    name="joiningDate"
                    value={formData.joiningDate || ""}
                    onChange={handleChange}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="modal-actions" style={{ justifyContent: "flex-end" }}>
            <button
              type="button"
              className="cancel-btn"
              onClick={onClose}
              style={{ marginRight: "10px" }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="save-btn"
              style={{ width: "auto", padding: "10px 25px" }}
            >
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// --- USER DETAILS VIEW ---
const UserDetailsView = ({ user, onBack, onDelete, onEdit }) => {
  const [credentials, setCredentials] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [loadingCreds, setLoadingCreds] = useState(false);
  const [copyMsg, setCopyMsg] = useState("");

  // Build fee history rows from registeredDate → current month
  const feeHistory = (() => {
    if (user.role !== "parent") return null;
    const payments = user.payments || [];
    const passes = user.passes || [];

    const dateStr = user.registeredDate || user.joiningDate || user.createdAt;
    const startMonth = dateStr
      ? (typeof dateStr === "string" ? dateStr : new Date(dateStr).toISOString()).slice(0, 7)
      : new Date().toISOString().slice(0, 7);

    const today = new Date();
    const [cy, cm] = [today.getFullYear(), today.getMonth() + 1];
    const [sy, sm0] = startMonth.split("-").map(Number);

    const months = [];
    let y = sy, m = sm0;
    while (y * 12 + m <= cy * 12 + cm) {
      months.push(`${y}-${String(m).padStart(2, "0")}`);
      m++; if (m > 12) { m = 1; y++; }
    }

    return months.reverse().map((month) => {
      const payment = payments.find((p) => p.month === month && p.status === "Paid");
      const pass = passes.find((p) => p.month === month);
      const inactive = isStudentInactiveForMonth(user, month);
      if (payment) return { month, status: "Paid", amount: payment.amount, paidDate: payment.paidDate };
      if (pass) return { month, status: "Pass", amount: 0, paidDate: null, reason: pass.reason };
      if (inactive) return { month, status: "Inactive", amount: 0, paidDate: null };
      return { month, status: "Pending", amount: getFeeForMonth(user, month), paidDate: null };
    });
  })();

  const handleToggleCredentials = async () => {
    if (!credentials) {
      setLoadingCreds(true);
      try {
        const res = await axios.get(
          `https://art-portal-7n6r.onrender.com/api/users/${user._id}/credentials`,
        );
        setCredentials(res.data);
        setShowPassword(true);
      } catch (err) {
        console.error("Error fetching creds", err);
      } finally {
        setLoadingCreds(false);
      }
    } else {
      setShowPassword(!showPassword);
    }
  };
  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
    setCopyMsg("Copied!");
    setTimeout(() => setCopyMsg(""), 2000);
  };

  const displayDob = user.role === "admin" ? user.dob : user.childDob;

  const [activeSection, setActiveSection] = useState("overview");

  const tabs = [
    { id: "overview", label: "Overview", icon: "👤" },
    { id: "details", label: user.role === "parent" ? "Student Details" : "Professional Details", icon: user.role === "parent" ? "🎓" : "💼" },
    ...(user.role === "parent" ? [{ id: "fees", label: "Fee History", icon: "💳" }] : []),
  ];

  const tabBarStyle = {
    display: "flex",
    gap: "4px",
    padding: "4px",
    background: "#f1f5f9",
    borderRadius: "12px",
    marginBottom: "24px",
    width: "fit-content",
  };

  const tabBtnStyle = (id) => ({
    display: "flex",
    alignItems: "center",
    gap: "6px",
    padding: "8px 18px",
    borderRadius: "8px",
    border: "none",
    cursor: "pointer",
    fontSize: "0.875rem",
    fontWeight: activeSection === id ? "700" : "500",
    background: activeSection === id ? "#fff" : "transparent",
    color: activeSection === id ? "#1e293b" : "#64748b",
    boxShadow: activeSection === id ? "0 1px 4px rgba(0,0,0,0.10)" : "none",
    transition: "all 0.15s ease",
  });

  // ---- Fee history helpers (only computed when needed) ----
  const feeStats = feeHistory
    ? {
        totalPaid: feeHistory.filter(r => r.status === "Paid").reduce((acc, r) => acc + (r.amount || 0), 0),
        paidCount: feeHistory.filter(r => r.status === "Paid").length,
        passCount: feeHistory.filter(r => r.status === "Pass").length,
        inactiveCount: feeHistory.filter(r => r.status === "Inactive").length,
        pendingCount: feeHistory.filter(r => r.status === "Pending").length,
      }
    : null;

  const statusBadgeStyle = (status) => ({
    padding: "3px 10px",
    borderRadius: "6px",
    fontSize: "0.78rem",
    fontWeight: "600",
    background: status === "Paid" ? "#dcfce7" : status === "Pass" ? "#ede9fe" : status === "Inactive" ? "#f1f5f9" : "#fee2e2",
    color: status === "Paid" ? "#166534" : status === "Pass" ? "#5b21b6" : status === "Inactive" ? "#475569" : "#991b1b",
  });

  return (
    <div className="object-page">
      <div className="object-header">
        <button className="back-btn" onClick={onBack}>
          ← Back to List
        </button>
        <div className="header-content">
          <div className="header-avatar">
            {user.username.charAt(0).toUpperCase()}
          </div>
          <div>
            <h1>{user.fullName || user.username}</h1>
            <span className={`role-badge ${user.role}`}>{user.role}</span>
            <span className="joined-date">
              Joined:{" "}
              {user.joiningDate
                ? new Date(user.joiningDate).toLocaleDateString()
                : new Date(user.createdAt).toLocaleDateString()}
            </span>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", gap: "10px" }}>
            <button
              className="edit-btn"
              onClick={onEdit}
              style={{
                background: "#eff6ff",
                padding: "8px 16px",
                border: "1px solid #bfdbfe",
                borderRadius: "6px",
                color: "#2563eb",
                fontSize: "0.9rem",
                fontWeight: "600",
                cursor: "pointer",
              }}
            >
              Edit Details
            </button>
            <button className="delete-btn-large" onClick={onDelete}>
              Delete User
            </button>
          </div>
        </div>
      </div>

      {/* ── Tab Bar ── */}
      <div style={tabBarStyle}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            style={tabBtnStyle(tab.id)}
            onClick={() => setActiveSection(tab.id)}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
            {tab.id === "fees" && feeStats && feeStats.pendingCount > 0 && (
              <span style={{
                background: "#dc2626",
                color: "#fff",
                borderRadius: "10px",
                fontSize: "0.68rem",
                fontWeight: "700",
                padding: "1px 6px",
                lineHeight: "1.4",
              }}>
                {feeStats.pendingCount}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="object-body-grid">

        {/* ── OVERVIEW TAB ── */}
        {activeSection === "overview" && (
          <div className="top-row-grid">
            <div
              className="detail-card"
              style={{ borderLeft: "4px solid #3b82f6" }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "15px",
                }}
              >
                <h3>Login Credentials</h3>
                {copyMsg && (
                  <span style={{ fontSize: "12px", color: "#10b981", fontWeight: "bold" }}>
                    {copyMsg}
                  </span>
                )}
              </div>
              <div
                className="credential-box"
                style={{ background: "#f8fafc", padding: "15px", borderRadius: "8px" }}
              >
                <div style={{ marginBottom: "10px", display: "flex", justifyContent: "space-between" }}>
                  <div>
                    <span style={{ fontSize: "12px", color: "#64748b" }}>Username</span>
                    <strong style={{ display: "block", fontSize: "16px", color: "#334155" }}>
                      {user.username}
                    </strong>
                  </div>
                  <button onClick={() => handleCopy(user.username)} className="icon-btn" title="Copy Username">
                    📋
                  </button>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <span style={{ fontSize: "12px", color: "#64748b" }}>Password</span>
                    {loadingCreds ? (
                      <span style={{ fontSize: "12px", color: "#999" }}>Fetching...</span>
                    ) : showPassword && credentials ? (
                      <strong style={{ display: "block", fontSize: "16px", fontFamily: "monospace" }}>
                        {credentials.password}
                      </strong>
                    ) : (
                      <strong style={{ display: "block", fontSize: "16px", letterSpacing: "2px" }}>
                        ••••••••
                      </strong>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: "5px" }}>
                    <button onClick={handleToggleCredentials} className="icon-btn" style={{ color: "#0284c7" }}>
                      {showPassword ? "👁️‍🗨️" : "👁️"}
                    </button>
                    {showPassword && credentials && (
                      <button onClick={() => handleCopy(credentials.password)} className="icon-btn" title="Copy Password">
                        📋
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="detail-card">
              <h3>Contact Information</h3>
              <div className="info-row"><label>Email:</label> <span>{user.email || "N/A"}</span></div>
              <div className="info-row"><label>Phone:</label> <span>{user.phone || "N/A"}</span></div>
              <div className="info-row"><label>Location:</label> <span>{user.location || "N/A"}</span></div>
              <div className="info-row"><label>City:</label> <span>{user.city || "N/A"}</span></div>
              <div className="info-row"><label>Zoom ID:</label> <span>{user.zoomId || "N/A"}</span></div>
              {user.role === "parent" && (
                <div className="info-row">
                  <label>Class Mode:</label>
                  <span>
                    <span className={`mode-badge ${user.classMode || "online"}`}>
                      {user.classMode === "offline" ? "🏫 Offline" : "🌐 Online"}
                    </span>
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── DETAILS TAB ── */}
        {activeSection === "details" && (
          <div className="detail-card full-width-card" style={{ borderLeft: "4px solid #64748b" }}>
            <h3>{user.role === "parent" ? "Student Details" : "Professional Details"}</h3>
            <div className="details-grid-layout">
              <div className="info-col">
                <div className="info-row">
                  <label>Joining Date:</label>{" "}
                  <span style={{ fontWeight: "bold" }}>
                    {user.joiningDate ? new Date(user.joiningDate).toLocaleDateString() : "N/A"}
                  </span>
                </div>
                {user.role === "parent" ? (
                  <>
                    <div className="info-row"><label>Child Name:</label> <span>{user.childName || "N/A"}</span></div>
                    <div className="info-row"><label>Gender:</label> <span>{user.gender || "N/A"}</span></div>
                    <div className="info-row">
                      <label>Date of Birth:</label>{" "}
                      <span>{user.childDob ? new Date(user.childDob).toLocaleDateString() : "N/A"}</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="info-row"><label>Specialization:</label> <span>{user.specialization || "N/A"}</span></div>
                    <div className="info-row">
                      <label>Date of Birth:</label>{" "}
                      <span>{displayDob ? new Date(displayDob).toLocaleDateString() : "N/A"}</span>
                    </div>
                  </>
                )}
              </div>
              <div className="info-col">
                {user.role === "parent" ? (
                  <>
                    <div className="info-row"><label>Age:</label> <span>{user.childAge || "N/A"}</span></div>
                    <div className="info-row"><label>Class:</label> <span>{user.childClass || "N/A"}</span></div>
                    <div className="info-row">
                      <label>Total Classes:</label>{" "}
                      <span style={{ fontWeight: "bold" }}>{user.monthlyClassesTarget || 8} Classes/Mo</span>
                    </div>
                    <div className="info-row">
                      <label>Monthly Fee:</label>
                      <span style={{ color: "#16a34a", fontWeight: "bold", fontSize: "16px" }}>
                        ₹{user.monthlyFee || 0}
                      </span>
                    </div>
                  </>
                ) : user.role === "teacher" ? (
                  <div className="info-row">
                    <label>Monthly Salary:</label>
                    <span style={{ color: "#9333ea", fontWeight: "bold", fontSize: "16px" }}>
                      ₹{user.monthlyFee || 0}
                    </span>
                  </div>
                ) : (
                  <div className="info-row"><label>Role Type:</label> <span>Administrator</span></div>
                )}
                {user.role !== "admin" && (
                  <div className="info-row"><label>Referred By:</label> <span>{user.referredBy || "N/A"}</span></div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── FEE HISTORY TAB ── */}
        {activeSection === "fees" && feeHistory && feeStats && (
          <div className="detail-card full-width-card" style={{ borderLeft: "4px solid #10b981" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
              <h3 style={{ margin: 0 }}>Fee Payment History</h3>
              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                <div style={{ textAlign: "center", background: "#dcfce7", padding: "6px 16px", borderRadius: "8px", minWidth: "80px" }}>
                  <div style={{ fontSize: "0.68rem", color: "#166534", fontWeight: "700", letterSpacing: "0.04em" }}>TOTAL PAID</div>
                  <div style={{ fontSize: "1.05rem", fontWeight: "800", color: "#16a34a" }}>₹{feeStats.totalPaid.toLocaleString()}</div>
                  <div style={{ fontSize: "0.7rem", color: "#166534" }}>{feeStats.paidCount} month{feeStats.paidCount !== 1 ? "s" : ""}</div>
                </div>
                {feeStats.passCount > 0 && (
                  <div style={{ textAlign: "center", background: "#ede9fe", padding: "6px 16px", borderRadius: "8px", minWidth: "80px" }}>
                    <div style={{ fontSize: "0.68rem", color: "#5b21b6", fontWeight: "700", letterSpacing: "0.04em" }}>PASS</div>
                    <div style={{ fontSize: "1.05rem", fontWeight: "800", color: "#7c3aed" }}>{feeStats.passCount}</div>
                    <div style={{ fontSize: "0.7rem", color: "#5b21b6" }}>month{feeStats.passCount !== 1 ? "s" : ""}</div>
                  </div>
                )}
                {feeStats.inactiveCount > 0 && (
                  <div style={{ textAlign: "center", background: "#f1f5f9", padding: "6px 16px", borderRadius: "8px", minWidth: "80px" }}>
                    <div style={{ fontSize: "0.68rem", color: "#475569", fontWeight: "700", letterSpacing: "0.04em" }}>INACTIVE</div>
                    <div style={{ fontSize: "1.05rem", fontWeight: "800", color: "#64748b" }}>{feeStats.inactiveCount}</div>
                    <div style={{ fontSize: "0.7rem", color: "#475569" }}>month{feeStats.inactiveCount !== 1 ? "s" : ""}</div>
                  </div>
                )}
                {feeStats.pendingCount > 0 && (
                  <div style={{ textAlign: "center", background: "#fef2f2", padding: "6px 16px", borderRadius: "8px", minWidth: "80px" }}>
                    <div style={{ fontSize: "0.68rem", color: "#991b1b", fontWeight: "700", letterSpacing: "0.04em" }}>PENDING</div>
                    <div style={{ fontSize: "1.05rem", fontWeight: "800", color: "#dc2626" }}>{feeStats.pendingCount}</div>
                    <div style={{ fontSize: "0.7rem", color: "#991b1b" }}>month{feeStats.pendingCount !== 1 ? "s" : ""}</div>
                  </div>
                )}
              </div>
            </div>

            {feeHistory.length === 0 ? (
              <p style={{ color: "#94a3b8", textAlign: "center", padding: "20px 0" }}>No fee history available.</p>
            ) : (
              <div className="table-container" style={{ maxHeight: "360px", overflowY: "auto" }}>
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>Month</th>
                      <th>Amount</th>
                      <th>Status</th>
                      <th>Paid On</th>
                    </tr>
                  </thead>
                  <tbody>
                    {feeHistory.map(({ month, status, amount, paidDate, reason }) => {
                      const label = new Date(month + "-02").toLocaleString("default", { month: "long", year: "numeric" });
                      const amountColor = status === "Paid" ? "#16a34a" : status === "Pass" ? "#7c3aed" : status === "Inactive" ? "#94a3b8" : "#dc2626";
                      const amountLabel = status === "Pass" ? "₹0 (Pass)" : status === "Inactive" ? "₹0 (Inactive)" : `₹${(amount || 0).toLocaleString()}`;
                      return (
                        <tr key={month} style={status === "Inactive" ? { opacity: 0.7 } : {}}>
                          <td style={{ fontWeight: "600", color: "#334155" }}>{label}</td>
                          <td style={{ fontWeight: "700", color: amountColor }}>{amountLabel}</td>
                          <td>
                            <div>
                              <span style={statusBadgeStyle(status)}>{status === "Inactive" ? "💤 Inactive" : status}</span>
                              {reason && <div style={{ fontSize: "0.72rem", color: "#7c3aed", marginTop: "3px" }}>{reason}</div>}
                            </div>
                          </td>
                          <td style={{ color: "#64748b", fontSize: "0.85rem" }}>
                            {paidDate ? new Date(paidDate).toLocaleDateString() : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
};

// ==========================================
// 3. TAB COMPONENTS (Dependent on Modals/Helpers)
// ==========================================

const OverviewTab = ({ stats, users, classes, expenses = [], loading, onNavigate }) => {
  // ===== ATTENDANCE WIDGET STATE =====
  const [attSelectedClass, setAttSelectedClass] = useState("");
  const [attMonth, setAttMonth] = useState(new Date().toISOString().slice(0, 7));
  const [attRecords, setAttRecords] = useState([]);
  const [attLoading, setAttLoading] = useState(false);
  const [attShowAnalytics, setAttShowAnalytics] = useState(false);

  // ===== ATTENDANCE WIDGET: Fetch monthly records =====
  useEffect(() => {
    if (!attSelectedClass) { setAttRecords([]); return; }
    const fetchAttendance = async () => {
      setAttLoading(true);
      try {
        const cls = classes.find(c => c._id === attSelectedClass);
        const studentIds = cls && cls.students ? cls.students.map(s => s._id).join(",") : "";
        const url = `https://art-portal-7n6r.onrender.com/api/attendance/monthly?classes=${attSelectedClass}&month=${attMonth}${studentIds ? `&students=${studentIds}` : ""}`;
        const res = await axios.get(url);
        setAttRecords(res.data);
      } catch (err) {
        console.error("Attendance fetch error:", err);
      } finally {
        setAttLoading(false);
      }
    };
    fetchAttendance();
  }, [attSelectedClass, attMonth, classes]);

  // ===== ATTENDANCE WIDGET: Compute monthly sheet data =====
  const attClass = classes.find(c => c._id === attSelectedClass);
  const attStudents = attClass ? attClass.students || [] : [];

  const getMonthDays = (monthStr) => {
    if (!monthStr) return [];
    const [y, m] = monthStr.split("-").map(Number);
    const daysInMonth = new Date(y, m, 0).getDate();
    const today = new Date();
    const days = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const dateObj = new Date(y, m - 1, d);
      const dayOfWeek = dateObj.getDay();
      days.push({
        date: d,
        fullDate: `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
        isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
        isToday: dateObj.toDateString() === today.toDateString(),
      });
    }
    return days;
  };

  const attMonthDays = getMonthDays(attMonth);

  const attSheetData = attStudents.map(student => {
    const history = attMonthDays.map(day => {
      const rec = attRecords.find(
        r => r.studentId === student._id && r.date === day.fullDate
      );
      if (!rec) return "";
      if (rec.status === "Present") return "P";
      if (rec.status === "Absent") return "A";
      if (rec.status === "Missed") return "M";
      return "";
    });
    return { ...student, history };
  });

  const attTotalPresent = attRecords.filter(r => r.status === "Present").length;
  const attTotalAbsent = attRecords.filter(r => r.status === "Absent").length;
  const attTotalRecords = attTotalPresent + attTotalAbsent;
  const attPercentage = attTotalRecords > 0 ? Math.round((attTotalPresent / attTotalRecords) * 100) : 0;

  const students = users.filter((u) => u.role === "parent");
  const teachers = users.filter((u) => u.role === "teacher");
  const recentStudents = [...students]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 3);

  const activeStudents = students.filter((s) => s.isActive !== false);
  const maleCount = activeStudents.filter((s) => s.gender === "Male").length;
  const femaleCount = activeStudents.filter((s) => s.gender === "Female").length;
  const inactiveCount = students.filter((s) => s.isActive === false).length;
  const genderData = [
    { name: "Male", value: maleCount, color: "#3b82f6" },
    { name: "Female", value: femaleCount, color: "#ec4899" },
    { name: "Inactive", value: inactiveCount, color: "#94a3b8" },
  ].filter((d) => d.value > 0);

  const currentMonth = new Date().toISOString().slice(0, 7);
  const paidCount = students.filter((s) =>
    (s.payments || []).some(
      (p) => p.month === currentMonth && p.status === "Paid",
    ),
  ).length;
  const pendingCount = students.length - paidCount;

  const actualRevenue = students.reduce((acc, s) => {
    const payment = (s.payments || []).find(
      (p) => p.month === currentMonth && p.status === "Paid",
    );
    return acc + (payment ? payment.amount || s.monthlyFee || 0 : 0);
  }, 0);
  const pendingAmount = students.reduce((acc, s) => {
    const dateStr = s.registeredDate || s.joiningDate || s.createdAt;
    const startMonth = dateStr
      ? (typeof dateStr === "string" ? dateStr : new Date(dateStr).toISOString()).slice(0, 7)
      : currentMonth;
    if (currentMonth < startMonth) return acc; // Not joined yet for this month
    const hasPaid = (s.payments || []).some((p) => p.month === currentMonth && p.status === "Paid");
    const hasPass = (s.passes || []).some((p) => p.month === currentMonth);
    const isInactive = isStudentInactiveForMonth(s, currentMonth);
    return acc + (!hasPaid && !hasPass && !isInactive ? s.monthlyFee || 0 : 0);
  }, 0);

  const totalEstimation = students.reduce((acc, s) => acc + (s.monthlyFee || 0), 0);

  const currentMonthExpenses = expenses
    .filter((e) => (e.date || "").slice(0, 7) === currentMonth)
    .reduce((acc, e) => acc + (e.amount || 0), 0);

  const topExpenseCategories = EXPENSE_TYPES.map((t) => ({
    ...t,
    total: expenses
      .filter((e) => e.type === t.value && (e.date || "").slice(0, 7) === currentMonth)
      .reduce((acc, e) => acc + (e.amount || 0), 0),
  }))
    .filter((t) => t.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, 2);

  const totalAllPending = students.reduce((acc, s) => {
    const payments = s.payments || [];
    const passes = s.passes || [];
    const dateStr = s.registeredDate || s.joiningDate || s.createdAt;
    const startMonth = dateStr
      ? (typeof dateStr === "string" ? dateStr : new Date(dateStr).toISOString()).slice(0, 7)
      : currentMonth;
    const today = new Date();
    const [cy, cm] = [today.getFullYear(), today.getMonth() + 1];
    const [sy, sm0] = startMonth.split("-").map(Number);
    let y = sy, m = sm0;
    while (y * 12 + m <= cy * 12 + cm) {
      const monthStr = `${y}-${String(m).padStart(2, "0")}`;
      const hasPaid = payments.some((p) => p.month === monthStr && p.status === "Paid");
      const hasPass = passes.some((p) => p.month === monthStr);
      if (!hasPaid && !hasPass) acc += getFeeForMonth(s, monthStr);
      m++; if (m > 12) { m = 1; y++; }
    }
    return acc;
  }, 0);

  const levelCounts = {};
  classes.forEach((cls) => {
    const lvl = cls.level || "Unknown";
    levelCounts[lvl] = (levelCounts[lvl] || 0) + cls.students.length;
  });
  const levelData = Object.entries(levelCounts)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  const getLast6Months = () => {
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      months.push(d.toISOString().slice(0, 7));
    }
    return months;
  };

  const revenueTrendData = getLast6Months().map((monthStr) => {
    const totalForMonth = students.reduce((acc, student) => {
      const payment = (student.payments || []).find(
        (p) => p.month === monthStr && p.status === "Paid",
      );
      return acc + (payment ? payment.amount || student.monthlyFee : 0);
    }, 0);
    const dateObj = new Date(monthStr + "-01");
    const label = dateObj.toLocaleString("default", { month: "short" });
    return { name: label, revenue: totalForMonth };
  });

  const teacherLoadData = teachers
    .map((t) => {
      const teacherClasses = classes.filter(
        (c) => c.teacher && c.teacher._id === t._id,
      );
      const studentCount = teacherClasses.reduce(
        (acc, c) => acc + c.students.length,
        0,
      );
      return { name: t.fullName || t.username, students: studentCount };
    })
    .sort((a, b) => b.students - a.students)
    .slice(0, 5);

  const ProfessionalDonut = ({ data, totalLabel, onSliceClick }) => {
    const total = data.reduce((a, b) => a + b.value, 0);
    if (total === 0)
      return (
        <p style={{ color: "#94a3b8", textAlign: "center", padding: "20px" }}>
          No data yet.
        </p>
      );

    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "20px",
          height: "160px",
        }}
      >
        <div style={{ flex: 1, height: "100%", position: "relative" }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={45}
                outerRadius={70}
                paddingAngle={4}
                dataKey="value"
                stroke="none"
                onClick={onSliceClick ? (entry) => onSliceClick(entry.name) : undefined}
              >
                {data.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.color}
                    style={{ outline: "none", cursor: onSliceClick ? "pointer" : "default" }}
                  />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ background: "#fff", borderRadius: "8px" }}
                itemStyle={{ fontWeight: "bold" }}
                formatter={(value) => [value, totalLabel]}
              />
            </PieChart>
          </ResponsiveContainer>
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              textAlign: "center",
              pointerEvents: "none",
            }}
          >
            <div
              style={{
                fontSize: "1.2rem",
                fontWeight: "800",
                color: "#1e293b",
              }}
            >
              {total}
            </div>
          </div>
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "10px",
            minWidth: "100px",
          }}
        >
          {data.map((entry, i) => (
            <div
              key={i}
              onClick={onSliceClick ? () => onSliceClick(entry.name) : undefined}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                cursor: onSliceClick ? "pointer" : "default",
              }}
            >
              <div
                style={{
                  width: "10px",
                  height: "10px",
                  borderRadius: "50%",
                  background: entry.color,
                }}
              ></div>
              <div style={{ fontSize: "0.85rem", color: "#64748b", flex: 1 }}>
                {entry.name}
              </div>
              <div
                style={{
                  fontWeight: "700",
                  color: "#334155",
                  fontSize: "0.9rem",
                }}
              >
                {entry.value}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div
      style={{ maxWidth: "1200px", margin: "0 auto", paddingBottom: "30px" }}
    >
      <div
        className="overview-hero-banner"
        style={{
          background: "linear-gradient(135deg, #2563eb 0%, #1e40af 100%)",
          borderRadius: "16px",
          padding: "30px",
          color: "white",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "30px",
          boxShadow: "0 10px 25px -5px rgba(37, 99, 235, 0.4)",
        }}
      >
        <div>
          <h2
            style={{
              margin: "0 0 5px 0",
              fontSize: "1.8rem",
              fontWeight: "700",
            }}
          >
            Dashboard Overview
          </h2>
          <p style={{ margin: 0, opacity: 0.9 }}>
            Here is what's happening in your institute today.
          </p>
        </div>
        <div
          className="overview-hero-date"
          style={{
            textAlign: "right",
            background: "rgba(255,255,255,0.1)",
            padding: "10px 20px",
            borderRadius: "12px",
            backdropFilter: "blur(5px)",
          }}
        >
          <div style={{ fontSize: "0.85rem", opacity: 0.8 }}>Today's Date</div>
          <div style={{ fontSize: "1.1rem", fontWeight: "600" }}>
            {new Date().toLocaleDateString("en-US", {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          </div>
        </div>
      </div>

      <div className="overview-stats-grid">
        <div
          className="overview-stat-card stat-card-clickable"
          onClick={() => onNavigate("users", { roleFilter: "parent" })}
          title="View all students"
          style={{ cursor: "pointer" }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px" }}>
            <div
              style={{
                width: "40px", height: "40px", borderRadius: "10px",
                background: "#eff6ff", color: "#2563eb",
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.2rem",
              }}
            >
              🎓
            </div>
            <span style={{ fontSize: "0.75rem", fontWeight: "600", color: "#16a34a", background: "#dcfce7", padding: "2px 8px", borderRadius: "10px", height: "fit-content" }}>
              + Active
            </span>
          </div>
          <div style={{ fontSize: "2rem", fontWeight: "800", color: "#1e293b", lineHeight: 1 }}>
            {stats.students}
          </div>
          <div style={{ color: "#64748b", fontSize: "0.9rem", fontWeight: "500", marginBottom: "12px" }}>
            Total Students
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <div
              className="stat-mini-tile"
              onClick={(e) => { e.stopPropagation(); onNavigate("users", { roleFilter: "parent", modeFilter: "online" }); }}
              style={{ flex: 1, background: "#ecfdf5", borderRadius: "8px", padding: "8px 10px", cursor: "pointer" }}
              title="View online students"
            >
              <div className="stat-mini-label" style={{ fontSize: "0.7rem", color: "#059669", fontWeight: "700", marginBottom: "2px" }}>🌐 Online</div>
              <div className="stat-mini-value" style={{ fontSize: "1.2rem", fontWeight: "800", color: "#065f46" }}>
                {(stats.students || 0) - (stats.offlineStudents || 0)}
              </div>
            </div>
            <div
              className="stat-mini-tile"
              onClick={(e) => { e.stopPropagation(); onNavigate("users", { roleFilter: "parent", modeFilter: "offline" }); }}
              style={{ flex: 1, background: "#fef3c7", borderRadius: "8px", padding: "8px 10px", cursor: "pointer" }}
              title="View offline students"
            >
              <div className="stat-mini-label" style={{ fontSize: "0.7rem", color: "#d97706", fontWeight: "700", marginBottom: "2px" }}>🏫 Offline</div>
              <div className="stat-mini-value" style={{ fontSize: "1.2rem", fontWeight: "800", color: "#92400e" }}>
                {stats.offlineStudents ?? 0}
              </div>
            </div>
          </div>
          <div
            className="stat-mini-tile"
            onClick={(e) => { e.stopPropagation(); onNavigate("users", { roleFilter: "teacher" }); }}
            style={{ background: "#f0fdf4", borderRadius: "8px", padding: "8px 10px", cursor: "pointer", marginBottom: "12px" }}
            title="View teachers"
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "4px"}}>
              <span className="stat-mini-label" style={{ fontSize: "0.7rem", color: "#16a34a", fontWeight: "700"}}>👨‍🏫 Expert Teachers</span>
              <span className="stat-mini-value" style={{ fontSize: "1.05rem", fontWeight: "800", color: "#166534" }}>
                {stats.teachers}
              </span>
            </div>
          </div>
          <div className="stat-card-nav-hint">View Students →</div>
        </div>
        <div
          className="overview-stat-card stat-card-clickable"
          onClick={() => onNavigate("expense-history")}
          title="View expense history"
          style={{ cursor: "pointer" }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px" }}>
            <div
              style={{
                width: "40px", height: "40px", borderRadius: "10px",
                background: "#fef2f2", color: "#dc2626",
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.2rem",
              }}
            >
              🧾
            </div>
            <span style={{ fontSize: "0.75rem", fontWeight: "600", color: "#dc2626", background: "#fee2e2", padding: "2px 8px", borderRadius: "10px", height: "fit-content" }}>
              This Month
            </span>
          </div>
          <div style={{ fontSize: "2rem", fontWeight: "800", color: "#1e293b", lineHeight: 1 }}>
            ₹{currentMonthExpenses.toLocaleString()}
          </div>
          <div style={{ color: "#64748b", fontSize: "0.9rem", fontWeight: "500", marginBottom: "12px" }}>
            Total Expenses
          </div>
          {topExpenseCategories.length > 0 && (
            <div style={{ display: "flex", gap: "8px" }}>
              {topExpenseCategories.map((t) => (
                <div
                  key={t.value}
                  className="stat-mini-tile"
                  style={{ flex: 1, background: t.bg, borderRadius: "8px", padding: "8px 10px" }}
                  title={t.label}
                >
                  <div className="stat-mini-label" style={{ fontSize: "0.7rem", color: t.color, fontWeight: "700", marginBottom: "2px" }}>
                    {t.emoji} {t.label}
                  </div>
                  <div className="stat-mini-value" style={{ fontSize: "1.05rem", fontWeight: "800", color: t.color }}>
                    ₹{t.total.toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="stat-card-nav-hint">View Expense History →</div>
        </div>
        <div
          className="overview-stat-card stat-card-clickable"
          onClick={() => onNavigate("fees")}
          title="View fee tracker"
          style={{ cursor: "pointer" }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px" }}>
            <div
              style={{
                width: "40px", height: "40px", borderRadius: "10px",
                background: "#f5f3ff", color: "#7c3aed",
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.2rem",
              }}
            >
              💰
            </div>
            <span style={{ fontSize: "0.75rem", fontWeight: "600", color: "#7c3aed", background: "#ede9fe", padding: "2px 8px", borderRadius: "10px", height: "fit-content" }}>
              This Month
            </span>
          </div>
          <div style={{ fontSize: "2rem", fontWeight: "800", color: "#1e293b", lineHeight: 1 }}>
            ₹{actualRevenue.toLocaleString()}
          </div>
          <div style={{ color: "#64748b", fontSize: "0.9rem", fontWeight: "500", marginBottom: "12px" }}>
            Collected This Month
          </div>
          <div style={{ display: "flex", gap: "8px", marginBottom: "6px" }}>
            <div
              className="stat-mini-tile"
              style={{ flex: 1, background: "#f0fdf4", borderRadius: "8px", padding: "8px 10px" }}
              title="Total estimated monthly revenue (excl. arrears)"
            >
              <div className="stat-mini-label" style={{ fontSize: "0.7rem", color: "#15803d", fontWeight: "700", marginBottom: "2px" }}>📊 Monthly Est.</div>
              <div className="stat-mini-value" style={{ fontSize: "1.05rem", fontWeight: "800", color: "#166534" }}>
                ₹{(actualRevenue + pendingAmount).toLocaleString()}
              </div>
            </div>
            <div
              className="stat-mini-tile"
              onClick={(e) => { e.stopPropagation(); onNavigate("fees", { filter: "Pending" }); }}
              style={{ flex: 1, background: "#fef2f2", borderRadius: "8px", padding: "8px 10px", cursor: "pointer" }}
              title="View pending payments this month"
            >
              <div className="stat-mini-label" style={{ fontSize: "0.7rem", color: "#991b1b", fontWeight: "700", marginBottom: "2px" }}>⚠️ Pending</div>
              <div className="stat-mini-value" style={{ fontSize: "1.05rem", fontWeight: "800", color: "#dc2626" }}>
                ₹{pendingAmount.toLocaleString()}
              </div>
            </div>
          </div>
          <div style={{ borderTop: "1px dashed #e2e8f0", margin: "4px 0 6px" }} />
          <div style={{ display: "flex", gap: "8px" }}>
            <div
              className="stat-mini-tile"
              style={{ flex: 1, background: "#eff6ff", borderRadius: "8px", padding: "8px 10px" }}
              title="Collected + total outstanding (all months)"
            >
              <div className="stat-mini-label" style={{ fontSize: "0.7rem", color: "#1d4ed8", fontWeight: "700", marginBottom: "2px" }}>💼 Total Est.</div>
              <div className="stat-mini-value" style={{ fontSize: "1.05rem", fontWeight: "800", color: "#1d4ed8" }}>
                ₹{(actualRevenue + totalAllPending).toLocaleString()}
              </div>
            </div>
            <div
              className="stat-mini-tile"
              onClick={(e) => { e.stopPropagation(); onNavigate("fees", { filter: "Pending" }); }}
              style={{ flex: 1, background: "#fff7ed", borderRadius: "8px", padding: "8px 10px", cursor: "pointer" }}
              title="Total pending across all months"
            >
              <div className="stat-mini-label" style={{ fontSize: "0.7rem", color: "#c2410c", fontWeight: "700", marginBottom: "2px" }}>🕐 Arrears</div>
              <div className="stat-mini-value" style={{ fontSize: "1.05rem", fontWeight: "800", color: "#ea580c" }}>
                ₹{totalAllPending.toLocaleString()}
              </div>
            </div>
          </div>
          <div className="stat-card-nav-hint">View Fee Tracker →</div>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(350px, 1fr))",
          gap: "20px",
          marginBottom: "30px",
        }}
      >
        <div
          className="overview-chart-card"
          style={{
            borderRadius: "16px",
            padding: "25px",
            border: "1px solid #e2e8f0",
            boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
            gridColumn: "span 1",
          }}
        >
          <h3
            className="overview-chart-title"
            style={{ margin: "0 0 20px 0", fontSize: "1rem" }}
          >
            Revenue Trend (Last 6 Months)
          </h3>
          <div style={{ width: "100%", height: 200, fontSize: "0.75rem" }}>
            <ResponsiveContainer>
              <AreaChart
                data={revenueTrendData}
                margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#f1f5f9"
                />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#94a3b8" }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#94a3b8" }}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: "8px",
                    border: "none",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                  }}
                  formatter={(value) => [
                    `₹${value.toLocaleString()}`,
                    "Revenue",
                  ]}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#10b981"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#colorRev)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div
          className="overview-chart-card"
          style={{
            borderRadius: "16px",
            padding: "25px",
            border: "1px solid #e2e8f0",
            boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
          }}
        >
          <h3
            className="overview-chart-title"
            style={{ margin: "0 0 20px 0", fontSize: "1rem" }}
          >
            Student Demographics
          </h3>
          <ProfessionalDonut
            data={genderData}
            totalLabel="Students"
            onSliceClick={(name) => {
              if (name === "Inactive") {
                onNavigate("users", { roleFilter: "parent", viewMode: "inactive" });
              } else {
                onNavigate("users", { roleFilter: "parent", genderFilter: name });
              }
            }}
          />
        </div>
      </div>

      <div
        className="overview-chart-card"
        style={{
          borderRadius: "16px",
          padding: "25px",
          border: "1px solid #e2e8f0",
          boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
        }}
      >
        <h3
          className="overview-chart-title"
          style={{ margin: "0 0 15px 0", fontSize: "1rem" }}
        >
          Recent Student Registrations
        </h3>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
            gap: "20px",
          }}
        >
          {recentStudents.length === 0 ? (
            <p style={{ color: "#94a3b8", fontSize: "0.9rem" }}>
              No recent registrations.
            </p>
          ) : (
            recentStudents.map((student) => (
              <div
                key={student._id}
                className="recent-student-card"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  padding: "12px",
                  borderRadius: "12px",
                  border: "1px solid #f1f5f9",
                }}
              >
                <div
                  style={{
                    width: "40px",
                    height: "40px",
                    borderRadius: "50%",
                    background: "#fff",
                    border: "1px solid #e2e8f0",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "0.9rem",
                    fontWeight: "bold",
                    color: "#3b82f6",
                  }}
                >
                  {student.childName.charAt(0)}
                </div>
                <div>
                  <div
                    className="student-card-name"
                    style={{
                      fontSize: "0.9rem",
                      fontWeight: "700",
                    }}
                  >
                    {student.childName}
                  </div>
                  <div
                    className="student-card-date"
                    style={{ fontSize: "0.75rem" }}
                  >
                    Joined:{" "}
                    {formatDateShort(student.joiningDate || student.createdAt)}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ===== ATTENDANCE OVERVIEW WIDGET ===== */}
      <div className="admin-att-widget overview-chart-card" style={{
        borderRadius: "16px", padding: "25px",
        border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
        marginTop: "20px",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px", marginBottom: "20px" }}>
          <h3 className="overview-chart-title" style={{ margin: 0, fontSize: "1rem" }}>📋 Attendance Overview</h3>
          <div className="admin-att-controls">
            <select
              value={attSelectedClass}
              onChange={(e) => setAttSelectedClass(e.target.value)}
              className="admin-att-select"
            >
              <option value="">Select Class</option>
              {classes.map((cls) => (
                <option key={cls._id} value={cls._id}>{cls.className}</option>
              ))}
            </select>
            <input
              type="month"
              value={attMonth}
              onChange={(e) => setAttMonth(e.target.value)}
              className="admin-att-select"
            />
            {attSelectedClass && (
              <button
                className={`att-analytics-btn ${attShowAnalytics ? "active" : ""}`}
                onClick={() => setAttShowAnalytics(!attShowAnalytics)}
              >
                {attShowAnalytics ? "📋 Sheet View" : "📊 Analytics"}
              </button>
            )}
          </div>
        </div>

        {!attSelectedClass ? (
          <div style={{ textAlign: "center", padding: "40px 20px", color: "#94a3b8" }}>
            <div style={{ fontSize: "2rem", marginBottom: "10px" }}>📊</div>
            <p style={{ margin: 0, fontWeight: 500 }}>Select a class to view attendance details</p>
          </div>
        ) : attLoading ? (
          <div style={{ textAlign: "center", padding: "40px", color: "#94a3b8" }}>Loading attendance data...</div>
        ) : (
          <>
            {/* Summary Stats */}
            <div className="admin-att-stats">
              <div className="att-stat-badge">
                <div className="att-stat-icon" style={{ background: "#eff6ff", color: "#3b82f6" }}>👥</div>
                <div className="att-stat-value">{attStudents.length}</div>
                <div className="att-stat-label">Total Students</div>
              </div>
              <div className="att-stat-badge">
                <div className="att-stat-icon" style={{ background: "#f0fdf4", color: "#16a34a" }}>✅</div>
                <div className="att-stat-value" style={{ color: "#16a34a" }}>{attTotalPresent}</div>
                <div className="att-stat-label">Present</div>
              </div>
              <div className="att-stat-badge">
                <div className="att-stat-icon" style={{ background: "#fef2f2", color: "#dc2626" }}>❌</div>
                <div className="att-stat-value" style={{ color: "#dc2626" }}>{attTotalAbsent}</div>
                <div className="att-stat-label">Absent</div>
              </div>
              <div className="att-stat-badge">
                <div className="att-stat-icon" style={{ background: "#fefce8", color: "#ca8a04" }}>📈</div>
                <div className="att-stat-value" style={{ color: attPercentage >= 75 ? "#16a34a" : "#dc2626" }}>{attPercentage}%</div>
                <div className="att-stat-label">Attendance Rate</div>
              </div>
            </div>

            {attShowAnalytics ? (
              /* ===== ANALYTICS VIEW ===== */
              <div className="att-analytics-grid">
                {/* Donut Chart — Overall Attendance */}
                <div className="att-chart-card">
                  <h4 className="att-chart-title">Overall Attendance</h4>
                  {attTotalRecords === 0 ? (
                    <p style={{ color: "#94a3b8", textAlign: "center", padding: "30px" }}>No attendance data for this month</p>
                  ) : (
                    <div style={{ width: "100%", height: 220, position: "relative" }}>
                      <ResponsiveContainer>
                        <PieChart>
                          <Pie
                            data={[
                              { name: "Present", value: attTotalPresent, color: "#22c55e" },
                              { name: "Absent", value: attTotalAbsent, color: "#ef4444" },
                              { name: "Missed", value: attRecords.filter(r => r.status === "Missed").length, color: "#f59e0b" },
                            ].filter(d => d.value > 0)}
                            cx="50%" cy="50%"
                            innerRadius={55} outerRadius={85}
                            paddingAngle={4} dataKey="value" stroke="none"
                          >
                            {[
                              { color: "#22c55e" },
                              { color: "#ef4444" },
                              { color: "#f59e0b" },
                            ].filter((_, i) => [
                              attTotalPresent,
                              attTotalAbsent,
                              attRecords.filter(r => r.status === "Missed").length,
                            ][i] > 0).map((entry, idx) => (
                              <Cell key={idx} fill={entry.color} style={{ outline: "none" }} />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 2px 8px rgba(0,0,0,0.15)" }}
                            formatter={(value, name) => [value, name]}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                      <div style={{
                        position: "absolute", top: "50%", left: "50%",
                        transform: "translate(-50%, -50%)", textAlign: "center", pointerEvents: "none",
                      }}>
                        <div className="att-donut-center-value">{attPercentage}%</div>
                        <div className="att-donut-center-label">Attendance</div>
                      </div>
                    </div>
                  )}
                  <div className="att-chart-legend">
                    <span className="att-legend-item"><span className="att-legend-dot" style={{ background: "#22c55e" }}></span> Present ({attTotalPresent})</span>
                    <span className="att-legend-item"><span className="att-legend-dot" style={{ background: "#ef4444" }}></span> Absent ({attTotalAbsent})</span>
                  </div>
                </div>

                {/* Bar Chart — Per-Student Breakdown */}
                <div className="att-chart-card">
                  <h4 className="att-chart-title">Student-wise Breakdown</h4>
                  {attSheetData.length === 0 ? (
                    <p style={{ color: "#94a3b8", textAlign: "center", padding: "30px" }}>No student data</p>
                  ) : (
                    <div style={{ width: "100%", height: Math.max(220, attSheetData.length * 40), fontSize: "0.75rem" }}>
                      <ResponsiveContainer>
                        <BarChart
                          data={attSheetData.map(s => ({
                            name: s.childName?.length > 10 ? s.childName.slice(0, 10) + "…" : s.childName,
                            Present: s.history.filter(h => h === "P").length,
                            Absent: s.history.filter(h => h === "A").length,
                          }))}
                          layout="vertical"
                          margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                          <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: "#94a3b8" }} />
                          <YAxis type="category" dataKey="name" width={80} axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: "0.75rem" }} />
                          <Tooltip
                            contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 2px 8px rgba(0,0,0,0.15)" }}
                          />
                          <Bar dataKey="Present" fill="#22c55e" radius={[0, 4, 4, 0]} barSize={14} />
                          <Bar dataKey="Absent" fill="#ef4444" radius={[0, 4, 4, 0]} barSize={14} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* ===== SHEET VIEW ===== */
              <div className="admin-att-sheet-wrapper">
                <table className="admin-att-sheet">
                  <thead>
                    <tr>
                      <th className="att-sticky-col att-name-col">Student Name</th>
                      {attMonthDays.map((d) => (
                        <th key={d.date} className={`att-date-col ${d.isWeekend ? "att-weekend" : ""} ${d.isToday ? "att-today" : ""}`}>
                          {d.date}
                        </th>
                      ))}
                      <th className="att-summary-hdr att-present-hdr">P</th>
                      <th className="att-summary-hdr att-absent-hdr">A</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attSheetData.length === 0 ? (
                      <tr><td colSpan={attMonthDays.length + 3} style={{ textAlign: "center", padding: "20px", color: "#94a3b8" }}>No students in this class</td></tr>
                    ) : (
                      attSheetData.map((s) => {
                        const pCount = s.history.filter(h => h === "P").length;
                        const aCount = s.history.filter(h => h === "A").length;
                        return (
                          <tr key={s._id}>
                            <td className="att-sticky-col att-name-col">
                              <div style={{ fontWeight: 600, fontSize: "0.85rem" }}>{s.childName}</div>
                            </td>
                            {s.history.map((status, idx) => (
                              <td key={idx} className={`att-cell ${status} ${attMonthDays[idx].isWeekend ? "att-weekend" : ""}`}>
                                {status}
                              </td>
                            ))}
                            <td className="att-summary-val att-present-val">{pCount}</td>
                            <td className="att-summary-val att-absent-val">{aCount}</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

// --- TAB 2: USER MANAGEMENT ---
const UserManagementTab = ({ initialRoleFilter = "all", initialModeFilter = "all", initialGenderFilter = "all", initialViewMode = "active" }) => {
  const [users, setUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState(initialRoleFilter);
  const [modeFilter, setModeFilter] = useState(initialModeFilter);
  const [genderFilter, setGenderFilter] = useState(initialGenderFilter);
  const [sortOrder, setSortOrder] = useState("newest");
  const [selectedUser, setSelectedUser] = useState(null);
  const [editingUser, setEditingUser] = useState(null);
  const [deleteModal, setDeleteModal] = useState({ show: false, userId: null });
  const [toast, setToast] = useState({ show: false, message: "", type: "" });
  const [showColMenu, setShowColMenu] = useState(false);
  const [viewMode, setViewMode] = useState(initialViewMode); // "active" | "inactive"
  const [inactiveModal, setInactiveModal] = useState({ show: false, userId: null, userName: "" });
  const [visibleColumns, setVisibleColumns] = useState(() => {
    const savedColumns = localStorage.getItem("admin_visible_columns");
    return savedColumns
      ? JSON.parse(savedColumns)
      : {
          name: true,
          role: true,
          mode: true,
          fee: true,
          joiningDate: true,
          status: true,
          action: true,
        };
  });

  useEffect(() => { fetchUsers(); }, []);

  const fetchUsers = () => {
    axios
      .get("https://art-portal-7n6r.onrender.com/api/users")
      .then((res) => setUsers(res.data))
      .catch((err) => console.error(err));
  };
  const showToast = (message, type = "success") => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: "", type: "" }), 3000);
  };
  const initiateDelete = (e, userId) => {
    if (e && e.stopPropagation) e.stopPropagation();
    setDeleteModal({ show: true, userId });
  };
  const confirmDelete = async () => {
    try {
      await axios.delete(`https://art-portal-7n6r.onrender.com/api/users/${deleteModal.userId}`);
      setUsers(users.filter((user) => user._id !== deleteModal.userId));
      showToast("User deleted successfully!", "success");
      setDeleteModal({ show: false, userId: null });
      setSelectedUser(null);
    } catch (err) {
      showToast("Failed to delete user.", "error");
      setDeleteModal({ show: false, userId: null });
    }
  };

  // Show InactiveReasonModal when deactivating; reactivate directly
  const handleToggleStatus = (e, user) => {
    e.stopPropagation();
    if (user.isActive !== false) {
      const displayName = user.role === "parent"
        ? (user.childName || user.fullName || user.username)
        : (user.fullName || user.username);
      setInactiveModal({ show: true, userId: user._id, userName: displayName });
    } else {
      handleReactivate(user._id);
    }
  };

  const handleDeactivate = async ({ reason, inactiveFrom }) => {
    const { userId } = inactiveModal;
    setInactiveModal({ show: false, userId: null, userName: "" });
    try {
      const res = await axios.put(
        `https://art-portal-7n6r.onrender.com/api/users/${userId}/status`,
        { reason, inactiveFrom },
      );
      setUsers(users.map(u =>
        u._id === userId ? { ...u, isActive: false, inactiveHistory: res.data.inactiveHistory } : u
      ));
      showToast("Student marked as inactive. Fee paused from selected month.", "success");
    } catch (err) {
      showToast("Error updating status.", "error");
    }
  };

  const handleReactivate = async (userId) => {
    try {
      const res = await axios.put(`https://art-portal-7n6r.onrender.com/api/users/${userId}/status`);
      setUsers(users.map(u =>
        u._id === userId ? { ...u, isActive: true, inactiveHistory: res.data.inactiveHistory } : u
      ));
      showToast("Student reactivated. Fee resumes from current month.", "success");
    } catch (err) {
      showToast("Error reactivating student.", "error");
    }
  };

  const handleEditClick = (e, user) => {
    e.stopPropagation();
    setEditingUser(user);
  };
  const handleEditSave = async (updatedData) => {
    try {
      const res = await axios.put(
        `https://art-portal-7n6r.onrender.com/api/users/${updatedData._id}`,
        updatedData,
      );
      const savedUser = res.data;
      setUsers(users.map((u) => (u._id === savedUser._id ? savedUser : u)));
      if (selectedUser && selectedUser._id === savedUser._id) setSelectedUser(savedUser);
      setEditingUser(null);
      showToast("User details updated!", "success");
    } catch (err) {
      showToast("Failed to update user.", "error");
    }
  };
  const toggleColumn = (key) => {
    setVisibleColumns((prev) => {
      const newState = { ...prev, [key]: !prev[key] };
      localStorage.setItem("admin_visible_columns", JSON.stringify(newState));
      return newState;
    });
  };

  // Base search filter (shared across both views)
  const matchesSearch = (user) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      (user.username && user.username.toLowerCase().includes(searchLower)) ||
      (user.fullName && user.fullName.toLowerCase().includes(searchLower)) ||
      (user.email && user.email.toLowerCase().includes(searchLower)) ||
      (user.phone && user.phone.includes(searchLower)) ||
      (user.location && user.location.toLowerCase().includes(searchLower)) ||
      (user.city && user.city.toLowerCase().includes(searchLower)) ||
      (user.childName && user.childName.toLowerCase().includes(searchLower))
    );
  };

  const matchesRoleMode = (user) => {
    const matchesRole = roleFilter === "all" || user.role === roleFilter;
    const matchesMode = modeFilter === "all" || user.role !== "parent" || (user.classMode || "online") === modeFilter;
    const matchesGender = genderFilter === "all" || user.role !== "parent" || user.gender === genderFilter;
    return matchesRole && matchesMode && matchesGender;
  };

  // Active users: isActive is true or undefined (legacy records default true)
  const activeUsers = users.filter(u => matchesRoleMode(u) && u.isActive !== false && matchesSearch(u));
  // Inactive users: isActive is explicitly false
  const inactiveUsers = users.filter(u => matchesRoleMode(u) && u.isActive === false && matchesSearch(u));

  // Counts for tab badges (unfiltered by search so tabs always show totals)
  const activeCount = users.filter(u => matchesRoleMode(u) && u.isActive !== false).length;
  const inactiveCount = users.filter(u => matchesRoleMode(u) && u.isActive === false).length;

  const sortUsers = (list) => [...list].sort((a, b) => {
    if (sortOrder === "newest") return new Date(b.createdAt) - new Date(a.createdAt);
    if (sortOrder === "oldest") return new Date(a.createdAt) - new Date(b.createdAt);
    if (sortOrder === "fee-high") return (b.monthlyFee || 0) - (a.monthlyFee || 0);
    if (sortOrder === "fee-low") return (a.monthlyFee || 0) - (b.monthlyFee || 0);
    return 0;
  });

  const sortedActive = sortUsers(activeUsers);
  const sortedInactive = sortUsers(inactiveUsers);

  // Helpers for inactive card display
  const getInactiveDetails = (user) => {
    const history = user.inactiveHistory || [];
    const latest = history[history.length - 1];
    if (!latest) return { fromLabel: "N/A", reason: "", markedAt: null, monthsInactive: 0 };
    const { inactiveFrom, reason, markedAt } = latest;
    const fromLabel = inactiveFrom
      ? new Date(inactiveFrom + "-02").toLocaleString("default", { month: "long", year: "numeric" })
      : "N/A";
    let monthsInactive = 0;
    if (inactiveFrom) {
      const today = new Date();
      const [fy, fm] = inactiveFrom.split("-").map(Number);
      monthsInactive = (today.getFullYear() * 12 + today.getMonth() + 1) - (fy * 12 + fm) + 1;
    }
    return { fromLabel, reason: reason || "", markedAt, monthsInactive };
  };

  return (
    <>
      <div className={`toast-notification ${toast.type} ${toast.show ? "show" : ""}`}>
        {toast.type === "success" ? "✅" : "❌"} {toast.message}
      </div>

      {selectedUser ? (
        <UserDetailsView
          user={selectedUser}
          onBack={() => setSelectedUser(null)}
          onDelete={() => initiateDelete(null, selectedUser._id)}
          onEdit={() => setEditingUser(selectedUser)}
        />
      ) : (
        <div className="table-wrapper">

          {/* ── Active / Inactive Tab Toggle ── */}
          <div className="user-status-tab-bar">
            <button
              className={`user-status-tab ${viewMode === "active" ? "active" : ""}`}
              onClick={() => setViewMode("active")}
            >
              Active
              <span className="user-status-tab-count active-count">{activeCount}</span>
            </button>
            <button
              className={`user-status-tab ${viewMode === "inactive" ? "inactive" : ""}`}
              onClick={() => setViewMode("inactive")}
            >
              Inactive
              {inactiveCount > 0 && (
                <span className="user-status-tab-count inactive-count">{inactiveCount}</span>
              )}
            </button>
          </div>

          {/* ── Shared Filter Bar ── */}
          <div className="filter-bar">
            <div className="search-box">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
              <input
                type="text"
                placeholder="Search Name, City, ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="filter-actions">
              <div className="filter-dropdown">
                <label>Role:</label>
                <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
                  <option value="all">All Users</option>
                  <option value="parent">Students</option>
                  <option value="teacher">Teachers</option>
                  <option value="admin">Admins</option>
                </select>
              </div>
              <div className="filter-dropdown">
                <label>Mode:</label>
                <select value={modeFilter} onChange={(e) => setModeFilter(e.target.value)}>
                  <option value="all">All Modes</option>
                  <option value="online">🌐 Online</option>
                  <option value="offline">🏫 Offline</option>
                </select>
              </div>
              {roleFilter === "parent" && (
                <div className="filter-dropdown">
                  <label>Gender:</label>
                  <select value={genderFilter} onChange={(e) => setGenderFilter(e.target.value)}>
                    <option value="all">All Genders</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                </div>
              )}
              {viewMode === "active" && (
                <div className="filter-dropdown">
                  <label>Sort:</label>
                  <select value={sortOrder} onChange={(e) => setSortOrder(e.target.value)}>
                    <option value="newest">Newest First</option>
                    <option value="oldest">Oldest First</option>
                    <option value="fee-high">Highest Fee</option>
                    <option value="fee-low">Lowest Fee</option>
                  </select>
                </div>
              )}
              {viewMode === "active" && (
                <div style={{ position: "relative" }}>
                  <button
                    className="customize-btn"
                    onClick={() => setShowColMenu(!showColMenu)}
                    title="Customize Columns"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 3h7a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-7m0-18H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h7m0-18v18"></path>
                    </svg>
                  </button>
                  {showColMenu && (
                    <div className="column-menu-dropdown">
                      <h4>Show Columns</h4>
                      {[
                        { key: "name", label: "Name / ID" },
                        { key: "role", label: "Role" },
                        { key: "mode", label: "Mode" },
                        { key: "fee", label: "Fee / Salary" },
                        { key: "joiningDate", label: "Joining Date" },
                        { key: "status", label: "Status" },
                        { key: "action", label: "Actions" },
                      ].map(col => (
                        <label key={col.key}>
                          <input
                            type="checkbox"
                            checked={visibleColumns[col.key]}
                            onChange={() => toggleColumn(col.key)}
                          />{" "}{col.label}
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ══════════════════════════════════════
              ACTIVE VIEW — existing table
          ══════════════════════════════════════ */}
          {viewMode === "active" && (
            <>
              <div style={{ padding: "16px 20px 8px", display: "flex", alignItems: "baseline", gap: "6px" }}>
                <span style={{ fontSize: "1rem", fontWeight: "700", color: "#1e293b" }}>
                  {roleFilter === "parent" ? "Students" : roleFilter === "teacher" ? "Teachers" : roleFilter === "admin" ? "Admins" : "Users"}
                </span>
                <span style={{ fontSize: "0.95rem", fontWeight: "700", color: "#64748b" }}>
                  ({sortedActive.length})
                </span>
              </div>
              <div className="table-container">
                <table className="custom-table clickable-rows">
                  <thead>
                    <tr>
                      {visibleColumns.name && <th>Name / ID</th>}
                      {visibleColumns.role && <th>Role</th>}
                      {visibleColumns.mode && <th>Mode</th>}
                      {visibleColumns.fee && <th>Fee / Salary</th>}
                      {visibleColumns.joiningDate && <th>Joining Date</th>}
                      {visibleColumns.status && <th>Status</th>}
                      {visibleColumns.action && <th>Action</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedActive.map((user) => (
                      <tr key={user._id} onClick={() => setSelectedUser(user)} className="user-row">
                        {visibleColumns.name && (
                          <td>
                            <div style={{ fontWeight: "600", color: "#333" }}>
                              {user.role === "parent" ? user.childName || "—" : user.fullName || user.username}
                            </div>
                            <div style={{ fontSize: "12px", color: "#888" }}>
                              {user.role === "parent" ? `Parent: ${user.fullName || user.username}` : user.location || "No Location"}
                            </div>
                          </td>
                        )}
                        {visibleColumns.role && (
                          <td><span className={`role-badge ${user.role}`}>{user.role}</span></td>
                        )}
                        {visibleColumns.mode && (
                          <td>
                            {user.role === "parent" ? (
                              <span className={`mode-badge ${user.classMode || "online"}`}>
                                {user.classMode === "offline" ? "🏫 Offline" : "🌐 Online"}
                              </span>
                            ) : (
                              <span style={{ color: "#94a3b8", fontSize: "0.8rem" }}>—</span>
                            )}
                          </td>
                        )}
                        {visibleColumns.fee && (
                          <td>
                            {user.role === "parent" ? (
                              isRegisteredInOrBefore(user.registeredDate, new Date().toISOString().slice(0, 7)) ? (
                                <span style={{ color: "#16a34a", fontWeight: "bold" }}>₹{user.monthlyFee || 0}</span>
                              ) : (
                                <span style={{ color: "#94a3b8", fontSize: "0.85rem" }}>₹0 (Starts {user.registeredDate})</span>
                              )
                            ) : user.role === "teacher" ? (
                              <span style={{ color: "#9333ea", fontWeight: "bold" }}>₹{user.monthlyFee || 0}</span>
                            ) : "-"}
                          </td>
                        )}
                        {visibleColumns.joiningDate && (
                          <td>{user.joiningDate ? new Date(user.joiningDate).toLocaleDateString() : "-"}</td>
                        )}
                        {visibleColumns.status && (
                          <td>
                            <button
                              className="status-btn active"
                              onClick={(e) => handleToggleStatus(e, user)}
                              title="Click to mark inactive"
                            >
                              Active
                            </button>
                          </td>
                        )}
                        {visibleColumns.action && (
                          <td className="action-cell">
                            <button className="edit-btn" onClick={(e) => handleEditClick(e, user)} title="Edit">
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                              </svg>
                            </button>
                            <button className="delete-btn" onClick={(e) => initiateDelete(e, user._id)} title="Delete">
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                              </svg>
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* ══════════════════════════════════════
              INACTIVE VIEW — card-based list
          ══════════════════════════════════════ */}
          {viewMode === "inactive" && (
            <div style={{ padding: "20px" }}>
              {sortedInactive.length === 0 ? (
                <div style={{ textAlign: "center", padding: "60px 20px", color: "#94a3b8" }}>
                  <div style={{ fontSize: "3.5rem", marginBottom: "12px" }}>✅</div>
                  <p style={{ fontWeight: "700", fontSize: "1.1rem", color: "#334155", marginBottom: "4px" }}>No inactive students</p>
                  <p style={{ fontSize: "0.85rem" }}>All filtered students are currently active.</p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {sortedInactive.map(user => {
                    const { fromLabel, reason, markedAt, monthsInactive } = getInactiveDetails(user);
                    const displayName = user.role === "parent"
                      ? (user.childName || "—")
                      : (user.fullName || user.username);

                    return (
                      <div
                        key={user._id}
                        className="inactive-student-card"
                        onClick={() => setSelectedUser(user)}
                      >
                        {/* Avatar */}
                        <div className="inactive-card-avatar">
                          {(displayName).charAt(0).toUpperCase()}
                        </div>

                        {/* Info block */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "10px", marginBottom: "10px" }}>
                            <div>
                              <div style={{ fontWeight: "700", color: "#1e293b", fontSize: "1rem" }}>
                                {displayName}
                              </div>
                              {user.role === "parent" && (
                                <div style={{ fontSize: "0.82rem", color: "#64748b" }}>
                                  Parent: {user.fullName}
                                  {user.classMode && (
                                    <span className={`mode-badge ${user.classMode}`} style={{ marginLeft: "8px", fontSize: "0.72rem" }}>
                                      {user.classMode === "offline" ? "🏫 Offline" : "🌐 Online"}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                            <button
                              className="reactivate-btn"
                              onClick={e => { e.stopPropagation(); handleReactivate(user._id); }}
                            >
                              ✓ Reactivate
                            </button>
                          </div>

                          {/* Inactivity details row */}
                          <div className="inactive-detail-row">
                            <div className="inactive-detail-item">
                              <div className="inactive-detail-label">INACTIVE FROM</div>
                              <div className="inactive-detail-value" style={{ color: "#dc2626" }}>{fromLabel}</div>
                            </div>
                            <div className="inactive-detail-item">
                              <div className="inactive-detail-label">DURATION</div>
                              <div className="inactive-detail-value" style={{ color: "#ef4444" }}>
                                {monthsInactive > 0 ? `${monthsInactive} month${monthsInactive !== 1 ? "s" : ""}` : "< 1 month"}
                              </div>
                            </div>
                            {markedAt && (
                              <div className="inactive-detail-item">
                                <div className="inactive-detail-label">MARKED ON</div>
                                <div className="inactive-detail-value" style={{ color: "#475569" }}>
                                  {new Date(markedAt).toLocaleDateString()}
                                </div>
                              </div>
                            )}
                            {reason && (
                              <div className="inactive-detail-item" style={{ flex: 2, minWidth: "160px" }}>
                                <div className="inactive-detail-label">REASON</div>
                                <div className="inactive-detail-value" style={{ color: "#475569", fontWeight: "500" }}>{reason}</div>
                              </div>
                            )}
                          </div>

                          {/* Fee pause notice */}
                          {user.role === "parent" && (user.monthlyFee || 0) > 0 && (
                            <div style={{ marginTop: "10px", display: "inline-flex", alignItems: "center", gap: "6px", background: "#ede9fe", color: "#5b21b6", padding: "4px 12px", borderRadius: "20px", fontSize: "0.78rem", fontWeight: "600" }}>
                              💤 Fee paused: ₹{user.monthlyFee}/mo from {fromLabel}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

        </div>
      )}

      {deleteModal.show && (
        <div className="modal-overlay">
          <div className="modal-content delete-modal-content">
            <h3>Are you sure?</h3>
            <div className="modal-actions">
              <button className="cancel-btn" onClick={() => setDeleteModal({ show: false, userId: null })}>Cancel</button>
              <button className="confirm-delete-btn" onClick={confirmDelete}>Yes, Delete</button>
            </div>
          </div>
        </div>
      )}
      {editingUser && (
        <EditUserModal
          user={editingUser}
          onClose={() => setEditingUser(null)}
          onSave={handleEditSave}
        />
      )}
      {inactiveModal.show && (
        <InactiveReasonModal
          userName={inactiveModal.userName}
          onConfirm={handleDeactivate}
          onCancel={() => setInactiveModal({ show: false, userId: null, userName: "" })}
        />
      )}
    </>
  );
};

// --- TAB 3: ADD USER ---
const AddUserTab = ({ onRefresh }) => {
  const [formData, setFormData] = useState({
    username: "",
    password: "",
    role: "parent",
    firstName: "",
    lastName: "",
    gender: "",
    admissionId: "",
    shortBio: "",
    studentEmail: "",
    studentPhone: "",
    childAge: "",
    childDob: "",
    fullName: "",
    email: "",
    phone: "",
    location: "",
    city: "",
    zoomId: "",
    referredBy: "",
    parentDesignation: "",
    childClass: "",
    monthlyFee: "",
    specialization: "",
    education: "",
    joiningDate: new Date().toISOString().split("T")[0],
    // ✨ NEW FIELD: Defaults to Today, but can be edited for old students
    registeredDate: new Date().toISOString().split("T")[0],
    dob: "",
    monthlyClassesTarget: 8,
    classMode: "online",
  });

  const [showSibling, setShowSibling] = useState(false);
  const [siblingData, setSiblingData] = useState({
    username: "",
    password: "",
    firstName: "",
    lastName: "",
    gender: "",
    admissionId: "",
    shortBio: "",
    childAge: "",
    childDob: "",
    childClass: "",
    monthlyFee: "",
    zoomId: "",
    monthlyClassesTarget: 8,
  });

  const [msg, setMsg] = useState("");
  const [autoFillMsg, setAutoFillMsg] = useState("");

  // Helper: Calculate Age
  const calculateAge = (dob) => {
    if (!dob) return "";
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    let updatedData = { ...formData, [name]: value };
    if (name === "childDob") updatedData.childAge = calculateAge(value);
    setFormData(updatedData);
  };

  const handleSiblingChange = (e) => {
    const { name, value } = e.target;
    let updatedData = { ...siblingData, [name]: value };
    if (name === "childDob") updatedData.childAge = calculateAge(value);
    setSiblingData(updatedData);
  };

  const handlePhoneBlur = async () => {
    if (formData.role === "parent" && formData.phone.length > 9) {
      try {
        const res = await axios.get(
          `https://art-portal-7n6r.onrender.com/api/users/parent/${formData.phone}`,
        );
        if (res.data) {
          setFormData((prev) => ({
            ...prev,
            fullName: res.data.fullName || "",
            email: res.data.email || "",
            location: res.data.location || "",
            city: res.data.city || "",
            zoomId: res.data.zoomId || "",
            referredBy: res.data.referredBy || "",
            parentDesignation: res.data.parentDesignation || "",
          }));
          setAutoFillMsg("✅ Parent found! Details auto-filled.");
          setTimeout(() => setAutoFillMsg(""), 3000);
        }
      } catch (err) {}
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setMsg("Processing...");

    // Get current date in YYYY-MM-DD format for registration
    const todayDate = new Date().toISOString().split("T")[0];

    const payload1 = {
      ...formData,
      childName:
        formData.role === "parent"
          ? `${formData.firstName} ${formData.lastName}`.trim()
          : "",
      registeredDate: todayDate, // Explicitly set registration date
    };

    try {
      await axios.post(
        "https://art-portal-7n6r.onrender.com/api/register",
        payload1,
      );

      if (formData.role === "parent" && showSibling) {
        const payload2 = {
          ...siblingData,
          role: "parent",
          childName: `${siblingData.firstName} ${siblingData.lastName}`.trim(),
          // Inherit parent info
          fullName: formData.fullName,
          phone: formData.phone,
          registeredDate: todayDate, // Set for sibling too
        };
        await axios.post(
          "https://art-portal-7n6r.onrender.com/api/register",
          payload2,
        );
        setMsg("✅ Success! Both siblings registered.");
      } else {
        setMsg("✅ User Registered Successfully!");
      }

      if (onRefresh) onRefresh();

      setFormData({
        username: "",
        password: "",
        role: "parent",
        firstName: "",
        lastName: "",
        gender: "",
        admissionId: "",
        shortBio: "",
        studentEmail: "",
        studentPhone: "",
        childAge: "",
        childDob: "",
        fullName: "",
        email: "",
        phone: "",
        location: "",
        city: "",
        zoomId: "",
        referredBy: "",
        parentDesignation: "",
        childClass: "",
        monthlyFee: "",
        specialization: "",
        education: "",
        joiningDate: new Date().toISOString().split("T")[0],
        registeredDate: new Date().toISOString().split("T")[0],
        dob: "",
        monthlyClassesTarget: 8,
      });
      setSiblingData({
        username: "",
        password: "",
        firstName: "",
        lastName: "",
        gender: "",
        admissionId: "",
        shortBio: "",
        childAge: "",
        childDob: "",
        childClass: "",
        monthlyFee: "",
        zoomId: "",
        monthlyClassesTarget: 8,
        classMode: "online",
      });
      setShowSibling(false);
    } catch (err) {
      console.error(err);
      setMsg("❌ Error: Username taken or server issue.");
    }
  };

  return (
    <div className="form-wrapper register-wrapper">
      <h3>Register New Profile</h3>
      <form onSubmit={handleRegister} className="admin-form">
        <div className="form-section">
          <h4 className="section-title">
            Login Credentials {showSibling && "(Student 1)"}
          </h4>
          <div className="form-row">
            <div className="form-group">
              <label>Username *</label>
              <input
                name="username"
                value={formData.username}
                onChange={handleChange}
                required
                placeholder="Unique Login ID"
              />
            </div>
            <div className="form-group">
              <label>Password *</label>
              <input
                name="password"
                type="password"
                value={formData.password}
                onChange={handleChange}
                required
                placeholder="Secret Password"
              />
            </div>
          </div>
          <div className="form-group">
            <label>Role</label>
            <select name="role" value={formData.role} onChange={handleChange}>
              <option value="parent">Student</option>
              <option value="teacher">Teacher</option>
              <option value="admin">Admin</option>
            </select>
          </div>
        </div>

        {formData.role === "parent" && (
          <div className="form-section student-section">
            <h4 className="section-title" style={{ color: "#0284c7" }}>
              Student 1 Details
            </h4>
            <div className="form-row">
              <div className="form-group">
                <label>First Name</label>
                <input
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleChange}
                />
              </div>
              <div className="form-group">
                <label>Last Name</label>
                <input
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Date of Birth *</label>
                <input
                  type="date"
                  name="childDob"
                  value={formData.childDob}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="form-group">
                <label>Age (Auto)</label>
                <input
                  name="childAge"
                  value={formData.childAge}
                  readOnly
                  style={{ backgroundColor: "#f1f5f9", cursor: "not-allowed" }}
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Gender *</label>
                <select
                  name="gender"
                  value={formData.gender}
                  onChange={handleChange}
                >
                  <option value="">Select</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                </select>
              </div>
              <div className="form-group">
                <label>Admission ID</label>
                <input
                  name="admissionId"
                  value={formData.admissionId}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Class / Grade</label>
                <input
                  name="childClass"
                  value={formData.childClass}
                  onChange={handleChange}
                />
              </div>
              <div className="form-group">
                <label>Monthly Fee (₹)</label>
                <input
                  type="number"
                  name="monthlyFee"
                  value={formData.monthlyFee}
                  onChange={handleChange}
                  style={{ fontWeight: "bold", color: "#16a34a" }}
                />
              </div>
              <div className="form-group">
                <label>Classes / Month</label>
                <input
                  type="number"
                  name="monthlyClassesTarget"
                  value={formData.monthlyClassesTarget}
                  onChange={handleChange}
                  style={{ fontWeight: "bold", color: "#0284c7" }}
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Date of Joining</label>
                <input
                  type="date"
                  name="joiningDate"
                  value={formData.joiningDate}
                  onChange={handleChange}
                />
              </div>
              {/* ✨ NEW FIELD IN FORM: Fee Start Date */}
              <div className="form-group">
                <label style={{ color: "#ea580c" }}>Fee Start Date (Reg)</label>
                <input
                  type="date"
                  name="registeredDate"
                  value={formData.registeredDate}
                  onChange={handleChange}
                  style={{ border: "2px solid #ea580c" }}
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Student Phone</label>
                <input
                  name="studentPhone"
                  value={formData.studentPhone}
                  onChange={handleChange}
                />
              </div>
              <div className="form-group">
                <label>Student Email</label>
                <input
                  name="studentEmail"
                  value={formData.studentEmail}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div className="form-group">
              <label>Class Mode *</label>
              <select
                name="classMode"
                value={formData.classMode}
                onChange={handleChange}
                style={{ fontWeight: "bold" }}
              >
                <option value="online">🌐 Online</option>
                <option value="offline">🏫 Offline</option>
              </select>
            </div>

            <div className="form-group">
              <label>Short Bio</label>
              <textarea
                name="shortBio"
                value={formData.shortBio}
                onChange={handleChange}
                style={{
                  width: "100%",
                  padding: "10px",
                  borderRadius: "6px",
                  border: "1px solid #cbd5e1",
                }}
              />
            </div>
          </div>
        )}

        {formData.role === "parent" && (
          <div className="form-section parent-section">
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "15px",
              }}
            >
              <h4
                className="section-title"
                style={{ color: "#ea580c", margin: 0 }}
              >
                Parent / Guardian Details (Shared)
              </h4>
              {autoFillMsg && (
                <span
                  style={{
                    fontSize: "0.85rem",
                    color: "#16a34a",
                    fontWeight: "bold",
                  }}
                >
                  {autoFillMsg}
                </span>
              )}
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Parent Phone *</label>
                <input
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  onBlur={handlePhoneBlur}
                  placeholder="Search..."
                  style={{ border: "2px solid #fdba74" }}
                />
              </div>
              <div className="form-group">
                <label>Parent Name</label>
                <input
                  name="fullName"
                  value={formData.fullName}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Parent Designation</label>
                <input
                  name="parentDesignation"
                  value={formData.parentDesignation}
                  onChange={handleChange}
                  placeholder="e.g. Father, Mother, Guardian"
                />
              </div>
              <div className="form-group">
                <label>Parent Email</label>
                <input
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Zoom ID</label>
                <input
                  name="zoomId"
                  value={formData.zoomId}
                  onChange={handleChange}
                />
              </div>
              <div className="form-group">
                <label>Location (Area/Street)</label>
                <input
                  name="location"
                  value={formData.location}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>City</label>
                <input
                  name="city"
                  value={formData.city}
                  onChange={handleChange}
                  placeholder="e.g. Hyderabad"
                />
              </div>
              <div className="form-group">
                <label>Referred By</label>
                <input
                  name="referredBy"
                  value={formData.referredBy}
                  onChange={handleChange}
                />
              </div>
            </div>
          </div>
        )}

        {formData.role === "parent" && (
          <div
            style={{
              marginBottom: "20px",
              padding: "15px",
              background: "#e0f2fe",
              borderRadius: "8px",
              border: "1px dashed #0284c7",
              display: "flex",
              alignItems: "center",
              gap: "10px",
            }}
          >
            <input
              type="checkbox"
              id="siblingCheck"
              checked={showSibling}
              onChange={(e) => setShowSibling(e.target.checked)}
              style={{ width: "20px", height: "20px", cursor: "pointer" }}
            />
            <label
              htmlFor="siblingCheck"
              style={{
                cursor: "pointer",
                fontWeight: "600",
                color: "#0369a1",
                fontSize: "1rem",
              }}
            >
              Register a Sibling?
            </label>
          </div>
        )}

        {showSibling && formData.role === "parent" && (
          <div
            className="form-section student-section"
            style={{ borderLeft: "5px solid #0284c7" }}
          >
            <h4 className="section-title" style={{ color: "#0284c7" }}>
              Student 2 Details (Sibling)
            </h4>
            <div
              className="form-row sibling-fields-box"
              style={{
                background: "#fff",
                padding: "10px",
                borderRadius: "6px",
                marginBottom: "15px",
                border: "1px solid #ddd",
              }}
            >
              <div className="form-group">
                <label>Sibling Username *</label>
                <input
                  name="username"
                  value={siblingData.username}
                  onChange={handleSiblingChange}
                  required
                />
              </div>
              <div className="form-group">
                <label>Sibling Password *</label>
                <input
                  name="password"
                  type="password"
                  value={siblingData.password}
                  onChange={handleSiblingChange}
                  required
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>First Name</label>
                <input
                  name="firstName"
                  value={siblingData.firstName}
                  onChange={handleSiblingChange}
                />
              </div>
              <div className="form-group">
                <label>Last Name</label>
                <input
                  name="lastName"
                  value={siblingData.lastName}
                  onChange={handleSiblingChange}
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Date of Birth</label>
                <input
                  type="date"
                  name="childDob"
                  value={siblingData.childDob}
                  onChange={handleSiblingChange}
                />
              </div>
              <div className="form-group">
                <label>Age (Auto)</label>
                <input
                  name="childAge"
                  value={siblingData.childAge}
                  readOnly
                  style={{ backgroundColor: "#f1f5f9", cursor: "not-allowed" }}
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Gender</label>
                <select
                  name="gender"
                  value={siblingData.gender}
                  onChange={handleSiblingChange}
                >
                  <option value="">Select</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                </select>
              </div>
              <div className="form-group">
                <label>Admission ID</label>
                <input
                  name="admissionId"
                  value={siblingData.admissionId}
                  onChange={handleSiblingChange}
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Class / Grade</label>
                <input
                  name="childClass"
                  value={siblingData.childClass}
                  onChange={handleSiblingChange}
                />
              </div>
              <div className="form-group">
                <label>Monthly Fee (₹)</label>
                <input
                  type="number"
                  name="monthlyFee"
                  value={siblingData.monthlyFee}
                  onChange={handleSiblingChange}
                  style={{ fontWeight: "bold", color: "#16a34a" }}
                />
              </div>
              <div className="form-group">
                <label>Classes / Month</label>
                <input
                  type="number"
                  name="monthlyClassesTarget"
                  value={siblingData.monthlyClassesTarget}
                  onChange={handleSiblingChange}
                  style={{ fontWeight: "bold", color: "#0284c7" }}
                />
              </div>
            </div>
          </div>
        )}

        {formData.role !== "parent" && (
          <div className="form-section">
            <h4 className="section-title">Details</h4>
            {formData.role === "teacher" && (
              <>
                <div className="form-row">
                  <div className="form-group">
                    <label>Full Name</label>
                    <input
                      name="fullName"
                      value={formData.fullName}
                      onChange={handleChange}
                    />
                  </div>
                  <div className="form-group">
                    <label>Phone</label>
                    <input
                      name="phone"
                      value={formData.phone}
                      onChange={handleChange}
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Zoom ID</label>
                    <input
                      name="zoomId"
                      value={formData.zoomId}
                      onChange={handleChange}
                    />
                  </div>
                  <div className="form-group">
                    <label>Education / Qualification</label>
                    <input
                      name="education"
                      value={formData.education}
                      onChange={handleChange}
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Specialization</label>
                    <input
                      name="specialization"
                      value={formData.specialization}
                      onChange={handleChange}
                    />
                  </div>
                  <div className="form-group">
                    <label>Salary</label>
                    <input
                      type="number"
                      name="monthlyFee"
                      value={formData.monthlyFee}
                      onChange={handleChange}
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Date of Birth</label>
                    <input
                      type="date"
                      name="childDob"
                      value={formData.childDob}
                      onChange={handleChange}
                    />
                  </div>
                  <div className="form-group">
                    <label>Age</label>
                    <input
                      name="childAge"
                      value={formData.childAge}
                      readOnly
                      style={{ backgroundColor: "#f1f5f9" }}
                    />
                  </div>
                </div>
              </>
            )}

            {formData.role === "admin" && (
              <div className="form-row">
                <div className="form-group">
                  <label>Full Name</label>
                  <input
                    name="fullName"
                    value={formData.fullName}
                    onChange={handleChange}
                  />
                </div>
                <div className="form-group">
                  <label>DOB</label>
                  <input
                    type="date"
                    name="dob"
                    value={formData.dob}
                    onChange={handleChange}
                  />
                </div>
              </div>
            )}
            <div className="form-group" style={{ marginTop: "15px" }}>
              <label>Joining Date</label>
              <input
                type="date"
                name="joiningDate"
                value={formData.joiningDate}
                onChange={handleChange}
              />
            </div>
          </div>
        )}

        <button
          type="submit"
          className="save-btn"
          style={{ marginTop: "20px" }}
        >
          {showSibling ? "Register Both Siblings" : "Register User"}
        </button>
      </form>
      {msg && <p className="status-msg">{msg}</p>}
    </div>
  );
};

// --- TAB 4: CLASS MANAGEMENT & SLOT & GALLERY ---
const ClassManagementTab = () => {
  const [classes, setClasses] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [selectedClass, setSelectedClass] = useState(null);
  const [showClassModal, setShowClassModal] = useState({
    show: false,
    isEdit: false,
  });
  const [assignModal, setAssignModal] = useState({
    show: false,
    classId: null,
    className: "",
  });
  const [deleteClassModal, setDeleteClassModal] = useState({
    show: false,
    classId: null,
  });
  const [toast, setToast] = useState({ show: false, message: "", type: "" });
  const [searchTerm, setSearchTerm] = useState("");
  const [sortOrder, setSortOrder] = useState("newest");
  const [classModeFilter, setClassModeFilter] = useState("all");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const ts = Date.now();
      const classRes = await axios.get(
        `https://art-portal-7n6r.onrender.com/api/classes?_t=${ts}`,
      );
      setClasses(classRes.data);
      const userRes = await axios.get(
        `https://art-portal-7n6r.onrender.com/api/users?_t=${ts}`,
      );
      setTeachers(userRes.data.filter((u) => u.role === "teacher"));
      return classRes.data;
    } catch (err) {
      console.error(err);
      return [];
    }
  };

  const showToast = (message, type = "success") => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: "", type: "" }), 3000);
  };

  const handleClassSaved = async () => {
    setShowClassModal({ show: false, isEdit: false });
    const updatedClasses = await fetchData();
    if (selectedClass) {
      const refreshed = updatedClasses.find((c) => c._id === selectedClass._id);
      if (refreshed) setSelectedClass(refreshed);
    }
    showToast("Class saved successfully!", "success");
  };

  const initiateDeleteClass = (classId) => {
    setDeleteClassModal({ show: true, classId });
  };

  const confirmClassDelete = async () => {
    try {
      await axios.delete(
        `https://art-portal-7n6r.onrender.com/api/classes/${deleteClassModal.classId}`,
      );
      await fetchData();
      setDeleteClassModal({ show: false, classId: null });
      setSelectedClass(null);
      showToast("Class deleted successfully!", "success");
    } catch (err) {
      showToast("Error deleting class", "error");
    }
  };

  const filteredClasses = classes.filter((cls) => {
    const term = searchTerm.toLowerCase();
    const matchesBasic =
      cls.className.toLowerCase().includes(term) ||
      cls.level.toLowerCase().includes(term);
    const teacherName = cls.teacher
      ? cls.teacher.fullName || cls.teacher.username
      : "";
    const matchesTeacher = teacherName.toLowerCase().includes(term);
    const matchesStudent = cls.students.some(
      (s) =>
        (s.childName && s.childName.toLowerCase().includes(term)) ||
        (s.fullName && s.fullName.toLowerCase().includes(term)),
    );
    const matchesMode =
      classModeFilter === "all" || (cls.classMode || "online") === classModeFilter;
    return (matchesBasic || matchesTeacher || matchesStudent) && matchesMode;
  });

  const sortedClasses = [...filteredClasses].sort((a, b) => {
    if (sortOrder === "newest")
      return new Date(b.createdAt) - new Date(a.createdAt);
    if (sortOrder === "oldest")
      return new Date(a.createdAt) - new Date(b.createdAt);
    if (sortOrder === "name-asc") return a.className.localeCompare(b.className);
    if (sortOrder === "most-students")
      return b.students.length - a.students.length;
    if (sortOrder === "least-students")
      return a.students.length - b.students.length;
    return 0;
  });

  return (
    <>
      <div
        className={`toast-notification ${toast.type} ${toast.show ? "show" : ""}`}
      >
        {toast.type === "success" ? "✅" : "❌"} {toast.message}
      </div>

      {selectedClass ? (
        <ClassDetailsView
          cls={selectedClass}
          onBack={() => setSelectedClass(null)}
          onEdit={() => setShowClassModal({ show: true, isEdit: true })}
          onDelete={() => initiateDeleteClass(selectedClass._id)}
          onAssign={() =>
            setAssignModal({
              show: true,
              classId: selectedClass._id,
              className: selectedClass.className,
            })
          }
        />
      ) : (
        <div className="table-wrapper">
          <div className="filter-bar">
            <div className="search-box">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#888"
                strokeWidth="2"
              >
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
              <input
                type="text"
                placeholder="Search Class, Student, Level..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="filter-actions">
              <div className="filter-dropdown">
                <label>Mode:</label>
                <select
                  value={classModeFilter}
                  onChange={(e) => setClassModeFilter(e.target.value)}
                >
                  <option value="all">All Modes</option>
                  <option value="online">🌐 Online</option>
                  <option value="offline">🏫 Offline</option>
                </select>
              </div>
              <div className="filter-dropdown">
                <label>Sort By:</label>
                <select
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value)}
                >
                  <option value="newest">Newest First</option>
                  <option value="oldest">Oldest First</option>
                  <option value="name-asc">Name (A-Z)</option>
                  <option value="most-students">Most Students</option>
                  <option value="least-students">Least Students</option>
                </select>
              </div>
              <button
                className="save-btn"
                style={{
                  width: "auto",
                  padding: "8px 16px",
                  height: "38px",
                  display: "flex",
                  alignItems: "center",
                }}
                onClick={() => setShowClassModal({ show: true, isEdit: false })}
              >
                + New Class
              </button>
            </div>
          </div>

          <div className="table-container">
            <table className="custom-table clickable-rows">
              <thead>
                <tr>
                  <th>Class Name</th>
                  <th>Mode</th>
                  <th>Level / Sub-Level</th>
                  <th>Teacher</th>
                  <th>Students</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {sortedClasses.length === 0 ? (
                  <tr>
                    <td
                      colSpan="5"
                      style={{
                        textAlign: "center",
                        padding: "30px",
                        color: "#94a3b8",
                      }}
                    >
                      No classes found matching "{searchTerm}".
                    </td>
                  </tr>
                ) : (
                  sortedClasses.map((cls) => (
                    <tr
                      key={cls._id}
                      onClick={() => setSelectedClass(cls)}
                      className="user-row"
                    >
                      <td style={{ fontWeight: "600", color: "#0284c7" }}>
                        {cls.className}
                      </td>
                      <td>
                        <span className={`mode-badge ${cls.classMode || "online"}`}>
                          {cls.classMode === "offline" ? "🏫 Offline" : "🌐 Online"}
                        </span>
                      </td>
                      <td>
                        <span className="level-badge">{cls.level}</span>
                        {cls.subLevel && (
                          <span
                            style={{
                              marginLeft: "8px",
                              fontSize: "0.85rem",
                              color: "#64748b",
                            }}
                          >
                            ({cls.subLevel})
                          </span>
                        )}
                      </td>
                      <td>
                        {cls.teacher ? (
                          cls.teacher.fullName || cls.teacher.username
                        ) : (
                          <span style={{ color: "red" }}>Unassigned</span>
                        )}
                      </td>
                      <td>
                        <span className="student-count-badge">
                          {cls.students.length} Students
                        </span>
                      </td>
                      <td>
                        <span style={{ color: "#64748b", fontSize: "0.9rem" }}>
                          View Details →
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showClassModal.show && (
        <ClassModal
          teachers={teachers}
          existingClasses={classes}
          initialData={showClassModal.isEdit ? selectedClass : null}
          onClose={() => setShowClassModal({ show: false, isEdit: false })}
          onSuccess={handleClassSaved}
        />
      )}

      {assignModal.show && (
        <AssignStudentsModal
          classId={assignModal.classId}
          className={assignModal.className}
          onClose={() => setAssignModal({ show: false, classId: null })}
          onRefresh={async () => {
            const updatedClasses = await fetchData();
            if (selectedClass) {
              const refreshed = updatedClasses.find(
                (c) => c._id === selectedClass._id,
              );
              if (refreshed) setSelectedClass(refreshed);
            }
            showToast("Students assigned!", "success");
          }}
        />
      )}

      {deleteClassModal.show && (
        <div className="modal-overlay">
          <div className="modal-content delete-modal-content">
            <h3>Delete Class?</h3>
            <p
              style={{
                color: "#64748b",
                marginBottom: "20px",
                lineHeight: "1.5",
              }}
            >
              Are you sure you want to delete this class? <br />
              <strong style={{ color: "#ef4444" }}>
                This will unassign all students.
              </strong>
            </p>
            <div className="modal-actions">
              <button
                className="cancel-btn"
                onClick={() =>
                  setDeleteClassModal({ show: false, classId: null })
                }
              >
                Cancel
              </button>
              <button
                className="confirm-delete-btn"
                onClick={confirmClassDelete}
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

// --- TAB: SLOT MANAGEMENT ---
const SlotManagementTab = () => {
  const [classes, setClasses] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [selectedDay, setSelectedDay] = useState(
    new Date().getDay() === 0
      ? "Saturday"
      : [
          "Sunday",
          "Monday",
          "Tuesday",
          "Wednesday",
          "Thursday",
          "Friday",
          "Saturday",
        ][new Date().getDay()],
  );
  const [loading, setLoading] = useState(true);
  const [showClassModal, setShowClassModal] = useState({
    show: false,
    initialData: null,
  });

  const days = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
  ];

  const TIME_SLOTS = {
    morning: [
      { id: "m0", start: "05:00", end: "06:00", label: "05:00 - 06:00 am" },
      { id: "m1", start: "06:00", end: "07:00", label: "06:00 - 07:00 am" },
      { id: "m2", start: "07:00", end: "08:00", label: "07:00 - 08:00 am" },
    ],
    evening: [
      { id: "e1", start: "18:30", end: "19:30", label: "06:30 - 07:30 pm" },
      { id: "e1b", start: "19:30", end: "20:30", label: "07:30 - 08:30 pm" },
      { id: "e2", start: "20:30", end: "21:30", label: "08:30 - 09:30 pm" },
      { id: "e3", start: "21:30", end: "22:30", label: "09:30 - 10:30 pm" },
      { id: "e4", start: "22:30", end: "23:30", label: "10:30 - 11:30 pm" },
    ],
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const classRes = await axios.get(
        "https://art-portal-7n6r.onrender.com/api/classes",
      );
      setClasses(classRes.data);
      const userRes = await axios.get(
        "https://art-portal-7n6r.onrender.com/api/users",
      );
      setTeachers(userRes.data.filter((u) => u.role === "teacher"));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSlotClick = (startTime) => {
    setShowClassModal({
      show: true,
      initialData: {
        className: "",
        level: "",
        subLevel: "",
        teacherId: "",
        meetingLink: "",
        maxCapacity: 10,
        schedule: [{ day: selectedDay, time: startTime }],
      },
    });
  };

  const handleEditClick = (cls) => {
    setShowClassModal({ show: true, initialData: cls });
  };

  const handleModalSuccess = () => {
    setShowClassModal({ show: false, initialData: null });
    fetchData();
    alert("Schedule updated successfully!");
  };

  const getClassesForSlot = (timeStart) => {
    return classes.filter((cls) =>
      cls.schedule.some((s) => s.day === selectedDay && s.time === timeStart),
    );
  };

  const isEveningBlocked = false;

  const renderClassCard = (assignedClass, totalInSlot = 1) => {
    const enrolled = assignedClass.students.length;
    const capacity = assignedClass.maxCapacity || 10;
    const isFull = enrolled >= capacity;

    return (
      <div
        key={assignedClass._id}
        className="detail-card slot-class-card"
        style={{
          margin: 0,
          borderLeft: isFull ? "4px solid #ef4444" : "4px solid #3b82f6",
          minHeight: "100px",
          flex: totalInSlot === 1 ? "1 1 100%" : "1 1 220px",
          minWidth: totalInSlot === 1 ? "100%" : "200px",
          maxWidth: totalInSlot === 1 ? "none" : "320px",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: "5px",
          }}
        >
          <span className="slot-card-title" style={{ fontWeight: "bold", color: "#334155", fontSize: "0.9rem" }}>
            {assignedClass.className}
          </span>
          <span
            style={{
              fontSize: "0.7rem",
              padding: "2px 6px",
              borderRadius: "4px",
              background: isFull ? "#fee2e2" : "#eff6ff",
              color: isFull ? "#991b1b" : "#1d4ed8",
              fontWeight: "bold",
              whiteSpace: "nowrap",
            }}
          >
            {isFull ? "FULL" : `${capacity - enrolled} Open`}
          </span>
        </div>
        <div
          className="slot-card-subtext"
          style={{
            fontSize: "0.78rem",
            color: "#64748b",
            marginBottom: "8px",
          }}
        >
          {assignedClass.level} ({assignedClass.subLevel})
        </div>
        <div
          style={{
            height: "6px",
            width: "100%",
            background: "#e2e8f0",
            borderRadius: "3px",
            marginBottom: "8px",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${Math.min((enrolled / capacity) * 100, 100)}%`,
              background: isFull ? "#ef4444" : "#3b82f6",
            }}
          ></div>
        </div>
        <div className="slot-card-title" style={{ fontSize: "0.75rem", color: "#334155" }}>
          Teacher:{" "}
          <strong>
            {assignedClass.teacher ? assignedClass.teacher.fullName : "N/A"}
          </strong>
        </div>
      </div>
    );
  };

  const renderSlotCard = (slot, isBlocked) => {
    const assignedClasses = getClassesForSlot(slot.start);

    if (isBlocked && assignedClasses.length === 0) {
      return (
        <div
          key={slot.id}
          className="slot-empty-card"
          style={{
            background: "#f1f5f9",
            border: "1px dashed #cbd5e1",
            borderRadius: "8px",
            padding: "15px",
            opacity: 0.6,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "100px",
          }}
        >
          <span style={{ color: "#94a3b8", fontSize: "0.9rem", fontStyle: "italic" }}>
            available
          </span>
        </div>
      );
    }

    if (assignedClasses.length > 0) {
      return (
        <div
          key={slot.id}
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "12px",
            alignItems: "stretch",
          }}
        >
          {assignedClasses.map((cls) => renderClassCard(cls, assignedClasses.length))}
        </div>
      );
    }

    return (
      <div
        key={slot.id}
        className="slot-empty-card"
        style={{
          background: "#f8fafc",
          border: "1px dashed #cbd5e1",
          borderRadius: "8px",
          padding: "15px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100px",
        }}
      >
        <div style={{ color: "#94a3b8", fontSize: "0.9rem", fontStyle: "italic" }}>
          No class scheduled
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="table-wrapper">
        <div
          className="filter-bar"
          style={{ overflowX: "auto", paddingBottom: "5px" }}
        >
          {days.map((day) => (
            <button
              key={day}
              onClick={() => setSelectedDay(day)}
              className={selectedDay === day ? "save-btn" : "cancel-btn"}
              style={{
                borderRadius: "20px",
                padding: "8px 16px",
                marginRight: "10px",
                background: selectedDay === day ? "#0284c7" : "#f1f5f9",
                color: selectedDay === day ? "#fff" : "#64748b",
                border: "none",
                cursor: "pointer",
              }}
            >
              {day}
            </button>
          ))}
        </div>

        <div style={{ padding: "25px" }}>
          <div style={{ marginBottom: "30px" }}>
            <h3
              style={{
                background: "#ffedd5",
                color: "#c2410c",
                padding: "10px 15px",
                borderRadius: "6px",
                display: "inline-block",
                margin: "0 0 15px 0",
                fontSize: "1rem",
              }}
            >
              ☀️ Morning Slots (IST)
            </h3>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "200px 1fr",
                gap: "20px",
                alignItems: "start",
              }}
            >
              {TIME_SLOTS.morning.map((slot) => (
                <React.Fragment key={slot.id}>
                  <div
                    className="slot-time-label"
                    style={{
                      padding: "15px",
                      background: "#fff",
                      border: "1px solid #e2e8f0",
                      borderRadius: "8px",
                      fontWeight: "bold",
                      color: "#334155",
                      display: "flex",
                      alignItems: "center",
                      height: "100px",
                    }}
                  >
                    {slot.label}
                  </div>
                  {renderSlotCard(slot, false)}
                </React.Fragment>
              ))}
            </div>
          </div>

          <div>
            <h3
              style={{
                background: "#e0e7ff",
                color: "#4338ca",
                padding: "10px 15px",
                borderRadius: "6px",
                display: "inline-block",
                margin: "0 0 15px 0",
                fontSize: "1rem",
              }}
            >
              🌙 Evening Slots (IST)
            </h3>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "200px 1fr",
                gap: "20px",
                alignItems: "start",
              }}
            >
              {TIME_SLOTS.evening.map((slot) => (
                <React.Fragment key={slot.id}>
                  <div
                    className="slot-time-label"
                    style={{
                      padding: "15px",
                      background: "#fff",
                      border: "1px solid #e2e8f0",
                      borderRadius: "8px",
                      fontWeight: "bold",
                      color: "#334155",
                      display: "flex",
                      alignItems: "center",
                      height: "100px",
                    }}
                  >
                    {slot.label}
                  </div>
                  {renderSlotCard(slot, isEveningBlocked)}
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>
      </div>

      {showClassModal.show && (
        <ClassModal
          teachers={teachers}
          existingClasses={classes}
          initialData={showClassModal.initialData}
          onClose={() => setShowClassModal({ show: false, initialData: null })}
          onSuccess={handleModalSuccess}
        />
      )}
    </>
  );
};

const FeeTrackerTab = ({ initialFilter = "all", offlineOnly = false, onlineOnly = false, onRefresh }) => {
  const [allStudents, setAllStudents] = useState([]);
  const students = offlineOnly
    ? allStudents.filter((s) => s.classMode === "offline")
    : onlineOnly
      ? allStudents.filter((s) => (s.classMode || "online") !== "offline")
      : allStudents;
  const [selectedMonth, setSelectedMonth] = useState(
    new Date().toISOString().slice(0, 7),
  );
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState(initialFilter);
  const [sortOrder, setSortOrder] = useState("name-asc");
  const [showAnalytics, setShowAnalytics] = useState(false);

  // Student Pass states
  const [passModal, setPassModal] = useState({ show: false, student: null });
  const [passReason, setPassReason] = useState("");
  const [passCustomReason, setPassCustomReason] = useState("");
  const [passHistoryModal, setPassHistoryModal] = useState({ show: false, student: null, passes: [] });
  const [passLoading, setPassLoading] = useState(false);

  useEffect(() => {
    fetchStudents();
  }, []);

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const res = await axios.get(
        "https://art-portal-7n6r.onrender.com/api/users",
      );
      setAllStudents(res.data.filter((u) => u.role === "parent"));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // ✨ HELPER: Get valid start month (YYYY-MM)
  const getStudentStartMonth = (student) => {
    // Prioritize registeredDate, fallback to joiningDate or createdAt
    let dateStr =
      student.registeredDate || student.joiningDate || student.createdAt;
    if (!dateStr) return new Date().toISOString().slice(0, 7); // Default to today

    // Handle if it's a full ISO string (2024-02-15...) -> "2024-02"
    if (typeof dateStr === "string") return dateStr.slice(0, 7);
    return new Date(dateStr).toISOString().slice(0, 7);
  };

  const handleTogglePayment = async (studentId, currentStatus, feeAmount) => {
    if (currentStatus === "Not Joined") return; // 🔒 Prevent action if not joined

    const newStatus = currentStatus === "Paid" ? "Pending" : "Paid";
    const updatedStudents = allStudents.map((s) => {
      if (s._id === studentId) {
        let newPayments = [...(s.payments || [])];
        if (newStatus === "Paid") {
          newPayments.push({
            month: selectedMonth,
            status: "Paid",
            amount: feeAmount,
          });
        } else {
          newPayments = newPayments.filter((p) => p.month !== selectedMonth);
        }
        return { ...s, payments: newPayments };
      }
      return s;
    });
    setAllStudents(updatedStudents);
    try {
      await axios.post("https://art-portal-7n6r.onrender.com/api/fees/update", {
        userId: studentId,
        month: selectedMonth,
        status: newStatus,
        amount: feeAmount,
      });
      if (onRefresh) onRefresh();
    } catch (err) {
      alert("Error updating payment");
      fetchStudents();
    }
  };

  // --- Student Pass Handlers ---
  const handleMarkPass = async () => {
    if (!passModal.student) return;
    setPassLoading(true);
    try {
      const res = await axios.post("https://art-portal-7n6r.onrender.com/api/student-pass/mark", {
        userId: passModal.student._id,
        month: selectedMonth,
        reason: passReason === "Other" ? passCustomReason : passReason,
        markedBy: "admin",
      });
      setAllStudents((prev) =>
        prev.map((s) =>
          s._id === passModal.student._id
            ? { ...s, passes: res.data.passes, payments: res.data.payments }
            : s,
        ),
      );
      setPassModal({ show: false, student: null });
      setPassReason("");
      setPassCustomReason("");
      if (onRefresh) onRefresh();
    } catch (err) {
      alert(err.response?.data?.message || "Error marking pass");
    } finally {
      setPassLoading(false);
    }
  };

  const handleRemovePass = async (studentId) => {
    try {
      const res = await axios.post("https://art-portal-7n6r.onrender.com/api/student-pass/remove", {
        userId: studentId,
        month: selectedMonth,
      });
      setAllStudents((prev) =>
        prev.map((s) =>
          s._id === studentId ? { ...s, passes: res.data.passes } : s,
        ),
      );
      if (onRefresh) onRefresh();
    } catch (err) {
      alert("Error removing pass");
    }
  };

  const handleViewPassHistory = async (student) => {
    try {
      const res = await axios.get(`https://art-portal-7n6r.onrender.com/api/student-pass/${student._id}`);
      setPassHistoryModal({ show: true, student, passes: res.data });
    } catch (err) {
      alert("Error fetching pass history");
    }
  };

  // Check if student has a pass for the selected month
  const hasPassForMonth = (student, month) => {
    return (student.passes || []).some((p) => p.month === (month || selectedMonth));
  };

  // Check if selected month is BEFORE student joined, or student is inactive, or has pass
  const getPaymentStatus = (student) => {
    const startMonth = getStudentStartMonth(student);
    if (selectedMonth < startMonth) return "Not Joined";
    if (isStudentInactiveForMonth(student, selectedMonth)) return "Inactive";
    if (hasPassForMonth(student)) return "Pass";
    return (student.payments || []).find((p) => p.month === selectedMonth)
      ? "Paid"
      : "Pending";
  };

  const changeMonth = (offset) => {
    const d = new Date(selectedMonth + "-01");
    d.setMonth(d.getMonth() + offset);
    setSelectedMonth(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
    );
  };

  const calculateTotalPending = (student) => {
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth();

    // ✨ Use the robust helper
    const startMonthStr = getStudentStartMonth(student); // "YYYY-MM"
    const parts = startMonthStr.split("-");
    const startYear = parseInt(parts[0], 10);
    const startMonthIdx = parseInt(parts[1], 10) - 1;

    const startTotalIndex = startYear * 12 + startMonthIdx;
    const currentTotalIndex = currentYear * 12 + currentMonth;

    let pendingCount = 0;
    let pendingAmount = 0;

    let iterIndex = startTotalIndex;
    // Loop from Start Month -> Current Month
    while (iterIndex <= currentTotalIndex) {
      const y = Math.floor(iterIndex / 12);
      const m = iterIndex % 12;
      const monthStr = `${y}-${String(m + 1).padStart(2, "0")}`;

      const isPaid = (student.payments || []).some(
        (p) => p.month === monthStr && p.status === "Paid",
      );
      const isPass = hasPassForMonth(student, monthStr);
      const isInactive = isStudentInactiveForMonth(student, monthStr);

      if (!isPaid && !isPass && !isInactive) {
        pendingCount++;
        pendingAmount += getFeeForMonth(student, monthStr);
      }
      iterIndex++;
    }

    return { count: pendingCount, amount: pendingAmount };
  };

  const totalEstRevenue = students.reduce((acc, s) => {
    const status = getPaymentStatus(s);
    if (status === "Not Joined" || status === "Pass" || status === "Inactive") return acc;
    if (status === "Paid") {
      const payment = (s.payments || []).find(p => p.month === selectedMonth);
      return acc + (payment?.amount ?? getFeeForMonth(s, selectedMonth) ?? 0);
    }
    return acc + getFeeForMonth(s, selectedMonth);
  }, 0);

  const currentCollected = students.reduce((acc, s) => {
    if (getPaymentStatus(s) !== "Paid") return acc;
    const payment = (s.payments || []).find(p => p.month === selectedMonth);
    return acc + (payment?.amount ?? s.monthlyFee ?? 0);
  }, 0);
  const currentPending = totalEstRevenue - currentCollected;
  const totalOutstandingAllTime = students.reduce(
    (acc, s) => acc + calculateTotalPending(s).amount,
    0,
  );

  const processedStudents = students
    .filter(
      (s) =>
        (filterStatus === "Inactive"
          ? getPaymentStatus(s) === "Inactive"
          : filterStatus === "all"
            ? getPaymentStatus(s) !== "Inactive"
            : getPaymentStatus(s) === filterStatus) &&
        ((s.childName || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
          (s.fullName || "").toLowerCase().includes(searchTerm.toLowerCase())),
    )
    .sort((a, b) => {
      if (sortOrder === "name-asc")
        return (a.childName || "").localeCompare(b.childName || "");
      if (sortOrder === "fee-high")
        return (b.monthlyFee || 0) - (a.monthlyFee || 0);
      if (sortOrder === "total-pending-high")
        return (
          calculateTotalPending(b).amount - calculateTotalPending(a).amount
        );
      return 0;
    });

  const DonutChart = ({ value, total, color, label }) => {
    const percentage = total > 0 ? (value / total) * 100 : 0;
    const strokeDasharray = `${percentage}, 100`;
    return (
      <div
        className="donut-chart-card"
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          background: "#fff",
          padding: "20px",
          borderRadius: "12px",
          boxShadow: "0 2px 5px rgba(0,0,0,0.05)",
          flex: 1,
        }}
      >
        <h4
          className="donut-chart-label"
          style={{
            margin: "0 0 15px 0",
            color: "#64748b",
            fontSize: "0.9rem",
            textTransform: "uppercase",
          }}
        >
          {label}
        </h4>
        <div style={{ position: "relative", width: "120px", height: "120px" }}>
          <svg
            viewBox="0 0 36 36"
            style={{
              transform: "rotate(-90deg)",
              width: "100%",
              height: "100%",
            }}
          >
            <path
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              fill="none"
              stroke="#e2e8f0"
              strokeWidth="4"
            />
            <path
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              fill="none"
              stroke={color}
              strokeWidth="4"
              strokeDasharray={strokeDasharray}
            />
          </svg>
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              textAlign: "center",
            }}
          >
            <span
              className="donut-chart-percent"
              style={{
                fontSize: "1.2rem",
                fontWeight: "bold",
                color: "#334155",
              }}
            >
              {Math.round(percentage)}%
            </span>
          </div>
        </div>
        <div style={{ marginTop: "15px", textAlign: "center" }}>
          <div
            className="donut-chart-value"
            style={{ fontSize: "1.1rem", fontWeight: "bold", color: "#334155" }}
          >
            ₹{value.toLocaleString()}
          </div>
          <div
            className="donut-chart-total"
            style={{ fontSize: "0.8rem", color: "#94a3b8" }}
          >
            out of ₹{total.toLocaleString()}
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      {(offlineOnly || onlineOnly) && (
        <div style={{
          background: offlineOnly
            ? "linear-gradient(135deg, #d97706 0%, #b45309 100%)"
            : "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)",
          borderRadius: "12px",
          padding: "16px 24px",
          color: "#fff",
          display: "flex",
          alignItems: "center",
          gap: "12px",
          marginBottom: "20px",
          boxShadow: offlineOnly
            ? "0 4px 12px rgba(217, 119, 6, 0.3)"
            : "0 4px 12px rgba(2, 132, 199, 0.3)",
        }}>
          <span style={{ fontSize: "1.5rem" }}>{offlineOnly ? "🏫" : "🌐"}</span>
          <div>
            <div style={{ fontWeight: "700", fontSize: "1rem" }}>
              {offlineOnly ? "Offline Fee Tracker" : "Online Fee Tracker"}
            </div>
            <div style={{ fontSize: "0.85rem", opacity: 0.9 }}>
              Showing only {offlineOnly ? "offline" : "online"} students · {students.length} student{students.length !== 1 ? "s" : ""}
            </div>
          </div>
        </div>
      )}
      <div className="table-wrapper">
        <div
          className="filter-bar fee-filter-bar"
          style={{ flexWrap: "wrap", gap: "15px" }}
        >
          <div
            className="fee-month-nav"
            style={{ display: "flex", alignItems: "center", gap: "5px" }}
          >
            <button
              onClick={() => changeMonth(-1)}
              className="icon-btn"
              style={{
                background: "#e2e8f0",
                width: "30px",
                height: "30px",
                borderRadius: "4px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              &lt;
            </button>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              style={{
                padding: "6px",
                borderRadius: "4px",
                border: "1px solid #cbd5e1",
                fontWeight: "600",
                color: "#0284c7",
              }}
            />
            <button
              onClick={() => changeMonth(1)}
              className="icon-btn"
              style={{
                background: "#e2e8f0",
                width: "30px",
                height: "30px",
                borderRadius: "4px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              &gt;
            </button>
          </div>

          <button
            onClick={() => setShowAnalytics(!showAnalytics)}
            className="save-btn fee-analytics-btn"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              backgroundColor: showAnalytics ? "#334155" : "#0284c7",
            }}
          >
            {showAnalytics ? "📄 View List" : "📊 View Analytics"}
          </button>

          {!showAnalytics && (
            <>
              <div className="search-box">
                <input
                  type="text"
                  placeholder="Search..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="filter-dropdown">
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                >
                  <option value="all">All Status</option>
                  <option value="Paid">Paid</option>
                  <option value="Pending">Pending</option>
                  <option value="Pass">Pass</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>
              <div className="filter-dropdown">
                <select
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value)}
                >
                  <option value="name-asc">Name (A-Z)</option>
                  <option value="total-pending-high">Highest Dues</option>
                </select>
              </div>
            </>
          )}
        </div>

        {showAnalytics ? (
          <div
            className="analytics-section"
            style={{ padding: "30px", background: "#f8fafc" }}
          >
            <h3
              className="analytics-title"
              style={{ marginBottom: "20px", color: "#334155" }}
            >
              Analytics for{" "}
              {new Date(selectedMonth).toLocaleString("default", {
                month: "long",
                year: "numeric",
              })}
            </h3>
            <div
              className="analytics-charts-row"
              style={{
                display: "flex",
                gap: "20px",
                flexWrap: "wrap",
                marginBottom: "30px",
              }}
            >
              <DonutChart
                value={currentCollected}
                total={totalEstRevenue}
                color="#10b981"
                label="Collection Rate"
              />
              <DonutChart
                value={currentPending}
                total={totalEstRevenue}
                color="#f59e0b"
                label="Pending Dues"
              />
              <DonutChart
                value={totalOutstandingAllTime}
                total={totalOutstandingAllTime + currentCollected}
                color="#ef4444"
                label="Total Outstanding"
              />
            </div>
          </div>
        ) : (
          <>
            <div
              className="fee-summary-grid"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                gap: "15px",
                padding: "15px 20px",
                background: "#f8fafc",
                borderBottom: "1px solid #e2e8f0",
              }}
            >
              <div
                className="fee-summary-card"
                style={{
                  background: "#fff",
                  padding: "10px",
                  borderRadius: "8px",
                  border: "1px solid #e2e8f0",
                }}
              >
                <div
                  className="fee-summary-label"
                  style={{
                    fontSize: "0.75rem",
                    color: "#64748b",
                    fontWeight: "bold",
                  }}
                >
                  EST. REVENUE
                </div>
                <div
                  className="fee-summary-value"
                  style={{
                    fontSize: "1.2rem",
                    fontWeight: "bold",
                    color: "#334155",
                  }}
                >
                  ₹{totalEstRevenue.toLocaleString()}
                </div>
              </div>
              <div
                className="fee-summary-card"
                style={{
                  background: "#fff",
                  padding: "10px",
                  borderRadius: "8px",
                  border: "1px solid #e2e8f0",
                }}
              >
                <div
                  className="fee-summary-label"
                  style={{
                    fontSize: "0.75rem",
                    color: "#64748b",
                    fontWeight: "bold",
                  }}
                >
                  COLLECTED
                </div>
                <div
                  className="fee-summary-value fee-collected"
                  style={{
                    fontSize: "1.2rem",
                    fontWeight: "bold",
                    color: "#16a34a",
                  }}
                >
                  ₹{currentCollected.toLocaleString()}
                </div>
              </div>
              <div
                className="fee-summary-card"
                style={{
                  background: "#fff",
                  padding: "10px",
                  borderRadius: "8px",
                  border: "1px solid #e2e8f0",
                }}
              >
                <div
                  className="fee-summary-label"
                  style={{
                    fontSize: "0.75rem",
                    color: "#64748b",
                    fontWeight: "bold",
                  }}
                >
                  PENDING
                </div>
                <div
                  className="fee-summary-value fee-pending"
                  style={{
                    fontSize: "1.2rem",
                    fontWeight: "bold",
                    color: "#f59e0b",
                  }}
                >
                  ₹{currentPending.toLocaleString()}
                </div>
              </div>
              <div
                className="fee-summary-card fee-outstanding-card"
                style={{
                  background: "#fee2e2",
                  padding: "10px",
                  borderRadius: "8px",
                  border: "1px solid #fecaca",
                }}
              >
                <div
                  className="fee-summary-label fee-outstanding-label"
                  style={{
                    fontSize: "0.75rem",
                    color: "#991b1b",
                    fontWeight: "bold",
                  }}
                >
                  TOTAL OUTSTANDING
                </div>
                <div
                  className="fee-summary-value fee-outstanding-value"
                  style={{
                    fontSize: "1.2rem",
                    fontWeight: "bold",
                    color: "#dc2626",
                  }}
                >
                  ₹{totalOutstandingAllTime.toLocaleString()}
                </div>
              </div>
            </div>
            <div className="table-container">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Student Name</th>
                    <th>Monthly Fee</th>
                    <th>
                      Status (
                      {new Date(selectedMonth).toLocaleString("default", {
                        month: "short",
                      })}
                      )
                    </th>
                    <th>Total Pending Dues</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td
                        colSpan="5"
                        style={{ textAlign: "center", padding: "20px" }}
                      >
                        Loading...
                      </td>
                    </tr>
                  ) : processedStudents.length === 0 ? (
                    <tr>
                      <td
                        colSpan="5"
                        style={{ textAlign: "center", padding: "20px" }}
                      >
                        No students found.
                      </td>
                    </tr>
                  ) : (
                    processedStudents.map((student) => {
                      const status = getPaymentStatus(student);
                      const isPaid = status === "Paid";
                      const isNotJoined = status === "Not Joined";
                      const isPass = status === "Pass";
                      const isInactive = status === "Inactive";
                      const pendingStats = calculateTotalPending(student);
                      const passRecord = (student.passes || []).find((p) => p.month === selectedMonth);
                      return (
                        <tr key={student._id}>
                          <td style={{ fontWeight: "600", color: "#334155" }}>
                            {student.childName}
                            <div
                              style={{
                                fontSize: "0.75rem",
                                color: "#64748b",
                                fontWeight: "normal",
                              }}
                            >
                              {student.fullName}
                            </div>
                            {(student.passes || []).length > 0 && (
                              <button
                                onClick={() => handleViewPassHistory(student)}
                                style={{
                                  fontSize: "0.7rem",
                                  color: "#7c3aed",
                                  background: "none",
                                  border: "none",
                                  cursor: "pointer",
                                  padding: 0,
                                  textDecoration: "underline",
                                }}
                              >
                                View Pass History
                              </button>
                            )}
                          </td>
                          <td style={{ fontWeight: "bold" }}>
                            {isPass ? (
                              <span style={{ color: "#7c3aed" }}>₹0 (Pass)</span>
                            ) : isInactive ? (
                              <span style={{ color: "#94a3b8" }}>₹0 (Inactive)</span>
                            ) : isPaid ? (
                              <>₹{(student.payments || []).find(p => p.month === selectedMonth)?.amount ?? student.monthlyFee}</>
                            ) : (
                              <>₹{student.monthlyFee}</>
                            )}
                          </td>
                          <td>
                            {isNotJoined ? (
                              <span className="role-badge" style={{ background: "#e2e8f0", color: "#64748b", border: "1px solid #cbd5e1" }}>
                                N/A
                              </span>
                            ) : isInactive ? (
                              <span className="role-badge" style={{ background: "#f1f5f9", color: "#475569", border: "1px solid #cbd5e1" }}>
                                💤 Inactive
                              </span>
                            ) : isPass ? (
                              <div>
                                <span className="role-badge" style={{ background: "#ede9fe", color: "#7c3aed", border: "1px solid #c4b5fd" }}>
                                  Pass
                                </span>
                                {passRecord?.reason && (
                                  <div style={{ fontSize: "0.7rem", color: "#7c3aed", marginTop: "2px" }}>
                                    {passRecord.reason}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span
                                className={`role-badge ${isPaid ? "teacher" : "admin"}`}
                                style={{ background: isPaid ? "#dcfce7" : "#fee2e2", color: isPaid ? "#166534" : "#991b1b" }}
                              >
                                {isPaid ? "Paid" : "Pending"}
                              </span>
                            )}
                          </td>
                          <td>
                            {pendingStats.amount > 0 ? (
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "8px",
                                }}
                              >
                                <span
                                  style={{
                                    background: "#fef2f2",
                                    color: "#dc2626",
                                    border: "1px solid #fecaca",
                                    padding: "4px 8px",
                                    borderRadius: "6px",
                                    fontWeight: "bold",
                                    fontSize: "0.85rem",
                                  }}
                                >
                                  ₹{pendingStats.amount.toLocaleString()}
                                </span>
                                <span
                                  style={{
                                    fontSize: "0.75rem",
                                    color: "#dc2626",
                                  }}
                                >
                                  ({pendingStats.count} Mo)
                                </span>
                              </div>
                            ) : (
                              <span
                                style={{
                                  color: "#16a34a",
                                  fontSize: "0.85rem",
                                  fontWeight: "bold",
                                }}
                              >
                                All Clear{" "}
                              </span>
                            )}
                          </td>
                          <td>
                            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                              {isNotJoined ? (
                                <button
                                  className="save-btn"
                                  disabled
                                  style={{ width: "auto", padding: "6px 12px", fontSize: "0.85rem", backgroundColor: "#94a3b8", cursor: "not-allowed", opacity: 0.6 }}
                                >
                                  Not Joined
                                </button>
                              ) : isInactive ? (
                                <span style={{ color: "#94a3b8", fontSize: "0.82rem", fontStyle: "italic", padding: "6px 0" }}>
                                  No fee — student inactive
                                </span>
                              ) : isPass ? (
                                <button
                                  className="save-btn"
                                  style={{
                                    width: "auto",
                                    padding: "6px 12px",
                                    fontSize: "0.85rem",
                                    backgroundColor: "#dc2626",
                                  }}
                                  onClick={() => handleRemovePass(student._id)}
                                >
                                  Remove Pass
                                </button>
                              ) : (
                                <>
                                  <button
                                    className="save-btn"
                                    style={{
                                      width: "auto",
                                      padding: "6px 12px",
                                      fontSize: "0.85rem",
                                      backgroundColor: isPaid ? "#ef4444" : "#10b981",
                                    }}
                                    onClick={() =>
                                      handleTogglePayment(
                                        student._id,
                                        status,
                                        student.monthlyFee,
                                      )
                                    }
                                  >
                                    {isPaid ? "Mark Unpaid" : "Pay This Month"}
                                  </button>
                                  {!isPaid && (
                                    <button
                                      className="save-btn"
                                      style={{
                                        width: "auto",
                                        padding: "6px 12px",
                                        fontSize: "0.85rem",
                                        backgroundColor: "#7c3aed",
                                      }}
                                      onClick={() => { setPassReason(""); setPassCustomReason(""); setPassModal({ show: true, student }); }}
                                    >
                                      Mark Pass
                                    </button>
                                  )}
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* ===== PASS CONFIRMATION MODAL ===== */}
      {passModal.show && (
        <div
          style={{
            position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
            background: "rgba(0,0,0,0.5)", display: "flex",
            alignItems: "center", justifyContent: "center", zIndex: 9999,
          }}
          onClick={() => { setPassModal({ show: false, student: null }); setPassReason(""); setPassCustomReason(""); }}
        >
          <div
            className="dark-modal-card"
            style={{
              background: "#fff", borderRadius: "16px", padding: "30px",
              width: "90%", maxWidth: "420px", boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: "0 0 6px 0", color: "#334155" }}>Mark Student Pass</h3>
            <p style={{ color: "#64748b", fontSize: "0.9rem", margin: "0 0 20px 0" }}>
              <strong>{passModal.student?.childName}</strong> will have ₹0 fee for{" "}
              <strong>
                {new Date(selectedMonth + "-01").toLocaleString("default", {
                  month: "long", year: "numeric",
                })}
              </strong>.
              This will not affect other months.
            </p>
            <label style={{ fontSize: "0.85rem", fontWeight: "600", color: "#334155", display: "block", marginBottom: "6px" }}>
              Reason (optional)
            </label>
            <select
              value={passReason}
              onChange={(e) => setPassReason(e.target.value)}
              style={{
                width: "100%", padding: "10px", borderRadius: "8px",
                border: "1px solid #cbd5e1", fontSize: "0.9rem", marginBottom: "8px",
              }}
            >
              <option value="">Select a reason...</option>
              <option value="Exams">Exams</option>
              <option value="Vacation">Vacation</option>
              <option value="Medical">Medical</option>
              <option value="Travel">Travel</option>
              <option value="Personal">Personal</option>
              <option value="Other">Other</option>
            </select>
            {passReason === "Other" && (
              <input
                type="text"
                placeholder="Enter custom reason..."
                value={passCustomReason}
                onChange={(e) => setPassCustomReason(e.target.value)}
                style={{
                  width: "100%", padding: "10px", borderRadius: "8px",
                  border: "1px solid #cbd5e1", fontSize: "0.9rem", marginBottom: "8px",
                  boxSizing: "border-box",
                }}
              />
            )}
            <div style={{ display: "flex", gap: "10px", marginTop: "16px" }}>
              <button
                className="save-btn"
                disabled={passLoading}
                style={{
                  flex: 1, padding: "10px", fontSize: "0.95rem",
                  backgroundColor: "#7c3aed", opacity: passLoading ? 0.7 : 1,
                }}
                onClick={handleMarkPass}
              >
                {passLoading ? "Marking..." : "Confirm Pass"}
              </button>
              <button
                className="save-btn"
                style={{
                  flex: 1, padding: "10px", fontSize: "0.95rem",
                  backgroundColor: "#64748b",
                }}
                onClick={() => { setPassModal({ show: false, student: null }); setPassReason(""); setPassCustomReason(""); }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== PASS HISTORY MODAL ===== */}
      {passHistoryModal.show && (
        <div
          style={{
            position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
            background: "rgba(0,0,0,0.5)", display: "flex",
            alignItems: "center", justifyContent: "center", zIndex: 9999,
          }}
          onClick={() => setPassHistoryModal({ show: false, student: null, passes: [] })}
        >
          <div
            className="dark-modal-card"
            style={{
              background: "#fff", borderRadius: "16px", padding: "30px",
              width: "90%", maxWidth: "500px", maxHeight: "70vh", overflowY: "auto",
              boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: "0 0 6px 0", color: "#334155" }}>
              Pass History — {passHistoryModal.student?.childName}
            </h3>
            <p style={{ color: "#64748b", fontSize: "0.85rem", margin: "0 0 20px 0" }}>
              Total passes: {passHistoryModal.passes.length}
            </p>
            {passHistoryModal.passes.length === 0 ? (
              <p style={{ color: "#94a3b8", textAlign: "center", padding: "20px" }}>No passes recorded.</p>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid #e2e8f0" }}>
                    <th style={{ textAlign: "left", padding: "8px", color: "#64748b", fontSize: "0.8rem" }}>Month</th>
                    <th style={{ textAlign: "left", padding: "8px", color: "#64748b", fontSize: "0.8rem" }}>Reason</th>
                    <th style={{ textAlign: "left", padding: "8px", color: "#64748b", fontSize: "0.8rem" }}>Marked On</th>
                  </tr>
                </thead>
                <tbody>
                  {passHistoryModal.passes
                    .sort((a, b) => (b.month || "").localeCompare(a.month || ""))
                    .map((pass, idx) => (
                      <tr key={idx} style={{ borderBottom: "1px solid #f1f5f9" }}>
                        <td style={{ padding: "10px 8px", fontWeight: "600", color: "#334155" }}>
                          {new Date(pass.month + "-01").toLocaleString("default", { month: "long", year: "numeric" })}
                        </td>
                        <td style={{ padding: "10px 8px", color: "#7c3aed" }}>
                          {pass.reason || "—"}
                        </td>
                        <td style={{ padding: "10px 8px", color: "#64748b", fontSize: "0.85rem" }}>
                          {pass.markedAt ? new Date(pass.markedAt).toLocaleDateString() : "—"}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            )}
            <button
              className="save-btn"
              style={{
                width: "100%", marginTop: "20px", padding: "10px",
                fontSize: "0.95rem", backgroundColor: "#64748b",
              }}
              onClick={() => setPassHistoryModal({ show: false, student: null, passes: [] })}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
};

// --- TAB 6: GALLERY REPOSITORY (ADMIN VIEW ONLY) ---
const GalleryRepositoryTab = () => {
  const [students, setStudents] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState("all");
  const [artwork, setArtwork] = useState([]);
  const [loading, setLoading] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(null);

  // 🗓️ NEW: Date Filters
  const [filterYear, setFilterYear] = useState("all"); // Default to All Years
  const [filterMonth, setFilterMonth] = useState("all"); // Default to All Months

  // Lightbox zoom + pan
  const [zoomScale, setZoomScale] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const touchStartX = useRef(null);
  const touchEndX = useRef(null);
  const initialPinchDist = useRef(null);
  const initialScale = useRef(1);
  const lastTap = useRef(0);
  const panStart = useRef(null);
  const initialOffset = useRef({ x: 0, y: 0 });
  const wasPinch = useRef(false);

  useEffect(() => {
    // 1. Fetch all students
    axios
      .get("https://art-portal-7n6r.onrender.com/api/users")
      .then((res) => setStudents(res.data.filter((u) => u.role === "parent")))
      .catch((err) => console.error(err));
  }, []);

  // 2. Fetch gallery when student selected
  useEffect(() => {
    setLoading(true);
    let url = "";
    // NOTE: Use http://localhost:5000 if running locally
    const baseUrl = "https://art-portal-7n6r.onrender.com";

    if (selectedStudent === "all") {
      url = `${baseUrl}/api/gallery`;
    } else {
      url = `${baseUrl}/api/gallery/student/${selectedStudent}`;
    }

    axios
      .get(url)
      .then((res) => setArtwork(res.data))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, [selectedStudent]);

  // 3. 🗓️ Filter Logic (Client Side)
  const filteredArtwork = artwork.filter((art) => {
    if (!art.dateCreated) return false;
    const date = new Date(art.dateCreated);
    const artYear = date.getFullYear().toString();
    const artMonth = date.getMonth(); // 0 = Jan, 1 = Feb

    const yearMatch = filterYear === "all" || artYear === filterYear;
    const monthMatch =
      filterMonth === "all" || artMonth === parseInt(filterMonth);

    return yearMatch && monthMatch;
  });

  const handleDelete = async (e, artId) => {
    e.stopPropagation();
    if (window.confirm("Are you sure you want to delete this artwork?")) {
      try {
        await axios.delete(
          `https://art-portal-7n6r.onrender.com/api/gallery/${artId}`,
        );
        setArtwork(artwork.filter((art) => art._id !== artId));
        if (lightboxIndex !== null) setLightboxIndex(null);
      } catch (err) {
        alert("Error deleting artwork");
      }
    }
  };

  const handleDownload = async (e, imageUrl, title) => {
  e.stopPropagation();
  try {
    const response = await fetch(imageUrl);
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const extension = blob.type.split("/")[1] || "jpg";
    link.download = `${title || "artwork"}.${extension}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  } catch (err) {
    alert("Failed to download image. It may be blocked by CORS.");
  }
};

  // Share Handler
  const handleShare = async (e, imageUrl, title) => {
    e.stopPropagation();
    try {
      if (navigator.share) {
        await navigator.share({ title: title || "Artwork", text: `Check out this artwork: ${title}`, url: imageUrl });
      } else {
        await navigator.clipboard.writeText(imageUrl);
        alert("Image URL copied to clipboard!");
      }
    } catch (err) {
      if (err.name !== "AbortError") {
        try { await navigator.clipboard.writeText(imageUrl); alert("Image URL copied!"); } catch {}
      }
    }
  };

  // Lightbox Navigation
  const handleNext = (e) => {
    if (e) e.stopPropagation();
    setLightboxIndex((prev) => (prev + 1) % filteredArtwork.length);
  };
  const handlePrev = (e) => {
    if (e) e.stopPropagation();
    setLightboxIndex(
      (prev) => (prev - 1 + filteredArtwork.length) % filteredArtwork.length,
    );
  };

  // Reset zoom when image changes
  useEffect(() => {
    setZoomScale(1);
    setPanOffset({ x: 0, y: 0 });
  }, [lightboxIndex]);

  // Keyboard + scroll lock
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (lightboxIndex === null) return;
      if (e.key === "ArrowRight") handleNext();
      if (e.key === "ArrowLeft") handlePrev();
      if (e.key === "Escape") { setLightboxIndex(null); setZoomScale(1); setPanOffset({ x: 0, y: 0 }); }
      if (e.key === "+" || e.key === "=") setZoomScale(s => Math.min(s + 0.5, 5));
      if (e.key === "-") setZoomScale(s => Math.max(s - 0.5, 1));
    };
    window.addEventListener("keydown", handleKeyDown);
    if (lightboxIndex !== null) { document.body.style.overflow = "hidden"; }
    else { document.body.style.overflow = ""; }
    return () => { window.removeEventListener("keydown", handleKeyDown); document.body.style.overflow = ""; };
  }, [lightboxIndex, filteredArtwork]);

  // Touch helpers for pinch-to-zoom + swipe
  const getTouchDistance = (touches) => {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };
  const onTouchStart = (e) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      wasPinch.current = true;
      initialPinchDist.current = getTouchDistance(e.touches);
      initialScale.current = zoomScale;
    } else if (e.touches.length === 1) {
      touchEndX.current = null;
      touchStartX.current = e.touches[0].clientX;
      const now = Date.now();
      if (now - lastTap.current < 300) {
        if (zoomScale > 1) { setZoomScale(1); setPanOffset({ x: 0, y: 0 }); }
        else setZoomScale(2.5);
        lastTap.current = 0; return;
      }
      lastTap.current = now;
      if (zoomScale > 1) { panStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; initialOffset.current = { ...panOffset }; }
    }
  };
  const onTouchMove = (e) => {
    if (e.touches.length === 2 && initialPinchDist.current) {
      e.preventDefault();
      const newScale = Math.min(Math.max(initialScale.current * (getTouchDistance(e.touches) / initialPinchDist.current), 1), 5);
      setZoomScale(newScale);
      if (newScale <= 1) setPanOffset({ x: 0, y: 0 });
    } else if (e.touches.length === 1) {
      touchEndX.current = e.touches[0].clientX;
      if (zoomScale > 1 && panStart.current) {
        e.preventDefault();
        setPanOffset({ x: initialOffset.current.x + (e.touches[0].clientX - panStart.current.x), y: initialOffset.current.y + (e.touches[0].clientY - panStart.current.y) });
      }
    }
  };
  const onTouchEnd = () => {
    initialPinchDist.current = null; panStart.current = null;
    if (wasPinch.current) { wasPinch.current = false; return; }
    if (zoomScale <= 1 && touchStartX.current && touchEndX.current) {
      const d = touchStartX.current - touchEndX.current;
      if (d > 50) handleNext();
      if (d < -50) handlePrev();
    }
  };

  // Constants
  const years = [2024, 2025, 2026, 2027];
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

  const closeLightbox = () => { setLightboxIndex(null); setZoomScale(1); setPanOffset({ x: 0, y: 0 }); };

  return (
    <div className="form-wrapper gallery-wrapper">
      {/* MODERN FILTER BAR */}
      <div className="gallery-filter-bar">
        <h3 className="gallery-filter-title">
          🖼️ Gallery Manager
          <span className="gallery-count-badge">{filteredArtwork.length}</span>
        </h3>
        <div className="gallery-filter-controls">
          <select className="gallery-filter-select" value={selectedStudent} onChange={(e) => setSelectedStudent(e.target.value)} style={{ minWidth: "160px" }}>
            <option value="all">🌍 All Students</option>
            <option disabled>──────────</option>
            {students.map((s) => (<option key={s._id} value={s._id}>{s.childName}</option>))}
          </select>
          <select className="gallery-filter-select" value={filterYear} onChange={(e) => setFilterYear(e.target.value)}>
            <option value="all">All Years</option>
            {years.map((y) => (<option key={y} value={y}>{y}</option>))}
          </select>
          <select className="gallery-filter-select" value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)}>
            <option value="all">All Months</option>
            {months.map((m, i) => (<option key={i} value={i}>{m}</option>))}
          </select>
        </div>
      </div>

      {/* GALLERY GRID */}
      <div className="gallery-grid">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="gallery-skeleton-card">
              <div className="gallery-skeleton-img" />
              <div className="gallery-skeleton-info">
                <div className="gallery-skeleton-line" />
                <div className="gallery-skeleton-line short" />
                <div className="gallery-skeleton-line xs" />
              </div>
            </div>
          ))
        ) : filteredArtwork.length === 0 ? (
          <div className="gallery-empty-state">
            <div className="gallery-empty-icon">🎨</div>
            <p className="gallery-empty-title">No artwork found</p>
            <p className="gallery-empty-sub">Try adjusting the filters above</p>
          </div>
        ) : (
          filteredArtwork.map((art, index) => (
            <div key={art._id} className="gal-card" onClick={() => setLightboxIndex(index)}>
              <img src={art.imageUrl} alt={art.title} className="gal-card-img" />
              <div className="gal-card-overlay">
                {selectedStudent === "all" && (
                  <div className="gal-card-overlay-student">{art.studentId?.childName || "Unknown"}</div>
                )}
                <div className="gal-card-overlay-title">{art.title || "Untitled"}</div>
                <div className="gal-card-overlay-sub">{art.medium} • {new Date(art.dateCreated).toLocaleDateString()}</div>
              </div>
              <div className="gal-card-actions">
                <button className="gal-action-btn download" onClick={(e) => handleDownload(e, art.imageUrl, art.title)} title="Download">⬇</button>
                <button className="gal-action-btn share" onClick={(e) => handleShare(e, art.imageUrl, art.title)} title="Share">📤</button>
                <button className="gal-action-btn delete" onClick={(e) => handleDelete(e, art._id)} title="Delete">🗑</button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* LIGHTBOX OVERLAY */}
      {lightboxIndex !== null && filteredArtwork[lightboxIndex] && (
        <div
          className="lightbox-overlay"
          onClick={closeLightbox}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          style={{ touchAction: "none" }}
        >
          <button className="lightbox-close" onClick={closeLightbox}>×</button>
          <button className="lightbox-nav-btn prev" onClick={handlePrev}>‹</button>
          <div
            className="lightbox-content"
            onClick={(e) => e.stopPropagation()}
            style={{
              transform: `scale(${zoomScale}) translate(${panOffset.x / zoomScale}px, ${panOffset.y / zoomScale}px)`,
              transition: zoomScale === 1 ? "transform 0.3s ease" : "none",
            }}
          >
            <img
              src={filteredArtwork[lightboxIndex].imageUrl}
              alt={filteredArtwork[lightboxIndex].title}
              className="lightbox-img"
              draggable="false"
            />
          </div>
          <button className="lightbox-nav-btn next" onClick={handleNext}>›</button>

          {/* Action bar */}
          <div className="lightbox-action-bar">
            <div className="lightbox-zoom-pill">
              <button onClick={(e) => { e.stopPropagation(); setZoomScale(s => Math.max(s - 0.5, 1)); }}>−</button>
              <span className="lightbox-zoom-val">{Math.round(zoomScale * 100)}%</span>
              <button onClick={(e) => { e.stopPropagation(); setZoomScale(s => Math.min(s + 0.5, 5)); }}>+</button>
            </div>
            <button className="lightbox-action-pill" onClick={(e) => handleDownload(e, filteredArtwork[lightboxIndex].imageUrl, filteredArtwork[lightboxIndex].title)}>
              ⬇ Download
            </button>
            <button className="lightbox-action-pill share" onClick={(e) => handleShare(e, filteredArtwork[lightboxIndex].imageUrl, filteredArtwork[lightboxIndex].title)}>
              📤 Share
            </button>
            <button className="lightbox-action-pill danger" onClick={(e) => handleDelete(e, filteredArtwork[lightboxIndex]._id)}>
              🗑 Delete
            </button>
          </div>

          <div className="lightbox-caption">
            {selectedStudent === "all" && (
              <h2 style={{ margin: "0 0 5px 0", fontSize: "1.2rem" }}>
                {filteredArtwork[lightboxIndex].studentId?.childName}
              </h2>
            )}
            <strong>{filteredArtwork[lightboxIndex].title || "Untitled"}</strong>
            <span>
              {filteredArtwork[lightboxIndex].medium} •{" "}
              {new Date(filteredArtwork[lightboxIndex].dateCreated).toLocaleDateString()}
            </span>
          </div>
          <div className="lightbox-counter">{lightboxIndex + 1} / {filteredArtwork.length}</div>
        </div>
      )}
    </div>
  );
};
// ==========================================
// 3b. EXPENSE TABS
// ==========================================

const EXPENSE_TYPES = [
  { value: "academy_expense", label: "Academy Expense",     emoji: "🏫", color: "#2563eb", bg: "#eff6ff" },
  { value: "teacher_salary",  label: "Teacher Salary",      emoji: "👨‍🏫", color: "#9333ea", bg: "#f3e8ff" },
  { value: "maintenance",     label: "Maintenance",          emoji: "🔧", color: "#f59e0b", bg: "#fef3c7" },
  { value: "supplies",        label: "Supplies & Materials", emoji: "🎨", color: "#10b981", bg: "#dcfce7" },
  { value: "utilities",       label: "Utilities",            emoji: "💡", color: "#06b6d4", bg: "#ecfeff" },
  { value: "other",           label: "Other",                emoji: "📦", color: "#64748b", bg: "#f1f5f9" },
];

const getExpenseTypeInfo = (type) =>
  EXPENSE_TYPES.find((t) => t.value === type) || EXPENSE_TYPES[EXPENSE_TYPES.length - 1];

// --- ADD EXPENSE TAB ---
const AddExpenseTab = ({ onSuccess }) => {
  const today = new Date().toISOString().split("T")[0];
  const [formData, setFormData] = useState({
    title: "",
    type: "academy_expense",
    amount: "",
    description: "",
    date: today,
  });
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState({ show: false, message: "", type: "" });

  const showToast = (message, type = "success") => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: "", type: "" }), 3000);
  };

  const handleChange = (e) =>
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await axios.post("https://art-portal-7n6r.onrender.com/api/expenses", {
        ...formData,
        amount: Number(formData.amount),
      });
      showToast("Expense added successfully!", "success");
      setFormData({ title: "", type: "academy_expense", amount: "", description: "", date: today });
      if (onSuccess) onSuccess();
    } catch (err) {
      showToast("Failed to save expense.", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="form-wrapper">
      <h3 style={{ marginTop: 0 }}>Add New Expense</h3>

      <form onSubmit={handleSubmit}>
        <div className="form-group" style={{ marginBottom: "15px" }}>
          <label>Title *</label>
          <input
            name="title"
            required
            placeholder="e.g. Art Supplies for June"
            value={formData.title}
            onChange={handleChange}
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Type *</label>
            <select name="type" required value={formData.type} onChange={handleChange} style={{ fontWeight: "600" }}>
              {EXPENSE_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.emoji} {t.label}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Amount (₹) *</label>
            <input
              type="number"
              name="amount"
              required
              min="0"
              placeholder="0"
              value={formData.amount}
              onChange={handleChange}
              style={{ fontWeight: "700", color: "#dc2626" }}
            />
          </div>
        </div>

        <div className="form-group" style={{ marginBottom: "15px" }}>
          <label>Date</label>
          <input type="date" name="date" value={formData.date} onChange={handleChange} />
        </div>

        <div className="form-group" style={{ marginBottom: "20px" }}>
          <label>Description (optional)</label>
          <textarea
            name="description"
            placeholder="Additional notes..."
            value={formData.description}
            onChange={handleChange}
            rows={3}
            style={{
              padding: "10px",
              border: "1px solid #cbd5e1",
              borderRadius: "6px",
              fontSize: "1rem",
              resize: "vertical",
              fontFamily: "inherit",
              width: "100%",
              boxSizing: "border-box",
            }}
          />
        </div>

        {/* Type preview badge */}
        {formData.type && (
          <div style={{ marginBottom: "20px" }}>
            {(() => {
              const info = getExpenseTypeInfo(formData.type);
              return (
                <span
                  style={{
                    background: info.bg,
                    color: info.color,
                    padding: "5px 14px",
                    borderRadius: "20px",
                    fontSize: "0.85rem",
                    fontWeight: "600",
                  }}
                >
                  {info.emoji} {info.label}
                  {formData.amount ? ` — ₹${Number(formData.amount).toLocaleString()}` : ""}
                </span>
              );
            })()}
          </div>
        )}

        <button type="submit" className="save-btn" disabled={saving} style={{ marginTop: "5px" }}>
          {saving ? "Saving..." : "➕ Add Expense"}
        </button>
      </form>

      {toast.show && (
        <div
          className={`toast-notification ${toast.type} show`}
          style={{ position: "fixed", top: "20px", right: "20px", zIndex: 2000 }}
        >
          {toast.type === "success" ? "✅" : "❌"} {toast.message}
        </div>
      )}
    </div>
  );
};

// --- EXPENSE HISTORY TAB ---
const ExpenseHistoryTab = ({ onRefresh }) => {
  const currentMonth = new Date().toISOString().slice(0, 7);
  const [expenses, setExpenses] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState("all");
  const [filterMonth, setFilterMonth] = useState(currentMonth);
  const [searchTerm, setSearchTerm] = useState("");
  const [editingExpense, setEditingExpense] = useState(null); // null = modal closed
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);

  const fetchExpenses = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axios.get("https://art-portal-7n6r.onrender.com/api/expenses");
      setExpenses(res.data);
    } catch (err) {
      console.error("Failed to load expenses", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchStudents = useCallback(async () => {
    try {
      const res = await axios.get("https://art-portal-7n6r.onrender.com/api/users");
      setStudents(res.data.filter((u) => u.role === "parent"));
    } catch (err) {
      console.error("Failed to load students", err);
    }
  }, []);

  useEffect(() => {
    fetchExpenses();
    fetchStudents();
  }, [fetchExpenses, fetchStudents]);

  const openEdit = (expense) => {
    setEditingExpense(expense);
    setEditForm({
      title: expense.title || "",
      type: expense.type || "academy_expense",
      amount: expense.amount ?? "",
      description: expense.description || "",
      date: expense.date ? expense.date.slice(0, 10) : new Date().toISOString().slice(0, 10),
    });
  };

  const handleEditSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await axios.put(
        `https://art-portal-7n6r.onrender.com/api/expenses/${editingExpense._id}`,
        { ...editForm, amount: Number(editForm.amount) },
      );
      setExpenses((prev) => prev.map((x) => (x._id === editingExpense._id ? res.data : x)));
      setEditingExpense(null);
      if (onRefresh) onRefresh();
    } catch (err) {
      alert("Failed to save changes");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this expense record?")) return;
    try {
      await axios.delete(`https://art-portal-7n6r.onrender.com/api/expenses/${id}`);
      setExpenses((prev) => prev.filter((e) => e._id !== id));
      if (onRefresh) onRefresh();
    } catch (err) {
      alert("Failed to delete expense");
    }
  };

  const filtered = expenses.filter((e) => {
    const typeMatch = filterType === "all" || e.type === filterType;
    const dateStr = e.date ? e.date.slice(0, 7) : "";
    const monthMatch = !filterMonth || dateStr === filterMonth;
    const searchMatch =
      !searchTerm || (e.title || "").toLowerCase().includes(searchTerm.toLowerCase());
    return typeMatch && monthMatch && searchMatch;
  });

  const totalAmount = filtered.reduce((acc, e) => acc + (e.amount || 0), 0);

  // Collected fees for the selected month (defaults to current month when no month filter is set)
  const savingsMonth = filterMonth || currentMonth;
  const collectedForMonth = students.reduce((acc, s) => {
    const payment = (s.payments || []).find(
      (p) => p.month === savingsMonth && p.status === "Paid",
    );
    return acc + (payment ? payment.amount || s.monthlyFee || 0 : 0);
  }, 0);
  const savings = collectedForMonth - totalAmount;

  const typeSummary = EXPENSE_TYPES.map((t) => ({
    ...t,
    total: filtered.filter((e) => e.type === t.value).reduce((acc, e) => acc + (e.amount || 0), 0),
  })).filter((t) => t.total > 0);

  return (
    <div>
      {/* ── Edit Modal ── */}
      {editingExpense && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: "500px" }}>
            <div className="modal-header">
              <h3>Edit Expense</h3>
              <button className="close-modal" onClick={() => setEditingExpense(null)}>×</button>
            </div>
            <form onSubmit={handleEditSave} style={{ padding: "20px" }}>
              <div className="form-group" style={{ marginBottom: "14px" }}>
                <label>Title *</label>
                <input
                  required
                  value={editForm.title}
                  onChange={(e) => setEditForm((p) => ({ ...p, title: e.target.value }))}
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Type *</label>
                  <select
                    required
                    value={editForm.type}
                    onChange={(e) => setEditForm((p) => ({ ...p, type: e.target.value }))}
                    style={{ fontWeight: "600" }}
                  >
                    {EXPENSE_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.emoji} {t.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Amount (₹) *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={editForm.amount}
                    onChange={(e) => setEditForm((p) => ({ ...p, amount: e.target.value }))}
                    style={{ fontWeight: "700", color: "#dc2626" }}
                  />
                </div>
              </div>
              <div className="form-group" style={{ marginBottom: "14px" }}>
                <label>Date</label>
                <input
                  type="date"
                  value={editForm.date}
                  onChange={(e) => setEditForm((p) => ({ ...p, date: e.target.value }))}
                />
              </div>
              <div className="form-group" style={{ marginBottom: "20px" }}>
                <label>Description (optional)</label>
                <textarea
                  value={editForm.description}
                  onChange={(e) => setEditForm((p) => ({ ...p, description: e.target.value }))}
                  rows={3}
                  style={{
                    padding: "10px",
                    border: "1px solid #cbd5e1",
                    borderRadius: "6px",
                    fontSize: "1rem",
                    resize: "vertical",
                    fontFamily: "inherit",
                    width: "100%",
                    boxSizing: "border-box",
                  }}
                />
              </div>
              <div className="modal-actions" style={{ justifyContent: "flex-end", padding: 0, border: "none", marginTop: 0 }}>
                <button type="button" className="cancel-btn" onClick={() => setEditingExpense(null)}>
                  Cancel
                </button>
                <button type="submit" className="save-btn" style={{ width: "auto", padding: "10px 24px" }} disabled={saving}>
                  {saving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Summary Cards ── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))",
          gap: "14px",
          marginBottom: "24px",
        }}
      >
        <div
          style={{
            background: "#fff",
            padding: "16px 20px",
            borderRadius: "14px",
            border: "1px solid #e2e8f0",
            boxShadow: "0 2px 6px rgba(0,0,0,0.04)",
          }}
          className="expense-summary-card"
        >
          <div style={{ fontSize: "0.72rem", fontWeight: "700", color: "#64748b", marginBottom: "6px", letterSpacing: "0.05em" }}>
            TOTAL EXPENSES
          </div>
          <div style={{ fontSize: "1.6rem", fontWeight: "800", color: "#dc2626", lineHeight: 1 }}>
            ₹{totalAmount.toLocaleString()}
          </div>
          <div style={{ fontSize: "0.78rem", color: "#94a3b8", marginTop: "4px" }}>
            {filtered.length} record{filtered.length !== 1 ? "s" : ""}
          </div>
        </div>

        <div
          style={{
            background: savings >= 0 ? "#f0fdf4" : "#fef2f2",
            padding: "16px 20px",
            borderRadius: "14px",
            border: `1px solid ${savings >= 0 ? "#16a34a30" : "#dc262630"}`,
          }}
          className="expense-summary-card"
        >
          <div style={{ fontSize: "0.72rem", fontWeight: "700", color: "#64748b", marginBottom: "6px", letterSpacing: "0.05em" }}>
            SAVINGS ({savingsMonth === currentMonth ? "This Month" : savingsMonth})
          </div>
          <div style={{ fontSize: "1.6rem", fontWeight: "800", color: savings >= 0 ? "#16a34a" : "#dc2626", lineHeight: 1 }}>
            ₹{savings.toLocaleString()}
          </div>
          <div style={{ fontSize: "0.78rem", color: "#94a3b8", marginTop: "4px" }}>
            Collected ₹{collectedForMonth.toLocaleString()} − Expenses ₹{totalAmount.toLocaleString()}
          </div>
        </div>

        {typeSummary.map((t) => (
          <div
            key={t.value}
            style={{
              background: t.bg,
              padding: "16px 20px",
              borderRadius: "14px",
              border: `1px solid ${t.color}30`,
            }}
            className="expense-summary-card"
          >
            <div style={{ fontSize: "0.72rem", fontWeight: "700", color: t.color, marginBottom: "6px", letterSpacing: "0.05em", textTransform: "uppercase" }}>
              {t.emoji} {t.label}
            </div>
            <div style={{ fontSize: "1.4rem", fontWeight: "800", color: t.color, lineHeight: 1 }}>
              ₹{t.total.toLocaleString()}
            </div>
          </div>
        ))}
      </div>

      {/* ── Table ── */}
      <div className="table-wrapper">
        <div className="filter-bar" style={{ flexWrap: "wrap", gap: "12px" }}>
          <div className="search-box">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input
              placeholder="Search by title..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="filter-dropdown">
            <select value={filterType} onChange={(e) => setFilterType(e.target.value)}>
              <option value="all">All Types</option>
              {EXPENSE_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.emoji} {t.label}
                </option>
              ))}
            </select>
          </div>
          <input
            type="month"
            value={filterMonth}
            onChange={(e) => setFilterMonth(e.target.value)}
            style={{
              padding: "6px 10px",
              border: "1px solid #e2e8f0",
              borderRadius: "6px",
              fontSize: "0.9rem",
              background: "white",
              color: "#334155",
            }}
          />
          {filterMonth && (
            <button
              onClick={() => setFilterMonth("")}
              style={{
                background: "none",
                border: "none",
                color: "#64748b",
                cursor: "pointer",
                fontSize: "0.85rem",
                textDecoration: "underline",
              }}
            >
              Clear
            </button>
          )}
        </div>

        <div className="table-container">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Type</th>
                <th>Amount</th>
                <th>Date</th>
                <th>Description</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: "center", padding: "40px", color: "#94a3b8" }}>
                    Loading expenses...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: "center", padding: "40px", color: "#94a3b8" }}>
                    No expenses found.
                  </td>
                </tr>
              ) : (
                filtered.map((expense) => {
                  const info = getExpenseTypeInfo(expense.type);
                  return (
                    <tr key={expense._id}>
                      <td style={{ fontWeight: "600", color: "#334155" }}>{expense.title}</td>
                      <td>
                        <span
                          style={{
                            background: info.bg,
                            color: info.color,
                            padding: "3px 10px",
                            borderRadius: "10px",
                            fontSize: "0.78rem",
                            fontWeight: "700",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {info.emoji} {info.label}
                        </span>
                      </td>
                      <td style={{ fontWeight: "700", color: "#dc2626" }}>
                        ₹{(expense.amount || 0).toLocaleString()}
                      </td>
                      <td style={{ color: "#64748b" }}>
                        {expense.date ? new Date(expense.date).toLocaleDateString("en-GB") : "—"}
                      </td>
                      <td style={{ color: "#64748b", fontSize: "0.88rem", maxWidth: "220px" }}>
                        {expense.description || "—"}
                      </td>
                      <td className="action-cell">
                        <button
                          className="edit-btn"
                          onClick={() => openEdit(expense)}
                          title="Edit expense"
                        >
                          ✏️
                        </button>
                        <button
                          className="delete-btn"
                          onClick={() => handleDelete(expense._id)}
                          title="Delete expense"
                        >
                          🗑
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// ==========================================
// 4. MAIN COMPONENT (Defined LAST to fix dependency errors)
// ==========================================
const AdminDashboard = ({ onLogout }) => {
  const [activeTab, setActiveTab] = useState("overview");
  const [feeMenuOpen, setFeeMenuOpen] = useState(false);
  const [expenseMenuOpen, setExpenseMenuOpen] = useState(false);
  const [stats, setStats] = useState({ students: 0, teachers: 0, revenue: 0 });
  const [overviewUsers, setOverviewUsers] = useState([]);
  const [overviewClasses, setOverviewClasses] = useState([]);
  const [overviewExpenses, setOverviewExpenses] = useState([]);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [showMobileLogout, setShowMobileLogout] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(
    () => localStorage.getItem("admin_theme") === "dark",
  );
  const [feeInitialFilter, setFeeInitialFilter] = useState("all");
  const [userInitialRoleFilter, setUserInitialRoleFilter] = useState("all");
  const [userInitialModeFilter, setUserInitialModeFilter] = useState("all");
  const [userInitialGenderFilter, setUserInitialGenderFilter] = useState("all");
  const [userInitialViewMode, setUserInitialViewMode] = useState("active");

  // ICONS
  const IconHome = () => (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
    </svg>
  );
  const IconAdd = () => (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
      <line x1="12" y1="8" x2="12" y2="16"></line>
      <line x1="8" y1="12" x2="16" y2="12"></line>
    </svg>
  );
  const IconUsers = () => (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
      <circle cx="9" cy="7" r="4"></circle>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
    </svg>
  );
  const IconClasses = () => (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
    </svg>
  );
  const IconMenu = () => (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <line x1="3" y1="6" x2="21" y2="6"></line>
      <line x1="3" y1="12" x2="21" y2="12"></line>
      <line x1="3" y1="18" x2="21" y2="18"></line>
    </svg>
  );
  const IconClose = () => (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <line x1="18" y1="6" x2="6" y2="18"></line>
      <line x1="6" y1="6" x2="18" y2="18"></line>
    </svg>
  );
  const IconLogout = () => (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
      <polyline points="16 17 21 12 16 7"></polyline>
      <line x1="21" y1="12" x2="9" y2="12"></line>
    </svg>
  );
  const IconFee = () => (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <line x1="12" y1="1" x2="12" y2="23"></line>
      <path d="M17 5H9.5a4.5 4.5 0 0 0 0 9H14.5a4.5 4.5 0 0 1 0 9H5"></path>
    </svg>
  );
  const IconClock = () => (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <circle cx="12" cy="12" r="10"></circle>
      <polyline points="12 6 12 12 16 14"></polyline>
    </svg>
  );
  const IconGallery = () => (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
      <circle cx="8.5" cy="8.5" r="1.5"></circle>
      <polyline points="21 15 16 10 5 21"></polyline>
    </svg>
  );
  const IconOfflineFee = () => (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
      <polyline points="9 22 9 12 15 12 15 22"></polyline>
    </svg>
  );
  const IconExpense = () => (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <rect x="2" y="5" width="20" height="14" rx="2"></rect>
      <line x1="2" y1="10" x2="22" y2="10"></line>
      <line x1="7" y1="15" x2="7" y2="15" strokeLinecap="round" strokeWidth="3"></line>
      <line x1="12" y1="15" x2="17" y2="15" strokeLinecap="round"></line>
    </svg>
  );

  const fetchStats = () => {
    axios
      .get("https://art-portal-7n6r.onrender.com/api/dashboard/stats")
      .then((res) => setStats(res.data))
      .catch((err) => console.error(err));
  };

  const fetchOverviewData = async () => {
    try {
      const [usersRes, classesRes, expensesRes] = await Promise.all([
        axios.get("https://art-portal-7n6r.onrender.com/api/users"),
        axios.get("https://art-portal-7n6r.onrender.com/api/classes"),
        axios.get("https://art-portal-7n6r.onrender.com/api/expenses"),
      ]);
      setOverviewUsers(usersRes.data);
      setOverviewClasses(classesRes.data);
      setOverviewExpenses(expensesRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setOverviewLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    fetchOverviewData();
  }, []);

  // Keeps the Overview tab's stats/expenses in sync the moment fees or
  // expenses change elsewhere in the app, instead of only on first load.
  const refreshOverview = () => {
    fetchStats();
    fetchOverviewData();
  };

  // Manual "refresh application" action for the header button — re-pulls
  // Overview data and forces the currently open tab to remount so it
  // re-fetches its own data too, without a full page reload.
  const [appRefreshing, setAppRefreshing] = useState(false);
  const [tabRefreshKey, setTabRefreshKey] = useState(0);
  const handleAppRefresh = async () => {
    if (appRefreshing) return;
    setAppRefreshing(true);
    try {
      await Promise.all([fetchOverviewData(), fetchStats()]);
    } finally {
      setTabRefreshKey((k) => k + 1);
      setAppRefreshing(false);
    }
  };

  const handleNavClick = (tab) => {
    setFeeInitialFilter("all");
    setUserInitialRoleFilter("all");
    setUserInitialModeFilter("all");
    setUserInitialGenderFilter("all");
    setUserInitialViewMode("active");
    if (tab === "fees" || tab === "offline-fees" || tab === "online-fees") setFeeMenuOpen(true);
    if (tab === "expense-add" || tab === "expense-history") setExpenseMenuOpen(true);
    setActiveTab(tab);
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleNavigate = (tab, params = {}) => {
    if (params.filter) setFeeInitialFilter(params.filter);
    else setFeeInitialFilter("all");
    if (params.roleFilter) setUserInitialRoleFilter(params.roleFilter);
    else setUserInitialRoleFilter("all");
    if (params.modeFilter) setUserInitialModeFilter(params.modeFilter);
    else setUserInitialModeFilter("all");
    if (params.genderFilter) setUserInitialGenderFilter(params.genderFilter);
    else setUserInitialGenderFilter("all");
    if (params.viewMode) setUserInitialViewMode(params.viewMode);
    else setUserInitialViewMode("active");
    setActiveTab(tab);
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="admin-container" data-theme={darkMode ? "dark" : "light"}>
      {mobileMenuOpen && (
        <div
          className="mobile-menu-backdrop"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}
      <aside className={`admin-sidebar${mobileMenuOpen ? " mobile-open" : ""}`}>
        <div className="sidebar-brand">
          <img src={logoImg} alt="Logo" className="sidebar-logo-img" />
          <img src={titleImg} alt="Venky Art" className="sidebar-title-img" />
          <button
            className="mobile-only sidebar-close-btn"
            onClick={() => setMobileMenuOpen(false)}
            title="Close menu"
          >
            <IconClose />
          </button>
        </div>
        <nav className="sidebar-nav">
          <button
            className={activeTab === "overview" ? "active" : ""}
            onClick={() => handleNavClick("overview")}
          >
            <IconHome /> <span>Dashboard</span>
          </button>
          <button
            className={activeTab === "users" ? "active" : ""}
            onClick={() => handleNavClick("users")}
          >
            <IconUsers /> <span>User Management</span>
          </button>
          <button
            className={activeTab === "classes" ? "active" : ""}
            onClick={() => handleNavClick("classes")}
          >
            <IconClasses /> <span>Class Management</span>
          </button>
          <button
            className={(activeTab === "fees" || activeTab === "offline-fees" || activeTab === "online-fees") ? "active" : ""}
            onClick={() => {
              if (activeTab !== "fees" && activeTab !== "offline-fees" && activeTab !== "online-fees") {
                handleNavClick("fees");
              } else {
                setFeeMenuOpen((o) => !o);
              }
            }}
            style={{ justifyContent: "space-between" }}
          >
            <span style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <IconFee /> <span>Fee Tracker</span>
            </span>
            <span style={{
              fontSize: "0.7rem",
              transition: "transform 0.2s",
              transform: feeMenuOpen ? "rotate(180deg)" : "rotate(0deg)",
              opacity: 0.7,
            }}>▼</span>
          </button>
          {feeMenuOpen && (
            <div className="sidebar-sub-nav">
              <button
                className={activeTab === "fees" ? "active" : ""}
                onClick={() => handleNavClick("fees")}
              >
                <IconFee /> <span>All Students</span>
              </button>
              <button
                className={activeTab === "online-fees" ? "active" : ""}
                onClick={() => handleNavClick("online-fees")}
              >
                <IconFee /> <span>Online Students</span>
              </button>
              <button
                className={activeTab === "offline-fees" ? "active" : ""}
                onClick={() => handleNavClick("offline-fees")}
              >
                <IconOfflineFee /> <span>Offline Students</span>
              </button>
            </div>
          )}
          <button
            className={activeTab === "add-user" ? "active" : ""}
            onClick={() => handleNavClick("add-user")}
          >
            <IconAdd /> <span>Register User</span>
          </button>
          <button
            className={activeTab === "slots" ? "active" : ""}
            onClick={() => handleNavClick("slots")}
          >
            <IconClock /> <span>Slot Manager</span>
          </button>
          <button
            className={activeTab === "gallery" ? "active" : ""}
            onClick={() => handleNavClick("gallery")}
          >
            <IconGallery /> <span>Gallery</span>
          </button>
          <button
            className={(activeTab === "expense-add" || activeTab === "expense-history") ? "active" : ""}
            onClick={() => {
              if (activeTab !== "expense-add" && activeTab !== "expense-history") {
                handleNavClick("expense-add");
              } else {
                setExpenseMenuOpen((o) => !o);
              }
            }}
            style={{ justifyContent: "space-between" }}
          >
            <span style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <IconExpense /> <span>Expenses</span>
            </span>
            <span style={{
              fontSize: "0.7rem",
              transition: "transform 0.2s",
              transform: expenseMenuOpen ? "rotate(180deg)" : "rotate(0deg)",
              opacity: 0.7,
            }}>▼</span>
          </button>
          {expenseMenuOpen && (
            <div className="sidebar-sub-nav">
              <button
                className={activeTab === "expense-add" ? "active" : ""}
                onClick={() => handleNavClick("expense-add")}
              >
                <IconAdd /> <span>Add Expense</span>
              </button>
              <button
                className={activeTab === "expense-history" ? "active" : ""}
                onClick={() => handleNavClick("expense-history")}
              >
                <IconClock /> <span>Expense History</span>
              </button>
            </div>
          )}
        </nav>
        <div className="sidebar-footer">
          <p>Admin Portal v1.0</p>
        </div>
      </aside>

      <main className="admin-main">
        <header className="top-header">
          <div className="header-left">
            <button
              className="mobile-only hamburger-btn"
              onClick={() => setMobileMenuOpen(true)}
              title="Open menu"
            >
              <IconMenu />
            </button>
            <div className="header-title">
            <h2>
              {activeTab === "overview"
                ? "Overview"
                : activeTab === "users"
                  ? "All Users"
                  : activeTab === "classes"
                    ? "Class Management"
                    : activeTab === "fees"
                      ? "Fee Tracker"
                      : activeTab === "offline-fees"
                        ? "Offline Fee Tracker"
                        : activeTab === "online-fees"
                          ? "Online Fee Tracker"
                          : activeTab === "slots"
                          ? "Slot Manager"
                          : activeTab === "gallery"
                            ? "Art Gallery"
                            : activeTab === "expense-add"
                              ? "Add Expense"
                              : activeTab === "expense-history"
                                ? "Expense History"
                                : "Register User"}
            </h2>
            <p>Welcome back, Admin</p>
            </div>
          </div>
          <div className="header-actions">
            <button
              className="admin-refresh-btn"
              onClick={handleAppRefresh}
              title="Refresh application"
              disabled={appRefreshing}
            >
              <span className={appRefreshing ? "spin" : ""}>🔄</span>
            </button>
            <BirthdayNotificationBell
              students={overviewUsers.filter((u) => u.role === "parent")}
              storageKey="admin_bday_notif_read"
            />
            <label
              className="theme-toggle-label"
              title={darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
            >
              <span>{darkMode ? "☀️" : "🌙"}</span>
              <button
                className="theme-toggle-btn"
                onClick={() => {
                  const next = !darkMode;
                  setDarkMode(next);
                  localStorage.setItem("admin_theme", next ? "dark" : "light");
                }}
              />
            </label>
            <div
              className="user-profile-pill"
              onClick={() => setShowMobileLogout(!showMobileLogout)}
            >
              <span>Super Admin</span>
            </div>
            <button
              onClick={onLogout}
              className="header-logout-btn desktop-only"
              title="Logout"
            >
              <IconLogout />
            </button>
            {showMobileLogout && (
              <div className="mobile-logout-dropdown">
                <button onClick={onLogout}>🚪 Logout</button>
              </div>
            )}
          </div>
        </header>

        <div className="content-scrollable">
          {activeTab === "overview" && <OverviewTab stats={stats} users={overviewUsers} classes={overviewClasses} expenses={overviewExpenses} loading={overviewLoading} onNavigate={handleNavigate} />}
          {activeTab === "users" && <UserManagementTab key={tabRefreshKey} initialRoleFilter={userInitialRoleFilter} initialModeFilter={userInitialModeFilter} initialGenderFilter={userInitialGenderFilter} initialViewMode={userInitialViewMode} />}
          {activeTab === "classes" && <ClassManagementTab key={tabRefreshKey} />}
          {activeTab === "add-user" && <AddUserTab onRefresh={refreshOverview} />}
          {activeTab === "fees" && <FeeTrackerTab key={tabRefreshKey} initialFilter={feeInitialFilter} onRefresh={refreshOverview} />}
          {activeTab === "online-fees" && <FeeTrackerTab key={tabRefreshKey} initialFilter="all" onlineOnly={true} onRefresh={refreshOverview} />}
          {activeTab === "offline-fees" && <FeeTrackerTab key={tabRefreshKey} initialFilter="all" offlineOnly={true} onRefresh={refreshOverview} />}
          {activeTab === "slots" && <SlotManagementTab key={tabRefreshKey} />}
          {/* ✨ ADDED GALLERY TAB */}
          {activeTab === "gallery" && <GalleryRepositoryTab key={tabRefreshKey} />}
          {activeTab === "expense-add" && <AddExpenseTab onSuccess={refreshOverview} />}
          {activeTab === "expense-history" && <ExpenseHistoryTab key={tabRefreshKey} onRefresh={refreshOverview} />}
        </div>
      </main>

      <nav className="mobile-bottom-nav">
        <button
          className={activeTab === "overview" ? "nav-item active" : "nav-item"}
          onClick={() => handleNavClick("overview")}
        >
          <IconHome />
        </button>
        <button
          className={activeTab === "users" ? "nav-item active" : "nav-item"}
          onClick={() => handleNavClick("users")}
        >
          <IconUsers />
        </button>
        <button
          className={activeTab === "classes" ? "nav-item active" : "nav-item"}
          onClick={() => handleNavClick("classes")}
        >
          <IconClasses />
        </button>
        <button
          className={activeTab === "fees" ? "nav-item active" : "nav-item"}
          onClick={() => handleNavClick("fees")}
        >
          <IconFee />
        </button>
        <button
          className={activeTab === "slots" ? "nav-item active" : "nav-item"}
          onClick={() => handleNavClick("slots")}
        >
          <IconClock />
        </button>
        <button
          className={activeTab === "gallery" ? "nav-item active" : "nav-item"}
          onClick={() => handleNavClick("gallery")}
        >
          <IconGallery />
        </button>
        <button
          className={
            activeTab === "expense-add" || activeTab === "expense-history"
              ? "nav-item active"
              : "nav-item"
          }
          onClick={() => handleNavClick("expense-add")}
        >
          <IconExpense />
        </button>
      </nav>
    </div>
  );
};

export default AdminDashboard;
