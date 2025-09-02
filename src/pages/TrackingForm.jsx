// TrackingForm.jsx
import React, { useState } from 'react';

function TrackingForm(props) {
  // 1. Your existing state and submit handler should already exist; keep them intact
  const { formData, setFormData, existingSubmitHandler } = props;

  // 2. New state for search feature
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);

  // 3. New: Handle lookup/search
  const handleSearch = async (e) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (!q) return;
    try {
      const res = await fetch(`/tracking/search?query=${encodeURIComponent(q)}`);
      if (res.ok) {
        const json = await res.json();
        setSearchResults(json.results);
      }
    } catch (err) {
      console.error('Search error:', err);
    }
  };

  // 4. New: On selecting a result, populate form fields (and preserve the rest)
  const selectResult = (item) => {
    setFormData(prev => ({
      ...prev,
      offerId: item.offerId,
      buyer_name: item.buyer_name,
      unit_number: item.unit_number,
      status: item.status,
      // other form fields remain unchanged
    }));
    setSearchResults([]);
  };

  return (
    <div>
      {/* NEW: Search bar, inserted above your existing form */}
      <form onSubmit={handleSearch} style={{ marginBottom: '1rem' }}>
        <input
          type="text"
          placeholder="Search by buyer or unit"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />
        <button type="submit">Lookup</button>
      </form>

      {/* NEW: Search results shown below the search bar */}
      {searchResults.length > 0 && (
        <ul style={{ padding: 0, listStyle: 'none', marginBottom: '1rem' }}>
          {searchResults.map(item => (
            <li
              key={item.offerId}
              onClick={() => selectResult(item)}
              style={{ cursor: 'pointer', padding: '0.5rem 0' }}
            >
              <strong>{item.offerId}</strong> — {item.buyer_name} — {item.unit_number}
            </li>
          ))}
        </ul>
      )}

      {/* YOUR EXISTING FORM BELOW (unchanged): */}
      <form onSubmit={existingSubmitHandler}>
        {/* Preserve all current inputs bound to formData */}
        <button type="submit">Save Tracking Updates</button>
      </form>
    </div>
  );
}

export default TrackingForm;

