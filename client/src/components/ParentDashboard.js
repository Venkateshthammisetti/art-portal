import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { buildFeeHistory, feeRowForMonth, monthKey } from "../utils/fees";
import { NotificationSettings, WhatsNewCard, MoreSheet } from "./ParentExtras";
import { RatingTrend, AttendanceCalendar, attendanceStreak, bestStreak, GalleryProgress } from "./ParentProgress";
import { AbsencePanel, downloadCalendar, EditContactSheet, ReportThread, PaymentProofSheet, downloadReceipt, ReferralStats, useFamily, switchToChild, ClassNotesCard } from "./ParentSelf";
import "./ParentDashboard.css";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

import { AttendanceAnalysisPanel } from "./AttendanceAnalysisPanel";
import ListCountHeader from "./ListCountHeader";
import { ArtworkViewer, ArtThumb, useIncrementalList, GridSentinel } from "./ArtworkViewer";
import BirthdayNotificationBell from "./BirthdayNotifications";

// Ensure these image paths are correct in your project
import logoImg from "./new-logo.png";
import titleImg from "./logo-title-copy.png";
import bannerImg from "./banner4.jpg";
import bannerMobile from "./banner-001.png";
import qrCodeImg from "./upi-qr.png";
import UpiPayCard from "./UpiPay";
import { UPI_ID } from "../utils/upi";

import { FaShareFromSquare } from "react-icons/fa6";

import {
  IconGreeting,
  IconHome,
  IconSchedule,
  IconTrendingUp,
  IconExpense,
  IconArt,
  IconDownload,
  IconShare,
  IconTrophy,
  IconPdf,
  IconEye,
  IconBell,
  IconHelp,
  IconRefresh,
  IconSun,
  IconMoon,
  IconAnnounce,
  IconCalendar,
  IconNote,
  IconStar,
  IconLaunch,
  IconFee,
  IconUser,
  IconOnlineClass,
  IconOfflineClass,
  IconMessage,
  IconMail,
  IconPhone,
  IconLocation,
  IconClipboard,
  IconGlobe,
} from "./Icons";

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

// Header title for each tab
const TAB_TITLES = {
  overview: "Home",
  schedule: "Class Schedule",
  gallery: "My Art Gallery",
  reports: "Reports",
  attendance: "Attendance",
  certifications: "My Certificates",
  fees: "Fees",
  refer: "Refer & Support",
};

// Tabs reached from "More" in the phone bottom bar
const MORE_TABS = ["reports", "attendance", "certifications", "refer"];

// --- TUTORIAL STEPS DATA ---
const TUTORIAL_STEPS = [
  {
    id: 1,
    title: "Welcome to Thevenkyart!",
    desc: (
      <span>
        Welcome to your new <b>Parent Dashboard!</b> This is your central hub to
        track your child's artistic journey, attendance, and growth.
      </span>
    ),
    icon: <IconGreeting />,
  },
  {
    id: 2,
    title: "Quick Overview",
    desc: (
      <span>
        The <b>'Overview'</b> tab gives you a snapshot. See upcoming classes,
        attendance percentage, latest teacher feedback at a glance, fee status,
        next class schedule, Basic details of the student
      </span>
    ),
    icon: <IconHome />,
  },
  {
    id: 3,
    title: "Join Classes",
    desc: (
      <span>
        Go to the <b>'Class Schedule'</b> tab to find your child's timetable.
        The Zoom links for classes will appear there automatically.
      </span>
    ),
    icon: <IconSchedule />,
  },
  {
    id: 4,
    title: "Track Progress",
    desc: (
      <span>
        Check <b>'Academic Reports'</b> to view detailed feedback from teachers,
        download report cards, and reply with your own comments.
      </span>
    ),
    icon: <IconTrendingUp />,
  },
  {
    id: 5,
    title: "Gallery & Certificates",
    desc: (
      <span>
        <b>'Gallery'</b> shows every artwork your child makes — tap to zoom,
        download or share on WhatsApp. <b>'Certificates'</b> (under More on
        phones) holds certificates to view and download.
      </span>
    ),
    icon: <IconHome />,
  },
  {
    id: 6,
    title: "Attendance",
    desc: (
      <span>
        <b>'Attendance'</b> (under More on phones) lists every class, month by
        month, with an analysis view of the whole year.
      </span>
    ),
    icon: <IconTrendingUp />,
  },
  {
    id: 7,
    title: "Manage Fees",
    desc: (
      <span>
        Visit <b>'Fees'</b> to check for pending dues. You can view
        payment history and get UPI details to pay securely.
      </span>
    ),
    icon: <IconExpense />,
  },
  {
    id: 8,
    title: "Stay Updated",
    desc: (
      <span>
        Turn on <b>Notifications</b> (profile menu or More) to hear about new
        reports, artwork, absences and a reminder before each class. Choose
        exactly which updates you want.
      </span>
    ),
    icon: <IconSchedule />,
  },
];

