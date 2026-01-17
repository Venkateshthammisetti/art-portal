// src/components/TeacherDashboard.js
import React, { useState, useEffect, useRef } from 'react';
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
  
  // Multi-Select State
  const [selectedClassIds, setSelectedClassIds] = useState([]); 
  const [isMultiSelectOpen, setIsMultiSelectOpen] = useState(false);
  
  // Dates
  const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().slice(0, 10));
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));

  // Data Containers
  const [attendanceList, setAttendanceList] = useState([]);
  const [attendanceStatus, setAttendanceStatus] = useState({});
  const [monthlyData, setMonthlyData] = useState([]); 
  const [monthDays, setMonthDays] = useState([]); 
  const [msg, setMsg] = useState('');
  
  // Simulated Database
  const [attendanceDb, setAttendanceDb] = useState({}); 

  const [isClassScheduled, setIsClassScheduled] = useState(true);
  const [forceExtraSession, setForceExtraSession] = useState(false);

  // Feedback State
  const [feedbackStudent, setFeedbackStudent] = useState('');
  const [feedbackMonth, setFeedbackMonth] = useState(new Date().toISOString().slice(0, 7));
  const [feedbackText, setFeedbackText] = useState('');
  const [rating, setRating] = useState(5);

  // Click Outside Handler
  const dropdownRef = useRef(null);
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsMultiSelectOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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

  // --- REACTIVE SYNC ENGINE ---
  useEffect(() => {
    if (selectedClassIds.length === 0) {
      setAttendanceList([]);
      setMonthlyData([]);
      return;
    }

    const combinedStudents = classes
      .filter(c => selectedClassIds.includes(c._id))
      .flatMap(c => c.students.map(s => ({ ...s, parentClassId: c._id, className: c.className })));
    
    setAttendanceList(combinedStudents);

    // DAILY VIEW LOGIC
    if (attendanceView === 'daily') {
      const combinedStatus = {};
      let scheduledCount = 0;

      selectedClassIds.forEach(classId => {
        const dbKey = `${classId}_${attendanceDate}`;
        const savedData = attendanceDb[dbKey] || {};
        Object.assign(combinedStatus, savedData);

        const cls = classes.find(c => c._id === classId);
        const dateObj = new Date(attendanceDate);
        const dayName = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][dateObj.getDay()];
        if (cls && cls.schedule.some(s => s.day === dayName)) scheduledCount++;
      });

      setAttendanceStatus(combinedStatus);
      setIsClassScheduled(scheduledCount > 0);
    }

    // MONTHLY VIEW LOGIC
    if (attendanceView === 'monthly') {
      const [year, month] = selectedMonth.split('-').map(Number);
      const daysInMonth = new Date(year, month, 0).getDate();
      
      const daysArr = [];
      for(let i=1; i<=daysInMonth; i++) {
          const d = new Date(year, month - 1, i);
          const dayOfWeek = d.getDay();
          daysArr.push({
              date: i,
              isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
              fullDateStr: `${year}-${String(month).padStart(2, '0')}-${String(i).padStart(2, '0')}`
          });
      }
      setMonthDays(daysArr);

      const generatedSheet = combinedStudents.map(s => {
        const history = daysArr.map(dayObj => {
           const keyForDay = `${s.parentClassId}_${dayObj.fullDateStr}`;
           const dayRecord = attendanceDb[keyForDay];
           if (dayRecord && dayRecord[s._id]) {
              return dayRecord[s._id] === 'Present' ? 'P' : 'A';
           }
           return null; 
        });
        return { ...s, history };
      });
      setMonthlyData(generatedSheet);
    }

  }, [attendanceView, selectedClassIds, attendanceDate, selectedMonth, attendanceDb, classes]); 

  // --- ACTIONS ---
  const toggleClassSelection = (classId) => {
    setSelectedClassIds(prev => prev.includes(classId) ? prev.filter(id => id !== classId) : [...prev, classId]);
  };

  const toggleStatus = (studentId) => {
    setAttendanceStatus(prev => {
      const current = prev[studentId];
      if (!current) return { ...prev, [studentId]: 'Present' };
      if (current === 'Present') return { ...prev, [studentId]: 'Absent' };
      const newState = { ...prev };
      delete newState[studentId];
      return newState;
    });
  };

  const markAll = (status) => {
    const newStatus = { ...attendanceStatus };
    attendanceList.forEach(s => newStatus[s._id] = status);
    setAttendanceStatus(newStatus);
  };

  const submitAttendance = () => {
    if (selectedClassIds.length === 0) return;
    const updates = {}; 
    selectedClassIds.forEach(classId => {
      const dbKey = `${classId}_${attendanceDate}`;
      updates[dbKey] = { ...(attendanceDb[dbKey] || {}) }; 
      const classStudents = classes.find(c => c._id === classId).students;
      classStudents.forEach(s => {
        if (attendanceStatus[s._id]) updates[dbKey][s._id] = attendanceStatus[s._id];
        else delete updates[dbKey][s._id]; 
      });
    });
    setAttendanceDb(prev => ({ ...prev, ...updates }));
    setMsg("✅ Saved! Monthly sheet updated.");
    setTimeout(() => setMsg(''), 3000);
  };

  // --- HELPERS ---
  const dayNamesFull = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const getTodayClasses = () => classes.filter(c => c.schedule.some(s => s.day === dayNamesFull[new Date().getDay()]));
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
  const getWeekDates = (baseDate) => { const d = new Date(baseDate); const day = d.getDay(); const diff = d.getDate() - day + (day === 0 ? -6 : 1); return Array.from({length:7}, (_,i) => { const t = new Date(d); t.setDate(diff+i); return t; }); };
  const changeWeek = (off) => { const d = new Date(currentDate); d.setDate(d.getDate() + (off*7)); setCurrentDate(d); };
  const timeSlots = Array.from({length:15},(_,i)=>i+7);
  const getPositionStyle = (t) => { const [h,m]=t.split(':').map(Number); return {top:`${(h-7)*60+m}px`,height:'55px'}; };
  const sendFeedback = (e) => { e.preventDefault(); setMsg("Report Sent!"); setTimeout(()=>setMsg(''),3000); };
  const handleBlockClick = (cls, t) => setModalData({...cls, time:t});

  // ✨ FIX: Define presentCount here so it's available in the return statement
  const presentCount = Object.values(attendanceStatus).filter(s => s === 'Present').length;

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
             <h2>{activeTab === 'attendance' ? 'Attendance Register' : 'Teacher Dashboard'}</h2>
             <p>Welcome back, {currentUser.fullName}</p>
           </div>
           <div className="t-header-right"><div className="header-profile"><div className="avatar">{currentUser.fullName?.charAt(0) || 'T'}</div></div></div>
        </header>

        <div className="t-content">
          {msg && <div className="success-toast">{msg}</div>}

          {/* OVERVIEW */}
          {activeTab === 'overview' && <div className="overview-view"> <div className="hero-banner"><div><h1>Dashboard Overview</h1><p>Here is what's happening in your classes today.</p></div></div> <div className="stats-grid"><div className="stat-card"><div className="icon-circle blue">🎓</div><div><div className="stat-value">{myStudents.length}</div><div className="stat-label">Total Students</div></div></div><div className="stat-card"><div className="icon-circle green">📚</div><div><div className="stat-value">{classes.length}</div><div className="stat-label">My Classes</div></div></div></div> <h3 className="section-title">Today's Agenda</h3> {getTodayClasses().length === 0 ? <div className="empty-state">No classes scheduled today.</div> : (<div className="today-grid">{getTodayClasses().map(cls => (<div key={cls._id} className="today-card"><div className="tc-header"><span className="tc-time">{cls.schedule.find(s => s.day === dayNamesFull[new Date().getDay()])?.time}</span><span className="tc-badge">Active</span></div><div className="tc-body"><h4>{cls.className}</h4><p>{cls.students.length} Students</p></div><button onClick={() => { setActiveTab('attendance'); setSelectedClassIds([cls._id]); setAttendanceDate(new Date().toISOString().slice(0, 10)); }} className="tc-btn">Mark Attendance</button></div>))}</div>)} <h3 className="section-title" style={{marginTop:'40px'}}>Upcoming Sessions</h3> {getUpcomingClasses().length === 0 ? <div className="empty-state">No upcoming classes.</div> : (<div className="upcoming-list">{getUpcomingClasses().map((cls, idx) => (<div key={idx} className="upcoming-row"><div className="uc-date"><span className="uc-day">{cls.isTomorrow ? 'Tomorrow' : cls.upcomingDay}</span></div><div className="uc-info"><h4>{cls.className}</h4><span>{cls.level}</span></div><div className="uc-time">{cls.upcomingTime}</div><div className="uc-action"><button className="icon-btn-sm" onClick={() => setActiveTab('schedule')}>🗓️</button></div></div>))}</div>)} </div>}
          
          {/* SCHEDULE */}
          {activeTab === 'schedule' && <div className="timetable-container"><div className="tt-toolbar"><button className="nav-btn">Current Week</button><div className="week-nav"><h3>{getWeekDates(currentDate)[0].toLocaleDateString()}</h3></div></div><div className="tt-grid-wrapper"><div className="tt-time-col">{timeSlots.map(h => <div key={h} className="tt-time-slot"><span>{h % 12 || 12} {h >= 12 ? 'PM' : 'AM'}</span></div>)}</div><div className="tt-days-area"><div className="tt-header-row">{getWeekDates(currentDate).map((date, i) => <div key={i} className={`tt-header-cell ${new Date().toDateString() === date.toDateString() ? 'active' : ''}`}><span className="day-name">{dayNamesFull[date.getDay()].slice(0, 3)}</span><span className="day-num">{date.getDate()}</span></div>)}</div><div className="tt-body-row">{getWeekDates(currentDate).map((date, i) => { const dayName = dayNamesFull[date.getDay()]; const dayClasses = classes.filter(c => c.schedule.some(s => s.day === dayName)); return (<div key={i} className="tt-day-col">{timeSlots.map(t => <div key={t} className="tt-grid-line"></div>)}{dayClasses.map(cls => { const schedule = cls.schedule.find(s => s.day === dayName); return schedule ? <div key={cls._id} className="class-block" style={getPositionStyle(schedule.time)} onClick={() => handleBlockClick(cls, schedule.time)}><div className="cb-time">{schedule.time}</div><div className="cb-title">{cls.className}</div></div> : null })}</div>) })}</div></div></div></div>}

          {/* ATTENDANCE */}
          {activeTab === 'attendance' && (
            <div className="attendance-view">
               <div className="att-control-bar">
                  <div className="att-filters">
                     {/* Multi-Select Dropdown */}
                     <div className="filter-item" ref={dropdownRef}>
                       <label>Select Classes ({selectedClassIds.length})</label>
                       <div className="multi-select-box" onClick={() => setIsMultiSelectOpen(!isMultiSelectOpen)}>
                          <span>{selectedClassIds.length > 0 ? `${selectedClassIds.length} Classes Selected` : '-- Choose Class --'}</span>
                          <span className="arrow">▼</span>
                       </div>
                       {isMultiSelectOpen && (
                         <div className="multi-select-dropdown">
                            {classes.map(c => (
                              <div key={c._id} className="ms-item" onClick={() => toggleClassSelection(c._id)}>
                                <input type="checkbox" checked={selectedClassIds.includes(c._id)} readOnly />
                                <span>{c.className} ({c.level})</span>
                              </div>
                            ))}
                         </div>
                       )}
                     </div>
                     
                     {/* Date Picker */}
                     {attendanceView === 'daily' ? (
                        <div className="filter-item">
                          <label>Date</label>
                          <input type="date" value={attendanceDate} onChange={(e) => setAttendanceDate(e.target.value)} />
                        </div>
                     ) : (
                        <div className="filter-item">
                          <label>Report Month</label>
                          <input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} />
                        </div>
                     )}
                  </div>

                  <div className="view-switcher">
                     <button className={attendanceView === 'daily' ? 'active' : ''} onClick={() => setAttendanceView('daily')}>Daily Log</button>
                     <button className={attendanceView === 'monthly' ? 'active' : ''} onClick={() => setAttendanceView('monthly')}>Monthly Sheet</button>
                  </div>
               </div>

               {selectedClassIds.length > 0 ? (
                 <>
                   {attendanceView === 'daily' && (
                     !isClassScheduled && !forceExtraSession ? (
                        <div className="schedule-warning-box animate-fade-in">
                           <div className="warning-icon">📅</div>
                           <h3>No Class Scheduled</h3>
                           <p>One or more selected classes are not scheduled for today.</p>
                           <button className="force-btn" onClick={() => setForceExtraSession(true)}>Mark Extra Session</button>
                        </div>
                     ) : (
                        <div className="daily-container animate-fade-in">
                           <div className="att-stats-card">
                              <div className="att-stat"><span className="label">Present</span><span className="value success">{presentCount}</span></div>
                              <div className="att-divider">/</div>
                              <div className="att-stat"><span className="label">Total</span><span className="value">{attendanceList.length}</span></div>
                              <div className="att-progress-ring" style={{background: `conic-gradient(#22c55e ${(presentCount/attendanceList.length)*360}deg, #e2e8f0 0deg)`}}><div className="inner">{Math.round((presentCount/attendanceList.length)*100 || 0)}%</div></div>
                           </div>
                           <div className="att-toolbar">
                              <span className="toolbar-label">Quick Actions:</span>
                              <button className="bulk-btn present" onClick={() => markAll('Present')}>Mark All Present</button>
                              <button className="bulk-btn absent" onClick={() => markAll('Absent')}>Mark All Absent</button>
                           </div>
                           <div className="modern-student-list">
                              <div className="list-header-row"><div className="col-name">Student Name</div><div className="col-id">Class</div><div className="col-status">Status</div></div>
                              {attendanceList.map(s => {
                                const status = attendanceStatus[s._id];
                                return (
                                  <div key={s._id} className={`modern-student-row ${status ? (status === 'Present' ? 'is-present' : 'is-absent') : ''}`} onClick={() => toggleStatus(s._id)}>
                                     <div className="col-name"><div className="s-avatar-sm">{s.childName.charAt(0)}</div>{s.childName}</div>
                                     <div className="col-id">{s.className}</div>
                                     <div className="col-status">
                                        <div className={`status-switch ${status ? (status === 'Present' ? 'on' : 'off') : 'neutral'}`}>
                                           <div className="switch-knob"></div>
                                           <span className="switch-text">{status || ''}</span>
                                        </div>
                                     </div>
                                  </div>
                                );
                              })}
                           </div>
                           <button className="save-attendance-floating-btn" onClick={submitAttendance}>💾 Save Daily Log</button>
                        </div>
                     )
                   )}

                   {attendanceView === 'monthly' && (
                     <div className="monthly-sheet-container animate-fade-in">
                        <div className="sheet-wrapper">
                           <table className="sheet-table">
                              <thead>
                                 <tr>
                                    <th className="sticky-col name-col">Student Name</th>
                                    {monthDays.map(d => (
                                      <th key={d.date} className={`date-col ${d.isWeekend ? 'weekend-col' : ''}`}>
                                        {d.date}
                                      </th>
                                    ))}
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
                                          <td className="sticky-col name-col">
                                            <div className="row-name">{s.childName}</div>
                                            <div className="row-sub">{s.className}</div>
                                          </td>
                                          {s.history.map((status, idx) => (
                                             <td key={idx} className={`cell-status ${status || ''} ${monthDays[idx].isWeekend ? 'weekend-cell' : ''}`}>
                                                {status}
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
                 <div className="empty-state">Select classes to view registers.</div>
               )}
            </div>
          )}

          {activeTab === 'feedback' && <div className="feedback-view"><div className="form-card"><form onSubmit={sendFeedback}><div className="controls-row" style={{boxShadow:'none', padding:0, border:'none', background:'transparent'}}><div className="control-group"><label>Student</label><select value={feedbackStudent} onChange={(e) => setFeedbackStudent(e.target.value)} required><option value="">-- Choose --</option>{myStudents.map(s => <option key={s._id} value={s._id}>{s.childName}</option>)}</select></div><div className="control-group"><label>Month</label><input type="month" value={feedbackMonth} onChange={(e) => setFeedbackMonth(e.target.value)} required /></div></div><div className="control-group"><label>Rating</label><div className="star-rating">{[1,2,3,4,5].map(star => <span key={star} onClick={() => setRating(star)} style={{color: star <= rating ? '#f59e0b' : '#e2e8f0'}}>★</span>)}</div></div><div className="control-group"><label>Remarks</label><textarea rows="5" value={feedbackText} onChange={(e) => setFeedbackText(e.target.value)} required></textarea></div><button type="submit" className="submit-feedback-btn">Submit Report</button></form></div></div>}
        </div>
      </main>

      {modalData && <div className="modal-overlay" onClick={() => setModalData(null)}><div className="class-detail-modal" onClick={(e) => e.stopPropagation()}><div className="modal-header"><h3>{modalData.className}</h3><button className="close-btn" onClick={() => setModalData(null)}>×</button></div><div className="modal-body"><div className="info-row"><span className="label">Time:</span><span className="value">{modalData.time}</span></div><div className="info-row"><span className="label">Level:</span><span className="value">{modalData.level}</span></div><div className="modal-actions">{modalData.meetingLink ? <a href={modalData.meetingLink} target="_blank" rel="noreferrer" className="launch-btn">🚀 Launch Class</a> : <button className="launch-btn disabled" disabled>No Link Added</button>}<button className="mark-att-btn" onClick={() => { setModalData(null); setActiveTab('attendance'); setSelectedClassIds([modalData._id]); setAttendanceDate(new Date().toISOString().slice(0, 10)); }}>📝 Mark Attendance</button></div></div></div></div>}
    </div>
  );
};

export default TeacherDashboard;