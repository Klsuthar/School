/**
 * Yah function ek class ke sabhi students ke liye, sabhi available tests ke marks ka data leta hai
 * aur kul praapt ankon ke aadhaar par top 3 performers ko nikalta hai.
 * @param {Array} classTests - tests-directory.json se filter ki gayi us class ke tests ki list.
 * @param {Array} studentList - us class ke sabhi students ki list (students_class_...json se).
 * @returns {Promise<Array>} - Top 3 students ka array, jismein har student ka naam aur overall percentage hoga.
 */
async function calculateTopPerformers(classTests, studentList) {
    if (!classTests || classTests.length === 0 || !studentList) {
        return [];
    }

    try {
        // Step 1: Us class ke sabhi tests ke marks files ko fetch karein.
        const marksPromises = classTests.map(test => 
            fetch(`test_marks/${test.marksFile}`).then(res => {
                if (!res.ok) throw new Error(`Failed to load ${test.marksFile}`);
                return res.json();
            })
        );
        const allClassMarksData = await Promise.all(marksPromises);

        // Step 2: Har student ke liye kul ankon (total marks) ka hisaab lagayein.
        const studentTotals = studentList.map(student => {
            let totalObtained = 0;
            let totalMax = 0;

            // Har test file mein is student ka result dhundhein.
            allClassMarksData.forEach(testData => {
                const result = testData.results.find(r => r.studentId === student.student_id);
                if (result) {
                    // Us test mein praapt ankon ko jodein.
                    totalObtained += Object.values(result.scores).reduce((sum, score) => sum + score, 0);
                    
                    // Us test ke kul ankon (max marks) ko jodein.
                    totalMax += testData.testInfo.maxmarks.reduce((sum, max) => sum + max, 0);
                }
            });

            return {
                name: student.name,
                totalObtained: totalObtained,
                totalMax: totalMax
            };
        });

        // Step 3: Kul praapt ankon ke aadhaar par students ko sort karein.
        const sortedStudents = studentTotals.sort((a, b) => b.totalObtained - a.totalObtained);

        // Step 4: Top 3 students ko chunein aur unka percentage nikal kar return karein.
        const topPerformers = sortedStudents.slice(0, 3).map(student => ({
            name: student.name,
            percentage: student.totalMax > 0 ? ((student.totalObtained / student.totalMax) * 100).toFixed(2) : 0
        }));

        return topPerformers;

    } catch (error) {
        console.error("Error in Topper Calculation:", error);
        return []; // Error aane par ek khaali array return karein.
    }
}