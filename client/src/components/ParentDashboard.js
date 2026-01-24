// src/components/ParentDashboard.js
import React, { useState, useEffect, useRef } from 'react'; // ✨ Import useRef
import axios from 'axios';
import './ParentDashboard.css';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

import logoImg from './new-logo.png'; 
import titleImg from './logo-title-copy.png';
import bannerImg from './banner4.png';
import bannerMobile from './banner-001.png';

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

  // State for Mobile Sidebar Toggle
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  // ✨ FIX 1: Use useRef for Swipe (Prevents Page Reload on Touch)
  const touchStart = useRef(null);
  const touchEndY = useRef(null);
  const touchEnd = useRef(null);
  const minSwipeDistance = 50;

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
    
    // ✨ FIX 4: Count Absent Classes too
    const presentCount = currentMonthRecords.filter(r => r.status === 'Present').length;
    const absentCount = currentMonthRecords.filter(r => r.status === 'Absent').length;
    
    const targetClasses = studentProfile?.monthlyClassesTarget || 8; 
    let percentage = Math.round((presentCount / targetClasses) * 100);
    if (percentage > 100) percentage = 100;

    return { 
      present: presentCount, 
      absent: absentCount, // Return absent count
      target: targetClasses, 
      percentage, 
      records: currentMonthRecords 
    };
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

  const handleNavClick = (tab) => {
    setActiveTab(tab);
    setIsSidebarOpen(false);
  };

  // ✨ FIX 2: Updated Swipe Logic (Uses refs instead of state)
  const onTouchStart = (e) => {
    touchEnd.current = null;
    touchStart.current = e.targetTouches[0].clientX;
    touchEndY.current = e.targetTouches[0].clientY;
  };

  const onTouchMove = (e) => {
    touchEnd.current = e.targetTouches[0].clientX;
  };

  const onTouchEnd = (e) => {
    if (!touchStart.current || !touchEnd.current) return;
    const distanceX = touchStart.current - touchEnd.current;
    
    // Ignore swipe if user is scrolling up/down
    const endY = e.changedTouches[0].clientY;
    if (Math.abs(touchEndY.current - endY) > 50) return; 

    if (distanceX < -minSwipeDistance && touchStart.current < 100) setIsSidebarOpen(true);
    if (distanceX > minSwipeDistance && isSidebarOpen) setIsSidebarOpen(false);
  };

  if (loading) {
    return (
      <div className="art-loading-screen">
        <div className="paint-loader">
          <div className="paint-drop red"></div>
          <div className="paint-drop yellow"></div>
          <div className="paint-drop blue"></div>
          <div className="paint-drop green"></div>
        </div>
        <p className="loading-text">Curating your child's artistic journey...</p>
      </div>
    );
  }

  const attStats = calculateAttendanceStats();

  // ✨ FIX 4: Update Chart Data to include Absent
  const chartData = [
    { name: 'Attended', value: attStats.present, color: '#2563eb' }, // Blue
    { name: 'Absent', value: attStats.absent, color: '#ef4444' },    // Red
    { name: 'Remaining', value: Math.max(0, attStats.target - attStats.present - attStats.absent), color: '#e2e8f0' } // Grey
  ];

  return (
    <div 
      className="parent-container"
      onTouchStart={onTouchStart} 
      onTouchMove={onTouchMove} 
      onTouchEnd={onTouchEnd}
    >
      <div className={`mobile-overlay ${isSidebarOpen ? 'open' : ''}`} onClick={() => setIsSidebarOpen(false)}></div>

      <aside className={`parent-sidebar ${isSidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <img src={logoImg} alt="Venky Art Logo" className="sidebar-logo-img" />
          <img src={titleImg} alt="Venky Art" className="sidebar-title-img" />
        </div>
        <div className="p-nav">
          <button className={activeTab === "overview" ? "active" : ""} onClick={() => handleNavClick("overview")}><span>📊</span> Overview</button>
          <button className={activeTab === "schedule" ? "active" : ""} onClick={() => handleNavClick("schedule")}><span>🗓️</span> Class Schedule</button>
          <button className={activeTab === "reports" ? "active" : ""} onClick={() => handleNavClick("reports")}><span>📝</span> Academic Reports</button>
          <button className={activeTab === "attendance" ? "active" : ""} onClick={() => handleNavClick("attendance")}><span>📅</span> Attendance Log</button>
          <button className={activeTab === "fees" ? "active" : ""} onClick={() => handleNavClick("fees")}><span>💳</span> Fee Status</button>
          <button className={activeTab === "refer" ? "active" : ""} onClick={() => handleNavClick("refer")}><span>📣</span> Refer and support</button>
        </div>
        <div className="sidebar-footer">
          <p>© 2026 Thevenkyart Art Academy</p>
        </div>
      </aside>

      <main className="parent-main">
        <header className="p-header">
          <button className="mobile-menu-btn" onClick={(e) => { e.stopPropagation(); setIsSidebarOpen(true); }}>☰</button>
          <div className="p-header-left">
            <h2>{activeTab === "overview" ? "My Dashboard" : activeTab === "refer" ? "Refer a Friend" : activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}</h2>
          </div>
          <div className="p-header-right">
            <span className="role-badge desktop-only">Parent</span>
            <div className="header-profile">
              <div className="avatar">{currentUser.fullName?.charAt(0)}</div>
            </div>
            
            {/* ✨ FIX 3: Logout Button with SVG Icon (Fixes Android display) */}
            <button className="logout-btn" onClick={() => setShowLogoutModal(true)}>
              <span className="desktop-text">Logout</span>
              <span className="mobile-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18.36 6.64a9 9 0 1 1-12.73 0"></path>
                  <line x1="12" y1="2" x2="12" y2="12"></line>
                </svg>
              </span>
            </button>
          </div>
        </header>

         <div className="p-content">
          {/* 1. OVERVIEW */}
          {activeTab === "overview" && (
            <div className="overview-grid">
              <div className="welcome-card" style={{ '--desktop-bg': `url(${bannerImg})`, '--mobile-bg': `url(${bannerMobile})` }}>
                <div className="wc-text">
                  <h1>Hello, {currentUser.fullName}!</h1>
                  <p>Here is a quick summary of your child <strong>{currentUser.childName}'s</strong> progress at Thevenkyart Art Academy.</p>
                </div>
              </div>
              
              <div className="info-card attendance-card">
                 <h3 onClick={() => setActiveTab('attendance')} className="clickable-heading">📅 Attendance</h3>
                <div style={{ width: "100%", height: "140px", position: "relative", marginTop: "10px" }}>
                  <ResponsiveContainer>
                    <PieChart>
                      {/* ✨ FIX 4 & Performance: Include Absent data & Disable Animation */}
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
                        isAnimationActive={false} 
                      >
                        {chartData.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.color} />))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", textAlign: "center" }}>
                    <span style={{ fontSize: "1.4rem", fontWeight: "800", color: "#1e293b" }}>{attStats.percentage}%</span>
                  </div>
                </div>
                <div className="att-details-text">
                  <div className="ad-row"><span>Attended:</span><strong className="green">{attStats.present} Classes</strong></div>
                  {/* ✨ New Absent Row */}
                  <div className="ad-row"><span>Absent:</span><strong className="red">{attStats.absent} Classes</strong></div>
                  <div className="ad-row"><span>Total Target:</span><strong>{attStats.target} Classes</strong></div>
                </div>
              </div>

              <div className="info-card report-preview-card">
                <h3 onClick={() => setActiveTab('reports')} className="clickable-heading">📝 Latest Report</h3>
                {reports.length > 0 ? (
                  <div className="latest-report-box">
                    <div className="lrb-header">
                      <span className="lrb-month">{reports[0].month}</span>
                      <span className="lrb-rating">{"★".repeat(reports[0].rating)}</span>
                    </div>
                    <p className="lrb-text">"{reports[0].feedbackText.substring(0, 60)}..."</p>
                    {reports[0].reportFile ? (
                      <a href={`https://art-portal-7n6r.onrender.com/${reports[0].reportFile}`} target="_blank" rel="noreferrer" className="mini-link-btn">📄 View PDF</a>
                    ) : (
                      <button className="mini-link-btn" onClick={() => setActiveTab("reports")}>View Details</button>
                    )}
                  </div>
                ) : (
                  <div className="empty-mini">No reports released yet.</div>
                )}
              </div>

              <div className="info-card next-class-card">
                <h3 onClick={() => setActiveTab('schedule')} className="clickable-heading">🚀 Next Class</h3>
                {assignedClass ? (
                  <div className="nc-details">
                    <div className="nc-row"><span className="nc-label">Class:</span><span className="nc-val">{assignedClass.className}</span></div>
                    <div className="nc-row"><span className="nc-label">Time:</span><span className="nc-val highlight">{getNextClass()?.day} @ {getNextClass()?.time}</span></div>
                    {assignedClass.meetingLink ? (
                      <a href={assignedClass.meetingLink} target="_blank" rel="noreferrer" className="join-btn">Join Zoom Class</a>
                    ) : (
                      <button className="join-btn disabled" disabled>No Link Yet</button>
                    )}
                  </div>
                ) : (
                  <div className="empty-mini">No class assigned yet. Contact Admin.</div>
                )}
              </div>

              <div className="info-card fee-card">
                <h3 onClick={() => setActiveTab('fees')} className="clickable-heading">💳 Fee Status</h3>
                <div className={`fee-status-badge ${getPaymentStatus().color}`}>{getPaymentStatus().status}</div>
                <p className="fee-note">{getPaymentStatus().status === "Paid" ? "All caught up!" : "Please clear dues."}</p>
              </div>

              <div className="info-card profile-card">
                <h3>👤 Student Details</h3>
                <div className="detail-row"><span className="lbl">Student ID:</span><span className="val">{currentUser.username}</span></div>
                <div className="detail-row"><span className="lbl">Date of Birth:</span><span className="val">{studentProfile?.childDob ? new Date(studentProfile.childDob).toLocaleDateString() : "N/A"}</span></div>
                <div className="detail-row"><span className="lbl">Parent Phone:</span><span className="val">{studentProfile?.phone || currentUser.phone}</span></div>
                <div className="detail-row">
                  <span className="lbl">Class Level:</span>
                  <span className="val tag">{assignedClass ? <>{assignedClass.level}{assignedClass.subLevel && ` - ${assignedClass.subLevel}`}</> : "N/A"}</span>
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
                    <div><h2>{assignedClass.className}</h2><p>Teacher: {assignedClass.teacher?.fullName || "Not Assigned"}</p></div>
                    <span className="level-tag">{assignedClass.level}</span>
                  </div>
                  <div className="cdc-grid">
                    {assignedClass.schedule.map((slot, idx) => (
                      <div key={idx} className="slot-item"><span className="slot-day">{slot.day}</span><span className="slot-time">{slot.time}</span></div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="empty-state">No class assigned. Please contact admin.</div>
              )}
            </div>
          )}

          {/* 3. REPORTS */}
          {activeTab === "reports" && (
            <div className="reports-view">
              {reports.length === 0 ? <div className="empty-state">No reports received yet.</div> : (
                <div className="reports-list">
                  {reports.map((rep) => (
                    <div key={rep._id} className="report-card">
                      <div className="rc-header"><span className="rc-month">{rep.month} Report</span><div className="rc-rating">{"★".repeat(rep.rating)}</div></div>
                      <div className="rc-body"><p>"{rep.feedbackText}"</p></div>
                      <div className="rc-footer"><span className="rc-teacher">By: Thevenkyart Art Academy</span>{rep.reportFile && (<a href={`https://art-portal-7n6r.onrender.com/${rep.reportFile}`} target="_blank" rel="noreferrer" className="download-pdf-btn">📄 View PDF</a>)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 4. ATTENDANCE */}
          {activeTab === "attendance" && (
            <div className="att-history-view">
              <div className="att-header-row"><h3>Monthly Log</h3><div className="month-nav-mini"><button onClick={() => changeAttendanceMonth(-1)}>‹</button><span>{formatMonthName(attendanceMonth)}</span><button onClick={() => changeAttendanceMonth(1)}>›</button></div></div>
              <div className="att-summary-bar">
                <div className="as-item"><span className="as-label">Attended</span><span className="as-val green">{attStats.present}</span></div>
                 {/* ✨ Added Absent Stat */}
                <div className="as-item"><span className="as-label">Absent</span><span className="as-val red">{attStats.absent}</span></div>
                <div className="as-item"><span className="as-label">Target</span><span className="as-val">{attStats.target}</span></div>
              </div>
              <div className="att-table-wrapper">
                {attStats.records.length === 0 ? <div className="empty-state">No attendance records for {formatMonthName(attendanceMonth)}.</div> : (
                  <table className="att-table">
                    <thead><tr><th>Date</th><th>Day</th><th>Status</th></tr></thead>
                    <tbody>
                      {attStats.records.map((rec) => (
                        <tr key={rec._id}>
                          <td>{rec.date}</td>
                          <td>{new Date(rec.date).toLocaleDateString("en-US", { weekday: "long" })}</td>
                          <td><span className={`status-pill ${rec.status.toLowerCase()}`}>{rec.status}</span></td>
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
                  <thead><tr><th>Month</th><th>Amount</th><th>Status</th></tr></thead>
                  <tbody>
                    {studentProfile?.payments?.length > 0 ? (
                      studentProfile.payments.map((pay, idx) => (
                        <tr key={idx}><td>{pay.month}</td><td>₹{pay.amount}</td><td><span className={`fee-pill ${pay.status.toLowerCase()}`}>{pay.status}</span></td></tr>
                      ))
                    ) : (
                      <tr><td colSpan="3" style={{ textAlign: "center", padding: "20px" }}>No payment history found.</td></tr>
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
                <div className="referral-card institute-card">
                  <div className="inst-cover"></div>
                  <div className="inst-body">
                    <img src={logoImg} alt="Venky Art Logo" className="inst-logo-img" />
                    <img src={titleImg} alt="Venky Art Academy" className="inst-title-img" />
                    <p className="inst-tagline">"Unleashing Creativity in Every Child"</p>
                    <div className="inst-details">
                      <div className="id-row"><span>🌐</span> <a href="https://thevenkyart.com" target="_blank" rel="noreferrer">thevenkyart.com</a></div>
                      <div className="id-row"><span>📧</span> <span>thevenkyart@gmail.com</span></div>
                      <div className="id-row"><span>📞</span> <span>+91 9963613404</span></div>
                      <div className="id-row"><span>📍</span> <span>Hyderabad, Telangana</span></div>
                    </div>
                    <div className="inst-desc">We provide professional art training in Oil Painting, Sketching, and Watercolors for students of all ages.</div>
                  </div>
                </div>
                <div className="referral-card action-card">
                  <h3>Spread the Word!</h3>
                  <p className="action-desc">Love our classes? Refer a friend or family member and let them experience the joy of art.</p>
                  <div className="referral-code-box"><span className="rc-label">Your Referral Code</span><div className="code-display">{currentUser.username}</div></div>
                  <div className="share-buttons">
                    <button className="share-btn whatsapp" onClick={() => handleShare("whatsapp")}><span>💬</span> Share via WhatsApp</button>
                    <button className="share-btn copy" onClick={() => handleShare("copy")}><span>📋</span> {copyFeedback}</button>
                  </div>
                </div>
              </div>
            </div>
          )}
         </div>
      </main>

      {/* CONFIRMATION POPUP (MODAL) */}
      {showLogoutModal && (
        <div className="logout-modal-overlay">
          <div className="logout-modal">
            <h3 className="lm-title">Confirm Logout</h3>
            <p className="lm-text">Are you sure you want to exit?</p>
            <div className="lm-actions">
              <button className="lm-btn cancel" onClick={() => setShowLogoutModal(false)}>
                Cancel
              </button>
              <button className="lm-btn confirm" onClick={onLogout}>
                Yes, Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ParentDashboard;