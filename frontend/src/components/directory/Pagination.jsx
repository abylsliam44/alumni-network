import Icon from '../ui/Icon';

const Pagination = ({ currentPage, totalPages, onPageChange }) => {
  if (totalPages <= 1) return null;

  const getVisiblePages = () => {
    const pages = [];
    const maxVisible = 5;
    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i += 1) pages.push(i);
    } else if (currentPage <= 3) {
      pages.push(1, 2, 3, 4, '…', totalPages);
    } else if (currentPage >= totalPages - 2) {
      pages.push(1, '…', totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
    } else {
      pages.push(1, '…', currentPage - 1, currentPage, currentPage + 1, '…', totalPages);
    }
    return pages;
  };

  return (
    <nav style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6, marginTop: 24 }}>
      <button className="btn sm" onClick={() => onPageChange(currentPage - 1)} disabled={currentPage === 1}>
        <Icon name="chevronL" size={12} /> Prev
      </button>
      <div style={{ display: 'flex', gap: 4 }}>
        {getVisiblePages().map((page, idx) => (
          page === '…' ? (
            <span key={`e${idx}`} className="mute mono" style={{ padding: '5px 8px', fontSize: 11 }}>…</span>
          ) : (
            <button
              key={page}
              onClick={() => onPageChange(page)}
              className={`btn sm${currentPage === page ? ' primary' : ' ghost'}`}
              style={{ minWidth: 32, padding: '5px 10px' }}
            >
              {page}
            </button>
          )
        ))}
      </div>
      <button className="btn sm" onClick={() => onPageChange(currentPage + 1)} disabled={currentPage === totalPages}>
        Next <Icon name="chevronR" size={12} />
      </button>
    </nav>
  );
};

export default Pagination;
