import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronDown,
  Download,
  RefreshCw,
  Search,
  X
} from 'lucide-react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { exportToCSV } from '../utils/exportToCSV';
import Pagination from './Pagination';
import { loadAdminAuditLogs } from '../lib/adminApi';
import InfoTooltip from './InfoTooltip';

const REFRESH_INTERVAL_MS = 60_000;
const ITEMS_PER_PAGE = 8;

const EMPTY_AUDIT = {
  logs: [],
  summary: {
    totalLogs: 0,
    totalActors: 0,
    topActionCode: '',
    topActionLabel: '',
    topActionCount: 0,
    topTargetType: '',
    topTargetLabel: '',
    topTargetCount: 0,
    latestAt: null
  }
};

const formatDisplayDateTime = (timestamp) => {
  if (!timestamp) {
    return { date: '', time: '' };
  }

  const dateObj = new Date(timestamp);
  return {
    date: new Intl.DateTimeFormat('en-MY', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    }).format(dateObj),
    time: new Intl.DateTimeFormat('en-MY', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }).format(dateObj)
  };
};

const formatDateLabel = (timestamp) => {
  if (!timestamp) {
    return '';
  }

  return new Intl.DateTimeFormat('en-MY', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(timestamp));
};

function SortableHeader({ label, sortKey, currentKey, direction, onSort, tooltip, align = 'left' }) {
  const active = currentKey === sortKey;
  const Icon = active ? (direction === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown;

  return (
    <th className={`px-6 py-3 font-semibold text-[13px] text-gray-900 border-b border-gray-100 leading-tight text-${align}`}>
      <div className={`flex items-center gap-1.5 ${align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : 'justify-start'}`}>
        <button
          type="button"
          onClick={() => onSort(sortKey)}
          className="group inline-flex items-center gap-1 hover:text-[#1F3A34] transition-colors focus:outline-hidden"
        >
          <span>{label}</span>
          <Icon className={`h-3.5 w-3.5 transition-opacity ${active ? 'text-[#1F3A34]' : 'text-gray-400 opacity-60 group-hover:opacity-100'}`} />
        </button>
        {tooltip && <InfoTooltip content={tooltip} title={label} />}
      </div>
    </th>
  );
}

const AuditLogs = () => {
  const [auditResponse, setAuditResponse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTargetType, setSelectedTargetType] = useState('');
  const [selectedActionCode, setSelectedActionCode] = useState('');
  const [selectedDate, setSelectedDate] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortKey, setSortKey] = useState('timestamp');
  const [sortDirection, setSortDirection] = useState('desc');

  useEffect(() => {
    let active = true;

    const loadAuditLogs = async () => {
      try {
        setError('');
        const response = await loadAdminAuditLogs({
          selectedDate,
          limit: 250
        });

        if (!active) return;
        setAuditResponse(response || EMPTY_AUDIT);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Unable to load audit logs.');
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void loadAuditLogs();
    const timer = window.setInterval(() => {
      void loadAuditLogs();
    }, REFRESH_INTERVAL_MS);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [selectedDate]);

  const overview = auditResponse || EMPTY_AUDIT;
  const logs = useMemo(
    () => Array.isArray(overview.logs) ? overview.logs : [],
    [overview.logs]
  );

  const uniqueTargetTypes = useMemo(() => {
    return [...new Set(logs.map((log) => log.targetType).filter(Boolean))].sort();
  }, [logs]);

  const uniqueActions = useMemo(() => {
    return [...new Set(logs.map((log) => log.actionCode).filter(Boolean))].sort();
  }, [logs]);

  const safeSearch = searchTerm.trim().toLowerCase();
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const matchesSearch = !safeSearch
        || String(log.actorName ?? '').toLowerCase().includes(safeSearch)
        || String(log.actorUsername ?? '').toLowerCase().includes(safeSearch)
        || String(log.actorEmail ?? '').toLowerCase().includes(safeSearch)
        || String(log.actionLabel ?? '').toLowerCase().includes(safeSearch)
        || String(log.actionCode ?? '').toLowerCase().includes(safeSearch)
        || String(log.targetLabel ?? '').toLowerCase().includes(safeSearch)
        || String(log.targetType ?? '').toLowerCase().includes(safeSearch)
        || String(log.reasonNote ?? '').toLowerCase().includes(safeSearch)
        || String(log.reasonCode ?? '').toLowerCase().includes(safeSearch)
        || String(log.ipAddress ?? '').toLowerCase().includes(safeSearch);

      const matchesTarget = selectedTargetType ? log.targetType === selectedTargetType : true;
      const matchesAction = selectedActionCode ? log.actionCode === selectedActionCode : true;

      return matchesSearch && matchesTarget && matchesAction;
    });
  }, [logs, safeSearch, selectedActionCode, selectedTargetType]);

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  const sortedLogs = useMemo(() => {
    return [...filteredLogs].sort((a, b) => {
      let aVal = a[sortKey];
      let bVal = b[sortKey];

      if (sortKey === 'timestamp') {
        aVal = a.timestamp ? new Date(a.timestamp).getTime() : 0;
        bVal = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      } else if (sortKey === 'actor') {
        aVal = (a.actorName || a.actorUsername || '').toLowerCase();
        bVal = (b.actorName || b.actorUsername || '').toLowerCase();
      } else if (sortKey === 'action') {
        aVal = (a.actionLabel || a.actionCode || '').toLowerCase();
        bVal = (b.actionLabel || b.actionCode || '').toLowerCase();
      } else if (sortKey === 'target') {
        aVal = (a.targetLabel || a.targetType || '').toLowerCase();
        bVal = (b.targetLabel || b.targetType || '').toLowerCase();
      } else if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = (bVal || '').toLowerCase();
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredLogs, sortKey, sortDirection]);

  const totalPages = Math.max(1, Math.ceil(sortedLogs.length / ITEMS_PER_PAGE));
  const currentRows = sortedLogs.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const exportRows = useMemo(() => {
    return [
      ['Date & Time', 'Actor', 'Username', 'Action', 'Target', 'Reason Code', 'Reason Note', 'IP Address', 'User Agent'],
      ...sortedLogs.map((log) => [
        `"${formatDateLabel(log.timestamp)}"`,
        `"${log.actorName}"`,
        `"${log.actorUsername}"`,
        `"${log.actionLabel}"`,
        `"${log.targetLabel}"`,
        `"${log.reasonCode}"`,
        `"${log.reasonNote}"`,
        `"${log.ipAddress}"`,
        `"${log.userAgent}"`
      ])
    ];
  }, [sortedLogs]);

  const handleExport = () => {
    exportToCSV(exportRows, 'audit_logs.csv');
  };

  const refreshAuditLogs = async () => {
    try {
      const response = await loadAdminAuditLogs({
        selectedDate,
        limit: 250
      });
      setAuditResponse(response || EMPTY_AUDIT);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load audit logs.');
    }
  };

  const latestActivityLabel = overview.summary.latestAt ? formatDateLabel(overview.summary.latestAt) : 'No activity yet';

  return (
    <div className="flex-1 overflow-x-hidden overflow-y-auto bg-[#F9FAFB]">
      <div className="px-6 py-5 lg:px-8 lg:py-6 w-full h-full flex flex-col gap-4">
        {/* Header */}
        <div className="shrink-0 flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <h1 className="text-[1.55rem] leading-tight font-bold text-gray-900">Audit Logs</h1>
              <InfoTooltip
                title="System Audit Trail"
                content="Immutable chronological record of administrative actions, role modifications, credential updates, and critical store settings."
              />
            </div>
            <p className="text-sm text-gray-500">Live admin activity history from the audit table.</p>
            <p className="text-xs text-gray-400">
              {loading
                ? 'Refreshing live audit data...'
                : error
                  ? `Showing last successful data. ${error}`
                  : `Last updated ${latestActivityLabel}`}
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => void refreshAuditLogs()}
              className="flex items-center gap-1.5 px-4 py-2 bg-white border border-gray-200/80 text-gray-700 text-sm font-semibold rounded-xl hover:bg-gray-50 transition-colors cursor-pointer shadow-2xs hover:shadow-xs"
            >
              <RefreshCw size={16} /> Refresh
            </button>
          </div>
        </div>

        {/* Table Container */}
        <div className="bg-white rounded-2xl border border-gray-200/80 overflow-hidden shadow-2xs flex flex-col flex-1 min-h-[520px]">
          <div className="px-5 py-4 border-b border-gray-100 flex flex-col xl:flex-row justify-between gap-3 shrink-0">
            <div className="relative w-full xl:w-96">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={17} />
              <input
                type="text"
                placeholder="Search actor, action, target, note, or IP..."
                value={searchTerm}
                onChange={(event) => {
                  setSearchTerm(event.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-10 pr-4 py-2 bg-gray-50/50 border border-gray-200/80 rounded-xl focus:outline-hidden focus:bg-white focus:ring-2 focus:ring-[#1F3A34] text-sm text-gray-800 transition-all placeholder:text-gray-400"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2.5 w-full xl:w-auto">
              <div className="relative">
                <select
                  value={selectedTargetType}
                  onChange={(event) => {
                    setSelectedTargetType(event.target.value);
                    setCurrentPage(1);
                  }}
                  className="peer appearance-none pl-4 pr-10 py-2 border border-gray-200/80 rounded-xl text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-hidden focus:ring-2 focus:ring-[#1F3A34] cursor-pointer min-w-[160px] shadow-2xs"
                >
                  <option value="">All Targets</option>
                  {uniqueTargetTypes.map((targetType) => (
                    <option key={targetType} value={targetType}>
                      {targetType}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none transition-transform duration-200 peer-focus:-rotate-180" size={16} />
              </div>

              <div className="relative">
                <select
                  value={selectedActionCode}
                  onChange={(event) => {
                    setSelectedActionCode(event.target.value);
                    setCurrentPage(1);
                  }}
                  className="peer appearance-none pl-4 pr-10 py-2 border border-gray-200/80 rounded-xl text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-hidden focus:ring-2 focus:ring-[#1F3A34] cursor-pointer min-w-[160px] shadow-2xs"
                >
                  <option value="">All Actions</option>
                  {uniqueActions.map((actionCode) => (
                    <option key={actionCode} value={actionCode}>
                      {actionCode}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none transition-transform duration-200 peer-focus:-rotate-180" size={16} />
              </div>

              <div className="relative">
                <DatePicker
                  portalId="root-portal"
                  popperPlacement="bottom-end"
                  selected={selectedDate}
                  onChange={(date) => {
                    setSelectedDate(date);
                    setCurrentPage(1);
                  }}
                  dateFormat="d MMM yyyy"
                  customInput={(
                    <div className="relative">
                      <button className="peer pl-4 pr-10 py-2 border border-gray-200/80 rounded-xl text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 text-left min-w-[160px] cursor-pointer shadow-2xs">
                        {selectedDate ? selectedDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Select Date'}
                      </button>
                      <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                        <ChevronDown size={16} className="text-gray-400 transition-transform duration-200 peer-focus:-rotate-180" />
                      </div>
                      {selectedDate && (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            setSelectedDate(null);
                            setCurrentPage(1);
                          }}
                          className="absolute inset-y-0 right-8 flex items-center p-1 hover:bg-gray-100 rounded-full my-auto h-6 w-6 justify-center cursor-pointer pointer-events-auto"
                        >
                          <X size={14} className="text-gray-500" />
                        </button>
                      )}
                    </div>
                  )}
                />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-gray-50 sticky top-0 z-10">
                <tr>
                  <SortableHeader
                    label="Date & Time"
                    sortKey="timestamp"
                    currentKey={sortKey}
                    direction={sortDirection}
                    onSort={handleSort}
                    tooltip="Timestamp when the administrative action occurred"
                  />
                  <SortableHeader
                    label="Actor"
                    sortKey="actor"
                    currentKey={sortKey}
                    direction={sortDirection}
                    onSort={handleSort}
                    tooltip="Admin or system agent performing the operation"
                  />
                  <SortableHeader
                    label="Action"
                    sortKey="action"
                    currentKey={sortKey}
                    direction={sortDirection}
                    onSort={handleSort}
                    tooltip="Category or specific mutation executed"
                  />
                  <SortableHeader
                    label="Target"
                    sortKey="target"
                    currentKey={sortKey}
                    direction={sortDirection}
                    onSort={handleSort}
                    tooltip="Resource or entity impacted by the action"
                  />
                  <th className="px-6 py-3 font-semibold text-[13px] text-gray-900 border-b border-gray-100 leading-tight">
                    <div className="flex items-center gap-1.5">
                      <span>Reason / Notes</span>
                      <InfoTooltip content="Audit notes, reason codes, or metadata provided for this action" title="Reason & Notes" />
                    </div>
                  </th>
                  <SortableHeader
                    label="IP Address"
                    sortKey="ipAddress"
                    currentKey={sortKey}
                    direction={sortDirection}
                    onSort={handleSort}
                    tooltip="Source IP address or originating host"
                  />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {currentRows.length > 0 ? currentRows.map((log) => {
                  const timestamp = log.timestamp || null;
                  const dateTime = formatDisplayDateTime(timestamp);
                  const reasonText = log.reasonNote || log.reasonCode || '';

                  return (
                    <tr key={log.id} className="hover:bg-gray-50/80 transition-colors">
                      <td className="px-6 py-4">
                        <p className="text-gray-900 font-medium">{dateTime.date}</p>
                        <p className="text-gray-500 text-xs mt-0.5">{dateTime.time}</p>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-[#1F3A34] text-white flex items-center justify-center shrink-0 shadow-2xs">
                            <span className="text-xs font-bold">
                              {(log.actorUsername || 'SY').substring(0, 2).toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <p className="text-gray-900 font-bold leading-tight">{log.actorName}</p>
                            <p className="text-gray-500 text-xs leading-tight mt-0.5">{log.actorUsername}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-gray-700">
                        <span className="inline-flex items-center rounded-lg bg-gray-100 px-2 py-1 text-xs font-medium text-gray-800">
                          {log.actionLabel}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-700">
                        <div>
                          <p className="font-medium text-gray-900">{log.targetLabel}</p>
                          {log.targetType && (
                            <p className="text-xs text-gray-500 mt-0.5">{log.targetType}</p>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-gray-700 max-w-[320px] truncate" title={reasonText}>
                        {reasonText || '-'}
                      </td>
                      <td className="px-6 py-4 text-gray-700 font-mono text-xs">{log.ipAddress || '-'}</td>
                    </tr>
                  );
                }) : (
                  <tr>
                    <td colSpan="6" className="px-6 py-10 text-center text-gray-500">
                      {loading ? 'Loading audit logs...' : 'No audit logs recorded yet.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between gap-4 shrink-0">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              setCurrentPage={setCurrentPage}
              itemsPerPage={ITEMS_PER_PAGE}
              totalItems={sortedLogs.length}
              itemName="audit logs"
            />
            <button
              type="button"
              onClick={handleExport}
              className="flex items-center gap-1.5 px-4 py-2 bg-white border border-gray-200/80 text-gray-700 text-sm font-semibold rounded-xl hover:bg-gray-50 transition-colors cursor-pointer shadow-2xs hover:shadow-xs"
            >
              <Download size={16} /> Export
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuditLogs;
