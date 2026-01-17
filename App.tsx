
import React, { useState, useEffect, useMemo } from 'react';
import { PASSWORDS, ADMIN_WHATSAPP, COLORS } from './constants';
import { MilkData, UserRegistry, AppSettings } from './types';

// Helper: Format Date as YYYY-MM-DD
const formatDateKey = (date: Date) => date.toISOString().split('T')[0];

// Helper: Format Date for Display DD/MM/YYYY
const displayDate = (date: Date) => {
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const App: React.FC = () => {
  // --- Auth State ---
  const [isLocked, setIsLocked] = useState(true);
  const [password, setPassword] = useState('');
  const [deviceId, setDeviceId] = useState('');
  const [authInfo, setAuthInfo] = useState<{ type: string; exp: string } | null>(null);

  // --- App Data State ---
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [data, setData] = useState<MilkData>({});
  const [settings, setSettings] = useState<AppSettings>({
    custPlot: '',
    custAddr: '',
    dailyQty: 1,
    rate: 30,
    service: 0,
    milkman: ''
  });

  // --- UI State ---
  const [notQtyInput, setNotQtyInput] = useState('');
  const [extraQtyInput, setExtraQtyInput] = useState('');
  const [showAdmin, setShowAdmin] = useState(false);
  const [showBill, setShowBill] = useState(false);
  const [billContent, setBillContent] = useState('');
  const [dateRange, setDateRange] = useState<{ from: string; to: string }>({ from: '', to: '' });

  // --- Initialization ---
  useEffect(() => {
    // Device ID Generation (simulating a unique hardware ID)
    let id = localStorage.getItem('MDT_DEVICE');
    if (!id) {
      id = "MDT-" + Math.random().toString(36).slice(2, 11).toUpperCase();
      localStorage.setItem('MDT_DEVICE', id);
    }
    setDeviceId(id);

    // Persistence
    const savedData = localStorage.getItem('MILK_DATA');
    if (savedData) setData(JSON.parse(savedData));

    const savedSettings = localStorage.getItem('MDT_SETTINGS');
    if (savedSettings) setSettings(JSON.parse(savedSettings));

    // Check existing authorization
    const savedRegistry = localStorage.getItem('MDT_REGISTRY');
    if (savedRegistry) {
      const reg: UserRegistry = JSON.parse(savedRegistry);
      if (reg[id]) {
        const expiry = new Date(reg[id].exp);
        if (expiry > new Date()) {
          setAuthInfo({ type: reg[id].type, exp: reg[id].exp });
          setIsLocked(false);
        }
      }
    }
  }, []);

  // --- Actions ---
  const handleUnlock = () => {
    let type = '';
    let days = 0;
    const inputPwd = password.trim();

    // Check trial list
    const isTrial = PASSWORDS.TRIAL_LIST.includes(inputPwd);
    
    if (isTrial) {
      type = "Trial";
      days = 30;
    } else if (inputPwd === PASSWORDS.YEAR1) {
      type = "Paid Year-1";
      days = 365;
    } else if (inputPwd === PASSWORDS.YEAR2) {
      type = "Paid Year-2";
      days = 365;
    } else {
      alert("⚠️ Invalid Password or License Key. Please contact admin.");
      return;
    }

    // Hardware Binding Logic
    // We use a "Global Key Mapping" stored in local storage to track which key belongs to which device
    const keyMap = JSON.parse(localStorage.getItem('MDT_GLOBAL_KEYS') || '{}');

    if (keyMap[inputPwd] && keyMap[inputPwd] !== deviceId) {
      alert("❌ This password has already been used on another device. It cannot be shared.");
      return;
    }

    // If key is fresh or belongs to this device, activate it
    const expDate = new Date();
    expDate.setDate(expDate.getDate() + days);
    
    // Register the key to this device
    keyMap[inputPwd] = deviceId;
    localStorage.setItem('MDT_GLOBAL_KEYS', JSON.stringify(keyMap));

    // Save device registry
    const registry = JSON.parse(localStorage.getItem('MDT_REGISTRY') || '{}');
    registry[deviceId] = { pwd: inputPwd, type, exp: expDate.toISOString() };
    localStorage.setItem('MDT_REGISTRY', JSON.stringify(registry));
    
    setAuthInfo({ type, exp: expDate.toISOString() });
    setIsLocked(false);
  };

  const requestLicense = () => {
    const text = `Hello,\nI need a Milk Diary license.\n\nDevice ID: ${deviceId}`;
    window.open(`https://wa.me/${ADMIN_WHATSAPP}?text=${encodeURIComponent(text)}`);
  };

  const updateEntry = (type: 'not' | 'extra', val: string) => {
    if (!selectedDate) return alert("Please select a date first");
    const k = formatDateKey(selectedDate);
    const newData = { ...data };
    newData[k] = newData[k] || {};
    newData[k][type] = parseInt(val) || 0;
    setData(newData);
    localStorage.setItem('MILK_DATA', JSON.stringify(newData));
  };

  const saveAdmin = () => {
    localStorage.setItem('MDT_SETTINGS', JSON.stringify(settings));
    setShowAdmin(false);
  };

  const buildBill = (start: Date, end: Date) => {
    const daysCount = Math.floor((end.getTime() - start.getTime()) / 86400000) + 1;
    const basePockets = settings.dailyQty * daysCount;
    
    let extraTotal = 0;
    let notTotal = 0;
    let extraDetails = "";
    let notDetails = "";

    const sortedKeys = Object.keys(data).sort();

    sortedKeys.forEach(k => {
      const d = new Date(k);
      if (d >= start && d <= end) {
        if (data[k].extra) {
          extraTotal += data[k].extra!;
          extraDetails += `${displayDate(d)} : ${data[k].extra} pkt\n`;
        }
        if (data[k].not) {
          notTotal += data[k].not!;
          notDetails += `${displayDate(d)} : ${data[k].not} pkt\n`;
        }
      }
    });

    const finalMilk = basePockets + extraTotal - notTotal;
    const amount = finalMilk * settings.rate;
    const total = amount + settings.service;

    const text = `Milk Bill Details

Plot No. ${settings.custPlot}
Address: ${settings.custAddr}

Period:
${displayDate(start)} to ${displayDate(end)}

Daily Milk:
${settings.dailyQty} pkt × ${daysCount} days = ${basePockets} pkt

Extra Milk Purchased:
${extraDetails || "Nil\n"}
                        ----------
                          ${extraTotal} pkt
                        ----------

Not Supplied Milk:
${notDetails || "Nil\n"}
                        ----------
                          ${notTotal} pkt
                        ----------

--------------------
Total Milk:
${basePockets} + ${extraTotal} - ${notTotal} = ${finalMilk} pkt

Milk Rate:
₹${settings.rate} per pkt

Milk Amount:
${finalMilk} × ${settings.rate} = ₹${amount}

Service Charge (One Time):
₹${settings.service}

--------------------
Grand Total:
₹${total}

- Powered by Milk Diary iniyan.talkies`;

    setBillContent(text);
    setShowBill(true);
  };

  const generateMonthBill = () => {
    const start = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    const end = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
    buildBill(start, end);
  };

  const generateRangeBill = () => {
    if (!dateRange.from || !dateRange.to) return alert("Select range");
    buildBill(new Date(dateRange.from), new Date(dateRange.to));
  };

  const sendToWhatsApp = () => {
    window.open(`https://wa.me/91${settings.milkman}?text=${encodeURIComponent(billContent)}`);
  };

  const daysInMonth = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const count = new Date(year, month + 1, 0).getDate();
    return Array.from({ length: count }, (_, i) => new Date(year, month, i + 1));
  }, [currentMonth]);

  if (isLocked) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-green-600">
        <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <i className="fa-solid fa-lock text-green-600 text-3xl"></i>
          </div>
          <h2 className="text-2xl font-bold mb-2">Milk Diary Locked</h2>
          <p className="text-gray-500 mb-6">Enter a unique license key to unlock your dashboard.</p>
          <input 
            type="text" 
            placeholder="Unique License Key" 
            className="w-full p-4 border rounded-xl mb-4 focus:outline-none focus:ring-2 focus:ring-green-400"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button 
            onClick={handleUnlock}
            className="w-full bg-green-600 text-white font-bold py-4 rounded-xl mb-3 hover:bg-green-700 active:scale-95 transition-all"
          >
            Unlock Now
          </button>
          <button 
            onClick={requestLicense}
            className="w-full bg-blue-500 text-white font-bold py-4 rounded-xl hover:bg-blue-600 active:scale-95 transition-all"
          >
            <i className="fa-brands fa-whatsapp mr-2"></i> Get Key
          </button>
          <p className="mt-6 text-[10px] text-gray-400 font-mono tracking-tighter">SECURE HARDWARE ID: {deviceId}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto min-h-screen bg-gray-50 pb-20 no-print">
      <header className="bg-white border-b p-4 sticky top-0 z-30 flex justify-between items-center shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-green-600">Milk Diary i.t</h1>
          <p className="text-[10px] text-gray-400 uppercase tracking-widest">{authInfo?.type} License</p>
        </div>
        <button onClick={() => setShowAdmin(true)} className="p-2 text-gray-500 hover:text-green-600 flex flex-col items-center">
          <i className="fa-solid fa-gear text-xl"></i>
          <span className="text-[10px] font-bold">ADMIN</span>
        </button>
      </header>

      <div className="flex justify-between items-center p-4 bg-white mb-2">
        <button onClick={() => setCurrentMonth(new Date(currentMonth.setMonth(currentMonth.getMonth() - 1)))} className="p-2">
          <i className="fa-solid fa-chevron-left"></i>
        </button>
        <h2 className="text-lg font-semibold capitalize">
          {currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}
        </h2>
        <button onClick={() => setCurrentMonth(new Date(currentMonth.setMonth(currentMonth.getMonth() + 1)))} className="p-2">
          <i className="fa-solid fa-chevron-right"></i>
        </button>
      </div>

      <div className="grid grid-cols-7 gap-2 p-4 bg-white rounded-b-2xl shadow-sm mb-4">
        {['S','M','T','W','T','F','S'].map(d => <div key={d} className="text-center text-xs font-bold text-gray-400 pb-2">{d}</div>)}
        {Array.from({ length: new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay() }).map((_, i) => <div key={`empty-${i}`} />)}
        {daysInMonth.map(date => {
          const k = formatDateKey(date);
          const entry = data[k];
          let statusColor = COLORS.DEFAULT;
          if (entry?.not && entry?.extra) statusColor = COLORS.BOTH;
          else if (entry?.not) statusColor = COLORS.NOT_SUPPLIED;
          else if (entry?.extra) statusColor = COLORS.EXTRA;

          const isSelected = selectedDate && formatDateKey(selectedDate) === k;

          return (
            <button
              key={k}
              onClick={() => {
                setSelectedDate(date);
                setNotQtyInput(data[k]?.not?.toString() || '');
                setExtraQtyInput(data[k]?.extra?.toString() || '');
              }}
              className={`aspect-square rounded-lg flex items-center justify-center text-sm font-medium transition-all ${statusColor} ${entry?.not || entry?.extra ? 'text-white' : 'text-gray-700'} ${isSelected ? COLORS.SELECTED : ''}`}
            >
              {date.getDate()}
            </button>
          );
        })}
      </div>

      {selectedDate && (
        <div className="mx-4 p-4 bg-white rounded-2xl shadow-sm border border-green-100 mb-4 animate-in fade-in slide-in-from-bottom-4">
          <h3 className="text-sm font-bold text-gray-500 mb-3 uppercase flex items-center">
            <i className="fa-solid fa-calendar-day mr-2 text-green-500"></i>
            Entry for {displayDate(selectedDate)}
          </h3>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="text-xs font-semibold text-red-500 block mb-1">Not Supplied (Qty)</label>
              <input 
                type="number" 
                className="w-full p-3 bg-gray-50 border rounded-xl"
                value={notQtyInput}
                onChange={(e) => setNotQtyInput(e.target.value.replace(/^0+/, '') || '0')}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-green-500 block mb-1">Extra Milk (Qty)</label>
              <input 
                type="number" 
                className="w-full p-3 bg-gray-50 border rounded-xl"
                value={extraQtyInput}
                onChange={(e) => setExtraQtyInput(e.target.value.replace(/^0+/, '') || '0')}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <button 
              onClick={() => updateEntry('not', notQtyInput)}
              className="bg-red-500 text-white py-3 rounded-xl font-bold text-sm shadow-md active:scale-95"
            >
              Update Not
            </button>
            <button 
              onClick={() => updateEntry('extra', extraQtyInput)}
              className="bg-green-500 text-white py-3 rounded-xl font-bold text-sm shadow-md active:scale-95"
            >
              Update Extra
            </button>
          </div>
        </div>
      )}

      <div className="mx-4 p-4 bg-white rounded-2xl shadow-sm mb-4">
        <h3 className="font-bold mb-4 flex items-center">
          <i className="fa-solid fa-file-invoice-dollar mr-2 text-green-500"></i>
          Billing Tools
        </h3>
        <div className="space-y-4">
          <div className="p-3 bg-green-50 rounded-xl">
             <p className="text-xs font-bold text-green-600 mb-2">Custom Date Range</p>
             <div className="grid grid-cols-2 gap-2 mb-2">
               <input type="date" className="p-2 border rounded-lg text-sm" onChange={(e) => setDateRange(prev => ({ ...prev, from: e.target.value }))} />
               <input type="date" className="p-2 border rounded-lg text-sm" onChange={(e) => setDateRange(prev => ({ ...prev, to: e.target.value }))} />
             </div>
             <button onClick={generateRangeBill} className="w-full bg-green-600 text-white py-2 rounded-lg text-sm font-bold shadow-sm">Preview Range Bill</button>
          </div>
          <button onClick={generateMonthBill} className="w-full py-4 border-2 border-green-600 text-green-600 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-green-50">
            <i className="fa-solid fa-calendar-check"></i> Final Bill (This Month)
          </button>
        </div>
      </div>

      {showAdmin && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold">Dairy Configuration</h2>
              <button onClick={() => setShowAdmin(false)} className="text-gray-400"><i className="fa-solid fa-xmark text-2xl"></i></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-400 block mb-1">PLOT / DOOR NO</label>
                <input type="text" className="w-full p-3 bg-gray-50 border rounded-xl" value={settings.custPlot} onChange={e => setSettings({...settings, custPlot: e.target.value})} />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-400 block mb-1">ADDRESS</label>
                <textarea className="w-full p-3 bg-gray-50 border rounded-xl" rows={2} value={settings.custAddr} onChange={e => setSettings({...settings, custAddr: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-gray-400 block mb-1">DAILY QTY (PKT)</label>
                  <input type="number" className="w-full p-3 bg-gray-50 border rounded-xl" value={settings.dailyQty || ''} onChange={e => setSettings({...settings, dailyQty: parseInt(e.target.value.replace(/^0+/, '')) || 0})} />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-400 block mb-1">RATE (₹ / PKT)</label>
                  <input type="number" className="w-full p-3 bg-gray-50 border rounded-xl" value={settings.rate || ''} onChange={e => setSettings({...settings, rate: parseFloat(e.target.value.replace(/^0+/, '')) || 0})} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-gray-400 block mb-1">SERVICE FEE (₹)</label>
                  <input type="number" className="w-full p-3 bg-gray-50 border rounded-xl" value={settings.service || ''} onChange={e => setSettings({...settings, service: parseFloat(e.target.value.replace(/^0+/, '')) || 0})} />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-400 block mb-1">MILKMAN WHATSAPP</label>
                  <input type="text" placeholder="e.g. 9172008..." className="w-full p-3 bg-gray-50 border rounded-xl" value={settings.milkman} onChange={e => setSettings({...settings, milkman: e.target.value})} />
                </div>
              </div>
              <button onClick={saveAdmin} className="w-full bg-green-600 text-white font-bold py-4 rounded-2xl shadow-lg mt-4">Save Configuration</button>
            </div>
          </div>
        </div>
      )}

      {showBill && (
        <div className="fixed inset-0 bg-white z-[60] overflow-y-auto">
          <div className="max-w-md mx-auto p-6">
            <div className="flex justify-between items-center mb-6 no-print">
              <button onClick={() => setShowBill(false)} className="text-gray-500 flex items-center"><i className="fa-solid fa-arrow-left mr-2"></i> Back</button>
              <h2 className="font-bold">Bill Preview</h2>
              <div />
            </div>
            <div className="bg-white border p-6 font-mono text-sm shadow-sm mb-6">
              <pre className="whitespace-pre-wrap">{billContent}</pre>
            </div>
            <div className="space-y-3 no-print">
              <button onClick={sendToWhatsApp} className="w-full bg-green-500 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2"><i className="fa-brands fa-whatsapp text-xl"></i> Send to Milkman</button>
              <button onClick={() => window.print()} className="w-full bg-green-600 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2"><i className="fa-solid fa-file-pdf"></i> Save as PDF</button>
            </div>
          </div>
        </div>
      )}

      <footer className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-gray-100 border-t p-2 text-center text-[10px] text-gray-400 z-40 font-mono tracking-tighter">
        SECURE STATUS: {authInfo ? `ACTIVE UNTIL ${displayDate(new Date(authInfo.exp))}` : 'EXPIRED'} | DEV-ID: {deviceId}
      </footer>
    </div>
  );
};

export default App;
