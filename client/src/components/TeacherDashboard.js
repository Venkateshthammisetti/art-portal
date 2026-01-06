// src/components/TeacherDashboard.js
import React, { useState, useEffect } from 'react';
import axios from 'axios';

const TeacherDashboard = () => {
  const [students, setStudents] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState('');
  const [progress, setProgress] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    axios.get('http://localhost:5000/api/students')
      .then(res => setStudents(res.data));
  }, []);

  const handleUpdate = async (e) => {
    e.preventDefault();
    await axios.post('http://localhost:5000/api/update-progress', {
      username: selectedStudent,
      progress,
      feedback
    });
    setMsg('✅ Update Saved!');
  };

  return (
    <div className="dashboard teacher">
      <h1>🎨 Teacher Portal</h1>
      <div className="card-container">
        <div className="card form-card">
          <h3>📝 Update Student Progress</h3>
          
          <form onSubmit={handleUpdate} className="admin-form">
            <label>Select Student:</label>
            <select 
              onChange={e => setSelectedStudent(e.target.value)} 
              value={selectedStudent}
              required
            >
              <option value="">-- Choose a Student --</option>
              {students.map(s => (
                <option key={s._id} value={s.username}>
                  {s.childName} ({s.username})
                </option>
              ))}
            </select>

            <label>Progress (0-100%):</label>
            <input 
              type="number" 
              min="0" max="100"
              value={progress}
              onChange={e => setProgress(e.target.value)}
            />

            <label>Feedback / Remarks:</label>
            <input 
              type="text" 
              placeholder="e.g. Great job on shading!"
              value={feedback}
              onChange={e => setFeedback(e.target.value)}
            />

            <button type="submit">Update Record</button>
          </form>
          {msg && <p className="success-msg">{msg}</p>}
        </div>
      </div>
    </div>
  );
};

export default TeacherDashboard;