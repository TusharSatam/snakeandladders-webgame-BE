const express = require("express");
const http = require("http");
const socketIO = require("socket.io");
const cors = require("cors");
const { v4: uuidv4 } = require("uuid"); // Import UUID library

const app = express();
const server = http.createServer(app);

// Enable CORS for all routes
app.use(cors());

// Create a Socket.io instance with CORS configuration
const io = socketIO(server, {
    cors: {
      origin: ["http://localhost:3000", "https://snakeandladders-webgame.vercel.app"], // Allow requests from localhost:3000 and snakeandladders-webgame.vercel.app
      methods: ["GET", "POST"],
      allowedHeaders: ["my-custom-header"],
      credentials: true,
    },
  });

let rooms = [];

// Define a Room class to represent each room
class Room {
  constructor(id) {
    this.id = id;
    this.players = [];
    this.currentPlayerIndex = 0; // Initialize currentPlayerIndex for the room
    this.playerPositions = [1, 1];
  }
}

// Function to create a new room and add players to it
const createRoom = () => {
  // Generate a unique room ID using UUID
  const roomId = uuidv4();

  // Create a new room instance
  const room = new Room(roomId);

  // Add the new room to the rooms array
  rooms.push(room);

  return room;
};

// Handle socket connections
io.on("connection", (socket) => {
  console.log(`User ${socket.id} connected`);

  // Handle search request from user
  socket.on("searchOpponent", () => {
    console.log("User is searching for an opponent");

    let roomToJoin = null;

    // Check if there are any rooms with only one player
    const availableRoomIndex = rooms.findIndex(
      (room) => room.players.length === 1
    );

    if (availableRoomIndex !== -1) {
      // If an available room with one player is found, join that room
      roomToJoin = rooms[availableRoomIndex];
      roomToJoin.players.push(socket);

      // Emit the room number to the player
      socket.emit("roomNumber", roomToJoin.id);
      // Emit player color to each player
      if (roomToJoin.players.length === 1) {
        // First player (green)
        socket.emit("playerColor", "green");
      } else {
        // Second player (red)
        socket.emit("playerColor", "red");
      }
      // Start the game if the room is now full
      if (roomToJoin.players.length === 2) {
        // Emit 'opponentFound' event to both players in the room
        roomToJoin.players.forEach((player) => {
          player.emit("opponentFound");
        });
        console.log("Opponent found for both players in room", roomToJoin.id);
      }
    } else {
      // If no available room with one player is found, create a new room
      roomToJoin = createRoom();

      // Add the current player to the newly created room
      roomToJoin.players.push(socket);

      // Emit the room number to the player
      socket.emit("roomNumber", roomToJoin.id);
      // Emit player color to the first player (green)
      socket.emit("playerColor", "green");
    }
  });

  // Handle rollDice event
  socket.on("rollDice", ({ user, roomNumber }) => {
    console.log(`${user} rolled the dice from ${roomNumber}`);

    // Perform dice roll logic
    const diceValue = Math.floor(Math.random() * 6) + 1;

    // Emit the dice roll result back to the client in the specified room
    const room = rooms.find((room) => room.id === roomNumber);
    if (room) {
      room.players.forEach((player) => {
        player.emit("diceRolled", {
          roomNumber: roomNumber,
          diceValue,
          user,
          currentPlayerIndex: room.currentPlayerIndex, // Send currentPlayerIndex of the room
          playerPositions: room.playerPositions,
        });
      });
    }
  });
  // Handle 'updatePositions' event from the client
  socket.on("updatePositions", ({ updatedPositions, roomNumber }) => {
    console.log(
      `updatedPositions${updatedPositions}, roomNumber:${roomNumber}`
    );
    // Find the room to update the player positions
    const room = rooms.find((room) => room.id === roomNumber);
    if (room) {
      // Update player positions in the room
      room.playerPositions = updatedPositions;
      console.log("in playerPositions roomCode ", room);
      console.log("in room.playerPositions roomCode ", room.playerPositions);

      // Broadcast the updated positions to all players in the room
      room.players.forEach((player) => {
        player.emit("updatedPositions", updatedPositions);
      });
    }
  });
  // Handle updateCurrentPlayerIndex event
  socket.on("updateCurrentPlayerIndex", ({ index, roomNumber }) => {
    console.log(
      `Received updateCurrentPlayerIndex event with index: ${index} from room: ${roomNumber}`
    );

    // Find the room to update the currentPlayerIndex
    const room = rooms.find((room) => room.id === roomNumber);
    if (room) {
      room.currentPlayerIndex = index;

      // Broadcast the updated currentPlayerIndex to all players in the room
      room.players.forEach((player) => {
        player.emit("currentPlayerIndex", room.currentPlayerIndex);
      });
    }
  });

  // Handle gameOver event
  socket.on("gameOver", (roomNumber) => {
    console.log(`Game over in room ${roomNumber}`);
    // Find the room and remove it from the list of active rooms
    const roomIndex = rooms.findIndex((room) => room.id === roomNumber);
    if (roomIndex !== -1) {
      rooms.splice(roomIndex, 1);
    }
  });

  // Handle disconnection
  socket.on("disconnect", () => {
    console.log("A user disconnected");
    // Find the room the disconnected user is in
    const roomIndex = rooms.findIndex((room) => room.players.includes(socket));
    if (roomIndex !== -1) {
      const room = rooms[roomIndex];
      // Inform the other player about the opponent's disconnection
      const opponentIndex = room.players.findIndex(
        (player) => player !== socket
      );
      if (opponentIndex !== -1) {
        const opponentSocket = room.players[opponentIndex];
        opponentSocket.emit("opponentDisconnected");
      }
      // Remove the disconnected player from the room
      room.players = room.players.filter((player) => player !== socket);

      // If the room is empty after disconnection, delete the room
      if (room.players.length === 0) {
        rooms.splice(roomIndex, 1);
      }
    }
  });
});

// Listen for connections on port 4000
server.listen(4000, () => {
  console.log("Server is running on port 4000");
});

app.get("/", (req, res) => {
  res.send("Hello");
});
