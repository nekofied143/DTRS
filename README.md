# 📊 DTRS — Daily Time Record System

> A lightweight, web-based system for managing employee Daily Time Records (DTR), automating time computation, and processing attendance data through CSV import.

---

## 📌 Overview

DTRS is a frontend-based attendance and time computation system designed to streamline employee record management. It processes CSV-based DTR data and automatically calculates working hours, undertime, and overtime based on configurable shift rules.

This system is intended for **small to medium organizations** that rely on spreadsheet-based attendance workflows.

---

## 🧠 Key Features

### 📥 CSV Import System
- Upload attendance records via CSV
- Automatic parsing and validation

### 🧮 Smart Time Computation
- Automatic total hours calculation
- Overtime and undertime detection
- Flexible shift rule engine (including night shifts)

### 🗓️ Schedule Engine
- Predefined shift templates
- Dynamic per-employee schedule rendering
- Custom time-in/time-out logic support

### 🎯 Holiday Awareness
- Year-based holiday integration
- Automatic adjustment of computed hours

### 👁️ UI Controls
- Toggle DTR visibility
- Preview imported records
- Interactive table-based interface

### ⚡ Real-Time Processing
- Instant recalculation on updates
- No page reload required

---

## 🛠️ Tech Stack

![HTML](https://img.shields.io/badge/HTML5-orange?style=for-the-badge&logo=html5)
![CSS](https://img.shields.io/badge/CSS3-blue?style=for-the-badge&logo=css3)
![JavaScript](https://img.shields.io/badge/JavaScript-yellow?style=for-the-badge&logo=javascript)
![Netlify](https://img.shields.io/badge/Netlify-deploy-success?style=for-the-badge&logo=netlify)

---

## ⚙️ System Workflow

1. Upload CSV attendance file  
2. System parses and structures data  
3. Select reporting month  
4. Apply computation rules:
   - Shift schedules  
   - Holiday adjustments  
   - Time-in / time-out calculations  
5. View computed DTR results instantly  

---

## ⚠️ Limitations

- No backend database (frontend-only system)
- No authentication or role-based access
- Requires properly formatted CSV input
- Designed for small to medium-scale internal use

---

## 👨‍💻 Developer

**nekofied143**

---
