/**
 * Yah function ek class ke sabhi students ke liye, sabhi available tests ke marks ka data leta hai
 * aur kul praapt ankon ke aadhaar par un 3 students ko nikalta hai jinhein sabse zyada support ki zaroorat hai.
 * @param {Array} classTests - tests-directory.json se filter ki gayi us class ke tests ki list.
 * @param {Array} studentList - us class ke sabhi students ki list.
 * @returns {Promise<Array>} - Bottom 3 students ka array, jismein har student ka naam aur overall percentage hoga.
 */
async function calculateStudentsNeedingSupport(classTests, studentList) {
    if (!classTests || classTests.length === 0 || !studentList || studentList.length === 0) {
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

            allClassMarksData.forEach(testData => {
                const result = testData.results.find(r => r.studentId === student.student_id);
                if (result) {
                    totalObtained += Object.values(result.scores).reduce((sum, score) => sum + (score || 0), 0);
                    totalMax += testData.testInfo.maxmarks.reduce((sum, max) => sum + (max || 0), 0);
                }
            });

            return {
                name: student.name,
                totalObtained: totalObtained,
                totalMax: totalMax
            };
        });

        // Step 3: Kul praapt ankon ke aadhaar par students ko ASCENDING order mein sort karein.
        const sortedStudents = studentTotals.sort((a, b) => a.totalObtained - b.totalObtained);

        // Step 4: Shuruaat ke 3 students ko chunein aur unka percentage nikal kar return karein.
        const bottomPerformers = sortedStudents.slice(0, 3).map(student => ({
            name: student.name,
            percentage: student.totalMax > 0 ? ((student.totalObtained / student.totalMax) * 100).toFixed(2) : 0
        }));

        return bottomPerformers;

    } catch (error) {
        console.error("Error in Support Calculation:", error);
        return [];
    }
}