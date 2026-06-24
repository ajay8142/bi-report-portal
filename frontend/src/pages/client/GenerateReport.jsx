import { useState, useEffect } from 'react';
import api from '../../api/axiosInstance';
import toast from 'react-hot-toast';
import {
  TextField,
  MenuItem,
  Select,
  InputLabel,
  FormControl,
  Checkbox,
  ListItemText,
  OutlinedInput,
} from '@mui/material';

function toHTMLDateValue(value) {
  if (!value) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  if (/^\d{4}-\d{2}-\d{2}T/.test(value)) return value.split('T')[0];
  return '';
}

function ParamField({ param, value, onChange }) {
  const { name, label, dataType, UIType, multiValuesAllowed, lovLabels, values: lovValues, defaultValue, mandatory, useNullForAll } = param;

  const isLov = (UIType === 'menu' || UIType === 'check' || UIType === 'radio') && lovLabels?.length > 0;
  const isDate = dataType === 'date' || UIType === 'date';

  let indicator = '';
  if (mandatory) {
    indicator = ' *';
  } else if (useNullForAll && multiValuesAllowed) {
    indicator = ' (ALL)';
  }
  const displayLabel = `${label}${indicator}`;

  if (isLov && multiValuesAllowed) {
    const safeValue = Array.isArray(value) ? value : (value ? [value] : []);
    return (
      <FormControl fullWidth>
        <InputLabel shrink id={`${name}-label`}>{displayLabel}</InputLabel>
        <Select
          multiple
          labelId={`${name}-label`}
          value={safeValue}
          onChange={(e) => {
            const { target: { value } } = e;
            // When using `multiple`, the value can sometimes be a string on autofill.
            // We ensure it's always an array.
            let val = typeof value === 'string' ? value.split(',') : value;
            if (val.includes('*') && val.length > 1) {
              if (val[val.length - 1] === '*') {
                val = ['*'];
              } else {
                val = val.filter((v) => v !== '*');
              }
            }
            onChange(name, val);
          }}
          input={<OutlinedInput label={displayLabel} notched />}
          renderValue={(selected) => {
            return selected.map(val => {
              const idx = lovValues.findIndex(v => v === val);
              return idx >= 0 && lovLabels[idx] ? lovLabels[idx] : val;
            }).join(', ');
          }}
        >
          {lovLabels.map((lbl, i) => {
            const val = lovValues[i] || lbl;
            return (
              <MenuItem key={val} value={val}>
                <Checkbox checked={safeValue.indexOf(val) > -1} />
                <ListItemText primary={lbl} />
              </MenuItem>
            );
          })}
        </Select>
      </FormControl>
    );
  }

  if (isLov && !multiValuesAllowed) {
    return (
      <TextField
        select
        fullWidth
        label={displayLabel}
        value={value || ''}
        InputLabelProps={{ shrink: true }}
        onChange={(e) => onChange(name, e.target.value)}
      >
        <MenuItem value=""><em>-- Select --</em></MenuItem>
        {lovLabels.map((lbl, i) => (
          <MenuItem key={i} value={lovValues[i] || lbl}>{lbl}</MenuItem>
        ))}
      </TextField>
    );
  }

  if (isDate) {
    return (
      <FormControl fullWidth>
        <InputLabel shrink htmlFor={`date-${name}`}>{displayLabel}</InputLabel>
        <OutlinedInput
          id={`date-${name}`}
          type="date"
          label={displayLabel}
          notched
          inputProps={{ max: '9999-12-31' }}
          value={value || ''}
          onChange={(e) => {
            const val = e.target.value;
            if (val && val.split('-')[0]?.length > 4) return;
            onChange(name, val);
          }}
        />
      </FormControl>
    );
  }

  return (
    <TextField
      fullWidth
      type={dataType === 'integer' || dataType === 'float' ? 'number' : 'text'}
      label={displayLabel}
      placeholder={defaultValue || ''}
      InputLabelProps={{ shrink: true }}
      value={value || ''}
      onChange={(e) => onChange(name, e.target.value)}
    />
  );
}

const FORMATS = ['pdf', 'xlsx', 'html', 'csv', 'rtf', 'xml'];

