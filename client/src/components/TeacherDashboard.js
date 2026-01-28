// src/components/TeacherDashboard.js
import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import './TeacherDashboard.css';

const TeacherDashboard = ({ user, onLogout }) => {
  const currentUser = user;

  // --- CONFIGURATION ---
  const GRID_START_HOUR = 6;
  const GRID_END_HOUR = 23;
  const ROW_HEIGHT = 60;

  // --- STATE ---
  const [loading, setLoading] = useState(true); // ✨ NEW: Loading State
  const [activeTab, setActiveTab] = useState('overview'); 
  const [classes, setClasses] = useState([]);
  const [myStudents, setMyStudents] = useState([]);
  const [scheduleViewMode, setScheduleViewMode] = useState('grid'); 
  const [studentViewMode, setStudentViewMode] = useState('list');

  // Mobile State
  const [showMobileLogout, setShowMobileLogout] = useState(false);

  // Sort & Filter
  const [searchText, setSearchText] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'childName', direction: 'asc' });
  const [visibleColumns, setVisibleColumns] = useState({ name: true, id: true, className: true, gender: true, phone: true });
  const [isColMenuOpen, setIsColMenuOpen] = useState(false);

  // Modals
  const [currentDate, setCurrentDate] = useState(new Date());
  const [modalData, setModalData] = useState(null); 
  const [editingLink, setEditingLink] = useState('');
  const [isLinkInputVisible, setIsLinkInputVisible] = useState(false);
  const [editFeedbackData, setEditFeedbackData] = useState(null); 

  // Attendance
  const [attendanceView, setAttendanceView] = useState('daily'); 
  const [selectedClassIds, setSelectedClassIds] = useState([]); 
  const [isMultiSelectOpen, setIsMultiSelectOpen] = useState(false);
  const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().slice(0, 10));
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [attendanceList, setAttendanceList] = useState([]);
  const [attendanceStatus, setAttendanceStatus] = useState({});
  const [monthlyData, setMonthlyData] = useState([]); 
  const [monthDays, setMonthDays] = useState([]); 
  const [msg, setMsg] = useState('');
  const [isClassScheduled, setIsClassScheduled] = useState(true);
  const [forceExtraSession, setForceExtraSession] = useState(false);

  // Feedback Form State
  const [feedbackStudent, setFeedbackStudent] = useState('');
  const [feedbackMonth, setFeedbackMonth] = useState(new Date().toISOString().slice(0, 7));
  const [feedbackText, setFeedbackText] = useState('');
  const [rating, setRating] = useState(5);
  const [reportFile, setReportFile] = useState(null);
  const [feedbackHistory, setFeedbackHistory] = useState([]);
  const [historyMonth, setHistoryMonth] = useState(new Date().toISOString().slice(0, 7)); 

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
    setLoading(true); // Start Loading
    try {
      const classRes = await axios.get(`https://art-portal-7n6r.onrender.com/api/teacher/${currentUser._id}/classes`);
      setClasses(classRes.data);
      const allStudents = [];
      const seenIds = new Set();
      classRes.data.forEach(cls => {
        cls.students.forEach(std => {
          if (!seenIds.has(std._id)) {
            seenIds.add(std._id);
            const mockGender = Math.random() > 0.5 ? 'Female' : 'Male'; 
            allStudents.push({ ...std, className: cls.className, level: cls.level, gender: std.gender || mockGender }); 
          }
        });
      });
      setMyStudents(allStudents);
    } catch (err) { 
      console.error(err); 
    } finally {
      setLoading(false); // Stop Loading
    }
  };

  // --- FETCH FEEDBACK HISTORY ---
  useEffect(() => {
    if (activeTab === 'feedback') fetchHistory();
  }, [activeTab, historyMonth, currentUser._id]);

  const fetchHistory = async () => {
    try {
      const res = await axios.get(`https://art-portal-7n6r.onrender.com/api/feedback/teacher/${currentUser._id}?month=${historyMonth}`);
      setFeedbackHistory(res.data);
    } catch (err) { console.error(err); }
  };

  // Month Navigation Helper
  const changeHistoryMonth = (offset) => {
    const [year, month] = historyMonth.split('-').map(Number);
    const date = new Date(year, month - 1 + offset, 1);
    const newStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    setHistoryMonth(newStr);
  };

  const formatMonthName = (isoStr) => {
    const [year, month] = isoStr.split('-');
    const date = new Date(year, month - 1);
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  const getSentiment = (rating) => {
    if (rating >= 5) return { label: 'Excellent', color: 'green' };
    if (rating >= 4) return { label: 'Good', color: 'blue' };
    if (rating === 3) return { label: 'Average', color: 'orange' };
    return { label: 'Concern', color: 'red' };
  };

  // --- ATTENDANCE SYNC ---
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

    const fetchAttendanceData = async () => {
      try {
        const classQuery = selectedClassIds.join(',');
        
        if (attendanceView === 'daily') {
           const url = `https://art-portal-7n6r.onrender.com/api/attendance/daily?classes=${classQuery}&date=${attendanceDate}`;
           const res = await axios.get(url);
           setAttendanceStatus(res.data.statusMap || {}); 
           setIsClassScheduled(res.data.isScheduled !== undefined ? res.data.isScheduled : true);
        } else {
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

           const url = `https://art-portal-7n6r.onrender.com/api/attendance/monthly?classes=${classQuery}&month=${selectedMonth}`;
           const res = await axios.get(url);
           const records = res.data; 
           const lookup = {};
           records.forEach(r => { lookup[`${r.studentId}_${r.date}`] = r.status; });

           const generatedSheet = combinedStudents.map(s => {
             const history = daysArr.map(dayObj => {
                const status = lookup[`${s._id}_${dayObj.fullDateStr}`]; 
                if (status === 'Present') return 'P';
                if (status === 'Absent') return 'A';
                if (status === 'Missed') return 'M';
                return null;
             });
             return { ...s, history };
           });
           setMonthlyData(generatedSheet);
        }
      } catch (error) { console.error("Error fetching attendance:", error); }
    };
    fetchAttendanceData();
  }, [attendanceView, selectedClassIds, attendanceDate, selectedMonth, classes]); 

  // --- ACTIONS ---
  const toggleClassSelection = (classId) => {
    setSelectedClassIds(prev => prev.includes(classId) ? prev.filter(id => id !== classId) : [...prev, classId]);
  };

  const toggleStatus = (studentId) => {
    setAttendanceStatus(prev => {
      const current = prev[studentId];
      if (!current) return { ...prev, [studentId]: 'Present' };
      if (current === 'Present') return { ...prev, [studentId]: 'Absent' };
      if (current === 'Absent') return { ...prev, [studentId]: 'Missed' }; 
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

  const submitAttendance = async () => {
    if (selectedClassIds.length === 0) return;
    try {
      const validRecords = attendanceList
        .filter(s => s._id && s.parentClassId && attendanceStatus[s._id]) 
        .map(student => ({
          studentId: student._id,
          classId: student.parentClassId,
          status: attendanceStatus[student._id]
        }));

      if (validRecords.length === 0) {
         setMsg("⚠️ No changes to save");
         setTimeout(() => setMsg(''), 3000);
         return;
      }

      const payload = { date: attendanceDate, records: validRecords };
      await axios.post('https://art-portal-7n6r.onrender.com/api/attendance', payload);

      setMsg("✅ Saved!");
      setTimeout(() => setMsg(''), 3000);
    } catch (error) {
      setMsg("❌ Error Saving");
      setTimeout(() => setMsg(''), 3000);
    }
  };

  // --- CREATE NEW REPORT ---
  const sendFeedback = async (e) => {
    e.preventDefault();
    try {
      const formData = new FormData();
      formData.append('studentId', feedbackStudent);
      formData.append('teacherId', currentUser._id);
      formData.append('month', feedbackMonth);
      formData.append('feedbackText', feedbackText);
      formData.append('rating', rating);
      if (reportFile) formData.append('report', reportFile);

      await axios.post('https://art-portal-7n6r.onrender.com/api/feedback', formData, { headers: { 'Content-Type': 'multipart/form-data' } });

      setMsg("Report Sent!");
      setFeedbackText('');
      setRating(5);
      setReportFile(null); 
      fetchHistory(); // Refresh
      setTimeout(()=>setMsg(''),3000);
    } catch (err) { console.error(err); }
  };

  // --- UPDATE REPORT ---
  const handleUpdateFeedback = async (e) => {
    e.preventDefault();
    if (!editFeedbackData) return;

    try {
      const formData = new FormData();
      formData.append('feedbackText', editFeedbackData.feedbackText);
      formData.append('rating', editFeedbackData.rating);
      if (editFeedbackData.newFile) {
        formData.append('report', editFeedbackData.newFile);
      }

      await axios.put(`https://art-portal-7n6r.onrender.com/api/feedback/${editFeedbackData._id}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setMsg("Report Updated!");
      setEditFeedbackData(null); // Close Modal
      fetchHistory(); // Refresh List
      setTimeout(() => setMsg(''), 3000);
    } catch (err) {
      console.error("Update failed", err);
      setMsg("❌ Failed to update");
    }
  };

  const openEditModal = (item) => {
    setEditFeedbackData({
      _id: item._id,
      studentName: item.studentId?.childName,
      feedbackText: item.feedbackText,
      rating: item.rating,
      month: item.month,
      currentFile: item.reportFile, 
      newFile: null 
    });
  };

  const handleBlockClick = (cls, t) => { setModalData({...cls, time:t}); setEditingLink(cls.meetingLink || ''); setIsLinkInputVisible(!cls.meetingLink); };
  const handleSaveLink = () => { setMsg("Link Saved locally (demo)"); setTimeout(()=>setMsg(''),3000); };

  // --- HELPERS ---
  const dayNamesFull = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const timeSlots = Array.from({ length: GRID_END_HOUR - GRID_START_HOUR + 1 }, (_, i) => i + GRID_START_HOUR);

  const getBlockStyle = (dayName, timeStr) => {
    const [h, m] = timeStr.split(':').map(Number);
    const dayOrder = { 'Monday':0, 'Tuesday':1, 'Wednesday':2, 'Thursday':3, 'Friday':4, 'Saturday':5, 'Sunday':6 };
    const dayIndex = dayOrder[dayName];
    if (dayIndex === undefined) return null; 
    const topPx = ((h - GRID_START_HOUR) * ROW_HEIGHT) + ((m / 60) * ROW_HEIGHT);
    const colWidth = 100 / 7; 
    const leftPercent = dayIndex * colWidth;
    return { top: `${topPx}px`, left: `${leftPercent}%`, width: `${colWidth}%`, height: '55px', position: 'absolute' };
  };

  const getAllScheduledClasses = () => {
    let allSessions = [];
    classes.forEach(cls => {
        cls.schedule.forEach(s => { allSessions.push({ ...cls, day: s.day, time: s.time }); });
    });
    const dayOrder = { "Monday": 1, "Tuesday": 2, "Wednesday": 3, "Thursday": 4, "Friday": 5, "Saturday": 6, "Sunday": 7 };
    return allSessions.sort((a, b) => (dayOrder[a.day] - dayOrder[b.day]) || a.time.localeCompare(b.time));
  };

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
  const presentCount = Object.values(attendanceStatus).filter(s => s === 'Present').length;
  const getClassColor = (name) => { const colors = ['blue', 'green', 'purple', 'orange']; let val = 0; for(let i=0; i<name.length;i++) val+=name.charCodeAt(i); return colors[val % colors.length]; };

  const getGenderStats = () => {
    const boys = myStudents.filter(s => s.gender === 'Male').length;
    const girls = myStudents.filter(s => s.gender === 'Female').length;
    return { boys, girls, total: myStudents.length };
  };
  const getClassStats = () => {
    const counts = {};
    myStudents.forEach(s => { counts[s.className] = (counts[s.className] || 0) + 1; });
    return Object.entries(counts).map(([name, count]) => ({ name, count }));
  };

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    setSortConfig({ key, direction });
  };

  const getProcessedStudents = () => {
    let filtered = myStudents.filter(s => s.childName.toLowerCase().includes(searchText.toLowerCase()));
    if (sortConfig.key) {
      filtered.sort((a, b) => {
        const valA = a[sortConfig.key]?.toString().toLowerCase() || '';
        const valB = b[sortConfig.key]?.toString().toLowerCase() || '';
        return sortConfig.direction === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      });
    }
    return filtered;
  };

  const handleNavClick = (tab) => {
    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ✨✨ LOADING STATE CHECK ✨✨
  if (loading) {
    return (
      <div className="art-loading-screen">
        <div className="paint-loader">
          <div className="paint-drop red"></div>
          <div className="paint-drop yellow"></div>
          <div className="paint-drop blue"></div>
          <div className="paint-drop green"></div>
        </div>
        <p className="loading-text">Preparing your creative space...</p>
      </div>
    );
  }

  return (
    <div className="teacher-container">
      {/* SIDEBAR (Hidden on Mobile) */}
      <aside className="teacher-sidebar">
        <div className="sidebar-header"><div className="logo-icon">VA</div><h3>Venky Art</h3></div>
        <div className="t-nav">
          <button className={activeTab === 'overview' ? 'active' : ''} onClick={() => setActiveTab('overview')}><span>📊</span> Dashboard</button>
          <button className={activeTab === 'students' ? 'active' : ''} onClick={() => setActiveTab('students')}><span>🎓</span> Students</button>
          <button className={activeTab === 'schedule' ? 'active' : ''} onClick={() => setActiveTab('schedule')}><span>🗓️</span> My Schedule</button>
          <button className={activeTab === 'attendance' ? 'active' : ''} onClick={() => setActiveTab('attendance')}><span>📝</span> Attendance</button>
          <button className={activeTab === 'feedback' ? 'active' : ''} onClick={() => setActiveTab('feedback')}><span>💬</span> Feedback</button>
        </div>
        <button className="t-logout" onClick={onLogout}> Logout</button>
      </aside>

      <main className="teacher-main">
        <header className="t-header">
           <div className="t-header-left">
             <h2>{activeTab === 'students' ? 'Student Directory' : activeTab === 'attendance' ? 'Attendance Register' : activeTab === 'schedule' ? 'Class Schedule' : 'Teacher Dashboard'}</h2>
             <p>Welcome back, {currentUser.fullName}</p>
           </div>
           <div className="t-header-right">
             <div className="header-profile" onClick={() => setShowMobileLogout(!showMobileLogout)}>
               <div className="avatar">{currentUser.fullName?.charAt(0) || 'T'}</div>
             </div>
             {showMobileLogout && (
               <div className="mobile-logout-dropdown">
                 <button onClick={onLogout}>🚪 Logout</button>
               </div>
             )}
           </div>
        </header>

        <div className="t-content">
          {msg && <div className="success-toast">{msg}</div>}

          {/* OVERVIEW */}
          {activeTab === 'overview' && <div className="overview-view"> 
             <div className="hero-banner"><div><h1>Dashboard Overview</h1><p>Here is what's happening in your classes today.</p></div></div> 
             <div className="stats-grid">
               <div className="stat-card" onClick={() => setActiveTab('students')} style={{cursor: 'pointer'}}>
                  <div className="icon-circle blue">🎓</div><div><div className="stat-value">{myStudents.length}</div><div className="stat-label">Total Students</div></div>
               </div>
               <div className="stat-card"><div className="icon-circle green">📚</div><div><div className="stat-value">{classes.length}</div><div className="stat-label">My Classes</div></div></div>
             </div> 
             <h3 className="section-title">Today's Agenda</h3> 
             {getTodayClasses().length === 0 ? <div className="empty-state">No classes scheduled today.</div> : (<div className="today-grid">{getTodayClasses().map(cls => (<div key={cls._id} className="today-card"><div className="tc-header"><span className="tc-time">{cls.schedule.find(s => s.day === dayNamesFull[new Date().getDay()])?.time}</span><span className="tc-badge">Active</span></div><div className="tc-body"><h4>{cls.className}</h4><p>{cls.students.length} Students</p></div><button onClick={() => { setActiveTab('attendance'); setSelectedClassIds([cls._id]); setAttendanceDate(new Date().toISOString().slice(0, 10)); }} className="tc-btn">Mark Attendance</button></div>))}</div>)} 
             <h3 className="section-title" style={{marginTop:'40px'}}>Upcoming Sessions</h3> {getUpcomingClasses().length === 0 ? <div className="empty-state">No upcoming classes.</div> : (<div className="upcoming-list">{getUpcomingClasses().map((cls, idx) => (<div key={idx} className="upcoming-row"><div className="uc-date"><span className="uc-day">{cls.isTomorrow ? 'Tomorrow' : cls.upcomingDay}</span></div><div className="uc-info"><h4>{cls.className}</h4><span>{cls.level}</span></div><div className="uc-time">{cls.upcomingTime}</div><div className="uc-action"><button className="icon-btn-sm" onClick={() => setActiveTab('schedule')}>🗓️</button></div></div>))}</div>)} 
          </div>}
          
          {/* STUDENTS */}
          {activeTab === 'students' && (
            <div className="students-view">
               <div className="std-toolbar">
                  <div className="std-search"><span className="search-icon">🔍</span><input type="text" placeholder="Search..." value={searchText} onChange={(e) => setSearchText(e.target.value)} /></div>
                  <div className="std-actions">
                      <div className="col-menu-wrapper" style={{position:'relative'}}>
                         <button className="personalize-btn" onClick={() => setIsColMenuOpen(!isColMenuOpen)}>⚙️ Columns</button>
                         {isColMenuOpen && (<div className="col-dropdown"><label><input type="checkbox" checked={visibleColumns.name} onChange={()=>setVisibleColumns({...visibleColumns, name: !visibleColumns.name})} /> Name</label><label><input type="checkbox" checked={visibleColumns.id} onChange={()=>setVisibleColumns({...visibleColumns, id: !visibleColumns.id})} /> ID</label><label><input type="checkbox" checked={visibleColumns.className} onChange={()=>setVisibleColumns({...visibleColumns, className: !visibleColumns.className})} /> Class</label><label><input type="checkbox" checked={visibleColumns.gender} onChange={()=>setVisibleColumns({...visibleColumns, gender: !visibleColumns.gender})} /> Gender</label><label><input type="checkbox" checked={visibleColumns.phone} onChange={()=>setVisibleColumns({...visibleColumns, phone: !visibleColumns.phone})} /> Phone</label></div>)}
                      </div>
                      <div className="view-switcher"><button className={studentViewMode === 'list' ? 'active' : ''} onClick={() => setStudentViewMode('list')}>📋 List</button><button className={studentViewMode === 'analytics' ? 'active' : ''} onClick={() => setStudentViewMode('analytics')}>📊 Analytics</button></div>
                  </div>
               </div>
               {studentViewMode === 'list' ? (
                  <div className="std-table-wrapper">
                      <table className="std-table">
                        <thead><tr>{visibleColumns.name && <th onClick={() => handleSort('childName')}>Name</th>}{visibleColumns.id && <th onClick={() => handleSort('username')}>ID</th>}{visibleColumns.className && <th onClick={() => handleSort('className')}>Class</th>}{visibleColumns.gender && <th onClick={() => handleSort('gender')}>Gender</th>}{visibleColumns.phone && <th>Phone</th>}</tr></thead>
                        <tbody>{getProcessedStudents().map(s => (<tr key={s._id}>{visibleColumns.name && <td><div className="std-name-cell"><div className="s-avatar-sm">{s.childName.charAt(0)}</div>{s.childName}</div></td>}{visibleColumns.id && <td>{s.username}</td>}{visibleColumns.className && <td><span className="class-badge">{s.className}</span></td>}{visibleColumns.gender && <td>{s.gender}</td>}{visibleColumns.phone && <td>+91 98765 43210</td>}</tr>))}</tbody>
                      </table>
                  </div>
               ) : (
                  <div className="analytics-container"><div className="chart-card"><h4>Gender</h4><div className="pie-chart-wrapper"><div className="pie-chart" style={{background: `conic-gradient(#3b82f6 0% ${(getGenderStats().boys/getGenderStats().total)*100}%, #ec4899 ${(getGenderStats().boys/getGenderStats().total)*100}% 100%)`}}><div className="pie-hole"></div></div><div className="chart-legend"><div className="legend-item"><span className="dot blue"></span>Boys: {getGenderStats().boys}</div><div className="legend-item"><span className="dot pink"></span>Girls: {getGenderStats().girls}</div></div></div></div><div className="chart-card"><h4>Classes</h4><div className="bar-chart">{getClassStats().map((stat, i) => (<div key={i} className="bar-row"><div className="bar-label">{stat.name}</div><div className="bar-track"><div className="bar-fill" style={{width: `${(stat.count / myStudents.length) * 100}%`}}></div></div><div className="bar-value">{stat.count}</div></div>))}</div></div></div>
               )}
            </div>
          )}

          {/* SCHEDULE */}
          {activeTab === 'schedule' && (
            <div className="timetable-container">
              <div className="tt-toolbar">
                 {scheduleViewMode === 'grid' ? (<><div className="tt-date-display"><h3>Weekly Schedule</h3><span>{getWeekDates(currentDate)[0].toLocaleDateString()} - {getWeekDates(currentDate)[6].toLocaleDateString()}</span></div><div className="week-nav"><button onClick={() => changeWeek(-1)}>‹ Prev</button><button className="nav-btn" onClick={() => setCurrentDate(new Date())}>Today</button><button onClick={() => changeWeek(1)}>Next ›</button></div></>) : (<h3>All Classes ({getAllScheduledClasses().length})</h3>)}
                 <button className="view-toggle-btn" onClick={() => setScheduleViewMode(scheduleViewMode === 'grid' ? 'list' : 'grid')}>{scheduleViewMode === 'grid' ? '📜 List View' : '📅 Grid View'}</button>
              </div>
              {scheduleViewMode === 'grid' ? (
                  <div className="tt-grid-wrapper">
                      <div className="tt-time-col"><div className="tt-header-placeholder"></div>{timeSlots.map(h => (<div key={h} className="tt-time-label" style={{height: `${ROW_HEIGHT}px`}}><span>{h}:00</span></div>))}</div>
                      <div className="tt-main-area">
                        <div className="tt-header-row">{getWeekDates(currentDate).map((date, i) => (<div key={i} className={`tt-header-cell ${new Date().toDateString() === date.toDateString() ? 'active' : ''}`}><div className="day-name">{dayNamesFull[date.getDay()].slice(0, 3)}</div><div className="day-num">{date.getDate()}</div></div>))}</div>
                        <div className="tt-grid-body">
                           {timeSlots.map(h => (<div key={h} className="tt-grid-row" style={{height: `${ROW_HEIGHT}px`}}></div>))}
                           {classes.map(cls => (cls.schedule.map((sch, idx) => { const style = getBlockStyle(sch.day, sch.time); if (!style) return null; return (<div key={`${cls._id}-${idx}`} className={`tt-event-block ${getClassColor(cls.className)}`} style={style} onClick={() => handleBlockClick(cls, sch.time)}><div className="ev-time">{sch.time}</div><div className="ev-title">{cls.className}</div></div>) } )))}
                        </div>
                      </div>
                  </div>
              ) : (
                  <div className="schedule-list-view-wrapper"><div className="list-header-row table-header"><div className="col-day">Day</div><div className="col-time">Time</div><div className="col-details">Class Details</div><div className="col-action">Action</div></div><div className="schedule-list-body">{getAllScheduledClasses().map((cls, i) => (<div key={i} className="schedule-list-item"><div className="sli-day">{cls.day}</div><div className="sli-time">{cls.time}</div><div className="sli-info"><h4>{cls.className}</h4><span>{cls.level} • {cls.students.length} Students</span></div><div className="sli-action"><button className="sli-btn" onClick={() => handleBlockClick(cls, cls.time)}>Details</button></div></div>))}</div></div>
              )}
            </div>
          )}

          {/* ATTENDANCE */}
          {activeTab === 'attendance' && (
            <div className="attendance-view">
               <div className="att-control-bar">
                  <div className="att-filters">
                      <div className="filter-item" ref={dropdownRef}>
                        <label>Select Classes ({selectedClassIds.length})</label>
                        <div className="multi-select-box" onClick={() => setIsMultiSelectOpen(!isMultiSelectOpen)}><span>{selectedClassIds.length > 0 ? `${selectedClassIds.length} Selected` : '-- Choose Class --'}</span><span className="arrow">▼</span></div>
                        {isMultiSelectOpen && (<div className="multi-select-dropdown">{classes.map(c => (<div key={c._id} className="ms-item" onClick={() => toggleClassSelection(c._id)}><input type="checkbox" checked={selectedClassIds.includes(c._id)} readOnly /><span>{c.className} ({c.level})</span></div>))}</div>)}
                      </div>
                      {attendanceView === 'daily' ? (<div className="filter-item"><label>Date</label><input type="date" value={attendanceDate} onChange={(e) => setAttendanceDate(e.target.value)} /></div>) : (<div className="filter-item"><label>Report Month</label><input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} /></div>)}
                  </div>
                  <div className="view-switcher"><button className={attendanceView === 'daily' ? 'active' : ''} onClick={() => setAttendanceView('daily')}>Daily Log</button><button className={attendanceView === 'monthly' ? 'active' : ''} onClick={() => setAttendanceView('monthly')}>Monthly Sheet</button></div>
               </div>

               {selectedClassIds.length > 0 ? (
                 <>
                   {attendanceView === 'daily' && (
                     !isClassScheduled && !forceExtraSession ? (
                        <div className="schedule-warning-box animate-fade-in"><div className="warning-icon">📅</div><h3>No Class Scheduled</h3><p>Selected classes not scheduled for today.</p><button className="force-btn" onClick={() => setForceExtraSession(true)}>Mark Extra Session</button></div>
                     ) : (
                        <div className="daily-container animate-fade-in">
                           <div className="daily-header"><div className="dh-stats"><div className="stat-block"><span className="label">Present</span><span className="value green">{presentCount}</span></div><div className="stat-block"><span className="label">Total</span><span className="value">{attendanceList.length}</span></div></div><div className="dh-actions"><span className="action-label">Quick Actions:</span><button className="bulk-btn present" onClick={() => markAll('Present')}>Mark All Present</button><button className="bulk-btn absent" onClick={() => markAll('Absent')}>Mark All Absent</button><button className="bulk-btn missed" onClick={() => markAll('Missed')}>Mark All Missed</button></div></div>
                           <div className="modern-student-list">
                             <div className="list-header-row"><div className="col-name">Student Name</div><div className="col-id">Class</div><div className="col-status">Status</div></div>
                             {attendanceList.map(s => {
                               const status = attendanceStatus[s._id];
                               let switchClass = 'neutral';
                               if(status === 'Present') switchClass = 'on'; else if(status === 'Absent') switchClass = 'off'; else if(status === 'Missed') switchClass = 'missed';
                               return (
                                 <div key={s._id} className={`modern-student-row`} onClick={() => toggleStatus(s._id)}>
                                    <div className="col-name"><div className="s-avatar-sm">{s.childName.charAt(0)}</div>{s.childName}</div><div className="col-id">{s.className}</div>
                                    <div className="col-status"><div className={`status-switch ${switchClass}`}><div className="switch-knob"></div><span className="switch-text">{status || 'Mark'}</span></div></div>
                                 </div>
                               );
                             })}
                           </div>
                           <button className="save-attendance-btn" onClick={submitAttendance}>💾 Save Daily Log</button>
                        </div>
                     )
                   )}
                   {attendanceView === 'monthly' && (
                     <div className="monthly-sheet-container animate-fade-in">
                        <div className="sheet-wrapper">
                           <table className="sheet-table">
                             <thead><tr><th className="sticky-col name-col">Student Name</th>{monthDays.map(d => <th key={d.date} className={`date-col ${d.isWeekend ? 'weekend-col' : ''} ${d.isToday ? 'today-col' : ''}`}>{d.date}</th>)}<th className="summary-col present">P</th><th className="summary-col absent">A</th></tr></thead>
                             <tbody>
                                {monthlyData.map(s => {
                                   const presentCount = s.history.filter(h => h === 'P').length;
                                   const absentCount = s.history.filter(h => h === 'A').length;
                                   return (
                                      <tr key={s._id}>
                                         <td className="sticky-col name-col"><div className="row-name">{s.childName}</div><div className="row-sub">{s.className}</div></td>
                                         {s.history.map((status, idx) => <td key={idx} className={`cell-status ${status || ''} ${monthDays[idx].isWeekend ? 'weekend-cell' : ''}`}>{status}</td>)}
                                         <td className="summary-col present-val">{presentCount}</td><td className="summary-col absent-val">{absentCount}</td>
                                      </tr>
                                   )
                                })}
                             </tbody>
                           </table>
                        </div>
                     </div>
                   )}
                 </>
               ) : <div className="empty-state">Select classes to view registers.</div>}
            </div>
          )}

          {/* FEEDBACK (With History & Upload) */}
          {activeTab === 'feedback' && (
            <div className="feedback-view">
               <div className="feedback-container-grid">
                  <div className="form-card">
                     <h3>📝 New Report</h3>
                     <form onSubmit={sendFeedback}>
                        <div className="controls-row">
                           <div className="control-group"><label>Student</label><select value={feedbackStudent} onChange={(e) => setFeedbackStudent(e.target.value)} required><option value="">-- Choose --</option>{myStudents.map(s => <option key={s._id} value={s._id}>{s.childName}</option>)}</select></div>
                           <div className="control-group"><label>Month</label><input type="month" value={feedbackMonth} onChange={(e) => setFeedbackMonth(e.target.value)} required /></div>
                        </div>
                        <div className="control-group">
                           <label>Upload Report (PDF)</label>
                           <input type="file" accept="application/pdf" onChange={(e) => setReportFile(e.target.files[0])} className="file-input" />
                        </div>
                        <div className="control-group"><label>Rating</label><div className="star-rating">{[1,2,3,4,5].map(star => (<span key={star} onClick={() => setRating(star)} style={{color: star <= rating ? '#f59e0b' : '#e2e8f0'}}>★</span>))}</div></div>
                        <div className="control-group"><label>Remarks</label><textarea rows="4" value={feedbackText} onChange={(e) => setFeedbackText(e.target.value)} required></textarea></div>
                        <button type="submit" className="submit-feedback-btn">Send Report</button>
                     </form>
                  </div>
                  <div className="history-card">
                     <div className="history-header-row">
                        <h3>Sent History</h3>
                        <div className="month-nav-mini">
                           <button onClick={() => changeHistoryMonth(-1)}>‹</button>
                           <span>{formatMonthName(historyMonth)}</span>
                           <button onClick={() => changeHistoryMonth(1)}>›</button>
                        </div>
                     </div>
                     <div className="history-list">
                        {feedbackHistory.length === 0 ? <div className="empty-history">No reports sent in {formatMonthName(historyMonth)}.</div> : feedbackHistory.map(item => {
                           const sent = getSentiment(item.rating);
                           return (
                             <div key={item._id} className="history-item">
                                <div className="h-header">
                                   <span className="h-name">{item.studentId?.childName || 'Unknown'}</span>
                                   <span className={`h-sentiment ${sent.color}`}>{sent.label}</span>
                                </div>
                                <div className="h-rating">{'★'.repeat(item.rating)}<span className="grey">{'★'.repeat(5-item.rating)}</span></div>
                                <p className="h-text">"{item.feedbackText}"</p>
                                {item.parentComment && (<div className="teacher-reply-view"><strong>📩 Parent Reply:</strong><p>{item.parentComment}</p></div>)}
                                <div className="history-actions">
                                  {item.reportFile && <a href={`https://art-portal-7n6r.onrender.com/${item.reportFile}`} target="_blank" rel="noreferrer" className="view-pdf-link">📎 View PDF</a>}
                                  
                                  {/* ✨ EDIT BUTTON */}
                                  <button className="edit-feedback-btn" onClick={() => openEditModal(item)}>✏️ Edit</button>
                                </div>
                             </div>
                           );
                        })}
                     </div>
                  </div>
               </div>
            </div>
          )}
        </div>
      </main>

      {/* MOBILE BOTTOM NAVIGATION */}
      <nav className="mobile-bottom-nav">
        <button className={activeTab === 'overview' ? 'nav-item active' : 'nav-item'} onClick={() => handleNavClick('overview')}>
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>
        </button>
        <button className={activeTab === 'students' ? 'nav-item active' : 'nav-item'} onClick={() => handleNavClick('students')}>
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
        </button>
        <button className={activeTab === 'schedule' ? 'nav-item active' : 'nav-item'} onClick={() => handleNavClick('schedule')}>
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20a2 2 0 0 0 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zm0-12H5V6h14v2z"/></svg>
        </button>
        <button className={activeTab === 'attendance' ? 'nav-item active' : 'nav-item'} onClick={() => handleNavClick('attendance')}>
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>
        </button>
        <button className={activeTab === 'feedback' ? 'nav-item active' : 'nav-item'} onClick={() => handleNavClick('feedback')}>
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-7 12h-2v-2h2v2zm0-4h-2V6h2v4z"/></svg>
        </button>
      </nav>

      {/* MODAL */}
      {modalData && <div className="modal-overlay" onClick={() => setModalData(null)}><div className="class-detail-modal" onClick={(e) => e.stopPropagation()}><div className="modal-header"><h3>{modalData.className}</h3><button className="close-btn" onClick={() => setModalData(null)}>×</button></div><div className="modal-body"><div className="info-row"><span className="label">Time:</span><span className="value">{modalData.time}</span></div><div className="info-row"><span className="label">Level:</span><span className="value">{modalData.level}</span></div><div className="modal-actions">{modalData.meetingLink ? (!isLinkInputVisible ? <div className="launch-group"><a href={modalData.meetingLink} target="_blank" rel="noreferrer" className="launch-btn">🚀 Launch Class</a><button className="edit-link-icon" onClick={() => setIsLinkInputVisible(true)}>✏️</button></div> : <div className="link-input-group"><input type="text" placeholder="Paste Zoom Link..." value={editingLink} onChange={(e)=>setEditingLink(e.target.value)} /><button className="save-link-btn" onClick={handleSaveLink}>Save</button></div>) : <div className="link-input-group"><input type="text" placeholder="Paste Zoom Link..." value={editingLink} onChange={(e)=>setEditingLink(e.target.value)} /><button className="save-link-btn" onClick={handleSaveLink}>Save Link</button></div>}<button className="mark-att-btn" onClick={() => { setModalData(null); setActiveTab('attendance'); setSelectedClassIds([modalData._id]); setAttendanceDate(new Date().toISOString().slice(0, 10)); }}>📝 Mark Attendance</button></div></div></div></div>}

      {/* ✨ EDIT FEEDBACK MODAL */}
      {editFeedbackData && (
        <div className="modal-overlay" onClick={() => setEditFeedbackData(null)}>
          <div className="class-detail-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Edit Report: {editFeedbackData.studentName}</h3>
              <button className="close-btn" onClick={() => setEditFeedbackData(null)}>×</button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleUpdateFeedback} className="edit-form-wrapper">
                
                <div className="control-group">
                  <label>Update Remarks</label>
                  <textarea 
                    rows="3" 
                    value={editFeedbackData.feedbackText} 
                    onChange={(e) => setEditFeedbackData({...editFeedbackData, feedbackText: e.target.value})}
                    required
                  ></textarea>
                </div>

                <div className="control-group">
                  <label>Update Rating</label>
                  <div className="star-rating">
                    {[1,2,3,4,5].map(star => (
                      <span 
                        key={star} 
                        onClick={() => setEditFeedbackData({...editFeedbackData, rating: star})} 
                        style={{color: star <= editFeedbackData.rating ? '#f59e0b' : '#e2e8f0'}}
                      >★</span>
                    ))}
                  </div>
                </div>

                <div className="control-group">
                  <label>Replace PDF (Optional)</label>
                  <input 
                    type="file" 
                    accept="application/pdf" 
                    onChange={(e) => setEditFeedbackData({...editFeedbackData, newFile: e.target.files[0]})} 
                    className="file-input" 
                  />
                  {editFeedbackData.currentFile && !editFeedbackData.newFile && (
                    <small style={{display:'block', marginTop:'5px', color:'#64748b'}}>Current file: Exists</small>
                  )}
                </div>

                <button type="submit" className="submit-feedback-btn">Update Report</button>
              </form>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default TeacherDashboard;