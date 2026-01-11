import React, { useState, useEffect } from "react";
import axios from "axios";
import "./AdminDashboard.css";

// LEVELS CONFIGURATION
const LEVEL_STRUCTURE = {
  "Foundation": ["Level 1", "Level 2", "Level 3"],
  "Pre-Basic": ["Level 1", "Level 2", "Level 3"],
  "Basic": ["Level 1", "Level 2", "Level 3"],
  "Intermediate": ["Level 1", "Level 2", "Level 3"],
  "Advanced": ["Level 1", "Level 2", "Level 3"]
};

// --- MAIN DASHBOARD COMPONENT ---
const AdminDashboard = ({ onLogout }) => {
  const [activeTab, setActiveTab] = useState("overview");
  const [stats, setStats] = useState({ students: 0, teachers: 0, revenue: 0 });

  // ICONS
  const IconHome = () => (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path></svg>);
  const IconAdd = () => (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="12" y1="8" x2="12" y2="16"></line><line x1="8" y1="12" x2="16" y2="12"></line></svg>);
  const IconUsers = () => (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>);
  const IconClasses = () => (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>);
  const IconLogout = () => (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>);
  const IconFee = () => (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a4.5 4.5 0 0 0 0 9H14.5a4.5 4.5 0 0 1 0 9H5"></path></svg>);

  const fetchStats = () => {
    axios.get('http://localhost:5000/api/dashboard/stats')
      .then(res => setStats(res.data))
      .catch(err => console.error(err));
  };

  useEffect(() => { fetchStats(); }, [activeTab]);

  return (
    <div className="admin-container">
      <aside className="admin-sidebar">
        <div className="sidebar-brand"><div className="brand-logo-circle">VA</div><h3>Venky Art</h3></div>
        <nav className="sidebar-nav">
          <button className={activeTab === "overview" ? "active" : ""} onClick={() => setActiveTab("overview")}><IconHome /> <span>Dashboard</span></button>
          <button className={activeTab === "users" ? "active" : ""} onClick={() => setActiveTab("users")}><IconUsers /> <span>User Management</span></button>
          <button className={activeTab === "classes" ? "active" : ""} onClick={() => setActiveTab("classes")}><IconClasses /> <span>Class Management</span></button>
          <button className={activeTab === "add-user" ? "active" : ""} onClick={() => setActiveTab("add-user")}><IconAdd /> <span>Register User</span></button>
          <button className={activeTab === "fees" ? "active" : ""} onClick={() => setActiveTab("fees")}><IconFee /> <span>Fee Tracker</span></button>
        </nav>
        <div className="sidebar-footer"><p>Admin Portal v1.0</p></div>
      </aside>
      <main className="admin-main">
        <header className="top-header">
          <div className="header-title">
            <h2>{activeTab === "overview" ? "Overview" : activeTab === "users" ? "All Users" : activeTab === "classes" ? "Class Management" : activeTab === "fees" ? "Fee Tracker" : "Register User"}</h2>
            <p>Welcome back, Admin</p>
          </div>
          <div className="header-actions">
            <div className="user-profile-pill"><img src="https://ui-avatars.com/api/?name=Admin+User&background=00bfa5&color=fff" alt="Profile" /><span>Super Admin</span></div>
            <button onClick={onLogout} className="header-logout-btn" title="Logout"><IconLogout /></button>
          </div>
        </header>
        <div className="content-scrollable">
          {activeTab === "overview" && <OverviewTab stats={stats} />}
          {activeTab === "users" && <UserManagementTab />}
          {activeTab === "classes" && <ClassManagementTab />}
          {activeTab === "add-user" && <AddUserTab />}
          {activeTab === "fees" && <FeeTrackerTab />}
        </div>
      </main>
    </div>
  );
};

// --- TAB 1: OVERVIEW ---
const OverviewTab = ({ stats }) => (
  <div className="stats-grid">
    <div className="stat-card blue"><h3>Total Students</h3><div className="stat-value-row"><span className="stat-number">{stats.students}</span><div className="stat-icon-bg">🎓</div></div></div>
    <div className="stat-card green"><h3>Active Teachers</h3><div className="stat-value-row"><span className="stat-number">{stats.teachers}</span><div className="stat-icon-bg">🎨</div></div></div>
    <div className="stat-card purple"><h3>Est. Monthly Revenue</h3><div className="stat-value-row"><span className="stat-number" style={{color: '#16a34a'}}>₹{stats.revenue ? stats.revenue.toLocaleString('en-IN') : 0}</span><div className="stat-icon-bg">💰</div></div></div>
  </div>
);

// --- TAB 4: CLASS MANAGEMENT ---
const ClassManagementTab = () => {
  const [classes, setClasses] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [selectedClass, setSelectedClass] = useState(null); 
  const [showClassModal, setShowClassModal] = useState({ show: false, isEdit: false });
  const [assignModal, setAssignModal] = useState({ show: false, classId: null, className: '' });
  const [deleteClassModal, setDeleteClassModal] = useState({ show: false, classId: null });
  const [toast, setToast] = useState({ show: false, message: '', type: '' });
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState('newest'); 

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const classRes = await axios.get('http://localhost:5000/api/classes');
      setClasses(classRes.data);
      const userRes = await axios.get('http://localhost:5000/api/users');
      setTeachers(userRes.data.filter(u => u.role === 'teacher'));
      return classRes.data; 
    } catch (err) { 
      console.error(err); 
      return [];
    }
  };

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: '' }), 3000);
  };

  const handleClassSaved = async () => {
    setShowClassModal({ show: false, isEdit: false });
    const updatedClasses = await fetchData();
    if (selectedClass) {
        const refreshed = updatedClasses.find(c => c._id === selectedClass._id);
        if (refreshed) setSelectedClass(refreshed);
    }
    showToast("Class saved successfully!", "success");
  };

  const initiateDeleteClass = (classId) => { setDeleteClassModal({ show: true, classId }); };

  const confirmClassDelete = async () => {
    try {
      await axios.delete(`http://localhost:5000/api/classes/${deleteClassModal.classId}`);
      await fetchData();
      setDeleteClassModal({ show: false, classId: null }); 
      setSelectedClass(null); 
      showToast("Class deleted successfully!", "success");
    } catch(err) { showToast("Error deleting class", "error"); }
  };

  const filteredClasses = classes.filter(cls => {
    const term = searchTerm.toLowerCase();
    const matchesBasic = cls.className.toLowerCase().includes(term) || cls.level.toLowerCase().includes(term);
    const teacherName = cls.teacher ? (cls.teacher.fullName || cls.teacher.username) : "";
    const matchesTeacher = teacherName.toLowerCase().includes(term);
    const matchesStudent = cls.students.some(s => (s.childName && s.childName.toLowerCase().includes(term)) || (s.fullName && s.fullName.toLowerCase().includes(term)));
    return matchesBasic || matchesTeacher || matchesStudent;
  });

  const sortedClasses = [...filteredClasses].sort((a, b) => {
    if (sortOrder === 'newest') return new Date(b.createdAt) - new Date(a.createdAt);
    if (sortOrder === 'oldest') return new Date(a.createdAt) - new Date(b.createdAt);
    if (sortOrder === 'name-asc') return a.className.localeCompare(b.className);
    if (sortOrder === 'most-students') return b.students.length - a.students.length;
    if (sortOrder === 'least-students') return a.students.length - b.students.length;
    return 0;
  });

  return (
    <>
      <div className={`toast-notification ${toast.type} ${toast.show ? 'show' : ''}`}>
        {toast.type === 'success' ? '✅' : '❌'} {toast.message}
      </div>

      {selectedClass ? (
        <ClassDetailsView 
          cls={selectedClass} 
          onBack={() => setSelectedClass(null)}
          onEdit={() => setShowClassModal({ show: true, isEdit: true })}
          onDelete={() => initiateDeleteClass(selectedClass._id)}
          onAssign={() => setAssignModal({ show: true, classId: selectedClass._id, className: selectedClass.className })}
        />
      ) : (
        <div className="table-wrapper">
          <div className="filter-bar">
             <div className="search-box">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                <input type="text" placeholder="Search Class, Student, Level..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
             </div>
             <div className="filter-actions">
               <div className="filter-dropdown">
                 <label>Sort By:</label>
                 <select value={sortOrder} onChange={(e) => setSortOrder(e.target.value)}>
                   <option value="newest">Newest First</option>
                   <option value="oldest">Oldest First</option>
                   <option value="name-asc">Name (A-Z)</option>
                   <option value="most-students">Most Students</option>
                   <option value="least-students">Least Students</option>
                 </select>
               </div>
               <button className="save-btn" style={{width:'auto', padding: '8px 16px', height:'38px', display:'flex', alignItems:'center'}} onClick={() => setShowClassModal({ show: true, isEdit: false })}>+ New Class</button>
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
                  <tr><td colSpan="5" style={{textAlign:'center', padding:'30px', color: '#94a3b8'}}>No classes found matching "{searchTerm}".</td></tr>
                ) : (
                  sortedClasses.map(cls => (
                    <tr key={cls._id} onClick={() => setSelectedClass(cls)} className="user-row">
                      <td style={{fontWeight:'600', color:'#0284c7'}}>{cls.className}</td>
                      <td>
                        <span className="level-badge">{cls.level}</span>
                        {cls.subLevel && <span style={{marginLeft: '8px', fontSize: '0.85rem', color: '#64748b'}}>({cls.subLevel})</span>}
                      </td>
                      <td>{cls.teacher ? (cls.teacher.fullName || cls.teacher.username) : <span style={{color:'red'}}>Unassigned</span>}</td>
                      <td><span className="student-count-badge">{cls.students.length} Students</span></td>
                      <td><span style={{color:'#64748b', fontSize:'0.9rem'}}>View Details →</span></td>
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
          onSuccess={async () => {
             setAssignModal({ show: false, classId: null });
             const updatedClasses = await fetchData();
             if (selectedClass) {
               const refreshed = updatedClasses.find(c => c._id === selectedClass._id);
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
             <p style={{color: '#64748b', marginBottom: '20px', lineHeight: '1.5'}}>
               Are you sure you want to delete this class? <br/>
               <strong style={{color: '#ef4444'}}>This will unassign all students.</strong>
             </p>
             <div className="modal-actions">
               <button className="cancel-btn" onClick={() => setDeleteClassModal({ show: false, classId: null })}>Cancel</button>
               <button className="confirm-delete-btn" onClick={confirmClassDelete}>Yes, Delete</button>
             </div>
          </div>
        </div>
      )}
    </>
  );
};

// --- COMPONENT: CLASS DETAILS VIEW (With Schedule & Copy Link) ---
const ClassDetailsView = ({ cls, onBack, onEdit, onDelete, onAssign }) => {
  const [copyStatus, setCopyStatus] = useState("Copy Meeting Link 📋");

  const handleCopyLink = () => {
    if (cls.meetingLink) {
      navigator.clipboard.writeText(cls.meetingLink);
      setCopyStatus("Link Copied! ✅");
      setTimeout(() => setCopyStatus("Copy Meeting Link 📋"), 2000);
    }
  };

  return (
    <div className="object-page">
      <div className="object-header">
        <button className="back-btn" onClick={onBack}>← Back to Classes</button>
        <div className="header-content">
          <div className="header-avatar" style={{background:'#06b6d4', fontSize:'1.5rem'}}>📚</div>
          <div>
            <h1>{cls.className}</h1>
            <div style={{display:'flex', gap:'10px', alignItems:'center'}}>
                <span className="level-badge" style={{fontSize:'0.9rem'}}>{cls.level}</span>
                {cls.subLevel && <span style={{fontSize:'0.9rem', color:'#64748b', fontWeight:'600'}}>• {cls.subLevel}</span>}
            </div>
          </div>
          <div style={{marginLeft:'auto', display:'flex', gap:'10px'}}>
             <button className="edit-btn" onClick={(e) => { e.stopPropagation(); onEdit(); }} style={{background:'#eff6ff', padding:'10px 20px', fontSize:'1rem'}}>Edit Class</button>
             <button className="delete-btn-large" onClick={(e) => { e.stopPropagation(); onDelete(); }}>Delete Class</button>
          </div>
        </div>
      </div>

      <div className="object-body-grid">
        <div className="top-row-grid">
           
           <div className="detail-card">
             <h3>Schedule & Link</h3>
             <div style={{marginBottom:'15px'}}>
                {cls.schedule && cls.schedule.length > 0 ? (
                    cls.schedule.map((slot, i) => (
                        <div key={i} style={{display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid #f1f5f9'}}>
                            <span style={{fontWeight:'600', color:'#334155'}}>{slot.day}</span>
                            <span style={{color:'#64748b'}}>{slot.time}</span>
                        </div>
                    ))
                ) : <span style={{color:'#94a3b8'}}>No schedule set</span>}
             </div>
             
             {cls.meetingLink ? (
                 <div style={{display:'flex', flexDirection:'column', gap:'10px'}}>
                    <div style={{background:'#f1f5f9', padding:'8px', borderRadius:'4px', fontSize:'0.85rem', color:'#64748b', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>
                      {cls.meetingLink}
                    </div>
                    <button 
                      onClick={handleCopyLink} 
                      className="save-btn" 
                      style={{
                        display:'block', 
                        width:'100%', 
                        textAlign:'center', 
                        backgroundColor: copyStatus.includes('✅') ? '#10b981' : '#0284c7', 
                        transition: 'background-color 0.2s'
                      }}
                    >
                      {copyStatus}
                    </button>
                 </div>
             ) : <div style={{color:'#94a3b8', fontStyle:'italic'}}>No meeting link provided</div>}
           </div>
           
           <div className="detail-card">
             <h3>Class Info</h3>
             <div className="info-row"><label>Teacher:</label> <span>{cls.teacher ? (cls.teacher.fullName || cls.teacher.username) : "Unassigned"}</span></div>
             <div className="info-row"><label>Total Students:</label> <span>{cls.students.length}</span></div>
             <div className="info-row"><label>Created:</label> <span>{new Date(cls.createdAt).toLocaleDateString()}</span></div>
           </div>
        </div>

        <div className="detail-card full-width-card">
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
             <h3>Enrolled Students</h3>
             <button className="save-btn" style={{width:'auto', fontSize:'0.9rem'}} onClick={onAssign}>Manage Students</button>
          </div>
          {cls.students.length === 0 ? (
            <p style={{color:'#94a3b8', padding:'20px', textAlign:'center'}}>No students assigned.</p>
          ) : (
            <div className="table-container">
              <table className="custom-table">
                <thead><tr><th>Student Name</th><th>Parent Name</th><th>Age</th><th>Joining Date</th></tr></thead>
                <tbody>
                  {cls.students.map(student => (
                    <tr key={student._id}>
                      <td style={{fontWeight:'bold'}}>{student.childName}</td>
                      <td>{student.fullName}</td>
                      <td>{student.childAge || '-'}</td>
                      <td>{student.joiningDate ? new Date(student.joiningDate).toLocaleDateString() : '-'}</td>
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

// --- COMPONENT: CLASS MODAL (Strict Validation + Schedule + Link) ---
const ClassModal = ({ teachers, existingClasses, initialData, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({ 
    className: initialData ? initialData.className : '', 
    level: initialData ? initialData.level : '', 
    subLevel: initialData ? initialData.subLevel : '', 
    teacherId: initialData && initialData.teacher ? initialData.teacher._id : '',
    meetingLink: initialData ? initialData.meetingLink : '',
    schedule: initialData && initialData.schedule && initialData.schedule.length > 0 
      ? initialData.schedule 
      : [{ day: 'Saturday', time: '10:00' }, { day: 'Wednesday', time: '17:00' }]
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
      if (!formData.className || !formData.level) { setDuplicateError(""); return; }
      const normalize = (str) => (str || "").toString().trim().toLowerCase();
      const isDuplicate = existingClasses.some(cls => {
          if (initialData && cls._id === initialData._id) return false;
          return normalize(cls.className) === normalize(formData.className) &&
                 normalize(cls.level) === normalize(formData.level) &&
                 normalize(cls.subLevel) === normalize(formData.subLevel);
      });
      if (isDuplicate) setDuplicateError(`A class named "${formData.className}" already exists in this level.`);
      else setDuplicateError("");
    };
    checkDuplicate();
  }, [formData.className, formData.level, formData.subLevel, existingClasses, initialData]);

  const handleScheduleChange = (index, field, value) => {
    const newSchedule = [...formData.schedule];
    newSchedule[index][field] = value;
    setFormData({ ...formData, schedule: newSchedule });
  };

  const addScheduleSlot = () => {
    setFormData({ ...formData, schedule: [...formData.schedule, { day: 'Monday', time: '17:00' }] });
  };

  const removeScheduleSlot = (index) => {
    const newSchedule = formData.schedule.filter((_, i) => i !== index);
    setFormData({ ...formData, schedule: newSchedule });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (duplicateError) return;
    try {
      if (initialData) await axios.put(`http://localhost:5000/api/classes/${initialData._id}`, formData);
      else await axios.post('http://localhost:5000/api/classes', formData);
      onSuccess();
    } catch (err) { alert("Error saving class"); }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{maxWidth:'600px'}}>
        <div className="modal-header"><h3>{initialData ? 'Edit Class' : 'Create New Class'}</h3><button className="close-modal" onClick={onClose}>×</button></div>
        <form onSubmit={handleSubmit}>
          
          <div className="form-group"><label>Class Name</label><input required value={formData.className} onChange={e => setFormData({...formData, className: e.target.value})} className={duplicateError ? "input-error" : ""} /></div>
          
          <div className="form-row">
            <div className="form-group">
                <label>Level</label>
                <select required value={formData.level} onChange={e => setFormData({...formData, level: e.target.value, subLevel: ""})} className={duplicateError ? "input-error" : ""}>
                <option value="">Select Level</option>{Object.keys(LEVEL_STRUCTURE).map(lvl => <option key={lvl} value={lvl}>{lvl}</option>)}
                </select>
            </div>
            <div className="form-group">
                <label>Sub-Level</label>
                <select required value={formData.subLevel} onChange={e => setFormData({...formData, subLevel: e.target.value})} disabled={!formData.level} className={duplicateError ? "input-error" : ""}>
                <option value="">Select Sub-Level</option>{availableSubLevels.map(sub => <option key={sub} value={sub}>{sub}</option>)}
                </select>
            </div>
          </div>
          
          {duplicateError && <div className="error-msg">{duplicateError}</div>}

          <div className="form-group" style={{background:'#f8fafc', padding:'15px', borderRadius:'8px', marginTop:'15px', border:'1px solid #e2e8f0'}}>
            <label style={{color:'#334155', fontWeight:'600'}}>Class Schedule (2 Classes/Week)</label>
            {formData.schedule.map((slot, index) => (
                <div key={index} style={{display:'flex', gap:'10px', marginTop:'10px', alignItems:'center'}}>
                    <select value={slot.day} onChange={(e) => handleScheduleChange(index, 'day', e.target.value)} style={{flex:1}}>
                        {['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'].map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                    <input type="time" value={slot.time} onChange={(e) => handleScheduleChange(index, 'time', e.target.value)} style={{flex:1}} />
                    <button type="button" onClick={() => removeScheduleSlot(index)} style={{background:'none', border:'none', color:'#ef4444', cursor:'pointer'}}>✕</button>
                </div>
            ))}
            <button type="button" onClick={addScheduleSlot} style={{marginTop:'10px', fontSize:'0.85rem', color:'#0284c7', background:'none', border:'none', cursor:'pointer'}}>+ Add Another Day</button>
          </div>

          <div className="form-group" style={{marginTop:'15px'}}>
            <label>Meeting Link (Zoom / Meet)</label>
            <input placeholder="https://zoom.us/j/..." value={formData.meetingLink} onChange={e => setFormData({...formData, meetingLink: e.target.value})} />
          </div>

          <div className="form-group"><label>Assign Teacher</label><select required value={formData.teacherId} onChange={e => setFormData({...formData, teacherId: e.target.value})}><option value="">Select Teacher</option>{teachers.map(t => (<option key={t._id} value={t._id}>{t.fullName || t.username}</option>))}</select></div>
          
          <button type="submit" className="save-btn" style={{marginTop:'15px'}} disabled={!!duplicateError}>{initialData ? 'Save Changes' : 'Create Class'}</button>
        </form>
      </div>
    </div>
  );
};

// --- COMPONENT: ASSIGN STUDENTS MODAL ---
const AssignStudentsModal = ({ classId, className, onClose, onSuccess }) => {
  const [students, setStudents] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadStudents = async () => {
      const res = await axios.get('http://localhost:5000/api/users');
      const studentList = res.data.filter(u => u.role === 'parent');
      setStudents(studentList);
      const alreadyInClass = studentList.filter(s => s.assignedClass === classId).map(s => s._id);
      setSelectedIds(alreadyInClass);
      setLoading(false);
    };
    loadStudents();
  }, [classId]);

  const toggleStudent = (id, isDisabled) => {
    if (isDisabled) return;
    if (selectedIds.includes(id)) { setSelectedIds(selectedIds.filter(sid => sid !== id)); } 
    else { setSelectedIds([...selectedIds, id]); }
  };

  const handleSave = async () => {
    try { await axios.post(`http://localhost:5000/api/classes/${classId}/assign`, { studentIds: selectedIds }); onSuccess(); } 
    catch (err) { alert("Failed to assign students"); }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{maxWidth:'600px'}}>
        <div className="modal-header"><h3>Assign to: {className}</h3><button className="close-modal" onClick={onClose}>×</button></div>
        <div className="student-checklist" style={{maxHeight:'300px', overflowY:'auto', border:'1px solid #eee', padding:'10px', borderRadius:'6px'}}>
          {loading ? <p>Loading...</p> : students.map(student => {
            const isAssignedElsewhere = student.assignedClass && student.assignedClass !== classId;
            const isSelected = selectedIds.includes(student._id);
            return (
              <div key={student._id} className={`student-check-item ${isAssignedElsewhere ? 'disabled' : ''} ${isSelected ? 'selected' : ''}`} onClick={() => toggleStudent(student._id, isAssignedElsewhere)}>
                <div style={{display:'flex', alignItems:'center', gap:'10px'}}>
                  <div className={`checkbox-circle ${isSelected ? 'checked' : ''}`}>{isSelected && '✓'}</div>
                  <div><div style={{fontWeight:'600'}}>{student.childName}</div><div style={{fontSize:'12px', color:'#666'}}>Parent: {student.fullName}</div></div>
                </div>
                {isAssignedElsewhere && <span className="tag-assigned">In Other Class</span>}
              </div>
            );
          })}
        </div>
        <div className="modal-actions" style={{marginTop:'20px'}}><button className="cancel-btn" onClick={onClose}>Cancel</button><button className="save-btn" style={{width:'auto'}} onClick={handleSave}>Save Assignments</button></div>
      </div>
    </div>
  );
};

// --- TAB 2: USER MANAGEMENT ---
const UserManagementTab = () => {
  const [users, setUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [sortOrder, setSortOrder] = useState('newest'); 
  const [selectedUser, setSelectedUser] = useState(null);
  const [editingUser, setEditingUser] = useState(null);
  const [deleteModal, setDeleteModal] = useState({ show: false, userId: null });
  const [toast, setToast] = useState({ show: false, message: '', type: '' });
  const [showColMenu, setShowColMenu] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState(() => {
    const savedColumns = localStorage.getItem('admin_visible_columns');
    return savedColumns ? JSON.parse(savedColumns) : { name: true, role: true, fee: true, joiningDate: true, status: true, action: true };
  });

  useEffect(() => { fetchUsers(); }, []);
  const fetchUsers = () => { axios.get('http://localhost:5000/api/users').then(res => setUsers(res.data)).catch(err => console.error(err)); };
  const showToast = (message, type = 'success') => { setToast({ show: true, message, type }); setTimeout(() => setToast({ show: false, message: '', type: '' }), 3000); };
  const initiateDelete = (e, userId) => { if (e && e.stopPropagation) e.stopPropagation(); setDeleteModal({ show: true, userId }); };
  const confirmDelete = async () => {
    try { await axios.delete(`http://localhost:5000/api/users/${deleteModal.userId}`); setUsers(users.filter(user => user._id !== deleteModal.userId)); showToast('User deleted successfully!', 'success'); setDeleteModal({ show: false, userId: null }); setSelectedUser(null); } 
    catch (err) { showToast('Failed to delete user.', 'error'); setDeleteModal({ show: false, userId: null }); }
  };
  const handleToggleStatus = async (e, userId, currentStatus) => {
    e.stopPropagation(); try { await axios.put(`http://localhost:5000/api/users/${userId}/status`); setUsers(users.map(user => user._id === userId ? { ...user, isActive: !currentStatus } : user)); showToast('Status updated', 'success'); } catch (err) { showToast('Error', 'error'); }
  };
  const handleEditClick = (e, user) => { e.stopPropagation(); setEditingUser(user); };
  const handleEditSave = async (updatedData) => {
    try { await axios.put(`http://localhost:5000/api/users/${updatedData._id}`, updatedData); setUsers(users.map(u => (u._id === updatedData._id ? updatedData : u))); if (selectedUser && selectedUser._id === updatedData._id) { setSelectedUser(updatedData); } setEditingUser(null); showToast('User details updated!', 'success'); } 
    catch (err) { showToast('Failed to update user.', 'error'); }
  };
  const toggleColumn = (key) => { setVisibleColumns(prev => { const newState = { ...prev, [key]: !prev[key] }; localStorage.setItem('admin_visible_columns', JSON.stringify(newState)); return newState; }); };
  
  const filteredUsers = users.filter(user => {
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    const searchLower = searchTerm.toLowerCase();
    return matchesRole && ((user.username && user.username.toLowerCase().includes(searchLower)) || (user.fullName && user.fullName.toLowerCase().includes(searchLower)) || (user.email && user.email.toLowerCase().includes(searchLower)) || (user.phone && user.phone.includes(searchLower)) || (user.location && user.location.toLowerCase().includes(searchLower)) || (user.childName && user.childName.toLowerCase().includes(searchLower)));
  });
  const sortedUsers = [...filteredUsers].sort((a, b) => { if (sortOrder === 'newest') return new Date(b.createdAt) - new Date(a.createdAt); if (sortOrder === 'oldest') return new Date(a.createdAt) - new Date(b.createdAt); if (sortOrder === 'fee-high') return (b.monthlyFee || 0) - (a.monthlyFee || 0); if (sortOrder === 'fee-low') return (a.monthlyFee || 0) - (b.monthlyFee || 0); return 0; });

  return (
    <>
      <div className={`toast-notification ${toast.type} ${toast.show ? 'show' : ''}`}>{toast.type === 'success' ? '✅' : '❌'} {toast.message}</div>
      {selectedUser ? (<UserDetailsView user={selectedUser} onBack={() => setSelectedUser(null)} onDelete={() => initiateDelete(null, selectedUser._id)} />) : (
        <div className="table-wrapper">
           <div className="filter-bar">
              <div className="search-box"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg><input type="text" placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} /></div>
              <div className="filter-actions">
                <div className="filter-dropdown"><label>Role:</label><select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}><option value="all">All Users</option><option value="parent">Students</option><option value="teacher">Teachers</option><option value="admin">Admins</option></select></div>
                <div className="filter-dropdown"><label>Sort:</label><select value={sortOrder} onChange={(e) => setSortOrder(e.target.value)}><option value="newest">Newest First</option><option value="oldest">Oldest First</option><option value="fee-high">Highest Fee</option><option value="fee-low">Lowest Fee</option></select></div>
                <div style={{ position: 'relative' }}><button className="customize-btn" onClick={() => setShowColMenu(!showColMenu)} title="Customize Columns"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3h7a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-7m0-18H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h7m0-18v18"></path></svg></button>{showColMenu && (<div className="column-menu-dropdown"><h4>Show Columns</h4><label><input type="checkbox" checked={visibleColumns.name} onChange={() => toggleColumn('name')} /> Name / ID</label><label><input type="checkbox" checked={visibleColumns.role} onChange={() => toggleColumn('role')} /> Role</label><label><input type="checkbox" checked={visibleColumns.fee} onChange={() => toggleColumn('fee')} /> Fee / Salary</label><label><input type="checkbox" checked={visibleColumns.joiningDate} onChange={() => toggleColumn('joiningDate')} /> Joining Date</label><label><input type="checkbox" checked={visibleColumns.status} onChange={() => toggleColumn('status')} /> Status</label><label><input type="checkbox" checked={visibleColumns.action} onChange={() => toggleColumn('action')} /> Actions</label></div>)}</div>
              </div>
           </div>
           <div className="table-container">
            <table className="custom-table clickable-rows">
              <thead><tr>{visibleColumns.name && <th>Name / ID</th>}{visibleColumns.role && <th>Role</th>}{visibleColumns.fee && <th>Fee / Salary</th>}{visibleColumns.joiningDate && <th>Joining Date</th>}{visibleColumns.status && <th>Status</th>}{visibleColumns.action && <th>Action</th>}</tr></thead>
              <tbody>
                {sortedUsers.map((user) => (
                  <tr key={user._id} onClick={() => setSelectedUser(user)} className="user-row">
                    {visibleColumns.name && (<td><div style={{fontWeight: '600', color: '#333'}}>{user.fullName || user.username}</div><div style={{fontSize: '12px', color: '#888'}}>{user.role === 'parent' ? `Student: ${user.childName}` : user.location || "No Location"}</div></td>)}
                    {visibleColumns.role && (<td><span className={`role-badge ${user.role}`}>{user.role}</span></td>)}
                    {visibleColumns.fee && (<td>{user.role === 'parent' ? (<span style={{color: '#16a34a', fontWeight: 'bold'}}>₹{user.monthlyFee || 0}</span>) : user.role === 'teacher' ? (<span style={{color: '#9333ea', fontWeight: 'bold'}}>₹{user.monthlyFee || 0}</span>) : '-'}</td>)}
                    {visibleColumns.joiningDate && (<td>{user.joiningDate ? new Date(user.joiningDate).toLocaleDateString() : '-'}</td>)}
                    {visibleColumns.status && (<td><button className={`status-btn ${user.isActive ? 'active' : 'inactive'}`} onClick={(e) => handleToggleStatus(e, user._id, user.isActive)}>{user.isActive ? 'Active' : 'Inactive'}</button></td>)}
                    {visibleColumns.action && (<td className="action-cell"><button className="edit-btn" onClick={(e) => handleEditClick(e, user)} title="Edit"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg></button><button className="delete-btn" onClick={(e) => initiateDelete(e, user._id)} title="Delete"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg></button></td>)}
                  </tr>
                ))}
              </tbody>
            </table>
           </div>
        </div>
      )}
      {deleteModal.show && (<div className="modal-overlay"><div className="modal-content delete-modal-content"><h3>Are you sure?</h3><div className="modal-actions"><button className="cancel-btn" onClick={() => setDeleteModal({ show: false, userId: null })}>Cancel</button><button className="confirm-delete-btn" onClick={confirmDelete}>Yes, Delete</button></div></div></div>)}
      {editingUser && (<EditUserModal user={editingUser} onClose={() => setEditingUser(null)} onSave={handleEditSave} />)}
    </>
  );
};

const formatDateForInput = (isoDate) => { if (!isoDate) return ""; const date = new Date(isoDate); return date.toISOString().split('T')[0]; };

const EditUserModal = ({ user, onClose, onSave }) => {
  const [formData, setFormData] = useState({ ...user, joiningDate: formatDateForInput(user.joiningDate), childDob: formatDateForInput(user.childDob), dob: formatDateForInput(user.dob) });
  const handleChange = (e) => { setFormData({ ...formData, [e.target.name]: e.target.value }); };
  const handleSubmit = (e) => { e.preventDefault(); onSave(formData); };
  return (
    <div className="modal-overlay"><div className="modal-content" style={{ maxWidth: '600px' }}><div className="modal-header"><h3>Edit Details: {user.username}</h3><button className="close-modal" onClick={onClose} style={{background:'none', border:'none', fontSize:'1.5rem', cursor:'pointer'}}>×</button></div><form onSubmit={handleSubmit}><div className="edit-form-grid"><div className="form-group"><label>Full Name</label><input name="fullName" value={formData.fullName || ''} onChange={handleChange} /></div><div className="form-group"><label>Phone Number</label><input name="phone" value={formData.phone || ''} onChange={handleChange} /></div><div className="form-group"><label>Email</label><input name="email" value={formData.email || ''} onChange={handleChange} /></div><div className="form-group"><label>Location</label><input name="location" value={formData.location || ''} onChange={handleChange} /></div>{user.role !== 'admin' && <><div className="form-group"><label>Zoom ID</label><input name="zoomId" value={formData.zoomId || ''} onChange={handleChange} /></div><div className="form-group"><label>Referred By</label><input name="referredBy" value={formData.referredBy || ''} onChange={handleChange} /></div></>}</div><div style={{ background: '#f8fafc', padding: '15px', borderRadius: '8px', marginBottom: '20px' }}>{user.role === 'parent' ? (<><h4 style={{ margin: '0 0 10px 0', color: '#0284c7' }}>Student Info</h4><div className="edit-form-grid"><div className="form-group"><label>Child Name</label><input name="childName" value={formData.childName || ''} onChange={handleChange} /></div><div className="form-group"><label>Monthly Fee (₹)</label><input type="number" name="monthlyFee" value={formData.monthlyFee || ''} onChange={handleChange} style={{ fontWeight: 'bold', color: '#16a34a' }} /></div><div className="form-group"><label>Child Age</label><input name="childAge" value={formData.childAge || ''} onChange={handleChange} /></div><div className="form-group"><label>Date of Birth</label><input type="date" name="childDob" value={formData.childDob || ''} onChange={handleChange} /></div><div className="form-group"><label>Class/Grade</label><input name="childClass" value={formData.childClass || ''} onChange={handleChange} /></div><div className="form-group"><label>Joining Date</label><input type="date" name="joiningDate" value={formData.joiningDate || ''} onChange={handleChange} /></div></div></>) : user.role === 'teacher' ? (<><h4 style={{ margin: '0 0 10px 0', color: '#9333ea' }}>Teacher Info</h4><div className="edit-form-grid"><div className="form-group"><label>Specialization</label><input name="specialization" value={formData.specialization || ''} onChange={handleChange} /></div><div className="form-group"><label>Monthly Salary (₹)</label><input type="number" name="monthlyFee" value={formData.monthlyFee || ''} onChange={handleChange} style={{ fontWeight: 'bold', color: '#9333ea' }} /></div><div className="form-group"><label>Date of Birth</label><input type="date" name="childDob" value={formData.childDob || ''} onChange={handleChange} /></div><div className="form-group"><label>Joining Date</label><input type="date" name="joiningDate" value={formData.joiningDate || ''} onChange={handleChange} /></div></div></>) : (<><h4 style={{ margin: '0 0 10px 0', color: '#334155' }}>Admin Info</h4><div className="edit-form-grid"><div className="form-group"><label>Specialization / Role</label><input name="specialization" value={formData.specialization || ''} onChange={handleChange} /></div><div className="form-group"><label>Date of Birth</label><input type="date" name="dob" value={formData.dob || ''} onChange={handleChange} /></div><div className="form-group"><label>Joining Date</label><input type="date" name="joiningDate" value={formData.joiningDate || ''} onChange={handleChange} /></div></div></>)}</div><div className="modal-actions" style={{justifyContent: 'flex-end'}}><button type="button" className="cancel-btn" onClick={onClose} style={{marginRight:'10px'}}>Cancel</button><button type="submit" className="save-btn" style={{width: 'auto', padding: '10px 25px'}}>Save Changes</button></div></form></div></div>
  );
};

const UserDetailsView = ({ user, onBack, onDelete }) => {
  const [credentials, setCredentials] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [loadingCreds, setLoadingCreds] = useState(false);
  const [copyMsg, setCopyMsg] = useState("");
  const handleToggleCredentials = async () => { if (!credentials) { setLoadingCreds(true); try { const res = await axios.get(`http://localhost:5000/api/users/${user._id}/credentials`); setCredentials(res.data); setShowPassword(true); } catch (err) { console.error("Error fetching creds", err); } finally { setLoadingCreds(false); } } else { setShowPassword(!showPassword); } };
  const handleCopy = (text) => { navigator.clipboard.writeText(text); setCopyMsg("Copied!"); setTimeout(() => setCopyMsg(""), 2000); };
  const displayDob = user.role === 'admin' ? user.dob : user.childDob;
  return (
    <div className="object-page">
      <div className="object-header"><button className="back-btn" onClick={onBack}>← Back to List</button><div className="header-content"><div className="header-avatar">{user.username.charAt(0).toUpperCase()}</div><div><h1>{user.fullName || user.username}</h1><span className={`role-badge ${user.role}`}>{user.role}</span><span className="joined-date">Joined: {user.joiningDate ? new Date(user.joiningDate).toLocaleDateString() : new Date(user.createdAt).toLocaleDateString()}</span></div><button className="delete-btn-large" onClick={onDelete}>Delete User</button></div></div>
      <div className="object-body-grid">
        <div className="top-row-grid">
            <div className="detail-card" style={{ borderLeft: "4px solid #3b82f6" }}><div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'15px'}}><h3>Login Credentials</h3>{copyMsg && <span style={{fontSize:'12px', color:'#10b981', fontWeight:'bold'}}>{copyMsg}</span>}</div><div className="credential-box" style={{ background: "#f8fafc", padding: "15px", borderRadius: "8px" }}><div style={{ marginBottom: "10px", display: "flex", justifyContent: "space-between" }}><div><span style={{ fontSize: "12px", color: "#64748b" }}>Username</span><strong style={{ display:'block', fontSize: "16px", color: "#334155" }}>{user.username}</strong></div><button onClick={() => handleCopy(user.username)} className="icon-btn" title="Copy Username">📋</button></div><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><div><span style={{ fontSize: "12px", color: "#64748b" }}>Password</span>{loadingCreds ? <span style={{fontSize:'12px', color:'#999'}}>Fetching...</span> : showPassword && credentials ? <strong style={{ display:'block', fontSize: "16px", fontFamily: 'monospace' }}>{credentials.password}</strong> : <strong style={{ display:'block', fontSize: "16px", letterSpacing: "2px" }}>••••••••</strong>}</div><div style={{ display: 'flex', gap: '5px' }}><button onClick={handleToggleCredentials} className="icon-btn" style={{ color: '#0284c7' }}>{showPassword ? "👁️‍🗨️" : "👁️"}</button>{showPassword && credentials && <button onClick={() => handleCopy(credentials.password)} className="icon-btn" title="Copy Password">📋</button>}</div></div></div></div>
            <div className="detail-card"><h3>Contact Information</h3><div className="info-row"><label>Email:</label> <span>{user.email || "N/A"}</span></div><div className="info-row"><label>Phone:</label> <span>{user.phone || "N/A"}</span></div><div className="info-row"><label>Location:</label> <span>{user.location || "N/A"}</span></div><div className="info-row"><label>Zoom ID:</label> <span>{user.zoomId || "N/A"}</span></div></div>
        </div>
        <div className="detail-card full-width-card"><h3>{user.role === "parent" ? "Student Details" : "Professional Details"}</h3><div className="details-grid-layout"><div className="info-col"><div className="info-row"><label>Joining Date:</label> <span style={{ fontWeight: 'bold' }}>{user.joiningDate ? new Date(user.joiningDate).toLocaleDateString() : 'N/A'}</span></div>{user.role === "parent" ? (<><div className="info-row"><label>Child Name:</label> <span>{user.childName || "N/A"}</span></div><div className="info-row"><label>Date of Birth:</label> <span>{user.childDob ? new Date(user.childDob).toLocaleDateString() : 'N/A'}</span></div></>) : (<><div className="info-row"><label>Specialization:</label> <span>{user.specialization || "N/A"}</span></div><div className="info-row"><label>Date of Birth:</label> <span>{displayDob ? new Date(displayDob).toLocaleDateString() : 'N/A'}</span></div></>)}</div><div className="info-col">{user.role === "parent" ? (<><div className="info-row"><label>Age:</label> <span>{user.childAge || "N/A"}</span></div><div className="info-row"><label>Class:</label> <span>{user.childClass || "N/A"}</span></div><div className="info-row"><label>Monthly Fee:</label><span style={{ color: "#16a34a", fontWeight: "bold", fontSize: "16px" }}>₹{user.monthlyFee || 0}</span></div></>) : user.role === "teacher" ? (<div className="info-row"><label>Monthly Salary:</label><span style={{ color: "#9333ea", fontWeight: "bold", fontSize: "16px" }}>₹{user.monthlyFee || 0}</span></div>) : (<div className="info-row"><label>Role Type:</label> <span>Administrator</span></div>)}{user.role !== "admin" && <div className="info-row"><label>Referred By:</label> <span>{user.referredBy || "N/A"}</span></div>}</div></div></div>
      </div>
    </div>
  );
};

// --- TAB 3: ADD USER (With Sibling Support + Zoom ID Fixed) ---
const AddUserTab = () => {
  const [formData, setFormData] = useState({ 
    username: "", password: "", role: "parent", 
    firstName: "", lastName: "", gender: "", admissionId: "", shortBio: "", 
    studentEmail: "", studentPhone: "", childAge: "", childDob: "", 
    fullName: "", email: "", phone: "", location: "", zoomId: "", referredBy: "", 
    childClass: "", monthlyFee: "", specialization: "", joiningDate: "", dob: "" 
  });

  const [showSibling, setShowSibling] = useState(false);
  const [siblingData, setSiblingData] = useState({
    username: "", password: "", 
    firstName: "", lastName: "", gender: "", admissionId: "", shortBio: "",
    childAge: "", childDob: "", childClass: "", monthlyFee: ""
  });
  
  const [msg, setMsg] = useState("");
  const [autoFillMsg, setAutoFillMsg] = useState("");

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });
  const handleSiblingChange = (e) => setSiblingData({ ...siblingData, [e.target.name]: e.target.value });

  const handlePhoneBlur = async () => {
    if (formData.role === 'parent' && formData.phone.length > 9) {
      try {
        const res = await axios.get(`http://localhost:5000/api/users/parent/${formData.phone}`);
        if (res.data) {
          setFormData(prev => ({ ...prev, fullName: res.data.fullName || "", email: res.data.email || "", location: res.data.location || "", zoomId: res.data.zoomId || "", referredBy: res.data.referredBy || "" }));
          setAutoFillMsg("✅ Parent found! Details auto-filled.");
          setTimeout(() => setAutoFillMsg(""), 3000);
        }
      } catch (err) {}
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setMsg("Processing...");
    const student1Name = `${formData.firstName} ${formData.lastName}`.trim();
    const payload1 = { ...formData, childName: formData.role === 'parent' ? student1Name : "" };

    try {
      await axios.post("http://localhost:5000/api/register", payload1);
      if (formData.role === 'parent' && showSibling) {
        const student2Name = `${siblingData.firstName} ${siblingData.lastName}`.trim();
        const payload2 = { ...siblingData, role: "parent", username: siblingData.username, password: siblingData.password, firstName: siblingData.firstName, lastName: siblingData.lastName, gender: siblingData.gender, admissionId: siblingData.admissionId, shortBio: siblingData.shortBio, childName: student2Name, childAge: siblingData.childAge, childDob: siblingData.childDob, childClass: siblingData.childClass, monthlyFee: siblingData.monthlyFee, fullName: formData.fullName, email: formData.email, phone: formData.phone, location: formData.location, zoomId: formData.zoomId, referredBy: formData.referredBy, joiningDate: formData.joiningDate, studentEmail: formData.studentEmail, studentPhone: formData.studentPhone };
        await axios.post("http://localhost:5000/api/register", payload2);
        setMsg("✅ Success! Both siblings registered.");
      } else {
        setMsg("✅ User Registered Successfully!");
      }
      setFormData({ username: "", password: "", role: "parent", firstName: "", lastName: "", gender: "", admissionId: "", shortBio: "", studentEmail: "", studentPhone: "", childAge: "", childDob: "", fullName: "", email: "", phone: "", location: "", zoomId: "", referredBy: "", childClass: "", monthlyFee: "", specialization: "", joiningDate: "", dob: "" });
      setSiblingData({ username: "", password: "", firstName: "", lastName: "", gender: "", admissionId: "", shortBio: "", childAge: "", childDob: "", childClass: "", monthlyFee: "" });
      setShowSibling(false);
    } catch (err) { console.error(err); setMsg("❌ Error: Username taken or server issue."); }
  };

  return (
    <div className="form-wrapper">
      <h3>Register New Profile</h3>
      <form onSubmit={handleRegister} className="admin-form">
        <div className="form-section"><h4 className="section-title">Login Credentials {showSibling && "(Student 1)"}</h4><div className="form-row"><div className="form-group"><label>Username *</label><input name="username" value={formData.username} onChange={handleChange} required placeholder="Unique Login ID" /></div><div className="form-group"><label>Password *</label><input name="password" type="password" value={formData.password} onChange={handleChange} required placeholder="Secret Password" /></div></div><div className="form-group"><label>Role</label><select name="role" value={formData.role} onChange={handleChange}><option value="parent">Student</option><option value="teacher">Teacher</option><option value="admin">Admin</option></select></div></div>
        {formData.role === "parent" && (<div className="form-section student-section"><h4 className="section-title" style={{color: '#0284c7'}}>Student 1 Details</h4><div className="form-row"><div className="form-group"><label>First Name</label><input name="firstName" value={formData.firstName} onChange={handleChange} placeholder="e.g. Rahul" /></div><div className="form-group"><label>Last Name</label><input name="lastName" value={formData.lastName} onChange={handleChange} placeholder="e.g. Dravid" /></div></div><div className="form-row"><div className="form-group"><label>Gender *</label><select name="gender" value={formData.gender} onChange={handleChange}><option value="">Select</option><option value="Male">Male</option><option value="Female">Female</option></select></div><div className="form-group"><label>Date of Birth</label><input type="date" name="childDob" value={formData.childDob} onChange={handleChange} /></div></div><div className="form-row"><div className="form-group"><label>Admission ID</label><input name="admissionId" value={formData.admissionId} onChange={handleChange} placeholder="ADM-001" /></div><div className="form-group"><label>Age</label><input name="childAge" value={formData.childAge} onChange={handleChange} placeholder="e.g. 10" /></div></div><div className="form-row"><div className="form-group"><label>Student Email</label><input name="studentEmail" value={formData.studentEmail} onChange={handleChange} placeholder="Optional" /></div><div className="form-group"><label>Student Phone</label><input name="studentPhone" value={formData.studentPhone} onChange={handleChange} placeholder="Optional" /></div></div><div className="form-group"><label>Short Bio</label><textarea name="shortBio" value={formData.shortBio} onChange={handleChange} placeholder="Interests..." style={{width:'100%', padding:'10px', borderRadius:'6px', border:'1px solid #cbd5e1'}} /></div></div>)}
        {formData.role === "parent" && (<div className="form-section parent-section"><div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'15px'}}><h4 className="section-title" style={{color: '#ea580c', margin:0}}>Parent / Guardian Details (Shared)</h4>{autoFillMsg && <span style={{fontSize:'0.85rem', color:'#16a34a', fontWeight:'bold'}}>{autoFillMsg}</span>}</div><div className="form-row"><div className="form-group"><label>Parent Phone *</label><input name="phone" value={formData.phone} onChange={handleChange} onBlur={handlePhoneBlur} placeholder="Enter to Search..." style={{border: '2px solid #fdba74'}} /></div><div className="form-group"><label>Parent Name</label><input name="fullName" value={formData.fullName} onChange={handleChange} placeholder="Guardian Name" /></div></div><div className="form-row"><div className="form-group"><label>Parent Email</label><input name="email" value={formData.email} onChange={handleChange} placeholder="parent@mail.com" /></div><div className="form-group"><label>Location</label><input name="location" value={formData.location} onChange={handleChange} placeholder="City" /></div></div><div className="form-row"><div className="form-group"><label>Zoom ID</label><input name="zoomId" value={formData.zoomId} onChange={handleChange} placeholder="Zoom Meeting ID" /></div><div className="form-group"><label>Referred By</label><input name="referredBy" value={formData.referredBy} onChange={handleChange} placeholder="Source" /></div></div></div>)}
        {formData.role === "parent" && (<div style={{marginBottom: '20px', padding: '15px', background: '#e0f2fe', borderRadius: '8px', border: '1px dashed #0284c7', display: 'flex', alignItems: 'center', gap: '10px'}}><input type="checkbox" id="siblingCheck" checked={showSibling} onChange={(e) => setShowSibling(e.target.checked)} style={{width:'20px', height:'20px', cursor:'pointer'}}/><label htmlFor="siblingCheck" style={{cursor:'pointer', fontWeight:'600', color:'#0369a1', fontSize:'1rem'}}>Register a Sibling (Second Child)?</label></div>)}
        {showSibling && formData.role === "parent" && (<div className="form-section student-section" style={{borderLeft: '5px solid #0284c7'}}><h4 className="section-title" style={{color: '#0284c7'}}>Student 2 Details (Sibling)</h4><div className="form-row" style={{background: '#fff', padding:'10px', borderRadius:'6px', marginBottom:'15px', border:'1px solid #ddd'}}><div className="form-group"><label>Sibling Username *</label><input name="username" value={siblingData.username} onChange={handleSiblingChange} required placeholder="Unique Login ID" /></div><div className="form-group"><label>Sibling Password *</label><input name="password" type="password" value={siblingData.password} onChange={handleSiblingChange} required placeholder="Password" /></div></div><div className="form-row"><div className="form-group"><label>First Name</label><input name="firstName" value={siblingData.firstName} onChange={handleSiblingChange} /></div><div className="form-group"><label>Last Name</label><input name="lastName" value={siblingData.lastName} onChange={handleSiblingChange} /></div></div><div className="form-row"><div className="form-group"><label>Gender</label><select name="gender" value={siblingData.gender} onChange={handleSiblingChange}><option value="">Select</option><option value="Male">Male</option><option value="Female">Female</option></select></div><div className="form-group"><label>Date of Birth</label><input type="date" name="childDob" value={siblingData.childDob} onChange={handleSiblingChange} /></div></div><div className="form-row"><div className="form-group"><label>Admission ID</label><input name="admissionId" value={siblingData.admissionId} onChange={handleSiblingChange} /></div><div className="form-group"><label>Class / Grade</label><input name="childClass" value={siblingData.childClass} onChange={handleSiblingChange} /></div></div><div className="form-group"><label>Monthly Fee (₹)</label><input type="number" name="monthlyFee" value={siblingData.monthlyFee} onChange={handleSiblingChange} style={{fontWeight:'bold', color:'#16a34a'}} /></div></div>)}
        {formData.role !== "parent" && (<div className="form-section"><h4 className="section-title">Details</h4>{formData.role === "teacher" && (<><div className="form-row"><div className="form-group"><label>Full Name</label><input name="fullName" value={formData.fullName} onChange={handleChange} /></div><div className="form-group"><label>Phone</label><input name="phone" value={formData.phone} onChange={handleChange} /></div></div><div className="form-row"><div className="form-group"><label>Specialization</label><input name="specialization" value={formData.specialization} onChange={handleChange} /></div><div className="form-group"><label>Salary</label><input type="number" name="monthlyFee" value={formData.monthlyFee} onChange={handleChange} /></div></div><div className="form-row"><div className="form-group"><label>Date of Birth</label><input type="date" name="childDob" value={formData.childDob} onChange={handleChange} /></div></div></>)}{formData.role === "admin" && (<div className="form-row"><div className="form-group"><label>Full Name</label><input name="fullName" value={formData.fullName} onChange={handleChange} /></div><div className="form-group"><label>DOB</label><input type="date" name="dob" value={formData.dob} onChange={handleChange} /></div></div>)}<div className="form-group" style={{marginTop:'15px'}}><label>Joining Date</label><input type="date" name="joiningDate" value={formData.joiningDate} onChange={handleChange} /></div></div>)}
        <button type="submit" className="save-btn" style={{ marginTop: "20px" }}>{showSibling ? "Register Both Siblings" : "Register User"}</button>
      </form>
      {msg && <p className="status-msg">{msg}</p>}
    </div>
  );
};

// --- TAB 5: FEE TRACKER (UPDATED WITH ARROWS) ---
const FeeTrackerTab = () => {
  const [students, setStudents] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); // "YYYY-MM"
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => { fetchStudents(); }, []);

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const res = await axios.get('http://localhost:5000/api/users');
      setStudents(res.data.filter(u => u.role === 'parent'));
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  const handleTogglePayment = async (studentId, currentStatus, feeAmount) => {
    const newStatus = currentStatus === 'Paid' ? 'Pending' : 'Paid';
    const updatedStudents = students.map(s => {
      if (s._id === studentId) {
        let newPayments = [...(s.payments || [])];
        if (newStatus === 'Paid') { newPayments.push({ month: selectedMonth, status: 'Paid', amount: feeAmount }); } 
        else { newPayments = newPayments.filter(p => p.month !== selectedMonth); }
        return { ...s, payments: newPayments };
      }
      return s;
    });
    setStudents(updatedStudents);
    try { await axios.post('http://localhost:5000/api/fees/update', { userId: studentId, month: selectedMonth, status: newStatus, amount: feeAmount }); } 
    catch (err) { alert("Error updating payment"); fetchStudents(); }
  };

  const getPaymentStatus = (student) => {
    const record = (student.payments || []).find(p => p.month === selectedMonth);
    return record ? 'Paid' : 'Pending';
  };

  // ✨ NEW: Month Navigation Logic
  const changeMonth = (offset) => {
    // Create date from current selectedMonth (e.g., "2026-01") + "-01" to ensure valid date
    const currentDate = new Date(selectedMonth + "-01");
    currentDate.setMonth(currentDate.getMonth() + offset);
    
    // Format back to YYYY-MM manually to avoid timezone shifts
    const year = currentDate.getFullYear();
    const month = String(currentDate.getMonth() + 1).padStart(2, '0');
    setSelectedMonth(`${year}-${month}`);
  };

  const filteredStudents = students.filter(s => (s.childName || "").toLowerCase().includes(searchTerm.toLowerCase()) || (s.fullName || "").toLowerCase().includes(searchTerm.toLowerCase()));
  const totalDue = filteredStudents.reduce((acc, s) => acc + (s.monthlyFee || 0), 0);
  const totalCollected = filteredStudents.reduce((acc, s) => { return getPaymentStatus(s) === 'Paid' ? acc + (s.monthlyFee || 0) : acc; }, 0);

  return (
    <div className="table-wrapper">
      {/* --- TOP BAR --- */}
      <div className="filter-bar" style={{flexWrap:'wrap', gap:'15px'}}>
         <div style={{display:'flex', alignItems:'center', gap:'5px'}}>
            <label style={{fontWeight:'bold', color:'#334155', marginRight:'5px'}}>Select Month:</label>
            
            {/* ✨ LEFT ARROW */}
            <button 
              onClick={() => changeMonth(-1)} 
              className="icon-btn" 
              style={{background:'#e2e8f0', width:'30px', height:'30px', borderRadius:'4px', display:'flex', alignItems:'center', justifyContent:'center'}}
            >
              &lt;
            </button>

            <input 
              type="month" 
              value={selectedMonth} 
              onChange={(e) => setSelectedMonth(e.target.value)}
              style={{padding:'6px', borderRadius:'4px', border:'1px solid #cbd5e1', fontWeight:'600', color:'#0284c7'}} 
            />

            {/* ✨ RIGHT ARROW */}
            <button 
              onClick={() => changeMonth(1)} 
              className="icon-btn" 
              style={{background:'#e2e8f0', width:'30px', height:'30px', borderRadius:'4px', display:'flex', alignItems:'center', justifyContent:'center'}}
            >
              &gt;
            </button>
         </div>
         
         <div className="search-box">
            <input type="text" placeholder="Search Student..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
         </div>

         <div style={{marginLeft:'auto', display:'flex', gap:'20px', alignItems:'center'}}>
            <div style={{textAlign:'right'}}><div style={{fontSize:'0.85rem', color:'#64748b'}}>Collected</div><div style={{fontSize:'1.1rem', fontWeight:'bold', color:'#16a34a'}}>₹{totalCollected.toLocaleString()}</div></div>
            <div style={{textAlign:'right'}}><div style={{fontSize:'0.85rem', color:'#64748b'}}>Pending</div><div style={{fontSize:'1.1rem', fontWeight:'bold', color:'#ef4444'}}>₹{(totalDue - totalCollected).toLocaleString()}</div></div>
         </div>
      </div>

      {/* --- TABLE --- */}
      <div className="table-container">
        <table className="custom-table">
          <thead>
            <tr>
              <th>Student Name</th>
              <th>Parent Name</th>
              <th>Monthly Fee</th>
              <th>Status for {new Date(selectedMonth + "-01").toLocaleString('default', { month: 'long', year: 'numeric' })}</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? <tr><td colSpan="5" style={{textAlign:'center', padding:'20px'}}>Loading...</td></tr> : 
             filteredStudents.length === 0 ? <tr><td colSpan="5" style={{textAlign:'center', padding:'20px'}}>No students found.</td></tr> :
             filteredStudents.map(student => {
               const status = getPaymentStatus(student);
               const isPaid = status === 'Paid';
               return (
                 <tr key={student._id}>
                   <td style={{fontWeight:'600', color:'#334155'}}>{student.childName}</td>
                   <td style={{color:'#64748b'}}>{student.fullName}</td>
                   <td style={{fontWeight:'bold'}}>₹{student.monthlyFee}</td>
                   <td><span className={`role-badge ${isPaid ? 'teacher' : 'admin'}`} style={{background: isPaid ? '#dcfce7' : '#fee2e2', color: isPaid ? '#166534' : '#991b1b'}}>{isPaid ? '✅ Paid' : '⏳ Pending'}</span></td>
                   <td><button className="save-btn" style={{width:'auto', padding:'6px 12px', fontSize:'0.85rem', backgroundColor: isPaid ? '#ef4444' : '#10b981'}} onClick={() => handleTogglePayment(student._id, status, student.monthlyFee)}>{isPaid ? 'Mark Unpaid' : 'Mark Paid'}</button></td>
                 </tr>
               );
             })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminDashboard;