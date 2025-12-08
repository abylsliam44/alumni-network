import Card from '../components/ui/Card';

const Feed = () => {
  return (
    <div className="page">
      <div className="page-header">
        <h1>Feed</h1>
        <p>Latest updates from the community.</p>
      </div>
      <div className="grid-vertical">
        <Card>
          <p className="text-secondary">No posts yet. Posts will appear here once published from the backend.</p>
        </Card>
      </div>
    </div>
  );
};

export default Feed;

