async function calculateTopPerformers(classTests, studentList) {
    if (!classTests || classTests.length === 0 || !studentList || studentList.length === 0) return [];
    try {
        const marksPromises = classTests.map(test => fetch(`test_marks/${test.marksFile}`).then(res => { if (!res.ok) throw new Error(`Failed to load ${test.marksFile}`); return res.json(); }));
        const allClassMarksData = await Promise.all(marksPromises);
        const studentTotals = studentList.map(student => {
            let totalObtained = 0, totalMax = 0;
            allClassMarksData.forEach(testData => {
                const result = testData.results.find(r => r.studentId === student.student_id);
                if (result) {
                    totalObtained += Object.values(result.scores).reduce((sum, score) => sum + (score || 0), 0);
                    totalMax += testData.testInfo.maxmarks.reduce((sum, max) => sum + (max || 0), 0);
                }
            });
            return { id: student.student_id, name: student.name, totalObtained, totalMax };
        });
        const sortedStudents = studentTotals.sort((a, b) => b.totalObtained - a.totalObtained);
        return sortedStudents.slice(0, 3).map(student => ({
            id: student.id, // <-- ID add ki gayi hai
            name: student.name,
            percentage: student.totalMax > 0 ? ((student.totalObtained / student.totalMax) * 100).toFixed(2) : 0
        }));
    } catch (error) { console.error("Error in Topper Calculation:", error); return []; }
}