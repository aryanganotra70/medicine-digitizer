'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ProjectsPage() {
  const [projects, setProjects] = useState<any[]>([]);
  const [user, setUser] = useState<any>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const router = useRouter();

  useEffect(() => {
    fetchUser();
    fetchProjects();
  }, []);

  const fetchUser = async () => {
    const res = await fetch('/api/auth/me');
    if (!res.ok) {
      router.push('/login');
      return;
    }
    const data = await res.json();
    setUser(data.user);
  };

  const fetchProjects = async () => {
    const res = await fetch('/api/projects');
    const data = await res.json();
    setProjects(data.projects || []);
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  };

  const resetStuckEntries = async () => {
    if (!confirm('Reset all IN_PROGRESS entries back to PENDING? This will also clear all Redis locks.')) {
      return;
    }

    try {
      // Clear Redis locks
      await fetch('/api/admin/clear-locks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      // Reset database entries
      const res = await fetch('/api/admin/reset-entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      const data = await res.json();
      alert(data.message);
      fetchProjects();
    } catch (error) {
      alert('Failed to reset entries');
    }
  };

  return (
    <div className="projects-page">
      <header className="page-header">
        <h1>Projects</h1>
        <div className="header-actions">
          <span>Welcome, {user?.username}</span>
          {user?.role === 'ADMIN' && (
            <>
              <button onClick={() => router.push('/admin/users')}>Manage Users</button>
              <button onClick={() => router.push('/admin/locks')}>View Locks</button>
              <button onClick={resetStuckEntries}>Reset Stuck Entries</button>
              <button onClick={() => setShowCreateModal(true)}>Create Project</button>
            </>
          )}
          <button onClick={handleLogout}>Logout</button>
        </div>
      </header>

      <div className="projects-grid">
        {projects.map((project) => (
          <div key={project.id} className="project-card">
            <h3>{project.name}</h3>
            <div className="project-stats">
              <div className="stat">
                <span className="stat-label">Total:</span>
                <span className="stat-value">{project.stats.total}</span>
              </div>
              <div className="stat completed">
                <span className="stat-label">Completed:</span>
                <span className="stat-value">{project.stats.completed}</span>
              </div>
              <div className="stat pending">
                <span className="stat-label">Pending:</span>
                <span className="stat-value">{project.stats.pending}</span>
              </div>
              <div className="stat skipped">
                <span className="stat-label">Skipped:</span>
                <span className="stat-value">{project.stats.skipped}</span>
              </div>
              <div className="stat failed">
                <span className="stat-label">Failed:</span>
                <span className="stat-value">{project.stats.failed}</span>
              </div>
            </div>
            <div className="project-actions">
              <button onClick={() => router.push(`/digitize/${project.id}`)}>
                Start Digitizing
              </button>
              {user?.role === 'ADMIN' && (
                <button onClick={() => router.push(`/admin/projects/${project.id}`)}>
                  Admin View
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {showCreateModal && (
        <CreateProjectModal
          onClose={() => setShowCreateModal(false)}
          onCreated={() => {
            setShowCreateModal(false);
            fetchProjects();
          }}
        />
      )}
    </div>
  );
}

function CreateProjectModal({ onClose, onCreated }: any) {
  const [name, setName] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !file) return;

    setLoading(true);
    const formData = new FormData();
    formData.append('name', name);
    formData.append('file', file);

    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        onCreated();
      }
    } catch (error) {
      alert('Failed to create project');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h2>Create New Project</h2>
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            placeholder="Project Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <input
            type="file"
            accept=".csv"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            required
          />
          <div className="modal-actions">
            <button type="button" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" disabled={loading}>
              {loading ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
