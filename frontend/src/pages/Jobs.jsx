import Card from '../components/ui/Card';
import Button from '../components/ui/Button';

const Jobs = () => {
  return (
    <div className="page">
      <div className="page-header">
        <h1>Jobs & opportunities</h1>
        <p className="text-secondary">This page is under development and will be available soon.</p>
      </div>

      <Card className="elevated">
        <h3>Coming soon</h3>
        <p className="text-secondary">
          We’re building a richer jobs experience. You’ll be able to browse roles from alumni and companies, and apply directly here.
        </p>
        <Button variant="primary" disabled className="mt-4">Stay tuned</Button>
      </Card>
    </div>
  );
};

export default Jobs;

