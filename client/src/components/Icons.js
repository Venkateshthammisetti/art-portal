// Shared icon set for the Admin / Teacher / Parent dashboards.
//
// WHY THIS EXISTS
// Emoji were previously used as UI icons throughout the three dashboards.
// Emoji render as completely different artwork on Windows / Android / iOS,
// can't be recoloured to follow the light/dark theme, sit on the text
// baseline instead of aligning to a box, and are read out literally by
// screen readers ("fire engine", "clipboard"). They were replaced with a
// single consistent icon set.
//
// WHY react-icons/fi
// react-icons (v5) is already a dependency of this project, and its Feather
// set ("fi") is stroke-based 24x24 with a 2px stroke and round caps — the
// exact house style of the hand-written sidebar nav SVGs this codebase
// already had. Using it keeps every icon visually consistent with the nav
// without hand-drawing ~60 SVG paths.
//
// This file is a SEMANTIC layer: the app imports meaning ("IconOnlineClass")
// rather than a vendor name ("FiGlobe"). Swapping the underlying icon later
// is a one-line change here instead of a find-and-replace across 13k lines.
//
// SIZING CONVENTION (pass `size`, defaults to 1em so it follows font-size)
//   14-16  inline in buttons, badges, table rows, list items
//   20-22  stat cards, section headings
//   24     sidebar navigation
//
// COLOUR
// Every icon inherits `currentColor`, so it automatically matches the colour
// of the text beside it — which is what makes dark mode work with no extra
// per-icon CSS.
//
// ACCESSIBILITY
// These icons are decorative: each one sits next to a real text label, so
// they are hidden from the accessibility tree (aria-hidden) to avoid
// double-announcing. If an icon is ever the ENTIRE content of a control,
// put an aria-label on that control (the button), not on the icon.

import React from "react";
import "./Icons.css";
import {
  // status / feedback
  FiCheck,
  FiCheckCircle,
  FiX,
  FiXCircle,
  FiAlertTriangle,
  FiSlash,
  FiInfo,
  FiHelpCircle,
  // class mode / place
  FiGlobe,
  FiMapPin,
  FiMonitor,
  FiHome,
  // people
  FiUser,
  FiUsers,
  FiBriefcase,
  FiSmile,
  // time
  FiCalendar,
  FiClock,
  FiPause,
  // money
  FiCreditCard,
  FiDollarSign,
  FiTrendingUp,
  FiBarChart2,
  FiPieChart,
  // documents
  FiFile,
  FiFileText,
  FiClipboard,
  FiBook,
  FiBookOpen,
  FiPaperclip,
  FiPackage,
  FiEdit,
  FiEdit3,
  // media / awards
  FiImage,
  FiStar,
  FiAward,
  FiGift,
  // actions
  FiDownload,
  FiUpload,
  FiShare2,
  FiTrash2,
  FiPlus,
  FiRefreshCw,
  FiSave,
  FiSearch,
  FiEye,
  FiEyeOff,
  FiLogOut,
  FiSettings,
  FiTool,
  FiLock,
  FiZap,
  // communication
  FiBell,
  FiMessageSquare,
  FiMail,
  FiInbox,
  FiVolume2,
  FiPhone,
  // theme
  FiSun,
  FiMoon,
} from "react-icons/fi";
import { FaWhatsapp } from "react-icons/fa";

// Wrap every icon so it is decorative by default and inherits font size.
// `size` / `className` / `style` still pass straight through to react-icons.
const icon = (Cmp) => {
  const Wrapped = ({ size = "1em", className = "", ...rest }) => (
    <Cmp
      size={size}
      className={`ui-icon${className ? " " + className : ""}`}
      aria-hidden="true"
      focusable="false"
      {...rest}
    />
  );
  Wrapped.displayName = `Icon(${Cmp.displayName || Cmp.name || "svg"})`;
  return Wrapped;
};

