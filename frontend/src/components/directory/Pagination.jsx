import Button from '../ui/Button';

const Pagination = ({ currentPage, totalPages, onPageChange }) => {
  if (totalPages <= 1) return null;

  const pages = [];
  for (let i = 1; i <= totalPages; i++) {
    pages.push(i);
  }

  // Simple pagination logic for MVP (show all pages or limited window)
  // For MVP, if pages > 10, we might want to truncate, but let's keep it simple

  return (
    <div className="pagination-container">
      <Button
        variant="secondary"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        size="sm"
      >
        Previous
      </Button>

      <div className="pagination-numbers">
        {pages.map(page => (
          <button
            key={page}
            onClick={() => onPageChange(page)}
            className={`pagination-number ${currentPage === page ? 'active' : ''}`}
          >
            {page}
          </button>
        ))}
      </div>

      <Button
        variant="secondary"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        size="sm"
      >
        Next
      </Button>
    </div>
  );
};

export default Pagination;
