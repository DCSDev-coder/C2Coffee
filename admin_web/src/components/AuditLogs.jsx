import React, { useEffect, useMemo, useState } from 'react';
import {
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

const AuditLogs = () => {
  const [auditResponse, setAuditResponse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTargetType, setSelectedTargetType] = useState('');
  const [selectedActionCode, setSelectedActionCode] = useState('');
  const [selectedDate, setSelectedDate] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);

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
  const logs = Array.isArray(overview.logs) ? overview.logs : [];

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

  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / ITEMS_PER_PAGE));
  const currentRows = filteredLogs.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const exportRows = useMemo(() => {
    return [
      ['Date & Time', 'Actor', 'Username', 'Action', 'Target', 'Reason Code', 'Reason Note', 'IP Address', 'User Agent'],
      ...filteredLogs.map((log) => [
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
  }, [filteredLogs]);

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
        <div className="shrink-0 flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
          <div className="space-y-0.5">
            <h1 className="text-[1.55rem] leading-tight font-bold text-gray-900">Audit Logs</h1>
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
              className="flex items-center gap-1.5 px-4 py-2 bg-white border border-gray-300 text-gray-700 text-sm font-semibold rounded-lg hover:bg-gray-50 transition-colors cursor-pointer shadow-sm"
            >
              <RefreshCw size={16} /> Refresh
            </button>
            <button
              type="button"
              onClick={handleExport}
              className="flex items-center gap-1.5 px-4 py-2 bg-white border border-gray-300 text-gray-700 text-sm font-semibold rounded-lg hover:bg-gray-50 transition-colors cursor-pointer shadow-sm"
            >
              <Download size={16} /> Export
            </button>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm flex flex-col flex-1 min-h-[520px]">
          <div className="px-5 py-4 border-b border-gray-100 flex flex-col xl:flex-row justify-between gap-3 shrink-0">
            <div className="relative w-full xl:w-96">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                placeholder="Search actor, action, target, note, or IP..."
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
                  value={selectedTargetType}
                  onChange={(event) => {
                    setSelectedTargetType(event.target.value);
                    setCurrentPage(1);
                  }}
                  className="peer appearance-none pl-4 pr-10 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none cursor-pointer min-w-[160px]"
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
                  className="peer appearance-none pl-4 pr-10 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none cursor-pointer min-w-[160px]"
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
                      <button className="peer pl-4 pr-10 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 text-left min-w-[160px] cursor-pointer">
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
                  <th className="px-6 py-3 font-semibold text-[13px] text-gray-900 border-b border-gray-100 leading-tight">Date & Time</th>
                  <th className="px-6 py-3 font-semibold text-[13px] text-gray-900 border-b border-gray-100 leading-tight">Actor</th>
                  <th className="px-6 py-3 font-semibold text-[13px] text-gray-900 border-b border-gray-100 leading-tight">Action</th>
                  <th className="px-6 py-3 font-semibold text-[13px] text-gray-900 border-b border-gray-100 leading-tight">Target</th>
                  <th className="px-6 py-3 font-semibold text-[13px] text-gray-900 border-b border-gray-100 leading-tight">Reason / Notes</th>
                  <th className="px-6 py-3 font-semibold text-[13px] text-gray-900 border-b border-gray-100 leading-tight">IP Address</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {currentRows.length > 0 ? currentRows.map((log) => {
                  const timestamp = log.timestamp || null;
                  const dateTime = formatDisplayDateTime(timestamp);
                  const reasonText = log.reasonNote || log.reasonCode || '';

                  return (
                    <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <p className="text-gray-900 font-medium">{dateTime.date}</p>
                        <p className="text-gray-500 text-xs mt-0.5">{dateTime.time}</p>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-[#1F3A34] text-white flex items-center justify-center shrink-0">
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
                      <td className="px-6 py-4 text-gray-700">{log.actionLabel}</td>
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
                      <td className="px-6 py-4 text-gray-700">{log.ipAddress || '-'}</td>
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

          <div className="px-6 py-4 border-t border-gray-100 flex shrink-0">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              setCurrentPage={setCurrentPage}
              itemsPerPage={ITEMS_PER_PAGE}
              totalItems={filteredLogs.length}
              itemName="audit logs"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuditLogs;
