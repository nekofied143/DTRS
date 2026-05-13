const employeeName = document.getElementById('employeeName');
const inChargeName = document.getElementById('inChargeName');
const reportMonth = document.getElementById('reportMonth');
const importButton = document.getElementById('importButton');
const saveButton = document.getElementById('saveButton');
const clearButton = document.getElementById('clearButton');
const fileInput = document.getElementById('fileInput');
const recordPreview = document.getElementById('recordPreview');
const dataEntryTableBody = document.querySelector('#dataEntryTable tbody');
const printButton = document.getElementById('printButton');
const scheduleTableBody = document.querySelector('#scheduleTable tbody');

// Modal elements
const scheduleModal = document.getElementById('scheduleModal');
const openScheduleModal = document.getElementById('openScheduleModal');
const closeModal = document.querySelector('.close');
const instructionsModal = document.getElementById('instructionsModal');
const openInstructionsModal = document.getElementById('openInstructionsModal');
const closeInstructionsModal = document.getElementById('closeInstructionsModal');
const prevMonth = document.getElementById('prevMonth');
const nextMonth = document.getElementById('nextMonth');
const calendarMonthYear = document.getElementById('calendarMonthYear');
const calendarDays = document.getElementById('calendarDays');
const modalScheduleTemplate = document.getElementById('modalScheduleTemplate');
const applySchedule = document.getElementById('applySchedule');
const cancelSchedule = document.getElementById('cancelSchedule');

let schedules = []; // Array of {startDate, endDate, start, end, lunchBreak, label, value}
let selectedDates = new Set(); // Set of selected date strings
let currentCalendarDate = new Date();
let philippinesHolidays = {}; // Changed to an object for faster lookup
let dataRows = [];

function showToast(message, type = "info") {
  const container = document.getElementById("toastContainer");

  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;

  container.appendChild(toast);

  setTimeout(() => toast.classList.add("show"), 10);

  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 250);
  }, 3000);
}

function showScheduleError(message) {
  const panel = document.getElementById("scheduleErrorPanel");
  panel.style.display = "block";
  panel.textContent = message;
}

function clearScheduleError() {
  const panel = document.getElementById("scheduleErrorPanel");
  panel.style.display = "none";
  panel.textContent = "";
}

function clearmodalScheduleTemplate() {
  modalScheduleTemplate.value = '';
}

function getReportYearMonth() {
  if (!reportMonth.value) return null;
  const [y, m] = reportMonth.value.split('-').map(Number);
  if (!y || !m) return null;
  return { year: y, month: m };
}

function toggleDTRVisibility() {
  const hasName = employeeName.value.trim() !== '';
  const hasMonth = reportMonth.value.trim() !== '';
  const hasInCharge = inChargeName.value.trim() !== '';
  const hasSchedule = schedules.length > 0;

  const tableWrapper = document.querySelector('.table-wrapper');
  const previewSection = document.querySelector('.preview-section');
  const scheduleManagement = document.querySelector('.schedule-management');

  // ✅ individual buttons (so they are NOT hidden)
  const generateButton = document.getElementById('generateButton');
  const importButton = document.getElementById('importButton');
  const saveButton = document.getElementById('saveButton');
  const clearButton = document.getElementById('clearButton');

  const shouldShow =
    employeeName.value.trim() !== '' &&
    reportMonth.value.trim() !== '' &&
    inChargeName.value.trim() !== '';

  if (shouldShow) {
    tableWrapper.style.display = '';
    previewSection.style.display = '';

    // keep buttons visible
    generateButton.style.display = '';
    importButton.style.display = '';
    saveButton.style.display = '';
    clearButton.style.display = '';
  } else {
    tableWrapper.style.display = 'none';
    previewSection.style.display = 'none';

    // ❌ DO NOT hide buttons anymore
    generateButton.style.display = '';
    importButton.style.display = '';
    saveButton.style.display = '';
    clearButton.style.display = '';
  }

  // keep schedule management visible at all times
  scheduleManagement.style.display = '';

  // console.log({
  //   hasName,
  //   hasMonth,
  //   hasInCharge,
  //   hasSchedule,
  //   schedules
  // });
}

