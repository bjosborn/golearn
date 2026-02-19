# Regicide Card Game

A multiplayer cooperative card game web application built with HTML, CSS, JavaScript, and Go with MySQL database integration.

## Features

- **Lobby System**: Support for up to 4 players
- **Fancy Card UI**: Beautiful, animated card designs with suit symbols
- **Activity Tracking**: All game actions are logged and tracked
- **MySQL Database**: Complete activity logging to MySQL database
- **Responsive Design**: Works on desktop and mobile devices

## Game Rules

Regicide is a cooperative card game where players work together to defeat 12 enemies (Jacks, Queens, and Kings). Players use numbered cards (Ace through 10) to attack enemies and must defeat all 12 face cards to win.

## Prerequisites

- Go 1.21 or higher
- Docker and Docker Compose (for MySQL)
- Modern web browser

## Installation

1. Clone the repository:
```bash
git clone https://github.com/bjosborn/golearn.git
cd golearn
```

2. Start MySQL database using Docker Compose:
```bash
docker-compose up -d
```

3. Install Go dependencies:
```bash
go mod download
```

4. Run the server:
```bash
go run server.go
```

5. Open your browser and navigate to:
```
http://localhost:8080/
```

## Configuration

### Environment Variables

- `PORT`: Server port (default: 8080)
- `MYSQL_DSN`: MySQL connection string (default: `root:password@tcp(localhost:3306)/regicide`)

### Custom MySQL Configuration

If you want to use a different MySQL instance, set the `MYSQL_DSN` environment variable:

```bash
export MYSQL_DSN="username:password@tcp(host:port)/database"
go run server.go
```

## Database Schema

The application creates three tables:

1. **activity_logs**: Stores all game activities and events
2. **game_sessions**: Tracks game sessions
3. **players**: Stores player information

## Project Structure

```
golearn/
├── web/
│   ├── index.html          # Lobby page
│   ├── game.html           # Game page
│   ├── css/
│   │   └── styles.css      # All styling
│   └── js/
│       ├── lobby.js        # Lobby logic
│       └── game.js         # Game logic
├── server.go               # Go backend server
├── go.mod                  # Go dependencies
├── docker-compose.yml      # MySQL setup
└── README.md              # This file
```

## API Endpoints

- `POST /api/activity`: Log game activity
- `GET /api/activities`: Get recent activities
- `GET /api/health`: Health check endpoint

## Development

The server will run without MySQL if the database is not available, but activity logging will be disabled.

To view database logs:
```bash
docker exec -it regicide-mysql mysql -uroot -ppassword regicide
SELECT * FROM activity_logs ORDER BY timestamp DESC LIMIT 10;
```

## How to Play

1. **Lobby**: 
   - Enter player names (1-4 players)
   - Click "Start Game" when ready

2. **Gameplay**:
   - Select cards from your hand
   - Click "Play Selected Cards" to attack the enemy
   - Defeat all 12 face cards to win!

## Technologies Used

- **Frontend**: HTML5, CSS3, JavaScript (Vanilla)
- **Backend**: Go (Golang)
- **Database**: MySQL 8.0
- **Containerization**: Docker, Docker Compose

## License

MIT License

## Contributing

Pull requests are welcome!