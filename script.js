const employeeName = document.getElementById('employeeName');
const reportMonth = document.getElementById('reportMonth');
const officialHoursRegularStart = document.getElementById('officialHoursRegularStart');
const officialHoursSatStart = document.getElementById('officialHoursSatStart');
const lunchNoteRegular = document.getElementById('lunchNoteRegular');
const lunchNoteSat = document.getElementById('lunchNoteSat');
const generateButton = document.getElementById('generateButton');
const importButton = document.getElementById('importButton');
const saveButton = document.getElementById('saveButton');
const clearButton = document.getElementById('clearButton');
const fileInput = document.getElementById('fileInput');
const recordPreview = document.getElementById('recordPreview');
const dataEntryTableBody = document.querySelector('#dataEntryTable tbody');
const printButton = document.getElementById('printButton');

function pad(value) {
  return String(value).padStart(2, '0');
}

function parseTimeString(value) {
  if (!value) return null;
  const trimmed = value.trim();
  const amPmMatch = trimmed.match(/^(\d{1,2}):(\d{2})\s*(am|pm|nn)$/i);
  if (amPmMatch) {
    let hours = Number(amPmMatch[1]);
    const minutes = Number(amPmMatch[2]);
    const period = amPmMatch[3].toLowerCase();
    if (period === 'nn') {
      return 12 * 60 + minutes;
    }
    if (hours === 12) hours = period === 'am' ? 0 : 12;
    if (period === 'pm') hours += 12;
    return hours * 60 + minutes;
  }

  const militaryMatch = trimmed.match(/^(\d{1,2}):(\d{2})$/);
  if (militaryMatch) {
    const hours = Number(militaryMatch[1]);
    const minutes = Number(militaryMatch[2]);
    return hours * 60 + minutes;
  }

  return null;
}

function parseTimePickerValue(value) {
  if (!value) return null;
  const match = value.match(/^(\d{1,2}):(\d{2})$/);
  if (match) {
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    return hours * 60 + minutes;
  }
  return null;
}

function parseScheduleValue(value) {
  // "08:00-17:00-60" → {start: 480, end: 1020, lunchBreak: 60}
  if (!value) return null;
  const parts = value.split('-');
  if (parts.length !== 3) return null;
  
  const start = parseTimePickerValue(parts[0]);
  const end = parseTimePickerValue(parts[1]);
  const lunchBreak = Number(parts[2]);
  
  if (start === null || end === null || isNaN(lunchBreak)) return null;
  return { start, end, lunchBreak };
}

function getExpectedMinutesForDay(day) {
  const [year, month] = reportMonth.value.split('-').map(Number);
  if (!year || !month) return null;
  const date = new Date(year, month - 1, day);
  
  const regularSchedule = parseScheduleValue(officialHoursRegularStart.value);
  const satSchedule = parseScheduleValue(officialHoursSatStart.value);

  if (date.getDay() === 6 && satSchedule) {
    const satTotal = satSchedule.end - satSchedule.start - satSchedule.lunchBreak;
    return satTotal >= 0 ? satTotal : null;
  }

  if (regularSchedule) {
    const regularTotal = regularSchedule.end - regularSchedule.start - regularSchedule.lunchBreak;
    return regularTotal >= 0 ? regularTotal : null;
  }

  return null;
}

