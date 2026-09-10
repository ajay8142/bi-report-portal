import { useState } from 'react';
import api from '../../api/axiosInstance';
import { useLanguage } from '../../context/LanguageContext';
import './SearchReports.css';

const splitItems = (value) =>
  (value || '')
    .split(/\r?\n|,/)
    .map((s) => s.trim())
    .filter(Boolean);

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="2" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function ClearIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <line x1="5" y1="5" x2="19" y2="19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="19" y1="5" x2="5" y2="19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function ChipList({ items }) {
  if (items.length === 0) return <span className="rf-field-empty">-</span>;
  return (
    <div className="rf-chips">
      {items.map((item, i) => (
        <span className="rf-chip" key={i}>{item}</span>
      ))}
    </div>
  );
}

function ResultSkeleton() {
  return (
    <ul className="rf-results">
      {[0, 1, 2].map((i) => (
        <li className="rf-result-card rf-skeleton" key={i}>
          <div className="rf-skeleton-line wide" />
          <div className="rf-skeleton-line narrow" />
        </li>
      ))}
    </ul>
  );
}

export default function SearchReports() {
  const { t } = useLanguage();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [metadata, setMetadata] = useState(null);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState(null);

  const runSearch = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setError(null);
    setSelectedId(null);
    setMetadata(null);
    setHasSearched(true);

    try {
      const res = await api.get('/admin/report-search', { params: { q: query, top_k: 5 } });
      setResults(res.data.data);
    } catch (err) {
      setError(err.response?.data?.message || t('toast_search_failed'));
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const showReport = async (id) => {
    setSelectedId(id);
    setMetadata(null);
    try {
      const res = await api.get(`/admin/report-search/${encodeURIComponent(id)}`);
      setMetadata(res.data.data);
    } catch (err) {
      setError(err.response?.data?.message || t('toast_load_report_detail_failed'));
    }
  };

  return (
    <div className="rf-page">
      <div className="rf-app">
      <header className="rf-hero">
        <h1>{t('report_finder')}</h1>
        <p className="rf-tagline">{t('report_finder_tagline')}</p>
      </header>

      <form className="rf-search-bar" onSubmit={runSearch}>
        <span className="rf-search-icon"><SearchIcon /></span>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('rf_search_placeholder')}
          autoFocus
        />
        {query && (
          <button
            type="button"
            className="rf-clear-btn"
            onClick={() => setQuery('')}
            aria-label={t('rf_clear_search_aria')}
          >
            <ClearIcon />
          </button>
        )}
        <button type="submit" className="rf-submit-btn" disabled={loading}>
          {loading ? t('searching') : t('search')}
        </button>
      </form>

      {error && <p className="rf-error">{error}</p>}

      {!hasSearched && !error && (
        <p className="rf-hint">{t('report_finder_hint')}</p>
      )}

      {loading && <ResultSkeleton />}

      {!loading && hasSearched && (
        <div className="rf-content">
          <ul className="rf-results">
            {results.map((r) => (
              <li
                key={r.id}
                className={`rf-result-card${r.id === selectedId ? ' selected' : ''}`}
                onClick={() => showReport(r.id)}
              >
                <span className="rf-report-name">{r.reportName}</span>
                <span className="rf-module-badge">{r.module}</span>
              </li>
            ))}
            {results.length === 0 && !error && (
              <li className="rf-result-card empty">{t('rf_no_match')}</li>
            )}
          </ul>

          {selectedId && (
            <div className="rf-details">
              <button
                type="button"
                className="rf-close-btn"
                onClick={() => setSelectedId(null)}
                aria-label={t('rf_close_details_aria')}
              >
                <ClearIcon />
              </button>
              {!metadata ? (
                <p>{t('loading')}</p>
              ) : (
                <>
                  <h2>{metadata['Report Name']}</h2>
                  <span className="rf-module-badge">{metadata['Module']}</span>

                  <p className="rf-description">{metadata['Description']}</p>

                  <div className="rf-field">
                    <div className="rf-field-label">{t('field_tables')}</div>
                    <ChipList items={splitItems(metadata['Tables'])} />
                  </div>
                  <div className="rf-field">
                    <div className="rf-field-label">{t('field_columns')}</div>
                    <ChipList items={splitItems(metadata['Columns'])} />
                  </div>
                  <div className="rf-field">
                    <div className="rf-field-label">{t('parameters')}</div>
                    <ChipList items={splitItems(metadata['Parameters'])} />
                  </div>

                  {metadata['Sql Queries'] && (
                    <details className="rf-sql-block">
                      <summary>{t('view_sql')}</summary>
                      <pre><code>{metadata['Sql Queries']}</code></pre>
                    </details>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}
      </div>
    </div>
  );
}
