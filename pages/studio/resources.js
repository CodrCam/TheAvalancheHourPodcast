import { useEffect, useState } from 'react';
import StudioLayout from '../../components/StudioLayout';
import ResourceModeSwitch from '../../components/ResourceModeSwitch';
import StudioResourceLibrary from '../../components/StudioResourceLibrary';

export default function StudioResourcesPage() {
  const [guide, setGuide] = useState(null);
  const [updatedAt, setUpdatedAt] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [canEdit, setCanEdit] = useState(false);

  useEffect(() => {
    let alive = true;

    async function loadResources() {
      setLoading(true);
      setError('');
      try {
        const response = await fetch('/api/studio/resources', {
          credentials: 'same-origin',
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || 'Could not load the Host Guide.');
        }
        if (!alive) return;
        setGuide(data.guide || null);
        setUpdatedAt(data.updated_at || '');
        setCanEdit(data.canEdit === true);
      } catch (err) {
        if (alive) setError(err.message || 'Could not load the Host Guide.');
      } finally {
        if (alive) setLoading(false);
      }
    }

    loadResources();
    return () => {
      alive = false;
    };
  }, []);

  return (
    <StudioLayout>
      <StudioResourceLibrary
        guide={guide}
        updatedAt={updatedAt}
        loading={loading}
        error={error}
        headerActions={
          <ResourceModeSwitch activeMode="view" canEdit={canEdit} />
        }
      />
    </StudioLayout>
  );
}
