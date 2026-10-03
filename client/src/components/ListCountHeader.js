import React from "react";
import "./ListCountHeader.css";

// Count header shown above every list: "Students (12)", or "Students (12 of 48)"
// when search / filters narrow the list. `total` is the unfiltered size.
const ListCountHeader = ({ label, count, total, style }) => {
  const isFiltered = typeof total === "number" && total !== count;
  return (
    <div className="list-count-header" style={style}>
      <span className="list-count-label">{label}</span>
      <span className="list-count-value">
        ({count}
        {isFiltered && <span className="list-count-total"> of {total}</span>})
      </span>
    </div>
  );
};

export default ListCountHeader;
