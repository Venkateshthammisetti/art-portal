import React, { useState, useEffect } from "react";
import axios from "axios";
import "./AdminDashboard.css";

const AdminDashboard = ({ onLogout }) => {
  const [activeTab, setActiveTab] = useState("overview");
  const [stats, setStats] = useState({ students: 0, teachers: 0, revenue: 0 });

  
  const IconHome = () => (
    <svg
      width="20"
      height="20"
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
      width="20"
      height="20"
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
      width="20"
      height="20"
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
  const IconLogout = () => (
    <svg
      width="20"
      height="20"
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

  useEffect(() => {
    fetchStats();
    
    axios
      .get("http://localhost:5000/api/dashboard/stats")
      .then((res) => {
        setStats(res.data); 
      })
      .catch((err) => {
        console.error("Error loading stats:", err);
        
      });
  }, [activeTab]);

  
  const fetchStats = () => {
    axios.get('http://localhost:5000/api/dashboard/stats')
      .then(res => setStats(res.data))
      .catch(err => console.error("Stats Error:", err));
  };

  return (
    <div className="admin-container">
      {/* SIDEBAR */}
      <aside className="admin-sidebar">
        <div className="sidebar-brand">
          <div className="brand-logo-circle">VA</div>
          <h3>Venky Art</h3>
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
            className={activeTab === "add-user" ? "active" : ""}
            onClick={() => setActiveTab("add-user")}
          >
            <IconAdd /> <span>Register User</span>
          </button>
        </nav>

        <div className="sidebar-footer">
          <p>Admin Portal v1.0</p>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="admin-main">
        <header className="top-header">
          <div className="header-title">
            <h2>
              {activeTab === "overview"
                ? "Overview"
                : activeTab === "users"
                ? "All Users"
                : "Register User"}
            </h2>
            <p>Welcome back, Admin</p>
          </div>
          <div className="header-actions">
            <div className="user-profile-pill">
              <img
                src="https://ui-avatars.com/api/?name=Admin+User&background=00bfa5&color=fff"
                alt="Profile"
              />
              <span>Super Admin</span>
            </div>
            <button
              onClick={onLogout}
              className="header-logout-btn"
              title="Logout"
            >
              <IconLogout />
            </button>
          </div>
        </header>

        <div className="content-scrollable">
          {activeTab === "overview" && <OverviewTab stats={stats} />}
          {activeTab === "users" && <UserManagementTab />}
          {activeTab === "add-user" && <AddUserTab />}
        </div>

      </main>
    </div>
  );
};


const OverviewTab = ({ stats }) => (
  <div className="stats-grid">
    {/* Card 1: Students */}
    <div className="stat-card blue">
      <h3>Total Students</h3>
      <div className="stat-value-row">
         <span className="stat-number">{stats.students}</span>
         <div className="stat-icon-bg">🎓</div>
      </div>
    </div>

    {/* Card 2: Teachers */}
    <div className="stat-card green">
      <h3>Active Teachers</h3>
      <div className="stat-value-row">
         <span className="stat-number">{stats.teachers}</span>
         <div className="stat-icon-bg">🎨</div>
      </div>
    </div>

    {/* Card 3: Revenue (Sum of Fees) */}
    <div className="stat-card purple">
      <h3>Est. Monthly Revenue</h3>
      <div className="stat-value-row">
         <span className="stat-number" style={{color: '#16a34a'}}>
            ₹{stats.revenue ? stats.revenue.toLocaleString('en-IN') : 0}
         </span>
         <div className="stat-icon-bg">💰</div>
      </div>
    </div>
  </div>
);


//2 user managment 
const UserManagementTab = () => {
  const [users, setUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [sortOrder, setSortOrder] = useState('newest'); 
  const [selectedUser, setSelectedUser] = useState(null);
  const [deleteModal, setDeleteModal] = useState({ show: false, userId: null });
  const [toast, setToast] = useState({ show: false, message: '', type: '' });

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = () => {
    axios.get('http://localhost:5000/api/users')
      .then(res => setUsers(res.data))
      .catch(err => console.error(err));
  };

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: '' }), 3000);
  };

  const initiateDelete = (e, userId) => {
    e.stopPropagation();
    setDeleteModal({ show: true, userId });
  };

  const confirmDelete = async () => {
    try {
      await axios.delete(`http://localhost:5000/api/users/${deleteModal.userId}`);
      setUsers(users.filter(user => user._id !== deleteModal.userId));
      showToast('User deleted successfully!', 'success');
      setSelectedUser(null);
    } catch (err) {
      showToast('Failed to delete user.', 'error');
    } finally {
      setDeleteModal({ show: false, userId: null });
    }
  };

  const handleToggleStatus = async (e, userId, currentStatus) => {
    e.stopPropagation();
    try {
      await axios.put(`http://localhost:5000/api/users/${userId}/status`);
      setUsers(users.map(user => 
        user._id === userId ? { ...user, isActive: !currentStatus } : user
      ));
      showToast('Status updated', 'success');
    } catch (err) {
      showToast('Error', 'error');
    }
  };

  //filters
  const filteredUsers = users.filter(user => {
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = 
      (user.username && user.username.toLowerCase().includes(searchLower)) || 
      (user.fullName && user.fullName.toLowerCase().includes(searchLower)) ||
      (user.email && user.email.toLowerCase().includes(searchLower)) ||
      (user.phone && user.phone.includes(searchLower)) ||
      (user.location && user.location.toLowerCase().includes(searchLower)) ||
      (user.childName && user.childName.toLowerCase().includes(searchLower));

    return matchesRole && matchesSearch;
  });

  const sortedUsers = [...filteredUsers].sort((a, b) => {
    if (sortOrder === 'newest') return new Date(b.createdAt) - new Date(a.createdAt);
    if (sortOrder === 'oldest') return new Date(a.createdAt) - new Date(b.createdAt);
    if (sortOrder === 'fee-high') return (b.monthlyFee || 0) - (a.monthlyFee || 0);
    if (sortOrder === 'fee-low') return (a.monthlyFee || 0) - (b.monthlyFee || 0);
    if (sortOrder === 'name-asc') return (a.fullName || a.username).localeCompare(b.fullName || b.username);
    return 0;
  });

  if (selectedUser) {
    return <UserDetailsView user={selectedUser} onBack={() => setSelectedUser(null)} onDelete={() => initiateDelete({ stopPropagation: () => {} }, selectedUser._id)} />;
  }

  return (
    <div className="table-wrapper">
       <div className={`toast-notification ${toast.type} ${toast.show ? 'show' : ''}`}>
        {toast.type === 'success' ? '✅' : '❌'} {toast.message}
      </div>
       <div className="filter-bar">
          <div className="search-box">
             <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
             <input 
               type="text" 
               placeholder="Search Name, Phone, Location..." 
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
              <label>Sort By:</label>
              <select value={sortOrder} onChange={(e) => setSortOrder(e.target.value)}>
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
                <option value="fee-high">Highest Fee</option>
                <option value="fee-low">Lowest Fee</option>
                <option value="name-asc">Name (A-Z)</option>
              </select>
            </div>
          </div>
       </div>

       <div className="table-container">
        <table className="custom-table clickable-rows">
          <thead>
            <tr>
              <th>Name / ID</th>
              <th>Role</th>
              <th>Fee</th>
              <th>Details</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {sortedUsers.length > 0 ? (
              sortedUsers.map((user) => (
                <tr key={user._id} onClick={() => setSelectedUser(user)} className="user-row">
                  {/* Name & Location */}
                  <td>
                    <div style={{fontWeight: '600', color: '#333'}}>{user.fullName || user.username}</div>
                    <div style={{fontSize: '12px', color: '#888'}}>{user.location || "No Location"}</div>
                  </td>
                  
                  <td><span className={`role-badge ${user.role}`}>{user.role}</span></td>
                  
                  {/* Fee Column (Only for Parents) */}
                  <td>
                    {user.role === 'parent' ? (
                       <span style={{color: '#16a34a', fontWeight: 'bold'}}>₹{user.monthlyFee || 0}</span>
                    ) : '-'}
                  </td>

                  <td>
                    {user.role === "parent" ? <span style={{ color: "#666" }}>Student: <b>{user.childName}</b></span> : 
                     user.role === "teacher" ? <span style={{ color: "#666" }}>Spec: <b>{user.specialization}</b></span> : "-"}
                  </td>
                  
                  <td>
                    <button className={`status-btn ${user.isActive ? 'active' : 'inactive'}`} onClick={(e) => handleToggleStatus(e, user._id, user.isActive)}>
                      {user.isActive ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td>
                    <button className="delete-btn" onClick={(e) => initiateDelete(e, user._id)} title="Delete User">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr><td colSpan="6" style={{textAlign:'center', padding:'30px', color:'#999'}}>No users found.</td></tr>
            )}
          </tbody>
        </table>
       </div>

       {/* Delete Modal */}
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
    </div>
  );
};

// -- OBJECT PAGE (Details View) ---
const UserDetailsView = ({ user, onBack, onDelete }) => {
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
              Joined: {new Date(user.createdAt).toLocaleDateString()}
            </span>
          </div>
          <button className="delete-btn-large" onClick={onDelete}>
            Delete User
          </button>
        </div>
      </div>

      
      <div className="object-body">
        {/* Card 1: Contact Info */}
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
            <label>Zoom ID:</label> <span>{user.zoomId || "N/A"}</span>
          </div>
        </div>

        {/* Card 2: Student / Professional Info */}
        <div className="detail-card">
          <h3>
            {user.role === "parent"
              ? "Student Details"
              : "Professional Details"}
          </h3>

          {user.role === "parent" ? (
            <>
              <div className="info-row">
                <label>Child Name:</label>{" "}
                <span>{user.childName || "N/A"}</span>
              </div>
              <div className="info-row">
                <label>Age:</label> <span>{user.childAge || "N/A"}</span>
              </div>
              <div className="info-row">
                <label>Class:</label> <span>{user.childClass || "N/A"}</span>
              </div>
              {/*SHOW FEE */}
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
          ) : (
            <div className="info-row">
              <label>Specialization:</label>{" "}
              <span>{user.specialization || "N/A"}</span>
            </div>
          )}

          <div className="info-row">
            <label>Referred By:</label> <span>{user.referredBy || "N/A"}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- TAB 3: ADD USER (Updated with Student Data) ---
const AddUserTab = () => {
  const [formData, setFormData] = useState({
    username: "",
    password: "",
    role: "parent",
    fullName: "",
    email: "",
    phone: "",
    location: "",
    zoomId: "",
    referredBy: "",
    childName: "",
    childAge: "",
    childClass: "",
    monthlyFee: "",
    specialization: "",
  });
  const [msg, setMsg] = useState("");

  const handleRegister = async (e) => {
    e.preventDefault();
    try {
      await axios.post("http://localhost:5000/api/register", formData);
      setMsg("✅ User Registered Successfully!");
      setFormData({
        username: "",
        password: "",
        role: "parent",
        fullName: "",
        email: "",
        phone: "",
        location: "",
        zoomId: "",
        referredBy: "",
        childName: "",
        childAge: "",
        childClass: "",
        childSchool: "",
        specialization: "",
      });
    } catch (err) {
      setMsg("❌ Error: Username taken or server issue.");
    }
  };

  const handleChange = (e) =>
    setFormData({ ...formData, [e.target.name]: e.target.value });

  return (
    <div className="form-wrapper">
      <h3>Register New Profile</h3>
      <form onSubmit={handleRegister} className="admin-form">
        {/* Row 1: Login Info */}
        <div className="form-row">
          <div className="form-group">
            <label>Username *</label>
            <input
              name="username"
              value={formData.username}
              onChange={handleChange}
              required
              placeholder="Login ID"
            />
          </div>
          <div className="form-group">
            <label>Password *</label>
            <input
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
              placeholder="Secret Password"
            />
          </div>
        </div>

        {/* Row 2: Role & Personal Name */}
        <div className="form-row">
          <div className="form-group">
            <label>Role</label>
            <select name="role" value={formData.role} onChange={handleChange}>
              <option value="parent">Parent</option>
              <option value="teacher">Teacher</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div className="form-group">
            <label>Full Name (Parent/Teacher)</label>
            <input
              name="fullName"
              value={formData.fullName}
              onChange={handleChange}
              placeholder="e.g. Rahul Dravid"
            />
          </div>
        </div>

        {/* Row 3: Contact Info */}
        <div className="form-row">
          <div className="form-group">
            <label>Email</label>
            <input
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="user@gmail.com"
            />
          </div>
          <div className="form-group">
            <label>Phone No</label>
            <input
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              placeholder="+91 98765..."
            />
          </div>
        </div>

        {/* Row 4: Extra Details */}
        <div className="form-row">
          <div className="form-group">
            <label>Location / City</label>
            <input
              name="location"
              value={formData.location}
              onChange={handleChange}
              placeholder="Hyderabad"
            />
          </div>
          <div className="form-group">
            <label>Zoom ID</label>
            <input
              name="zoomId"
              value={formData.zoomId}
              onChange={handleChange}
              placeholder="For classes"
            />
          </div>
        </div>

        <div className="form-group">
          <label>Referred By</label>
          <input
            name="referredBy"
            value={formData.referredBy}
            onChange={handleChange}
            placeholder="Who told them?"
          />
        </div>

        {/* STUDENT DETAILS (Only for Parents) */}
        {formData.role === "parent" && (
          <div
            style={{
              marginTop: "20px",
              padding: "15px",
              background: "#f0f9ff",
              borderRadius: "10px",
              border: "1px solid #bae6fd",
            }}
          >
            <h4 style={{ marginTop: 0, color: "#0284c7" }}>Student Details</h4>

            <div className="form-row">
              <div className="form-group">
                <label>Student Name</label>
                <input
                  name="childName"
                  value={formData.childName}
                  onChange={handleChange}
                  placeholder="Kid's Name"
                />
              </div>
              <div className="form-group">
                <label>Student Age</label>
                <input
                  name="childAge"
                  value={formData.childAge}
                  onChange={handleChange}
                  placeholder="e.g. 10 Years"
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
                  placeholder="e.g. 5th Grade"
                />
              </div>

              {/* NEW FEE INPUT */}
              <div className="form-group">
                <label>Monthly Fee (₹)</label>
                <input
                  type="number"
                  name="monthlyFee"
                  value={formData.monthlyFee}
                  onChange={handleChange}
                  placeholder="e.g. 4000"
                  style={{ fontWeight: "bold", color: "#16a34a" }}
                />
              </div>
            </div>
          </div>
        )}

        {/* SECTION: TEACHER DETAILS */}
        {formData.role === "teacher" && (
          <div className="form-group" style={{ marginTop: "15px" }}>
            <label>Specialization</label>
            <input
              name="specialization"
              value={formData.specialization}
              onChange={handleChange}
              placeholder="Art Style (e.g. Oil Painting)"
            />
          </div>
        )}

        <button
          type="submit"
          className="save-btn"
          style={{ marginTop: "20px" }}
        >
          Register User
        </button>
      </form>
      {msg && <p className="status-msg">{msg}</p>}
    </div>
  );
};

//  USER DETAILS MODAL---
const UserDetailsModal = ({ user, onClose }) => {
  if (!user) return null;
  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <button className="close-modal" onClick={onClose}>
          ×
        </button>
        <h3>User Profile: {user.username}</h3>

        <div className="modal-grid">
          <div className="detail-item">
            <strong>Full Name:</strong> {user.fullName || "N/A"}
          </div>
          <div className="detail-item">
            <strong>Role:</strong>{" "}
            <span className={`role-badge ${user.role}`}>{user.role}</span>
          </div>
          <div className="detail-item">
            <strong>Email:</strong> {user.email || "N/A"}
          </div>
          <div className="detail-item">
            <strong>Phone:</strong> {user.phone || "N/A"}
          </div>
          <div className="detail-item">
            <strong>Location:</strong> {user.location || "N/A"}
          </div>
          <div className="detail-item">
            <strong>Joined:</strong>{" "}
            {user.createdAt
              ? new Date(user.createdAt).toLocaleDateString()
              : "N/A"}
          </div>

          {/* TEACHER INFO */}
          {user.role === "teacher" && (
            <div className="detail-item highlight">
              <strong>Specialization:</strong> {user.specialization}
            </div>
          )}

          {/* STUDENT INFO BLOCK */}
          {user.role === "parent" && (
            <div
              style={{
                gridColumn: "span 2",
                background: "#f0f9ff",
                padding: "10px",
                borderRadius: "8px",
                marginTop: "10px",
              }}
            >
              <h4
                style={{
                  margin: "0 0 10px 0",
                  color: "#0369a1",
                  fontSize: "14px",
                }}
              >
                Student Information
              </h4>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "10px",
                }}
              >
                <div>
                  <strong>Name:</strong> {user.childName}
                </div>
                <div>
                  <strong>Age:</strong> {user.childAge}
                </div>
                <div>
                  <strong>Class:</strong> {user.childClass}
                </div>
                <div>
                  <strong>School:</strong> {user.childSchool}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
