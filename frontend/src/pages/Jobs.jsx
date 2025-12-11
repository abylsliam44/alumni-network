import Card from '../components/ui/Card';
import Button from '../components/ui/Button';

const Jobs = () => {
  return (
    <div className="page">
      <div className="page-header">
        <h1>Jobs & opportunities</h1>
        <p className="text-secondary">This page is in progress. Soon you’ll browse and apply to roles from alumni and partners.</p>
      </div>

      <Card className="elevated">
        <h3>Coming soon</h3>
        <p className="text-secondary">
          We’re building a richer jobs experience. You’ll be able to browse roles from alumni and companies, and apply directly here.
        </p>
      </Card>
    </div>
  );
};

export default Jobs;

