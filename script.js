document.addEventListener('DOMContentLoaded', () => {

    const classSelector = document.getElementById('class-selector');
    const studentSelector = document.getElementById('student-selector');
    const studentDetailsCard = document.getElementById('student-details-card');
    const studentIdInput = document.getElementById('student-id-input');
    const findBtn = document.getElementById('find-btn');

    let currentStudentsData = [];
    let allClassInfo = []; // Sabhi classes ki info yahan store hogi

    // Function 1: Sabhi classes ko 'classes.json' se load karna
    async function loadClasses() {
        try {
            const response = await fetch('classes.json');
            allClassInfo = await response.json(); // Data ko global variable mein save karein

            allClassInfo.forEach(cls => {
                const option = document.createElement('option');
                option.value = cls.fileName;
                option.textContent = cls.displayText;
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
            currentStudentsData = await response.json();
            
            studentSelector.innerHTML = '<option value="">-- Choose a Student --</option>';
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
                <div class="detail-item"><strong>Student ID:</strong><span>${student.student_id}</span></div>
                <div class="detail-item"><strong>Class:</strong><span>${student.class}</span></div>
                <div class="detail-item"><strong>Father's Name:</strong><span>${student.parents.father_name}</span></div>
                <div class="detail-item"><strong>Mother's Name:</strong><span>${student.parents.mother_name}</span></div>
                <div class="detail-item"><strong>Contact:</strong><span>${student.contact.phone}</span></div>
            `;
            studentDetailsCard.classList.remove('hidden');
        } else {
             studentDetailsCard.classList.add('hidden');
        }
    }

    // NAYA FUNCTION: ID se student ko dhundhna
    async function findStudentById() {
        const studentId = studentIdInput.value.trim();
        if (!studentId) {
            alert("Please enter a Student ID.");
            return;
        }

        // 1. ID ke prefix se class file ka pata lagao
        const classInfo = allClassInfo.find(cls => studentId.startsWith(cls.idPrefix));

        if (!classInfo) {
            alert("Invalid Student ID format or class not found.");
            return;
        }

        // 2. Us class ke students ka data load karo
        await loadStudents(classInfo.fileName);

        // 3. Student ko dhundho aur details dikhao
        const student = currentStudentsData.find(s => s.student_id === studentId);

        if (student) {
            // Dropdowns ko bhi update kar do
            classSelector.value = classInfo.fileName;
            studentSelector.value = student.student_id;
            displayStudentDetails(student.student_id);
        } else {
            alert(`Student with ID "${studentId}" not found in ${classInfo.displayText}.`);
            studentDetailsCard.classList.add('hidden');
        }
    }

    // Event Listeners
    classSelector.addEventListener('change', (event) => {
        studentIdInput.value = ""; // Search box khali kar do
        studentDetailsCard.classList.add('hidden');
        loadStudents(event.target.value);
    });

    studentSelector.addEventListener('change', (event) => {
        studentIdInput.value = ""; // Search box khali kar do
        displayStudentDetails(event.target.value);
    });

    // NAYE Event Listeners
    findBtn.addEventListener('click', findStudentById);

    studentIdInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
            findStudentById();
        }
    });

    // Page load hote hi classes ko load karein
    loadClasses();
});