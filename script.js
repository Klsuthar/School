document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const classSelector = document.getElementById('class-selector');
    const studentSelector = document.getElementById('student-selector');
    const studentIdInput = document.getElementById('student-id-input');
    const findBtn = document.getElementById('find-btn');
    const studentDetailsHeader = document.getElementById('student-details-header');
    const testReportsContainer = document.getElementById('test-reports-container');
    const testTypeFilter = document.getElementById('test-type-filter');
    const topPerformersCard = document.getElementById('top-performers-card');
    const topPerformersList = document.getElementById('top-performers-list');
    const topPerformersLoader = document.getElementById('top-performers-loader');
    const studentContentArea = document.getElementById('student-content-area');
    const welcomeMessage = document.getElementById('welcome-message');
    const tabs = document.querySelectorAll('.tab-link');
    const tabContents = document.querySelectorAll('.tab-content');

    // Global variables
    let allClassInfo = [], currentStudentsData = [], studentPerformanceData = [];
    let subjectChartInstance, progressChartInstance;

    // --- INITIALIZATION ---
    async function initialize() {
        // Setup Chart.js global defaults for dark theme
        Chart.defaults.color = '#a9b1d6';
        Chart.defaults.borderColor = '#3b4261';
        await loadClasses();
    }

    // --- NEW: TOP PERFORMERS LOGIC ---
    async function calculateAndDisplayTopPerformers(classFile, studentList) {
        topPerformersList.innerHTML = '';
        topPerformersCard.classList.remove('hidden');
        topPerformersLoader.classList.remove('hidden');

        try {
            const testsDirectory = await fetch('tests-directory.json').then(res => res.json());
            const classTests = testsDirectory.filter(test => test.marksFile.startsWith(classFile.split('.')[0].replace('students_', 'marks_')));

            if (classTests.length === 0) {
                topPerformersList.innerHTML = '<li>No test data available for this class.</li>';
                return;
            }

            const marksPromises = classTests.map(test => fetch(`test_marks/${test.marksFile}`).then(res => res.json()));
            const allClassMarks = await Promise.all(marksPromises);
            
            const studentAverages = studentList.map(student => {
                let totalObtained = 0, totalMax = 0;
                allClassMarks.forEach(test => {
                    const result = test.results.find(r => r.studentId === student.student_id);
                    if (result) {
                        totalObtained += Object.values(result.scores).reduce((a, b) => a + b, 0);
                        const subjectsInTest = test.testInfo.subjects;
                        subjectsInTest.forEach((subj, i) => {
                            totalMax += test.testInfo.maxmarks[i];
                        });
                    }
                });
                const percentage = totalMax > 0 ? (totalObtained / totalMax * 100) : 0;
                return { name: student.name, percentage: percentage.toFixed(2) };
            });

            const topPerformers = studentAverages.sort((a, b) => b.percentage - a.percentage).slice(0, 3);
            renderTopPerformers(topPerformers);

        } catch (error) {
            console.error("Error calculating top performers:", error);
            topPerformersList.innerHTML = '<li>Could not load data.</li>';
        } finally {
            topPerformersLoader.classList.add('hidden');
        }
    }

    function renderTopPerformers(topPerformers) {
        topPerformersList.innerHTML = topPerformers.map((topper, index) => `
            <li class="topper-item">
                <span class="topper-rank">#${index + 1}</span>
                <div class="topper-details">
                    <div class="topper-name">${topper.name}</div>
                    <div class="topper-percentage">${topper.percentage}% Overall</div>
                </div>
            </li>
        `).join('');
    }

    // --- DATA LOADING & PROCESSING (Existing logic, adapted for new UI) ---
    async function handleStudentSelection(studentId, studentClass) {
        if (!studentId || !studentClass) return;
        studentContentArea.classList.remove('hidden');
        welcomeMessage.classList.add('hidden');
        // Reset and show loader can be added here
        
        try {
            const testsDirectory = await fetch('tests-directory.json').then(res => res.json());
            const studentTestsMeta = testsDirectory.filter(test => test.class === studentClass);
            if (studentTestsMeta.length === 0) { /* handle no tests */ return; }

            const marksPromises = studentTestsMeta.map(test => fetch(`test_marks/${test.marksFile}`).then(res => res.json()));
            const allMarksData = await Promise.all(marksPromises);
            processAndStorePerformanceData(studentId, studentTestsMeta, allMarksData);
        } catch (error) { console.error("Error loading performance data:", error); }
    }
    
    function processAndStorePerformanceData(studentId, studentTestsMeta, allMarksData) {
        studentPerformanceData = [];
        allMarksData.forEach((marksData, index) => {
            const studentResult = marksData.results.find(res => res.studentId === studentId);
            if (studentResult) {
                const testMeta = studentTestsMeta[index];
                const testInfo = marksData.testInfo;
                let combinedMaxMarks = {};
                testInfo.subjects.forEach((subj, i) => combinedMaxMarks[subj] = testInfo.maxmarks[i]);
                studentPerformanceData.push({ ...testMeta, scores: studentResult.scores, maxmarks: combinedMaxMarks });
            }
        });
        if (studentPerformanceData.length === 0) { /* handle no data */ return; }
        studentPerformanceData.sort((a, b) => new Date(a.date) - new Date(b.date));
        populateTestFilter(studentPerformanceData);
        renderFilteredPerformance("All Tests");
    }
    
    function renderFilteredPerformance(filterType) {
        const filteredData = filterType === "All Tests" ? studentPerformanceData : studentPerformanceData.filter(test => test.testType === filterType);
        if (filteredData.length === 0) { /* handle no filtered data */ return; }
        renderPerformanceReports(filteredData);
        renderProgressChart(filteredData);
        renderSubjectChart(filteredData);
    }

    function renderPerformanceReports(testData) {
        testReportsContainer.innerHTML = '';
        testData.forEach(test => {
            const reportBlock = document.createElement('div');
            reportBlock.className = 'test-report-block';
            reportBlock.innerHTML = generateReportTableHTML(test);
            testReportsContainer.appendChild(reportBlock);
        });
    }

    function generateReportTableHTML(test) {
        const subjects = Object.keys(test.maxmarks);
        let totalObtained = 0, totalMax = 0;
        let tableRows = subjects.map(subject => {
            const obtained = test.scores[subject] || 0;
            const max = test.maxmarks[subject] || 0;
            const percentage = max > 0 ? (obtained / max * 100).toFixed(1) : 0;
            totalObtained += obtained; totalMax += max;
            return `<tr><td>${subject}</td><td>${obtained}</td><td>${max}</td><td class="percentage ${getPercentageClass(percentage)}">${percentage}%</td></tr>`;
        }).join('');
        const overallPercentage = totalMax > 0 ? (totalObtained / totalMax * 100).toFixed(1) : 0;
        return `<h3>${test.testName} (${new Date(test.date).toLocaleDateString()})</h3>
                <table class="marks-table">
                    <thead><tr><th>Subject</th><th>Obtained</th><th>Max</th><th>%</th></tr></thead>
                    <tbody>${tableRows}<tr><th>Overall</th><th>${totalObtained}</th><th>${totalMax}</th><th class="percentage ${getPercentageClass(overallPercentage)}">${overallPercentage}%</th></tr></tbody>
                </table>`;
    }

    // --- CHART RENDERING (New Grouped Chart Logic) ---
    function renderSubjectChart(performanceData) {
        if (subjectChartInstance) subjectChartInstance.destroy();
        const ctx = document.getElementById('subject-chart').getContext('2d');
        const subjects = [...new Set(performanceData.flatMap(test => Object.keys(test.scores)))];
        const chartColors = ['#4a90e2', '#ff9e64', '#9ece6a', '#f7768e', '#bb9af7', '#7dcfff'];
        const datasets = performanceData.map((test, index) => ({
            label: test.testName,
            data: subjects.map(subject => {
                const score = test.scores[subject] || 0;
                const max = test.maxmarks[subject] || 0;
                return max > 0 ? (score / max * 100).toFixed(1) : 0;
            }),
            backgroundColor: chartColors[index % chartColors.length]
        }));
        subjectChartInstance = new Chart(ctx, {
            type: 'bar',
            data: { labels: subjects, datasets: datasets },
            options: {
                plugins: { tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${c.formattedValue}%` } } },
                scales: { y: { beginAtZero: true, max: 100, title: { display: true, text: 'Percentage (%)' } } },
                responsive: true, maintainAspectRatio: false
            }
        });
    }

    function renderProgressChart(performanceData) {
        if (progressChartInstance) progressChartInstance.destroy();
        const ctx = document.getElementById('progress-chart').getContext('2d');
        const labels = performanceData.map(test => `${test.testName}`);
        const percentages = performanceData.map(test => {
            const totalObtained = Object.values(test.scores).reduce((a, b) => a + b, 0);
            const totalMax = Object.values(test.maxmarks).reduce((a, b) => a + b, 0);
            return totalMax > 0 ? (totalObtained / totalMax * 100).toFixed(1) : 0;
        });
        progressChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{ label: 'Overall Performance (%)', data: percentages, borderColor: '#9ece6a', tension: 0.1 }]
            },
            options: { scales: { y: { beginAtZero: true, max: 100 } }, responsive: true, maintainAspectRatio: false }
        });
    }

    // --- UI HELPERS ---
    function populateTestFilter(performanceData) {
        const testTypes = [...new Set(performanceData.map(test => test.testType))];
        testTypeFilter.innerHTML = `<option value="All Tests">All Tests</option>`;
        testTypes.forEach(type => {
            const option = document.createElement('option');
            option.value = type;
            option.textContent = type;
            testTypeFilter.appendChild(option);
        });
    }

    function getPercentageClass(p) { return p >= 75 ? 'percentage-good' : p >= 50 ? 'percentage-ok' : 'percentage-bad'; }

    function displayStudentDetailsHeader(student) {
        studentDetailsHeader.innerHTML = `
            <div class="detail-item"><strong>Student Name</strong><span>${student.name}</span></div>
            <div class="detail-item"><strong>Student ID</strong><span>${student.student_id}</span></div>
            <div class="detail-item"><strong>Class</strong><span>${student.class}</span></div>
        `;
    }

    async function loadStudentList(classFile) {
        const response = await fetch(classFile);
        currentStudentsData = await response.json();
        studentSelector.innerHTML = '<option value="">-- Choose a Student --</option>';
        currentStudentsData.forEach(student => {
            const option = document.createElement('option');
            option.value = student.student_id;
            option.textContent = student.name;
            studentSelector.appendChild(option);
        });
        studentSelector.disabled = false;
        // Calculate toppers as soon as class is selected
        await calculateAndDisplayTopPerformers(classFile, currentStudentsData);
    }
    
    // --- EVENT LISTENERS ---
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(item => item.classList.remove('active'));
            tab.classList.add('active');
            const target = document.getElementById(tab.dataset.tab);
            tabContents.forEach(content => content.classList.remove('active'));
            target.classList.add('active');
        });
    });

    classSelector.addEventListener('change', async (event) => {
        const classFile = event.target.value;
        studentContentArea.classList.add('hidden');
        welcomeMessage.classList.remove('hidden');
        if (!classFile) {
            studentSelector.disabled = true;
            topPerformersCard.classList.add('hidden');
            return;
        }
        await loadStudentList(classFile);
    });

    studentSelector.addEventListener('change', (event) => {
        const studentId = event.target.value;
        if (!studentId) {
            studentContentArea.classList.add('hidden');
            welcomeMessage.classList.remove('hidden');
            return;
        }
        const student = currentStudentsData.find(s => s.student_id === studentId);
        displayStudentDetailsHeader(student);
        handleStudentSelection(student.student_id, student.class);
    });
    
    testTypeFilter.addEventListener('change', (event) => renderFilteredPerformance(event.target.value));

    findBtn.addEventListener('click', async () => {
        const studentId = studentIdInput.value.trim();
        if (!studentId) return;
        const classInfo = allClassInfo.find(cls => studentId.startsWith(cls.idPrefix));
        if (!classInfo) { alert("Invalid Student ID format."); return; }
        await loadStudentList(classInfo.fileName);
        const student = currentStudentsData.find(s => s.student_id === studentId);
        if (student) {
            classSelector.value = classInfo.fileName;
            studentSelector.value = student.student_id;
            studentSelector.dispatchEvent(new Event('change')); // Trigger change to load data
        } else { alert("Student not found."); }
    });

    studentIdInput.addEventListener('keypress', (e) => e.key === 'Enter' && findBtn.click());

    // Start the application
    initialize();
});