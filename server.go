package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	_ "github.com/go-sql-driver/mysql"
)

type ActivityLog struct {
	EventType string                 `json:"event_type"`
	Data      map[string]interface{} `json:"data"`
	Timestamp string                 `json:"timestamp"`
}

var db *sql.DB

func initDB() error {
	// MySQL connection string
	// Format: username:password@tcp(host:port)/database
	dsn := os.Getenv("MYSQL_DSN")
	if dsn == "" {
		dsn = "root:password@tcp(localhost:3306)/regicide"
	}

	var err error
	db, err = sql.Open("mysql", dsn)
	if err != nil {
		return fmt.Errorf("error opening database: %v", err)
	}

	// Test connection
	err = db.Ping()
	if err != nil {
		return fmt.Errorf("error connecting to database: %v", err)
	}

	// Create tables if they don't exist
	err = createTables()
	if err != nil {
		return fmt.Errorf("error creating tables: %v", err)
	}

	log.Println("Database connected successfully")
	return nil
}

func createTables() error {
	queries := []string{
		`CREATE TABLE IF NOT EXISTS activity_logs (
			id INT AUTO_INCREMENT PRIMARY KEY,
			event_type VARCHAR(100) NOT NULL,
			event_data JSON,
			timestamp DATETIME NOT NULL,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			INDEX idx_event_type (event_type),
			INDEX idx_timestamp (timestamp)
		)`,
		`CREATE TABLE IF NOT EXISTS game_sessions (
			id INT AUTO_INCREMENT PRIMARY KEY,
			session_id VARCHAR(100) UNIQUE NOT NULL,
			player_count INT NOT NULL,
			status VARCHAR(50) NOT NULL,
			started_at DATETIME NOT NULL,
			ended_at DATETIME,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE TABLE IF NOT EXISTS players (
			id INT AUTO_INCREMENT PRIMARY KEY,
			player_id BIGINT NOT NULL,
			name VARCHAR(100) NOT NULL,
			session_id VARCHAR(100),
			joined_at DATETIME NOT NULL,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (session_id) REFERENCES game_sessions(session_id)
		)`,
	}

	for _, query := range queries {
		_, err := db.Exec(query)
		if err != nil {
			return err
		}
	}

	return nil
}

func logActivity(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var activity ActivityLog
	err := json.NewDecoder(r.Body).Decode(&activity)
	if err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	// Parse timestamp
	timestamp, err := time.Parse(time.RFC3339, activity.Timestamp)
	if err != nil {
		timestamp = time.Now()
	}

	// Convert data to JSON
	dataJSON, err := json.Marshal(activity.Data)
	if err != nil {
		http.Error(w, "Error processing data", http.StatusInternalServerError)
		return
	}

	// Insert into database
	query := "INSERT INTO activity_logs (event_type, event_data, timestamp) VALUES (?, ?, ?)"
	_, err = db.Exec(query, activity.EventType, dataJSON, timestamp)
	if err != nil {
		log.Printf("Error inserting activity log: %v", err)
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}

	log.Printf("Logged activity: %s at %s", activity.EventType, activity.Timestamp)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "success"})
}

func getActivities(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	query := `SELECT id, event_type, event_data, timestamp, created_at 
	          FROM activity_logs 
	          ORDER BY timestamp DESC 
	          LIMIT 100`

	rows, err := db.Query(query)
	if err != nil {
		log.Printf("Error querying activities: %v", err)
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var activities []map[string]interface{}
	for rows.Next() {
		var id int
		var eventType string
		var eventData []byte
		var timestamp, createdAt time.Time

		err := rows.Scan(&id, &eventType, &eventData, &timestamp, &createdAt)
		if err != nil {
			log.Printf("Error scanning row: %v", err)
			continue
		}

		var data map[string]interface{}
		json.Unmarshal(eventData, &data)

		activity := map[string]interface{}{
			"id":         id,
			"event_type": eventType,
			"data":       data,
			"timestamp":  timestamp.Format(time.RFC3339),
			"created_at": createdAt.Format(time.RFC3339),
		}
		activities = append(activities, activity)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(activities)
}

func corsMiddleware(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}

		next(w, r)
	}
}

func main() {
	// Initialize database
	err := initDB()
	if err != nil {
		log.Printf("Warning: Database initialization failed: %v", err)
		log.Println("Server will continue without database support")
	}
	defer func() {
		if db != nil {
			db.Close()
		}
	}()

	// Serve static files
	fs := http.FileServer(http.Dir("./web"))
	http.Handle("/", fs)

	// API endpoints
	http.HandleFunc("/api/activity", corsMiddleware(logActivity))
	http.HandleFunc("/api/activities", corsMiddleware(getActivities))

	// Health check
	http.HandleFunc("/api/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		status := map[string]interface{}{
			"status":   "healthy",
			"database": db != nil,
		}
		json.NewEncoder(w).Encode(status)
	})

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("Starting Regicide server on port %s", port)
	log.Printf("Access the game at http://localhost:%s/", port)
	log.Fatal(http.ListenAndServe(":"+port, nil))
}