// ==========================================
// 1. PARENT GALLERY COMPONENT
// ==========================================
const ParentGalleryTab = ({ studentId }) => {
  const [artwork, setArtwork] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const [sharingId, setSharingId] = useState(null); // only the artwork being shared shows "…"

  // Filters
  const [filterYear, setFilterYear] = useState("all");
  const [filterMonth, setFilterMonth] = useState("all");

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
  // Long galleries render in batches as you scroll (1,000+ artworks in "All")
  const { visible: visibleArtwork, hasMore: hasMoreArt, showMore: showMoreArt } = useIncrementalList(filteredArtwork);

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

            // Footer scales with the artwork so the text stays readable
            const footerHeight = Math.max(100, Math.round(artImg.width * 0.12));
            canvas.width = artImg.width;
            canvas.height = artImg.height + footerHeight;
            ctx.drawImage(artImg, 0, 0);
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, artImg.height, canvas.width, footerHeight);

            const logoSize = Math.round(footerHeight * 0.62);
            const pad = Math.round(footerHeight * 0.2);
            ctx.drawImage(logo, pad, artImg.height + (footerHeight - logoSize) / 2, logoSize, logoSize);

            ctx.textAlign = "center";
            const centerX = canvas.width / 2 + logoSize / 2;
            ctx.fillStyle = "#333333";
            ctx.font = `600 ${Math.round(footerHeight * 0.2)}px Arial`;
            ctx.fillText("www.thevenkyart.com", centerX, artImg.height + footerHeight * 0.45);
            ctx.fillStyle = "#b42d00";
            ctx.font = `bold ${Math.round(footerHeight * 0.15)}px Arial`;
            ctx.fillText("THEVENKYART ONLINE ART ACADEMY", centerX, artImg.height + footerHeight * 0.75);

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
    setSharingId(art._id);

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
      setSharingId(null);
    }
  };

  // Download Handler
  const handleDownload = async (e, imageUrl, title) => {
    e.stopPropagation();
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${title || "artwork"}.${blob.type.split("/")[1] || "jpg"}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert("Failed to download. Try again.");
    }
  };

  // Years that actually have artwork, newest first
  const years = [...new Set(artwork.map((a) => a.dateCreated && new Date(a.dateCreated).getFullYear()).filter(Boolean))].sort((x, y) => y - x);
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
    // `gallery-wrapper` lifts the 800px cap that .form-wrapper otherwise
    // applies, so the gallery fills the content area exactly like the Admin
    // and Teacher galleries do.
    <div className="form-wrapper gallery-wrapper" style={{ padding: "20px" }}>
      {/* MODERN FILTER BAR */}
      <div className="gallery-filter-bar">
        <h3 className="gallery-filter-title">
          <IconArt /> My Art Gallery
          <span className="gallery-count-badge">{filteredArtwork.length}</span>
        </h3>
        <div className="gallery-filter-controls">
          <select className="gallery-filter-select" value={filterYear} onChange={(e) => setFilterYear(e.target.value)}>
            <option value="all">All Years</option>
            {years.map((y) => (<option key={y} value={y}>{y}</option>))}
          </select>
          <select className="gallery-filter-select" value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)}>
            <option value="all">All Months</option>
            {months.map((m, i) => (<option key={i} value={i}>{m}</option>))}
          </select>
        </div>
      </div>

      {!loading && filterYear === "all" && filterMonth === "all" && (
        <GalleryProgress
          artwork={artwork}
          onOpen={(a) => { const i = filteredArtwork.findIndex((x) => x._id === a._id); if (i > -1) setLightboxIndex(i); }}
        />
      )}

      {!loading && (
        <ListCountHeader label="Artworks" count={filteredArtwork.length} total={artwork.length} style={{ padding: "0 0 12px" }} />
      )}

      {/* GALLERY GRID — same class (and so the same column breakpoints) as the
          Teacher gallery, which uses these identical .gal-card children. */}
      <div className="gal-grid">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="gallery-skeleton-card">
              <div className="gallery-skeleton-img" />
              <div className="gallery-skeleton-info">
                <div className="gallery-skeleton-line" />
                <div className="gallery-skeleton-line short" />
                <div className="gallery-skeleton-line xs" />
              </div>
            </div>
          ))
        ) : filteredArtwork.length === 0 ? (
          <div className="gallery-empty-state">
            <div className="gallery-empty-icon"><IconArt size={40} /></div>
            <p className="gallery-empty-title">No artwork yet</p>
            <p className="gallery-empty-sub">Your child's artwork will appear here</p>
          </div>
        ) : (
          visibleArtwork.map((art, index) => (
            <div key={art._id} className="gal-card" onClick={() => setLightboxIndex(index)}>
              <ArtThumb src={art.imageUrl} alt={art.title} className="gal-card-img" />
              <div className="gal-card-overlay">
                <div className="gal-card-overlay-title">{art.title || "Untitled"}</div>
                <div className="gal-card-overlay-sub">{art.medium} • {new Date(art.dateCreated).toLocaleDateString()}{art.teacherId?.fullName ? ` • ${art.teacherId.fullName}` : ""}</div>
              </div>
              <div className="gal-card-actions">
                <button className="gal-action-btn download" onClick={(e) => handleDownload(e, art.imageUrl, art.title)} title="Download" aria-label="Download"><IconDownload /></button>
                <button className="gal-action-btn share" onClick={(e) => handleWhatsAppStatus(e, art)} disabled={sharingId === art._id} title="Share on WhatsApp" aria-label="Share on WhatsApp">
                  {sharingId === art._id ? "…" : <IconShare />}
                </button>
              </div>
            </div>
          ))
        )}
      </div>
      {!loading && hasMoreArt && <GridSentinel key={visibleArtwork.length} onVisible={showMoreArt} />}

      {/* Full-screen viewer: swipe, swipe down to close, pinch / double-tap zoom */}
      {lightboxIndex !== null && filteredArtwork[lightboxIndex] && (
        <ArtworkViewer
          items={filteredArtwork}
          index={lightboxIndex}
          onIndexChange={setLightboxIndex}
          onClose={() => setLightboxIndex(null)}
          renderActions={(art) => (
            <>
              <button type="button" className="av-action" onClick={(e) => handleDownload(e, art.imageUrl, art.title)}>
                <IconDownload /> Download
              </button>
              <button type="button" className="av-action share" onClick={(e) => handleWhatsAppStatus(e, art)} disabled={sharingId === art._id}>
                {sharingId === art._id ? "Preparing…" : <><IconShare /> Share</>}
              </button>
            </>
          )}
        />
      )}
    </div>
  );
};

