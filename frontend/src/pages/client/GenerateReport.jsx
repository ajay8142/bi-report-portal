import { useState, useEffect } from 'react';
import api from '../../api/axiosInstance';
import toast from 'react-hot-toast';
import { useLanguage } from '../../context/LanguageContext';
import {
  TextField,
  MenuItem,
  Select,
  InputLabel,
  FormControl,
  Checkbox,
  ListItemText,
  OutlinedInput,
  Autocomplete,
} from '@mui/material';

// Looks up the browser's actual public IP (server-side req.ip is unreliable behind
// NAT/proxies). Tries a couple of providers with a short timeout so a slow/blocked
// lookup never hangs report generation — falls back to the server's own detection.
async function fetchPublicIp() {
  const providers = [
    { url: 'https://api.ipify.org?format=json',       pick: (d) => d.ip },
    { url: 'https://api64.ipify.org?format=json',      pick: (d) => d.ip },
  ];
  for (const { url, pick } of providers) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3000);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`${url} responded ${res.status}`);
      const ip = pick(await res.json());
      if (ip) return ip;
    } catch (err) {
      console.warn('Public IP lookup failed:', err.message);
    }
  }
  return '';
}

function toHTMLDateValue(value) {
  if (!value) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  if (/^\d{4}-\d{2}-\d{2}T/.test(value)) return value.split('T')[0];
  return '';
}

