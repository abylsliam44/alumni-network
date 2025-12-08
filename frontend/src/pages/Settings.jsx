import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { useAuth } from '../hooks/useAuth';

const Settings = () => {
  const { user, logout } = useAuth();

  return (
    <div className="page">
      <div className="page-header">
        <h1>Settings</h1>
        <p>Manage account and preferences.</p>
      </div>
      <Card>
        <h3>Account</h3>
        <p className="text-secondary">Signed in as {user?.email}</p>
        <Button variant="secondary" onClick={logout}>Sign out</Button>
      </Card>
    </div>
  );
};

export default Settings;