export default function GenerateReport() {
  const [modules,      setModules]      = useState([]);
  const [activeModule, setActiveModule] = useState(null);
  const [reports,      setReports]      = useState([]);
  const [activeReport, setActiveReport] = useState(null);
  const [params,       setParams]       = useState([]);
  const [paramValues,  setParamValues]  = useState({});
  const [format,       setFormat]       = useState('pdf');
  const [action,       setAction]       = useState('preview');
  const [loading,      setLoading]      = useState(false);
  const [running,      setRunning]      = useState(false);

  useEffect(() => {
    setLoading(true);
    api.get('/client/modules')
      .then(r => setModules(r.data.data))
      .catch(() => toast.error('Failed to load modules'))
      .finally(() => setLoading(false));
  }, []);

  const loadReports = async (mod) => {
    setActiveModule(mod);
    setActiveReport(null);
    setParams([]);
    setParamValues({});
    setLoading(true);
    try {
      const res = await api.get('/client/modules/reports', { params: { path: mod.absolutePath } });
      setReports(res.data.data);
    } catch { toast.error('Failed to load reports'); }
    finally  { setLoading(false); }
  };

  const loadParams = async (report) => {
    setActiveReport(report);
    setParams([]);
    setParamValues({});
    setLoading(true);
    try {
      const res = await api.get('/client/reports/parameters', { params: { path: report.absolutePath } });
      const ps  = res.data.data || [];
      setParams(ps);
      const defaults = {};
      ps.forEach(p => {
        const isDate = p.dataType === 'date' || p.UIType === 'date';
        if (p.defaultValue) {
          if (isDate) {
            defaults[p.name] = toHTMLDateValue(p.defaultValue);
          } else {
            defaults[p.name] = p.multiValuesAllowed ? [p.defaultValue] : p.defaultValue;
          }
        } else if (p.multiValuesAllowed) {
          defaults[p.name] = [];
        } else {
          defaults[p.name] = '';
        }
      });
      setParamValues(defaults);
    } catch { toast.error('Failed to load parameters'); }
    finally  { setLoading(false); }
  };

  const handleParamChange = (name, val) => setParamValues(prev => ({ ...prev, [name]: val }));

  const runReport = async (action) => {
    setRunning(true);
    try {
      const paramPayload = params.map(p => ({
        name:               p.name,
        dataType:           p.dataType,
        UIType:             p.UIType,
        multiValuesAllowed: p.multiValuesAllowed,
        dateFormatString:   p.dateFormatString,
        useNullForAll:      p.useNullForAll,
        values: (() => {
          const value = paramValues[p.name];
          if (Array.isArray(value)) {
            return value.filter(v => v !== null && v !== undefined && v !== '');
          }
          return value ? [String(value)] : [];
        })(),
      }));

      const res = await api.post('/client/reports/run', {
        reportPath: activeReport.absolutePath,
        format,
        params: paramPayload,
        action,
      }, { responseType: 'blob' });

      const blob     = new Blob([res.data], { type: res.headers['content-type'] });
      const url      = URL.createObjectURL(blob);
      const filename = activeReport.displayName + '.' + format;

      if (action === 'preview') {
        window.open(url, '_blank');
      } else {
        const a    = document.createElement('a');
        a.href     = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
      }
      toast.success(`Report ${action === 'preview' ? 'opened' : 'downloaded'} successfully`);
    } catch { toast.error('Failed to run report. Check parameters and try again.'); }
    finally  { setRunning(false); }
  };

  return (
    <div style={s.page}>
      <h2 style={s.heading}>Generate Report</h2>

      {/* Breadcrumb */}
      <div style={s.breadcrumb}>
        <span
          style={activeModule ? s.crumbLink : s.crumbCurrent}
          onClick={() => { setActiveModule(null); setActiveReport(null); setReports([]); setParams([]); }}
        >
          📁 Modules
        </span>
        {activeModule && (
          <>
            <span style={s.sep}> › </span>
            <span
              style={activeReport ? s.crumbLink : s.crumbCurrent}
              onClick={() => { setActiveReport(null); setParams([]); }}
            >
              📂 {activeModule.displayName}
            </span>
          </>
        )}
        {activeReport && (
          <>
            <span style={s.sep}> › </span>
            <span style={s.crumbCurrent}>📄 {activeReport.displayName}</span>
          </>
        )}
      </div>

      {loading && <p style={s.loading}>Loading…</p>}

      {/* Modules Table */}
      {!activeModule && !loading && (
        <div style={s.tableWrap}>
          <table style={s.table}>
            <thead>
              <tr>
                <th style={{ ...s.th, ...s.thNum }}>S No.</th>
                <th style={s.th}>Module Name</th>
                <th style={s.th}>Path</th>
              </tr>
            </thead>
            <tbody>
              {modules.length === 0 ? (
                <tr><td colSpan={3} style={s.empty}>No modules assigned to you.</td></tr>
              ) : modules.map((mod, i) => (
                <tr
                  key={mod.absolutePath}
                  style={{ ...(i % 2 === 0 ? s.rowEven : s.rowOdd), cursor: 'pointer' }}
                  onClick={() => loadReports(mod)}
                  onMouseEnter={e => e.currentTarget.style.background = '#e3f2fd'}
                  onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? '#fff' : '#f9fafb'}
                >
                  <td style={{ ...s.td, ...s.tdNum }}>{i + 1}</td>
                  <td style={s.td}>📂 {mod.displayName}</td>
                  <td style={{ ...s.td, color: '#888', fontSize: '12px' }}>{mod.absolutePath}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Reports Table */}
      {activeModule && !activeReport && !loading && (
        <div style={s.tableWrap}>
          <table style={s.table}>
            <thead>
              <tr>
                <th style={{ ...s.th, ...s.thNum }}>S No.</th>
                <th style={s.th}>Report Name</th>
                <th style={s.th}>Path</th>
              </tr>
            </thead>
            <tbody>
              {reports.length === 0 ? (
                <tr><td colSpan={3} style={s.empty}>No reports assigned in this module.</td></tr>
              ) : reports.map((r, i) => (
                <tr
                  key={r.absolutePath}
                  style={{ ...(i % 2 === 0 ? s.rowEven : s.rowOdd), cursor: 'pointer' }}
                  onClick={() => loadParams(r)}
                  onMouseEnter={e => e.currentTarget.style.background = '#e3f2fd'}
                  onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? '#fff' : '#f9fafb'}
                >
                  <td style={{ ...s.td, ...s.tdNum }}>{i + 1}</td>
                  <td style={s.td}>📄 {r.displayName}</td>
                  <td style={{ ...s.td, color: '#aaa', fontSize: '12px' }}>{r.absolutePath}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Parameters & Output */}
      {activeReport && !loading && (
        <>
          {/* Parameters Panel */}
          <div style={s.panel}>
            <h3 style={s.panelTitle}>Parameters</h3>
            {params.length === 0 ? (
              <p style={s.empty}>This report has no parameters.</p>
            ) : (
              <div style={s.paramGrid}>
                {params.map(p => (
                  <div key={p.name} style={s.paramCell}>
                    <ParamField param={p} value={paramValues[p.name]} onChange={handleParamChange} />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Output Options Panel */}
          <div style={{ ...s.panel, background: '#f9fafb', marginTop: '16px' }}>
            <h3 style={s.panelTitle}>Output Options</h3>
            <div style={s.outputRow}>
              <div style={s.outputField}>
                <label style={s.label}>Output Format</label>
                <select
                  value={format}
                  onChange={e => setFormat(e.target.value)}
                  style={s.select}
                >
                  {FORMATS.map(fmt => (
                    <option key={fmt} value={fmt}>{fmt.toUpperCase()}</option>
                  ))}
                </select>
              </div>
              <div style={s.outputField}>
                <label style={s.label}>Action</label>
                <select
                  value={action}
                  onChange={e => setAction(e.target.value)}
                  style={s.select}
                >
                  <option value="preview">Preview</option>
                  <option value="download">Download</option>
                </select>
              </div>
            </div>
            <div style={s.runWrap}>
              <button
                style={{ ...s.runBtn, opacity: running ? 0.7 : 1, cursor: running ? 'not-allowed' : 'pointer' }}
                onClick={() => runReport(action)}
                disabled={running}
              >
                {running ? 'Running…' : '▶ Run Report'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

const s = {
  page:       { padding: '32px' },
  heading:    { fontSize: '22px', fontWeight: 700, color: '#1a1a2e', marginBottom: '8px', textAlign: 'center' },
  breadcrumb: { marginBottom: '16px', fontSize: '14px' },
  crumbLink:  { cursor: 'pointer', color: '#1976d2', fontWeight: 600 },
  crumbCurrent:{ color: '#333', fontWeight: 600 },
  sep:        { margin: '0 6px', color: '#bbb' },
  loading:    { color: '#888' },
  tableWrap:  { overflowX: 'auto' },
  table:      { width: '100%', borderCollapse: 'collapse', background: '#fff', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 2px 10px rgba(0,0,0,0.08)' },
  th:         { padding: '12px 16px', background: '#1976d2', color: '#fff', textAlign: 'center', fontSize: '13px', fontWeight: 600 },
  thNum:      { width: '70px', textAlign: 'center' },
  td:         { padding: '12px 16px', fontSize: '13px', color: '#333', verticalAlign: 'middle' },
  tdNum:      { width: '70px', textAlign: 'center', color: '#aaa', fontWeight: 600 },
  rowEven:    { background: '#fff' },
  rowOdd:     { background: '#f9fafb' },
  empty:      { padding: '24px', textAlign: 'center', color: '#aaa' },
  panel:      { background: '#fff', borderRadius: '10px', boxShadow: '0 2px 10px rgba(0,0,0,0.08)', padding: '24px' },
  panelTitle: { fontSize: '15px', fontWeight: 700, color: '#1a1a2e', marginBottom: '20px', textAlign: 'center' },
  paramGrid:  { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '20px' },
  paramCell:  { minWidth: 0 },
  outputRow:  { display: 'flex', gap: '24px', flexWrap: 'wrap', justifyContent: 'center', marginBottom: '20px' },
  outputField:{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '200px' },
  label:      { fontSize: '13px', fontWeight: 600, color: '#555' },
  select:     { padding: '10px 14px', borderRadius: '8px', border: '1px solid #ccc', fontSize: '14px', color: '#333', background: '#fff', cursor: 'pointer' },
  runWrap:    { display: 'flex', justifyContent: 'center' },
  runBtn:     { padding: '12px 36px', background: '#1976d2', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '15px', fontWeight: 700, cursor: 'pointer' },
};
