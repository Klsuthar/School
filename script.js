document.addEventListener('DOMContentLoaded', () => {

    const classSelector = document.getElementById('class-selector');
    const studentSelector = document.getElementById('student-selector');
    const studentDetailsCard = document.getElementById('student-details-card');
    
    // Yah variable current class ke students ka data store karega
    let currentStudentsData = [];

    // Function 1: Sabhi classes ko 'classes.json' se load karna
    async function loadClasses() {
        try {
            const response = await fetch('classes.json');
            const classes = await response.json();

            classes.forEach(cls => {
                const option = document.createElement('option');
                option.value = cls.fileName; // file ka naam value mein store hoga
                option.textContent = cls.displayText; // dikhne wala naam
                classSelector.appendChild(option);
            });
        } catch (error) {
            console.error("Error loading classes:", error);
            alert("Could not load class list. Please check classes.json file.");
        }
    }

    // Function 2: Chuni hui class ke students ko load karna
    async function loadStudents(classFile) {
        if (!classFile) {
            studentSelector.innerHTML = '<option value="">-- Choose a Student --</option>';
            studentSelector.disabled = true;
            studentDetailsCard.classList.add('hidden');
            return;
        }

        try {
            const response = await fetch(classFile);
            currentStudentsData = await response.json(); // Data ko variable mein save karein
            
            studentSelector.innerHTML = '<option value="">-- Choose a Student --</option>'; // Purane options hata dein
            currentStudentsData.forEach(student => {
                const option = document.createElement('option');
                option.value = student.student_id;
                option.textContent = student.name;
                studentSelector.appendChild(option);
            });

            studentSelector.disabled = false;
        } catch (error) {
            console.error(`Error loading students from ${classFile}:`, error);
            alert(`Could not load student data for this class.`);
        }
    }

    // Function 3: Student ki details card mein dikhana
    function displayStudentDetails(studentId) {
        if (!studentId) {
            studentDetailsCard.classList.add('hidden');
            return;
        }

        const student = currentStudentsData.find(s => s.student_id === studentId);
        
        if (student) {
            studentDetailsCard.innerHTML = `
                <h2>${student.name}</h2>
                <div class="detail-item">
                    <strong>Student ID:</strong>
                    <span>${student.student_id}</span>
                </div>
                <div class="detail-item">
                    <strong>Class:</strong>
                    <span>${student.class}</span>
                </div>
                <div class="detail-item">
                    <strong>Father's Name:</strong>
                    <span>${student.parents.father_name}</span>
                </div>
                <div class="detail-item">
                    <strong>Mother's Name:</strong>
                    <span>${student.parents.mother_name}</span>
                </div>
                <div class="detail-item">
                    <strong>Contact:</strong>
                    <span>${student.contact.phone}</span>
                </div>
            `;
            studentDetailsCard.classList.remove('hidden');
        }
    }

    // Event Listeners: Jab dropdown mein kuch select ho
    
    // Class select hone par
    classSelector.addEventListener('change', (event) => {
        const selectedClassFile = event.target.value;
        studentDetailsCard.classList.add('hidden'); // Detail card hide kar dein
        loadStudents(selectedClassFile);
    });

    // Student select hone par
    studentSelector.addEventListener('change', (event) => {
        const selectedStudentId = event.target.value;
        displayStudentDetails(selectedStudentId);
    });

    // Page load hote hi classes ko load karein
    loadClasses();
});