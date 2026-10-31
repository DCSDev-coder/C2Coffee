import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronDown,
  Bell,
  MessageSquare,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
} from "lucide-react";
import Pagination from "./Pagination";
import PaymentServiceNotices from "./PaymentServiceNotices";
import InfoTooltip from "./InfoTooltip";
import { showAdminError, showAdminSuccess } from "../lib/adminToast";
import { requestAdminConfirm } from "../lib/adminDialog";
import {
  createAdminMarketingBanner,
  deleteAdminMarketingBanner,
  getAdminApiBaseUrl,
  formatRetryCountdown,
  loadAdminMarketingBanners,
  loadAdminMenu,
  loadAdminVouchers,
  notifyAdminMarketingBanner,
  sendAdminCustomerMessage,
  updateAdminMarketingBanner,
  reorderAdminMarketingBannerSurface,
  uploadAdminMarketingPoster,
} from "../lib/adminApi";

const ITEMS_PER_PAGE = 8;

const DEFAULT_FORM = {
  title: "",
  subtitle: "",
  imageSource: "",
  mediaType: "image",
  animationDurationMs: 0,
  bannerType: "general",
  partnerName: "",
  sponsoredLabel: true,
  ctaLabel: "",
  actionType: "none",
  actionValue: "",
  destinationType: "menu",
  targetValue: "",
  startsAt: "",
  endsAt: "",
  placement: "both",
  floatingPriority: false,
  isActive: true,
};

const bannerTypeOptions = [
  { value: "general", label: "General poster" },
  { value: "voucher", label: "Voucher poster" },
  { value: "event", label: "Event poster" },
  { value: "new_item", label: "New item poster" },
  { value: "partner", label: "Partnership" },
  { value: "social", label: "Social / entertainment poster" },
];

function bannerTypeLabel(value) {
  return bannerTypeOptions.find((option) => option.value === value)?.label || value || "";
}

const destinationLabelMap = {
  reward_section: "Reward section",
  menu: "Menu",
  calendar: "Calendar",
};

const partnerActionOptions = [
  { value: "external_url", label: "Open HTTPS website" },
  { value: "email", label: "Open email inquiry" },
];

const statusClassMap = {
  Active: "bg-[#D1FADF] text-[#039855]",
  Live: "bg-[#D1FADF] text-[#039855]",
  Scheduled: "bg-[#FEF0C7] text-[#B54708]",
  Ended: "bg-[#FEE4E2] text-[#D92D20]",
  Inactive: "bg-[#E5E7EB] text-[#4B5563]",
};

function resolveImageUrl(imageSource) {
  const value = String(imageSource ?? "").trim();
  if (!value) {
    return "/c2_logo.png";
  }

  if (
    /^data:/i.test(value) ||
    /^blob:/i.test(value) ||
    /^https?:\/\//i.test(value)
  ) {
    return value;
  }

  const normalized = value.startsWith("/") ? value : `/${value}`;
  return `${getAdminApiBaseUrl()}${normalized}`;
}

