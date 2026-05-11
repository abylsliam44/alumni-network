import Icon from '../components/ui/Icon';

const Feed = () => (
  <div className="page">
    <div className="page-head">
      <div>
        <div className="eyebrow" style={{ marginBottom: 10 }}>FEED · COMING SOON</div>
        <h1 className="h1">Latest from your <i>network</i>.</h1>
      </div>
    </div>
    <div className="empty-block">
      <Icon name="msg" size={28} />
      <h3>No posts yet</h3>
      <p>Posts and updates from your network will appear here once the feed is live.</p>
    </div>
  </div>
);

export default Feed;
