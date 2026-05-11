const systemRoles = (user) => (Array.isArray(user?.system_roles) ? user.system_roles : []);

export const hasSystemRole = (user, role) => systemRoles(user).includes(role);

export const canPostJobs = (user) =>
  Boolean(
    user?.is_admin ||
    user?.role === 'ALUMNI' ||
    user?.role === 'HR' ||
    hasSystemRole(user, 'JOB_POSTER') ||
    hasSystemRole(user, 'HR')
  );

export const canModerateJobs = (user) =>
  Boolean(user?.is_admin || user?.role === 'STAFF' || hasSystemRole(user, 'JOB_MODERATOR'));
