import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import "./ParentDashboard.css";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

// Ensure these image paths are correct in your project
import logoImg from "./new-logo.png";
import titleImg from "./logo-title-copy.png";
import bannerImg from "./banner4.png";
import bannerMobile from "./banner-001.png";
import qrCodeImg from "./qrcode.jpeg";

import { FaShareFromSquare } from "react-icons/fa6";

// --- ZONE 1: HELPER FUNCTIONS (Outside Component) ---
function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// --- TUTORIAL STEPS DATA ---
const TUTORIAL_STEPS = [
  {
    id: 1,
    title: "Welcome to Thevenkyart! 🎨",
    desc: (
      <span>
        Welcome to your new <b>Parent Dashboard!</b> This is your central hub to
        track your child's artistic journey, attendance, and growth.
      </span>
    ),
    icon: "👋",
  },
  {
    id: 2,
    title: "Quick Overview 📊",
    desc: (
      <span>
        The <b>'Overview'</b> tab gives you a snapshot. See upcoming classes,
        attendance percentage, latest teacher feedback at a glance, fee status,
        next class schedule, Basic details of the student
      </span>
    ),
    icon: "🏠",
  },
  {
    id: 3,
    title: "Join Classes 🚀",
    desc: (
      <span>
        Go to the <b>'Class Schedule'</b> tab to find your child's timetable.
        The Zoom links for classes will appear there automatically.
      </span>
    ),
    icon: "🗓️",
  },
  {
    id: 4,
    title: "Track Progress 📝",
    desc: (
      <span>
        Check <b>'Academic Reports'</b> to view detailed feedback from teachers,
        download report cards, and reply with your own comments.
      </span>
    ),
    icon: "📈",
  },
  {
    id: 5,
    title: "Manage Fees 💳",
    desc: (
      <span>
        Visit <b>'Fee Status'</b> to check for pending dues. You can view
        payment history and get UPI details to pay securely.
      </span>
    ),
    icon: "💸",
  },
];

