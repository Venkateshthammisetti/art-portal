// src/components/ParentDashboard.js
import React from 'react';

const ParentDashboard = ({ user }) => {
  return (
    <div className="dashboard parent">
      <h1>👨‍👩‍👦 Parent Portal</h1>
      <p>Viewing progress for: <strong>{user.childName}</strong></p>
      
      <div className="card-container">
        <div className="card">
          <h3>Current Status</h3>
          
          <div className="progress-bar-bg" style={{background: '#eee', height: '20px', borderRadius:'10px'}}>
             <div style={{
                width: `${user.progress}%`, 
                background: '#27ae60', 
                height: '100%',
                borderRadius:'10px',
                transition: 'width 0.5s'
             }}></div>
          </div>
          
          <p><strong>{user.progress}% Course Completed</strong></p>
          <hr/>
          <p>Feedback: "{user.feedback}"</p>
        </div>
      </div>
    </div>
  );
};

export default ParentDashboard;