/* ---------- status / feedback ---------- */
export const IconCheck = icon(FiCheck);
export const IconSuccess = icon(FiCheckCircle);
export const IconX = icon(FiX);
export const IconError = icon(FiXCircle);
export const IconWarning = icon(FiAlertTriangle);
export const IconBlocked = icon(FiSlash);
export const IconInfo = icon(FiInfo);
export const IconHelp = icon(FiHelpCircle);

/* ---------- class mode ----------
   Online = globe (anywhere), Offline = map pin (a physical place). */
export const IconOnlineClass = icon(FiGlobe);
export const IconOfflineClass = icon(FiMapPin);
export const IconGlobe = icon(FiGlobe);
export const IconDevice = icon(FiMonitor);
export const IconHome = icon(FiHome);

/* ---------- people ---------- */
export const IconUser = icon(FiUser);
export const IconUsers = icon(FiUsers);
export const IconStudent = icon(FiUser);
export const IconTeacher = icon(FiBriefcase);
export const IconBriefcase = icon(FiBriefcase);
export const IconGreeting = icon(FiSmile);

/* ---------- time / schedule ---------- */
export const IconCalendar = icon(FiCalendar);
export const IconSchedule = icon(FiCalendar);
export const IconClock = icon(FiClock);
export const IconInactive = icon(FiPause);

/* ---------- money ---------- */
export const IconFee = icon(FiCreditCard);
export const IconMoney = icon(FiDollarSign);
export const IconExpense = icon(FiDollarSign);
export const IconTrendingUp = icon(FiTrendingUp);
export const IconChart = icon(FiBarChart2);
export const IconPieChart = icon(FiPieChart);

/* ---------- documents ---------- */
export const IconFile = icon(FiFile);
export const IconPdf = icon(FiFileText);
export const IconReport = icon(FiFileText);
export const IconReceipt = icon(FiFileText);
export const IconClipboard = icon(FiClipboard);
export const IconBook = icon(FiBook);
export const IconClasses = icon(FiBookOpen);
export const IconAttach = icon(FiPaperclip);
export const IconPackage = icon(FiPackage);
export const IconEdit = icon(FiEdit);
export const IconNote = icon(FiEdit3);

/* ---------- media / awards ---------- */
export const IconArt = icon(FiImage);
export const IconGallery = icon(FiImage);
export const IconImage = icon(FiImage);
export const IconStar = icon(FiStar);
export const IconTrophy = icon(FiAward);
export const IconCertificate = icon(FiAward);
export const IconCelebrate = icon(FiGift);
export const IconBirthday = icon(FiGift);

/* ---------- actions ---------- */
export const IconDownload = icon(FiDownload);
export const IconUpload = icon(FiUpload);
export const IconShare = icon(FiShare2);
export const IconTrash = icon(FiTrash2);
export const IconPlus = icon(FiPlus);
export const IconRefresh = icon(FiRefreshCw);
export const IconSave = icon(FiSave);
export const IconSearch = icon(FiSearch);
export const IconEye = icon(FiEye);
export const IconEyeOff = icon(FiEyeOff);
export const IconLogout = icon(FiLogOut);
export const IconSettings = icon(FiSettings);
export const IconTool = icon(FiTool);
export const IconLock = icon(FiLock);
export const IconLaunch = icon(FiZap);
export const IconUtilities = icon(FiZap);

/* ---------- communication ---------- */
export const IconBell = icon(FiBell);
export const IconMessage = icon(FiMessageSquare);
export const IconMail = icon(FiMail);
export const IconInbox = icon(FiInbox);
export const IconAnnounce = icon(FiVolume2);
export const IconPhone = icon(FiPhone);
export const IconLocation = icon(FiMapPin);

/* ---------- theme ---------- */
export const IconSun = icon(FiSun);
export const IconMoon = icon(FiMoon);

/* ---------- brand (deliberate exception to the Feather set) ---------- */
export const IconWhatsApp = icon(FaWhatsapp);