function toDateTimeLocalValue(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const pad = (input) => String(input).padStart(2, "0");
  return (
    [date.getFullYear(), pad(date.getMonth() + 1), pad(date.getDate())].join(
      "-",
    ) + `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

function toIsoOrNull(value) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function flattenMenuItems(menuResponse) {
  const categories = Array.isArray(menuResponse?.categories)
    ? menuResponse.categories
    : [];
  return categories.flatMap((category) => {
    const items = Array.isArray(category.items) ? category.items : [];
    return items.map((item) => ({
      code: item.code,
      name: item.name,
      categoryName: category.name,
      isActive: item.is_active ?? item.isAvailable ?? true,
    }));
  });
}

function makeEmptyForm() {
  return { ...DEFAULT_FORM };
}

function bannerStatusLabel(banner) {
  if (!banner.isActive) {
    return "Inactive";
  }

  if (!banner.startsAt && !banner.endsAt) {
    return "Active";
  }

  const now = Date.now();
  const startsAt = banner.startsAt
    ? new Date(banner.startsAt).getTime()
    : Number.NaN;
  const endsAt = banner.endsAt ? new Date(banner.endsAt).getTime() : Number.NaN;

  if (!Number.isNaN(startsAt) && now < startsAt) {
    return "Scheduled";
  }
  if (!Number.isNaN(endsAt) && now > endsAt) {
    return "Ended";
  }
  return "Live";
}

function routeLabel(banner) {
  if (banner.bannerType === "event") {
    return "Calendar before start · Menu during event";
  }
  if (banner.bannerType === "voucher") {
    return banner.destinationType === "reward_section"
      ? "Reward section"
      : "Menu";
  }
  if (banner.bannerType === "new_item") {
    return "Menu · specific item";
  }
  if (banner.bannerType === "partner") {
    return (
      partnerActionOptions.find((option) => option.value === banner.actionType)
        ?.label || "Display only"
    );
  }
  if (banner.bannerType === "social") {
    return "Open social / entertainment link";
  }
  return destinationLabelMap[banner.destinationType] || "Menu";
}

const Marketing = () => {
  const customerMessageRequestKey = useRef(null);
  const [banners, setBanners] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [voucherTemplates, setVoucherTemplates] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedType, setSelectedType] = useState("");
  const [selectedPlacement, setSelectedPlacement] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notifyingBannerId, setNotifyingBannerId] = useState(null);
  const [reorderingBannerId, setReorderingBannerId] = useState(null);
  const [arrangeSurface, setArrangeSurface] = useState(null);
  const [sendingCustomerMessage, setSendingCustomerMessage] = useState(false);
  const [customerMessage, setCustomerMessage] = useState({ title: "", body: "" });
  const [customerMessageRetrySeconds, setCustomerMessageRetrySeconds] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBanner, setEditingBanner] = useState(null);
  const [selectedImageFile, setSelectedImageFile] = useState(null);
  const [selectedImagePreview, setSelectedImagePreview] = useState("");
  const [formData, setFormData] = useState(makeEmptyForm());

  useEffect(() => {
    if (!selectedImageFile) {
      setSelectedImagePreview("");
      return undefined;
    }

    const previewUrl = URL.createObjectURL(selectedImageFile);
    setSelectedImagePreview(previewUrl);

    return () => {
      URL.revokeObjectURL(previewUrl);
    };
  }, [selectedImageFile]);

  const loadPageData = async () => {
    try {
      setError("");
      setLoading(true);
      const [bannerResponse, menuResponse, voucherResponse] = await Promise.all(
        [loadAdminMarketingBanners(), loadAdminMenu(), loadAdminVouchers()],
      );

      setBanners(
        Array.isArray(bannerResponse?.banners) ? bannerResponse.banners : [],
      );
      setMenuItems(flattenMenuItems(menuResponse));
      setVoucherTemplates(
        Array.isArray(voucherResponse?.vouchers)
          ? voucherResponse.vouchers
          : [],
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load posters.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadPageData();
  }, []);

  const filteredBanners = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return banners.filter((banner) => {
      const matchesSearch =
        !q ||
        String(banner.title ?? "")
          .toLowerCase()
          .includes(q) ||
        String(banner.subtitle ?? "")
          .toLowerCase()
          .includes(q) ||
        String(banner.partnerName ?? "")
          .toLowerCase()
          .includes(q) ||
        String(banner.targetLabel ?? "")
          .toLowerCase()
          .includes(q) ||
        String(banner.bannerType ?? "")
          .toLowerCase()
          .includes(q);

      const matchesType = selectedType
        ? banner.bannerType === selectedType
        : true;
      const matchesPlacement = selectedPlacement
        ? banner.placement === selectedPlacement
        : true;
      const matchesStatus = selectedStatus
        ? bannerStatusLabel(banner).toLowerCase() ===
          selectedStatus.toLowerCase()
        : true;

      return matchesSearch && matchesType && matchesPlacement && matchesStatus;
    });
  }, [banners, searchTerm, selectedType, selectedPlacement, selectedStatus]);

  const [sortKey, setSortKey] = useState("title");
  const [sortDirection, setSortDirection] = useState("asc");

  const handleSort = (key) => {
    if (sortKey === key) {
      if (sortDirection === "asc") {
        setSortDirection("desc");
      } else if (sortDirection === "desc") {
        setSortKey(null);
        setSortDirection(null);
      }
    } else {
      setSortKey(key);
      setSortDirection("asc");
    }
    setCurrentPage(1);
  };

  const sortedBanners = useMemo(() => {
    if (!sortKey || !sortDirection) return filteredBanners;

    return [...filteredBanners].sort((a, b) => {
      let valA = "";
      let valB = "";

      if (sortKey === "title") {
        valA = String(a.title || "").toLowerCase();
        valB = String(b.title || "").toLowerCase();
      } else if (sortKey === "type") {
        valA = String(bannerTypeLabel(a.bannerType) || "").toLowerCase();
        valB = String(bannerTypeLabel(b.bannerType) || "").toLowerCase();
      } else if (sortKey === "route") {
        valA = String(routeLabel(a) || "").toLowerCase();
        valB = String(routeLabel(b) || "").toLowerCase();
      } else if (sortKey === "placement") {
        valA = String(a.placement || "both").toLowerCase();
        valB = String(b.placement || "both").toLowerCase();
      } else if (sortKey === "status") {
        valA = String(bannerStatusLabel(a) || "").toLowerCase();
        valB = String(bannerStatusLabel(b) || "").toLowerCase();
      } else if (sortKey === "floating") {
        const priorityA = a.floatingPriority ? 1 : 0;
        const priorityB = b.floatingPriority ? 1 : 0;
        return sortDirection === "asc" ? priorityA - priorityB : priorityB - priorityA;
      } else if (sortKey === "engagement") {
        const clicksA = Number(a.clicks || 0);
        const clicksB = Number(b.clicks || 0);
        return sortDirection === "asc" ? clicksA - clicksB : clicksB - clicksA;
      }

      if (valA < valB) return sortDirection === "asc" ? -1 : 1;
      if (valA > valB) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
  }, [filteredBanners, sortKey, sortDirection]);

  const summaryCards = useMemo(() => {
    const activeCount = banners.filter((banner) => {
      const status = bannerStatusLabel(banner);
      return status === "Active" || status === "Live";
    }).length;
    const scheduledCount = banners.filter(
      (banner) => bannerStatusLabel(banner) === "Scheduled",
    ).length;

    return [
      {
        label: "Total posters",
        value: banners.length,
        note: "Configured in Marketing",
      },
      {
        label: "Active now",
        value: activeCount,
        note: "Visible or live to users",
      },
      { label: "Scheduled", value: scheduledCount, note: "Future campaigns" },
    ];
  }, [banners]);

  const totalPages = Math.max(
    1,
    Math.ceil(sortedBanners.length / ITEMS_PER_PAGE),
  );
  const currentRows = sortedBanners.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE,
  );

  const arrangeRows = useMemo(() => {
    if (!arrangeSurface) return [];
    const rows = banners.filter((banner) => {
      if (arrangeSurface === "partnership") return banner.bannerType === "partner";
      if (arrangeSurface === "floating") {
        return banner.bannerType !== "partner" && banner.floatingPriority;
      }
      return (
        banner.bannerType !== "partner" &&
        ["home", "both"].includes(banner.placement || "both")
      );
    });
    const orderKey = arrangeSurface === "floating"
      ? "floatingSortOrder"
      : arrangeSurface === "partnership"
        ? "partnershipSortOrder"
        : "homeSortOrder";
    return rows.sort((first, second) => {
      const order = Number(first[orderKey] ?? first.sortOrder ?? 0) -
        Number(second[orderKey] ?? second.sortOrder ?? 0);
      return order || Number(first.id) - Number(second.id);
    });
  }, [arrangeSurface, banners]);

  const moveSurfaceBanner = async (banner, direction) => {
    const index = arrangeRows.findIndex((item) => item.id === banner.id);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= arrangeRows.length) return;

    const nextOrder = [...arrangeRows];
    [nextOrder[index], nextOrder[nextIndex]] = [nextOrder[nextIndex], nextOrder[index]];

    try {
      setReorderingBannerId(banner.id);
      setError("");
      await reorderAdminMarketingBannerSurface(
        arrangeSurface,
        nextOrder.map((item) => item.id),
      );
      await loadPageData();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unable to arrange posters.";
      setError(msg);
      showAdminError(msg);
    } finally {
      setReorderingBannerId(null);
    }
  };

  const openCreateModal = () => {
    setEditingBanner(null);
    setFormData(makeEmptyForm());
    setSelectedImageFile(null);
    setError("");
    setIsModalOpen(true);
  };

  const openEditModal = (banner) => {
    setError("");
    setEditingBanner(banner);
    setFormData({
      title: banner.title || "",
      subtitle: banner.subtitle || "",
      imageSource: banner.imageSource || "",
      mediaType: banner.mediaType || "image",
      animationDurationMs: Number(banner.animationDurationMs || 0),
      bannerType:
        banner.bannerType === "event" || banner.destinationType === "calendar"
          ? "event"
          : banner.bannerType || "general",
      partnerName: banner.partnerName || "",
      sponsoredLabel: banner.sponsoredLabel !== false,
      ctaLabel: banner.ctaLabel || "",
      actionType:
        ["partner", "social"].includes(banner.bannerType) &&
        (!banner.actionType || banner.actionType === "none")
          ? "external_url"
          : banner.actionType || "none",
      actionValue: banner.actionValue || "",
      destinationType: banner.destinationType || "menu",
      targetValue: banner.targetValue || "",
      startsAt: toDateTimeLocalValue(banner.startsAt),
      endsAt: toDateTimeLocalValue(banner.endsAt),
      placement: banner.placement || "both",
      floatingPriority: Boolean(banner.floatingPriority),
      isActive: Boolean(banner.isActive),
    });
    setSelectedImageFile(null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingBanner(null);
    setSelectedImageFile(null);
    setFormData(makeEmptyForm());
    setError("");
  };

  const handlePosterFileChange = (event) => {
    const file = event.target.files?.[0] || null;
    if (!file) {
      setSelectedImageFile(null);
      return;
    }

    if (!["image/png", "image/jpeg", "image/webp", "image/gif"].includes(file.type)) {
      const msg = "Upload a PNG, JPG, WEBP, or GIF poster. Video files are not supported.";
      setError(msg);
      showAdminError(msg);
      event.target.value = "";
      return;
    }

    const MAX_POSTER_FILE_SIZE = 15 * 1024 * 1024; // 15 MB
    if (file.size > MAX_POSTER_FILE_SIZE) {
      const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
      const msg = `The selected poster (${sizeMb} MB) exceeds the 15 MB limit. Please compress or resize the image before uploading.`;
      setError(msg);
      showAdminError(msg);
      event.target.value = "";
      return;
    }

    setError("");
    setSelectedImageFile(file);
  };

  const updateBannerType = (bannerType) => {
    setFormData((current) => {
      const next = {
        ...current,
        bannerType,
        targetValue: "",
        startsAt: ["event", "partner", "social"].includes(bannerType)
          ? current.startsAt
          : "",
        endsAt: ["event", "partner", "social"].includes(bannerType)
          ? current.endsAt
          : "",
      };

      if (bannerType === "event") {
        next.destinationType = "calendar";
      } else if (bannerType === "partner") {
        next.actionType =
          current.actionType === "email" ? "email" : "external_url";
        next.ctaLabel = current.ctaLabel || "Visit website";
        next.destinationType = "menu";
        next.placement = "home";
        next.floatingPriority = false;
      } else if (bannerType === "social") {
        next.actionType = "external_url";
        next.ctaLabel = current.ctaLabel || "Open link";
        next.destinationType = "menu";
      } else if (bannerType === "new_item") {
        next.destinationType = "menu";
      } else if (
        bannerType === "voucher" &&
        !["reward_section", "menu"].includes(current.destinationType)
      ) {
        next.destinationType = "reward_section";
      } else if (
        bannerType === "general" &&
        !["reward_section", "menu"].includes(current.destinationType)
      ) {
        next.destinationType = "menu";
      }

      return next;
    });
  };

  const submitBanner = async (event) => {
    event.preventDefault();

    const needsTarget =
      formData.bannerType === "voucher" || formData.bannerType === "new_item";
    const needsSchedule =
      formData.bannerType === "event" ||
      formData.destinationType === "calendar";
    const resolvedBannerType =
      formData.destinationType === "calendar" ? "event" : formData.bannerType;
    const resolvedDestinationType =
      resolvedBannerType === "event" ? "calendar" : formData.destinationType;
    const bannerTarget = String(formData.targetValue ?? "").trim();

    if (needsTarget && !bannerTarget) {
      setError("Select a target voucher or menu item.");
      return;
    }
    if (needsSchedule && (!formData.startsAt || !formData.endsAt)) {
      setError("Event posters need both start and end date.");
      return;
    }
    if (formData.bannerType === "partner" && !formData.partnerName.trim()) {
      setError("Enter the partner or business name.");
      return;
    }
    if (
      ["partner", "social"].includes(formData.bannerType) &&
      !formData.actionValue.trim()
    ) {
      setError("Enter the HTTPS social or entertainment link.");
      return;
    }
    if (selectedImageFile) {
      if (!["image/png", "image/jpeg", "image/webp", "image/gif"].includes(selectedImageFile.type)) {
        const msg = "Upload a PNG, JPG, WEBP, or GIF poster. Video files are not supported.";
        setError(msg);
        showAdminError(msg);
        return;
      }
      const MAX_POSTER_FILE_SIZE = 15 * 1024 * 1024;
      if (selectedImageFile.size > MAX_POSTER_FILE_SIZE) {
        const sizeMb = (selectedImageFile.size / (1024 * 1024)).toFixed(1);
        const msg = `The selected poster (${sizeMb} MB) exceeds the 15 MB limit. Please compress or resize the image before uploading.`;
        setError(msg);
        showAdminError(msg);
        return;
      }
    }

    try {
      setSaving(true);
      setError("");

      let imageSource = String(formData.imageSource ?? "").trim();
      let mediaType = formData.mediaType;
      let animationDurationMs = formData.animationDurationMs;
      if (selectedImageFile) {
        const uploadResponse = await uploadAdminMarketingPoster(
          selectedImageFile,
          formData.bannerType === "partner" ? "partner" : "standard",
        );
        imageSource = uploadResponse.image_url;
        mediaType = uploadResponse.media_type;
        animationDurationMs = Number(uploadResponse.animation_duration_ms || 0);
      }

      const payload = {
        title: formData.title.trim(),
        subtitle: formData.subtitle.trim(),
        imageSource,
        mediaType,
        animationDurationMs,
        bannerType: resolvedBannerType,
        partnerName:
          resolvedBannerType === "partner" ? formData.partnerName.trim() : null,
        sponsoredLabel:
          resolvedBannerType === "partner"
            ? Boolean(formData.sponsoredLabel)
            : false,
        ctaLabel:
          ["partner", "social"].includes(resolvedBannerType) &&
          formData.actionType !== "none"
            ? formData.ctaLabel.trim()
            : null,
        actionType:
          ["partner", "social"].includes(resolvedBannerType)
            ? formData.actionType
            : "none",
        actionValue:
          ["partner", "social"].includes(resolvedBannerType) &&
          formData.actionType !== "none"
            ? formData.actionValue.trim()
            : null,
        destinationType: resolvedDestinationType,
        targetValue: needsTarget ? bannerTarget : null,
        startsAt:
          needsSchedule || ["partner", "social"].includes(resolvedBannerType)
            ? toIsoOrNull(formData.startsAt)
            : null,
        endsAt:
          needsSchedule || ["partner", "social"].includes(resolvedBannerType)
            ? toIsoOrNull(formData.endsAt)
            : null,
        placement: formData.placement,
        floatingPriority: Boolean(formData.floatingPriority),
        isActive: Boolean(formData.isActive),
      };

      if (editingBanner) {
        await updateAdminMarketingBanner(editingBanner.id, payload);
      } else {
        const response = await createAdminMarketingBanner(payload);
        const recipients = Number(response?.notification?.recipients || 0);
        if (response?.notification) {
          showAdminSuccess(
            `Poster created and added to notifications for ${recipients} customer${recipients === 1 ? "" : "s"}.`,
          );
        }
      }

      await loadPageData();
      closeModal();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unable to save poster.";
      setError(msg);
      showAdminError(msg);
    } finally {
      setSaving(false);
    }
  };

  const removeBanner = async (banner) => {
    if (!await requestAdminConfirm({ title: "Delete poster?", message: `Delete “${banner.title}”?`, confirmLabel: "Delete", tone: "danger" })) {
      return;
    }

    try {
      setSaving(true);
      await deleteAdminMarketingBanner(banner.id);
      await loadPageData();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unable to delete poster.";
      setError(msg);
      showAdminError(msg);
    } finally {
      setSaving(false);
    }
  };

  const notifyCustomers = async (banner) => {
    if (
      !await requestAdminConfirm({ title: "Send poster notification?", message: `Send “${banner.title}” to all active customers again?`, confirmLabel: "Send" })
    ) {
      return;
    }

    try {
      setError("");
      setNotifyingBannerId(banner.id);
      const response = await notifyAdminMarketingBanner(banner.id);
      const recipients = Number(response?.notification?.recipients || 0);
      const attemptedDevices = Number(
        response?.notification?.attemptedDevices || 0,
      );
      const deliveredDevices = Number(
        response?.notification?.deliveredDevices || 0,
      );
      const failedDevices = Number(response?.notification?.failedDevices || 0);
      showAdminSuccess(
        `Notification added for ${recipients} customer${recipients === 1 ? "" : "s"}; Firebase accepted ${deliveredDevices} of ${attemptedDevices} push request${attemptedDevices === 1 ? "" : "s"}${failedDevices > 0 ? ` (${failedDevices} failed)` : ""}.`,
      );
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : "Unable to send the poster notification.";
      setError(msg);
      showAdminError(msg);
    } finally {
      setNotifyingBannerId(null);
    }
  };

  const sendCustomerMessage = async (event) => {
    event.preventDefault();
    const title = customerMessage.title.trim();
    const body = customerMessage.body.trim();
    if (!title || !body) return;

    if (!await requestAdminConfirm({ title: "Send customer message?", message: "This message will be sent to every active customer who allows marketing notifications.", confirmLabel: "Send message" })) {
      return;
    }

    try {
      setError("");
      setSendingCustomerMessage(true);
      customerMessageRequestKey.current ||= crypto.randomUUID();
      const response = await sendAdminCustomerMessage({
        title,
        body,
        idempotency_key: customerMessageRequestKey.current,
      });
      const recipients = Number(response?.message?.recipients || 0);
      const deliveredDevices = Number(response?.message?.deliveredDevices || 0);
      const acceptedIos = Number(response?.message?.acceptedByPlatform?.ios || 0);
      const acceptedAndroid = Number(response?.message?.acceptedByPlatform?.android || 0);
      showAdminSuccess(
        `Message sent to ${recipients} customer${recipients === 1 ? "" : "s"}. Firebase accepted ${deliveredDevices} push request${deliveredDevices === 1 ? "" : "s"} (${acceptedIos} iOS, ${acceptedAndroid} Android).`,
      );
      setCustomerMessage({ title: "", body: "" });
      customerMessageRequestKey.current = null;
      setCustomerMessageRetrySeconds(0);
    } catch (err) {
      setCustomerMessageRetrySeconds(Math.ceil(Number(err?.retryAfterSeconds) || 0));
      const msg = err instanceof Error ? err.message : "Unable to send the customer message.";
      setError(msg);
      showAdminError(msg);
    } finally {
      setSendingCustomerMessage(false);
    }
  };

  const previewIsGif =
    selectedImageFile?.type === "image/gif" || formData.mediaType === "gif";

  const SortableHeader = ({ label, columnKey, info, className = "" }) => {
    const isSorted = sortKey === columnKey;
    return (
      <th className={`px-6 py-3 font-bold text-[11px] text-gray-500 uppercase tracking-wider border-b border-gray-100 ${className}`}>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => handleSort(columnKey)}
            className={`group inline-flex items-center gap-1.5 hover:text-[#2E5E58] cursor-pointer focus:outline-none transition-colors select-none ${
              isSorted ? "text-[#2E5E58] font-bold" : ""
            }`}
            title={`Sort by ${label} ${isSorted && sortDirection === "asc" ? "(Z to A)" : "(A to Z)"}`}
          >
            <span>{label}</span>
            <span className="inline-flex items-center">
              {isSorted ? (
                sortDirection === "asc" ? (
                  <ArrowUp size={13} className="text-[#2E5E58]" strokeWidth={2.5} />
                ) : (
                  <ArrowDown size={13} className="text-[#2E5E58]" strokeWidth={2.5} />
                )
              ) : (
                <ArrowUpDown size={12} className="text-gray-300 group-hover:text-gray-500 transition-colors" />
              )}
            </span>
          </button>
          {info && <InfoTooltip content={info} title={label} />}
        </div>
      </th>
    );
  };

  return (
    <div className="flex-1 overflow-x-hidden overflow-y-auto bg-[#F9FAFB]">
      <div className="px-6 py-5 lg:px-8 lg:py-6 w-full h-full flex flex-col gap-4">
        <div className="shrink-0 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">
                Marketing & Posters
              </h1>
              <InfoTooltip
                title="Marketing Posters"
                content="Manage visual banners displayed in the customer mobile app (Home and Profile surfaces). Posters can deep-link to vouchers, specific menu products, event schedules, or external partner sites."
              />
            </div>
            <p className="text-xs font-medium text-gray-500 mt-0.5">
              App promotional banners, partner campaigns, and customer announcements
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="inline-flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setArrangeSurface("home")}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-white border border-[#2E5E58] text-[#2E5E58] text-xs font-bold rounded-lg hover:bg-[#F5FBF9] transition-colors cursor-pointer shadow-xs"
              >
                Arrange display
              </button>
              <InfoTooltip
                title="Display Arrangement"
                content="Configure the exact carousel sequence for Home banners, Floating cards, and Partnership posters."
              />
            </div>
            <button
              type="button"
              onClick={() => void loadPageData()}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-white border border-gray-300 text-gray-700 text-xs font-bold rounded-lg hover:bg-gray-50 transition-colors cursor-pointer shadow-xs"
            >
              <RefreshCw size={14} /> Refresh
            </button>
            <button
              type="button"
              onClick={openCreateModal}
              className="flex items-center gap-1.5 px-4 py-2 bg-[#2E5E58] text-white text-xs font-bold rounded-lg hover:bg-[#1F4B43] transition-colors cursor-pointer shadow-xs"
            >
              <Plus size={15} /> Add Poster
            </button>
          </div>
        </div>

        <PaymentServiceNotices />

        <form onSubmit={sendCustomerMessage} className="rounded-2xl border border-gray-200/80 bg-white p-4 sm:p-5 shadow-xs">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#2E5E58]/10 text-[#2E5E58]">
                <MessageSquare size={16} />
              </div>
              <div className="flex items-center gap-1.5">
                <h2 className="text-sm font-bold text-gray-900 tracking-tight">Customer Broadcast</h2>
                <InfoTooltip
                  title="Broadcast Scope"
                  content="Sends a push notification to active customers who enabled notifications, and records an announcement into their in-app Notifications tab."
                />
              </div>
            </div>
            <span className="self-start sm:self-auto rounded-full bg-gray-100 px-2.5 py-0.5 text-[10px] font-bold text-gray-600">
              In-app + Push notification
            </span>
          </div>
          <div className="mt-3.5 grid gap-3 lg:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)]">
            <label className="text-xs font-semibold text-gray-700">
              Title
              <input required maxLength={120} value={customerMessage.title} onChange={(event) => setCustomerMessage((current) => ({ ...current, title: event.target.value }))} placeholder="e.g. A little reminder from C2 Coffee" className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-xs outline-none focus:border-[#2E5E58] focus:ring-1 focus:ring-[#2E5E58]" />
            </label>
            <label className="text-xs font-semibold text-gray-700">
              Message
              <textarea required maxLength={420} rows={2} value={customerMessage.body} onChange={(event) => setCustomerMessage((current) => ({ ...current, body: event.target.value }))} placeholder="e.g. Don't forget to come by and enjoy your favourite drink today." className="mt-1 w-full resize-none rounded-xl border border-gray-300 bg-white px-3 py-2 text-xs outline-none focus:border-[#2E5E58] focus:ring-1 focus:ring-[#2E5E58]" />
            </label>
          </div>
          {customerMessageRetrySeconds > 0 && <p className="mt-2 text-right text-xs font-semibold text-amber-700">Messages are temporarily rate-limited. Try again in <span className="font-mono tabular-nums">{formatRetryCountdown(customerMessageRetrySeconds)}</span>.</p>}
          <div className="mt-3 flex justify-end">
            <button type="submit" disabled={sendingCustomerMessage || customerMessageRetrySeconds > 0 || !customerMessage.title.trim() || !customerMessage.body.trim()} className="inline-flex items-center gap-1.5 rounded-xl bg-[#2E5E58] px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#1F4B43] disabled:cursor-not-allowed disabled:opacity-50">
              <Bell size={14} />{sendingCustomerMessage ? "Sending..." : customerMessageRetrySeconds > 0 ? `Try again in ${formatRetryCountdown(customerMessageRetrySeconds)}` : "Send broadcast"}
            </button>
          </div>
        </form>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 shrink-0">
          {summaryCards.map((card) => (
            <div
              key={card.label}
              className="bg-white rounded-2xl border border-gray-200/80 shadow-xs px-5 py-3.5 flex items-center justify-between"
            >
              <div>
                <div className="flex items-center gap-1.5">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                    {card.label}
                  </p>
                  <InfoTooltip content={card.note} title={card.label} />
                </div>
                <p className="mt-1 text-2xl font-extrabold text-gray-900 tabular-nums">
                  {card.value}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm flex flex-col flex-1 min-h-[440px]">
          <div className="px-5 py-4 border-b border-gray-100 flex flex-col xl:flex-row justify-between gap-3 shrink-0">
            <div className="relative w-full xl:w-96">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                size={18}
              />
              <input
                type="text"
                placeholder="Search poster title, target, or type..."
                value={searchTerm}
                onChange={(event) => {
                  setSearchTerm(event.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F3A34] text-sm"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2.5 w-full xl:w-auto">
              <div className="relative">
                <select
                  value={selectedType}
                  onChange={(event) => {
                    setSelectedType(event.target.value);
                    setCurrentPage(1);
                  }}
                  className="peer appearance-none pl-4 pr-10 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none cursor-pointer min-w-[160px]"
                >
                  <option value="">All types</option>
                  {bannerTypeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none"
                  size={16}
                />
              </div>

              <div className="relative">
                <select
                  value={selectedPlacement}
                  onChange={(event) => {
                    setSelectedPlacement(event.target.value);
                    setCurrentPage(1);
                  }}
                  className="peer appearance-none pl-4 pr-10 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none cursor-pointer min-w-[160px]"
                >
                  <option value="">All placements</option>
                  <option value="home">Home</option>
                  <option value="profile">Profile</option>
                  <option value="both">Both</option>
                </select>
                <ChevronDown
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none"
                  size={16}
                />
              </div>

              <div className="relative">
                <select
                  value={selectedStatus}
                  onChange={(event) => {
                    setSelectedStatus(event.target.value);
                    setCurrentPage(1);
                  }}
                  className="peer appearance-none pl-4 pr-10 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none cursor-pointer min-w-[160px]"
                >
                  <option value="">All statuses</option>
                  <option value="Active">Active</option>
                  <option value="Live">Live</option>
                  <option value="Scheduled">Scheduled</option>
                  <option value="Ended">Ended</option>
                  <option value="Inactive">Inactive</option>
                </select>
                <ChevronDown
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none"
                  size={16}
                />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-gray-50/80 sticky top-0 z-10 border-b border-gray-100">
                <tr>
                  <SortableHeader label="Poster" columnKey="title" />
                  <SortableHeader label="Type" columnKey="type" />
                  <SortableHeader label="Route" columnKey="route" />
                  <SortableHeader label="Placement" columnKey="placement" />
                  <SortableHeader label="Status" columnKey="status" />
                  <SortableHeader label="Floating" columnKey="floating" info="Priority floating banners appear as overlay popups on the mobile app home screen." />
                  <SortableHeader label="Engagement" columnKey="engagement" info="Recorded views and click-through counts from customers." />
                  <th className="px-6 py-3 font-bold text-[11px] text-gray-500 uppercase tracking-wider text-center">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {currentRows.length > 0 ? (
                  currentRows.map((banner) => (
                    <tr
                      key={banner.id}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <img
                            src={resolveImageUrl(banner.imageSource)}
                            alt={banner.title}
                            className="w-12 h-12 rounded-xl object-cover border border-gray-200 shrink-0 bg-gray-50"
                          />
                          <div className="min-w-0">
                            <p className="font-semibold text-gray-900 truncate">
                              {banner.title}
                            </p>
                            <p className="text-xs text-gray-500 truncate">
                              {banner.subtitle}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex px-2.5 py-1 rounded-md text-xs font-bold bg-[#EAF2EF] text-[#1F3A34]">
                          {bannerTypeLabel(banner.bannerType)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-700">
                        <div>
                          <p className="font-medium text-gray-900">
                            {routeLabel(banner)}
                          </p>
                          {banner.targetLabel ? (
                            <p className="text-xs text-gray-500 mt-0.5 truncate max-w-[280px]">
                              {banner.targetLabel}
                            </p>
                          ) : null}
                          {["event", "partner"].includes(banner.bannerType) &&
                          banner.scheduleLabel ? (
                            <p className="text-xs text-gray-500 mt-0.5">
                              {banner.scheduleLabel}
                            </p>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-gray-700 capitalize">
                        {banner.placement || "both"}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`px-2.5 py-1 text-xs font-bold rounded-md ${statusClassMap[bannerStatusLabel(banner)] || statusClassMap.Active}`}
                        >
                          {bannerStatusLabel(banner)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {banner.floatingPriority ? (
                          <span className="inline-flex px-2.5 py-1 rounded-md text-xs font-bold bg-[#D1FADF] text-[#039855]">
                            Floating banner
                          </span>
                        ) : (
                          <span className="inline-flex px-2.5 py-1 rounded-md text-xs font-semibold bg-gray-100 text-gray-500">
                            Not priority
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-gray-700">
                        {banner.bannerType === "partner" ? (
                          <div>
                            <p className="font-medium text-gray-900">
                              {Number(banner.clicks || 0)} clicks
                            </p>
                            <p className="text-xs text-gray-500">
                              {Number(banner.impressions || 0)} views ·{" "}
                              {Number(banner.impressions || 0) > 0
                                ? (
                                    (Number(banner.clicks || 0) /
                                      Number(banner.impressions)) *
                                    100
                                  ).toFixed(1)
                                : "0.0"}
                              % CTR
                            </p>
                          </div>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => void notifyCustomers(banner)}
                            disabled={
                              notifyingBannerId === banner.id ||
                              !["Active", "Live"].includes(
                                bannerStatusLabel(banner),
                              )
                            }
                            title="Send this poster to customers again"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#1F3A34] text-sm font-semibold text-[#1F3A34] bg-white hover:bg-[#EAF2EF] disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <Bell size={15} />{" "}
                            {notifyingBannerId === banner.id
                              ? "Sending..."
                              : "Notify"}
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditModal(banner)}
                            className="px-3 py-1.5 rounded-lg border border-gray-300 text-sm font-semibold text-gray-700 bg-white hover:bg-gray-50"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => void removeBanner(banner)}
                            className="inline-flex items-center justify-center w-9 h-9 rounded-lg border border-gray-300 text-gray-500 bg-white hover:bg-red-50 hover:text-red-600"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan="8"
                      className="px-6 py-12 text-center text-gray-500"
                    >
                      {loading
                        ? "Loading posters..."
                        : "No posters configured yet."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="px-6 py-4 border-t border-gray-100 flex shrink-0">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              setCurrentPage={setCurrentPage}
              itemsPerPage={ITEMS_PER_PAGE}
              totalItems={sortedBanners.length}
              itemName="posters"
            />
          </div>
        </div>
      </div>

      {arrangeSurface &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 z-9999 flex items-center justify-center p-4 bg-slate-900/35 backdrop-blur-md">
            <div className="w-full max-w-2xl max-h-[85vh] overflow-hidden rounded-2xl bg-white shadow-2xl border border-gray-100 flex flex-col">
              <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Arrange poster display</h2>
                  <p className="mt-1 text-xs text-gray-500">
                    Choose a surface, then use the arrows that appear when you hover over a poster.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setArrangeSurface(null)}
                  className="rounded-xl p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                  aria-label="Close arrange poster display"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="flex gap-2 border-b border-gray-100 px-6 py-3">
                {[
                  ["home", "Home"],
                  ["floating", "Floating"],
                  ["partnership", "Partnership"],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setArrangeSurface(value)}
                    className={`rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${arrangeSurface === value ? "bg-[#1F3A34] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="overflow-y-auto p-6">
                {arrangeRows.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
                    {arrangeSurface === "floating"
                      ? "No posters are enabled as floating banners. Enable Floating banner in Edit Poster first."
                      : arrangeSurface === "partnership"
                        ? "No Partnership posters are configured yet."
                        : "No posters are configured for Home."}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {arrangeRows.map((banner, index) => (
                      <div
                        key={banner.id}
                        className="group flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-3 py-2.5 hover:border-[#B7D6CC] hover:bg-[#F8FCFA]"
                      >
                        <span className="w-6 text-center text-sm font-bold text-[#1F3A34]">{index + 1}</span>
                        <img
                          src={resolveImageUrl(banner.imageSource)}
                          alt=""
                          className="h-12 w-12 shrink-0 rounded-lg object-cover border border-gray-200"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-gray-900">{banner.title}</p>
                          <p className="truncate text-xs text-gray-500">{bannerTypeLabel(banner.bannerType)}</p>
                        </div>
                        <div className="flex flex-col gap-1 opacity-40 transition-opacity group-hover:opacity-100">
                          <button
                            type="button"
                            onClick={() => void moveSurfaceBanner(banner, -1)}
                            disabled={Boolean(reorderingBannerId) || index === 0}
                            aria-label={`Move ${banner.title} up in ${arrangeSurface} order`}
                            className="inline-flex h-7 w-8 items-center justify-center rounded border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-30"
                          >
                            <ArrowUp size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => void moveSurfaceBanner(banner, 1)}
                            disabled={Boolean(reorderingBannerId) || index === arrangeRows.length - 1}
                            aria-label={`Move ${banner.title} down in ${arrangeSurface} order`}
                            className="inline-flex h-7 w-8 items-center justify-center rounded border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-30"
                          >
                            <ArrowDown size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="border-t border-gray-100 px-6 py-4 text-right">
                <button
                  type="button"
                  onClick={() => setArrangeSurface(null)}
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Done
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {isModalOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 z-9999 flex items-center justify-center p-4 bg-slate-900/35 backdrop-blur-md animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 w-full max-w-3xl max-h-[92vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
              <div className="px-6 py-4 border-b border-gray-100 bg-white flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-gray-900">
                    {editingBanner ? "Edit Poster" : "Create Poster"}
                  </h2>
                  <InfoTooltip
                    title="Poster Dimensions"
                    content="Displayed in customer mobile app with 4:5 portrait framing (or 16:9 landscape for partners)."
                  />
                </div>
                <button
                  type="button"
                  onClick={closeModal}
                  className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <form
                onSubmit={submitBanner}
                className="p-6 overflow-y-auto flex-1"
              >
                {error && (
                  <div
                    role="alert"
                    className="mb-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700 shadow-xs"
                  >
                    <AlertCircle className="h-5 w-5 shrink-0 text-red-600 mt-0.5" />
                    <div className="flex-1">
                      <p className="font-bold text-red-800">Poster Error</p>
                      <p className="mt-0.5 text-xs text-red-700 leading-relaxed">{error}</p>
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  <div className="space-y-5">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">
                        Poster Title
                      </label>
                      <input
                        type="text"
                        value={formData.title}
                        onChange={(event) =>
                          setFormData((current) => ({
                            ...current,
                            title: event.target.value,
                          }))
                        }
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#1F3A34]"
                        placeholder="e.g. Free Drink Voucher"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">
                        Subtitle
                      </label>
                      <textarea
                        value={formData.subtitle}
                        onChange={(event) =>
                          setFormData((current) => ({
                            ...current,
                            subtitle: event.target.value,
                          }))
                        }
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#1F3A34] min-h-[92px]"
                        placeholder="A short line for the poster"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">
                        Poster Type
                      </label>
                      <div className="relative">
                        <select
                          value={formData.bannerType}
                          onChange={(event) =>
                            updateBannerType(event.target.value)
                          }
                          className="peer appearance-none w-full border border-gray-200 rounded-lg px-3 py-2 pr-10 text-sm outline-none focus:border-[#1F3A34] bg-white"
                        >
                          {bannerTypeOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                        <ChevronDown
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none"
                          size={16}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">
                        Placement
                      </label>
                      <div className="relative">
                        <select
                          value={formData.placement}
                          disabled={formData.bannerType === "partner"}
                          onChange={(event) =>
                            setFormData((current) => ({
                              ...current,
                              placement: event.target.value,
                            }))
                          }
                          className="peer appearance-none w-full border border-gray-200 rounded-lg px-3 py-2 pr-10 text-sm outline-none focus:border-[#1F3A34] bg-white disabled:bg-gray-100 disabled:text-gray-500"
                        >
                          <option value="home">Home</option>
                          <option value="profile">Profile</option>
                          <option value="both">Both</option>
                        </select>
                        <ChevronDown
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none"
                          size={16}
                        />
                      </div>
                      {formData.bannerType === "partner" && (
                        <p className="mt-1 text-xs text-gray-500">
                          Partnership appears in its dedicated Home
                          section.
                        </p>
                      )}
                    </div>

                    <div className="rounded-xl border border-gray-200/80 bg-gray-50/70 px-4 py-3">
                      <label className="flex items-center justify-between text-xs font-semibold text-gray-700 cursor-pointer">
                        <span className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={formData.floatingPriority}
                            disabled={formData.bannerType === "partner"}
                            onChange={(event) =>
                              setFormData((current) => ({
                                ...current,
                                floatingPriority: event.target.checked,
                              }))
                            }
                            className="h-4 w-4 rounded border-gray-300 text-[#2E5E58] focus:ring-[#2E5E58]"
                          />
                          <span>Use as floating banner</span>
                        </span>
                        <InfoTooltip
                          title="Floating Banner"
                          content="Displays as an overlay popup ad on top of the customer home screen."
                        />
                      </label>
                    </div>

                    <div className="flex items-end">
                      <label className="flex items-center gap-2 text-sm text-gray-700 font-medium">
                        <input
                          type="checkbox"
                          checked={formData.isActive}
                          onChange={(event) =>
                            setFormData((current) => ({
                              ...current,
                              isActive: event.target.checked,
                            }))
                          }
                          className="h-4 w-4 rounded border-gray-300 text-[#2E5E58] focus:ring-[#2E5E58]"
                        />
                        Publish now
                      </label>
                    </div>
                  </div>

                  <div className="space-y-5">
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="block text-xs font-semibold text-gray-700">
                          Poster Media
                        </label>
                        <span className="text-[10px] font-semibold text-gray-400">
                          {formData.bannerType === "partner" ? "1200 × 675 (16:9)" : "1080 × 1350 (4:5)"}
                        </span>
                      </div>
                      <div className="border border-dashed border-gray-300 rounded-xl p-3.5 bg-gray-50/70">
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp,image/gif"
                          onChange={handlePosterFileChange}
                          className="block w-full text-xs text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-[#2E5E58] file:text-white file:text-xs file:font-semibold hover:file:bg-[#1F4B43] file:cursor-pointer"
                        />
                        <div className="mt-2 flex items-center gap-1.5 text-[11px] text-gray-400">
                          <span>PNG, JPG, WEBP, GIF (max 30s)</span>
                          <InfoTooltip
                            title="Media Guidelines"
                            content={
                              formData.bannerType === "partner"
                                ? "Artwork is prepared as 16:9 (1200 × 675). GIFs must be under 30 seconds."
                                : "Standard posters are 4:5 portrait (1080 × 1350). GIFs must be under 30 seconds."
                            }
                          />
                        </div>
                        {(selectedImageFile || formData.imageSource) && (
                          <div className="mt-3 flex items-center gap-3 pt-3 border-t border-gray-200/60">
                            <img
                              src={
                                selectedImagePreview ||
                                resolveImageUrl(formData.imageSource)
                              }
                              alt="Poster preview"
                              className="w-12 h-12 object-cover rounded-lg border border-gray-200 bg-white shrink-0"
                            />
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-bold text-gray-900 truncate">
                                {selectedImageFile
                                  ? selectedImageFile.name
                                  : "Current image"}
                              </p>
                              <p className="text-[10px] text-gray-400 truncate">
                                {selectedImageFile ? `${(selectedImageFile.size / 1024).toFixed(0)} KB` : "Stored in catalog"}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-1.5">
                          <p className="text-xs font-bold text-gray-700">App Preview</p>
                          <InfoTooltip content="Real-time preview of how customers view this poster inside the mobile app." title="Customer View" />
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-gray-100 text-gray-600">
                          {formData.bannerType === "partner" ? "16:9 Landscape" : "4:5 Portrait"}
                        </span>
                      </div>
                      <div
                        className={`mx-auto w-full ${formData.bannerType === "partner" ? "max-w-[420px] aspect-video" : "max-w-[280px] aspect-[4/5]"} overflow-hidden rounded-[24px] border border-gray-200 bg-gray-100 shadow-sm`}
                      >
                        {selectedImagePreview || formData.imageSource ? (
                          <img
                            src={
                              selectedImagePreview ||
                              resolveImageUrl(formData.imageSource)
                            }
                            alt="Customer poster preview"
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center px-8 text-center text-sm text-gray-400">
                            Your{" "}
                            {formData.bannerType === "partner"
                              ? "16:9 partner artwork"
                              : "4:5 poster"}{" "}
                            preview appears here.
                          </div>
                        )}
                      </div>
                      {previewIsGif && (
                        <p className="mt-2 text-xs font-medium text-[#1F3A34]">
                          {selectedImageFile
                            ? "GIF: its animation duration is detected when the poster is uploaded."
                            : `GIF: the customer carousel waits ${Math.max(1, Math.ceil(formData.animationDurationMs / 1000))} seconds for one full animation cycle.`}
                        </p>
                      )}
                    </div>

                    {formData.bannerType === "voucher" && (
                      <div className="space-y-4">
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1">
                            Route on Click
                          </label>
                          <div className="relative">
                            <select
                              value={formData.destinationType}
                              onChange={(event) =>
                                setFormData((current) => ({
                                  ...current,
                                  destinationType: event.target.value,
                                }))
                              }
                              className="peer appearance-none w-full border border-gray-200 rounded-lg px-3 py-2 pr-10 text-sm outline-none focus:border-[#1F3A34] bg-white"
                            >
                              <option value="reward_section">
                                Reward section
                              </option>
                              <option value="menu">Menu</option>
                            </select>
                            <ChevronDown
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none"
                              size={16}
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1">
                            Target Voucher
                          </label>
                          <div className="relative">
                            <select
                              value={formData.targetValue}
                              onChange={(event) =>
                                setFormData((current) => ({
                                  ...current,
                                  targetValue: event.target.value,
                                }))
                              }
                              className="peer appearance-none w-full border border-gray-200 rounded-lg px-3 py-2 pr-10 text-sm outline-none focus:border-[#1F3A34] bg-white"
                            >
                              <option value="">Select a voucher</option>
                              {voucherTemplates.map((voucher) => (
                                <option
                                  key={voucher.id}
                                  value={voucher.code || String(voucher.id)}
                                >
                                  {voucher.name} · {voucher.code || `ID ${voucher.id}`}
                                </option>
                              ))}
                            </select>
                            <ChevronDown
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none"
                              size={16}
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {formData.bannerType === "new_item" && (
                      <div className="space-y-4">
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1">
                            Route on Click
                          </label>
                          <div className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 bg-gray-50">
                            Menu
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1">
                            Target Menu Item
                          </label>
                          <div className="relative">
                            <select
                              value={formData.targetValue}
                              onChange={(event) =>
                                setFormData((current) => ({
                                  ...current,
                                  targetValue: event.target.value,
                                }))
                              }
                              className="peer appearance-none w-full border border-gray-200 rounded-lg px-3 py-2 pr-10 text-sm outline-none focus:border-[#1F3A34] bg-white"
                            >
                              <option value="">Select a menu item</option>
                              {menuItems.map((item) => (
                                <option key={item.code} value={item.code}>
                                  {item.name} · {item.code}
                                </option>
                              ))}
                            </select>
                            <ChevronDown
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none"
                              size={16}
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {formData.bannerType === "event" && (
                      <div className="space-y-4">
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1">
                            Event Route
                          </label>
                          <div className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 bg-gray-50">
                            Calendar before start · Menu during the event
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">
                              Starts At
                            </label>
                            <input
                              type="datetime-local"
                              value={formData.startsAt}
                              onChange={(event) =>
                                setFormData((current) => ({
                                  ...current,
                                  startsAt: event.target.value,
                                }))
                              }
                              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#1F3A34]"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">
                              Ends At
                            </label>
                            <input
                              type="datetime-local"
                              value={formData.endsAt}
                              onChange={(event) =>
                                setFormData((current) => ({
                                  ...current,
                                  endsAt: event.target.value,
                                }))
                              }
                              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#1F3A34]"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {formData.bannerType === "partner" && (
                      <div className="space-y-4 rounded-xl border border-[#D7E4E0] bg-[#F5FAF8] p-4">
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1">
                            Partner or Business Name
                          </label>
                          <input
                            type="text"
                            value={formData.partnerName}
                            onChange={(event) =>
                              setFormData((current) => ({
                                ...current,
                                partnerName: event.target.value,
                              }))
                            }
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#1F3A34] bg-white"
                            placeholder="e.g. Local Artisan Market"
                            required
                          />
                        </div>
                        <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                          <input
                            type="checkbox"
                            checked={formData.sponsoredLabel}
                            onChange={(event) =>
                              setFormData((current) => ({
                                ...current,
                                sponsoredLabel: event.target.checked,
                              }))
                            }
                            className="h-4 w-4 rounded border-gray-300 text-[#1F3A34] focus:ring-[#1F3A34]"
                          />
                          Show Sponsored disclosure
                        </label>
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1">
                            Customer Action
                          </label>
                          <select
                            value={formData.actionType}
                            onChange={(event) =>
                              setFormData((current) => ({
                                ...current,
                                actionType: event.target.value,
                                actionValue: "",
                                ctaLabel: "",
                              }))
                            }
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#1F3A34] bg-white"
                          >
                            {partnerActionOptions.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        {formData.actionType !== "none" && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-xs font-medium text-gray-500 mb-1">
                                Button Label
                              </label>
                              <input
                                type="text"
                                value={formData.ctaLabel}
                                onChange={(event) =>
                                  setFormData((current) => ({
                                    ...current,
                                    ctaLabel: event.target.value,
                                  }))
                                }
                                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#1F3A34] bg-white"
                                placeholder="Learn more"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-500 mb-1">
                                {formData.actionType === "email"
                                  ? "Email Address"
                                  : "HTTPS Website"}
                              </label>
                              <input
                                type={
                                  formData.actionType === "email"
                                    ? "email"
                                    : "url"
                                }
                                value={formData.actionValue}
                                onChange={(event) =>
                                  setFormData((current) => ({
                                    ...current,
                                    actionValue: event.target.value,
                                  }))
                                }
                                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#1F3A34] bg-white"
                                placeholder={
                                  formData.actionType === "email"
                                    ? "partner@example.com"
                                    : "https://partner.example.com"
                                }
                                required
                              />
                            </div>
                          </div>
                        )}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">
                              Starts At (optional)
                            </label>
                            <input
                              type="datetime-local"
                              value={formData.startsAt}
                              onChange={(event) =>
                                setFormData((current) => ({
                                  ...current,
                                  startsAt: event.target.value,
                                }))
                              }
                              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">
                              Ends At (optional)
                            </label>
                            <input
                              type="datetime-local"
                              value={formData.endsAt}
                              onChange={(event) =>
                                setFormData((current) => ({
                                  ...current,
                                  endsAt: event.target.value,
                                }))
                              }
                              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {formData.bannerType === "social" && (
                      <div className="space-y-4 rounded-xl border border-[#E5D7EE] bg-[#FCF8FF] p-4">
                        <div>
                          <p className="text-sm font-semibold text-gray-900">
                            Social and entertainment destination
                          </p>
                          <p className="mt-1 text-xs leading-relaxed text-gray-500">
                            Link customers to Instagram, X, YouTube, Spotify,
                            TikTok, or any other HTTPS social or entertainment
                            page.
                          </p>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1">
                            Destination URL
                          </label>
                          <input
                            type="url"
                            value={formData.actionValue}
                            onChange={(event) =>
                              setFormData((current) => ({
                                ...current,
                                actionType: "external_url",
                                actionValue: event.target.value,
                              }))
                            }
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#1F3A34] bg-white"
                            placeholder="https://www.instagram.com/..."
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1">
                            Button Label
                          </label>
                          <input
                            type="text"
                            value={formData.ctaLabel}
                            onChange={(event) =>
                              setFormData((current) => ({
                                ...current,
                                ctaLabel: event.target.value,
                              }))
                            }
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#1F3A34] bg-white"
                            placeholder="Open link"
                          />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">
                              Starts At (optional)
                            </label>
                            <input
                              type="datetime-local"
                              value={formData.startsAt}
                              onChange={(event) =>
                                setFormData((current) => ({
                                  ...current,
                                  startsAt: event.target.value,
                                }))
                              }
                              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">
                              Ends At (optional)
                            </label>
                            <input
                              type="datetime-local"
                              value={formData.endsAt}
                              onChange={(event) =>
                                setFormData((current) => ({
                                  ...current,
                                  endsAt: event.target.value,
                                }))
                              }
                              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {formData.bannerType === "general" && (
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">
                          Route on Click
                        </label>
                        <div className="relative">
                          <select
                            value={formData.destinationType}
                            onChange={(event) => {
                              const destinationType = event.target.value;
                              setFormData((current) => ({
                                ...current,
                                destinationType,
                                bannerType:
                                  destinationType === "calendar"
                                    ? "event"
                                    : current.bannerType,
                              }));
                            }}
                            className="peer appearance-none w-full border border-gray-200 rounded-lg px-3 py-2 pr-10 text-sm outline-none focus:border-[#1F3A34] bg-white"
                          >
                            <option value="menu">Menu</option>
                            <option value="reward_section">
                              Reward section
                            </option>
                            <option value="calendar">Calendar</option>
                          </select>
                          <ChevronDown
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none"
                            size={16}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-4 mt-2 border-t border-gray-100 flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="px-4 py-2 rounded-xl border border-gray-300 text-xs font-bold text-gray-700 bg-white hover:bg-gray-50 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-5 py-2 rounded-xl bg-[#2E5E58] text-white text-xs font-bold hover:bg-[#1F4B43] transition-colors disabled:opacity-60 disabled:cursor-not-allowed shadow-xs cursor-pointer"
                  >
                    {saving
                      ? "Saving..."
                      : editingBanner
                        ? "Save Changes"
                        : "Create Poster"}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body,
        )}

      {!isModalOpen && error && (
        <div
          role="alert"
          className="fixed top-5 left-1/2 z-[100000] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 shadow-lg"
        >
          {error}
        </div>
      )}
    </div>
  );
};

export default Marketing;
