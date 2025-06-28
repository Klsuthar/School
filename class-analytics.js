// Global variables for class-level chart instances
let subjectDifficultyChart, performanceDistributionChart;

/**
 * Main function to calculate and render all class-level analytics.
 * @param {Array} classTests - List of tests for the selected class.
 * @param {Array} studentList - List of students in the selected class.
 */
async function calculateAndRenderClassAnalytics(classTests, studentList) {
    if (!classTests || classTests.length === 0 || !studentList || studentList.length === 0) {
        document.getElementById('class-analytics-area').innerHTML = '<p>No test data available for this class to generate analytics.</p>';
        return;
    }
    try {
        const marksPromises = classTests.map(test => fetch(`test_marks/${test.marksFile}`).then(res => res.json()));
        const allClassMarksData = await Promise.all(marksPromises);
        const studentPerformances = studentList.map(student => {
            let totalObtained = 0, totalMax = 0, subjectScores = {};
            allClassMarksData.forEach(testData => {
                const result = testData.results.find(r => r.studentId === student.student_id);
                if (result) {
                    for (const subject in result.scores) {
                        if (!subjectScores[subject]) subjectScores[subject] = { obtained: 0, max: 0, count: 0 };
                        const score = result.scores[subject] || 0;
                        const max = testData.testInfo.maxmarks[testData.testInfo.subjects.indexOf(subject)] || 0;
                        subjectScores[subject].obtained += score;
                        subjectScores[subject].max += max;
                        subjectScores[subject].count++;
                    }
                }
            });
            for(const subject in subjectScores) { totalObtained += subjectScores[subject].obtained; totalMax += subjectScores[subject].max; }
            return { percentage: totalMax > 0 ? (totalObtained / totalMax * 100) : 0, subjectScores };
        });
        const classAverage = studentPerformances.reduce((sum, student) => sum + student.percentage, 0) / studentPerformances.length;
        renderClassStats({ totalStudents: studentList.length, average: classAverage.toFixed(2), testCount: classTests.length });
        const subjectAverages = {};
        studentPerformances.forEach(student => {
            for(const subject in student.subjectScores){
                if(!subjectAverages[subject]) subjectAverages[subject] = { totalPercentage: 0, count: 0 };
                const perf = student.subjectScores[subject];
                if(perf.max > 0) {
                    subjectAverages[subject].totalPercentage += (perf.obtained / perf.max) * 100;
                    subjectAverages[subject].count++;
                }
            }
        });
        const finalSubjectAverages = Object.entries(subjectAverages).map(([name, data]) => ({ name, average: (data.totalPercentage / data.count).toFixed(2) }));
        renderSubjectDifficultyChart(finalSubjectAverages);
        const distribution = { excellent: 0, good: 0, needsImprovement: 0 };
        studentPerformances.forEach(student => {
            if (student.percentage >= 75) distribution.excellent++;
            else if (student.percentage >= 50) distribution.good++;
            else distribution.needsImprovement++;
        });
        renderPerformanceDistributionChart(distribution);
    } catch (error) {
        console.error("Error calculating class analytics:", error);
        document.getElementById('class-analytics-area').innerHTML = '<p>Could not calculate class analytics due to an error.</p>';
    }
}

function renderClassStats(stats) {
    document.getElementById('stat-total-students').textContent = stats.totalStudents;
    document.getElementById('stat-class-average').textContent = `${stats.average}%`;
    document.getElementById('stat-tests-conducted').textContent = stats.testCount;
}

// THE FINAL FIX IS HERE: This function is completely rebuilt for robustness.
function renderSubjectDifficultyChart(subjectData) {
    if (subjectDifficultyChart) {
        subjectDifficultyChart.destroy();
    }
    
    const ctx = document.getElementById('subject-difficulty-chart').getContext('2d');
    const isMobile = window.innerWidth < 768;

    // Sort data: weakest on top for horizontal, strongest on left for vertical
    const sortedData = [...subjectData].sort((a, b) => isMobile ? b.average - a.average : a.average - b.average);
    
    // Dynamically set chart options based on screen size
    const chartOptions = {
        indexAxis: isMobile ? 'x' : 'y', // Vertical on mobile, horizontal on desktop
        scales: {
            x: { 
                beginAtZero: true, 
                max: 100,
                grid: { color: '#3b4261' },
                ticks: { color: '#a9b1d6' },
                title: { display: !isMobile, text: 'Average Percentage (%)', color: '#a9b1d6' } 
            },
            y: {
                grid: { color: '#3b4261' },
                ticks: { color: '#a9b1d6' },
                title: { display: isMobile, text: 'Average Percentage (%)', color: '#a9b1d6' }
            }
        },
        plugins: { 
            legend: { display: false } 
        },
        responsive: true,
        // CRITICAL: We turn off maintainAspectRatio so we can control it with CSS
        maintainAspectRatio: false 
    };

    subjectDifficultyChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: sortedData.map(s => s.name),
            datasets: [{
                label: 'Average Performance by Subject',
                data: sortedData.map(s => s.average),
                backgroundColor: sortedData.map(s => s.average < 50 ? '#f7768e' : s.average < 75 ? '#ff9e64' : '#9ece6a'),
            }]
        },
        options: chartOptions
    });
}


function renderPerformanceDistributionChart(distribution) {
    if (performanceDistributionChart) performanceDistributionChart.destroy();
    const ctx = document.getElementById('performance-distribution-chart').getContext('2d');
    const legendContainer = document.getElementById('performance-distribution-legend');
    const chartData = {
        labels: [`Excellent (>75%)`, `Good (50-75%)`, `Needs Improvement (<50%)`],
        datasets: [{ data: [distribution.excellent, distribution.good, distribution.needsImprovement], backgroundColor: ['#9ece6a', '#4a90e2', '#f7768e'], borderColor: '#242731', borderWidth: 4, cutout: '70%' }]
    };
    performanceDistributionChart = new Chart(ctx, {
        type: 'doughnut',
        data: chartData,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '';
                            const value = context.raw || 0;
                            const total = context.chart.getDatasetMeta(0).total;
                            const percentage = total > 0 ? (value / total * 100).toFixed(1) : 0;
                            return `${label}: ${value} students (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
    legendContainer.innerHTML = chartData.labels.map((label, index) => {
        const color = chartData.datasets[0].backgroundColor[index];
        return `<div class="legend-item"><div class="legend-color-box" style="background-color: ${color}"></div><span>${label}</span></div>`;
    }).join('');
}