// ==========================================
// 1b. PARENT CERTIFICATIONS COMPONENT
// ==========================================
const ParentCertificationsTab = ({ studentId }) => {
  const [certifications, setCertifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const baseUrl = "https://art-portal-7n6r.onrender.com";

    axios
      .get(`${baseUrl}/api/certifications/student/${studentId}`)
      .then((res) => setCertifications(res.data))
      .catch((err) => console.error("Certifications Error:", err))
      .finally(() => setLoading(false));
  }, [studentId]);

  const handleDownload = async (e, fileUrl, title) => {
    e.stopPropagation();
    try {
      const response = await fetch(fileUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const extension = fileUrl.toLowerCase().endsWith(".pdf")
        ? "pdf"
        : blob.type.split("/")[1] || "jpg";
      link.download = `${title || "certificate"}.${extension}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert("Failed to download. Try again.");
    }
  };

  // Share the certificate itself (phones) or a WhatsApp message with its link
  const [sharingCert, setSharingCert] = useState(null);
  const handleShare = async (cert) => {
    const text = `🏅 Proud moment! My child received "${cert.title || "a certificate"}" at Thevenkyart Art Academy 🎨`;
    setSharingCert(cert._id);
    try {
      const blob = await (await fetch(cert.fileUrl)).blob();
      const isPdf = cert.fileUrl.toLowerCase().endsWith(".pdf");
      const file = new File([blob], `${(cert.title || "certificate").replace(/[^\w -]/g, "")}.${isPdf ? "pdf" : (blob.type.split("/")[1] || "jpg")}`, { type: blob.type || (isPdf ? "application/pdf" : "image/jpeg") });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], text });
        return;
      }
      throw new Error("file share unsupported");
    } catch (err) {
      if (err?.name === "AbortError") return; // parent closed the share sheet
      window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(`${text}\n${cert.fileUrl}`)}`, "_blank", "noopener");
    } finally {
      setSharingCert(null);
    }
  };

  return (
    <div className="form-wrapper" style={{ padding: "20px" }}>
      <div className="gallery-filter-bar">
        <h3 className="gallery-filter-title">
          <IconTrophy /> My Certifications
          <span className="gallery-count-badge">{certifications.length}</span>
        </h3>
      </div>

      <div className="cert-grid">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="gallery-skeleton-card">
              <div className="gallery-skeleton-img" />
              <div className="gallery-skeleton-info">
                <div className="gallery-skeleton-line" />
                <div className="gallery-skeleton-line short" />
                <div className="gallery-skeleton-line xs" />
              </div>
            </div>
          ))
        ) : certifications.length === 0 ? (
          <div className="gallery-empty-state">
            <div className="gallery-empty-icon"><IconTrophy size={40} /></div>
            <p className="gallery-empty-title">No certifications yet</p>
            <p className="gallery-empty-sub">
              Your child's certificates will appear here
            </p>
          </div>
        ) : (
          certifications.map((cert) => {
            const isPdf = cert.fileUrl.toLowerCase().endsWith(".pdf");
            return (
              <div key={cert._id} className="cert-card">
                <div className="cert-card-thumb">
                  {isPdf ? (
                    <span className="cert-card-thumb-icon"><IconPdf size={22} /></span>
                  ) : (
                    <img src={cert.fileUrl} alt={cert.title} />
                  )}
                </div>
                <div className="cert-card-body">
                  <strong>
                    {cert.title || "Certificate of Achievement"}
                  </strong>
                  <span className="cert-card-issuer">
                    {cert.issuer || "Thevenkyart Art Academy"}
                  </span>
                  <span className="cert-card-date">
                    {new Date(cert.dateIssued).toLocaleDateString()}
                  </span>
                </div>
                <div className="cert-card-actions">
                  <a
                    href={cert.fileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="rc-action-btn pdf"
                  >
                    <IconEye /> View
                  </a>
                  <button
                    className="rc-action-btn"
                    onClick={(e) =>
                      handleDownload(e, cert.fileUrl, cert.title)
                    }
                  >
                    <IconDownload /> Download
                  </button>
                  <button
                    type="button"
                    className="rc-action-btn share"
                    onClick={() => handleShare(cert)}
                    disabled={sharingCert === cert._id}
                  >
                    <IconShare /> {sharingCert === cert._id ? "Preparing…" : "Share"}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [studentProfile, setStudentProfile] = useState(null);
  const [assignedClass, setAssignedClass] = useState(null);
  const [reports, setReports] = useState([]);
  const [attendanceHistory, setAttendanceHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [attendanceMonth, setAttendanceMonth] = useState(
    new Date().toISOString().slice(0, 7),
  );
  const [showAttendanceAnalysis, setShowAttendanceAnalysis] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState("Copy Link");

  // Modal States
  const [showFeeReminder, setShowFeeReminder] = useState(false);
  const [loadError, setLoadError] = useState(false);
  // offline: no connection, or the service worker answered from saved data
  const [offline, setOffline] = useState(() => typeof navigator !== "undefined" && navigator.onLine === false);
  useEffect(() => {
    const goOffline = () => setOffline(true);
    const goOnline = () => setOffline(false);
    const onSw = (e) => { if (e.data?.type === "offline-data") setOffline(true); };
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    if ("serviceWorker" in navigator) navigator.serviceWorker.addEventListener("message", onSw);
    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
      if ("serviceWorker" in navigator) navigator.serviceWorker.removeEventListener("message", onSw);
    };
  }, []);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [showNotifSettings, setShowNotifSettings] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const contentRef = useRef(null);

  // Toast State
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [, setPushEnabled] = useState(
    typeof Notification !== "undefined" && Notification.permission === "granted",
  );

  // Comment States
  const [showEditContact, setShowEditContact] = useState(false);
  const [showProofSheet, setShowProofSheet] = useState(false);
  const [proofMonths, setProofMonths] = useState(null); // months ticked when coming from Pay by UPI
  const family = useFamily(currentUser._id);

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

  // Turn alerts on automatically when a parent opens the dashboard. If already
  // allowed, this just refreshes the saved device subscription; if not yet
  // decided, the browser asks once; if blocked, it does nothing.
  useEffect(() => {
    if (user?._id) subscribeToPush({ silent: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?._id]);

  useEffect(() => {
    document.body.className = theme;
    localStorage.setItem("appTheme", theme);
  }, [theme]);

  useEffect(() => {
    if (!studentProfile) return;
    // First visit: walk the parent through the app (the fee reminder waits
    // until the tutorial is closed).
    let tutorialSeen = true;
    try { tutorialSeen = localStorage.getItem(`parent_tutorial_seen_${currentUser._id}`) === "1"; } catch { /* ignore */ }
    if (!tutorialSeen) {
      setShowTutorial(true);
      return;
    }
    maybeShowFeeReminder();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentProfile]);

  // Fee reminder popup: only while this month is Pending, at most once a day
  const maybeShowFeeReminder = () => {
    if (studentProfile && getPaymentStatus().status === "Pending") {
      const key = `feeReminderShown_${studentProfile._id || currentUser._id}`;
      const today = new Date().toDateString();
      let shownToday = false;
      try { shownToday = localStorage.getItem(key) === today; } catch { /* ignore */ }
      if (!shownToday) {
        setShowFeeReminder(true);
        try { localStorage.setItem(key, today); } catch { /* ignore */ }
      }
    }
  };

  const closeTutorial = () => {
    setShowTutorial(false);
    try { localStorage.setItem(`parent_tutorial_seen_${currentUser._id}`, "1"); } catch { /* ignore */ }
    maybeShowFeeReminder();
  };

  // Each tab opens at the top (like changing screens in an app), with a short fade
  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    el.scrollTop = 0;
    const first = el.querySelector(":scope > :not(.load-error-banner)");
    if (first) {
      first.classList.remove("tab-enter");
      void first.offsetWidth; // restart the animation
      first.classList.add("tab-enter");
    }
  }, [activeTab]);

  // A tapped notification, while the app is already open, switches to its tab
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return undefined;
    const onMessage = (e) => {
      if (e.data?.type === "navigate" && e.data.hash) window.location.hash = e.data.hash;
    };
    navigator.serviceWorker.addEventListener("message", onMessage);
    return () => navigator.serviceWorker.removeEventListener("message", onMessage);
  }, []);

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

  // The three requests run in parallel; whatever loads is shown, and a banner
  // with Retry appears if any of them failed.
  const fetchParentData = async () => {
    setLoading(true);
    setLoadError(false);
    const base = "https://art-portal-7n6r.onrender.com/api";
    const [profileRes, reportRes, attRes] = await Promise.allSettled([
      axios.get(`${base}/student/${currentUser._id}/profile`),
      axios.get(`${base}/feedback/student/${currentUser._id}`),
      axios.get(`${base}/attendance/student/${currentUser._id}`),
    ]);
    if (profileRes.status === "fulfilled") {
      setStudentProfile(profileRes.value.data.student);
      setAssignedClass(profileRes.value.data.classDetails);
    }
    if (reportRes.status === "fulfilled") setReports(reportRes.value.data || []);
    if (attRes.status === "fulfilled") setAttendanceHistory(attRes.value.data || []);
    const failed = [profileRes, reportRes, attRes].filter((r) => r.status === "rejected");
    if (failed.length) {
      failed.forEach((r) => console.error("Error loading parent data:", r.reason));
      setLoadError(true);
    }
    setLoading(false);
  };

  // --- HELPERS ---
  const toggleTheme = () => {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  };

  // "2026-11" -> "November 2026"
  const formatFullMonthDate = (isoStr) => {
    if (!isoStr) return "N/A";
    const [year, month] = isoStr.split("-");
    if (!year || !month) return isoStr;
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return `${date.toLocaleString("en-US", { month: "long" })} ${year}`;
  };
  const formatMonthName = formatFullMonthDate;

  // "12 Nov 2026"
  const formatPaidDate = (d) => {
    if (!d) return "";
    const date = new Date(d);
    return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
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
  const convertScheduleToLocal = (dayName, timeStr, link) => {
    if (!dayName || !timeStr) return { day: dayName, time: timeStr, link };
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
    return { day: localDay, time: localTime, link };
  };

  const getLocalSchedule = () => {
    if (!assignedClass || !assignedClass.schedule) return [];
    return assignedClass.schedule.map((slot) =>
      convertScheduleToLocal(slot.day, slot.time, slot.link),
    );
  };

  // The next class that hasn't finished yet. Slots are stored in IST; a class
  // stays "next" until CLASS_MINUTES after it starts, so Join keeps working
  // while it's live.
  const CLASS_MINUTES = 60;
  const getNextClass = () => {
    const slots = assignedClass?.schedule || [];
    const daysMap = { Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6 };
    const now = Date.now();
    // today's date in IST, as y/m/d
    const ist = new Date(now + 330 * 60000);
    let best = null;
    slots.forEach((slot) => {
      const dow = daysMap[slot.day];
      if (dow === undefined || !slot.time) return;
      const [hh, mm] = String(slot.time).split(":").map(Number);
      if (Number.isNaN(hh)) return;
      for (let add = 0; add <= 7; add++) {
        const d = new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate() + add));
        if (d.getUTCDay() !== dow) continue;
        const start = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), hh, mm || 0) - 330 * 60000;
        if (start + CLASS_MINUTES * 60000 <= now) continue;
        if (!best || start < best.start) best = { start, link: slot.link };
        break;
      }
    });
    if (!best) return null;
    const startDate = new Date(best.start);
    const dayDiff = Math.round((new Date(startDate).setHours(0, 0, 0, 0) - new Date(now).setHours(0, 0, 0, 0)) / 86400000);
    const weekday = startDate.toLocaleDateString([], { weekday: "long" });
    return {
      day: dayDiff === 0 ? "Today" : dayDiff === 1 ? "Tomorrow" : weekday,
      weekday,
      time: startDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true }),
      link: best.link,
      live: best.start <= now,
    };
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
    const missedCount = currentMonthRecords.filter(
      (r) => r.status === "Missed",
    ).length;
    const held = presentCount + absentCount + missedCount;
    const targetClasses = studentProfile?.monthlyClassesTarget || 8;
    // Attendance % is out of the classes actually held so far (same as the
    // analysis panel), not the monthly plan.
    const percentage = held > 0 ? Math.round((presentCount / held) * 100) : 0;
    return {
      present: presentCount,
      absent: absentCount,
      missed: missedCount,
      held,
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

  // Same rules as Admin's Fee Tracker (utils/fees.js): fee changes, one-off
  // overrides, passes and inactive months are all taken into account.
  const getPaymentStatus = () => {
    if (!studentProfile) return { status: "Pending", color: "red" };
    const row = feeRowForMonth(studentProfile, monthKey());
    if (row.status === "Pass") return { status: "Pass", color: "pass" };
    if (row.status === "Paid") return { status: "Paid", color: "green" };
    if (row.status === "Inactive") return { status: "Inactive", color: "inactive" };
    if (row.status === "NotJoined") return { status: "Not started", color: "inactive" };
    return { status: "Pending", color: "red" };
  };

  // Parents see fee history from January 2026 onwards (earlier months are
  // settled offline), even if the student registered before that.
  const PARENT_FEE_START = "2026-01";
  const getFeeList = () => (studentProfile ? buildFeeHistory(studentProfile, monthKey(), { from: PARENT_FEE_START }).rows : []);

  const calculateTotalPending = (list) =>
    list.reduce((sum, item) => (item.status === "Pending" ? sum + (Number(item.amount) || 0) : sum), 0);

  // --- ACTIONS ---

  // ✨ PUSH NOTIFICATION LOGIC
  // silent=true is used for the automatic attempt on login: no alerts, and it
  // never re-asks once the parent has blocked notifications. silent=false is the
  // manual "Enable Alerts" button, which explains what happened.
  const subscribeToPush = async ({ silent = false } = {}) => {
    // 1. Check if browser supports it (iOS only allows push in an installed PWA)
    if (
      !("serviceWorker" in navigator) ||
      !("PushManager" in window) ||
      !("Notification" in window)
    ) {
      if (!silent) {
        alert("Sorry, this browser does not support notifications.");
      }
      return;
    }

    if (Notification.permission === "denied") {
      if (!silent) {
        alert(
          "Notifications are blocked for this site. Please allow them in your browser settings.",
        );
      }
      return;
    }

    try {
      // 2. Ask permission (shows the browser prompt only when not yet decided)
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        if (!silent) {
          alert(
            "Notifications were not allowed. Please allow them in your browser settings.",
          );
        }
        return;
      }

      // 3. Register the Service Worker (sw.js from the 'public' folder)
      const register = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      // 4. Reuse the existing subscription, or create one with the VAPID key
      const publicVapidKey =
        "BC0ajb0fFmrJohj0JlE5fseL4l4BU2gNRP8cPkQXVlAaXw4W6uGAevDqLgrD9Qzy4-W-FQvR-DNf0ccmo0YYkmM";

      const subscription =
        (await register.pushManager.getSubscription()) ||
        (await register.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicVapidKey),
        }));

      // 5. Save it on the backend so the server can push to this device
      await axios.post(
        "https://art-portal-7n6r.onrender.com/api/notifications/subscribe",
        {
          userId: user._id,
          subscription: subscription,
        },
      );

      setPushEnabled(true);
      if (!silent) {
        alert("✅ Notifications are on. Choose which updates you want in Notifications.");
      }
    } catch (err) {
      console.error("Push Error:", err);
      if (!silent) {
        alert(
          "Failed to enable. Please allow notifications in your browser settings.",
        );
      }
    }
  };

  const handleCopyPaymentDetails = () => {
    const details = `*Payment Details for Thevenkyart Art Academy*\nName: Venkatesh Tammisetti\nPhonePe: +91 9963613404\nUPI ID: ${UPI_ID}\nBank: State Bank of India\nAccount No: 35360947257\nIFSC: SBIN0001424`;
    navigator.clipboard.writeText(details.trim());
    setToastMessage("Payment details copied! ✅");
    setShowToast(true);
    setTimeout(() => {
      setShowToast(false);
    }, 3000);
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
    setMobileMenuOpen(false);
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

  if (loading && !studentProfile) {
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

  if (!studentProfile && loadError) {
    return (
      <div className="art-loading-screen">
        <p className="loading-text">We couldn't load your child's details.</p>
        <p className="load-error-sub">Please check your internet connection and try again.</p>
        <button type="button" className="pay-now-btn" onClick={fetchParentData}>Retry</button>
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
    { name: "Missed", value: attStats.missed, color: "#f59e0b" },
    {
      name: "Still to come",
      value: Math.max(0, attStats.target - attStats.held),
      color: theme === "dark" ? "#334155" : "#e2e8f0",
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
      {mobileMenuOpen && (
        <div
          className="mobile-menu-backdrop"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}
      <aside className={`parent-sidebar${mobileMenuOpen ? " mobile-open" : ""}`}>
        <div className="sidebar-header">
          <img src={logoImg} alt="Logo" className="sidebar-logo-img" />
          <img src={titleImg} alt="Title" className="sidebar-title-img" />
          <button
            className="mobile-only sidebar-close-btn"
            onClick={() => setMobileMenuOpen(false)}
            title="Close menu"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
        <div className="p-nav">
          <button
            className={activeTab === "overview" ? "active" : ""}
            onClick={() => handleNavClick("overview")}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path></svg>
            Overview
          </button>
          <button
            className={activeTab === "gallery" ? "active" : ""}
            onClick={() => handleNavClick("gallery")}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
            My Gallery
          </button>
          <button
            className={activeTab === "schedule" ? "active" : ""}
            onClick={() => handleNavClick("schedule")}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
            Class Schedule
          </button>
          <button
            className={activeTab === "reports" ? "active" : ""}
            onClick={() => handleNavClick("reports")}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
            Academic Reports
          </button>
          <button
            className={activeTab === "attendance" ? "active" : ""}
            onClick={() => handleNavClick("attendance")}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
            Attendance Log
          </button>
          <button
            className={activeTab === "certifications" ? "active" : ""}
            onClick={() => handleNavClick("certifications")}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="6"></circle><path d="M9 13.5 7 22l5-3 5 3-2-8.5"></path></svg>
            Certifications
          </button>
          <button
            className={activeTab === "fees" ? "active" : ""}
            onClick={() => handleNavClick("fees")}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a4.5 4.5 0 0 0 0 9H14.5a4.5 4.5 0 0 1 0 9H5"></path></svg>
            Fee Status
          </button>
          <button
            className={activeTab === "refer" ? "active" : ""}
            onClick={() => handleNavClick("refer")}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg>
            Refer & Support
          </button>
          <button
            type="button"
            className="sidebar-alerts-btn"
            onClick={() => { setShowNotifSettings(true); setMobileMenuOpen(false); }}
          >
            <IconBell /> Notifications
          </button>

          <button
            onClick={() => setShowTutorial(true)}
            style={{ marginTop: "10px", color: "#2563eb" }}
          >
            <IconHelp /> App Tutorial
          </button>
        </div>
        <div className="sidebar-footer">
          <p>© 2026 Thevenkyart Art Academy</p>
        </div>
      </aside>

      <main className="parent-main">
        <header className="p-header">
          <div className="p-header-left">
            <button
              className="mobile-only hamburger-btn"
              onClick={() => setMobileMenuOpen(true)}
              title="Open menu"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
            </button>
            <h2>{TAB_TITLES[activeTab] || "My Dashboard"}</h2>
          </div>
          <div className="p-header-right">
            <button
              className="refresh-btn"
              onClick={fetchParentData}
              title="Refresh Data"
              disabled={loading}
            >
              <span className={loading ? "spin" : ""}><IconRefresh /></span>
            </button>
            {/* Parents get posters here (new ones pop up on open); no birthday reminders */}
            <BirthdayNotificationBell
              students={[]}
              storageKey={`parent_notif_read_${currentUser._id}`}
              autoPopup
              holdPopup={loading || showFeeReminder || showTutorial || showNotifSettings || showMore}
            />
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
                {family.length > 1 && (
                  <div className="pd-family">
                    <span>Switch child</span>
                    {family.map((kid) => (
                      <button
                        key={kid._id}
                        type="button"
                        className={`pd-family-btn${kid._id === currentUser._id ? " current" : ""}`}
                        aria-current={kid._id === currentUser._id ? "true" : undefined}
                        onClick={() => kid._id !== currentUser._id && switchToChild(kid)}
                      >
                        <span className="avatar-sm">{(kid.childName || "?").charAt(0)}</span>
                        {kid.childName || kid.username}
                      </button>
                    ))}
                  </div>
                )}
                <div className="pd-refer-box">
                  <span>Your Referral Code</span>
                  <code>{currentUser.username}</code>
                </div>
                <button
                  className="pd-menu-btn theme-toggle"
                  onClick={toggleTheme}
                >
                  {theme === "light" ? <><IconMoon /> Dark Mode</> : <><IconSun /> Light Mode</>}
                </button>
                <button
                  className="pd-menu-btn"
                  onClick={() => setShowTutorial(true)}
                >
                  <IconHelp /> App Tutorial
                </button>
                <button
                  className="pd-menu-btn"
                  onClick={() => handleNavClick("refer")}
                >
                  <IconAnnounce /> Refer & Support
                </button>
                <button
                  className="pd-menu-btn"
                  onClick={() => {
                    setShowNotifSettings(true);
                    setShowProfileMenu(false);
                  }}
                >
                  <IconBell /> Notifications
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

        <div className="p-content" ref={contentRef}>
          {offline && (
            <div className="offline-banner" role="status">
              <span>You're offline — showing the details saved on this phone.</span>
              <button type="button" onClick={() => { setOffline(navigator.onLine === false); fetchParentData(); }}>Try again</button>
            </div>
          )}
          {loadError && !offline && (
            <div className="load-error-banner" role="alert">
              <span>Some details couldn't load. What you see may be out of date.</span>
              <button type="button" onClick={fetchParentData} disabled={loading}>{loading ? "Loading…" : "Retry"}</button>
            </div>
          )}
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
                      {(currentUser.fullName || "").trim().split(/\s+/)[0] || "Parent"}
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
              <WhatsNewCard
                userId={currentUser._id}
                childName={studentProfile?.childName || currentUser.childName}
                reports={reports}
                onOpen={(item) => {
                  if (item.kind === "poster") window.dispatchEvent(new CustomEvent("open-spotlight", { detail: item.poster._id }));
                  else handleNavClick(item.tab);
                }}
              />
              <ClassNotesCard studentId={currentUser._id} compact onSeeAll={() => handleNavClick("schedule")} />
              <div className="info-card attendance-card">
                <h3
                  onClick={() => handleNavClick("attendance")}
                  className="clickable-heading"
                >
                  <IconCalendar /> Attendance
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
                      {attStats.held > 0 ? `${attStats.percentage}%` : "—"}
                    </span>
                  </div>
                </div>
                <div className="att-details-text">
                  <div className="ad-row">
                    <span>Attended:</span>
                    <strong className="green">
                      {attStats.present} {attStats.present === 1 ? "Class" : "Classes"}
                    </strong>
                  </div>
                  <div className="ad-row">
                    <span>Absent:</span>
                    <strong className="red">{attStats.absent} {attStats.absent === 1 ? "Class" : "Classes"}</strong>
                  </div>
                  {attStats.missed > 0 && (
                    <div className="ad-row">
                      <span>Missed:</span>
                      <strong className="amber">{attStats.missed} {attStats.missed === 1 ? "Class" : "Classes"}</strong>
                    </div>
                  )}
                  {attendanceStreak(attendanceHistory) >= 2 && (
                    <div className="ad-row">
                      <span>In a row:</span>
                      <strong className="green">{attendanceStreak(attendanceHistory)} classes</strong>
                    </div>
                  )}
                  <div className="ad-row">
                    <span>Classes held:</span>
                    <strong>{attStats.held} of {attStats.target} planned</strong>
                  </div>
                </div>
              </div>
              <div className="info-card report-preview-card">
                <h3
                  onClick={() => handleNavClick("reports")}
                  className="clickable-heading"
                >
                  <IconNote /> Latest Report
                </h3>
                {reports.length > 0 ? (
                  <div className="latest-report-box">
                    <div className="lrb-header">
                      <span className="lrb-month">
                        {formatFullMonthDate(reports[0].month)} Report
                      </span>
                      <span className="lrb-rating">
                        {Array.from({ length: reports[0].rating }, (_, i) => <IconStar key={i} fill="currentColor" />)}
                      </span>
                    </div>
                    <p className="lrb-text">
                      "{(() => { const t = String(reports[0].feedbackText || "").trim(); return t.length > 90 ? `${t.slice(0, 87).trimEnd()}…` : t; })()}"
                    </p>
                    {reports[0].reportFile ? (
                      <a
                        href={reports[0].reportFile}
                        target="_blank"
                        rel="noreferrer"
                        className="mini-link-btn"
                      >
                        <IconPdf /> View PDF
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
                  <IconLaunch /> Next Class (Local Time)
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
                        {nextClass ? `${nextClass.day} @ ${nextClass.time}${nextClass.live ? " · Live now" : ""}` : "Timetable coming soon"}
                      </span>
                    </div>
                    {(() => {
                      const nextLink = nextClass?.link || assignedClass?.meetingLink || null;
                      return nextLink ? (
                        <a
                          href={nextLink}
                          target="_blank"
                          rel="noreferrer"
                          className="join-btn"
                        >
                          {nextClass?.live ? "Join Class Now" : nextClass ? `Join ${nextClass.day}'s Class` : "Join Class"}
                        </a>
                      ) : (
                        <button className="join-btn disabled" disabled>
                          No Link Yet
                        </button>
                      );
                    })()}
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
                  <IconFee /> Fee Status
                </h3>
                <div className={`fee-status-badge ${getPaymentStatus().color}`}>
                  {getPaymentStatus().status}
                </div>
                <p className="fee-note">
                  {(() => {
                    const st = getPaymentStatus().status;
                    if (totalPendingAmount > 0 && st !== "Pending") return `Earlier months due: ₹${totalPendingAmount}`;
                    if (st === "Paid") return "All caught up!";
                    if (st === "Pass") return "No fee this month (Pass).";
                    if (st === "Inactive" || st === "Not started") return "No fee this month.";
                    return totalPendingAmount > 0 ? `Total due: ₹${totalPendingAmount}` : "Please clear dues.";
                  })()}
                </p>
              </div>
              <div className="info-card profile-card">
                <div className="ps-card-title">
                  <h3><IconUser /> Student Details</h3>
                  <button type="button" className="ps-link" onClick={() => setShowEditContact(true)}>Edit contact</button>
                </div>
                <div className="detail-row">
                  <span className="lbl">Student ID:</span>
                  <span className="val">{currentUser.username}</span>
                </div>
                <div className="detail-row">
                  <span className="lbl">Date of Birth:</span>
                  <span className="val">
                    {studentProfile?.childDob
                      ? new Date(
                          studentProfile.childDob.includes("T")
                            ? studentProfile.childDob
                            : studentProfile.childDob + "T00:00:00",
                        ).toLocaleDateString("en-GB", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                        })
                      : "N/A"}
                  </span>
                </div>
                <div className="detail-row">
                  <span className="lbl">Parent Phone:</span>
                  <span className="val">
                    {studentProfile?.phone || currentUser.phone}
                  </span>
                </div>
                {(studentProfile?.email || studentProfile?.parentEmail) && (
                  <div className="detail-row">
                    <span className="lbl">Email:</span>
                    <span className="val">{studentProfile.email || studentProfile.parentEmail}</span>
                  </div>
                )}
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
                <div className="detail-row">
                  <span className="lbl">Class Mode:</span>
                  <span className="val">
                    <span className={`mode-badge ${studentProfile?.classMode || "online"}`}>
                      {studentProfile?.classMode === "offline" ? <><IconOfflineClass /> Offline</> : <><IconOnlineClass /> Online</>}
                    </span>
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
                    {localSchedule.map((slot, idx) => {
                      const slotLink = slot.link || assignedClass?.meetingLink || null;
                      return (
                        <div key={idx} className="slot-item">
                          <span className="slot-day">{slot.day}</span>
                          <span className="slot-time">{slot.time}</span>
                          {slotLink ? (
                            <a
                              href={slotLink}
                              target="_blank"
                              rel="noreferrer"
                              className="join-btn"
                              style={{ fontSize: "0.8rem", padding: "4px 12px" }}
                            >
                              Join
                            </a>
                          ) : (
                            <button
                              className="join-btn disabled"
                              disabled
                              style={{ fontSize: "0.8rem", padding: "4px 12px" }}
                            >
                              No Link
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="empty-state">
                  No class assigned. Please contact admin.
                </div>
              )}
              {assignedClass?.schedule?.length > 0 && (
                <>
                  <div className="ps-cal-row">
                    <button
                      type="button"
                      className="ps-btn-ghost"
                      onClick={() => { if (!downloadCalendar(assignedClass)) alert("No upcoming classes to add yet."); }}
                    >
                      <IconSchedule /> Add classes to my calendar
                    </button>
                    <span className="ps-muted">Weekly reminders on your phone, 15 minutes before class</span>
                  </div>
                  <ClassNotesCard studentId={currentUser._id} />
                  <AbsencePanel
                    studentId={currentUser._id}
                    schedule={assignedClass.schedule}
                    notices={studentProfile?.absenceNotices}
                    childName={studentProfile?.childName || currentUser.childName}
                    onChange={(absenceNotices) => setStudentProfile((p) => ({ ...p, absenceNotices }))}
                  />
                </>
              )}
            </div>
          )}

          {activeTab === "reports" && (
            <div className="reports-view">
              <div className="att-header-row">
                <h3>Academic Reports</h3>
                <div className="month-nav-mini">
                  <button type="button" aria-label="Previous quarter" onClick={() => changeReportQuarter(-1)}>‹</button>
                  <span>
                    Q{reportQuarter} {reportYear}
                  </span>
                  <button type="button" aria-label="Next quarter" onClick={() => changeReportQuarter(1)}>›</button>
                </div>
              </div>
              <ListCountHeader
                label={`Reports · Q${reportQuarter} ${reportYear}`}
                count={filteredReports.length}
                total={reports.length}
                style={{ padding: "0 0 12px" }}
              />
              <RatingTrend reports={reports} dark={theme === "dark"} />
              {filteredReports.length === 0 ? (
                <div className="empty-state">
                  No reports for Quarter {reportQuarter}, {reportYear}.
                  {reports.some((r) => r.month) && (() => {
                    const latest = [...reports].filter((r) => r.month).sort((a, b) => b.month.localeCompare(a.month))[0];
                    const [ly, lm] = latest.month.split("-").map(Number);
                    return (
                      <div style={{ marginTop: 12 }}>
                        <button type="button" className="cia-btn send" onClick={() => { setReportYear(ly); setReportQuarter(Math.ceil(lm / 3)); }}>
                          Show latest ({formatFullMonthDate(latest.month)})
                        </button>
                      </div>
                    );
                  })()}
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
                          {Array.from({ length: rep.rating }, (_, i) => <IconStar key={i} fill="currentColor" />)}
                        </div>
                      </div>
                      <div className="rc-body">
                        <p>"{rep.feedbackText}"</p>
                      </div>

                      <ReportThread
                        report={rep}
                        parentId={currentUser._id}
                        onUpdated={(next) => setReports((list) => list.map((r) => (r._id === next._id ? next : r)))}
                      />
                      <div className="rc-footer">
                        <span className="rc-teacher">
                          By: {rep.teacherId?.fullName || "Thevenkyart Art Academy"}
                        </span>
                        <div className="rc-footer-actions">
                          {rep.reportFile && (
                            <a
                              href={rep.reportFile}
                              target="_blank"
                              rel="noreferrer"
                              className="rc-action-btn pdf"
                            >
                              <IconPdf /> View PDF
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
                <h3>{showAttendanceAnalysis ? "Attendance Analysis" : "Monthly Log"}</h3>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", justifyContent: "flex-end" }}>
                  {!showAttendanceAnalysis && (
                    <div className="month-nav-mini">
                      <button type="button" aria-label="Previous month" onClick={() => changeAttendanceMonth(-1)}>‹</button>
                      <span>{formatMonthName(attendanceMonth)}</span>
                      <button type="button" aria-label="Next month" onClick={() => changeAttendanceMonth(1)}>›</button>
                    </div>
                  )}
                  <button
                    type="button"
                    className="att-analysis-toggle-btn"
                    onClick={() => setShowAttendanceAnalysis((v) => !v)}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      background: showAttendanceAnalysis ? "var(--p-button-bg, #f1f5f9)" : "#0f766e",
                      color: showAttendanceAnalysis ? "var(--p-text, #0f766e)" : "#fff",
                      border: showAttendanceAnalysis ? "1px solid var(--p-border, #e2e8f0)" : "none",
                      padding: "8px 14px",
                      borderRadius: "8px",
                      fontWeight: 700,
                      fontSize: "0.85rem",
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                    }}
                  >
                    <IconTrendingUp /> {showAttendanceAnalysis ? "Monthly Log" : "View Analysis"}
                  </button>
                </div>
              </div>

              {showAttendanceAnalysis ? (
                <AttendanceAnalysisPanel
                  records={attendanceHistory}
                  loading={loading}
                  error={false}
                  emptyLabel="No attendance records yet."
                  dark={theme === "dark"}
                />
              ) : (
                <>
                  <div className="att-summary-bar">
                    <div className="as-item">
                      <span className="as-label">Attended</span>
                      <span className="as-val green">{attStats.present}</span>
                    </div>
                    <div className="as-item">
                      <span className="as-label">Absent</span>
                      <span className="as-val red">{attStats.absent}</span>
                    </div>
                    {attStats.missed > 0 && (
                      <div className="as-item">
                        <span className="as-label">Missed</span>
                        <span className="as-val amber">{attStats.missed}</span>
                      </div>
                    )}
                    <div className="as-item">
                      <span className="as-label">In a row</span>
                      <span className="as-val">{attendanceStreak(attendanceHistory)}<small> best {bestStreak(attendanceHistory)}</small></span>
                    </div>
                    <div className="as-item">
                      <span className="as-label">Classes held</span>
                      <span className="as-val">{attStats.held}<small> / {attStats.target}</small></span>
                    </div>
                  </div>
                  <AttendanceCalendar month={attendanceMonth} records={attendanceHistory} />
                  <div className="att-table-wrapper">
                    {attStats.records.length === 0 ? (
                      <div className="empty-state">
                        No attendance records for {formatMonthName(attendanceMonth)}.
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
                </>
              )}
            </div>
          )}

          {activeTab === "fees" && (
            <div className="fees-view">
              <UpiPayCard
                pendingRows={feeList.filter((r) => r.status === "Pending").reverse()}
                childName={studentProfile?.childName || currentUser.childName}
                onShowQr={() => setShowPaymentModal(true)}
                onPaid={(months) => { setProofMonths(months); setShowProofSheet(true); }}
              />
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
                    QR &amp; bank details
                  </button>
                  <button type="button" className="ps-btn-ghost" onClick={() => { setProofMonths(null); setShowProofSheet(true); }}>
                    Send payment proof
                  </button>
                </div>
              </div>
              {(() => {
                const paidMonths = new Set(feeList.filter((r) => r.status === "Paid").map((r) => r.month));
                const proofs = studentProfile?.paymentProofs || [];
                const unpaid = (pp) => (pp.months || []).some((m) => !paidMonths.has(m));
                const waiting = proofs.filter((pp) => (pp.status || "pending") === "pending" && unpaid(pp));
                // latest rejected proof, unless the parent has since sent a newer one
                const rejected = [...proofs].reverse().find((pp) => pp.status === "rejected" && unpaid(pp));
                const rejectedStillOpen = rejected && !waiting.some((w) => new Date(w.at) > new Date(rejected.at));
                return (
                  <>
                    {rejectedStillOpen && (
                      <div className="ps-proof-note rejected" role="alert">
                        <strong>Payment proof not accepted</strong> for {(rejected.months || []).map(formatFullMonthDate).join(", ")}
                        {rejected.reviewNote ? `: ${rejected.reviewNote}` : "."} Please send it again or contact the academy.
                      </div>
                    )}
                    {waiting.length > 0 && (
                      <div className="ps-proof-note" role="status">
                        <strong>Proof sent</strong> for {waiting.flatMap((pp) => pp.months).filter((m, i, a) => a.indexOf(m) === i).map(formatFullMonthDate).join(", ")} — the academy will mark it as paid after checking.
                      </div>
                    )}
                  </>
                );
              })()}
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
                    {feeList.map((pay) => (
                      <tr key={pay.month}>
                        <td>{formatFullMonthDate(pay.month)}</td>
                        <td className={pay.status === "Pass" || pay.status === "Inactive" ? "fee-amt-muted" : undefined}>
                          ₹{Number(pay.amount) || 0}
                        </td>
                        <td>
                          <span className={`fee-pill ${pay.status.toLowerCase()}`}>
                            {pay.status}
                          </span>
                          {pay.status === "Paid" && formatPaidDate(pay.paidDate) && (
                            <div className="fee-sub">Paid on {formatPaidDate(pay.paidDate)}</div>
                          )}
                          {pay.status === "Paid" && (
                            <button
                              type="button"
                              className="ps-link"
                              onClick={() => downloadReceipt({ row: pay, profile: { ...studentProfile, username: currentUser.username }, logoSrc: "/new-logo1.png" })}
                            >
                              Receipt
                            </button>
                          )}
                          {pay.status === "Inactive" && <div className="fee-sub">No fee while on a break</div>}
                          {pay.status === "Pass" && pay.reason && <div className="fee-sub">{pay.reason}</div>}
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
                        <IconGlobe />{" "}
                        <a
                          href="https://thevenkyart.com"
                          target="_blank"
                          rel="noreferrer"
                        >
                          thevenkyart.com
                        </a>
                      </div>
                      <div className="id-row">
                        <IconMail /> <a href="mailto:thevenkyart@gmail.com">thevenkyart@gmail.com</a>
                      </div>
                      <div className="id-row">
                        <IconPhone /> <a href="tel:+919963613404">+91 9963613404</a>
                      </div>
                      <div className="id-row">
                        <IconLocation /> <span>Hyderabad, Telangana</span>
                      </div>
                    </div>
                    <div className="inst-desc">
                      We provide professional art training in Drawing,
                      Sketching, and Painting for students of all ages.
                    </div>
                    <div className="ps-contact-btns">
                      <a className="ps-btn-ghost" href="tel:+919963613404"><IconPhone /> Call</a>
                      <a
                        className="ps-btn-wa"
                        href={`https://wa.me/919963613404?text=${encodeURIComponent(`Hello, this is ${currentUser.fullName || "a parent"} (${studentProfile?.childName || currentUser.childName || currentUser.username}). `)}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <IconMessage /> WhatsApp
                      </a>
                    </div>
                  </div>
                </div>
                <div className="referral-card action-card">
                  <h3>Spread the Word!</h3>
                  <p className="action-desc">
                    Love our classes? Refer a friend or family member and let
                    them experience the joy of art.
                  </p>
                  <ReferralStats studentId={currentUser._id} />
                  <div className="referral-code-box">
                    <span className="rc-label">Your Referral Code</span>
                    <div className="code-display">{currentUser.username}</div>
                  </div>
                  <div className="share-buttons">
                    <button
                      className="share-btn whatsapp"
                      onClick={() => handleShare("whatsapp")}
                    >
                      <IconMessage /> Share via WhatsApp
                    </button>
                    <button
                      className="share-btn copy"
                      onClick={() => handleShare("copy")}
                    >
                      <IconClipboard /> {copyFeedback}
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

          {activeTab === "certifications" && (
            <ParentCertificationsTab studentId={currentUser._id} />
          )}
        </div>
      </main>

      <nav className="mobile-bottom-nav" aria-label="Main">
        {[
          { key: "overview", label: "Home", icon: <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /> },
          { key: "schedule", label: "Schedule", icon: <><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></> },
          { key: "gallery", label: "Gallery", icon: <><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></> },
          { key: "fees", label: "Fees", icon: <><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a4.5 4.5 0 0 0 0 9H14.5a4.5 4.5 0 0 1 0 9H5" /></> },
        ].map(({ key, label, icon }) => (
          <button
            key={key}
            type="button"
            className={activeTab === key ? "nav-item active" : "nav-item"}
            aria-current={activeTab === key ? "page" : undefined}
            onClick={() => handleNavClick(key)}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">{icon}</svg>
            <span className="nav-label">{label}</span>
          </button>
        ))}
        <button
          type="button"
          className={MORE_TABS.includes(activeTab) || showMore ? "nav-item active" : "nav-item"}
          aria-haspopup="dialog"
          onClick={() => setShowMore(true)}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="19" cy="12" r="1.5" /></svg>
          <span className="nav-label">More</span>
        </button>
      </nav>

      {showMore && (
        <MoreSheet
          dark={theme === "dark"}
          active={activeTab}
          onClose={() => setShowMore(false)}
          onPick={(key) => {
            setShowMore(false);
            if (key === "notifications") setShowNotifSettings(true);
            else if (key === "tutorial") setShowTutorial(true);
            else if (key === "theme") toggleTheme();
            else handleNavClick(key);
          }}
          items={[
            { key: "reports", label: "Progress Reports", hint: "Teacher feedback and report cards", icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg> },
            { key: "attendance", label: "Attendance", hint: "Every class, month by month", icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg> },
            { key: "certifications", label: "Certificates", hint: "View and download", icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="6" /><path d="M9 13.5 7 22l5-3 5 3-2-8.5" /></svg> },
            { key: "refer", label: "Refer & Support", hint: "Invite friends, contact the academy", icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" /></svg> },
            { key: "notifications", label: "Notifications", hint: "Choose which updates you get", icon: <IconBell /> },
            { key: "theme", label: theme === "light" ? "Dark mode" : "Light mode", icon: theme === "light" ? <IconMoon /> : <IconSun /> },
            { key: "tutorial", label: "App tutorial", icon: <IconHelp /> },
          ]}
        />
      )}

      {showNotifSettings && (
        <NotificationSettings
          userId={currentUser._id}
          initialPrefs={studentProfile?.notifyPrefs}
          dark={theme === "dark"}
          onClose={() => setShowNotifSettings(false)}
          onEnableDevice={() => subscribeToPush()}
          onSaved={(notifyPrefs) => notifyPrefs && setStudentProfile((p) => (p ? { ...p, notifyPrefs } : p))}
        />
      )}

      {/* ✨ TUTORIAL MODAL COMPONENT */}
      {showTutorial && <TutorialModal onClose={closeTutorial} />}

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
            <h3 className="lm-title">Fee reminder</h3>
            <p className="lm-text">
              Hello! {studentProfile?.childName || currentUser.childName ? `${studentProfile?.childName || currentUser.childName}'s` : "This month's"} fee for {formatFullMonthDate(monthKey())} is pending
              {totalPendingAmount > 0 ? ` (total due ₹${totalPendingAmount})` : ""}. Please clear it to continue uninterrupted classes.
            </p>
            <div className="lm-actions">
              <button className="lm-btn cancel" onClick={closeFeeReminder}>
                Close
              </button>
              <button className="lm-btn confirm" onClick={goToFees}>
                View &amp; Pay
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
                  <span className="ds-val">{UPI_ID}</span>
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
              <p>After paying, send the screenshot with <strong>Send payment proof</strong> on the Fees page.</p>
              <button
                className="copy-details-btn"
                onClick={handleCopyPaymentDetails}
              >
                <IconClipboard /> Copy Details to Share
              </button>
            </div>
          </div>
        </div>
      )}

      {showProofSheet && (
        <PaymentProofSheet
          studentId={currentUser._id}
          pendingRows={feeList.filter((r) => r.status === "Pending").reverse()}
          initialMonths={proofMonths}
          initialNote={proofMonths ? "Paid by UPI" : ""}
          onClose={() => setShowProofSheet(false)}
          onSent={(paymentProofs) => {
            setStudentProfile((p) => ({ ...p, paymentProofs }));
            setToastMessage("Payment proof sent to the academy");
            setShowToast(true);
            setTimeout(() => setShowToast(false), 3000);
          }}
        />
      )}
      {showEditContact && (
        <EditContactSheet
          studentId={currentUser._id}
          profile={studentProfile}
          onClose={() => setShowEditContact(false)}
          onSaved={(c) => setStudentProfile((p) => ({ ...p, ...c }))}
        />
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