function createRow(day) {
  const row = document.createElement('tr');
  row.innerHTML = `
    <td>
      <select class="day-type-select" data-field="dayType">
        <option value="normal">Normal</option>
        <option value="saturday">Saturday</option>
        <option value="sunday">Sunday</option>
        <option value="holiday">Holiday</option>
      </select>
    </td>
    <td>${day}</td>
    <td><input class="table-input" type="time" step="60" data-field="amArr" /></td>
    <td><input class="table-input" type="time" step="60" data-field="amDep" /></td>
    <td><input class="table-input" type="time" step="60" data-field="pmArr" /></td>
    <td><input class="table-input" type="time" step="60" data-field="pmDep" /></td>
    <td><input class="table-input" data-field="hours" readonly /></td>
    <td><input class="table-input" data-field="minutes" readonly /></td>
  `;

  const inputs = row.querySelectorAll('[data-field]');
  const updateUnderTime = () => {
    const dayType = row.querySelector('[data-field="dayType"]').value;
    const amArr = row.querySelector('[data-field="amArr"]').value;
    const amDep = row.querySelector('[data-field="amDep"]').value;
    const pmArr = row.querySelector('[data-field="pmArr"]').value;
    const pmDep = row.querySelector('[data-field="pmDep"]').value;
    const hoursInput = row.querySelector('[data-field="hours"]');
    const minutesInput = row.querySelector('[data-field="minutes"]');

    const timeInputs = row.querySelectorAll('input[type="time"]');
    if (dayType !== 'normal') {
      timeInputs.forEach((input) => {
        input.value = '';
        input.disabled = true;
      });
      hoursInput.value = '';
      minutesInput.value = '';
      return;
    }

    timeInputs.forEach((input) => {
      input.disabled = false;
    });

    if (!amArr || !amDep || !pmArr || !pmDep) {
      hoursInput.value = '';
      minutesInput.value = '';
      return;
    }

    if (!amArr || !amDep || !pmArr || !pmDep) {
      hoursInput.value = '';
      minutesInput.value = '';
      return;
    }

    const times = [amArr, amDep, pmArr, pmDep].map(parseTimePickerValue);
    if (!times.every(t => t !== null)) {
      hoursInput.value = '';
      minutesInput.value = '';
      return;
    }

    const [amArrTime, amDepTime, pmArrTime, pmDepTime] = times;
    
    // Get the scheduled time range - clamp actual times to schedule boundaries
    const regularSchedule = parseScheduleValue(officialHoursRegularStart.value);
    const satSchedule = parseScheduleValue(officialHoursSatStart.value);
    
    const [year, month] = reportMonth.value.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    
    let scheduleStart, scheduleEnd, lunchStart, lunchEnd, lunchBreak;
    
    if (date.getDay() === 6 && satSchedule) {
      // Saturday schedule
      scheduleStart = satSchedule.start;
      scheduleEnd = satSchedule.end;
      lunchBreak = satSchedule.lunchBreak;
    } else if (regularSchedule) {
      // Regular weekday schedule
      scheduleStart = regularSchedule.start;
      scheduleEnd = regularSchedule.end;
      lunchBreak = regularSchedule.lunchBreak;
    }

    if (typeof scheduleStart !== 'number' || typeof scheduleEnd !== 'number') {
      hoursInput.value = '';
      minutesInput.value = '';
      return;
    }

    const clampedAmArr = Math.max(amArrTime, scheduleStart);
    const clampedAmDep = Math.min(amDepTime, scheduleEnd);
    const clampedPmArr = Math.max(pmArrTime, scheduleStart);
    const clampedPmDep = Math.min(pmDepTime, scheduleEnd);

    let total;
    if (lunchBreak > 0) {
      const realLunchStart = 12 * 60;
      const realLunchEnd = 13 * 60;
      const morning = Math.max(0, Math.min(clampedAmDep, realLunchStart) - clampedAmArr);
      const afternoon = Math.max(0, clampedPmDep - Math.max(clampedPmArr, realLunchEnd));
      total = morning + afternoon;
    } else {
      const morning = Math.max(0, Math.min(clampedAmDep, scheduleEnd) - Math.max(clampedAmArr, scheduleStart));
      const afternoon = Math.max(0, Math.min(clampedPmDep, scheduleEnd) - Math.max(clampedPmArr, scheduleStart));
      total = morning + afternoon;
    }

    const expected = getExpectedMinutesForDay(day);

    if (expected !== null) {
      if (total < expected) {
        const undertime = expected - total;
        hoursInput.value = Math.floor(undertime / 60);
        minutesInput.value = pad(undertime % 60);
      } else {
        hoursInput.value = '';
        minutesInput.value = '';
      }
    } else {
      hoursInput.value = '';
      minutesInput.value = '';
    }
  };

  inputs.forEach((input) => {
    if (input.dataset.field !== 'hours' && input.dataset.field !== 'minutes') {
      input.addEventListener('input', updateUnderTime);
      input.addEventListener('change', updateUnderTime);
    }
  });

  return row;
}