async function fetchHolidays(year) {
  try {
    const response = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/PH`);
    if (response.ok) {
      const data = await response.json();
      // Store as { "2024-12-25": "Christmas Day" }
      philippinesHolidays = data.reduce((acc, holiday) => {
        acc[holiday.date] = holiday.localName;
        return acc;
      }, {});
      buildTable();
    }
  } catch (error) {
    console.error("Failed to fetch holidays:", error);
  }
}

function getHolidayName(day) {
  const ym = getReportYearMonth();
  if (!ym) return;
  const { year, month } = ym;
  const dateStr = `${year}-${pad(month)}-${pad(day)}`;
  return philippinesHolidays[dateStr] || null;
}

document.querySelector('.primary-btn').addEventListener('click', function () {
  const formSection = document.querySelector('.form-section');
  const nameInput = document.getElementById('employeeName');

  // Scroll to form
  formSection.scrollIntoView({ behavior: 'smooth' });

  // Highlight effect
  formSection.classList.add('highlight');
  setTimeout(() => {
    formSection.classList.remove('highlight');
  }, 1000);

  // Focus after scroll
  setTimeout(() => {
    nameInput.focus();
  }, 500);
});

let importedFileHandle = null;
let importedExistingFile = false;

function pad(value) {
  return String(value).padStart(2, '0');
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
  const ym = getReportYearMonth();
  if (!ym) return null;

  const { year, month } = ym;
  const dateStr = `${year}-${pad(month)}-${pad(day)}`;

  const schedule = schedules.find(s =>
    dateStr >= s.startDate && dateStr <= s.endDate
  );

  if (!schedule) return null;

  let start = schedule.start;
  let end = schedule.end;
  const lunch = schedule.lunchBreak || 0;

  // 🔥 FIX: handle overnight schedule
  if (end <= start) {
    end += 1440; // extend to next day
  }

  const total = end - start - lunch;

  return total > 0 ? total : 0;
}

function getDefaultDayType(day) {
  const ym = getReportYearMonth();
  if (!ym) return;
  const { year, month } = ym;
  if (!year || !month) return 'normal';

  if (getHolidayName(day)) return 'holiday';

  const date = new Date(year, month - 1, day);
  if (date.getDay() === 0) return 'sunday';
  if (date.getDay() === 6) return 'saturday';

  return 'normal';
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
        <option value="restday">Rest Day</option>
      </select>
    </td>
    <td>${day}</td>
    <td><input class="table-input" type="time" step="60" data-field="amArr" /></td>
    <td><input class="table-input" type="time" step="60" data-field="amDep" /></td>
    <td><input class="table-input" type="time" step="60" data-field="pmArr" /></td>
    <td><input class="table-input" type="time" step="60" data-field="pmDep" /></td>
    <td><input class="table-input" type="time" step="60" data-field="nextOut" /></td>
    <td><input class="table-input" data-field="hours" readonly /></td>
    <td><input class="table-input" data-field="minutes" readonly /></td>
  `;

  const defaultDayType = getDefaultDayType(day);
  const dayTypeSelect = row.querySelector('[data-field="dayType"]');
  dayTypeSelect.value = defaultDayType;

  const inputs = row.querySelectorAll('[data-field]');

  const updateUnderTime = () => {
    const dayType = row.querySelector('[data-field="dayType"]').value;

    const amArr = row.querySelector('[data-field="amArr"]').value;
    const amDep = row.querySelector('[data-field="amDep"]').value;
    const pmArr = row.querySelector('[data-field="pmArr"]').value;
    const pmDep = row.querySelector('[data-field="pmDep"]').value;
    const nextOut = row.querySelector('[data-field="nextOut"]').value;

    const hoursInput = row.querySelector('[data-field="hours"]');
    const minutesInput = row.querySelector('[data-field="minutes"]');

    const timeInputs = row.querySelectorAll('input[type="time"]');

    // ❌ Disable non-working days; working days are fillable only if a schedule covers the date
    const ym = getReportYearMonth();
    if (!ym) return;
    const { year, month } = ym;
    const dateStr = `${year}-${pad(month)}-${pad(day)}`;
    const hasSchedule = schedules.some(s => dateStr >= s.startDate && dateStr <= s.endDate);

    if (dayType !== 'normal' || !hasSchedule) {
      timeInputs.forEach(input => {
        input.value = '';
        input.disabled = true;
      });
      hoursInput.value = '';
      minutesInput.value = '';
      return;
    }

    timeInputs.forEach(input => input.disabled = false);

    // =========================
    // PARSE INPUT TIMES
    // =========================
    const amArrTime = parseTimePickerValue(amArr);
    const amDepTime = parseTimePickerValue(amDep);
    const pmArrTime = parseTimePickerValue(pmArr);
    const pmDepTime = parseTimePickerValue(pmDep);
    const nextOutTime = parseTimePickerValue(nextOut);

    const hasAny =
      amArrTime !== null ||
      amDepTime !== null ||
      pmArrTime !== null ||
      pmDepTime !== null ||
      nextOutTime !== null;

    if (!hasAny) {
      hoursInput.value = '';
      minutesInput.value = '';
      return;
    }

    // =========================
    // GET SCHEDULE
    // =========================
    const date = new Date(year, month - 1, day);

    // Find the schedule that covers this date
    const schedule = schedules.find(s => dateStr >= s.startDate && dateStr <= s.endDate);

    let scheduleStart, scheduleEnd, lunchBreak;
    let isOvernight = false;

    if (schedule) {
      scheduleStart = schedule.start;
      scheduleEnd = schedule.end;
      lunchBreak = schedule.lunchBreak;
    }

    if (typeof scheduleStart !== 'number' || typeof scheduleEnd !== 'number') {
      hoursInput.value = '';
      minutesInput.value = '';
      return;
    }

    // =========================
    // OVERNIGHT FIX (CRITICAL)
    // =========================
    if (scheduleEnd <= scheduleStart) {
      isOvernight = true;
      scheduleEnd += 1440; // extend to next day
    }

    const normalize = (t, isEnd = false) => {
      if (t === null) return null;

      if (!isOvernight) return t;

      // Only shift END times OR times clearly after midnight context
      if (isEnd) {
        if (t < scheduleStart) return t + 1440;
      } else {
        // IN times: only shift if they are truly "after midnight shift start context"
        if (t < scheduleStart && t <= 720) {
          return t + 1440;
        }
      }

      return t;
    };

    const nAmArr = normalize(amArrTime, false);
    const nAmDep = normalize(amDepTime, false);
    const nPmArr = normalize(pmArrTime, false);
    const nPmDep = normalize(pmDepTime, false);
    const nNextOut = normalize(nextOutTime, true);

    // =========================
    // CALCULATION
    // =========================
    let total = 0;

    if (lunchBreak > 0) {
      // =========================
      // WITH LUNCH BREAK
      // =========================

      const shiftDuration = scheduleEnd - scheduleStart;

      const lunchStart =
        scheduleStart +
        Math.floor(shiftDuration / 2) -
        Math.floor(lunchBreak / 2);

      const lunchEnd = lunchStart + lunchBreak;

      const morning =
        (nAmArr !== null && nAmDep !== null)
          ? Math.max(0, Math.min(nAmDep, lunchStart) - Math.max(nAmArr, scheduleStart))
          : 0;

      const effectivePmDep = nPmDep !== null ? nPmDep : nNextOut;
      const afternoon =
        (nPmArr !== null && effectivePmDep !== null)
          ? Math.max(0, Math.min(effectivePmDep, scheduleEnd) - Math.max(nPmArr, lunchEnd))
          : 0;

      total = morning + afternoon;

    } else {
      // =========================
      // NO LUNCH (CONTINUOUS SHIFT)
      // =========================

      const times = [nAmArr, nAmDep, nPmArr, nPmDep, nNextOut]
        .filter(t => t !== null)
        .sort((a, b) => a - b);

      if (times.length >= 2) {
        const start = times[0];
        let end = times[times.length - 1];

        // 🔥 FIX OVERNIGHT END
        if (isOvernight && end < scheduleStart) {
          end += 1440;
        }

        const workStart = Math.max(start, scheduleStart);
        const workEnd = Math.min(end, scheduleEnd);

        total = Math.max(0, workEnd - workStart);
      } else {
        total = 0;
      }
    }

    // =========================
    // EXPECTED TIME CHECK
    // =========================
    const expected = getExpectedMinutesForDay(day);

    if (expected !== null && total < expected) {
      const undertime = expected - total;
      hoursInput.value = Math.floor(undertime / 60);
      minutesInput.value = pad(undertime % 60);
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

  updateUnderTime();

  return row;
}

// updateUnderTimeCalculations
function updateUnderTimeCalculations() {
  const rows = dataEntryTableBody.querySelectorAll('tr');
  rows.forEach((row) => {
    const inputs = row.querySelectorAll('input');
    inputs.forEach((input) => {
      if (input.dataset.field !== 'hours' && input.dataset.field !== 'minutes') {
        input.dispatchEvent(new Event('input'));
      }
    });
  });
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

function formatDateRange(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const startMonth = start.toLocaleDateString('en-US', { month: 'long' });
  const endMonth = end.toLocaleDateString('en-US', { month: 'long' });
  const startDay = start.getDate();
  const endDay = end.getDate();
  const year = start.getFullYear();

  if (startMonth === endMonth && year === end.getFullYear()) {
    return `${startMonth} ${startDay}-${endDay}, ${year}`;
  } else {
    return `${startMonth} ${startDay} - ${endMonth} ${endDay}, ${year}`;
  }
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

// Schedule Management Functions
function applySelectedSchedule() {
  clearScheduleError();
  const template = modalScheduleTemplate.value;
  if (!template) {
    showToast('Please select a schedule template.', 'error');
    return;
  }

  if (selectedDates.size === 0) {
    showToast('Please select at least one date.', 'error');
    return;
  }

  const schedule = parseScheduleValue(template);
  if (!schedule) {
    showToast('Invalid schedule template.', 'error');
    return;
  }

  const label = modalScheduleTemplate.options[modalScheduleTemplate.selectedIndex].text;

  // Sort selected dates
  const sortedDates = Array.from(selectedDates).sort();

  // Group into ranges
  const ranges = [];
  let start = sortedDates[0];
  let end = sortedDates[0];

  for (let i = 1; i < sortedDates.length; i++) {
    const current = sortedDates[i];
    const prev = sortedDates[i - 1];
    const prevDate = new Date(prev);
    const currentDate = new Date(current);
    const diff = (currentDate - prevDate) / (1000 * 60 * 60 * 24);

    if (diff === 1) {
      end = current;
    } else {
      ranges.push({ start, end });
      start = current;
      end = current;
    }
  }
  ranges.push({ start, end });

  const conflicts = [];

  // 1. CHECK EVERYTHING FIRST (NO MUTATION)
  for (const range of ranges) {
    const conflict = schedules.find(s =>
      range.start <= s.endDate && range.end >= s.startDate
    );

    if (conflict) {
      conflicts.push({
        range,
        conflict
      });
    }
  }

  // 2. STOP IF ANY CONFLICT EXISTS
  if (conflicts.length > 0) {
    const first = conflicts[0];

    const conflictIndex = schedules.findIndex(s =>
      first.range.start <= s.endDate &&
      first.range.end >= s.startDate
    );

    showScheduleError(
      `Schedule conflict detected (${first.range.start} → ${first.range.end})`
    );

    scheduleModal.style.display = 'block';
    scheduleModal.scrollTop = 0;
    displaySchedules();

    if (conflictIndex !== -1) {
      highlightScheduleRow(conflictIndex);
    }

    return; // ❗ nothing gets saved
  }

  // 3. ONLY NOW: SAFE TO APPLY ALL RANGES
  for (const range of ranges) {
    schedules.push({
      startDate: range.start,
      endDate: range.end,
      start: schedule.start,
      end: schedule.end,
      lunchBreak: schedule.lunchBreak,
      label,
      value: template
    });
  }
  displaySchedules();
  buildTable();
  applyCSVData();
  recalculateAllRows();
  scheduleModal.style.display = 'none';
  selectedDates.clear();
  toggleDTRVisibility();
}

function generateCalendar() {
  const year = currentCalendarDate.getFullYear();
  const month = currentCalendarDate.getMonth();

  calendarMonthYear.textContent =
    currentCalendarDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDate = new Date(firstDay);
  startDate.setDate(startDate.getDate() - firstDay.getDay());

  calendarDays.innerHTML = '';

  const endDate = new Date(lastDay);
  endDate.setDate(endDate.getDate() + (6 - lastDay.getDay()));

  for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
    const dayDiv = document.createElement('div');
    dayDiv.className = 'calendar-day';
    dayDiv.textContent = date.getDate();

    const dateStr =
      `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

    // existing schedules highlight
    const hasSchedule = schedules.some(s =>
      dateStr >= s.startDate && dateStr <= s.endDate
    );

    if (hasSchedule) {
      dayDiv.classList.add('has-schedule');
    }

    // user selection highlight
    if (selectedDates.has(dateStr)) {
      dayDiv.classList.add('selected');
    }

    const isOtherMonth = date.getMonth() !== month;

    if (isOtherMonth) {
      dayDiv.classList.add('other-month');
    }

    dayDiv.addEventListener('click', () => {
      if (isOtherMonth) {
        return; // prevent selecting inactive dates outside the current month
      }

      if (selectedDates.has(dateStr)) {
        selectedDates.delete(dateStr);
        dayDiv.classList.remove('selected');
      } else {
        selectedDates.add(dateStr);
        dayDiv.classList.add('selected');
      }
    });

    calendarDays.appendChild(dayDiv);
  }
}

function displaySchedules() {
  scheduleTableBody.innerHTML = '';

  schedules.forEach((schedule, index) => {
    const row = document.createElement('tr');

    row.dataset.index = index; // 👈 important for jumping

    row.innerHTML = `
      <td>${schedule.startDate}</td>
      <td>${schedule.endDate}</td>
      <td>${schedule.label}</td>
      <td><button data-index="${index}">Delete</button></td>
    `;

    scheduleTableBody.appendChild(row);
  });

  scheduleTableBody.querySelectorAll('button[data-index]').forEach(button => {
    button.addEventListener('click', (e) => {
      deleteSchedule(parseInt(e.target.dataset.index));
    });
  });
}

function highlightScheduleRow(index) {
  const row = scheduleTableBody.querySelector(`tr[data-index="${index}"]`);
  if (!row) return;

  row.classList.add('highlight-row');

  row.scrollIntoView({
    behavior: 'smooth',
    block: 'center'
  });

  setTimeout(() => {
    row.classList.remove('highlight-row');
  }, 2000);
}

function deleteSchedule(index) {
  schedules.splice(index, 1);
  displaySchedules();
  buildTable();
  applyCSVData();
  recalculateAllRows();
  toggleDTRVisibility();
}

function buildRecordPreview() {
  if (!employeeName.value.trim() || !reportMonth.value || schedules.length === 0) {
    showToast('Please fill in Employee Name, Month/Year, and add at least one schedule before generating the preview.', 'error');
    return;
  }

  const name = employeeName.value.trim();
  const upperName = name.toUpperCase();
  const monthLabel = formatMonthYear(reportMonth.value) || '‎';

  // For preview, use the first schedule as default or find one for the month
  const defaultSchedule = schedules[0];
  const regularLabel = defaultSchedule ? formatScheduleDisplay(`${pad(Math.floor(defaultSchedule.start / 60))}:${pad(defaultSchedule.start % 60)}-${pad(Math.floor(defaultSchedule.end / 60))}:${pad(defaultSchedule.end % 60)}-${defaultSchedule.lunchBreak}`) : '‎';

  const previewInChargeName = document.getElementById('inChargeName').value.trim() || '‎';

  const rows = Array.from(dataEntryTableBody.querySelectorAll('tr')).map((row) => {
    const day = row.querySelector('td:nth-child(2)').textContent;
    const dayType = row.querySelector('[data-field="dayType"]').value;
    const amArr = row.querySelector('[data-field="amArr"]').value.trim();
    const amDep = row.querySelector('[data-field="amDep"]').value.trim();
    const pmArr = row.querySelector('[data-field="pmArr"]').value.trim();
    const pmDep = row.querySelector('[data-field="pmDep"]').value.trim();
    const nextOut = row.querySelector('[data-field="nextOut"]').value.trim();
    const hours = row.querySelector('[data-field="hours"]').value;
    const minutes = row.querySelector('[data-field="minutes"]').value;

    const amArrDisplay = amArr ? formatTimePickerValue(amArr) : '';
    const amDepDisplay = amDep ? formatTimePickerValue(amDep) : '';
    const pmArrDisplay = pmArr ? formatTimePickerValue(pmArr) : '';
    const pmDepDisplay = pmDep ? formatTimePickerValue(pmDep) : '';
    const nextOutDisplay = nextOut ? formatTimePickerValue(nextOut) : '';

    // Inside buildRecordPreview() row mapping:
    if (dayType !== 'normal') {
      let label = '';
      if (dayType === 'holiday') {
        // Use the specific name from our holiday object, fallback to "HOLIDAY"
        label = getHolidayName(parseInt(day)) || 'HOLIDAY';
      } else if (dayType === 'saturday') {
        label = 'SATURDAY';
      } else if (dayType === 'sunday') {
        label = 'SUNDAY';
      } else if (dayType === 'restday') {
        label = 'REST DAY';
      }

      return `
      <tr>
        <td>${day}</td>
        <td colspan="4" class="special-day" style="text-align: center; font-weight: bold; font-size: 0.8em;">${label.toUpperCase()}</td>
        <td></td>
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
        <td>${nextOutDisplay}</td>
        <td>${hours}</td>
        <td>${minutes}</td>
      </tr>`;
  }).join('');

  const sheetHtml = `
    <div class="record-sheet">
      <div class="record-header">
        <div class="form-id">CIVIL SERVICE FORM No. 48</div>
      </div>
      <div class="record-title-row">
      <div class="record-title">DAILY TIME RECORD</div>
      <div class="check-box"></div>
      </div>
      <div class="record-name">${upperName}</div>
      <div class="record-name-label">(Name)</div>
      <div class="field-row">
        <div class="field-label-block">
          <span>For the month of</span>
        </div>
        <div class="field-box">
          <span class="field-text">${monthLabel}</span>
        </div>
        <br>
        <div class="schedules-preview">
        <div class="schedules-title">Schedule/s:</div>
        ${schedules.map(s => `<div class="schedule-item">${formatDateRange(s.startDate, s.endDate)}: ${formatScheduleDisplay(s.value)}</div>`).join('')}
        </div>
      </div>
      <div class="field-row">
      </div>
      <table>
        <thead>
          <tr>
            <th>Day</th>
            <th colspan="2">AM</th>
            <th colspan="2">PM</th>
            <th>NDO</th>
            <th colspan="2">UNDER TIME</th>
          </tr>
          <tr>
            <th></th>
            <th>In</th>
            <th>Out</th>
            <th>In</th>
            <th>Out</th>
            <th>Out</th>
            <th>hr</th>
            <th>min</th>
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
          <div class="employee-name">${name}</div>
          <div class="signature-line"></div>
          <div class="signature-text">Signature over printed name</div>
        </div>
      </div>
      <hr class="divider" />
      <div class="signature-block">
          <div class="signature-text">Verified as to the prescribed office hours.</div>
          <div class="in-charge">${previewInChargeName}</div>
          <div class="signature-line"></div>
          <div class="in-charge">In Charge</div>
        </div>
    </div>
  `;

  recordPreview.innerHTML = `<div class="records-grid">${sheetHtml.repeat(2)}</div>`; // repeat 2 for 2 copies on print
  recordPreview.parentElement.classList.add('active');
}

generateButton.addEventListener('click', buildRecordPreview);
clearButton.addEventListener('click', () => {
  importedExistingFile = false;
  importedFileHandle = null;
  importButton.style.display = '';
  saveButton.textContent = 'Export to Excel';
  employeeName.value = '';
  schedules = [];
  displaySchedules();
  recordPreview.innerHTML = '';
  recordPreview.parentElement.classList.remove('active');
  inChargeName.value = '';
  buildTable();
  toggleDTRVisibility();
});

openScheduleModal.addEventListener('click', () => {
  const ym = getReportYearMonth();
  if (!ym) return;
  const { year, month } = ym;
  currentCalendarDate = new Date(year, month - 1, 1);
  scheduleModal.style.display = 'block';
  scheduleModal.scrollTo({ top: 0, behavior: "smooth" });
  generateCalendar();
});

closeModal.addEventListener('click', () => {
  scheduleModal.style.display = 'none';
  selectedDates.clear();
});

closeInstructionsModal.addEventListener('click', () => {
  instructionsModal.style.display = 'none';
});

instructionsModal.addEventListener('click', (event) => {
  if (event.target === instructionsModal) {
    instructionsModal.style.display = 'none';
  }
});

openInstructionsModal.addEventListener('click', () => {
  instructionsModal.style.display = 'block';
});

scheduleModal.addEventListener('click', (event) => {
  if (event.target === scheduleModal) {
    scheduleModal.style.display = 'none';
    selectedDates.clear();
  }
});

cancelSchedule.addEventListener('click', () => {
  scheduleModal.style.display = 'none';
  selectedDates.clear();
  clearScheduleError();
  clearmodalScheduleTemplate();
});

prevMonth.addEventListener('click', () => {
  currentCalendarDate.setMonth(currentCalendarDate.getMonth() - 1);
  generateCalendar();
});

nextMonth.addEventListener('click', () => {
  currentCalendarDate.setMonth(currentCalendarDate.getMonth() + 1);
  generateCalendar();
});

applySchedule.addEventListener('click', applySelectedSchedule);

function handleReportMonthChange() {
  const [year] = reportMonth.value.split('-');
  fetchHolidays(year);
  buildTable();
}

reportMonth.addEventListener('change', handleReportMonthChange);

employeeName.addEventListener('input', toggleDTRVisibility);
reportMonth.addEventListener('change', toggleDTRVisibility);
inChargeName.addEventListener('input', toggleDTRVisibility);


function recalculateAllRows() {
  const rows = dataEntryTableBody.querySelectorAll('tr');

  rows.forEach(row => {
    const inputs = row.querySelectorAll('input[type="time"], select');
    inputs.forEach(input => {
      if (typeof input.oninput === 'function') input.oninput();
      if (typeof input.onchange === 'function') input.onchange();
    });
  });
}

printButton.addEventListener('click', () => {
  if (recordPreview.innerHTML.trim() === '') {
    buildRecordPreview();
  }
  window.print();
});

function buildCSVContent() {
  const name = employeeName.value.trim() || 'Employee';
  const monthLabel = formatMonthYear(reportMonth.value) || 'Month-Year';

  let csvContent = `Daily Time Record - ${name} - ${monthLabel}\n\n`;
  csvContent += 'Day,Type,AM Arrival,AM Departure,PM Arrival,PM Departure,NDO,Under Time Hours,Under Time Minutes\n';

  Array.from(dataEntryTableBody.querySelectorAll('tr')).forEach((row) => {
    const day = parseInt(row.querySelector('td:nth-child(2)').textContent);
    const dayType = row.querySelector('[data-field="dayType"]').value;
    const amArr = row.querySelector('[data-field="amArr"]').value.trim();
    const amDep = row.querySelector('[data-field="amDep"]').value.trim();
    const pmArr = row.querySelector('[data-field="pmArr"]').value.trim();
    const pmDep = row.querySelector('[data-field="pmDep"]').value.trim();
    const nextOut = row.querySelector('[data-field="nextOut"]').value.trim();
    const hours = row.querySelector('[data-field="hours"]').value;
    const minutes = row.querySelector('[data-field="minutes"]').value;

    const amArrDisplay = amArr ? formatTimePickerValue(amArr) : '';
    const amDepDisplay = amDep ? formatTimePickerValue(amDep) : '';
    const pmArrDisplay = pmArr ? formatTimePickerValue(pmArr) : '';
    const pmDepDisplay = pmDep ? formatTimePickerValue(pmDep) : '';
    const nextOutDisplay = nextOut ? formatTimePickerValue(nextOut) : '';

    let typeLabel = '';
    if (dayType === 'holiday') {
      typeLabel = 'Holiday';
    } else {
      typeLabel = dayType.charAt(0).toUpperCase() + dayType.slice(1);
    }

    csvContent += `${day},"${typeLabel}","${amArrDisplay}","${amDepDisplay}","${pmArrDisplay}","${pmDepDisplay}","${nextOutDisplay}",${hours},${minutes}\n`;
  });

  csvContent += '\n\nSummary:\n';
  csvContent += `Employee Name: ${name}\n`;
  csvContent += `Month/Year: ${monthLabel}\n`;
  csvContent += `Schedules: ${schedules.map(s => `${s.startDate}-${s.endDate}: ${s.value}`).join('; ')}\n`;
  csvContent += `In Charge: ${document.getElementById('inChargeName').value.trim() || ''}\n`;

  return csvContent;
}

function exportToExcel() {
  const name = employeeName.value.trim();
  const monthLabel = reportMonth.value;

  // ✅ Prevent export if required fields are blank
  if (!name || !monthLabel) {
    showToast('Please fill in Employee Name and Month/Year before exporting.', 'error');
    return;
  }

  if (schedules.length === 0) {
    showToast('Please add at least one schedule before exporting.', 'error');
    return;
  }

  const csvContent = buildCSVContent();

  const blob = new Blob([csvContent], {
    type: 'text/csv;charset=utf-8;'
  });

  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.href = url;
  link.download = `DTR_${name.replace(/\s+/g, '_')}_${formatMonthYear(monthLabel).replace(/\s+/g, '_')}.csv`;

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

async function overwriteImportedFile() {
  try {
    const csvContent = buildCSVContent();

    const writable = await importedFileHandle.createWritable();
    await writable.write(csvContent);
    await writable.close();

    showToast('File updated successfully.', 'success');

  } catch (error) {
    showToast('Unable to save file.', 'error');
  }
}

async function importFromExcel() {
  if ('showOpenFilePicker' in window) {
    try {
      const [fileHandle] = await window.showOpenFilePicker({
        types: [
          {
            description: 'CSV Files',
            accept: { 'text/csv': ['.csv'] }
          }
        ],
        multiple: false
      });

      const file = await fileHandle.getFile();

      // ✅ 1. Validate file type (extra safety)
      if (!file.name.toLowerCase().endsWith('.csv')) {
        showToast('Invalid file type. Please select a CSV file.', 'error');
        return;
      }

      const content = await file.text();

      // ✅ 2. Basic content validation
      if (!content || !content.includes('Day,Type')) {
        showToast('Invalid CSV format. File does not match DTR structure.', 'error');
        return;
      }

      // ✅ 3. Try parsing safely
      try {
        parseCSV(content);
      } catch (err) {
        showToast('Failed to parse CSV file.', 'error');
        return;
      }

      // ✅ 4. Apply loaded schedules and recalculate
      if (reportMonth.value) {
        const [year] = reportMonth.value.split('-').map(Number);
        await fetchHolidays(year);
      }
      applyCSVData();
      displaySchedules();
      recalculateAllRows();
      toggleDTRVisibility();
      // update under time calculations for all rows
      updateUnderTimeCalculations();


      importedFileHandle = fileHandle;
      importedExistingFile = true;

      importButton.style.display = 'none';
      saveButton.textContent = 'Save';

      showToast('Data imported successfully!', 'success');
      return;

    } catch (error) {
      // user cancelled or picker failed
      // console.log('Import cancelled or failed:', error);
      return;
    }
  }

  fileInput.click();
}

function parseCSV(content) {
  const lines = content.split(/\r?\n/).map(line => line.trim());
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
    showToast('Invalid CSV format. Could not find data section.', 'error');
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
      } else if (line.startsWith('Schedules:')) {
        const schedulesStr = line.replace('Schedules:', '').trim();
        // Parse schedules like "2024-01-01-2024-01-07: 08:00-17:00-60; ..."
        schedules = [];
        if (schedulesStr) {
          const scheduleParts = schedulesStr.split(';');

          schedules = [];

          scheduleParts.forEach(part => {
            const trimmed = part.trim();
            if (!trimmed) return;

            const match = trimmed.match(
              /^(\d{4}-\d{2}-\d{2})-(\d{4}-\d{2}-\d{2})\s*:\s*(\d{2}:\d{2}-\d{2}:\d{2}-\d+)$/
            );

            if (!match) {
              console.warn("Invalid schedule format:", trimmed);
              return;
            }

            const [, startDate, endDate, rawVal] = match;

            const cleanVal = rawVal.trim();
            const schedule = parseScheduleValue(cleanVal);

            if (!schedule) {
              console.warn("Invalid schedule value:", cleanVal);
              return;
            }

            const option = Array.from(modalScheduleTemplate.options)
              .find(opt => opt.value === cleanVal);

            const displayLabel = option ? option.text : cleanVal;

            schedules.push({
              startDate,
              endDate,
              start: schedule.start,
              end: schedule.end,
              lunchBreak: schedule.lunchBreak,
              label: displayLabel,
              value: cleanVal
            });
          });
        }
        buildTable();
        applyCSVData();

        setTimeout(() => {
          recalculateAllRows();
          displaySchedules();
          toggleDTRVisibility();
        }, 0);
      } else if (line.startsWith('In Charge:')) {
        document.getElementById('inChargeName').value = line.replace('In Charge:', '').trim();
      }
    }
  }

  // Parse data rows
  dataRows = [];
  for (let i = dataStartIndex; i < lines.length && lines[i] !== 'Summary:'; i++) {
    const line = lines[i];
    if (line && line.trim() && !line.startsWith('Day,')) {
      // Parse CSV line, handling quoted fields
      const fields = parseCSVLine(line);
      if (fields.length >= 9) {
        dataRows.push({
          day: fields[0],
          type: fields[1].replace(/"/g, ''),
          amArrival: fields[2].replace(/"/g, ''),
          amDeparture: fields[3].replace(/"/g, ''),
          pmArrival: fields[4].replace(/"/g, ''),
          pmDeparture: fields[5].replace(/"/g, ''),
          nextDayOut: fields[6].replace(/"/g, ''),
          underTimeHours: fields[7],
          underTimeMinutes: fields[8]
        });
      } else if (fields.length >= 8) {
        dataRows.push({
          day: fields[0],
          type: fields[1].replace(/"/g, ''),
          amArrival: fields[2].replace(/"/g, ''),
          amDeparture: fields[3].replace(/"/g, ''),
          pmArrival: fields[4].replace(/"/g, ''),
          pmDeparture: fields[5].replace(/"/g, ''),
          nextDayOut: '',
          underTimeHours: fields[6],
          underTimeMinutes: fields[7]
        });
      }
    }
  }
}

function applyCSVData() {
  const rows = dataEntryTableBody.querySelectorAll('tr');

  rows.forEach(row => {
    const day = parseInt(row.querySelector('td:nth-child(2)').textContent);
    const dayData = dataRows.find(d => parseInt(d.day) === day);

    if (!dayData) return;

    row.querySelector('[data-field="dayType"]').value = dayData.type.toLowerCase();

    if (dayData.amArrival)
      row.querySelector('[data-field="amArr"]').value = convertTo24Hour(dayData.amArrival);

    if (dayData.amDeparture)
      row.querySelector('[data-field="amDep"]').value = convertTo24Hour(dayData.amDeparture);

    if (dayData.pmArrival)
      row.querySelector('[data-field="pmArr"]').value = convertTo24Hour(dayData.pmArrival);

    if (dayData.pmDeparture)
      row.querySelector('[data-field="pmDep"]').value = convertTo24Hour(dayData.pmDeparture);

    if (dayData.nextDayOut)
      row.querySelector('[data-field="nextOut"]').value = convertTo24Hour(dayData.nextDayOut);
  });
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
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
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

  reader.onload = function (e) {
    try {
      parseCSV(e.target.result);

      // Apply loaded schedules and recalculate
      if (reportMonth.value) {
        const [year] = reportMonth.value.split('-').map(Number);
        fetchHolidays(year);
      }
      recalculateAllRows();

      importedExistingFile = false; // fallback browser only export
      importedFileHandle = null;

      importButton.style.display = 'none';
      saveButton.textContent = 'Save';

      showToast('Data imported successfully!', 'success');
    } catch (error) {
      showToast('Error importing file: ' + error.message, 'error');
    }
  };

  reader.readAsText(file);
  fileInput.value = '';
}

saveButton.addEventListener('click', async () => {
  if (importedExistingFile && importedFileHandle) {
    await overwriteImportedFile();
  } else {
    exportToExcel();
  }
});

importButton.addEventListener('click', importFromExcel);
fileInput.addEventListener('change', handleFileSelect);

if (!reportMonth.value) {
  const today = new Date();
  reportMonth.value = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
}

buildTable();
toggleDTRVisibility();

// Load holidays for the current year on startup
fetchHolidays(new Date().getFullYear());
