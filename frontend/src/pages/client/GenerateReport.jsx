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
  OutlinedInput 
} from '@mui/material';

// Converts any BIP date value (ISO datetime or MM/dd/yyyy) to YYYY-MM-DD for <input type="date">
function toHTMLDateValue(value) {
  if (!value) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;           // already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}T/.test(value)) return value.split('T')[0]; // ISO datetime
  return '';                                                        // unknown format — let user pick
}

// ── Parameter renderer (Updated for MUI) ──────────────────────
function ParamField({ param, value, onChange }) {
  const { name, label, dataType, UIType, multiValuesAllowed, lovLabels, values: lovValues, defaultValue, dateFormatString } = param;
  
  const isLov = (UIType === 'menu' || UIType === 'check' || UIType === 'radio') && lovLabels?.length > 0;
  const isDate = dataType === 'date' || UIType === 'date';

  // 1. Multi-Select Dropdown
  if (isLov && multiValuesAllowed) {
    const safeValue = Array.isArray(value) ? value : (value ? [value] : []);
    return (
      <FormControl fullWidth sx={{ mb: 2 }}>
        <InputLabel>{label}</InputLabel>
        <Select
          multiple
          value={safeValue}
          onChange={(e) => onChange(name, e.target.value)}
          input={<OutlinedInput label={label} />}
          renderValue={(selected) => {
            // Map the selected internal values to their readable labels
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

  // 2. Single Select Dropdown
  if (isLov && !multiValuesAllowed) {
    return (
      <TextField
        select
        fullWidth
        label={label}
        value={value || ''}
        onChange={(e) => onChange(name, e.target.value)}
        sx={{ mb: 2 }}
      >
        <MenuItem value=""><em>-- Select --</em></MenuItem>
        {lovLabels.map((lbl, i) => (
          <MenuItem key={i} value={lovValues[i] || lbl}>
            {lbl}
          </MenuItem>
        ))}
      </TextField>
    );
  }

  // 3. Date Picker
  if (isDate) {
    return (
      <TextField
        fullWidth
        type="date"
        label={`${label} ${dateFormatString ? `(${dateFormatString})` : ''}`}
        InputLabelProps={{ shrink: true }}
        value={value || ''}
        onChange={(e) => onChange(name, e.target.value)}
        sx={{ mb: 2 }}
      />
    );
  }

  // 4. Standard Text/Number Field
  return (
    <TextField
      fullWidth
      type={dataType === 'integer' || dataType === 'float' ? 'number' : 'text'}
      label={label}
      placeholder={defaultValue || ''}
      value={value || ''}
      onChange={(e) => onChange(name, e.target.value)}
      sx={{ mb: 2 }}
    />
  );
}

// ── Main Component ─────────────────────────────────────────────
export default function GenerateReport() {
  const [modules,      setModules]      = useState([]);
  const [activeModule, setActiveModule] = useState(null);
  const [reports,      setReports]      = useState([]);
  const [activeReport, setActiveReport] = useState(null);
  const [params,       setParams]       = useState([]);
  const [paramValues,  setParamValues]  = useState({});
  const [format,       setFormat]       = useState('pdf');
  const [loading,      setLoading]      = useState(false);
  const [running,      setRunning]      = useState(false);

  const FORMATS = ['pdf','xlsx','html','csv','rtf','xml'];

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
      // Fetching parameters using the clean path
      const res = await api.get('/client/reports/parameters', { params: { path: report.absolutePath } });
      
      const ps  = res.data.data || [];
      setParams(ps);
      
      // Pre-fill defaults intelligently based on single/multi value requirements
      const defaults = {};
      ps.forEach(p => {
        const isDate = p.dataType === 'date' || p.UIType === 'date';
        if (p.defaultValue) {
          if (isDate) {
            // BIP may return defaults as ISO datetime or locale format; normalize to YYYY-MM-DD
            defaults[p.name] = toHTMLDateValue(p.defaultValue);
          } else {
            defaults[p.name] = p.multiValuesAllowed ? [p.defaultValue] : p.defaultValue;
          }
        } else if (p.multiValuesAllowed) {
          defaults[p.name] = []; // Initialize empty array for multi-selects
        } else {
          defaults[p.name] = ''; // Initialize empty string for others
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
      // Format the exact payload expected by bipSoapService.js
      const paramPayload = params.map(p => {
        return {
          name:               p.name,
          dataType:           p.dataType, // Pass original dataType from BIP
          UIType:             p.UIType,   // Pass original UIType as well
          multiValuesAllowed: p.multiValuesAllowed,
          dateFormatString:   p.dateFormatString,
          values: Array.isArray(paramValues[p.name])
            ? paramValues[p.name]
            : paramValues[p.name] ? [paramValues[p.name]] : [],
        };
      });

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
        <span style={activeModule ? s.link : s.cur} onClick={() => { setActiveModule(null); setActiveReport(null); setReports([]); setParams([]); }}>
          📁 Modules
        </span>
        {activeModule && (
          <>
            <span style={s.sep}> › </span>
            <span style={activeReport ? s.link : s.cur} onClick={() => { setActiveReport(null); setParams([]); }}>
              📂 {activeModule.displayName}
            </span>
          </>
        )}
        {activeReport && (
          <>
            <span style={s.sep}> › </span>
            <span style={s.cur}>📄 {activeReport.displayName}</span>
          </>
        )}
      </div>

      {loading && <p style={s.loading}>Loading…</p>}

      {/* Modules */}
      {!activeModule && !loading && (
        <div style={s.grid}>
          {modules.length === 0
            ? <p style={s.empty}>No modules assigned to you.</p>
            : modules.map(mod => (
              <div key={mod.absolutePath} style={s.card} onClick={() => loadReports(mod)}>
                <div style={s.cardIcon}>📂</div>
                <div style={s.cardName}>{mod.displayName}</div>
              </div>
            ))
          }
        </div>
      )}

      {/* Reports */}
      {activeModule && !activeReport && !loading && (
        <div style={s.grid}>
          {reports.length === 0
            ? <p style={s.empty}>No reports assigned in this module.</p>
            : reports.map(r => (
              <div key={r.absolutePath} style={s.card} onClick={() => loadParams(r)}>
                <div style={s.cardIcon}>📄</div>
                <div style={s.cardName}>{r.displayName}</div>
              </div>
            ))
          }
        </div>
      )}

      {/* Report Runner */}
      {activeReport && !loading && (
        <div style={s.runner}>
          {/* Parameters section */}
          <div style={s.runnerTop}>
            <h3 style={s.sectionTitle}>📋 Parameters</h3>
            {params.length === 0
              ? <p style={{ color:'#888', fontSize:'14px' }}>This report has no parameters.</p>
              : (
                <div style={s.paramGrid}>
                  {params.map(p => (
                    <ParamField key={p.name} param={p}
                      value={paramValues[p.name]}
                      onChange={handleParamChange} />
                  ))}
                </div>
              )
            }
          </div>

          {/* Output options */}
          <div style={s.runnerBottom}>
            <h3 style={s.sectionTitle}>⚙️ Output Options</h3>
            <div style={s.outputRow}>
              <div>
                <label style={{ display:'block', marginBottom:'6px', fontSize:'13px', fontWeight:600, color:'#333' }}>Output Format</label>
                <div style={s.formatGroup}>
                  {FORMATS.map(fmt => (
                    <button key={fmt}
                      style={{ ...s.fmtBtn, ...(format === fmt ? s.fmtBtnActive : {}) }}
                      onClick={() => setFormat(fmt)}>
                      {fmt.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
              <div style={s.runBtns}>
                <button style={s.previewBtn} onClick={() => runReport('preview')} disabled={running}>
                  {running ? 'Running…' : '👁 Preview'}
                </button>
                <button style={s.downloadBtn} onClick={() => runReport('download')} disabled={running}>
                  {running ? 'Running…' : '⬇ Download'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Custom Styles ─────────────────────────────────────────────
const s = {
  page:         { padding:'32px' },
  heading:      { fontSize:'22px', fontWeight:700, color:'#1a1a2e', marginBottom:'12px' },
  breadcrumb:   { marginBottom:'20px', fontSize:'14px', display:'flex', alignItems:'center', gap:'4px' },
  link:         { cursor:'pointer', color:'#1976d2', fontWeight:600 },
  cur:          { color:'#333', fontWeight:600 },
  sep:          { color:'#bbb' },
  loading:      { color:'#888' },
  empty:        { color:'#aaa', fontSize:'14px' },
  grid:         { display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))', gap:'16px' },
  card:         { background:'#fff', borderRadius:'10px', padding:'20px', boxShadow:'0 2px 10px rgba(0,0,0,0.08)', cursor:'pointer', textAlign:'center', border:'1px solid #eee' },
  cardIcon:     { fontSize:'32px', marginBottom:'8px' },
  cardName:     { fontWeight:700, fontSize:'13px', color:'#1a1a2e' },
  runner:       { background:'#fff', borderRadius:'12px', boxShadow:'0 2px 12px rgba(0,0,0,0.08)', overflow:'hidden', marginTop: '20px' },
  runnerTop:    { padding:'30px', borderBottom:'1px solid #f0f0f0' },
  runnerBottom: { padding:'24px', backgroundColor: '#fafafa' },
  sectionTitle: { fontSize:'16px', fontWeight:700, color:'#1a1a2e', margin:'0 0 20px' },
  paramGrid:    { display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:'16px 32px' },
  outputRow:    { display:'flex', justifyContent:'space-between', alignItems:'flex-end', flexWrap:'wrap', gap:'20px' },
  formatGroup:  { display:'flex', gap:'8px', flexWrap:'wrap', marginTop:'8px' },
  fmtBtn:       { padding:'8px 16px', border:'1px solid #ddd', borderRadius:'6px', background:'#fff', cursor:'pointer', fontWeight:600, fontSize:'12px', color:'#555' },
  fmtBtnActive: { background:'#1976d2', color:'#fff', border:'1px solid #1976d2' },
  runBtns:      { display:'flex', gap:'12px' },
  previewBtn:   { padding:'10px 24px', background:'#fff', color:'#388e3c', border:'1px solid #388e3c', borderRadius:'8px', cursor:'pointer', fontWeight:600, fontSize:'14px' },
  downloadBtn:  { padding:'10px 24px', background:'#1976d2', color:'#fff', border:'none', borderRadius:'8px', cursor:'pointer', fontWeight:600, fontSize:'14px' },
};