function getDaysInMonth(monthValue) {
  if (!monthValue) {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  }

  const [year, month] = monthValue.split('-').map(Number);
  return new Date(year, month, 0).getDate();
}

function buildTable() {
  dataEntryTableBody.innerHTML = '';
  const days = getDaysInMonth(reportMonth.value);
  for (let day = 1; day <= days; day += 1) {
    dataEntryTableBody.appendChild(createRow(day));
  }
}

function formatMonthYear(value) {
  if (!value) return '';
  const [year, month] = value.split('-');
  const date = new Date(`${year}-${month}-01`);
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function formatTimePickerValue(value) {
  if (!value) return '';
  const [hours, minutes] = value.split(':');
  const h = Number(hours);
  const m = Number(minutes);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const displayHours = h > 12 ? h - 12 : (h === 0 ? 12 : h);
  return `${displayHours}:${String(m).padStart(2, '0')} ${ampm}`;
}

function formatScheduleDisplay(scheduleValue) {
  const schedule = parseScheduleValue(scheduleValue);
  if (!schedule) return '';
  
  // Convert minutes to HH:MM
  const minToTime = (mins) => {
    const hours = Math.floor(mins / 60);
    const minutes = mins % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  };
  
  const startTime = formatTimePickerValue(minToTime(schedule.start));
  const endTime = formatTimePickerValue(minToTime(schedule.end));
  return `${startTime} - ${endTime}`;
}

function buildRecordPreview() {
  const name = employeeName.value.trim() || '(Name)';
  const upperName = name.toUpperCase();
  const monthLabel = formatMonthYear(reportMonth.value) || '(Month / Year)';
  
  const regularLabel = formatScheduleDisplay(officialHoursRegularStart.value) 
    || '(Regular days official hours)';
  
  const saturdayLabel = formatScheduleDisplay(officialHoursSatStart.value) 
    || '(Saturdays official hours)';
  const inChargeName = document.getElementById('inChargeName').value.trim() || 'Juan Dela Cruz';

  const rows = Array.from(dataEntryTableBody.querySelectorAll('tr')).map((row) => {
    const day = row.querySelector('td:nth-child(2)').textContent;
    const dayType = row.querySelector('[data-field="dayType"]').value;
    const amArr = row.querySelector('[data-field="amArr"]').value.trim();
    const amDep = row.querySelector('[data-field="amDep"]').value.trim();
    const pmArr = row.querySelector('[data-field="pmArr"]').value.trim();
    const pmDep = row.querySelector('[data-field="pmDep"]').value.trim();
    const hours = row.querySelector('[data-field="hours"]').value;
    const minutes = row.querySelector('[data-field="minutes"]').value;

    const amArrDisplay = amArr ? formatTimePickerValue(amArr) : '';
    const amDepDisplay = amDep ? formatTimePickerValue(amDep) : '';
    const pmArrDisplay = pmArr ? formatTimePickerValue(pmArr) : '';
    const pmDepDisplay = pmDep ? formatTimePickerValue(pmDep) : '';

    if (dayType !== 'normal') {
      const label = dayType === 'saturday' ? 'SATURDAY' : dayType === 'sunday' ? 'SUNDAY' : 'HOLIDAY';
      return `
      <tr>
        <td>${day}</td>
        <td colspan="4" class="special-day">${label}</td>
        <td></td>
        <td></td>
      </tr>`;
    }

    return `
      <tr>
        <td>${day}</td>
        <td>${amArrDisplay}</td>
        <td>${amDepDisplay}</td>
        <td>${pmArrDisplay}</td>
        <td>${pmDepDisplay}</td>
        <td>${hours}</td>
        <td>${minutes}</td>
      </tr>`;
  }).join('');

  const sheetHtml = `
    <div class="record-sheet">
      <div class="record-header">
        <div class="form-id">CIVIL SERVICE FORM No. 48</div>
        <div class="check-box"></div>
      </div>
      <div class="record-title">DAILY TIME RECORD</div>
      <div class="record-name">${upperName}</div>
      <div class="record-name-label">(Name)</div>
      <div class="field-row">
        <div class="field-label-block">
          <span>For the month of</span>
        </div>
        <div class="field-box">
          <span class="field-text">${monthLabel}</span>
        </div>
      </div>
      <div class="field-row">
        <div class="field-label-block">
          <span>Official hours for arrival</span>
          <span>and departure</span>
        </div>
        <div class="field-box">
          <span class="field-text">${regularLabel}</span>
          <span class="field-note">(Regular days)</span>
        </div>
        <div class="field-box">
          <span class="field-text">${saturdayLabel}</span>
          <span class="field-note">(Saturdays)</span>
        </div>
      </div>
      <table>
        <thead>
          <tr>
            <th>Day</th>
            <th colspan="2">AM</th>
            <th colspan="2">PM</th>
            <th colspan="2">UNDER TIME</th>
          </tr>
          <tr>
            <th></th>
            <th>Arrival</th>
            <th>Departure</th>
            <th>Arrival</th>
            <th>Departure</th>
            <th>Hours</th>
            <th>Minutes</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
      <div class="footer-text">
        I CERTIFY on my honor that the above is true and correct report of the hours of work performed, record of which was made daily at the time of arrival at and departure from office.
      </div>
      <div class="signature-section">
        <div class="signature-block">
          <div class="signature-line"></div>
          <div class="signature-text">Signature over printed name</div>
        </div>
        <div class="signature-block">
          <div class="signature-line"></div>
          <div class="signature-text">Verified as to the prescribed office hours.</div>
        </div>
      </div>
      <div class="in-charge">${inChargeName}</div>
      <div class="in-charge">In Charge</div>
    </div>
  `;

  recordPreview.innerHTML = `<div class="records-grid">${sheetHtml.repeat(4)}</div>`;
}

generateButton.addEventListener('click', buildRecordPreview);
clearButton.addEventListener('click', () => {
  employeeName.value = '';
  officialHoursRegularStart.value = '';
  officialHoursSatStart.value = '';
  recordPreview.innerHTML = '';
  buildTable();
});

reportMonth.addEventListener('change', buildTable);
officialHoursRegularStart.addEventListener('change', () => {
  buildTable();
  lunchNoteRegular.textContent = parseScheduleValue(officialHoursRegularStart.value)?.lunchBreak > 0 
    ? '(with 1-hour lunch break)' 
    : '(no lunch break)';
});
officialHoursSatStart.addEventListener('change', () => {
  buildTable();
  lunchNoteSat.textContent = parseScheduleValue(officialHoursSatStart.value)?.lunchBreak > 0 
    ? '(with lunch break)' 
    : '(no lunch break)';
});

printButton.addEventListener('click', () => {
  if (recordPreview.innerHTML.trim() === '') {
    buildRecordPreview();
  }
  window.print();
});

function exportToExcel() {
  const name = employeeName.value.trim() || 'Employee';
  const monthLabel = formatMonthYear(reportMonth.value) || 'Month-Year';
  
  // Prepare CSV data
  let csvContent = `Daily Time Record - ${name} - ${monthLabel}\n\n`;
  csvContent += 'Day,Type,AM Arrival,AM Departure,PM Arrival,PM Departure,Under Time Hours,Under Time Minutes\n';
  
  // Add data rows
  Array.from(dataEntryTableBody.querySelectorAll('tr')).forEach((row) => {
    const day = row.querySelector('td:nth-child(2)').textContent;
    const dayType = row.querySelector('[data-field="dayType"]').value;
    const amArr = row.querySelector('[data-field="amArr"]').value.trim();
    const amDep = row.querySelector('[data-field="amDep"]').value.trim();
    const pmArr = row.querySelector('[data-field="pmArr"]').value.trim();
    const pmDep = row.querySelector('[data-field="pmDep"]').value.trim();
    const hours = row.querySelector('[data-field="hours"]').value;
    const minutes = row.querySelector('[data-field="minutes"]').value;
    
    const amArrDisplay = amArr ? formatTimePickerValue(amArr) : '';
    const amDepDisplay = amDep ? formatTimePickerValue(amDep) : '';
    const pmArrDisplay = pmArr ? formatTimePickerValue(pmArr) : '';
    const pmDepDisplay = pmDep ? formatTimePickerValue(pmDep) : '';
    
    const typeLabel = dayType === 'normal' ? 'Normal' : 
                     dayType === 'saturday' ? 'Saturday' : 
                     dayType === 'sunday' ? 'Sunday' : 'Holiday';
    
    csvContent += `${day},"${typeLabel}","${amArrDisplay}","${amDepDisplay}","${pmArrDisplay}","${pmDepDisplay}",${hours},${minutes}\n`;
  });
  
  // Add summary information
  csvContent += '\n\nSummary:\n';
  csvContent += `Employee Name: ${name}\n`;
  csvContent += `Month/Year: ${monthLabel}\n`;
  csvContent += `Regular Schedule: ${formatScheduleDisplay(officialHoursRegularStart.value) || 'Not set'}\n`;
  csvContent += `Saturday Schedule: ${formatScheduleDisplay(officialHoursSatStart.value) || 'Not set'}\n`;
  csvContent += `In Charge: ${document.getElementById('inChargeName').value.trim() || 'Not set'}\n`;
  
  // Create and download the file
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `DTR_${name.replace(/\s+/g, '_')}_${monthLabel.replace(/\s+/g, '_')}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function importFromExcel() {
  fileInput.click();
}

function parseCSV(content) {
  const lines = content.split('\n').map(line => line.trim());
  let dataStartIndex = -1;
  let summaryStartIndex = -1;
  
  // Find the data section and summary section
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('Day,Type,')) {
      dataStartIndex = i + 1; // Data starts after header
    }
    if (lines[i].startsWith('Summary:')) {
      summaryStartIndex = i + 1;
      break;
    }
  }
  
  if (dataStartIndex === -1) {
    alert('Invalid CSV format. Could not find data section.');
    return;
  }
  
  // Parse summary information FIRST to set month/year and schedules
  if (summaryStartIndex !== -1) {
    for (let i = summaryStartIndex; i < lines.length; i++) {
      const line = lines[i];
      if (line.startsWith('Employee Name:')) {
        employeeName.value = line.replace('Employee Name:', '').trim();
      } else if (line.startsWith('Month/Year:')) {
        const monthYear = line.replace('Month/Year:', '').trim();
        // Try to parse month year back to date format
        const date = new Date(monthYear + ' 1');
        if (!isNaN(date)) {
          reportMonth.value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        }
      } else if (line.startsWith('Regular Schedule:')) {
        const schedule = line.replace('Regular Schedule:', '').trim();
        officialHoursRegularStart.value = findScheduleValueByDisplay(schedule, officialHoursRegularStart);
      } else if (line.startsWith('Saturday Schedule:')) {
        const schedule = line.replace('Saturday Schedule:', '').trim();
        officialHoursSatStart.value = findScheduleValueByDisplay(schedule, officialHoursSatStart);
      } else if (line.startsWith('In Charge:')) {
        document.getElementById('inChargeName').value = line.replace('In Charge:', '').trim();
      }
    }
  }
  
  // Parse data rows
  const dataRows = [];
  for (let i = dataStartIndex; i < lines.length && lines[i] !== 'Summary:'; i++) {
    const line = lines[i];
    if (line && line.trim() && !line.startsWith('Day,')) {
      // Parse CSV line, handling quoted fields
      const fields = parseCSVLine(line);
      if (fields.length >= 8) {
        dataRows.push({
          day: fields[0],
          type: fields[1].replace(/"/g, ''),
          amArrival: fields[2].replace(/"/g, ''),
          amDeparture: fields[3].replace(/"/g, ''),
          pmArrival: fields[4].replace(/"/g, ''),
          pmDeparture: fields[5].replace(/"/g, ''),
          underTimeHours: fields[6],
          underTimeMinutes: fields[7]
        });
      }
    }
  }
  
  // Clear current table and rebuild
  dataEntryTableBody.innerHTML = '';
  const days = getDaysInMonth(reportMonth.value);
  
  for (let day = 1; day <= days; day++) {
    const row = createRow(day);
    
    // Find matching data for this day
    const dayData = dataRows.find(d => parseInt(d.day, 10) === day);
    if (dayData) {
      // Set day type
      const dayTypeSelect = row.querySelector('[data-field="dayType"]');
      const typeValue = dayData.type.toLowerCase();
      if (['normal', 'saturday', 'sunday', 'holiday'].includes(typeValue)) {
        dayTypeSelect.value = typeValue;
        dayTypeSelect.dispatchEvent(new Event('change'));
      }
      
      // Set time values (convert from 12-hour to 24-hour format)
      if (dayData.amArrival) {
        row.querySelector('[data-field="amArr"]').value = convertTo24Hour(dayData.amArrival);
      }
      if (dayData.amDeparture) {
        row.querySelector('[data-field="amDep"]').value = convertTo24Hour(dayData.amDeparture);
      }
      if (dayData.pmArrival) {
        row.querySelector('[data-field="pmArr"]').value = convertTo24Hour(dayData.pmArrival);
      }
      if (dayData.pmDeparture) {
        row.querySelector('[data-field="pmDep"]').value = convertTo24Hour(dayData.pmDeparture);
      }

      const inputs = row.querySelectorAll('input[type="time"]');
      inputs.forEach(input => input.dispatchEvent(new Event('input')));
    }
    
    dataEntryTableBody.appendChild(row);
  }
  
  lunchNoteRegular.textContent = parseScheduleValue(officialHoursRegularStart.value)?.lunchBreak > 0 
    ? '(with 1-hour lunch break)' 
    : '(no lunch break)';
  lunchNoteSat.textContent = parseScheduleValue(officialHoursSatStart.value)?.lunchBreak > 0 
    ? '(with lunch break)' 
    : '(no lunch break)';
}

function findScheduleValueByDisplay(display, selectElement) {
  if (!display) return '';
  const parts = display.split(' - ').map(part => part.trim());
  if (parts.length !== 2) return '';
  const start = convertTo24Hour(parts[0]);
  const end = convertTo24Hour(parts[1]);
  const option = Array.from(selectElement.options).find(opt => opt.value.startsWith(`${start}-${end}-`));
  return option ? option.value : '';
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

function convertTo24Hour(time12h) {
  if (!time12h) return '';
  
  // Parse 12-hour format like "8:55 AM" or "5:00 PM"
  const match = time12h.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return time12h;
  
  let [_, hours, minutes, period] = match;
  hours = parseInt(hours);
  minutes = parseInt(minutes);
  
  if (period.toUpperCase() === 'PM' && hours !== 12) {
    hours += 12;
  } else if (period.toUpperCase() === 'AM' && hours === 12) {
    hours = 0;
  }
  
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function handleFileSelect(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      parseCSV(e.target.result);
      alert('Data imported successfully!');
    } catch (error) {
      alert('Error importing file: ' + error.message);
    }
  };
  reader.readAsText(file);
  
  // Reset file input
  fileInput.value = '';
}

saveButton.addEventListener('click', exportToExcel);

importButton.addEventListener('click', importFromExcel);
fileInput.addEventListener('change', handleFileSelect);

if (!reportMonth.value) {
  const today = new Date();
  reportMonth.value = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
}

buildTable();
