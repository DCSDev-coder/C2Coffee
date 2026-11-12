import React from 'react';

const Pagination = ({
  currentPage,
  totalPages,
  setCurrentPage,
  itemsPerPage,
  totalItems,
  itemName = "items",
  showAll = false,
  onToggleShowAll,
  action,
  rowsPerPageSelect
}) => {
  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  // Calculate which page numbers to show (max 5)
  let startPage = Math.max(1, currentPage - 2);
  let endPage = Math.min(totalPages, startPage + 4);
  if (endPage - startPage < 4) {
    startPage = Math.max(1, endPage - 4);
  }

  const pages = [];
  for (let i = startPage; i <= endPage; i++) {
    pages.push(i);
  }

  const showPaginationControls = !showAll && totalPages > 1;

  return (
    <div className="w-full flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 text-xs font-semibold text-gray-500">
      {/* Mobile Top Row / Desktop Left Side: Showing count + See more + Rows per page */}
      <div className="flex items-center justify-between sm:justify-start gap-2.5 sm:gap-3 w-full sm:w-auto">
        {rowsPerPageSelect && (
          <div className="hidden sm:flex items-center shrink-0">
            {rowsPerPageSelect}
          </div>
        )}
        <span className="text-gray-600 font-medium whitespace-nowrap">
          Showing {showAll ? `1 to ${totalItems}` : `${startItem} to ${endItem}`} of {totalItems} {itemName}
        </span>
        {onToggleShowAll && totalItems > itemsPerPage && (
          <button
            type="button"
            onClick={onToggleShowAll}
            className="inline-flex md:hidden items-center gap-1 text-[11px] font-bold text-[#1F3A34] hover:text-[#2E5E58] px-2.5 py-1 rounded-lg bg-[#1F3A34]/10 hover:bg-[#1F3A34]/15 transition-colors cursor-pointer border border-[#1F3A34]/20 shrink-0"
          >
            {showAll ? `Show ${itemsPerPage}` : `See more (${totalItems - itemsPerPage})`}
          </button>
        )}
      </div>

      {/* Mobile Bottom Row / Desktop Right Side: Page buttons + Action (Export) */}
      {(showPaginationControls || action) && (
        <div className="flex items-center justify-between sm:justify-end gap-2.5 sm:gap-3 w-full sm:w-auto">
          {showPaginationControls ? (
            <div className="flex items-center space-x-1 sm:space-x-1.5 font-bold text-gray-800">
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center text-gray-500 hover:text-gray-900 hover:bg-gray-100 disabled:opacity-20 disabled:pointer-events-none transition-colors cursor-pointer"
                aria-label="Previous page"
              >
                ←
              </button>
              {pages.map((page) => (
                <button
                  key={page}
                  type="button"
                  onClick={() => setCurrentPage(page)}
                  className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center text-xs font-bold transition-all cursor-pointer ${
                    currentPage === page
                      ? 'bg-[#1F3A34] text-white shadow-xs'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {page}
                </button>
              ))}
              <button
                type="button"
                disabled={currentPage === totalPages || totalPages === 0}
                onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center text-gray-500 hover:text-gray-900 hover:bg-gray-100 disabled:opacity-20 disabled:pointer-events-none transition-colors cursor-pointer"
                aria-label="Next page"
              >
                →
              </button>
            </div>
          ) : (
            <div />
          )}

          {action && (
            <div className="shrink-0">
              {action}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Pagination;
