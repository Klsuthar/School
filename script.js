document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const classSelector = document.getElementById('class-selector');
    const studentSelector = document.getElementById('student-selector');
    const studentIdInput = document.getElementById('student-id-input');
    const findBtn = document.getElementById('find-btn');
    const studentDetailsHeader = document.getElementById('student-details-header');
    const testReportsContainer = document.getElementById('test-reports-container');
    const topPerformersCard = document.getElementById('top-performers-card');
    const topPerformersList = document.getElementById('top-performers-list');
    const topPerformersLoader = document.getElementById('top-performers-loader');
    const studentContentArea = document.getElementById('student-content-area');
    const welcomeMessage = document.getElementById('welcome-message');
    const classAnalyticsArea = document.getElementById('class-analytics-area');
    const tabs = document.querySelectorAll('.tab-link');
    const tabContents = document.querySelectorAll('.tab-content');
    const supportCard = document.getElementById('support-card');
    const supportList = document.getElementById('support-list');
    const supportLoader = document.getElementById('support-loader');
    const testTypeFilterPills = document.getElementById('test-type-filter-pills');
    const notesList = document.getElementById('notes-list');

    // Global variables
    let allClassInfo = [], currentStudentsData = [], studentPerformanceData = [], allNotesData = [];
    let subjectChartInstance, progressChartInstance;
    let currentStudentIndex = -1;

    async function initialize() {
        Chart.defaults.color = '#a9b1d6';
        Chart.defaults.borderColor = '#3b4261';
        await Promise.all([loadClasses(), loadAllNotes()]);
        showWelcomeView();
    }

    function showWelcomeView() {
        welcomeMessage.classList.remove('hidden');
        classAnalyticsArea.classList.add('hidden');
        studentContentArea.classList.add('hidden');
    }

    function showClassAnalyticsView(className, classTests, studentList) {
        welcomeMessage.classList.add('hidden');
        studentContentArea.classList.add('hidden');
        classAnalyticsArea.classList.remove('hidden');
        document.getElementById('class-analytics-title').textContent = `${className} - Class Overview`;
        calculateAndRenderClassAnalytics(classTests, studentList);
    }

    function showStudentView() {
        welcomeMessage.classList.add('hidden');
        classAnalyticsArea.classList.add('hidden');
        studentContentArea.classList.remove('hidden');
        tabs.forEach(tab => tab.classList.remove('active'));
        tabContents.forEach(content => content.classList.remove('active'));
        document.querySelector('.tab-link[data-tab="overview"]').classList.add('active');
        document.getElementById('overview').classList.add('active');
    }
    
    async function loadClasses() {
        try {
            const response = await fetch('classes.json');
            allClassInfo = await response.json();
            allClassInfo.forEach(cls => classSelector.add(new Option(cls.displayText, cls.fileName)));
        } catch (error) { console.error("Error loading classes:", error); }
    }
    
    async function loadAllNotes() {
        try {
            const response = await fetch('notes.json');
            allNotesData = await response.json();
        } catch (error) { console.error("Could not load notes.json.", error); allNotesData = []; }
    }

    async function loadStudentList(classFile) {
        const response = await fetch(classFile);
        currentStudentsData = await response.json();
        studentSelector.innerHTML = '<option value="">-- Choose a Student --</option>';
        currentStudentsData.forEach(student => studentSelector.add(new Option(student.name, student.student_id)));
        studentSelector.disabled = false;
        if (currentStudentsData.length > 0) {
            const className = currentStudentsData[0].class;
            await displayClassHighlights(className, currentStudentsData);
        } else {
            topPerformersCard.classList.add('hidden');
            supportCard.classList.add('hidden');
        }
    }

    async function displayClassHighlights(className, studentList) {
        topPerformersCard.classList.remove('hidden');
        supportCard.classList.remove('hidden');
        topPerformersLoader.classList.remove('hidden');
        supportLoader.classList.remove('hidden');
        try {
            const testsDirectory = await fetch('tests-directory.json').then(res => res.json());
            const classTests = testsDirectory.filter(test => test.class === className);
            const [topPerformers, supportStudents] = await Promise.all([
                calculateTopPerformers(classTests, studentList),
                calculateStudentsNeedingSupport(classTests, studentList)
            ]);
            if (topPerformers?.length) renderTopPerformers(topPerformers); else topPerformersList.innerHTML = '<li>No data.</li>';
            if (supportStudents?.length) renderSupportStudents(supportStudents); else supportList.innerHTML = '<li>No data.</li>';
        } catch (error) {
            console.error("Error displaying class highlights:", error);
            topPerformersList.innerHTML = '<li>Could not load data.</li>';
            supportList.innerHTML = '<li>Could not load data.</li>';
        } finally {
            topPerformersLoader.classList.add('hidden');
            supportLoader.classList.add('hidden');
        }
    }

    function renderTopPerformers(topPerformers) {
        topPerformersList.innerHTML = topPerformers.map((topper, index) => `<li class="topper-item" data-id="${topper.id}"><span class="topper-rank">#${index + 1}</span><div class="topper-details"><div class="topper-name">${topper.name}</div><div class="topper-percentage">${topper.percentage}% Overall</div></div></li>`).join('');
    }
    
    function renderSupportStudents(supportStudents) {
        supportList.innerHTML = supportStudents.map((student, index) => `<li class="topper-item" data-id="${student.id}"><span class="topper-rank">#${index + 1}</span><div class="topper-details"><div class="topper-name">${student.name}</div><div class="support-percentage">${student.percentage}% Overall</div></div></li>`).join('');
    }

    async function handleStudentSelection(studentId, studentClass) {
        if (!studentId || !studentClass) return;
        try {
            const testsDirectory = await fetch('tests-directory.json').then(res => res.json());
            const studentTestsMeta = testsDirectory.filter(test => test.class === studentClass);
            if (studentTestsMeta.length === 0) { return; }
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
        if (studentPerformanceData.length === 0) { return; }
        studentPerformanceData.sort((a, b) => new Date(a.date) - new Date(b.date));
        populateTestFilter(studentPerformanceData);
        renderFilteredPerformance("All Tests");
    }
    
    function renderFilteredPerformance(filterType) {
        const filteredData = filterType === "All Tests" ? studentPerformanceData : studentPerformanceData.filter(test => test.testType === filterType);
        if (filteredData.length === 0) {
            if(subjectChartInstance) subjectChartInstance.destroy();
            if(progressChartInstance) progressChartInstance.destroy();
            testReportsContainer.innerHTML = `<p style="text-align:center; color: var(--text-secondary);">No reports found for this filter.</p>`;
            return;
        }
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
        return `<h3>${test.testName} (${new Date(test.date).toLocaleDateString()})</h3><table class="marks-table"><thead><tr><th>Subject</th><th>Obtained</th><th>Max</th><th>%</th></tr></thead><tbody>${tableRows}<tr><th>Overall</th><th>${totalObtained}</th><th>${totalMax}</th><th class="percentage ${getPercentageClass(overallPercentage)}">${overallPercentage}%</th></tr></tbody></table>`;
    }

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
        subjectChartInstance = new Chart(ctx, { type: 'bar', data: { labels: subjects, datasets: datasets }, options: { plugins: { tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${c.formattedValue}%` } } }, scales: { y: { beginAtZero: true, max: 100, title: { display: true, text: 'Percentage (%)' } } }, responsive: true, maintainAspectRatio: false } });
    }

    function renderProgressChart(performanceData) {
        const chartContainer = document.getElementById('progress-chart').parentElement;
        if (progressChartInstance) progressChartInstance.destroy();
        if (performanceData.length < 2) {
            chartContainer.style.display = 'none';
            return;
        }
        chartContainer.style.display = 'block';
        const ctx = document.getElementById('progress-chart').getContext('2d');
        const labels = performanceData.map(test => test.testName);
        const percentages = performanceData.map(test => {
            const totalObtained = Object.values(test.scores).reduce((a, b) => a + b, 0);
            const totalMax = Object.values(test.maxmarks).reduce((a, b) => a + b, 0);
            return totalMax > 0 ? parseFloat((totalObtained / totalMax * 100).toFixed(1)) : 0;
        });
        const gradient = ctx.createLinearGradient(0, 0, 0, 400);
        gradient.addColorStop(0, 'rgba(158, 206, 106, 0.4)');
        gradient.addColorStop(1, 'rgba(158, 206, 106, 0)');
        const backgroundDataset = { label: 'Performance Area', data: percentages, borderColor: 'transparent', backgroundColor: gradient, fill: true, pointRadius: 0, pointHoverRadius: 0, tension: 0.4 };
        const lineSegments = [];
        for (let i = 1; i < percentages.length; i++) {
            const segmentData = new Array(percentages.length).fill(null);
            segmentData[i - 1] = percentages[i - 1];
            segmentData[i] = percentages[i];
            lineSegments.push({ data: segmentData, borderColor: percentages[i] >= percentages[i - 1] ? '#9ece6a' : '#f7768e', borderWidth: 3, tension: 0.4, fill: false, pointBackgroundColor: '#fff', pointBorderColor: percentages[i] >= percentages[i - 1] ? '#9ece6a' : '#f7768e', pointHoverRadius: 7, pointHoverBackgroundColor: percentages[i] >= percentages[i - 1] ? '#9ece6a' : '#f7768e' });
        }
        progressChartInstance = new Chart(ctx, { type: 'line', data: { labels: labels, datasets: [backgroundDataset, ...lineSegments] }, options: { scales: { y: { beginAtZero: true, max: 100, ticks: { callback: value => value + '%' } } }, plugins: { legend: { display: false }, tooltip: { backgroundColor: 'rgba(0, 0, 0, 0.8)', titleFont: { size: 14, weight: 'bold' }, bodyFont: { size: 12 }, filter: (item) => item.dataset.borderColor !== 'transparent', callbacks: { label: (context) => ` Performance: ${context.formattedValue}%` } } }, responsive: true, maintainAspectRatio: false } });
    }
    
    function populateTestFilter(performanceData) {
        testTypeFilterPills.innerHTML = '';
        const testTypes = ['All Tests', ...new Set(performanceData.map(test => test.testType))];
        testTypes.forEach((type, index) => {
            const button = document.createElement('button');
            button.textContent = type;
            button.dataset.filter = type;
            if (index === 0) button.classList.add('active');
            testTypeFilterPills.appendChild(button);
        });
    }

    function getPercentageClass(p) { return p >= 75 ? 'percentage-good' : p >= 50 ? 'percentage-ok' : 'percentage-bad'; }

    function displayStudentDetailsHeader(student) {
        studentDetailsHeader.innerHTML = `<div class="header-info-container"><div class="header-detail-item"><span class="icon">👤</span><div class="text-content"><strong>Student Name</strong><span>${student.name}</span></div></div><div class="header-detail-item"><span class="icon">🆔</span><div class="text-content"><strong>Student ID</strong><span>${student.student_id}</span></div></div><div class="header-detail-item"><span class="icon">🏫</span><div class="text-content"><strong>Class</strong><span>${student.class}</span></div></div></div><div id="student-nav-buttons"><button id="prev-student-btn" title="Previous Student">←</button><button id="next-student-btn" title="Next Student">→</button></div>`;
        document.getElementById('prev-student-btn').addEventListener('click', navigateToPreviousStudent);
        document.getElementById('next-student-btn').addEventListener('click', navigateToNextStudent);
        updateNavButtons();
    }
    
    function displayStudentProfile(student) {
        const profileContainer = document.getElementById('profile').querySelector('.profile-grid');
        profileContainer.innerHTML = `<div class="profile-card"><span class="icon">👨‍👩‍👧</span><div class="info"><strong>Father's Name</strong><span>${student.parents.father_name}</span></div></div><div class="profile-card"><span class="icon">👩‍👧‍👦</span><div class="info"><strong>Mother's Name</strong><span>${student.parents.mother_name}</span></div></div><div class="profile-card"><span class="icon">📞</span><div class="info"><strong>Contact Number</strong><a href="tel:+91${student.contact.phone}" class="contact-link">${student.contact.phone}</a></div></div>`;
    }

    function displayStudentNotes(studentId) {
        const studentNotes = allNotesData.filter(note => note.studentId === studentId).sort((a, b) => new Date(b.date) - new Date(a.date));
        if (studentNotes.length === 0) { notesList.innerHTML = `<li>No notes available for this student.</li>`; return; }
        notesList.innerHTML = studentNotes.map(note => `<li class="note-item note-${note.noteType.toLowerCase()}"><span class="note-icon">${note.noteType === 'Achievement' ? '✅' : '⚠️'}</span><div class="note-content"><div class="note-meta"><span class="note-type">${note.noteType}</span><span class="note-date">${new Date(note.date).toLocaleDateString()}</span></div><p class="note-text">${note.noteText}</p></div></li>`).join('');
    }

    async function loadStudentList(classFile) {
        const response = await fetch(classFile);
        currentStudentsData = await response.json();
        studentSelector.innerHTML = '<option value="">-- Choose a Student --</option>';
        currentStudentsData.forEach(student => studentSelector.add(new Option(student.name, student.student_id)));
        studentSelector.disabled = false;
        if (currentStudentsData.length > 0) {
            const className = currentStudentsData[0].class;
            await displayClassHighlights(className, currentStudentsData);
        } else {
            topPerformersCard.classList.add('hidden');
            supportCard.classList.add('hidden');
        }
    }

    function updateNavButtons() {
        const prevBtn = document.getElementById('prev-student-btn');
        const nextBtn = document.getElementById('next-student-btn');
        if (prevBtn && nextBtn) {
            prevBtn.disabled = currentStudentIndex <= 0;
            nextBtn.disabled = currentStudentIndex >= currentStudentsData.length - 1;
        }
    }
    
    function navigateToPreviousStudent() { if (currentStudentIndex > 0) { currentStudentIndex--; studentSelector.value = currentStudentsData[currentStudentIndex].student_id; studentSelector.dispatchEvent(new Event('change')); } }
    function navigateToNextStudent() { if (currentStudentIndex < currentStudentsData.length - 1) { currentStudentIndex++; studentSelector.value = currentStudentsData[currentStudentIndex].student_id; studentSelector.dispatchEvent(new Event('change')); } }

    // --- EVENT LISTENERS ---
    classSelector.addEventListener('change', async (event) => {
        const classFile = event.target.value;
        showWelcomeView();
        studentSelector.innerHTML = '<option value="">-- Choose a Student --</option>';
        studentSelector.disabled = true;
        topPerformersCard.classList.add('hidden');
        supportCard.classList.add('hidden');
        if (!classFile) return;

        await loadStudentList(classFile);
        
        try {
            const testsDirectory = await fetch('tests-directory.json').then(res => res.json());
            const className = currentStudentsData.length > 0 ? currentStudentsData[0].class : '';
            const classTests = testsDirectory.filter(test => test.class === className);
            showClassAnalyticsView(className, classTests, currentStudentsData);
        } catch (error) { console.error("Could not load data for class analytics", error); }
    });

    studentSelector.addEventListener('change', (event) => {
        const studentId = event.target.value;
        if (!studentId) {
            const classFile = classSelector.value;
            if (classFile) {
                // Find the class name from the first student in the list
                const className = currentStudentsData.length > 0 ? currentStudentsData[0].class : '';
                // Refetch the tests for the class to show the analytics view
                fetch('tests-directory.json').then(res => res.json()).then(testsDirectory => {
                    const classTests = testsDirectory.filter(test => test.class === className);
                    showClassAnalyticsView(className, classTests, currentStudentsData);
                });
            } else {
                showWelcomeView();
            }
            return;
        }
        
        showStudentView();
        const student = currentStudentsData.find(s => s.student_id === studentId);
        currentStudentIndex = currentStudentsData.findIndex(s => s.student_id === studentId);
        displayStudentDetailsHeader(student);
        displayStudentProfile(student);
        displayStudentNotes(student.student_id);
        handleStudentSelection(student.student_id, student.class);
    });
    
    [topPerformersList, supportList].forEach(list => list.addEventListener('click', (event) => { const listItem = event.target.closest('li'); if (listItem?.dataset.id) { studentSelector.value = listItem.dataset.id; studentSelector.dispatchEvent(new Event('change')); } }));
    testTypeFilterPills.addEventListener('click', (event) => { if (event.target.tagName === 'BUTTON') { testTypeFilterPills.querySelector('.active').classList.remove('active'); event.target.classList.add('active'); renderFilteredPerformance(event.target.dataset.filter); } });
    tabs.forEach(tab => tab.addEventListener('click', () => { tabs.forEach(item => item.classList.remove('active')); tab.classList.add('active'); tabContents.forEach(content => content.classList.remove('active')); document.getElementById(tab.dataset.tab).classList.add('active'); }));
    findBtn.addEventListener('click', async () => { const studentId = studentIdInput.value.trim(); if (!studentId) return; const classInfo = allClassInfo.find(cls => studentId.startsWith(cls.idPrefix)); if (!classInfo) { alert("Invalid Student ID format."); return; } if (classSelector.value !== classInfo.fileName) { await loadStudentList(classInfo.fileName); classSelector.value = classInfo.fileName; } const student = currentStudentsData.find(s => s.student_id === studentId); if (student) { studentSelector.value = student.student_id; studentSelector.dispatchEvent(new Event('change')); } else { alert("Student not found."); } });
    studentIdInput.addEventListener('keypress', (e) => e.key === 'Enter' && findBtn.click());

    initialize();
});