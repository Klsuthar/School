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
    const latestTestReport = document.getElementById('latest-test-report');

    // Global variables to hold data and chart instances
    let allClassInfo = [];
    let currentStudentsData = [];
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

        // Reset UI
        performanceCard.classList.remove('hidden');
        performanceContent.classList.add('hidden');
        noDataMessage.classList.add('hidden');
        loader.classList.remove('hidden');

        try {
            const testsDirectory = await fetch('tests-directory.json').then(res => res.json());
            const studentTests = testsDirectory.filter(test => test.class === studentClass);

            if (studentTests.length === 0) {
                noDataMessage.classList.remove('hidden');
                return;
            }

            const marksPromises = studentTests.map(test => fetch(`test_marks/${test.marksFile}`).then(res => res.json()));
            const allMarksData = await Promise.all(marksPromises);

            processAndDisplayPerformance(studentId, studentTests, allMarksData);
            
        } catch (error) {
            console.error("Error loading performance data:", error);
            noDataMessage.textContent = "Error loading performance data.";
            noDataMessage.classList.remove('hidden');
        } finally {
            loader.classList.add('hidden');
        }
    }

    // --- DATA PROCESSING & DISPLAY ---
    function processAndDisplayPerformance(studentId, studentTests, allMarksData) {
        let studentPerformance = [];

        allMarksData.forEach((marksData, index) => {
            const studentResult = marksData.results.find(res => res.studentId === studentId);
            if (studentResult) {
                const testMeta = studentTests[index];
                const testInfo = marksData.testInfo;
                
                let combinedMaxMarks = {};
                testInfo.subjects.forEach((subj, i) => {
                    combinedMaxMarks[subj] = testInfo.maxmarks[i];
                });

                studentPerformance.push({
                    ...testMeta,
                    scores: studentResult.scores,
                    maxmarks: combinedMaxMarks
                });
            }
        });

        if (studentPerformance.length === 0) {
            noDataMessage.classList.remove('hidden');
            return;
        }

        // Sort tests by date, oldest to newest
        studentPerformance.sort((a, b) => new Date(a.date) - new Date(b.date));
        
        const latestTest = studentPerformance[studentPerformance.length - 1];
        
        displayLatestTest(latestTest);
        renderSubjectChart(latestTest);
        renderProgressChart(studentPerformance);
        
        performanceContent.classList.remove('hidden');
    }

    function displayLatestTest(latestTest) {
        const subjects = Object.keys(latestTest.scores);
        let totalObtained = 0;
        let totalMax = 0;

        let tableRows = subjects.map(subject => {
            const obtained = latestTest.scores[subject];
            const max = latestTest.maxmarks[subject];
            const percentage = (obtained / max * 100).toFixed(2);
            totalObtained += obtained;
            totalMax += max;

            return `
                <tr>
                    <td>${subject}</td>
                    <td>${obtained}</td>
                    <td>${max}</td>
                    <td class="percentage ${getPercentageClass(percentage)}">${percentage}%</td>
                </tr>
            `;
        }).join('');

        const overallPercentage = (totalObtained / totalMax * 100).toFixed(2);

        latestTestReport.innerHTML = `
            <h3>${latestTest.testName} (${new Date(latestTest.date).toLocaleDateString()})</h3>
            <table class="marks-table">
                <thead>
                    <tr>
                        <th>Subject</th>
                        <th>Marks Obtained</th>
                        <th>Max Marks</th>
                        <th>Percentage</th>
                    </tr>
                </thead>
                <tbody>
                    ${tableRows}
                    <tr>
                        <th>Overall</th>
                        <th>${totalObtained}</th>
                        <th>${totalMax}</th>
                        <th class="percentage ${getPercentageClass(overallPercentage)}">${overallPercentage}%</th>
                    </tr>
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
        const maxscores = subjects.map(s => latestTest.maxmarks[s]);

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
                scales: {
                    y: {
                        beginAtZero: true,
                        suggestedMax: Math.max(...maxscores)
                    }
                },
                responsive: true,
                maintainAspectRatio: false // <<<--- BADLAV YAHAN HAI
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
            return (totalObtained / totalMax * 100).toFixed(2);
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
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100
                    }
                },
                responsive: true,
                maintainAspectRatio: false // <<<--- BADLAV YAHAN HAI
            }
        });
    }

    // --- UI HELPERS ---
    function getPercentageClass(percentage) {
        if (percentage >= 75) return 'percentage-good';
        if (percentage >= 50) return 'percentage-ok';
        return 'percentage-bad';
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

    findBtn.addEventListener('click', async () => {
        const studentId = studentIdInput.value.trim();
        if (!studentId) return;

        const classInfo = allClassInfo.find(cls => studentId.startsWith(cls.idPrefix));
        if (!classInfo) {
            alert("Invalid Student ID format.");
            return;
        }

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