import React from 'react';

const Pagination = ({
  currentPage,
  totalPages,
  setCurrentPage,
  itemsPerPage,
  totalItems,
  itemName = "items",
  showAll = false,
  onToggleShowAll
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

  return (
    <div className="flex flex-col sm:flex-row justify-between items-center gap-2 text-[11px] sm:text-xs font-semibold text-gray-500 w-full">
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        <span>Showing {showAll ? `1 to ${totalItems}` : `${startItem} to ${endItem}`} of {totalItems} {itemName}</span>
        {onToggleShowAll && totalItems > itemsPerPage && (
          <button
            type="button"
            onClick={onToggleShowAll}
            className="inline-flex md:hidden items-center gap-1 text-[11px] font-bold text-[#2E5E58] hover:text-[#1F3A34] px-2 py-0.5 rounded-md hover:bg-[#2E5E58]/10 transition-colors cursor-pointer border border-[#2E5E58]/20"
          >
            {showAll ? `Show ${itemsPerPage} per page` : `See more (${totalItems - itemsPerPage} remaining)`}
          </button>
        )}
      </div>
      {!showAll && (
        <div className="flex space-x-2 sm:space-x-4 items-center font-bold text-[#1F2937]">
          <span
            className={`cursor-pointer flex items-center justify-center ${currentPage === 1 ? 'opacity-40 pointer-events-none text-gray-400' : 'text-gray-500 hover:text-gray-800 transition-colors'}`}
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
          >←</span>
          
          {pages.map((page) => (
            <span
              key={page}
              onClick={() => setCurrentPage(page)}
              className={`cursor-pointer flex items-center justify-center transition-colors ${
                currentPage === page 
                  ? 'w-8 h-8 rounded-xl bg-[#2E5E58] text-white' 
                  : 'hover:text-gray-500'
              }`}
            >
              {page}
            </span>
          ))}
          
          <span
            className={`cursor-pointer px-3 h-8 flex items-center justify-center rounded-xl bg-gray-50 ${currentPage === totalPages || totalPages === 0 ? 'opacity-40 pointer-events-none text-gray-400' : 'text-gray-500 hover:bg-gray-100 transition-colors'}`}
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
          >→</span>
        </div>
      )}
    </div>
  );
};

export default Pagination;
