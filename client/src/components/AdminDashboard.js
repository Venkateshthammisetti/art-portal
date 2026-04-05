import React, { useState, useEffect, useCallback } from "react";
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

// ==========================================
// 2. LEAF COMPONENTS (Modals & Views)
// ==========================================

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
    const newSchedule = [...formData.schedule];
    newSchedule[index][field] = value;
    setFormData({ ...formData, schedule: newSchedule });
  };
  const addScheduleSlot = () => {
    setFormData({
      ...formData,
      schedule: [...formData.schedule, { day: "Monday", time: "17:00", link: "" }],
    });
  };
  const removeScheduleSlot = (index) => {
    const newSchedule = formData.schedule.filter((_, i) => i !== index);
    setFormData({ ...formData, schedule: newSchedule });
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
                  setFormData({ ...formData, className: e.target.value })
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
                  setFormData({ ...formData, maxCapacity: e.target.value })
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
          <div className="form-row">
            <div className="form-group">
              <label>Level</label>
              <select
                required
                value={formData.level}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    level: e.target.value,
                    subLevel: "",
                  })
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
                  setFormData({ ...formData, subLevel: e.target.value })
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
            <label style={{ color: "#334155", fontWeight: "600" }}>
              Class Schedule
            </label>
            {formData.schedule.map((slot, index) => (
              <div
                key={index}
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
                <input
                  type="url"
                  placeholder={`Meeting link for ${slot.day || "this slot"} (optional)`}
                  value={slot.link || ""}
                  onChange={(e) =>
                    handleScheduleChange(index, "link", e.target.value)
                  }
                  style={{ fontSize: "0.85rem", color: "#334155" }}
                />
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
                setFormData({ ...formData, teacher: e.target.value })
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
        // Students who have NO class assigned
        return students.filter((s) => !s.assignedClass);
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
                {students.filter((s) => !s.assignedClass).length})
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
            <div className="table-container">
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
const UserDetailsView = ({ user, onBack, onDelete }) => {
  const [credentials, setCredentials] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [loadingCreds, setLoadingCreds] = useState(false);
  const [copyMsg, setCopyMsg] = useState("");

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
          <button className="delete-btn-large" onClick={onDelete}>
            Delete User
          </button>
        </div>
      </div>
      <div className="object-body-grid">
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
                <span
                  style={{
                    fontSize: "12px",
                    color: "#10b981",
                    fontWeight: "bold",
                  }}
                >
                  {copyMsg}
                </span>
              )}
            </div>
            <div
              className="credential-box"
              style={{
                background: "#f8fafc",
                padding: "15px",
                borderRadius: "8px",
              }}
            >
              <div
                style={{
                  marginBottom: "10px",
                  display: "flex",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <span style={{ fontSize: "12px", color: "#64748b" }}>
                    Username
                  </span>
                  <strong
                    style={{
                      display: "block",
                      fontSize: "16px",
                      color: "#334155",
                    }}
                  >
                    {user.username}
                  </strong>
                </div>
                <button
                  onClick={() => handleCopy(user.username)}
                  className="icon-btn"
                  title="Copy Username"
                >
                  📋
                </button>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <span style={{ fontSize: "12px", color: "#64748b" }}>
                    Password
                  </span>
                  {loadingCreds ? (
                    <span style={{ fontSize: "12px", color: "#999" }}>
                      Fetching...
                    </span>
                  ) : showPassword && credentials ? (
                    <strong
                      style={{
                        display: "block",
                        fontSize: "16px",
                        fontFamily: "monospace",
                      }}
                    >
                      {credentials.password}
                    </strong>
                  ) : (
                    <strong
                      style={{
                        display: "block",
                        fontSize: "16px",
                        letterSpacing: "2px",
                      }}
                    >
                      ••••••••
                    </strong>
                  )}
                </div>
                <div style={{ display: "flex", gap: "5px" }}>
                  <button
                    onClick={handleToggleCredentials}
                    className="icon-btn"
                    style={{ color: "#0284c7" }}
                  >
                    {showPassword ? "👁️‍🗨️" : "👁️"}
                  </button>
                  {showPassword && credentials && (
                    <button
                      onClick={() => handleCopy(credentials.password)}
                      className="icon-btn"
                      title="Copy Password"
                    >
                      📋
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
          <div className="detail-card">
            <h3>Contact Information</h3>
            <div className="info-row">
              <label>Email:</label> <span>{user.email || "N/A"}</span>
            </div>
            <div className="info-row">
              <label>Phone:</label> <span>{user.phone || "N/A"}</span>
            </div>
            <div className="info-row">
              <label>Location:</label> <span>{user.location || "N/A"}</span>
            </div>
            <div className="info-row">
              <label>City:</label> <span>{user.city || "N/A"}</span>
            </div>
            <div className="info-row">
              <label>Zoom ID:</label> <span>{user.zoomId || "N/A"}</span>
            </div>
          </div>
        </div>
        <div className="detail-card full-width-card">
          <h3>
            {user.role === "parent"
              ? "Student Details"
              : "Professional Details"}
          </h3>
          <div className="details-grid-layout">
            <div className="info-col">
              <div className="info-row">
                <label>Joining Date:</label>{" "}
                <span style={{ fontWeight: "bold" }}>
                  {user.joiningDate
                    ? new Date(user.joiningDate).toLocaleDateString()
                    : "N/A"}
                </span>
              </div>
              {user.role === "parent" ? (
                <>
                  <div className="info-row">
                    <label>Child Name:</label>{" "}
                    <span>{user.childName || "N/A"}</span>
                  </div>
                  <div className="info-row">
                    <label>Gender:</label> <span>{user.gender || "N/A"}</span>
                  </div>
                  <div className="info-row">
                    <label>Date of Birth:</label>{" "}
                    <span>
                      {user.childDob
                        ? new Date(user.childDob).toLocaleDateString()
                        : "N/A"}
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <div className="info-row">
                    <label>Specialization:</label>{" "}
                    <span>{user.specialization || "N/A"}</span>
                  </div>
                  <div className="info-row">
                    <label>Date of Birth:</label>{" "}
                    <span>
                      {displayDob
                        ? new Date(displayDob).toLocaleDateString()
                        : "N/A"}
                    </span>
                  </div>
                </>
              )}
            </div>
            <div className="info-col">
              {user.role === "parent" ? (
                <>
                  <div className="info-row">
                    <label>Age:</label> <span>{user.childAge || "N/A"}</span>
                  </div>
                  <div className="info-row">
                    <label>Class:</label>{" "}
                    <span>{user.childClass || "N/A"}</span>
                  </div>
                  <div className="info-row">
                    <label>Total Classes:</label>{" "}
                    <span style={{ fontWeight: "bold" }}>
                      {user.monthlyClassesTarget || 8} Classes/Mo
                    </span>
                  </div>
                  <div className="info-row">
                    <label>Monthly Fee:</label>
                    <span
                      style={{
                        color: "#16a34a",
                        fontWeight: "bold",
                        fontSize: "16px",
                      }}
                    >
                      ₹{user.monthlyFee || 0}
                    </span>
                  </div>
                </>
              ) : user.role === "teacher" ? (
                <div className="info-row">
                  <label>Monthly Salary:</label>
                  <span
                    style={{
                      color: "#9333ea",
                      fontWeight: "bold",
                      fontSize: "16px",
                    }}
                  >
                    ₹{user.monthlyFee || 0}
                  </span>
                </div>
              ) : (
                <div className="info-row">
                  <label>Role Type:</label> <span>Administrator</span>
                </div>
              )}
              {user.role !== "admin" && (
                <div className="info-row">
                  <label>Referred By:</label>{" "}
                  <span>{user.referredBy || "N/A"}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ==========================================
// 3. TAB COMPONENTS (Dependent on Modals/Helpers)
// ==========================================

const OverviewTab = ({ stats, users, classes, loading }) => {
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
        const res = await axios.get(
          `https://art-portal-7n6r.onrender.com/api/attendance/monthly?classes=${attSelectedClass}&month=${attMonth}`
        );
        setAttRecords(res.data);
      } catch (err) {
        console.error("Attendance fetch error:", err);
      } finally {
        setAttLoading(false);
      }
    };
    fetchAttendance();
  }, [attSelectedClass, attMonth]);

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

  const maleCount = students.filter((s) => s.gender === "Male").length;
  const femaleCount = students.filter((s) => s.gender === "Female").length;
  const genderData = [
    { name: "Male", value: maleCount, color: "#3b82f6" },
    { name: "Female", value: femaleCount, color: "#ec4899" },
  ].filter((d) => d.value > 0);

  const currentMonth = new Date().toISOString().slice(0, 7);
  const paidCount = students.filter((s) =>
    (s.payments || []).some(
      (p) => p.month === currentMonth && p.status === "Paid",
    ),
  ).length;
  const pendingCount = students.length - paidCount;

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

  const ProfessionalDonut = ({ data, totalLabel }) => {
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
              >
                {data.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.color}
                    style={{ outline: "none" }}
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
              style={{ display: "flex", alignItems: "center", gap: "8px" }}
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
        <div className="overview-stat-card">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: "15px",
            }}
          >
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "10px",
                background: "#eff6ff",
                color: "#2563eb",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "1.2rem",
              }}
            >
              🎓
            </div>
            <span
              style={{
                fontSize: "0.75rem",
                fontWeight: "600",
                color: "#16a34a",
                background: "#dcfce7",
                padding: "2px 8px",
                borderRadius: "10px",
                height: "fit-content",
              }}
            >
              + Active
            </span>
          </div>
          <div
            style={{ fontSize: "2rem", fontWeight: "800", color: "#1e293b" }}
          >
            {stats.students}
          </div>
          <div
            style={{ color: "#64748b", fontSize: "0.9rem", fontWeight: "500" }}
          >
            Total Students
          </div>
        </div>
        <div className="overview-stat-card">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: "15px",
            }}
          >
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "10px",
                background: "#f0fdf4",
                color: "#16a34a",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "1.2rem",
              }}
            >
              👨‍🏫
            </div>
          </div>
          <div
            style={{ fontSize: "2rem", fontWeight: "800", color: "#1e293b" }}
          >
            {stats.teachers}
          </div>
          <div
            style={{ color: "#64748b", fontSize: "0.9rem", fontWeight: "500" }}
          >
            Expert Teachers
          </div>
        </div>
        <div className="overview-stat-card">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: "15px",
            }}
          >
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "10px",
                background: "#f5f3ff",
                color: "#7c3aed",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "1.2rem",
              }}
            >
              💰
            </div>
          </div>
          <div
            style={{ fontSize: "2rem", fontWeight: "800", color: "#1e293b" }}
          >
            ₹{(stats.revenue || 0).toLocaleString()}
          </div>
          <div
            style={{ color: "#64748b", fontSize: "0.9rem", fontWeight: "500" }}
          >
            Monthly Revenue (Est.)
          </div>
        </div>
        <div className="overview-stat-card">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: "15px",
            }}
          >
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "10px",
                background: "#fff7ed",
                color: "#ea580c",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "1.2rem",
              }}
            >
              ⚠️
            </div>
          </div>
          <div
            style={{ fontSize: "2rem", fontWeight: "800", color: "#1e293b" }}
          >
            {pendingCount}
          </div>
          <div
            style={{ color: "#64748b", fontSize: "0.9rem", fontWeight: "500" }}
          >
            Pending Payments
          </div>
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
          <ProfessionalDonut data={genderData} totalLabel="Students" />
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
const UserManagementTab = () => {
  const [users, setUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [sortOrder, setSortOrder] = useState("newest");
  const [selectedUser, setSelectedUser] = useState(null);
  const [editingUser, setEditingUser] = useState(null);
  const [deleteModal, setDeleteModal] = useState({ show: false, userId: null });
  const [toast, setToast] = useState({ show: false, message: "", type: "" });
  const [showColMenu, setShowColMenu] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState(() => {
    const savedColumns = localStorage.getItem("admin_visible_columns");
    return savedColumns
      ? JSON.parse(savedColumns)
      : {
          name: true,
          role: true,
          fee: true,
          joiningDate: true,
          status: true,
          action: true,
        };
  });

  useEffect(() => {
    fetchUsers();
  }, []);
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
      await axios.delete(
        `https://art-portal-7n6r.onrender.com/api/users/${deleteModal.userId}`,
      );
      setUsers(users.filter((user) => user._id !== deleteModal.userId));
      showToast("User deleted successfully!", "success");
      setDeleteModal({ show: false, userId: null });
      setSelectedUser(null);
    } catch (err) {
      showToast("Failed to delete user.", "error");
      setDeleteModal({ show: false, userId: null });
    }
  };
  const handleToggleStatus = async (e, userId, currentStatus) => {
    e.stopPropagation();
    try {
      await axios.put(
        `https://art-portal-7n6r.onrender.com/api/users/${userId}/status`,
      );
      setUsers(
        users.map((user) =>
          user._id === userId ? { ...user, isActive: !currentStatus } : user,
        ),
      );
      showToast("Status updated", "success");
    } catch (err) {
      showToast("Error", "error");
    }
  };
  const handleEditClick = (e, user) => {
    e.stopPropagation();
    setEditingUser(user);
  };
  const handleEditSave = async (updatedData) => {
    try {
      await axios.put(
        `https://art-portal-7n6r.onrender.com/api/users/${updatedData._id}`,
        updatedData,
      );
      setUsers(users.map((u) => (u._id === updatedData._id ? updatedData : u)));
      if (selectedUser && selectedUser._id === updatedData._id) {
        setSelectedUser(updatedData);
      }
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

  const filteredUsers = users.filter((user) => {
    const matchesRole = roleFilter === "all" || user.role === roleFilter;
    const searchLower = searchTerm.toLowerCase();
    return (
      matchesRole &&
      ((user.username && user.username.toLowerCase().includes(searchLower)) ||
        (user.fullName && user.fullName.toLowerCase().includes(searchLower)) ||
        (user.email && user.email.toLowerCase().includes(searchLower)) ||
        (user.phone && user.phone.includes(searchLower)) ||
        (user.location && user.location.toLowerCase().includes(searchLower)) ||
        (user.city && user.city.toLowerCase().includes(searchLower)) ||
        (user.childName && user.childName.toLowerCase().includes(searchLower)))
    );
  });
  const sortedUsers = [...filteredUsers].sort((a, b) => {
    if (sortOrder === "newest")
      return new Date(b.createdAt) - new Date(a.createdAt);
    if (sortOrder === "oldest")
      return new Date(a.createdAt) - new Date(b.createdAt);
    if (sortOrder === "fee-high")
      return (b.monthlyFee || 0) - (a.monthlyFee || 0);
    if (sortOrder === "fee-low")
      return (a.monthlyFee || 0) - (b.monthlyFee || 0);
    return 0;
  });

  return (
    <>
      <div
        className={`toast-notification ${toast.type} ${toast.show ? "show" : ""}`}
      >
        {toast.type === "success" ? "✅" : "❌"} {toast.message}
      </div>
      {selectedUser ? (
        <UserDetailsView
          user={selectedUser}
          onBack={() => setSelectedUser(null)}
          onDelete={() => initiateDelete(null, selectedUser._id)}
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
                placeholder="Search Name, City, ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="filter-actions">
              <div className="filter-dropdown">
                <label>Role:</label>
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                >
                  <option value="all">All Users</option>
                  <option value="parent">Students</option>
                  <option value="teacher">Teachers</option>
                  <option value="admin">Admins</option>
                </select>
              </div>
              <div className="filter-dropdown">
                <label>Sort:</label>
                <select
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value)}
                >
                  <option value="newest">Newest First</option>
                  <option value="oldest">Oldest First</option>
                  <option value="fee-high">Highest Fee</option>
                  <option value="fee-low">Lowest Fee</option>
                </select>
              </div>
              <div style={{ position: "relative" }}>
                <button
                  className="customize-btn"
                  onClick={() => setShowColMenu(!showColMenu)}
                  title="Customize Columns"
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M12 3h7a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-7m0-18H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h7m0-18v18"></path>
                  </svg>
                </button>
                {showColMenu && (
                  <div className="column-menu-dropdown">
                    <h4>Show Columns</h4>
                    <label>
                      <input
                        type="checkbox"
                        checked={visibleColumns.name}
                        onChange={() => toggleColumn("name")}
                      />{" "}
                      Name / ID
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        checked={visibleColumns.role}
                        onChange={() => toggleColumn("role")}
                      />{" "}
                      Role
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        checked={visibleColumns.fee}
                        onChange={() => toggleColumn("fee")}
                      />{" "}
                      Fee / Salary
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        checked={visibleColumns.joiningDate}
                        onChange={() => toggleColumn("joiningDate")}
                      />{" "}
                      Joining Date
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        checked={visibleColumns.status}
                        onChange={() => toggleColumn("status")}
                      />{" "}
                      Status
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        checked={visibleColumns.action}
                        onChange={() => toggleColumn("action")}
                      />{" "}
                      Actions
                    </label>
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="table-container">
            <table className="custom-table clickable-rows">
              <thead>
                <tr>
                  {visibleColumns.name && <th>Name / ID</th>}
                  {visibleColumns.role && <th>Role</th>}
                  {visibleColumns.fee && <th>Fee / Salary</th>}
                  {visibleColumns.joiningDate && <th>Joining Date</th>}
                  {visibleColumns.status && <th>Status</th>}
                  {visibleColumns.action && <th>Action</th>}
                </tr>
              </thead>
              <tbody>
                {sortedUsers.map((user) => (
                  <tr
                    key={user._id}
                    onClick={() => setSelectedUser(user)}
                    className="user-row"
                  >
                    {visibleColumns.name && (
                      <td>
                        <div style={{ fontWeight: "600", color: "#333" }}>
                          {user.fullName || user.username}
                        </div>
                        <div style={{ fontSize: "12px", color: "#888" }}>
                          {user.role === "parent"
                            ? `Student: ${user.childName}`
                            : user.location || "No Location"}
                        </div>
                      </td>
                    )}
                    {visibleColumns.role && (
                      <td>
                        <span className={`role-badge ${user.role}`}>
                          {user.role}
                        </span>
                      </td>
                    )}
                    {visibleColumns.fee && (
                      <td>
                        {user.role === "parent" ? (
                          <>
                            {isRegisteredInOrBefore(
                              user.registeredDate,
                              new Date().toISOString().slice(0, 7),
                            ) ? (
                              <span
                                style={{ color: "#16a34a", fontWeight: "bold" }}
                              >
                                ₹{user.monthlyFee || 0}
                              </span>
                            ) : (
                              <span
                                style={{
                                  color: "#94a3b8",
                                  fontSize: "0.85rem",
                                }}
                              >
                                ₹0 (Starts {user.registeredDate})
                              </span>
                            )}
                          </>
                        ) : user.role === "teacher" ? (
                          <span
                            style={{ color: "#9333ea", fontWeight: "bold" }}
                          >
                            ₹{user.monthlyFee || 0}
                          </span>
                        ) : (
                          "-"
                        )}
                      </td>
                    )}
                    {visibleColumns.joiningDate && (
                      <td>
                        {user.joiningDate
                          ? new Date(user.joiningDate).toLocaleDateString()
                          : "-"}
                      </td>
                    )}
                    {visibleColumns.status && (
                      <td>
                        <button
                          className={`status-btn ${user.isActive ? "active" : "inactive"}`}
                          onClick={(e) =>
                            handleToggleStatus(e, user._id, user.isActive)
                          }
                        >
                          {user.isActive ? "Active" : "Inactive"}
                        </button>
                      </td>
                    )}
                    {visibleColumns.action && (
                      <td className="action-cell">
                        <button
                          className="edit-btn"
                          onClick={(e) => handleEditClick(e, user)}
                          title="Edit"
                        >
                          <svg
                            width="18"
                            height="18"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                          </svg>
                        </button>
                        <button
                          className="delete-btn"
                          onClick={(e) => initiateDelete(e, user._id)}
                          title="Delete"
                        >
                          <svg
                            width="18"
                            height="18"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
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
        </div>
      )}
      {deleteModal.show && (
        <div className="modal-overlay">
          <div className="modal-content delete-modal-content">
            <h3>Are you sure?</h3>
            <div className="modal-actions">
              <button
                className="cancel-btn"
                onClick={() => setDeleteModal({ show: false, userId: null })}
              >
                Cancel
              </button>
              <button className="confirm-delete-btn" onClick={confirmDelete}>
                Yes, Delete
              </button>
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
    </>
  );
};

// --- TAB 3: ADD USER ---
const AddUserTab = () => {
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
    childClass: "",
    monthlyFee: "",
    specialization: "",
    education: "",
    joiningDate: new Date().toISOString().split("T")[0],
    // ✨ NEW FIELD: Defaults to Today, but can be edited for old students
    registeredDate: new Date().toISOString().split("T")[0],
    dob: "",
    monthlyClassesTarget: 8,
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
      });
      setShowSibling(false);
    } catch (err) {
      console.error(err);
      setMsg("❌ Error: Username taken or server issue.");
    }
  };

  return (
    <div className="form-wrapper">
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
                <label>Parent Email</label>
                <input
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                />
              </div>
              <div className="form-group">
                <label>Zoom ID</label>
                <input
                  name="zoomId"
                  value={formData.zoomId}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Location (Area/Street)</label>
                <input
                  name="location"
                  value={formData.location}
                  onChange={handleChange}
                />
              </div>
              <div className="form-group">
                <label>City</label>
                <input
                  name="city"
                  value={formData.city}
                  onChange={handleChange}
                  placeholder="e.g. Hyderabad"
                />
              </div>
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
              className="form-row"
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
    return matchesBasic || matchesTeacher || matchesStudent;
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

  const getClassForSlot = (timeStart) => {
    return classes.find((cls) =>
      cls.schedule.some((s) => s.day === selectedDay && s.time === timeStart),
    );
  };

  // const isEveningBlocked = [
  //   "Monday",
  //   "Tuesday",
  //   "Wednesday",
  //   "Thursday",
  //   "Friday",
  // ].includes(selectedDay);

  const isEveningBlocked = false;

  const renderSlotCard = (slot, isBlocked) => {
    const assignedClass = getClassForSlot(slot.start);

    if (isBlocked && !assignedClass) {
      return (
        <div
          key={slot.id}
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
          <span
            style={{
              color: "#94a3b8",
              fontSize: "0.9rem",
              fontStyle: "italic",
            }}
          >
            available
          </span>
        </div>
      );
    }

    if (assignedClass) {
      const enrolled = assignedClass.students.length;
      const capacity = assignedClass.maxCapacity || 10;
      const isFull = enrolled >= capacity;

      return (
        <div
          key={slot.id}
          className="detail-card"
          onClick={() => handleEditClick(assignedClass)}
          style={{
            margin: 0,
            borderLeft: isFull ? "4px solid #ef4444" : "4px solid #3b82f6",
            minHeight: "100px",
            cursor: "pointer",
            transition: "transform 0.1s",
          }}
          title="Click to Edit Class"
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: "5px",
            }}
          >
            <span style={{ fontWeight: "bold", color: "#334155" }}>
              {assignedClass.className}
            </span>
            <span
              style={{
                fontSize: "0.75rem",
                padding: "2px 6px",
                borderRadius: "4px",
                background: isFull ? "#fee2e2" : "#eff6ff",
                color: isFull ? "#991b1b" : "#1d4ed8",
                fontWeight: "bold",
              }}
            >
              {isFull ? "FULL" : `${capacity - enrolled} Open`}
            </span>
          </div>
          <div
            style={{
              fontSize: "0.8rem",
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
                width: `${(enrolled / capacity) * 100}%`,
                background: isFull ? "#ef4444" : "#3b82f6",
              }}
            ></div>
          </div>
          <div style={{ fontSize: "0.75rem", color: "#334155" }}>
            Teacher:{" "}
            <strong>
              {assignedClass.teacher ? assignedClass.teacher.fullName : "N/A"}
            </strong>
          </div>
        </div>
      );
    }

    return (
      <div
        key={slot.id}
        onClick={() => handleSlotClick(slot.start)}
        style={{
          background: "#f0fdf4",
          border: "1px dashed #16a34a",
          borderRadius: "8px",
          padding: "15px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100px",
          cursor: "pointer",
          transition: "background 0.2s",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "#dcfce7")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "#f0fdf4")}
      >
        <div
          style={{ color: "#16a34a", fontWeight: "bold", marginBottom: "5px" }}
        >
          Available
        </div>
        <div style={{ color: "#15803d", fontSize: "0.8rem" }}>
          + Schedule Class
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

const FeeTrackerTab = () => {
  const [students, setStudents] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(
    new Date().toISOString().slice(0, 7),
  );
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [sortOrder, setSortOrder] = useState("name-asc");
  const [showAnalytics, setShowAnalytics] = useState(false);

  useEffect(() => {
    fetchStudents();
  }, []);

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const res = await axios.get(
        "https://art-portal-7n6r.onrender.com/api/users",
      );
      setStudents(res.data.filter((u) => u.role === "parent"));
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
    const updatedStudents = students.map((s) => {
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
    setStudents(updatedStudents);
    try {
      await axios.post("https://art-portal-7n6r.onrender.com/api/fees/update", {
        userId: studentId,
        month: selectedMonth,
        status: newStatus,
        amount: feeAmount,
      });
    } catch (err) {
      alert("Error updating payment");
      fetchStudents();
    }
  };

  // ✨ FIX: Check if selected month is BEFORE student joined
  const getPaymentStatus = (student) => {
    const startMonth = getStudentStartMonth(student);

    // If the selected month is older than the start month (e.g., Select "2026-01" but joined "2026-02")
    if (selectedMonth < startMonth) {
      return "Not Joined";
    }

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

      if (!isPaid) {
        pendingCount++;
        pendingAmount += Number(student.monthlyFee) || 0;
      }
      iterIndex++;
    }

    return { count: pendingCount, amount: pendingAmount };
  };

  const totalEstRevenue = students.reduce((acc, s) => {
    // Only count revenue if student has joined by this month
    return getPaymentStatus(s) !== "Not Joined"
      ? acc + (s.monthlyFee || 0)
      : acc;
  }, 0);

  const currentCollected = students.reduce(
    (acc, s) =>
      getPaymentStatus(s) === "Paid" ? acc + (s.monthlyFee || 0) : acc,
    0,
  );
  const currentPending = totalEstRevenue - currentCollected;
  const totalOutstandingAllTime = students.reduce(
    (acc, s) => acc + calculateTotalPending(s).amount,
    0,
  );

  const processedStudents = students
    .filter(
      (s) =>
        (filterStatus === "all" || getPaymentStatus(s) === filterStatus) &&
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
                      const isNotJoined = status === "Not Joined"; // Check this
                      const pendingStats = calculateTotalPending(student);
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
                          </td>
                          <td style={{ fontWeight: "bold" }}>
                            ₹{student.monthlyFee}
                          </td>
                          <td>
                            {/* ✨ NEW BADGE FOR 'NOT JOINED' */}
                            {isNotJoined ? (
                              <span
                                className="role-badge"
                                style={{
                                  background: "#e2e8f0",
                                  color: "#64748b",
                                  border: "1px solid #cbd5e1",
                                }}
                              >
                                N/A
                              </span>
                            ) : (
                              <span
                                className={`role-badge ${isPaid ? "teacher" : "admin"}`}
                                style={{
                                  background: isPaid ? "#dcfce7" : "#fee2e2",
                                  color: isPaid ? "#166534" : "#991b1b",
                                }}
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
                            {/* Disable button if Not Joined */}
                            <button
                              className="save-btn"
                              disabled={isNotJoined}
                              style={{
                                width: "auto",
                                padding: "6px 12px",
                                fontSize: "0.85rem",
                                backgroundColor: isNotJoined
                                  ? "#94a3b8"
                                  : isPaid
                                    ? "#ef4444"
                                    : "#10b981",
                                cursor: isNotJoined ? "not-allowed" : "pointer",
                                opacity: isNotJoined ? 0.6 : 1,
                              }}
                              onClick={() =>
                                handleTogglePayment(
                                  student._id,
                                  status,
                                  student.monthlyFee,
                                )
                              }
                            >
                              {isNotJoined
                                ? "Not Joined"
                                : isPaid
                                  ? "Mark Unpaid"
                                  : "Pay This Month"}
                            </button>
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

  // Keyboard
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (lightboxIndex === null) return;
      if (e.key === "ArrowRight") handleNext();
      if (e.key === "ArrowLeft") handlePrev();
      if (e.key === "Escape") setLightboxIndex(null);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [lightboxIndex]);

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

  return (
    <div className="form-wrapper">
      {/* HEADER & FILTERS */}
      <div
        style={{
          background: "#f8fafc",
          padding: "15px",
          borderRadius: "12px",
          border: "1px solid #e2e8f0",
          marginBottom: "20px",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "15px",
          }}
        >
          <h3 style={{ margin: 0, color: "#334155" }}>🎨 Gallery Manager</h3>

          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            {/* Student Selector */}
            <select
              value={selectedStudent}
              onChange={(e) => setSelectedStudent(e.target.value)}
              style={{
                padding: "8px",
                borderRadius: "6px",
                border: "1px solid #cbd5e1",
                fontWeight: "bold",
                minWidth: "180px",
              }}
            >
              <option value="all">🌍 All Students</option>
              <option disabled>──────────</option>
              {students.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.childName}
                </option>
              ))}
            </select>

            {/* Year Filter */}
            <select
              value={filterYear}
              onChange={(e) => setFilterYear(e.target.value)}
              style={{
                padding: "8px",
                borderRadius: "6px",
                border: "1px solid #cbd5e1",
                cursor: "pointer",
              }}
            >
              <option value="all">All Years</option>
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>

            {/* Month Filter */}
            <select
              value={filterMonth}
              onChange={(e) => setFilterMonth(e.target.value)}
              style={{
                padding: "8px",
                borderRadius: "6px",
                border: "1px solid #cbd5e1",
                cursor: "pointer",
              }}
            >
              <option value="all">All Months</option>
              {months.map((m, i) => (
                <option key={i} value={i}>
                  {m}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div
        style={{ marginBottom: "15px", fontSize: "0.9rem", color: "#64748b" }}
      >
        Found <strong>{filteredArtwork.length}</strong> items in
        <span style={{ color: "#2563eb", fontWeight: "bold" }}>
          {" "}
          {filterMonth === "all" ? "All Months" : months[filterMonth]}{" "}
          {filterYear === "all" ? "" : filterYear}
        </span>
      </div>

      {/* GALLERY GRID */}
<div
  style={{
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
    gap: "20px",
  }}
>
  {loading ? (
    <p>Loading Gallery...</p>
  ) : filteredArtwork.length === 0 ? (
    <div
      style={{
        gridColumn: "1/-1",
        textAlign: "center",
        padding: "40px",
        background: "#f1f5f9",
        borderRadius: "12px",
        color: "#94a3b8",
      }}
    >
      No artwork found for this filter.
    </div>
  ) : (
    filteredArtwork.map((art, index) => (
      <div
        key={art._id}
        style={{
          border: "1px solid #e2e8f0",
          borderRadius: "12px",
          overflow: "hidden",
          background: "#fff",
          position: "relative",
          cursor: "pointer",
          boxShadow: "0 2px 5px rgba(0,0,0,0.05)",
        }}
        onClick={() => setLightboxIndex(index)}
      >
        <img
          src={art.imageUrl}
          alt={art.title}
          style={{ width: "100%", height: "200px", objectFit: "cover" }}
        />
        <div style={{ padding: "12px" }}>
          {selectedStudent === "all" && (
            <div
              style={{
                fontSize: "0.75rem",
                fontWeight: "bold",
                color: "#2563eb",
                marginBottom: "4px",
                textTransform: "uppercase",
              }}
            >
              {art.studentId?.childName || "Unknown"}
            </div>
          )}
          <div style={{ fontWeight: "bold", color: "#334155" }}>
            {art.title || "Untitled"}
          </div>
          <div style={{ fontSize: "0.8rem", color: "#64748b" }}>
            {art.medium} •{" "}
            {new Date(art.dateCreated).toLocaleDateString()}
          </div>
        </div>

        {/* ACTION BUTTONS — top-right corner */}
        <div
          style={{
            position: "absolute",
            top: "10px",
            right: "10px",
            display: "flex",
            flexDirection: "column",
            gap: "6px",
          }}
        >
          {/* DELETE */}
          <button
            onClick={(e) => handleDelete(e, art._id)}
            style={{
              background: "rgba(255,255,255,0.9)",
              border: "none",
              borderRadius: "50%",
              width: "30px",
              height: "30px",
              cursor: "pointer",
              color: "#ef4444",
              fontWeight: "bold",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 2px 5px rgba(0,0,0,0.2)",
            }}
            title="Delete Artwork"
          >
            🗑️
          </button>

          {/* DOWNLOAD */}
          <button
            onClick={(e) => handleDownload(e, art.imageUrl, art.title)}
            style={{
              background: "rgba(255,255,255,0.9)",
              border: "none",
              borderRadius: "50%",
              width: "30px",
              height: "30px",
              cursor: "pointer",
              color: "#2563eb",
              fontWeight: "bold",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 2px 5px rgba(0,0,0,0.2)",
            }}
            title="Download Artwork"
          >
            ⬇️
          </button>
        </div>
      </div>
    ))
  )}
</div>

      {/* LIGHTBOX OVERLAY */}
      {lightboxIndex !== null && filteredArtwork[lightboxIndex] && (
        <div
          className="lightbox-overlay"
          onClick={() => setLightboxIndex(null)}
        >
          <button
            className="lightbox-close"
            onClick={() => setLightboxIndex(null)}
          >
            ×
          </button>
          <button className="lightbox-nav-btn prev" onClick={handlePrev}>
            ‹
          </button>
          <div
            className="lightbox-content"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={filteredArtwork[lightboxIndex].imageUrl}
              alt={filteredArtwork[lightboxIndex].title}
              className="lightbox-img"
            />
          </div>
          <button className="lightbox-nav-btn next" onClick={handleNext}>
            ›
          </button>
          <div className="lightbox-caption">
            {selectedStudent === "all" && (
              <h2 style={{ margin: "0 0 5px 0", fontSize: "1.4rem" }}>
                {filteredArtwork[lightboxIndex].studentId?.childName}
              </h2>
            )}
            <strong>
              {filteredArtwork[lightboxIndex].title || "Untitled"}
            </strong>
            <span>
              {filteredArtwork[lightboxIndex].medium} •{" "}
              {new Date(
                filteredArtwork[lightboxIndex].dateCreated,
              ).toLocaleDateString()}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
// ==========================================
// 4. MAIN COMPONENT (Defined LAST to fix dependency errors)
// ==========================================
const AdminDashboard = ({ onLogout }) => {
  const [activeTab, setActiveTab] = useState("overview");
  const [stats, setStats] = useState({ students: 0, teachers: 0, revenue: 0 });
  const [overviewUsers, setOverviewUsers] = useState([]);
  const [overviewClasses, setOverviewClasses] = useState([]);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [showMobileLogout, setShowMobileLogout] = useState(false);
  const [darkMode, setDarkMode] = useState(
    () => localStorage.getItem("admin_theme") === "dark",
  );

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

  const fetchStats = () => {
    axios
      .get("https://art-portal-7n6r.onrender.com/api/dashboard/stats")
      .then((res) => setStats(res.data))
      .catch((err) => console.error(err));
  };

  const fetchOverviewData = async () => {
    try {
      const [usersRes, classesRes] = await Promise.all([
        axios.get("https://art-portal-7n6r.onrender.com/api/users"),
        axios.get("https://art-portal-7n6r.onrender.com/api/classes"),
      ]);
      setOverviewUsers(usersRes.data);
      setOverviewClasses(classesRes.data);
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

  const handleNavClick = (tab) => {
    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="admin-container" data-theme={darkMode ? "dark" : "light"}>
      <aside className="admin-sidebar">
        <div className="sidebar-brand">
          <img src={logoImg} alt="Logo" className="sidebar-logo-img" />
          <img src={titleImg} alt="Venky Art" className="sidebar-title-img" />
        </div>
        <nav className="sidebar-nav">
          <button
            className={activeTab === "overview" ? "active" : ""}
            onClick={() => setActiveTab("overview")}
          >
            <IconHome /> <span>Dashboard</span>
          </button>
          <button
            className={activeTab === "users" ? "active" : ""}
            onClick={() => setActiveTab("users")}
          >
            <IconUsers /> <span>User Management</span>
          </button>
          <button
            className={activeTab === "classes" ? "active" : ""}
            onClick={() => setActiveTab("classes")}
          >
            <IconClasses /> <span>Class Management</span>
          </button>
          <button
            className={activeTab === "fees" ? "active" : ""}
            onClick={() => setActiveTab("fees")}
          >
            <IconFee /> <span>Fee Tracker</span>
          </button>
          <button
            className={activeTab === "add-user" ? "active" : ""}
            onClick={() => setActiveTab("add-user")}
          >
            <IconAdd /> <span>Register User</span>
          </button>
          <button
            className={activeTab === "slots" ? "active" : ""}
            onClick={() => setActiveTab("slots")}
          >
            <IconClock /> <span>Slot Manager</span>
          </button>
          {/* ✨ ADDED GALLERY BUTTON */}
          <button
            className={activeTab === "gallery" ? "active" : ""}
            onClick={() => setActiveTab("gallery")}
          >
            <span style={{ fontSize: "1.2rem" }}>🎨</span> <span>Gallery</span>
          </button>
        </nav>
        <div className="sidebar-footer">
          <p>Admin Portal v1.0</p>
        </div>
      </aside>

      <main className="admin-main">
        <header className="top-header">
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
                      : activeTab === "slots"
                        ? "Slot Manager"
                        : activeTab === "gallery"
                          ? "Art Gallery"
                          : "Register User"}
            </h2>
            <p>Welcome back, Admin</p>
          </div>
          <div className="header-actions">
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
          {activeTab === "overview" && <OverviewTab stats={stats} users={overviewUsers} classes={overviewClasses} loading={overviewLoading} />}
          {activeTab === "users" && <UserManagementTab />}
          {activeTab === "classes" && <ClassManagementTab />}
          {activeTab === "add-user" && <AddUserTab />}
          {activeTab === "fees" && <FeeTrackerTab />}
          {activeTab === "slots" && <SlotManagementTab />}
          {/* ✨ ADDED GALLERY TAB */}
          {activeTab === "gallery" && <GalleryRepositoryTab />}
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
      </nav>
    </div>
  );
};

export default AdminDashboard;