function ParamField({ param, value, onChange }) {
  const { t } = useLanguage();
  const { name, label, dataType, UIType, multiValuesAllowed, lovLabels, values: lovValues, defaultValue, mandatory, useNullForAll } = param;

  const isLov = (UIType === 'menu' || UIType === 'check' || UIType === 'radio') && lovLabels?.length > 0;
  const isDate = dataType === 'date' || UIType === 'date';
  const isGlCode = (name || '').toUpperCase().replace(/[\s_]/g, '').includes('GLCODE');

  let indicator = '';
  if (mandatory) {
    indicator = ' *';
  } else if (useNullForAll && multiValuesAllowed) {
    indicator = t('indicator_all_suffix');
  }
  const displayLabel = `${label}${indicator}`;

  const labelFor = (val) => {
    const idx = lovValues.findIndex((v) => v === val);
    return idx >= 0 && lovLabels[idx] ? lovLabels[idx] : val;
  };

  if (isLov && isGlCode && multiValuesAllowed) {
    const safeValue = (Array.isArray(value) ? value : (value ? [value] : [])).filter(v => v !== '*');
    return (
      <Autocomplete
        multiple
        fullWidth
        disableCloseOnSelect
        options={lovValues}
        getOptionLabel={labelFor}
        value={safeValue}
        onChange={(e, newValue) => onChange(name, newValue.length ? newValue : ['*'])}
        renderOption={(props, option) => (
          <li {...props} key={option}>
            <Checkbox checked={safeValue.indexOf(option) > -1} />
            <ListItemText primary={labelFor(option)} />
          </li>
        )}
        renderInput={(params) => (
          <TextField {...params} label={displayLabel} InputLabelProps={{ shrink: true }} placeholder={t('search_gl_code_placeholder')} />
        )}
      />
    );
  }

  if (isLov && isGlCode && !multiValuesAllowed) {
    return (
      <Autocomplete
        fullWidth
        options={lovValues}
        getOptionLabel={labelFor}
        value={value || null}
        onChange={(e, newValue) => onChange(name, newValue || '')}
        renderInput={(params) => (
          <TextField {...params} label={displayLabel} InputLabelProps={{ shrink: true }} placeholder={t('search_gl_code_placeholder')} />
        )}
      />
    );
  }

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
            let selected = e.target.value;
 
            // Remove * when a real value is selected
            if (selected.includes('*') && selected.length > 1) {
              selected = selected.filter(v => v !== '*');
            }
 
            // If everything is cleared, go back to *
            if (selected.length === 0) {
              selected = ['*'];
            }
 
            onChange(name, selected);
          }}
          input={<OutlinedInput label={displayLabel} notched />}
          renderValue={(selected) => {
            if (selected.includes('*')) {
              return <span>{t('all')}</span>;
            }
 
            return selected
              .map((val) => {
                const idx = lovValues.findIndex((v) => v === val);
                return idx >= 0 && lovLabels[idx]
                  ? lovLabels[idx]
                  : val;
              })
              .join(', ');
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
        <MenuItem value=""><em>{t('select_dash')}</em></MenuItem>
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
          sx={{ colorScheme: 'light' }}
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

// Internal/system parameters that should never be shown as input fields —
// they're still submitted with their default/current value when the report runs.
const HIDDEN_PARAMS = ['PM_USER_ID', 'PM_ROLE_ID', 'PM_MODULE'];

export default function GenerateReport() {
  const { t, language } = useLanguage();
  const [modules,      setModules]      = useState([]);
  const [activeModule, setActiveModule] = useState(null);
  const [reports,      setReports]      = useState([]);
  const [activeReport, setActiveReport] = useState(null);
  const [params,       setParams]       = useState([]);
  const [paramValues,  setParamValues]  = useState({});
  const [format,       setFormat]       = useState('pdf');
  const [action,       setAction]       = useState('');
  const [loading,      setLoading]      = useState(true);
  const [running,      setRunning]      = useState(false);

  useEffect(() => {
    api.get('/client/modules')
      .then(r => setModules(r.data.data))
      .catch(() => toast.error(t('toast_load_modules_failed')))
      .finally(() => setLoading(false));
  }, [t]);

  const loadReports = async (mod) => {
    setActiveModule(mod);
    setActiveReport(null);
    setParams([]);
    setParamValues({});
    setLoading(true);
    try {
      const res = await api.get('/client/modules/reports', { params: { path: mod.absolutePath } });
      setReports(res.data.data);
    } catch { toast.error(t('toast_load_reports_failed')); }
    finally  { setLoading(false); }
  };

  const loadParams = async (report) => {
    setActiveReport(report);
    setParams([]);
    setParamValues({});
    setAction(report.generateFlag ? 'preview' : report.printFlag ? 'download' : '');
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
    } catch { toast.error(t('toast_load_parameters_failed')); }
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

      // req.ip resolves to the loopback address (::1) when the app is accessed over
      // localhost/NAT, so ask a public IP lookup service for the client's real IP.
      const clientIp = await fetchPublicIp();

      const res = await api.post('/client/reports/run', {
        reportPath: activeReport.absolutePath,
        format,
        locale: language,
        params: paramPayload,
        action,
        clientIp,
      }, { responseType: 'blob' });

      const blob     = new Blob([res.data], { type: res.headers['content-type'] });
      const url      = URL.createObjectURL(blob);
      const filename = activeReport.displayName + '.' + format;

      if (action === 'preview') {
        // #toolbar=0 hides the browser's built-in PDF viewer toolbar (print/download/etc.)
        const viewerUrl = format === 'pdf' ? `${url}#toolbar=0` : url;
        window.open(viewerUrl, '_blank');
      } else {
        const a    = document.createElement('a');
        a.href     = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
      }
      toast.success(action === 'preview' ? t('toast_report_opened_success') : t('toast_report_downloaded_success'));
    } catch { toast.error(t('toast_run_report_failed')); }
    finally  { setRunning(false); }
  };

  return (
    <div style={s.page}>
      <h2 style={s.heading}>{t('heading_generate_report')}</h2>

      {/* Breadcrumb */}
      <div style={s.breadcrumb}>
        <span
          style={activeModule ? s.crumbLink : s.crumbCurrent}
          onClick={() => { setActiveModule(null); setActiveReport(null); setReports([]); setParams([]); }}
        >
          📁 {t('modules')}
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

      {loading && <p style={s.loading}>{t('loading')}</p>}

      {/* Modules Table */}
      {!activeModule && !loading && (
        <div style={s.tableWrap}>
          <table style={s.table}>
            <thead>
              <tr>
                <th style={{ ...s.th, ...s.thNum }}>{t('col_sno')}</th>
                <th style={s.th}>{t('col_module_name')}</th>
              </tr>
            </thead>
            <tbody>
              {modules.length === 0 ? (
                <tr><td colSpan={2} style={s.empty}>{t('empty_no_modules_assigned')}</td></tr>
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
                <th style={{ ...s.th, ...s.thNum }}>{t('col_sno')}</th>
                <th style={s.th}>{t('col_report_name')}</th>
              </tr>
            </thead>
            <tbody>
              {reports.length === 0 ? (
                <tr><td colSpan={2} style={s.empty}>{t('empty_no_reports_assigned')}</td></tr>
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
            <h3 style={s.panelTitle}>{t('parameters')}</h3>
            {(() => {
              const visibleParams = params.filter(p => !HIDDEN_PARAMS.includes((p.name || '').toUpperCase()));
              return visibleParams.length === 0 ? (
                <p style={s.empty}>{t('msg_no_parameters')}</p>
              ) : (
                <div style={s.paramGrid}>
                  {visibleParams.map(p => (
                    <div key={p.name} style={s.paramCell}>
                      <ParamField param={p} value={paramValues[p.name]} onChange={handleParamChange} />
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>

          {/* Output Options Panel */}
          <div style={{ ...s.panel, background: '#f9fafb', marginTop: '16px' }}>
            <h3 style={s.panelTitle}>{t('output_options')}</h3>
            <div style={s.outputRow}>
              <div style={s.outputField}>
                <label style={s.label}>{t('output_format')}</label>
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
                <label style={s.label}>{t('report_language')}</label>
                {/* Locked to the language assigned to this user (USERS.REPORT_LANGUAGE) —
                    reports always generate in that language; see clientController.runReport. */}
                <div style={s.staticValue}>{t(`lang_name_${language}`)}</div>
              </div>
              {(activeReport.printFlag || activeReport.generateFlag) && (
                <div style={s.outputField}>
                  <label style={s.label}>{t('action_label')}</label>
                  <select
                    value={action}
                    onChange={e => setAction(e.target.value)}
                    style={s.select}
                  >
                    {activeReport.printFlag && <option value="download">🖨 {t('word_print')}</option>}
                    {activeReport.generateFlag && <option value="preview">👁 {t('word_generate')}</option>}
                  </select>
                </div>
              )}
            </div>
            <div style={s.runWrap}>
              {activeReport.printFlag || activeReport.generateFlag ? (
                <button
                  style={{ ...s.runBtn, opacity: running ? 0.7 : 1, cursor: running ? 'not-allowed' : 'pointer' }}
                  onClick={() => runReport(action)}
                  disabled={running}
                >
                  {running ? t('running') : action === 'download' ? `🖨 ${t('word_print')}` : `👁 ${t('word_generate')}`}
                </button>
              ) : (
                <p style={s.empty}>{t('msg_no_actions_available')}</p>
              )}
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
  th:         { padding: '12px 16px', background: '#1976d2', color: '#fff', textAlign: 'left', fontSize: '13px', fontWeight: 600 },
  thNum:      { width: '70px', textAlign: 'center' },
  td:         { padding: '12px 16px', fontSize: '13px', color: '#333', verticalAlign: 'middle' , textAlign: 'left'},
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
  staticValue:{ padding: '10px 14px', borderRadius: '8px', border: '1px solid #eee', fontSize: '14px', color: '#333', background: '#f0f2f5' },
  runWrap:    { display: 'flex', justifyContent: 'center' },
  runBtn:     { padding: '12px 36px', background: '#1976d2', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '15px', fontWeight: 700, cursor: 'pointer' },
};
