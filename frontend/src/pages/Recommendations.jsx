import Card from '../components/ui/Card';

const Recommendations = () => {
  return (
    <div className="page">
      <div className="page-header">
        <h1>Recommendations</h1>
        <p>Suggestions tailored for you.</p>
      </div>
      <div className="grid-vertical">
        <Card>
          <p className="text-secondary">No recommendations available yet. They will load once provided by the backend.</p>
        </Card>
      </div>
    </div>
  );
};

export default Recommendations;

