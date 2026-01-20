// src/components/ParentDashboard.js
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './ParentDashboard.css';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import logoImg from './new-logo.png'; 
import titleImg from './logo-title-copy.png';
import bannerImg from './banner4.png';

const ParentDashboard = ({ user, onLogout }) => {
  const currentUser = user;

  const [activeTab, setActiveTab] = useState('overview');
  const [studentProfile, setStudentProfile] = useState(null);
  const [assignedClass, setAssignedClass] = useState(null);
  const [reports, setReports] = useState([]);
  const [attendanceHistory, setAttendanceHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [attendanceMonth, setAttendanceMonth] = useState(new Date().toISOString().slice(0, 7));

  const [copyFeedback, setCopyFeedback] = useState("Copy Link");

  useEffect(() => {
    if (currentUser?._id) fetchParentData();
  }, [currentUser]);

  const fetchParentData = async () => {
    setLoading(true);
    try {
      const profileRes = await axios.get(`https://art-portal-7n6r.onrender.com/api/student/${currentUser._id}/profile`);
      setStudentProfile(profileRes.data.student);
      setAssignedClass(profileRes.data.classDetails);

      const reportRes = await axios.get(`https://art-portal-7n6r.onrender.com/api/feedback/student/${currentUser._id}`);
      setReports(reportRes.data);

      const attRes = await axios.get(`https://art-portal-7n6r.onrender.com/api/attendance/student/${currentUser._id}`);
      setAttendanceHistory(attRes.data);

    } catch (err) {
      console.error("Error loading parent data:", err);
    } finally {
      setLoading(false);
    }
  };

  // --- HELPERS ---
  const getNextClass = () => {
    if (!assignedClass || !assignedClass.schedule || assignedClass.schedule.length === 0) return null;
    const daysMap = { 'Sunday': 0, 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3, 'Thursday': 4, 'Friday': 5, 'Saturday': 6 };
    const today = new Date().getDay();
    const sortedSchedule = [...assignedClass.schedule].sort((a, b) => daysMap[a.day] - daysMap[b.day]);
    const next = sortedSchedule.find(s => daysMap[s.day] >= today);
    return next || sortedSchedule[0]; 
  };

  const calculateAttendanceStats = () => {
    const currentMonthRecords = attendanceHistory.filter(rec => rec.date.startsWith(attendanceMonth));
    const presentCount = currentMonthRecords.filter(r => r.status === 'Present').length;
    const targetClasses = studentProfile?.monthlyClassesTarget || 8; 
    let percentage = Math.round((presentCount / targetClasses) * 100);
    if (percentage > 100) percentage = 100;

    return { present: presentCount, target: targetClasses, percentage, records: currentMonthRecords };
  };

  const changeAttendanceMonth = (offset) => {
    const [year, month] = attendanceMonth.split('-').map(Number);
    const date = new Date(year, month - 1 + offset, 1);
    setAttendanceMonth(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
  };

  const formatMonthName = (isoStr) => {
    const [year, month] = isoStr.split('-');
    const date = new Date(year, month - 1);
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  const getPaymentStatus = () => {
    if (!studentProfile?.payments?.length) return { status: 'No Data', color: 'gray' };
    const lastPayment = studentProfile.payments[studentProfile.payments.length - 1];
    return lastPayment.status === 'Paid' ? { status: 'Paid', color: 'green' } : { status: 'Pending', color: 'red' };
  };

  // ✨ UPDATED REFERRAL LOGIC (With Real Data)
  const handleShare = (method) => {
    const websiteUrl = "https://thevenkyart.com"; 
    const referralText = `Hey! I highly recommend *Thevenkyart Online Art Academy* for professional art classes. Check them out here: ${websiteUrl}. Use my referral name *${currentUser.username}* when you join!`;
    
    if (method === 'whatsapp') {
      window.open(`https://wa.me/?text=${encodeURIComponent(referralText)}`, '_blank');
    } else if (method === 'copy') {
      navigator.clipboard.writeText(referralText);
      setCopyFeedback("Copied! ✅");
      setTimeout(() => setCopyFeedback("Copy Link"), 2000);
    }
  };

  if (loading) return <div className="loading-screen">Loading Portal...</div>;

  const attStats = calculateAttendanceStats();

  const chartData = [
    { name: 'Attended', value: attStats.present, color: '#2563eb' }, // Blue
    { name: 'Remaining', value: Math.max(0, attStats.target - attStats.present), color: '#e2e8f0' } // Light Grey
  ];

  return (
    <div className="parent-container">
      <aside className="parent-sidebar">
        {/* ✨ UPDATED SIDEBAR HEADER WITH IMAGE */}
        <div className="sidebar-header">
          <img
            src={logoImg}
            alt="Venky Art Logo"
            className="sidebar-logo-img"
          />
          <img src={titleImg} alt="Venky Art" className="sidebar-title-img" />
        </div>
        <div className="p-nav">
          <button
            className={activeTab === "overview" ? "active" : ""}
            onClick={() => setActiveTab("overview")}
          >
            <span>📊</span> Overview
          </button>
          <button
            className={activeTab === "schedule" ? "active" : ""}
            onClick={() => setActiveTab("schedule")}
          >
            <span>🗓️</span> Class Schedule
          </button>
          <button
            className={activeTab === "reports" ? "active" : ""}
            onClick={() => setActiveTab("reports")}
          >
            <span>📝</span> Academic Reports
          </button>
          <button
            className={activeTab === "attendance" ? "active" : ""}
            onClick={() => setActiveTab("attendance")}
          >
            <span>📅</span> Attendance Log
          </button>
          <button
            className={activeTab === "fees" ? "active" : ""}
            onClick={() => setActiveTab("fees")}
          >
            <span>💳</span> Fee Status
          </button>
          <button
            className={activeTab === "refer" ? "active" : ""}
            onClick={() => setActiveTab("refer")}
          >
            <span>📣</span> Refer and support
          </button>
        </div>
        <div className="sidebar-footer">
          <p>© 2026 Thevenkyart Art Academy</p>
        </div>
      </aside>

      <main className="parent-main">
        <header className="p-header">
          <div className="p-header-left">
            <h2>
              {activeTab === "overview"
                ? "My Dashboard"
                : activeTab === "refer"
                  ? "Refer a Friend"
                  : activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}
            </h2>
            <p>Parent Portal • {currentUser.fullName}</p>
          </div>
          <div className="p-header-right">
            <span className="role-badge">Parent</span>
            <div className="header-profile">
              <div className="avatar">{currentUser.fullName?.charAt(0)}</div>
            </div>
            <button className="logout-btn" onClick={onLogout}>
              Logout
            </button>
          </div>
        </header>

        <div className="p-content">
          {/* 1. OVERVIEW */}
          {activeTab === "overview" && (
            <div className="overview-grid">
              <div
                className="welcome-card"
                style={{
                  backgroundImage: `url(${bannerImg})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                  backgroundRepeat: "no-repeat",
                }}
              >
                <div className="wc-text">
                  <h1>Hello, {currentUser.fullName}!</h1>
                  <p>
                    Here is a quick summary of your child{" "}
                    <strong>{currentUser.childName}'s</strong> progress at
                    Thevenkyart Art Academy.
                  </p>
                </div>
                {/* <div className="wc-stat"><div className="big-stat">{attStats.percentage}%</div><div className="small-stat-label">Attended: <strong>{attStats.present}</strong> / {attStats.target}</div></div> */}
              </div>
              {/* ✨ 2. NEW: Separate Attendance Card */}
              <div className="info-card attendance-card">
                <h3>📅 Attendance</h3>

                <div
                  style={{
                    width: "100%",
                    height: "140px",
                    position: "relative",
                    marginTop: "10px",
                  }}
                >
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie
                        data={chartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={60}
                        startAngle={90}
                        endAngle={-270}
                        dataKey="value"
                        stroke="none"
                      >
                        {chartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>

                  {/* Centered Percentage */}
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
                      style={{
                        fontSize: "1.4rem",
                        fontWeight: "800",
                        color: "#1e293b",
                      }}
                    >
                      {attStats.percentage}%
                    </span>
                  </div>
                </div>

                <div className="att-details-text">
                  <div className="ad-row">
                    <span>Attended:</span>
                    <strong className="green">
                      {attStats.present} Classes
                    </strong>
                  </div>
                  <div className="ad-row">
                    <span>Total Target:</span>
                    <strong>{attStats.target} Classes</strong>
                  </div>
                </div>
              </div>
              <div className="info-card report-preview-card">
                <h3>📝 Latest Report</h3>
                {reports.length > 0 ? (
                  <div className="latest-report-box">
                    <div className="lrb-header">
                      <span className="lrb-month">{reports[0].month}</span>
                      <span className="lrb-rating">
                        {"★".repeat(reports[0].rating)}
                      </span>
                    </div>
                    <p className="lrb-text">
                      "{reports[0].feedbackText.substring(0, 60)}..."
                    </p>
                    {reports[0].reportFile ? (
                      <a
                        href={`https://art-portal-7n6r.onrender.com/${reports[0].reportFile}`}
                        target="_blank"
                        rel="noreferrer"
                        className="mini-link-btn"
                      >
                        📄 View PDF
                      </a>
                    ) : (
                      <button
                        className="mini-link-btn"
                        onClick={() => setActiveTab("reports")}
                      >
                        View Details
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="empty-mini">No reports released yet.</div>
                )}
              </div>
              <div className="info-card next-class-card">
                <h3>🚀 Next Class</h3>
                {assignedClass ? (
                  <div className="nc-details">
                    <div className="nc-row">
                      <span className="nc-label">Class:</span>
                      <span className="nc-val">{assignedClass.className}</span>
                    </div>
                    <div className="nc-row">
                      <span className="nc-label">Time:</span>
                      <span className="nc-val highlight">
                        {getNextClass()?.day} @ {getNextClass()?.time}
                      </span>
                    </div>
                    {assignedClass.meetingLink ? (
                      <a
                        href={assignedClass.meetingLink}
                        target="_blank"
                        rel="noreferrer"
                        className="join-btn"
                      >
                        Join Zoom Class
                      </a>
                    ) : (
                      <button className="join-btn disabled" disabled>
                        No Link Yet
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="empty-mini">
                    No class assigned yet. Contact Admin.
                  </div>
                )}
              </div>
              <div className="info-card fee-card">
                <h3>💳 Fee Status</h3>
                <div className={`fee-status-badge ${getPaymentStatus().color}`}>
                  {getPaymentStatus().status}
                </div>
                <p className="fee-note">
                  {getPaymentStatus().status === "Paid"
                    ? "All caught up!"
                    : "Please clear dues."}
                </p>
              </div>
              <div className="info-card profile-card">
                <h3>👤 Student Details</h3>
                <div className="detail-row">
                  <span className="lbl">Student ID:</span>
                  <span className="val">{currentUser.username}</span>
                </div>
                <div className="detail-row">
                  <span className="lbl">Date of Birth:</span>
                  <span className="val">
                    {studentProfile?.childDob
                      ? new Date(studentProfile.childDob).toLocaleDateString()
                      : "N/A"}
                  </span>
                </div>
                <div className="detail-row">
                  <span className="lbl">Parent Phone:</span>
                  <span className="val">
                    {studentProfile?.phone || currentUser.phone}
                  </span>
                </div>
                <div className="detail-row">
                  <span className="lbl">Class Level:</span>
                  <span className="val tag">
                    {assignedClass ? (
                      <>
                        {assignedClass.level}
                        {assignedClass.subLevel &&
                          ` - ${assignedClass.subLevel}`}
                      </>
                    ) : (
                      "N/A"
                    )}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* 2. SCHEDULE */}
          {activeTab === "schedule" && (
            <div className="schedule-view">
              {assignedClass ? (
                <div className="class-detail-card">
                  <div className="cdc-header">
                    <div>
                      <h2>{assignedClass.className}</h2>
                      <p>
                        Teacher:{" "}
                        {assignedClass.teacher?.fullName || "Not Assigned"}
                      </p>
                    </div>
                    <span className="level-tag">{assignedClass.level}</span>
                  </div>
                  <div className="cdc-grid">
                    {assignedClass.schedule.map((slot, idx) => (
                      <div key={idx} className="slot-item">
                        <span className="slot-day">{slot.day}</span>
                        <span className="slot-time">{slot.time}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="empty-state">
                  No class assigned. Please contact admin.
                </div>
              )}
            </div>
          )}

          {/* 3. REPORTS */}
          {activeTab === "reports" && (
            <div className="reports-view">
              {reports.length === 0 ? (
                <div className="empty-state">No reports received yet.</div>
              ) : (
                <div className="reports-list">
                  {reports.map((rep) => (
                    <div key={rep._id} className="report-card">
                      <div className="rc-header">
                        <span className="rc-month">{rep.month} Report</span>
                        <div className="rc-rating">
                          {"★".repeat(rep.rating)}
                        </div>
                      </div>
                      <div className="rc-body">
                        <p>"{rep.feedbackText}"</p>
                      </div>
                      <div className="rc-footer">
                        <span className="rc-teacher">
                          By: Thevenkyart Art Academy
                        </span>
                        {rep.reportFile && (
                          <a
                            href={`https://art-portal-7n6r.onrender.com/${rep.reportFile}`}
                            target="_blank"
                            rel="noreferrer"
                            className="download-pdf-btn"
                          >
                            📄 View PDF
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 4. ATTENDANCE */}
          {activeTab === "attendance" && (
            <div className="att-history-view">
              <div className="att-header-row">
                <h3>Monthly Log</h3>
                <div className="month-nav-mini">
                  <button onClick={() => changeAttendanceMonth(-1)}>‹</button>
                  <span>{formatMonthName(attendanceMonth)}</span>
                  <button onClick={() => changeAttendanceMonth(1)}>›</button>
                </div>
              </div>
              <div className="att-summary-bar">
                <div className="as-item">
                  <span className="as-label">Attended</span>
                  <span className="as-val green">{attStats.present}</span>
                </div>
                <div className="as-item">
                  <span className="as-label">Target</span>
                  <span className="as-val">{attStats.target}</span>
                </div>
                <div className="as-item">
                  <span className="as-label">Performance</span>
                  <span
                    className={`as-val ${attStats.percentage < 100 ? "red" : "green"}`}
                  >
                    {attStats.percentage}%
                  </span>
                </div>
              </div>
              <div className="att-table-wrapper">
                {attStats.records.length === 0 ? (
                  <div className="empty-state">
                    No attendance records for {formatMonthName(attendanceMonth)}
                    .
                  </div>
                ) : (
                  <table className="att-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Day</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {attStats.records.map((rec) => (
                        <tr key={rec._id}>
                          <td>{rec.date}</td>
                          <td>
                            {new Date(rec.date).toLocaleDateString("en-US", {
                              weekday: "long",
                            })}
                          </td>
                          <td>
                            <span
                              className={`status-pill ${rec.status.toLowerCase()}`}
                            >
                              {rec.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {/* 5. FEES */}
          {activeTab === "fees" && (
            <div className="fees-view">
              <div className="fee-table-wrapper">
                <table className="fee-table">
                  <thead>
                    <tr>
                      <th>Month</th>
                      <th>Amount</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {studentProfile?.payments?.length > 0 ? (
                      studentProfile.payments.map((pay, idx) => (
                        <tr key={idx}>
                          <td>{pay.month}</td>
                          <td>₹{pay.amount}</td>
                          <td>
                            <span
                              className={`fee-pill ${pay.status.toLowerCase()}`}
                            >
                              {pay.status}
                            </span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td
                          colSpan="3"
                          style={{ textAlign: "center", padding: "20px" }}
                        >
                          No payment history found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 6. REFERRAL TAB */}
          {activeTab === "refer" && (
            <div className="referral-view">
              <div className="referral-grid">
                {/* LEFT: Institute Profile Card */}
                <div className="referral-card institute-card">
                  <div className="inst-cover"></div>
                  <div className="inst-body">
                    {/* ✨ UPDATED REFERRAL LOGO IMAGE */}
                    <img
                      src={logoImg}
                      alt="Venky Art Logo"
                      className="inst-logo-img"
                    />
                    <img
                      src={titleImg}
                      alt="Venky Art Academy"
                      className="inst-title-img"
                    />
                    <p className="inst-tagline">
                      "Unleashing Creativity in Every Child"
                    </p>
                    <div className="inst-details">
                      <div className="id-row">
                        <span>🌐</span>{" "}
                        <a
                          href="https://thevenkyart.com"
                          target="_blank"
                          rel="noreferrer"
                        >
                          thevenkyart.com
                        </a>
                      </div>
                      <div className="id-row">
                        <span>📧</span> <span>thevenkyart@gmail.com</span>
                      </div>
                      <div className="id-row">
                        <span>📞</span> <span>+91 9963613404</span>
                      </div>
                      <div className="id-row">
                        <span>📍</span> <span>Hyderabad, Telangana</span>
                      </div>
                    </div>
                    <div className="inst-desc">
                      We provide professional art training in Oil Painting,
                      Sketching, and Watercolors for students of all ages.
                    </div>
                  </div>
                </div>

                {/* RIGHT: Share Actions */}
                <div className="referral-card action-card">
                  <h3>Spread the Word!</h3>
                  <p className="action-desc">
                    Love our classes? Refer a friend or family member and let
                    them experience the joy of art.
                  </p>

                  <div className="referral-code-box">
                    <span className="rc-label">Your Referral Code</span>
                    <div className="code-display">{currentUser.username}</div>
                  </div>

                  <div className="share-buttons">
                    <button
                      className="share-btn whatsapp"
                      onClick={() => handleShare("whatsapp")}
                    >
                      <span>💬</span> Share via WhatsApp
                    </button>
                    <button
                      className="share-btn copy"
                      onClick={() => handleShare("copy")}
                    >
                      <span>📋</span> {copyFeedback}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default ParentDashboard;