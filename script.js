document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const classSelector = document.getElementById('class-selector');
    const studentSelector = document.getElementById('student-selector');
    const studentIdInput = document.getElementById('student-id-input');
    const findBtn = document.getElementById('find-btn');
    const studentDetailsCard = document.getElementById('student-details-card');
    const performanceCard = document.getElementById('student-performance-card');
    const loader = document.getElementById('loader');
    const performanceContent = document.getElementById('performance-content');
    const noDataMessage = document.getElementById('no-data-message');
    const testReportsContainer = document.getElementById('test-reports-container');
    const testTypeFilter = document.getElementById('test-type-filter');

    // Global variables
    let allClassInfo = [];
    let currentStudentsData = [];
    let studentPerformanceData = [];
    let subjectChartInstance, progressChartInstance;

    // --- INITIALIZATION ---
    async function initialize() {
        await loadClasses();
    }

    async function loadClasses() {
        try {
            const response = await fetch('classes.json');
            allClassInfo = await response.json();
            allClassInfo.forEach(cls => {
                const option = document.createElement('option');
                option.value = cls.fileName;
                option.textContent = cls.displayText;
                classSelector.appendChild(option);
            });
        } catch (error) {
            console.error("Error loading classes:", error);
            alert("Could not load class list.");
        }
    }

    // --- STUDENT SELECTION & DATA LOADING ---
    async function handleStudentSelection(studentId, studentClass) {
        if (!studentId || !studentClass) return;
        resetPerformanceUI();

        try {
            const testsDirectory = await fetch('tests-directory.json').then(res => res.json());
            const studentTestsMeta = testsDirectory.filter(test => test.class === studentClass);

            if (studentTestsMeta.length === 0) {
                noDataMessage.classList.remove('hidden');
                return;
            }

            const marksPromises = studentTestsMeta.map(test => fetch(`test_marks/${test.marksFile}`).then(res => res.json()));
            const allMarksData = await Promise.all(marksPromises);

            processAndStorePerformanceData(studentId, studentTestsMeta, allMarksData);
            
        } catch (error) {
            handleError("Error loading performance data.");
        } finally {
            loader.classList.add('hidden');
        }
    }

    // --- DATA PROCESSING & DISPLAY ---
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

        if (studentPerformanceData.length === 0) {
            noDataMessage.classList.remove('hidden');
            return;
        }

        studentPerformanceData.sort((a, b) => new Date(a.date) - new Date(b.date));
        
        populateTestFilter(studentPerformanceData);
        renderFilteredPerformance("All Tests");
        
        performanceContent.classList.remove('hidden');
    }
    
    function renderFilteredPerformance(filterType) {
        const filteredData = filterType === "All Tests" 
            ? studentPerformanceData 
            : studentPerformanceData.filter(test => test.testType === filterType);
        
        if (filteredData.length === 0) {
            testReportsContainer.innerHTML = `<p>No tests found for the selected type.</p>`;
            if (subjectChartInstance) subjectChartInstance.destroy();
            if (progressChartInstance) progressChartInstance.destroy();
            return;
        }

        renderPerformanceReports(filteredData);
        renderProgressChart(filteredData);
        renderSubjectChart(filteredData); // BADLAV: Poora filtered data bhejenge
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
        const subjects = Object.keys(test.scores);
        let totalObtained = 0, totalMax = 0;

        let tableRows = subjects.map(subject => {
            const obtained = test.scores[subject] || 0;
            const max = test.maxmarks[subject] || 0;
            const percentage = max > 0 ? (obtained / max * 100).toFixed(1) : 0;
            totalObtained += obtained;
            totalMax += max;
            return `<tr><td>${subject}</td><td>${obtained}</td><td>${max}</td><td class="percentage ${getPercentageClass(percentage)}">${percentage}%</td></tr>`;
        }).join('');

        const overallPercentage = totalMax > 0 ? (totalObtained / totalMax * 100).toFixed(1) : 0;

        return `
            <h3>${test.testName} (${new Date(test.date).toLocaleDateString()})</h3>
            <table class="marks-table">
                <thead><tr><th>Subject</th><th>Obtained</th><th>Max</th><th>%</th></tr></thead>
                <tbody>
                    ${tableRows}
                    <tr><th>Overall</th><th>${totalObtained}</th><th>${totalMax}</th><th class="percentage ${getPercentageClass(overallPercentage)}">${overallPercentage}%</th></tr>
                </tbody>
            </table>
        `;
    }

    // --- CHART RENDERING ---
    // NAYA: Grouped Bar Chart ka poora logic
    function renderSubjectChart(performanceData) {
        if (subjectChartInstance) subjectChartInstance.destroy();
        
        const ctx = document.getElementById('subject-chart').getContext('2d');
        
        // 1. Sabhi unique subjects ki list banayein
        const subjects = [...new Set(performanceData.flatMap(test => Object.keys(test.scores)))];
        
        // 2. Har test ke liye alag dataset banayein
        const chartColors = ['rgba(74, 144, 226, 0.7)', 'rgba(245, 166, 35, 0.7)', 'rgba(126, 211, 33, 0.7)', 'rgba(208, 2, 27, 0.7)', 'rgba(189, 16, 224, 0.7)', 'rgba(80, 227, 194, 0.7)'];
        const datasets = performanceData.map((test, index) => {
            return {
                label: test.testName,
                data: subjects.map(subject => {
                    const score = test.scores[subject] || 0;
                    const max = test.maxmarks[subject] || 0;
                    // Hum percentage dikha rahe hain taaki comparison aasan ho
                    return max > 0 ? (score / max * 100).toFixed(1) : 0;
                }),
                backgroundColor: chartColors[index % chartColors.length]
            };
        });

        subjectChartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: subjects, // X-axis par subjects
                datasets: datasets // Har test ek alag bar group
            },
            options: {
                plugins: {
                    title: { display: true, text: 'Subject Performance (in %)' },
                    tooltip: { callbacks: { label: (context) => `${context.dataset.label}: ${context.formattedValue}%` } }
                },
                scales: { y: { beginAtZero: true, max: 100, title: { display: true, text: 'Percentage (%)' } } },
                responsive: true,
                maintainAspectRatio: false
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
                datasets: [{
                    label: 'Overall Performance (%)',
                    data: percentages,
                    fill: false,
                    borderColor: '#28a745',
                    tension: 0.1
                }]
            },
            options: {
                scales: { y: { beginAtZero: true, max: 100 } },
                responsive: true,
                maintainAspectRatio: false
            }
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

    function getPercentageClass(percentage) {
        if (percentage >= 75) return 'percentage-good';
        if (percentage >= 50) return 'percentage-ok';
        return 'percentage-bad';
    }

    function resetPerformanceUI() {
        performanceCard.classList.remove('hidden');
        performanceContent.classList.add('hidden');
        noDataMessage.classList.add('hidden');
        loader.classList.remove('hidden');
    }

    function handleError(message) {
        loader.classList.add('hidden');
        noDataMessage.textContent = message;
        noDataMessage.classList.remove('hidden');
    }

    function displayStudentDetails(student) {
        studentDetailsCard.innerHTML = `
            <div class="detail-item"><strong>Student Name:</strong><span>${student.name}</span></div>
            <div class="detail-item"><strong>Student ID:</strong><span>${student.student_id}</span></div>
            <div class="detail-item"><strong>Class:</strong><span>${student.class}</span></div>
            <div class="detail-item"><strong>Father's Name:</strong><span>${student.parents.father_name}</span></div>
            <div class="detail-item"><strong>Mother's Name:</strong><span>${student.parents.mother_name}</span></div>
            <div class="detail-item"><strong>Contact:</strong><span>${student.contact.phone}</span></div>
        `;
        studentDetailsCard.classList.remove('hidden');
    }

    async function loadStudentList(classFile) {
        if (!classFile) {
            studentSelector.innerHTML = '<option value="">-- Choose a Student --</option>';
            studentSelector.disabled = true;
            return;
        }
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
    }

    // --- EVENT LISTENERS ---
    classSelector.addEventListener('change', async (event) => {
        studentIdInput.value = "";
        studentDetailsCard.classList.add('hidden');
        performanceCard.classList.add('hidden');
        await loadStudentList(event.target.value);
    });

    studentSelector.addEventListener('change', (event) => {
        const studentId = event.target.value;
        if (!studentId) {
            studentDetailsCard.classList.add('hidden');
            performanceCard.classList.add('hidden');
            return;
        }
        const student = currentStudentsData.find(s => s.student_id === studentId);
        displayStudentDetails(student);
        handleStudentSelection(student.student_id, student.class);
    });
    
    testTypeFilter.addEventListener('change', (event) => {
        renderFilteredPerformance(event.target.value);
    });

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
            displayStudentDetails(student);
            handleStudentSelection(student.student_id, student.class);
        } else {
            alert("Student not found.");
        }
    });

    studentIdInput.addEventListener('keypress', (e) => e.key === 'Enter' && findBtn.click());

    // Start the application
    initialize();
});