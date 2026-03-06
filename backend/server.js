// server.js
const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const PORT = 5000;

app.use(cors());
app.use(bodyParser.json());

const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'Vani@1234#',
    database: 'hms'
});

db.connect(err => {
    if(err) console.error('Database connection failed:', err);
    else console.log('Connected to MySQL database');
});

// ─────────────────────────────────────────────────────
//  HOSPITAL ENDPOINTS
// ─────────────────────────────────────────────────────

app.get('/api/hospitals', (req, res) => {
    db.query('SELECT hospital_id, hospital_name FROM hospitals', (err, results) => {
        if(err) return res.json({ success: false, message: err.message });
        res.json({ success: true, hospitals: results });
    });
});

app.get('/api/hospitals/:hospitalId/specialists', (req, res) => {
    const sql = `SELECT DISTINCT specialization FROM doctors 
                 WHERE hospital_id = ? AND specialization IS NOT NULL AND specialization != ''`;
    db.query(sql, [req.params.hospitalId], (err, results) => {
        if(err) return res.json({ success: false, message: err.message });
        res.json({ success: true, specialists: results.map(r => r.specialization) });
    });
});

// ─────────────────────────────────────────────────────
//  PATIENT ENDPOINTS
// ─────────────────────────────────────────────────────

// Get all patients
app.get('/api/patients', (req, res) => {
    const sql = 'SELECT * FROM patients ORDER BY created_at DESC';
    db.query(sql, (err, results) => {
        if(err) return res.json({ success: false, message: err.message });
        res.json({ success: true, patients: results });
    });
});

// Search patients by name or phone
app.get('/api/patients/search', (req, res) => {
    const q = `%${req.query.q}%`;
    const sql = 'SELECT * FROM patients WHERE name LIKE ? OR phone LIKE ? ORDER BY name';
    db.query(sql, [q, q], (err, results) => {
        if(err) return res.json({ success: false, message: err.message });
        res.json({ success: true, patients: results });
    });
});

// Get appointment history by name or phone
app.get('/api/patients/history', (req, res) => {
    const q = `%${req.query.q}%`;
    const sql = `
        SELECT 
            a.appointment_id,
            a.appointment_date,
            a.appointment_time,
            a.status,
            d.specialization,
            h.hospital_name
        FROM appointments a
        JOIN patients  p ON a.patient_id  = p.patient_id
        JOIN doctors   d ON a.doctor_id   = d.doctor_id
        JOIN hospitals h ON a.hospital_id = h.hospital_id
        WHERE p.name LIKE ? OR p.phone LIKE ?
        ORDER BY a.appointment_date DESC
    `;
    db.query(sql, [q, q], (err, results) => {
        if(err) return res.json({ success: false, message: err.message });
        res.json({ success: true, appointments: results });
    });
});

// Add new patient manually
app.post('/api/patients', (req, res) => {
    const { name, phone, age, gender, email, hospital_id, address } = req.body;
    if(!name || !phone || !hospital_id) {
        return res.json({ success: false, message: 'Name, phone and hospital are required' });
    }
    db.query('SELECT patient_id FROM patients WHERE phone = ?', [phone], (err, rows) => {
        if(err) return res.json({ success: false, message: err.message });
        if(rows.length > 0) return res.json({ success: false, message: 'Patient with this phone already exists' });

        const sql = 'INSERT INTO patients (hospital_id, name, age, gender, phone, email, address, created_at) VALUES (?,?,?,?,?,?,?,NOW())';
        db.query(sql, [hospital_id, name, age||null, gender||null, phone, email||null, address||null], (err, result) => {
            if(err) return res.json({ success: false, message: err.message });
            res.json({ success: true, patient_id: result.insertId, message: 'Patient added successfully' });
        });
    });
});

// ─────────────────────────────────────────────────────
//  APPOINTMENT ENDPOINTS
// ─────────────────────────────────────────────────────

// Appointment count for stats
app.get('/api/appointments/count', (req, res) => {
    db.query('SELECT COUNT(*) as count FROM appointments', (err, results) => {
        if(err) return res.json({ success: false, message: err.message });
        res.json({ success: true, count: results[0].count });
    });
});

// Book appointment
app.post('/api/appointments', (req, res) => {
    const { name, phone, email, hospital, specialist, date, time, reason } = req.body;
    if(!name || !phone || !hospital || !specialist || !date || !time){
        return res.json({ success: false, message: 'Missing required fields' });
    }

    db.query('SELECT patient_id FROM patients WHERE phone = ?', [phone], (err, results) => {
        if(err) return res.json({ success: false, message: err.message });

        let patientId;
        if(results.length > 0){
            patientId = results[0].patient_id;
            insertAppointment();
        } else {
            const sql = 'INSERT INTO patients (hospital_id, name, phone, email, created_at) VALUES (?, ?, ?, ?, NOW())';
            db.query(sql, [hospital, name, phone, email], (err, result) => {
                if(err) return res.json({ success: false, message: err.message });
                patientId = result.insertId;
                insertAppointment();
            });
        }

        function insertAppointment(){
            db.query('SELECT doctor_id FROM doctors WHERE hospital_id = ? AND specialization = ? LIMIT 1',
                [hospital, specialist], (err, docs) => {
                if(err) return res.json({ success: false, message: err.message });
                if(!docs.length) return res.json({ success: false, message: 'No doctor found for this specialization' });

                const doctorId = docs[0].doctor_id;
                const sql = `INSERT INTO appointments (patient_id, doctor_id, hospital_id, appointment_date, appointment_time, status) 
                             VALUES (?, ?, ?, ?, ?, 'Booked')`;
                db.query(sql, [patientId, doctorId, hospital, date, time], (err, result) => {
                    if(err) return res.json({ success: false, message: err.message });
                    res.json({ success: true, message: 'Appointment booked successfully',
                        data: { appointment_id: result.insertId, patient_id: patientId, doctor_id: doctorId, hospital_id: hospital, date, time }
                    });
                });
            });
        }
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});