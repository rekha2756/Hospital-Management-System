const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");
const bodyParser = require("body-parser");

const app = express();
const PORT = 5000;

app.use(cors());
app.use(bodyParser.json());

const db = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "Vani@1234#",  // your MySQL password
    database: "hms"
});

db.connect(err => {
    if(err) console.log("Database connection failed: ", err);
    else console.log("Connected to MySQL Database");
});

// Get all hospitals
app.get("/hospitals", (req, res) => {
    db.query("SELECT hospital_id, hospital_name FROM hospitals", (err, results) => {
        if(err) return res.status(500).json({error: err});
        res.json(results);
    });
});

// Get doctors by hospital_id
app.get("/doctors/:hospitalId", (req, res) => {
    const hospitalId = req.params.hospitalId;
    db.query(
        "SELECT doctor_id, name, specialization FROM doctors WHERE hospital_id = ?",
        [hospitalId],
        (err, results) => {
            if(err) return res.status(500).json({error: err});
            res.json(results);
        }
    );
});

// Add new patient
app.post("/patients", (req, res) => {
    const { full_name, contact_number, email } = req.body;
    db.query(
        "INSERT INTO patients (full_name, contact_number, email) VALUES (?, ?, ?)",
        [full_name, contact_number, email],
        (err, result) => {
            if(err) return res.status(500).json({success:false, error: err});
            res.json({success:true, patient_id: result.insertId});
        }
    );
});

// Add new appointment
app.post("/appointments", (req, res) => {
    const { patient_id, hospital_id, doctor_id, appointment_date, appointment_time, status, reason } = req.body;
    db.query(
        "INSERT INTO appointments (patient_id, hospital_id, doctor_id, appointment_date, appointment_time, status, reason) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [patient_id, hospital_id, doctor_id, appointment_date, appointment_time, status, reason],
        (err, result) => {
            if(err) return res.status(500).json({success:false, error: err});
            res.json({success:true, appointment_id: result.insertId});
        }
    );
});

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));