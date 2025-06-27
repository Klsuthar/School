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
    let studentPerformanceData = []; // Store all performance data for a student
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
        studentPerformanceData = []; // Clear previous student's data

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
        renderFilteredPerformance("All Tests"); // Show all tests by default
        
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
        renderSubjectChart(filteredData[filteredData.length - 1]); // Chart for the latest test in the filtered group
    }

    function renderPerformanceReports(testData) {
        testReportsContainer.innerHTML = ''; // Clear previous reports
        testData.forEach(test => {
            const reportBlock = document.createElement('div');
            reportBlock.className = 'test-report-block';
            reportBlock.innerHTML = generateReportTableHTML(test);
            testReportsContainer.appendChild(reportBlock);
        });
    }

    function generateReportTableHTML(test) {
        const subjects = Object.keys(test.scores);
        let totalObtained = 0;
        let totalMax = 0;

        let tableRows = subjects.map(subject => {
            const obtained = test.scores[subject];
            const max = test.maxmarks[subject];
            const percentage = (obtained / max * 100).toFixed(1);
            totalObtained += obtained;
            totalMax += max;
            return `<tr><td>${subject}</td><td>${obtained}</td><td>${max}</td><td class="percentage ${getPercentageClass(percentage)}">${percentage}%</td></tr>`;
        }).join('');

        const overallPercentage = (totalObtained / totalMax * 100).toFixed(1);

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
    function renderSubjectChart(latestTest) {
        if (subjectChartInstance) subjectChartInstance.destroy();
        
        const ctx = document.getElementById('subject-chart').getContext('2d');
        const subjects = Object.keys(latestTest.scores);
        const scores = subjects.map(s => latestTest.scores[s]);

        subjectChartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: subjects,
                datasets: [{
                    label: 'Marks Obtained',
                    data: scores,
                    backgroundColor: 'rgba(74, 144, 226, 0.6)',
                    borderColor: 'rgba(74, 144, 226, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                scales: { y: { beginAtZero: true } },
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
            return (totalObtained / totalMax * 100).toFixed(1);
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