// ==========================================
// 1. PARENT GALLERY COMPONENT
// ==========================================
const ParentGalleryTab = ({ studentId }) => {
  const [artwork, setArtwork] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const [shareLoading, setShareLoading] = useState(false);

  // Filters
  const [filterYear, setFilterYear] = useState("all");
  const [filterMonth, setFilterMonth] = useState("all");

  // Swipe Refs
  const touchStartX = useRef(null);
  const touchEndX = useRef(null);

  useEffect(() => {
    setLoading(true);
    const baseUrl = "https://art-portal-7n6r.onrender.com";

    axios
      .get(`${baseUrl}/api/gallery/student/${studentId}`)
      .then((res) => setArtwork(res.data))
      .catch((err) => console.error("Gallery Error:", err))
      .finally(() => setLoading(false));
  }, [studentId]);

  const filteredArtwork = artwork.filter((art) => {
    if (!art.dateCreated) return false;
    const date = new Date(art.dateCreated);
    const artYear = date.getFullYear().toString();
    const artMonth = date.getMonth();
    return (
      (filterYear === "all" || artYear === filterYear) &&
      (filterMonth === "all" || artMonth === parseInt(filterMonth))
    );
  });

  // 🎨 HELPER: Generates the Branded Image
  const generateBrandedImage = async (artworkUrl, title) => {
    return new Promise((resolve, reject) => {
      const artImg = new Image();
      artImg.crossOrigin = "anonymous"; // CRITICAL: Allows canvas to export external images
      artImg.src = artworkUrl;

      const logo = new Image();
      logo.src = logoImg; // Uses your imported logo variable

      // Wait for artwork to load
      artImg.onload = () => {
        // Wait for logo to load (if not already cached)
        const onLogoLoad = () => {
          try {
            const canvas = document.createElement("canvas");
            const ctx = canvas.getContext("2d");

            // 1. Set Dimensions (Artwork Height + 160px Footer)
            const footerHeight = 100;
            canvas.width = artImg.width;
            canvas.height = artImg.height + footerHeight;

            // 2. Draw Artwork
            ctx.drawImage(artImg, 0, 0);

            // 3. Draw White Footer Background
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, artImg.height, canvas.width, footerHeight);

            // 4. Draw Logo (Left side of footer)
            // Aspect ratio math to keep logo looking good
            const logoSize = 60;
            ctx.drawImage(logo, 20, artImg.height + 20, logoSize, logoSize);

            // 5. Draw Text (Academy Name & Website)
            ctx.textAlign = "center";
            const centerX = canvas.width / 2 + 20; // Shift center slightly right to account for logo

            // Academy Name
            ctx.fillStyle = "#b42d00"; // Your Brand Blue
            ctx.font = "bold 10px Arial";
            ctx.fillText(
              "THEVENKYART ONLINE ART ACADEMY",
              centerX,
              artImg.height + 90,
            );

            // Website & Phone
            ctx.fillStyle = "#333333"; // Dark Grey
            ctx.font = "15px Arial";
            ctx.fillText("www.thevenkyart.com", centerX, artImg.height + 55);

            // 6. Convert to Blob
            canvas.toBlob(
              (blob) => {
                if (blob) resolve(blob);
                else reject(new Error("Canvas blob failed"));
              },
              "image/jpeg",
              0.95,
            );
          } catch (error) {
            reject(error);
          }
        };

        if (logo.complete) onLogoLoad();
        else logo.onload = onLogoLoad;
      };

      artImg.onerror = (err) => reject(err);
    });
  };

  // SMART SHARE LOGIC
  // ✨ UPDATED SHARE LOGIC
  const handleWhatsAppStatus = async (e, art) => {
    e.stopPropagation();
    setShareLoading(true);

    const promoText = `🌟 Proud Moment! My child created this amazing ${art.medium} artwork at *Thevenkyart Art Academy*! 🎨✨`;

    try {
      // 1. GENERATE BRANDED IMAGE (Instead of fetching raw URL)
      const blob = await generateBrandedImage(art.imageUrl, art.title);

      const file = new File([blob], `VenkyArt_${art.title || "Artwork"}.jpg`, {
        type: "image/jpeg",
      });

      // 2. SHARE API (Mobile)
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: "Thevenkyart Art Academy",
          text: promoText,
        });
      } else {
        // 3. DESKTOP FALLBACK (Download)
        const link = document.createElement("a");
        link.href = window.URL.createObjectURL(blob);
        link.download = `VenkyArt_Branded_${art.title || "Artwork"}.jpg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        await navigator.clipboard.writeText(promoText);
        alert(
          "💻 Image Downloaded with Watermark!\n\n1. Check your downloads folder.\n2. Caption copied to clipboard.\n3. Upload to WhatsApp Web!",
        );
      }
    } catch (err) {
      console.error("Share failed:", err);
      // Fail-safe: Just share the text link if image generation fails
      const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(promoText + " " + art.imageUrl)}`;
      window.open(whatsappUrl, "_blank");
    } finally {
      setShareLoading(false);
    }
  };

  // Navigation Helpers
  const handleNext = (e) => {
    if (e) e.stopPropagation();
    setLightboxIndex((prev) => (prev + 1) % filteredArtwork.length);
  };

  const handlePrev = (e) => {
    if (e) e.stopPropagation();
    setLightboxIndex(
      (prev) => (prev - 1 + filteredArtwork.length) % filteredArtwork.length,
    );
  };

  // KEYBOARD NAVIGATION
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (lightboxIndex === null) return;
      if (e.key === "ArrowRight") handleNext();
      if (e.key === "ArrowLeft") handlePrev();
      if (e.key === "Escape") setLightboxIndex(null);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [lightboxIndex, filteredArtwork]);

  // SWIPE HANDLERS
  const onTouchStart = (e) => {
    touchEndX.current = null;
    touchStartX.current = e.targetTouches[0].clientX;
  };

  const onTouchMove = (e) => {
    touchEndX.current = e.targetTouches[0].clientX;
  };

  const onTouchEnd = () => {
    if (!touchStartX.current || !touchEndX.current) return;
    const distance = touchStartX.current - touchEndX.current;
    const isLeftSwipe = distance > 50;
    const isRightSwipe = distance < -50;

    if (isLeftSwipe) handleNext();
    if (isRightSwipe) handlePrev();
  };

  const years = [2024, 2025, 2026, 2027];
  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  return (
    <div className="form-wrapper" style={{ padding: "20px" }}>
      {/* HEADER */}
      <div
        style={{
          background: "#f8fafc",
          padding: "15px",
          borderRadius: "12px",
          border: "1px solid #e2e8f0",
          marginBottom: "20px",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "15px",
          }}
        >
          <h3 style={{ margin: 0, color: "#334155" }}>🎨 My Art Gallery</h3>
          <div style={{ display: "flex", gap: "10px" }}>
            <select
              value={filterYear}
              onChange={(e) => setFilterYear(e.target.value)}
              style={{
                padding: "8px",
                borderRadius: "6px",
                border: "1px solid #cbd5e1",
                cursor: "pointer",
              }}
            >
              <option value="all">All Years</option>
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
            <select
              value={filterMonth}
              onChange={(e) => setFilterMonth(e.target.value)}
              style={{
                padding: "8px",
                borderRadius: "6px",
                border: "1px solid #cbd5e1",
                cursor: "pointer",
              }}
            >
              <option value="all">All Months</option>
              {months.map((m, i) => (
                <option key={i} value={i}>
                  {m}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* GRID */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
          gap: "20px",
        }}
      >
        {loading ? (
          <p>Loading...</p>
        ) : filteredArtwork.length === 0 ? (
          <div
            style={{
              gridColumn: "1/-1",
              textAlign: "center",
              padding: "40px",
              background: "#fff",
              borderRadius: "12px",
              color: "#94a3b8",
            }}
          >
            No artwork found yet.
          </div>
        ) : (
          filteredArtwork.map((art, index) => (
            <div
              key={art._id}
              style={{
                border: "1px solid #e2e8f0",
                borderRadius: "12px",
                overflow: "hidden",
                background: "#fff",
                position: "relative",
                cursor: "pointer",
              }}
              onClick={() => setLightboxIndex(index)}
            >
              <img
                src={art.imageUrl}
                alt={art.title}
                style={{ width: "100%", height: "200px", objectFit: "cover" }}
              />
              <div style={{ padding: "12px" }}>
                <div
                  style={{
                    fontWeight: "bold",
                    color: "#334155",
                    fontSize: "1rem",
                  }}
                >
                  {art.title || "Untitled"}
                </div>
                <div style={{ fontSize: "0.8rem", color: "#64748b" }}>
                  {art.medium}
                </div>
                <div
                  style={{
                    fontSize: "0.75rem",
                    color: "#94a3b8",
                    marginTop: "5px",
                  }}
                >
                  {new Date(art.dateCreated).toLocaleDateString()}
                </div>
              </div>
              {/* WhatsApp Button */}
              {/* <button
                onClick={(e) => handleWhatsAppStatus(e, art)}
                disabled={shareLoading}
                style={{
                  position: "absolute",
                  top: "10px",
                  right: "10px",
                  background: "#25D366",
                  border: "none",
                  borderRadius: "50%",
                  width: "40px",
                  height: "40px",
                  cursor: "pointer",
                  color: "white",
                  fontSize: "1.2rem",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 2px 5px rgba(0,0,0,0.2)",
                }}
              >
                <FaShareFromSquare size={20} />
              </button> */}
            </div>
          ))
        )}
      </div>

      {/* LIGHTBOX */}
      {lightboxIndex !== null && filteredArtwork[lightboxIndex] && (
        <div
          className="lightbox-overlay"
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            background: "rgba(0,0,0,0.95)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "column",
          }}
          onClick={() => setLightboxIndex(null)}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          <button
            style={{
              position: "absolute",
              top: "20px",
              right: "30px",
              background: "none",
              border: "none",
              color: "white",
              fontSize: "3rem",
              cursor: "pointer",
              zIndex: 10001,
            }}
            onClick={() => setLightboxIndex(null)}
          >
            ×
          </button>

          <button
            style={{
              position: "absolute",
              left: "20px",
              background: "rgba(255,255,255,0.2)",
              border: "none",
              color: "white",
              fontSize: "2rem",
              padding: "10px 15px",
              borderRadius: "50%",
              cursor: "pointer",
              zIndex: 10001,
            }}
            onClick={handlePrev}
          >
            ‹
          </button>

          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: "90vw",
              maxHeight: "80vh",
              position: "relative",
            }}
          >
            <img
              src={filteredArtwork[lightboxIndex].imageUrl}
              alt={filteredArtwork[lightboxIndex].title}
              style={{
                maxWidth: "100%",
                maxHeight: "80vh",
                borderRadius: "8px",
              }}
            />
          </div>

          <button
            style={{
              position: "absolute",
              right: "20px",
              background: "rgba(255,255,255,0.2)",
              border: "none",
              color: "white",
              fontSize: "2rem",
              padding: "10px 15px",
              borderRadius: "50%",
              cursor: "pointer",
              zIndex: 10001,
            }}
            onClick={handleNext}
          >
            ›
          </button>

          <div
            style={{
              marginTop: "15px",
              textAlign: "center",
              color: "white",
              padding: "0 20px",
            }}
          >
            <h3 style={{ margin: "0 0 5px 0" }}>
              {filteredArtwork[lightboxIndex].title || "Untitled"}
            </h3>
            <p style={{ margin: 0, opacity: 0.8 }}>
              {filteredArtwork[lightboxIndex].medium} •{" "}
              {new Date(
                filteredArtwork[lightboxIndex].dateCreated,
              ).toLocaleDateString()}
            </p>

            {/* WhatsApp Large Button */}
            <div style={{ marginTop: "20px" }}>
              <button
                onClick={(e) =>
                  handleWhatsAppStatus(e, filteredArtwork[lightboxIndex])
                }
                disabled={shareLoading}
                style={{
                  background: "#25D366",
                  color: "white",
                  border: "none",
                  padding: "20px",
                  borderRadius: "30px",
                  cursor: "pointer",
                  fontSize: "1.1rem",
                  fontWeight: "bold",
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  margin: "0 auto",
                }}
              >
                {shareLoading ? (
                  "Processing..."
                ) : (
                  <>
                    <FaShareFromSquare size={20} />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ==========================================
// 2. MAIN COMPONENT (ParentDashboard)
// ==========================================
const ParentDashboard = ({ user, onLogout }) => {
  const currentUser = user;

  // 1. Initialize Tab from URL Hash (e.g., #gallery) or default to 'overview'
  const [activeTab, setActiveTab] = useState(() => {
    const hash = window.location.hash.replace("#", "");
    return hash || "overview";
  });
  const [studentProfile, setStudentProfile] = useState(null);
  const [assignedClass, setAssignedClass] = useState(null);
  const [reports, setReports] = useState([]);
  const [attendanceHistory, setAttendanceHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [attendanceMonth, setAttendanceMonth] = useState(
    new Date().toISOString().slice(0, 7),
  );
  const [copyFeedback, setCopyFeedback] = useState("Copy Link");

  // Modal States
  const [showFeeReminder, setShowFeeReminder] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);

  // Toast State
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  // Comment States
  const [activeCommentId, setActiveCommentId] = useState(null);
  const [commentText, setCommentText] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);

  // Theme State
  const [theme, setTheme] = useState(
    localStorage.getItem("appTheme") || "light",
  );
  const [reportQuarter, setReportQuarter] = useState(
    Math.ceil((new Date().getMonth() + 1) / 3),
  );
  const [reportYear, setReportYear] = useState(new Date().getFullYear());

  // Swipe Refs
  const touchStart = useRef(null);
  const touchEndY = useRef(null);
  const touchEnd = useRef(null);

  useEffect(() => {
    if (currentUser?._id) fetchParentData();
  }, [currentUser]);

  useEffect(() => {
    document.body.className = theme;
    localStorage.setItem("appTheme", theme);
  }, [theme]);

  useEffect(() => {
    if (studentProfile) {
      const statusObj = getPaymentStatus();
      if (statusObj.status === "Pending") {
        setShowFeeReminder(true);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentProfile]);

  useEffect(() => {
    const handleBackButton = (event) => {
      if (activeTab !== "overview") {
        setActiveTab("overview");
      }
    };
    const handleClickOutside = (event) => {
      if (
        showProfileMenu &&
        !event.target.closest(".header-profile") &&
        !event.target.closest(".profile-dropdown")
      ) {
        setShowProfileMenu(false);
      }
    };
    window.addEventListener("popstate", handleBackButton);
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      window.removeEventListener("popstate", handleBackButton);
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [activeTab, showProfileMenu]);

  // 3. Listen for Hash Changes (Browser Back/Forward Button Support)
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace("#", "");
      if (hash) {
        setActiveTab(hash);
      } else {
        setActiveTab("overview");
      }
    };

    // Attach listener
    window.addEventListener("hashchange", handleHashChange);

    // Cleanup listener when component unmounts
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  const fetchParentData = async () => {
    setLoading(true);
    try {
      const profileRes = await axios.get(
        `https://art-portal-7n6r.onrender.com/api/student/${currentUser._id}/profile`,
      );
      setStudentProfile(profileRes.data.student);
      setAssignedClass(profileRes.data.classDetails);

      const reportRes = await axios.get(
        `https://art-portal-7n6r.onrender.com/api/feedback/student/${currentUser._id}`,
      );
      setReports(reportRes.data);

      const attRes = await axios.get(
        `https://art-portal-7n6r.onrender.com/api/attendance/student/${currentUser._id}`,
      );
      setAttendanceHistory(attRes.data);
    } catch (err) {
      console.error("Error loading parent data:", err);
    } finally {
      setLoading(false);
    }
  };

  // --- HELPERS ---
  const toggleTheme = () => {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  };

  const formatMonthName = (isoStr) => {
    if (!isoStr) return "N/A";
    if (isoStr.includes("-")) {
      const parts = isoStr.split("-");
      if (parts.length >= 2) return `${parts[1]}-${parts[0]}`;
    }
    return isoStr;
  };

  const formatFullMonthDate = (isoStr) => {
    if (!isoStr) return "N/A";
    const [year, month] = isoStr.split("-");
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleString("default", { month: "long" }) + "-" + year;
  };

  const formatDateDDMMYYYY = (isoDate) => {
    if (!isoDate) return "N/A";
    const date = new Date(isoDate);
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  };

  // Timezone Helper
  const convertScheduleToLocal = (dayName, timeStr) => {
    if (!dayName || !timeStr) return { day: dayName, time: timeStr };
    const daysMap = {
      Sunday: 0,
      Monday: 1,
      Tuesday: 2,
      Wednesday: 3,
      Thursday: 4,
      Friday: 5,
      Saturday: 6,
    };
    const dayIndex = daysMap[dayName];
    if (dayIndex === undefined) return { day: dayName, time: timeStr };
    const now = new Date();
    const currentDayIndex = now.getDay();
    let distance = (dayIndex - currentDayIndex + 7) % 7;
    const refDate = new Date(now);
    refDate.setDate(now.getDate() + distance);
    const [hours, minutes] = timeStr.split(":").map(Number);
    const yyyy = refDate.getFullYear();
    const mm = String(refDate.getMonth() + 1).padStart(2, "0");
    const dd = String(refDate.getDate()).padStart(2, "0");
    const hh = String(hours).padStart(2, "0");
    const min = String(minutes).padStart(2, "0");
    const isoStringIST = `${yyyy}-${mm}-${dd}T${hh}:${min}:00+05:30`;
    const dateObject = new Date(isoStringIST);
    const localDay = dateObject.toLocaleDateString([], { weekday: "long" });
    const localTime = dateObject.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
    return { day: localDay, time: localTime };
  };

  const getLocalSchedule = () => {
    if (!assignedClass || !assignedClass.schedule) return [];
    return assignedClass.schedule.map((slot) =>
      convertScheduleToLocal(slot.day, slot.time),
    );
  };

  const getNextClass = () => {
    const localSchedule = getLocalSchedule();
    if (localSchedule.length === 0) return null;
    const daysMap = {
      Sunday: 0,
      Monday: 1,
      Tuesday: 2,
      Wednesday: 3,
      Thursday: 4,
      Friday: 5,
      Saturday: 6,
    };
    const today = new Date().getDay();
    const sorted = [...localSchedule].sort(
      (a, b) => daysMap[a.day] - daysMap[b.day],
    );
    const next = sorted.find((s) => daysMap[s.day] >= today);
    return next || sorted[0];
  };

  const calculateAttendanceStats = () => {
    const currentMonthRecords = attendanceHistory
      .filter((rec) => rec.date.startsWith(attendanceMonth))
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    const presentCount = currentMonthRecords.filter(
      (r) => r.status === "Present",
    ).length;
    const absentCount = currentMonthRecords.filter(
      (r) => r.status === "Absent",
    ).length;
    const targetClasses = studentProfile?.monthlyClassesTarget || 8;
    let percentage = Math.round((presentCount / targetClasses) * 100);
    if (percentage > 100) percentage = 100;
    return {
      present: presentCount,
      absent: absentCount,
      target: targetClasses,
      percentage,
      records: currentMonthRecords,
    };
  };

  const changeAttendanceMonth = (offset) => {
    const [year, month] = attendanceMonth.split("-").map(Number);
    const date = new Date(year, month - 1 + offset, 1);
    setAttendanceMonth(
      `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`,
    );
  };

  const changeReportQuarter = (direction) => {
    let newQ = reportQuarter + direction;
    let newY = reportYear;
    if (newQ > 4) {
      newQ = 1;
      newY += 1;
    } else if (newQ < 1) {
      newQ = 4;
      newY -= 1;
    }
    setReportQuarter(newQ);
    setReportYear(newY);
  };

  const getFilteredReports = () => {
    return reports
      .filter((rep) => {
        if (!rep.month) return false;
        const [rYear, rMonth] = rep.month.split("-").map(Number);
        const rQuarter = Math.ceil(rMonth / 3);
        return rYear === reportYear && rQuarter === reportQuarter;
      })
      .sort((a, b) => a.month.localeCompare(b.month));
  };

  const getPaymentStatus = () => {
    const today = new Date();
    const currentMonthStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
    const hasPaidCurrentMonth = studentProfile?.payments?.some(
      (p) => p.month === currentMonthStr && p.status === "Paid",
    );
    if (hasPaidCurrentMonth) {
      return { status: "Paid", color: "green" };
    } else {
      return { status: "Pending", color: "red" };
    }
  };

  const getFeeList = () => {
    const today = new Date();
    const currentUserPayments = studentProfile?.payments || [];

    const rawDate = studentProfile?.registeredDate || studentProfile?.createdAt;
    if (!rawDate) return currentUserPayments;

    const regDate = new Date(rawDate);
    const historyStartDate = new Date(2026, 0, 1); // January 2026
    // Show history from Jan 2026 or registration date, whichever is later
    const startDate = regDate > historyStartDate ? regDate : historyStartDate;
    let iterDate = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
    const checkUntil = new Date(today.getFullYear(), today.getMonth(), 1);

    const fullHistory = [];

    while (iterDate <= checkUntil) {
      const monthStr = `${iterDate.getFullYear()}-${String(iterDate.getMonth() + 1).padStart(2, "0")}`;
      const existingRecord = currentUserPayments.find(
        (p) => p.month === monthStr,
      );

      if (existingRecord) {
        fullHistory.push(existingRecord);
      } else {
        fullHistory.push({
          month: monthStr,
          amount: studentProfile?.monthlyFee || 0,
          status: "Pending",
        });
      }
      iterDate.setMonth(iterDate.getMonth() + 1);
    }
    return fullHistory.sort((a, b) => b.month.localeCompare(a.month));
  };

  const calculateTotalPending = (list) => {
    return list
      .filter((item) => item.status === "Pending")
      .reduce((sum, item) => {
        const val = parseFloat(item.amount);
        return sum + (isNaN(val) ? 0 : val);
      }, 0);
  };

  // --- ACTIONS ---

  // ✨ PUSH NOTIFICATION LOGIC (MOVED TO CORRECT LOCATION)
  const subscribeToPush = async () => {
    // 1. Check if browser supports it
    if (!("serviceWorker" in navigator)) {
      return alert("Sorry, this browser does not support notifications.");
    }

    try {
      // 2. Register the Service Worker (sw.js)
      // We look for this file in your 'public' folder
      await navigator.serviceWorker.register("/sw.js");
      const register = await navigator.serviceWorker.register("/sw.js");

      // 3. Subscribe using your VAPID Key
      const publicVapidKey =
        "BC0ajb0fFmrJohj0JlE5fseL4l4BU2gNRP8cPkQXVlAaXw4W6uGAevDqLgrD9Qzy4-W-FQvR-DNf0ccmo0YYkmM";

      const subscription = await register.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicVapidKey),
      });

      // 4. Send subscription to Backend to save in MongoDB
      // Uses the 'user' prop to get the ID
      await axios.post(
        "https://art-portal-7n6r.onrender.com/api/notifications/subscribe",
        {
          userId: user._id,
          subscription: subscription,
        },
      );

      alert("✅ Notifications Enabled! You will now receive artwork updates.");
    } catch (err) {
      console.error("Push Error:", err);
      alert(
        "Failed to enable. Please allow notifications in your browser settings.",
      );
    }
  };

  const handleCopyPaymentDetails = () => {
    const details = `*Payment Details for Thevenkyart Art Academy*\nName: Venkatesh Tammisetti\nPhonePe: +91 9963613404\nUPI ID: 9963613404@ybl\nBank: State Bank of India\nAccount No: 35360947257\nIFSC: SBIN0001424`;
    navigator.clipboard.writeText(details.trim());
    setToastMessage("Payment details copied! ✅");
    setShowToast(true);
    setTimeout(() => {
      setShowToast(false);
    }, 3000);
  };

  const handleSubmitComment = async (reportId) => {
    if (!commentText.trim()) return;
    setSubmittingComment(true);
    try {
      await axios.post(
        `https://art-portal-7n6r.onrender.com/api/feedback/comment`,
        {
          reportId: reportId,
          comment: commentText,
          parentId: currentUser._id,
        },
      );
      const updatedReports = reports.map((r) =>
        r._id === reportId ? { ...r, parentComment: commentText } : r,
      );
      setReports(updatedReports);
      setToastMessage("Comment sent to teacher! 📨");
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
      setCommentText("");
      setActiveCommentId(null);
    } catch (err) {
      console.error("Failed to post comment", err);
      setToastMessage("Failed to send comment ❌");
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleShare = (method) => {
    const websiteUrl = "https://thevenkyart.com";
    const referralText = `Hey! I highly recommend *Thevenkyart Online Art Academy* for professional art classes. Check them out here: ${websiteUrl}. Use my referral name *${currentUser.username}* when you join!`;
    if (method === "whatsapp") {
      window.open(
        `https://wa.me/?text=${encodeURIComponent(referralText)}`,
        "_blank",
      );
    } else if (method === "copy") {
      navigator.clipboard.writeText(referralText);
      setCopyFeedback("Copied! ✅");
      setTimeout(() => setCopyFeedback("Copy Link"), 2000);
    }
  };

  const handleNavClick = (tab) => {
    // Update the URL hash (e.g., adds #gallery to the end of URL)
    window.location.hash = tab;

    // Also update state immediately for instant feedback
    setActiveTab(tab);
    setShowProfileMenu(false);
  };

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
    if (Math.abs(touchEndY.current - e.changedTouches[0].clientY) > 50) return;
  };

  const closeFeeReminder = () => setShowFeeReminder(false);
  const goToFees = () => {
    setShowFeeReminder(false);
    handleNavClick("fees");
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
        <p className="loading-text">
          Curating your child's artistic journey...
        </p>
      </div>
    );
  }

  const attStats = calculateAttendanceStats();
  const filteredReports = getFilteredReports();
  const feeList = getFeeList();
  const totalPendingAmount = calculateTotalPending(feeList);
  const chartData = [
    { name: "Attended", value: attStats.present, color: "#16a34a" },
    { name: "Absent", value: attStats.absent, color: "#ef4444" },
    {
      name: "Remaining",
      value: Math.max(0, attStats.target - attStats.present - attStats.absent),
      color: "#e2e8f0",
    },
  ];

  const localSchedule = getLocalSchedule();
  const nextClass = getNextClass();

  return (
    <div
      className={`parent-container ${theme}`}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      <aside className="parent-sidebar">
        <div className="sidebar-header">
          <img src={logoImg} alt="Logo" className="sidebar-logo-img" />
          <img src={titleImg} alt="Title" className="sidebar-title-img" />
        </div>
        <div className="p-nav">
          <button
            className={activeTab === "overview" ? "active" : ""}
            onClick={() => handleNavClick("overview")}
          >
            <span>📊</span> Overview
          </button>
          {/* ✨ NEW GALLERY BUTTON IN SIDEBAR */}
          <button
            className={activeTab === "gallery" ? "active" : ""}
            onClick={() => handleNavClick("gallery")}
          >
            <span>🎨</span> My Gallery
          </button>
          <button
            className={activeTab === "schedule" ? "active" : ""}
            onClick={() => handleNavClick("schedule")}
          >
            <span>🗓️</span> Class Schedule
          </button>
          <button
            className={activeTab === "reports" ? "active" : ""}
            onClick={() => handleNavClick("reports")}
          >
            <span>📝</span> Academic Reports
          </button>
          <button
            className={activeTab === "attendance" ? "active" : ""}
            onClick={() => handleNavClick("attendance")}
          >
            <span>📅</span> Attendance Log
          </button>
          <button
            className={activeTab === "fees" ? "active" : ""}
            onClick={() => handleNavClick("fees")}
          >
            <span>💳</span> Fee Status
          </button>
          <button
            className={activeTab === "refer" ? "active" : ""}
            onClick={() => handleNavClick("refer")}
          >
            <span>📣</span> Refer & Support
          </button>
          {/* <button 
            onClick={subscribeToPush} 
            style={{
              marginTop: '15px', 
              background: '#10b981', 
              color: 'white', 
              border: 'none', 
              padding: '10px', 
              borderRadius: '8px', 
              cursor: 'pointer', 
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            🔔 Enable Alerts
          </button> */}

          <button
            onClick={() => setShowTutorial(true)}
            style={{ marginTop: "10px", color: "#2563eb" }}
          >
            <span>💡</span> App Tutorial
          </button>
        </div>
        <div className="sidebar-footer">
          <p>© 2026 Thevenkyart Art Academy</p>
        </div>
      </aside>

      <main className="parent-main">
        <header className="p-header">
          <div className="p-header-left">
            <h2>
              {activeTab === "overview"
                ? "My Dashboard"
                : activeTab === "refer"
                  ? "Refer a Friend"
                  : activeTab === "gallery"
                    ? "My Art Gallery"
                    : activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}
            </h2>
          </div>
          <div className="p-header-right">
            <button
              className="refresh-btn"
              onClick={fetchParentData}
              title="Refresh Data"
              disabled={loading}
            >
              <span className={loading ? "spin" : ""}>🔄</span>
            </button>
            <span className="role-badge desktop-only">Parent</span>
            <div
              className="header-profile"
              onClick={() => setShowProfileMenu(!showProfileMenu)}
            >
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
                <button
                  className="pd-menu-btn theme-toggle"
                  onClick={toggleTheme}
                >
                  {theme === "light" ? "🌙 Dark Mode" : "☀️ Light Mode"}
                </button>
                <button
                  className="pd-menu-btn"
                  onClick={() => setShowTutorial(true)}
                >
                  💡 App Tutorial
                </button>
                <button
                  className="pd-menu-btn"
                  onClick={() => handleNavClick("refer")}
                >
                  📣 Refer & Support
                </button>
                {/* ✨ NEW: Enable Alerts Button for Mobile Menu */}
                <button
                  className="pd-menu-btn"
                  onClick={() => {
                    subscribeToPush();
                    setShowProfileMenu(false);
                  }}
                  style={{ fontWeight: "bold" }}
                >
                  🔔 Enable Alerts
                </button>
                <button
                  className="pd-menu-btn logout"
                  onClick={() => {
                    setShowLogoutModal(true);
                    setShowProfileMenu(false);
                  }}
                >
                  {" "}
                  Logout
                </button>
              </div>
            )}
          </div>
        </header>

        <div className="p-content">
          {activeTab === "overview" && (
            <div className="overview-grid">
              <div
                className="welcome-card"
                style={{
                  "--desktop-bg": `url(${bannerImg})`,
                  "--mobile-bg": `url(${bannerMobile})`,
                }}
              >
                <div className="wc-text">
                  <h1>
                    Hello,{" "}
                    <span style={{ textTransform: "capitalize" }}>
                      {currentUser.fullName}
                    </span>
                    !
                  </h1>
                  <p>
                    Here is a quick summary of your child{" "}
                    <strong>{currentUser.childName}'s</strong> progress at
                    Thevenkyart Art Academy.
                  </p>
                </div>
              </div>
              <div className="info-card attendance-card">
                <h3
                  onClick={() => handleNavClick("attendance")}
                  className="clickable-heading"
                >
                  📅 Attendance
                </h3>
                <div
                  style={{
                    width: "100%",
                    height: "140px",
                    position: "relative",
                    marginTop: "10px",
                  }}
                >
                  <ResponsiveContainer>
                    <PieChart>
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
                        {chartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  <div
                    style={{
                      position: "absolute",
                      top: "50%",
                      left: "50%",
                      transform: "translate(-50%, -50%)",
                      textAlign: "center",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "1.4rem",
                        fontWeight: "800",
                        color: theme === "dark" ? "#f1f5f9" : "#1e293b",
                      }}
                    >
                      {attStats.percentage}%
                    </span>
                  </div>
                </div>
                <div className="att-details-text">
                  <div className="ad-row">
                    <span>Attended:</span>
                    <strong className="green">
                      {attStats.present} Classes
                    </strong>
                  </div>
                  <div className="ad-row">
                    <span>Absent:</span>
                    <strong className="red">{attStats.absent} Classes</strong>
                  </div>
                  <div className="ad-row">
                    <span>Total Classes:</span>
                    <strong>{attStats.target} Classes</strong>
                  </div>
                </div>
              </div>
              <div className="info-card report-preview-card">
                <h3
                  onClick={() => handleNavClick("reports")}
                  className="clickable-heading"
                >
                  📝 Latest Report
                </h3>
                {reports.length > 0 ? (
                  <div className="latest-report-box">
                    <div className="lrb-header">
                      <span className="lrb-month">
                        {formatFullMonthDate(reports[0].month)} Report
                      </span>
                      <span className="lrb-rating">
                        {"★".repeat(reports[0].rating)}
                      </span>
                    </div>
                    <p className="lrb-text">
                      "{reports[0].feedbackText.substring(0, 60)}..."
                    </p>
                    {reports[0].reportFile ? (
                      <a
                        href={reports[0].reportFile}
                        target="_blank"
                        rel="noreferrer"
                        className="mini-link-btn"
                      >
                        📄 View PDF
                      </a>
                    ) : (
                      <button
                        className="mini-link-btn"
                        onClick={() => handleNavClick("reports")}
                      >
                        View Details
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="empty-mini">No reports released yet.</div>
                )}
              </div>
              <div className="info-card next-class-card">
                <h3
                  onClick={() => handleNavClick("schedule")}
                  className="clickable-heading"
                >
                  🚀 Next Class (Local Time)
                </h3>
                {assignedClass ? (
                  <div className="nc-details">
                    <div className="nc-row">
                      <span className="nc-label">Class:</span>
                      <span className="nc-val">{assignedClass.className}</span>
                    </div>
                    <div className="nc-row">
                      <span className="nc-label">Time:</span>
                      <span className="nc-val highlight">
                        {nextClass?.day} @ {nextClass?.time}
                      </span>
                    </div>
                    {assignedClass.meetingLink ? (
                      <a
                        href={assignedClass.meetingLink}
                        target="_blank"
                        rel="noreferrer"
                        className="join-btn"
                      >
                        Join Zoom Class
                      </a>
                    ) : (
                      <button className="join-btn disabled" disabled>
                        No Link Yet
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="empty-mini">
                    No class assigned yet. Contact Admin.
                  </div>
                )}
              </div>
              <div className="info-card fee-card">
                <h3
                  onClick={() => handleNavClick("fees")}
                  className="clickable-heading"
                >
                  💳 Fee Status
                </h3>
                <div className={`fee-status-badge ${getPaymentStatus().color}`}>
                  {getPaymentStatus().status}
                </div>
                <p className="fee-note">
                  {getPaymentStatus().status === "Paid"
                    ? "All caught up!"
                    : "Please clear dues."}
                </p>
              </div>
              <div className="info-card profile-card">
                <h3>👤 Student Details</h3>
                <div className="detail-row">
                  <span className="lbl">Student ID:</span>
                  <span className="val">{currentUser.username}</span>
                </div>
                <div className="detail-row">
                  <span className="lbl">Date of Birth:</span>
                  <span className="val">
                    {studentProfile?.childDob
                      ? new Date(studentProfile.childDob).toLocaleDateString()
                      : "N/A"}
                  </span>
                </div>
                <div className="detail-row">
                  <span className="lbl">Parent Phone:</span>
                  <span className="val">
                    {studentProfile?.phone || currentUser.phone}
                  </span>
                </div>
                <div className="detail-row">
                  <span className="lbl">Class Level:</span>
                  <span className="val tag">
                    {assignedClass ? (
                      <>
                        {assignedClass.level}
                        {assignedClass.subLevel &&
                          ` - ${assignedClass.subLevel}`}
                      </>
                    ) : (
                      "N/A"
                    )}
                  </span>
                </div>
              </div>
            </div>
          )}

          {activeTab === "schedule" && (
            <div className="schedule-view">
              {assignedClass ? (
                <div className="class-detail-card">
                  <div className="cdc-header">
                    <div>
                      <h2>{assignedClass.className}</h2>
                      <p>
                        Teacher:{" "}
                        {assignedClass.teacher?.fullName || "Not Assigned"}
                      </p>
                    </div>
                    <span className="level-tag">{assignedClass.level}</span>
                  </div>
                  <div className="cdc-grid">
                    {localSchedule.map((slot, idx) => (
                      <div key={idx} className="slot-item">
                        <span className="slot-day">{slot.day}</span>
                        <span className="slot-time">{slot.time}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="empty-state">
                  No class assigned. Please contact admin.
                </div>
              )}
            </div>
          )}

          {activeTab === "reports" && (
            <div className="reports-view">
              <div className="att-header-row">
                <h3>Academic Reports</h3>
                <div className="month-nav-mini">
                  <button onClick={() => changeReportQuarter(-1)}>‹</button>
                  <span>
                    Q{reportQuarter} {reportYear}
                  </span>
                  <button onClick={() => changeReportQuarter(1)}>›</button>
                </div>
              </div>
              {filteredReports.length === 0 ? (
                <div className="empty-state">
                  No reports found for Quarter {reportQuarter}, {reportYear}.
                </div>
              ) : (
                <div className="reports-list">
                  {filteredReports.map((rep) => (
                    <div key={rep._id} className="report-card">
                      <div className="rc-header">
                        <span className="rc-month">
                          {formatFullMonthDate(rep.month)} Report
                        </span>
                        <div className="rc-rating">
                          {"★".repeat(rep.rating)}
                        </div>
                      </div>
                      <div className="rc-body">
                        <p>"{rep.feedbackText}"</p>
                      </div>

                      {rep.parentComment && (
                        <div className="saved-comment-box">
                          <span className="sc-icon">✅</span>
                          <div className="sc-content">
                            <strong>Your Feedback:</strong>
                            <p>{rep.parentComment}</p>
                          </div>
                        </div>
                      )}

                      {activeCommentId === rep._id && (
                        <div className="comment-input-area animate-fade-in">
                          <textarea
                            placeholder="Write your feedback to the teacher..."
                            value={commentText}
                            onChange={(e) => setCommentText(e.target.value)}
                            className="rc-textarea"
                          />
                          <div className="cia-actions">
                            <button
                              className="cia-btn cancel"
                              onClick={() => setActiveCommentId(null)}
                            >
                              Cancel
                            </button>
                            <button
                              className="cia-btn send"
                              onClick={() => handleSubmitComment(rep._id)}
                              disabled={submittingComment}
                            >
                              {submittingComment ? "Sending..." : "Send"}
                            </button>
                          </div>
                        </div>
                      )}

                      <div className="rc-footer">
                        <span className="rc-teacher">
                          By: Thevenkyart Art Academy
                        </span>
                        <div className="rc-footer-actions">
                          {!rep.parentComment && (
                            <button
                              className="rc-action-btn comment"
                              onClick={() =>
                                setActiveCommentId(
                                  activeCommentId === rep._id ? null : rep._id,
                                )
                              }
                            >
                              💬 Comment
                            </button>
                          )}
                          {rep.reportFile && (
                            <a
                              href={rep.reportFile}
                              target="_blank"
                              rel="noreferrer"
                              className="rc-action-btn pdf"
                            >
                              📄 View PDF
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === "attendance" && (
            <div className="att-history-view">
              <div className="att-header-row">
                <h3>Monthly Log</h3>
                <div className="month-nav-mini">
                  <button onClick={() => changeAttendanceMonth(-1)}>‹</button>
                  <span>{formatMonthName(attendanceMonth)}</span>
                  <button onClick={() => changeAttendanceMonth(1)}>›</button>
                </div>
              </div>
              <div className="att-summary-bar">
                <div className="as-item">
                  <span className="as-label">Attended</span>
                  <span className="as-val green">{attStats.present}</span>
                </div>
                <div className="as-item">
                  <span className="as-label">Absent</span>
                  <span className="as-val red">{attStats.absent}</span>
                </div>
                <div className="as-item">
                  <span className="as-label">Total classes</span>
                  <span className="as-val">{attStats.target}</span>
                </div>
              </div>
              <div className="att-table-wrapper">
                {attStats.records.length === 0 ? (
                  <div className="empty-state">
                    No attendance records for {formatMonthName(attendanceMonth)}
                    .
                  </div>
                ) : (
                  <table className="att-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Day</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {attStats.records.map((rec) => (
                        <tr key={rec._id}>
                          <td>{formatDateDDMMYYYY(rec.date)}</td>
                          <td>
                            {new Date(rec.date).toLocaleDateString("en-US", {
                              weekday: "long",
                            })}
                          </td>
                          <td>
                            <span
                              className={`status-pill ${rec.status.toLowerCase()}`}
                            >
                              {rec.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {activeTab === "fees" && (
            <div className="fees-view">
              <div className="fees-header-bar">
                <h3>Fee History</h3>
                <div className="fee-actions">
                  {totalPendingAmount > 0 && (
                    <span className="pending-amount-text">
                      Total fee due: ₹{totalPendingAmount}
                    </span>
                  )}
                  <button
                    className="pay-now-btn"
                    onClick={() => setShowPaymentModal(true)}
                  >
                    Pay Now
                  </button>
                </div>
              </div>
              <div className="fee-table-wrapper">
                <table className="fee-table">
                  <thead>
                    <tr>
                      <th>Month</th>
                      <th>Amount</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {feeList.map((pay, idx) => (
                      <tr key={idx}>
                        <td>{formatFullMonthDate(pay.month)}</td>
                        <td>
                          {pay.amount === "---" ? "---" : `₹${pay.amount}`}
                        </td>
                        <td>
                          <span
                            className={`fee-pill ${pay.status.toLowerCase()}`}
                          >
                            {pay.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {feeList.length === 0 && (
                      <tr>
                        <td
                          colSpan="3"
                          style={{ textAlign: "center", padding: "20px" }}
                        >
                          No payment history found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === "refer" && (
            <div className="referral-view">
              <div className="referral-grid">
                <div className="referral-card institute-card">
                  <div className="inst-cover"></div>
                  <div className="inst-body">
                    <img
                      src={logoImg}
                      alt="Venky Art Logo"
                      className="inst-logo-img"
                    />
                    <img
                      src={titleImg}
                      alt="Venky Art Academy"
                      className="inst-title-img"
                    />
                    <p className="inst-tagline">
                      "Unleashing Creativity in Every Child"
                    </p>
                    <div className="inst-details">
                      <div className="id-row">
                        <span>🌐</span>{" "}
                        <a
                          href="https://thevenkyart.com"
                          target="_blank"
                          rel="noreferrer"
                        >
                          thevenkyart.com
                        </a>
                      </div>
                      <div className="id-row">
                        <span>📧</span> <span>thevenkyart@gmail.com</span>
                      </div>
                      <div className="id-row">
                        <span>📞</span> <span>+91 9963613404</span>
                      </div>
                      <div className="id-row">
                        <span>📍</span> <span>Hyderabad, Telangana</span>
                      </div>
                    </div>
                    <div className="inst-desc">
                      We provide professional art training in Drawing,
                      Sketching, and Painting for students of all ages.
                    </div>
                  </div>
                </div>
                <div className="referral-card action-card">
                  <h3>Spread the Word!</h3>
                  <p className="action-desc">
                    Love our classes? Refer a friend or family member and let
                    them experience the joy of art.
                  </p>
                  <div className="referral-code-box">
                    <span className="rc-label">Your Referral Code</span>
                    <div className="code-display">{currentUser.username}</div>
                  </div>
                  <div className="share-buttons">
                    <button
                      className="share-btn whatsapp"
                      onClick={() => handleShare("whatsapp")}
                    >
                      <span>💬</span> Share via WhatsApp
                    </button>
                    <button
                      className="share-btn copy"
                      onClick={() => handleShare("copy")}
                    >
                      <span>📋</span> {copyFeedback}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ✨✨ NEW GALLERY TAB CONTENT ✨✨ */}
          {activeTab === "gallery" && (
            <ParentGalleryTab studentId={currentUser._id} />
          )}
        </div>
      </main>

      <nav className="mobile-bottom-nav">
        <button
          className={activeTab === "overview" ? "nav-item active" : "nav-item"}
          onClick={() => handleNavClick("overview")}
        >
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
          </svg>
        </button>
        <button
          className={activeTab === "schedule" ? "nav-item active" : "nav-item"}
          onClick={() => handleNavClick("schedule")}
        >
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M17 12h-5v5h5v-5zM16 1v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19a2 2 0 0 0 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2h-1V1h-2zm3 18H5V8h14v11z" />
          </svg>
        </button>

        {/* ✨ ADDED GALLERY ICON TO MOBILE NAV */}
        <button
          className={activeTab === "gallery" ? "nav-item active" : "nav-item"}
          onClick={() => handleNavClick("gallery")}
        >
          <span style={{ fontSize: "1.5rem" }}>🎨</span>
        </button>

        <button
          className={activeTab === "reports" ? "nav-item active" : "nav-item"}
          onClick={() => handleNavClick("reports")}
        >
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z" />
          </svg>
        </button>
        <button
          className={activeTab === "fees" ? "nav-item active" : "nav-item"}
          onClick={() => handleNavClick("fees")}
        >
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M20 4H4c-1.11 0-1.99.89-1.99 2L2 18c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V6c0-1.11-.89-2-2-2zm0 14H4v-6h16v6zm0-10H4V6h16v2z" />
          </svg>
        </button>
      </nav>

      {/* ✨ TUTORIAL MODAL COMPONENT */}
      {showTutorial && <TutorialModal onClose={() => setShowTutorial(false)} />}

      {showLogoutModal && (
        <div className="logout-modal-overlay">
          <div className="logout-modal">
            <h3 className="lm-title">Confirm Logout</h3>
            <p className="lm-text">Are you sure you want to exit?</p>
            <div className="lm-actions">
              <button
                className="lm-btn cancel"
                onClick={() => setShowLogoutModal(false)}
              >
                Cancel
              </button>
              <button className="lm-btn confirm" onClick={onLogout}>
                Yes, Logout
              </button>
            </div>
          </div>
        </div>
      )}

      {showFeeReminder && (
        <div className="logout-modal-overlay">
          <div className="logout-modal fee-modal-alert">
            <div className="fee-icon-circle">!</div>
            <h3 className="lm-title">Fee Pending Remainder</h3>
            <p className="lm-text">
              Hello Parent, Your fees for the current month are pending. Please
              clear them to continue uninterrupted classes.
            </p>
            <div className="lm-actions">
              <button className="lm-btn cancel" onClick={closeFeeReminder}>
                Close
              </button>
              <button className="lm-btn confirm" onClick={goToFees}>
                Pay Now
              </button>
            </div>
          </div>
        </div>
      )}

      {showPaymentModal && (
        <div className="logout-modal-overlay">
          <div className="payment-modal">
            <div className="pm-header">
              <h3>Payment Details</h3>
              <button
                className="close-x"
                onClick={() => setShowPaymentModal(false)}
              >
                ×
              </button>
            </div>
            <div className="pm-body">
              <div className="qr-section">
                <img src={qrCodeImg} alt="Pay via UPI" className="qr-img" />
                <p>Scan to Pay via Any UPI App</p>
              </div>
              <div className="details-section">
                <div className="ds-row">
                  <span className="ds-label">Name</span>
                  <span className="ds-val">Venkatesh Tammisetti</span>
                </div>
                <div className="ds-row">
                  <span className="ds-label">PhonePe</span>
                  <span className="ds-val">+91 9963613404</span>
                </div>
                <div className="ds-row">
                  <span className="ds-label">UPI ID</span>
                  <span className="ds-val">9963613404@ybl</span>
                </div>
                <div className="divider"></div>
                <div className="ds-row">
                  <span className="ds-label">Bank Name</span>
                  <span className="ds-val">State Bank of India Bank</span>
                </div>
                <div className="ds-row">
                  <span className="ds-label">Account No</span>
                  <span className="ds-val">35360947257</span>
                </div>
                <div className="ds-row">
                  <span className="ds-label">IFSC Code</span>
                  <span className="ds-val">SBIN0001424</span>
                </div>
              </div>
            </div>
            <div className="pm-footer">
              <p>After payment, please share a screenshot on WhatsApp.</p>
              <button
                className="copy-details-btn"
                onClick={handleCopyPaymentDetails}
              >
                📋 Copy Details to Share
              </button>
            </div>
          </div>
        </div>
      )}

      {showToast && <div className="fee-toast-message">{toastMessage}</div>}
    </div>
  );
};

// ✨ TUTORIAL MODAL COMPONENT
const TutorialModal = ({ onClose }) => {
  const [currentStep, setCurrentStep] = useState(0);

  const nextStep = () => {
    if (currentStep < TUTORIAL_STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onClose(); // Finish tutorial
    }
  };

  const prevStep = () => {
    if (currentStep > 0) setCurrentStep(currentStep - 1);
  };

  const step = TUTORIAL_STEPS[currentStep];

  return (
    <div className="logout-modal-overlay">
      <div className="tutorial-modal-card">
        <div className="tm-icon">{step.icon}</div>
        <h3 className="tm-title">{step.title}</h3>
        <p className="tm-desc">{step.desc}</p>

        <div className="tm-dots">
          {TUTORIAL_STEPS.map((_, idx) => (
            <span
              key={idx}
              className={`tm-dot ${idx === currentStep ? "active" : ""}`}
            ></span>
          ))}
        </div>

        <div className="tm-actions">
          <button
            className="tm-btn secondary"
            onClick={currentStep === 0 ? onClose : prevStep}
          >
            {currentStep === 0 ? "Skip" : "Back"}
          </button>
          <button className="tm-btn primary" onClick={nextStep}>
            {currentStep === TUTORIAL_STEPS.length - 1 ? "Finish" : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ParentDashboard;
