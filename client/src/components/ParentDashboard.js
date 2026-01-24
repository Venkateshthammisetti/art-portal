// src/components/ParentDashboard.js
import React, { useState, useEffect, useRef } from 'react';
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
  
  // Modals & Menus
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  // Theme State
  const [theme, setTheme] = useState(localStorage.getItem('appTheme') || 'light');

  // Swipe Refs
  const touchStart = useRef(null);
  const touchEndY = useRef(null);
  const touchEnd = useRef(null);
  const minSwipeDistance = 50;

  useEffect(() => {
    if (currentUser?._id) fetchParentData();
  }, [currentUser]);

  useEffect(() => {
    document.body.className = theme; 
    localStorage.setItem('appTheme', theme); 
  }, [theme]);

  useEffect(() => {
    const handleBackButton = (event) => {
      if (activeTab !== 'overview') {
        setActiveTab('overview');
      }
    };
    const handleClickOutside = (event) => {
      if (showProfileMenu && !event.target.closest('.header-profile') && !event.target.closest('.profile-dropdown')) {
        setShowProfileMenu(false);
      }
    };
    window.addEventListener('popstate', handleBackButton);
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      window.removeEventListener('popstate', handleBackButton);
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [activeTab, showProfileMenu]);

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
  
  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  // 1. Compact Date (01-2026) - Used for Month Nav
  const formatMonthName = (isoStr) => {
    if (!isoStr) return "N/A";
    if (isoStr.includes('-')) {
        const parts = isoStr.split('-');
        if (parts.length >= 2) {
           return `${parts[1]}-${parts[0]}`; 
        }
    }
    return isoStr; 
  };

  // 2. Full Month Date (January-2026) - Used for Fee Status & Reports
  const formatFullMonthDate = (isoStr) => {
    if (!isoStr) return "N/A";
    const [year, month] = isoStr.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleString('default', { month: 'long' }) + '-' + year;
  };

  // ✨ 3. NEW: Day-Month-Year (17-01-2026) - Used for Attendance Table
  const formatDateDDMMYYYY = (isoDate) => {
    if (!isoDate) return "N/A";
    const date = new Date(isoDate);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  };

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
    const absentCount = currentMonthRecords.filter(r => r.status === 'Absent').length;
    const targetClasses = studentProfile?.monthlyClassesTarget || 8; 
    let percentage = Math.round((presentCount / targetClasses) * 100);
    if (percentage > 100) percentage = 100;
    return { present: presentCount, absent: absentCount, target: targetClasses, percentage, records: currentMonthRecords };
  };

  const changeAttendanceMonth = (offset) => {
    const [year, month] = attendanceMonth.split('-').map(Number);
    const date = new Date(year, month - 1 + offset, 1);
    setAttendanceMonth(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
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
    if (activeTab === 'overview' && tab !== 'overview') {
      window.history.pushState(null, '', window.location.pathname);
    }
    setActiveTab(tab);
    setShowProfileMenu(false); 
  };

  const onTouchStart = (e) => {
    touchEnd.current = null;
    touchStart.current = e.targetTouches[0].clientX;
    touchEndY.current = e.targetTouches[0].clientY;
  };
  const onTouchMove = (e) => { touchEnd.current = e.targetTouches[0].clientX; };
  const onTouchEnd = (e) => {
    if (!touchStart.current || !touchEnd.current) return;
    const endY = e.changedTouches[0].clientY;
    if (Math.abs(touchEndY.current - endY) > 50) return; 
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
  const chartData = [
    { name: 'Attended', value: attStats.present, color: '#2563eb' }, 
    { name: 'Absent', value: attStats.absent, color: '#ef4444' },    
    { name: 'Remaining', value: Math.max(0, attStats.target - attStats.present - attStats.absent), color: '#e2e8f0' }
  ];

  return (
    <div className={`parent-container ${theme}`} onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
      
      <aside className="parent-sidebar">
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
        <div className="sidebar-footer"><p>© 2026 Thevenkyart Art Academy</p></div>
      </aside>

      <main className="parent-main">
        <header className="p-header">
          <div className="p-header-left">
            <h2>{activeTab === "overview" ? "My Dashboard" : activeTab === "refer" ? "Refer a Friend" : activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}</h2>
          </div>
          <div className="p-header-right">
            <span className="role-badge desktop-only">Parent</span>
            
            <div className="header-profile" onClick={() => setShowProfileMenu(!showProfileMenu)}>
              <div className="avatar">{currentUser.fullName?.charAt(0)}</div>
            </div>

            {showProfileMenu && (
              <div className="profile-dropdown">
                <div className="pd-header">
                  <strong>{currentUser.fullName}</strong>
                  <span>{currentUser.username}</span>
                </div>
                
                <div className="pd-refer-box">
                  <span>Your Referral Code</span>
                  <code>{currentUser.username}</code>
                </div>

                <button className="pd-menu-btn theme-toggle" onClick={toggleTheme}>
                  {theme === 'light' ? '🌙 Dark Mode' : '☀️ Light Mode'}
                </button>

                <button className="pd-menu-btn" onClick={() => handleNavClick('refer')}>
                  📣 Refer & Support
                </button>
              </div>
            )}

            <button className="logout-btn" onClick={() => setShowLogoutModal(true)}>
              <span className="desktop-text">Logout</span>
              <span className="mobile-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"></path><line x1="12" y1="2" x2="12" y2="12"></line></svg>
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
                 <h3 onClick={() => handleNavClick('attendance')} className="clickable-heading">📅 Attendance</h3>
                <div style={{ width: "100%", height: "140px", position: "relative", marginTop: "10px" }}>
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie data={chartData} cx="50%" cy="50%" innerRadius={45} outerRadius={60} startAngle={90} endAngle={-270} dataKey="value" stroke="none" isAnimationActive={false}>
                        {chartData.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.color} />))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", textAlign: "center" }}>
                    <span style={{ fontSize: "1.4rem", fontWeight: "800", color: theme === 'dark' ? '#f1f5f9' : '#1e293b' }}>{attStats.percentage}%</span>
                  </div>
                </div>
                <div className="att-details-text">
                  <div className="ad-row"><span>Attended:</span><strong className="green">{attStats.present} Classes</strong></div>
                  <div className="ad-row"><span>Absent:</span><strong className="red">{attStats.absent} Classes</strong></div>
                  <div className="ad-row"><span>Total Target:</span><strong>{attStats.target} Classes</strong></div>
                </div>
              </div>
              <div className="info-card report-preview-card">
                <h3 onClick={() => handleNavClick('reports')} className="clickable-heading">📝 Latest Report</h3>
                {reports.length > 0 ? (
                  <div className="latest-report-box">
                    <div className="lrb-header">
                      <span className="lrb-month">{formatFullMonthDate(reports[0].month)} Report</span>
                      <span className="lrb-rating">{"★".repeat(reports[0].rating)}</span>
                    </div>
                    <p className="lrb-text">"{reports[0].feedbackText.substring(0, 60)}..."</p>
                    {reports[0].reportFile ? (<a href={`https://art-portal-7n6r.onrender.com/${reports[0].reportFile}`} target="_blank" rel="noreferrer" className="mini-link-btn">📄 View PDF</a>) : (<button className="mini-link-btn" onClick={() => handleNavClick("reports")}>View Details</button>)}
                  </div>
                ) : (<div className="empty-mini">No reports released yet.</div>)}
              </div>
              <div className="info-card next-class-card">
                <h3 onClick={() => handleNavClick('schedule')} className="clickable-heading">🚀 Next Class</h3>
                {assignedClass ? (
                  <div className="nc-details">
                    <div className="nc-row"><span className="nc-label">Class:</span><span className="nc-val">{assignedClass.className}</span></div>
                    <div className="nc-row"><span className="nc-label">Time:</span><span className="nc-val highlight">{getNextClass()?.day} @ {getNextClass()?.time}</span></div>
                    {assignedClass.meetingLink ? (<a href={assignedClass.meetingLink} target="_blank" rel="noreferrer" className="join-btn">Join Zoom Class</a>) : (<button className="join-btn disabled" disabled>No Link Yet</button>)}
                  </div>
                ) : (<div className="empty-mini">No class assigned yet. Contact Admin.</div>)}
              </div>
              <div className="info-card fee-card">
                <h3 onClick={() => handleNavClick('fees')} className="clickable-heading">💳 Fee Status</h3>
                <div className={`fee-status-badge ${getPaymentStatus().color}`}>{getPaymentStatus().status}</div>
                <p className="fee-note">{getPaymentStatus().status === "Paid" ? "All caught up!" : "Please clear dues."}</p>
              </div>
              <div className="info-card profile-card">
                <h3>👤 Student Details</h3>
                <div className="detail-row"><span className="lbl">Student ID:</span><span className="val">{currentUser.username}</span></div>
                <div className="detail-row"><span className="lbl">Date of Birth:</span><span className="val">{studentProfile?.childDob ? new Date(studentProfile.childDob).toLocaleDateString() : "N/A"}</span></div>
                <div className="detail-row"><span className="lbl">Parent Phone:</span><span className="val">{studentProfile?.phone || currentUser.phone}</span></div>
                <div className="detail-row"><span className="lbl">Class Level:</span><span className="val tag">{assignedClass ? <>{assignedClass.level}{assignedClass.subLevel && ` - ${assignedClass.subLevel}`}</> : "N/A"}</span></div>
              </div>
            </div>
          )}

          {/* 2. SCHEDULE */}
          {activeTab === "schedule" && (
            <div className="schedule-view">
              {assignedClass ? (
                <div className="class-detail-card">
                  <div className="cdc-header"><div><h2>{assignedClass.className}</h2><p>Teacher: {assignedClass.teacher?.fullName || "Not Assigned"}</p></div><span className="level-tag">{assignedClass.level}</span></div>
                  <div className="cdc-grid">
                    {assignedClass.schedule.map((slot, idx) => (<div key={idx} className="slot-item"><span className="slot-day">{slot.day}</span><span className="slot-time">{slot.time}</span></div>))}
                  </div>
                </div>
              ) : (<div className="empty-state">No class assigned. Please contact admin.</div>)}
            </div>
          )}

          {/* 3. REPORTS */}
          {activeTab === "reports" && (
            <div className="reports-view">
              {reports.length === 0 ? <div className="empty-state">No reports received yet.</div> : (
                <div className="reports-list">
                  {reports.map((rep) => (
                    <div key={rep._id} className="report-card">
                      <div className="rc-header">
                        <span className="rc-month">{formatFullMonthDate(rep.month)} Report</span>
                        <div className="rc-rating">{"★".repeat(rep.rating)}</div>
                      </div>
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
              {/* Header still uses MM-YYYY */}
              <div className="att-header-row"><h3>Monthly Log</h3><div className="month-nav-mini"><button onClick={() => changeAttendanceMonth(-1)}>‹</button><span>{formatMonthName(attendanceMonth)}</span><button onClick={() => changeAttendanceMonth(1)}>›</button></div></div>
              <div className="att-summary-bar">
                <div className="as-item"><span className="as-label">Attended</span><span className="as-val green">{attStats.present}</span></div>
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
                          {/* ✨ UPDATED: Table date uses DD-MM-YYYY */}
                          <td>{formatDateDDMMYYYY(rec.date)}</td>
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
                        <tr key={idx}>
                          {/* ✨ UPDATED: Fee Status uses Full Month */}
                          <td>{formatFullMonthDate(pay.month)}</td>
                          <td>₹{pay.amount}</td>
                          <td><span className={`fee-pill ${pay.status.toLowerCase()}`}>{pay.status}</span></td>
                        </tr>
                      ))
                    ) : (<tr><td colSpan="3" style={{ textAlign: "center", padding: "20px" }}>No payment history found.</td></tr>)}
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

      <nav className="mobile-bottom-nav">
        <button className={activeTab === 'overview' ? 'nav-item active' : 'nav-item'} onClick={() => handleNavClick('overview')}>
          <svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>
        </button>
        
        <button className={activeTab === 'schedule' ? 'nav-item active' : 'nav-item'} onClick={() => handleNavClick('schedule')}>
          <svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M17 12h-5v5h5v-5zM16 1v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19a2 2 0 0 0 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2h-1V1h-2zm3 18H5V8h14v11z"/></svg>
        </button>
        
        <button className={activeTab === 'reports' ? 'nav-item active' : 'nav-item'} onClick={() => handleNavClick('reports')}>
          <svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>
        </button>

        <button className={activeTab === 'attendance' ? 'nav-item active' : 'nav-item'} onClick={() => handleNavClick('attendance')}>
           <svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M19 3h-4.18C14.4 1.84 13.3 1 12 1c-1.3 0-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm-2 14l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z"/></svg>
        </button>

        <button className={activeTab === 'fees' ? 'nav-item active' : 'nav-item'} onClick={() => handleNavClick('fees')}>
          <svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M20 4H4c-1.11 0-1.99.89-1.99 2L2 18c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V6c0-1.11-.89-2-2-2zm0 14H4v-6h16v6zm0-10H4V6h16v2z"/></svg>
        </button>
      </nav>

      {showLogoutModal && (
        <div className="logout-modal-overlay">
          <div className="logout-modal">
            <h3 className="lm-title">Confirm Logout</h3>
            <p className="lm-text">Are you sure you want to exit?</p>
            <div className="lm-actions">
              <button className="lm-btn cancel" onClick={() => setShowLogoutModal(false)}>Cancel</button>
              <button className="lm-btn confirm" onClick={onLogout}>Yes, Logout</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ParentDashboard;