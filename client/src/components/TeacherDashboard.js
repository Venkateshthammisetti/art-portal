// src/components/TeacherDashboard.js
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './TeacherDashboard.css';

const TeacherDashboard = ({ user, onLogout }) => {
  const currentUser = user;

  // --- STATE ---
  const [activeTab, setActiveTab] = useState('overview'); 
  const [classes, setClasses] = useState([]);
  const [myStudents, setMyStudents] = useState([]);
  
  // Calendar & Modal
  const [currentDate, setCurrentDate] = useState(new Date());
  const [modalData, setModalData] = useState(null); 

  // --- ATTENDANCE STATE ---
  const [attendanceView, setAttendanceView] = useState('daily'); 
  const [selectedClassId, setSelectedClassId] = useState('');
  const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().slice(0, 10));
  const [attendanceList, setAttendanceList] = useState([]);
  const [attendanceStatus, setAttendanceStatus] = useState({});
  const [monthlyData, setMonthlyData] = useState([]); 
  const [daysInSelectedMonth, setDaysInSelectedMonth] = useState([]); // Dynamic Header
  const [msg, setMsg] = useState('');
  
  // Schedule Validation State
  const [isClassScheduled, setIsClassScheduled] = useState(true);
  const [forceExtraSession, setForceExtraSession] = useState(false);

  // Feedback State
  const [feedbackStudent, setFeedbackStudent] = useState('');
  const [feedbackMonth, setFeedbackMonth] = useState(new Date().toISOString().slice(0, 7));
  const [feedbackText, setFeedbackText] = useState('');
  const [rating, setRating] = useState(5);

  // --- INITIAL FETCH ---
  useEffect(() => {
    if (currentUser?._id) fetchData();
  }, [currentUser]);

  const fetchData = async () => {
    try {
      const classRes = await axios.get(`http://localhost:5000/api/teacher/${currentUser._id}/classes`);
      setClasses(classRes.data);
      
      const allStudents = [];
      const seenIds = new Set();
      classRes.data.forEach(cls => {
        cls.students.forEach(std => {
          if (!seenIds.has(std._id)) {
            seenIds.add(std._id);
            allStudents.push({ ...std, className: cls.className, level: cls.level }); 
          }
        });
      });
      setMyStudents(allStudents);
    } catch (err) { console.error(err); }
  };

  // --- HELPERS ---
  const dayNamesFull = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  const getTodayClasses = () => {
    const todayName = dayNamesFull[new Date().getDay()];
    return classes.filter(c => c.schedule.some(s => s.day === todayName));
  };

  const getUpcomingClasses = () => {
    const upcoming = [];
    const todayIndex = new Date().getDay();
    for (let i = 1; i <= 3; i++) {
      const checkDayName = dayNamesFull[(todayIndex + i) % 7];
      const foundClasses = classes.filter(c => c.schedule.some(s => s.day === checkDayName));
      foundClasses.forEach(cls => {
        upcoming.push({ ...cls, upcomingDay: checkDayName, upcomingTime: cls.schedule.find(s => s.day === checkDayName).time, isTomorrow: i === 1 });
      });
    }
    return upcoming.slice(0, 4);
  };

  // Time Table Helpers
  const getWeekDates = (baseDate) => {
    const current = new Date(baseDate);
    const day = current.getDay(); const diff = current.getDate() - day + (day === 0 ? -6 : 1);
    const week = []; for (let i = 0; i < 7; i++) { const d = new Date(current); d.setDate(diff + i); week.push(d); } return week;
  };
  const changeWeek = (offset) => { const newDate = new Date(currentDate); newDate.setDate(newDate.getDate() + (offset * 7)); setCurrentDate(newDate); };
  const timeSlots = Array.from({ length: 15 }, (_, i) => i + 7);
  const getPositionStyle = (timeStr) => { const [h, m] = timeStr.split(':').map(Number); const top = ((h - 7) * 60) + m; return { top: `${top}px`, height: '55px' }; };

  // --- ATTENDANCE LOGIC (UPDATED) ---
  
  const checkScheduleForDate = (cls, dateStr) => {
    if (!cls) return false;
    const dateObj = new Date(dateStr);
    const dayName = dayNamesFull[dateObj.getDay()];
    return cls.schedule.some(s => s.day === dayName);
  };

  const handleAttendanceControls = (classId, dateStr) => {
    setSelectedClassId(classId);
    setAttendanceDate(dateStr);
    setForceExtraSession(false);

    const cls = classes.find(c => c._id === classId);
    if (!cls) return;

    const isScheduled = checkScheduleForDate(cls, dateStr);
    setIsClassScheduled(isScheduled);
    loadAttendanceData(cls, dateStr);
  };

  const loadAttendanceData = async (cls, dateStr) => {
    setAttendanceList(cls.students);
    
    // 1. Daily Data
    try {
      const res = await axios.get(`http://localhost:5000/api/attendance/${cls._id}/${dateStr}`);
      if (res.data) {
        const map = {};
        res.data.records.forEach(r => map[r.studentId] = r.status);
        setAttendanceStatus(map);
        if (res.data.records.length > 0) setIsClassScheduled(true); 
      } else { setAttendanceStatus({}); }
    } catch (err) { console.error(err); }

    // 2. Monthly Sheet Logic (Corrected)
    const selectedDate = new Date(dateStr);
    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth(); // 0-indexed
    const numDays = new Date(year, month + 1, 0).getDate();
    
    // Set Header Array [1, 2, ..., 30]
    setDaysInSelectedMonth(Array.from({ length: numDays }, (_, i) => i + 1));

    const mockMonth = cls.students.map(s => {
      // Simulate data: Only fill up to "today" if in current month
      const history = Array.from({ length: numDays }, (_, i) => {
         const day = i + 1;
         // Simulation: Just random P/A for days < 20 (assuming today is 20th for demo)
         // In real app: check against real data
         if (day < 20) return Math.random() > 0.85 ? 'A' : 'P';
         return ''; // Empty for future/unmarked
      });
      return { ...s, history };
    });
    setMonthlyData(mockMonth);
  };

  const toggleStatus = (studentId) => {
    setAttendanceStatus(prev => ({ ...prev, [studentId]: prev[studentId] === 'Present' ? 'Absent' : 'Present' }));
  };

  const markAll = (status) => {
    const newStatus = {};
    attendanceList.forEach(s => newStatus[s._id] = status);
    setAttendanceStatus(newStatus);
  };

  const getPresentCount = () => Object.values(attendanceStatus).filter(s => s === 'Present').length;

  const submitAttendance = async () => {
    if (!selectedClassId) return;
    const records = attendanceList.map(s => ({
      studentId: s._id, studentName: s.childName, status: attendanceStatus[s._id] || 'Absent'
    }));
    try {
      await axios.post('http://localhost:5000/api/attendance', {
        date: attendanceDate, classId: selectedClassId, teacherId: currentUser._id, records
      });
      setMsg("✅ Attendance Saved!");
      setTimeout(() => setMsg(''), 3000);
    } catch (err) { alert("Error saving attendance"); }
  };

  // --- ACTIONS ---
  const sendFeedback = async (e) => { e.preventDefault(); /* ... */ setMsg("🎉 Report Sent!"); setTimeout(() => setMsg(''), 3000); };
  const handleBlockClick = (cls, time) => { setModalData({ ...cls, time }); };

  return (
    <div className="teacher-container">
      {/* SIDEBAR */}
      <aside className="teacher-sidebar">
        <div className="sidebar-header"><div className="logo-icon">VA</div><h3>Venky Art</h3></div>
        <div className="t-nav">
          <button className={activeTab === 'overview' ? 'active' : ''} onClick={() => setActiveTab('overview')}><span>📊</span> Dashboard</button>
          <button className={activeTab === 'schedule' ? 'active' : ''} onClick={() => setActiveTab('schedule')}><span>🗓️</span> My Schedule</button>
          <button className={activeTab === 'attendance' ? 'active' : ''} onClick={() => setActiveTab('attendance')}><span>📝</span> Attendance</button>
          <button className={activeTab === 'feedback' ? 'active' : ''} onClick={() => setActiveTab('feedback')}><span>💬</span> Feedback</button>
        </div>
        <button className="t-logout" onClick={onLogout}><span>🚪</span> Logout</button>
      </aside>

      {/* MAIN CONTENT */}
      <main className="teacher-main">
        <header className="t-header">
           <div className="t-header-left">
             <h2>{activeTab === 'overview' ? 'Overview' : activeTab === 'schedule' ? 'Schedule' : activeTab === 'attendance' ? 'Attendance Register' : 'Feedback'}</h2>
             <p>Welcome back, {currentUser.fullName}</p>
           </div>
           <div className="t-header-right">
              <div className="header-profile"><div className="avatar">{currentUser.fullName?.charAt(0) || 'T'}</div></div>
           </div>
        </header>

        <div className="t-content">
          {msg && <div className="success-toast">{msg}</div>}

          {/* VIEW 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="overview-view">
               <div className="hero-banner">
                  <div><h1>Dashboard Overview</h1><p>Here is what's happening in your classes today.</p></div>
                  <div className="banner-date">Today: {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</div>
               </div>
               <div className="stats-grid">
                  <div className="stat-card"><div className="icon-circle blue">🎓</div><div><div className="stat-value">{myStudents.length}</div><div className="stat-label">Total Students</div></div></div>
                  <div className="stat-card"><div className="icon-circle green">📚</div><div><div className="stat-value">{classes.length}</div><div className="stat-label">My Classes</div></div></div>
                  <div className="stat-card"><div className="icon-circle orange">⏳</div><div><div className="stat-value">{getTodayClasses().length}</div><div className="stat-label">Today's Sessions</div></div></div>
               </div>
               <h3 className="section-title">Today's Agenda</h3>
               {getTodayClasses().length === 0 ? <div className="empty-state">No classes scheduled today.</div> : (
                 <div className="today-grid">
                    {getTodayClasses().map(cls => (
                      <div key={cls._id} className="today-card">
                         <div className="tc-header"><span className="tc-time">{cls.schedule.find(s => s.day === dayNamesFull[new Date().getDay()])?.time}</span><span className="tc-badge">Active</span></div>
                         <div className="tc-body"><h4>{cls.className}</h4><p>{cls.students.length} Students • {cls.level}</p></div>
                         <button onClick={() => { setActiveTab('attendance'); handleAttendanceControls(cls._id, new Date().toISOString().slice(0, 10)); }} className="tc-btn">Mark Attendance</button>
                      </div>
                    ))}
                 </div>
               )}
               <h3 className="section-title" style={{marginTop:'40px'}}>Upcoming Sessions</h3>
               {getUpcomingClasses().length === 0 ? <div className="empty-state">No upcoming classes.</div> : (
                  <div className="upcoming-list">
                     {getUpcomingClasses().map((cls, idx) => (
                        <div key={idx} className="upcoming-row">
                           <div className="uc-date"><span className="uc-day">{cls.isTomorrow ? 'Tomorrow' : cls.upcomingDay}</span></div>
                           <div className="uc-info"><h4>{cls.className}</h4><span>{cls.level}</span></div>
                           <div className="uc-time">{cls.upcomingTime}</div>
                           <div className="uc-action"><button className="icon-btn-sm" onClick={() => setActiveTab('schedule')}>🗓️</button></div>
                        </div>
                     ))}
                  </div>
               )}
            </div>
          )}

          {/* VIEW 2: SCHEDULE */}
          {activeTab === 'schedule' && (
            <div className="timetable-container">
              <div className="tt-toolbar">
                 <button className="nav-btn" onClick={() => setCurrentDate(new Date())}>Current Week</button>
                 <div className="week-nav"><button onClick={() => changeWeek(-1)}>‹ Prev</button><h3>{getWeekDates(currentDate)[0].toLocaleDateString('en-US', {month:'short', day:'numeric'})}</h3><button onClick={() => changeWeek(1)}>Next ›</button></div>
              </div>
              <div className="tt-grid-wrapper">
                 <div className="tt-time-col"><div className="tt-header-cell empty"></div>{timeSlots.map(h => <div key={h} className="tt-time-slot"><span>{h % 12 || 12} {h >= 12 ? 'PM' : 'AM'}</span></div>)}</div>
                 <div className="tt-days-area">
                    <div className="tt-header-row">{getWeekDates(currentDate).map((date, i) => <div key={i} className={`tt-header-cell ${new Date().toDateString() === date.toDateString() ? 'active' : ''}`}><span className="day-name">{dayNamesFull[date.getDay()].slice(0, 3)}</span><span className="day-num">{date.getDate()}</span></div>)}</div>
                    <div className="tt-body-row">
                       {getWeekDates(currentDate).map((date, i) => {
                          const dayName = dayNamesFull[date.getDay()];
                          const dayClasses = classes.filter(c => c.schedule.some(s => s.day === dayName));
                          return (
                            <div key={i} className="tt-day-col">
                               {timeSlots.map(t => <div key={t} className="tt-grid-line"></div>)}
                               {dayClasses.map(cls => {
                                 const schedule = cls.schedule.find(s => s.day === dayName);
                                 if (!schedule) return null;
                                 return (<div key={cls._id} className="class-block" style={getPositionStyle(schedule.time)} onClick={() => handleBlockClick(cls, schedule.time)}><div className="cb-time">{schedule.time}</div><div className="cb-title">{cls.className}</div></div>);
                               })}
                            </div>
                          );
                       })}
                    </div>
                 </div>
              </div>
            </div>
          )}

          {/* ✨ VIEW 3: UPDATED ATTENDANCE ✨ */}
          {activeTab === 'attendance' && (
            <div className="attendance-view">
               <div className="att-control-bar">
                  <div className="att-filters">
                     <div className="filter-item">
                       <label>Select Class</label>
                       <select value={selectedClassId} onChange={(e) => handleAttendanceControls(e.target.value, attendanceDate)}>
                          <option value="">-- Choose Class --</option>
                          {classes.map(c => <option key={c._id} value={c._id}>{c.className} ({c.level})</option>)}
                       </select>
                     </div>
                     {attendanceView === 'daily' && (
                       <div className="filter-item">
                         <label>Date</label>
                         <input type="date" value={attendanceDate} onChange={(e) => handleAttendanceControls(selectedClassId, e.target.value)} />
                       </div>
                     )}
                  </div>

                  <div className="view-switcher">
                     <button className={attendanceView === 'daily' ? 'active' : ''} onClick={() => setAttendanceView('daily')}>Daily Log</button>
                     <button className={attendanceView === 'monthly' ? 'active' : ''} onClick={() => setAttendanceView('monthly')}>Monthly Sheet</button>
                  </div>
               </div>

               {selectedClassId ? (
                 <>
                   {/* MODE A: DAILY LOG */}
                   {attendanceView === 'daily' && (
                     !isClassScheduled && !forceExtraSession ? (
                        <div className="schedule-warning-box animate-fade-in">
                           <div className="warning-icon">📅</div>
                           <h3>No Class Scheduled</h3>
                           <p>No <strong>{classes.find(c=>c._id===selectedClassId)?.className}</strong> class on this date.</p>
                           <button className="force-btn" onClick={() => setForceExtraSession(true)}>Mark Extra Session</button>
                        </div>
                     ) : (
                        <div className="daily-container animate-fade-in">
                           <div className="att-stats-card">
                              <div className="att-stat"><span className="label">Present</span><span className="value success">{getPresentCount()}</span></div>
                              <div className="att-divider">/</div>
                              <div className="att-stat"><span className="label">Total</span><span className="value">{attendanceList.length}</span></div>
                              <div className="att-progress-ring" style={{background: `conic-gradient(#22c55e ${(getPresentCount()/attendanceList.length)*360}deg, #e2e8f0 0deg)`}}><div className="inner">{Math.round((getPresentCount()/attendanceList.length)*100 || 0)}%</div></div>
                           </div>
                           <div className="att-toolbar">
                              <span className="toolbar-label">Quick Actions:</span>
                              <button className="bulk-btn present" onClick={() => markAll('Present')}>Mark All Present</button>
                              <button className="bulk-btn absent" onClick={() => markAll('Absent')}>Mark All Absent</button>
                           </div>
                           <div className="modern-student-list">
                              <div className="list-header-row"><div className="col-name">Student Name</div><div className="col-id">ID</div><div className="col-status">Status</div></div>
                              {attendanceList.map(s => {
                                const isPresent = attendanceStatus[s._id] === 'Present';
                                return (
                                  <div key={s._id} className={`modern-student-row ${isPresent ? 'is-present' : 'is-absent'}`} onClick={() => toggleStatus(s._id)}>
                                     <div className="col-name"><div className="s-avatar-sm">{s.childName.charAt(0)}</div>{s.childName}</div>
                                     <div className="col-id">{s.username}</div>
                                     <div className="col-status">
                                        <div className={`status-switch ${isPresent ? 'on' : 'off'}`}><div className="switch-knob"></div><span className="switch-text">{isPresent ? 'Present' : 'Absent'}</span></div>
                                     </div>
                                  </div>
                                );
                              })}
                           </div>
                           <button className="save-attendance-floating-btn" onClick={submitAttendance}>💾 Save Daily Log</button>
                        </div>
                     )
                   )}

                   {/* MODE B: MONTHLY SHEET (UPDATED) */}
                   {attendanceView === 'monthly' && (
                     <div className="monthly-sheet-container animate-fade-in">
                        <div className="sheet-wrapper">
                           <table className="sheet-table">
                              <thead>
                                 <tr>
                                    <th className="sticky-col name-col">Student Name</th>
                                    {daysInSelectedMonth.map(d => <th key={d} className="date-col">{d}</th>)}
                                    <th className="summary-col present">P</th>
                                    <th className="summary-col absent">A</th>
                                 </tr>
                              </thead>
                              <tbody>
                                 {monthlyData.map(s => {
                                    const presentCount = s.history.filter(h => h === 'P').length;
                                    const absentCount = s.history.filter(h => h === 'A').length;
                                    return (
                                       <tr key={s._id}>
                                          <td className="sticky-col name-col"><div className="row-name">{s.childName}</div></td>
                                          {s.history.map((status, idx) => (
                                             <td key={idx} className={`cell-status ${status}`}>
                                                {status} {/* Renders 'P', 'A' or empty */}
                                             </td>
                                          ))}
                                          <td className="summary-col present-val">{presentCount}</td>
                                          <td className="summary-col absent-val">{absentCount}</td>
                                       </tr>
                                    )
                                 })}
                              </tbody>
                           </table>
                        </div>
                     </div>
                   )}
                 </>
               ) : (
                 <div className="empty-state">Select a class to view registers.</div>
               )}
            </div>
          )}

          {/* VIEW 4: FEEDBACK (Unchanged) */}
          {activeTab === 'feedback' && (
            <div className="feedback-view">
               <div className="form-card">
                  <form onSubmit={sendFeedback}>
                    <div className="controls-row" style={{boxShadow:'none', padding:0, border:'none', background:'transparent'}}>
                      <div className="control-group"><label>Student</label><select value={feedbackStudent} onChange={(e) => setFeedbackStudent(e.target.value)} required><option value="">-- Choose Student --</option>{myStudents.map(s => <option key={s._id} value={s._id}>{s.childName}</option>)}</select></div>
                      <div className="control-group"><label>Month</label><input type="month" value={feedbackMonth} onChange={(e) => setFeedbackMonth(e.target.value)} required /></div>
                    </div>
                    <div className="control-group"><label>Rating</label><div className="star-rating">{[1,2,3,4,5].map(star => <span key={star} onClick={() => setRating(star)} style={{color: star <= rating ? '#f59e0b' : '#e2e8f0'}}>★</span>)}</div></div>
                    <div className="control-group"><label>Remarks</label><textarea rows="5" value={feedbackText} onChange={(e) => setFeedbackText(e.target.value)} required></textarea></div>
                    <button type="submit" className="submit-feedback-btn">Submit Report</button>
                  </form>
               </div>
            </div>
          )}
        </div>
      </main>

      {/* MODAL */}
      {modalData && (
        <div className="modal-overlay" onClick={() => setModalData(null)}>
           <div className="class-detail-modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header"><h3>{modalData.className}</h3><button className="close-btn" onClick={() => setModalData(null)}>×</button></div>
              <div className="modal-body">
                 <div className="info-row"><span className="label">Time:</span><span className="value">{modalData.time}</span></div>
                 <div className="info-row"><span className="label">Level:</span><span className="value">{modalData.level}</span></div>
                 <div className="modal-actions">
                    {modalData.meetingLink ? <a href={modalData.meetingLink} target="_blank" rel="noreferrer" className="launch-btn">🚀 Launch Class</a> : <button className="launch-btn disabled" disabled>No Link Added</button>}
                    <button className="mark-att-btn" onClick={() => { setModalData(null); setActiveTab('attendance'); handleAttendanceControls(modalData._id, new Date().toISOString().slice(0, 10)); }}>📝 Mark Attendance</button>
                 </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default TeacherDashboard;